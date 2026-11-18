import { and, asc, count, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { branch, enrollment, guardian, student, studentBranch, studentGuardian, studentLevel, user, gradeLevel, STUDENT_STATUSES } from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { ageOn } from "./dates";
import { loadOrganization, todayFor } from "./lookups";
import { normalizeSriLankaPhone } from "./notifications";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

export interface GuardianInput {
  fullName: string;
  phone: string;
  address: string;
  relationship?: string;
  isPrimary?: boolean;
  nic?: string;
  email?: string;
}

const clean = (s: string | undefined | null) => (s ?? "").trim();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Finds or creates the guardian's lightweight login record: a user with a username `parent-<94XXXXXXXXX>`, the phone number,
 * the email when it is given and free, and no password (they cannot sign in until invited and a password is set).
 * This is what lets notifications reach a parent, because notifications belong to users.
 */
export async function ensureGuardianLogin(tx: Tx, g: { id: string; userId: string | null; phone: string | null; email: string | null }): Promise<string | null> {
  if (g.userId) return g.userId;
  const phone = g.phone ? normalizeSriLankaPhone(g.phone) : null;
  if (!phone) return null;
  let email: string | null = g.email ? g.email.trim().toLowerCase() : null;
  if (email) {
    const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (taken) email = null;
  }
  const username = `parent-${phone}`;
  const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.username, username));
  let userId = existing?.id;
  if (!userId) {
    const [u] = await tx.insert(user).values({ username, email, phone, status: "active" }).returning({ id: user.id });
    userId = u!.id;
  }
  await tx.update(guardian).set({ userId, portalEnabled: true }).where(eq(guardian.id, g.id));
  return userId;
}

export function createStudentService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  return {
    /**
     * Registers a student (B1, B2). Name and date of birth are required. A student younger than the organization's
     * `guardian_required_below_age` on the registration day needs at least one guardian with name, phone and address.
     * Each guardian gets a lightweight login record automatically, so parent notifications work from day one. A guardian whose
     * phone number matches an existing guardian is the same person (a sibling's parent) and is linked, not duplicated.
     * The student number is generated (STU-000001, ...) unless one is given. An optional grade starts a `student_level` on the registration day.
     */
    async register(input: {
      fullName: string;
      dateOfBirth: string;
      gradeLevelId?: string;
      studentNo?: string;
      gender?: string;
      schoolName?: string;
      nic?: string;
      contactEmail?: string;
      contactPhone?: string;
      /** Give the student their own login (email or username, no password yet). */
      login?: { email?: string; username?: string };
      guardians?: GuardianInput[];
      registeredOn?: string;
      /** The branch the student joins (primary). Without it the student belongs to no branch until enrolled, so branch staff cannot see them. */
      branchId?: string;
    }) {
      const fullName = clean(input.fullName);
      if (!fullName) throw new ServiceError("invalid_input", "The student's name is required.");
      if (!DAY.test(input.dateOfBirth)) throw new ServiceError("invalid_input", "Date of birth must be YYYY-MM-DD.");
      const guardians = input.guardians ?? [];
      for (const g of guardians) {
        if (!clean(g.fullName)) throw new ServiceError("guardian_required", "Every guardian needs a name.");
        if (!clean(g.phone)) throw new ServiceError("guardian_required", "Every guardian needs a phone number.");
        if (!normalizeSriLankaPhone(g.phone)) throw new ServiceError("invalid_input", `Invalid guardian phone number: ${g.phone}`);
      }
      return db.transaction(async (tx) => {
        const org = await loadOrganization(tx);
        const on = input.registeredOn ?? (await todayFor(tx, now()));
        if (input.dateOfBirth > on) throw new ServiceError("invalid_input", "Date of birth is in the future.");
        if (ageOn(input.dateOfBirth, on) < org.guardianRequiredBelowAge) {
          if (guardians.length === 0) throw new ServiceError("guardian_required", `A student under ${org.guardianRequiredBelowAge} needs a guardian.`);
          if (guardians.some((g) => !clean(g.address))) throw new ServiceError("guardian_required", "A guardian needs an address for a student of this age.");
        }
        if (input.branchId) {
          const [b] = await tx.select({ id: branch.id }).from(branch).where(eq(branch.id, input.branchId));
          if (!b) throw new ServiceError("not_found", "Branch not found.");
        }
        if (input.gradeLevelId) {
          const [gl] = await tx.select({ id: gradeLevel.id }).from(gradeLevel).where(eq(gradeLevel.id, input.gradeLevelId));
          if (!gl) throw new ServiceError("not_found", "Grade not found.");
        }

        let studentNo = clean(input.studentNo);
        if (studentNo) {
          const [dupe] = await tx.select({ id: student.id }).from(student).where(eq(student.studentNo, studentNo));
          if (dupe) throw new ServiceError("invalid_input", `Student number ${studentNo} is already used.`);
        } else {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(7001)`);
          let next = Number((await tx.select({ c: count() }).from(student))[0]!.c) + 1;
          for (;;) {
            studentNo = `STU-${String(next).padStart(6, "0")}`;
            const [dupe] = await tx.select({ id: student.id }).from(student).where(eq(student.studentNo, studentNo));
            if (!dupe) break;
            next++;
          }
        }

        let userId: string | null = null;
        if (input.login && (input.login.email || input.login.username)) {
          try {
            const [u] = await tx
              .insert(user)
              .values({ email: input.login.email?.trim().toLowerCase() ?? null, username: input.login.username?.trim() ?? null, phone: input.contactPhone ?? null })
              .returning({ id: user.id });
            userId = u!.id;
          } catch {
            throw new ServiceError("invalid_input", "That email or username is already used.");
          }
        }

        const [stu] = await tx
          .insert(student)
          .values({
            userId,
            studentNo,
            fullName,
            dateOfBirth: input.dateOfBirth,
            gender: input.gender ?? null,
            schoolName: input.schoolName ?? null,
            nic: input.nic ?? null,
            contactEmail: input.contactEmail ?? null,
            contactPhone: input.contactPhone ?? null,
          })
          .returning();
        if (input.branchId) await tx.insert(studentBranch).values({ studentId: stu!.id, branchId: input.branchId, isPrimary: true, joinedOn: on });
        if (input.gradeLevelId) await tx.insert(studentLevel).values({ studentId: stu!.id, gradeLevelId: input.gradeLevelId, fromDate: on });

        const linked: { guardianId: string; userId: string | null; created: boolean }[] = [];
        const seen = new Set<string>();
        const wantPrimary = guardians.findIndex((g) => g.isPrimary);
        for (const [i, g] of guardians.entries()) {
          const phone = normalizeSriLankaPhone(g.phone)!;
          if (seen.has(phone)) continue; // the same parent listed twice
          seen.add(phone);
          let [row] = await tx.select().from(guardian).where(eq(guardian.phone, phone));
          const created = !row;
          if (!row) {
            [row] = await tx
              .insert(guardian)
              .values({ fullName: clean(g.fullName), phone, address: clean(g.address) || null, nic: g.nic ?? null, email: g.email ?? null })
              .returning();
          }
          const uid = await ensureGuardianLogin(tx, row!);
          await tx.insert(studentGuardian).values({
            studentId: stu!.id,
            guardianId: row!.id,
            relationship: g.relationship ?? null,
            isPrimary: wantPrimary >= 0 ? i === wantPrimary : linked.length === 0,
          });
          linked.push({ guardianId: row!.id, userId: uid, created });
        }
        return { student: stu!, guardians: linked };
      });
    },

    /**
     * Students the caller may see, by name, student number or phone. `scope` is `"all"` or the branch ids from `branchScope` (I2): an empty
     * list returns nothing. A student in several branches appears once.
     */
    async list(input: { scope: "all" | string[]; search?: string; limit?: number; offset?: number }) {
      if (input.scope !== "all" && input.scope.length === 0) return [];
      const term = input.search?.trim();
      const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
      const rows = await db
        .selectDistinct({ id: student.id, studentNo: student.studentNo, fullName: student.fullName, status: student.status, dateOfBirth: student.dateOfBirth })
        .from(student)
        .leftJoin(studentBranch, eq(studentBranch.studentId, student.id))
        .where(
          and(
            input.scope === "all" ? undefined : inArray(studentBranch.branchId, input.scope),
            like ? or(ilike(student.fullName, like), ilike(student.studentNo, like), ilike(student.contactPhone, like)) : undefined,
          ),
        )
        .orderBy(asc(student.fullName), asc(student.id))
        .limit(Math.min(Math.max(input.limit ?? 50, 1), 200))
        .offset(Math.max(input.offset ?? 0, 0));
      return rows;
    },

    /** One student with guardians, branches and enrolments. The caller has already been checked (see `authorizeStudent`). */
    async get(input: { studentId: string }) {
      const [stu] = await db.select().from(student).where(eq(student.id, input.studentId));
      if (!stu) throw new ServiceError("not_found", "Student not found.");
      const guardians = await db
        .select({ id: guardian.id, fullName: guardian.fullName, phone: guardian.phone, address: guardian.address, relationship: studentGuardian.relationship, isPrimary: studentGuardian.isPrimary, portalEnabled: guardian.portalEnabled })
        .from(studentGuardian)
        .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
        .where(eq(studentGuardian.studentId, stu.id))
        .orderBy(asc(guardian.fullName));
      const branches = await db.select({ branchId: studentBranch.branchId, isPrimary: studentBranch.isPrimary }).from(studentBranch).where(eq(studentBranch.studentId, stu.id));
      const enrolments = await db
        .select({ id: enrollment.id, courseId: enrollment.courseId, status: enrollment.status, accessStatus: enrollment.accessStatus, enrolledOn: enrollment.enrolledOn })
        .from(enrollment)
        .where(eq(enrollment.studentId, stu.id))
        .orderBy(asc(enrollment.enrolledOn), asc(enrollment.id));
      return { student: stu, guardians, branches, enrolments };
    },

    /** Edits the basic details. Audited with before and after (J3). Fields left out stay as they are. */
    async update(input: {
      studentId: string;
      actor: string;
      fullName?: string;
      dateOfBirth?: string;
      gender?: string | null;
      schoolName?: string | null;
      nic?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      status?: (typeof STUDENT_STATUSES)[number];
    }) {
      return db.transaction(async (tx) => {
        const [old] = await tx.select().from(student).where(eq(student.id, input.studentId)).for("update");
        if (!old) throw new ServiceError("not_found", "Student not found.");
        const patch: Partial<typeof student.$inferInsert> = {};
        if (input.fullName !== undefined) {
          if (!clean(input.fullName)) throw new ServiceError("invalid_input", "The student's name is required.");
          patch.fullName = clean(input.fullName);
        }
        if (input.dateOfBirth !== undefined) {
          if (!DAY.test(input.dateOfBirth)) throw new ServiceError("invalid_input", "Date of birth must be YYYY-MM-DD.");
          patch.dateOfBirth = input.dateOfBirth;
        }
        if (input.status !== undefined) {
          if (!STUDENT_STATUSES.includes(input.status)) throw new ServiceError("invalid_input", "Unknown status.");
          patch.status = input.status;
        }
        for (const k of ["gender", "schoolName", "nic", "contactEmail", "contactPhone"] as const) if (input[k] !== undefined) patch[k] = input[k];
        if (Object.keys(patch).length === 0) return old;
        const [row] = await tx.update(student).set(patch).where(eq(student.id, old.id)).returning();
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        for (const k of Object.keys(patch) as (keyof typeof patch)[]) {
          before[k] = old[k as keyof typeof old];
          after[k] = row![k as keyof typeof row];
        }
        await writeAudit(tx, { actor: input.actor, action: "student.update", entityType: "student", entityId: old.id, before, after });
        return row!;
      });
    },

    /**
     * Gives a login record to every guardian that has a valid phone number but no user yet (for data that was entered before
     * this rule, or by import). Safe to run again. Returns how many were created or linked and which guardians had no usable phone.
     */
    async provisionGuardianLogins() {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(guardian).where(isNull(guardian.userId));
        let provisioned = 0;
        const skipped: string[] = [];
        for (const g of rows) {
          if (await ensureGuardianLogin(tx, g)) provisioned++;
          else skipped.push(g.id);
        }
        return { provisioned, skipped };
      });
    },
  };
}
export type StudentService = ReturnType<typeof createStudentService>;
