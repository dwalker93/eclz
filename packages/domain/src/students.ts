import { and, asc, count, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { branch, course, enrollment, guardian, lecturer, staffRoleAssignment, student, studentBranch, studentGuardian, studentLevel, user, gradeLevel, STUDENT_STATUSES } from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { ageOn, isCalendarDay } from "./dates";
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
/** A guardian email, trimmed and lowercased; blank means none; anything else must look like an address. One rule for every write path. */
export function normalizeGuardianEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ServiceError("invalid_input", "Invalid email address.");
  return email;
}

/** The username prefix reserved for guardian logins: a login created through `register` may not use it. */
export const GUARDIAN_USERNAME_PREFIX = "parent-";

/**
 * The guardian with this phone number, whatever format it was stored in (`0777000111`, `+94 77 700 0111` and `94777000111` are one number).
 * When old data holds several, the one that already has a login wins, then the one stored in the normalized form, then the oldest.
 */
export async function findGuardianByPhone(tx: Tx, phone: string, excludeId?: string) {
  // The lookup holds a transaction lock on the number, so two transactions that check and then claim the same number (register, link, change of phone)
  // run one after the other and the second sees the first's guardian. Always taken before any guardian row lock.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`guardian-phone:${phone}`}, 0))`);
  const national = phone.slice(2);
  const digits = sql`regexp_replace(${guardian.phone}, '[^0-9]', '', 'g')`;
  const [row] = await tx
    .select()
    .from(guardian)
    .where(and(sql`${digits} IN (${phone}, ${`0${national}`}, ${national})`, excludeId ? ne(guardian.id, excludeId) : undefined))
    .orderBy(sql`(${guardian.userId} IS NOT NULL) DESC`, sql`(${guardian.phone} = ${phone}) DESC`, asc(guardian.createdAt), asc(guardian.id))
    .limit(1);
  return row;
}

/**
 * An existing `parent-<phone>` account may be reused only if it is exactly a guardian login for that phone: the matching phone and username,
 * no other guardian, no student, no lecturer and no staff role on it. Anything else (a student whose username was chosen to look like a parent's)
 * is somebody else's account and must never become this guardian's login.
 */
async function isBareGuardianLogin(tx: Tx, u: { id: string; phone: string | null; username: string | null }, phone: string): Promise<boolean> {
  if (u.phone !== phone || u.username !== `${GUARDIAN_USERNAME_PREFIX}${phone}`) return false;
  const used = await Promise.all([
    tx.select({ id: guardian.id }).from(guardian).where(eq(guardian.userId, u.id)).limit(1),
    tx.select({ id: student.id }).from(student).where(eq(student.userId, u.id)).limit(1),
    tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.userId, u.id)).limit(1),
    tx.select({ id: staffRoleAssignment.id }).from(staffRoleAssignment).where(eq(staffRoleAssignment.userId, u.id)).limit(1),
  ]);
  return used.every((r) => r.length === 0);
}

export async function ensureGuardianLogin(tx: Tx, given: { id: string }): Promise<string | null> {
  // Reads the guardian again under its row lock, the same lock a change of phone takes: a login that was bound meanwhile is kept, and the phone used is the current one.
  const [g] = await tx.select().from(guardian).where(eq(guardian.id, given.id)).for("update");
  if (!g) return null;
  if (g.userId) return g.userId;
  const phone = g.phone ? normalizeSriLankaPhone(g.phone) : null;
  if (!phone) return null;
  let email: string | null = g.email ? g.email.trim().toLowerCase() : null;
  if (email) {
    const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (taken) email = null;
  }
  const username = `${GUARDIAN_USERNAME_PREFIX}${phone}`;
  const [existing] = await tx.select({ id: user.id, phone: user.phone, username: user.username }).from(user).where(eq(user.username, username));
  let userId = existing?.id;
  if (existing && !(await isBareGuardianLogin(tx, existing, phone))) {
    throw new ServiceError("phone_taken", `The login name ${username} belongs to another account, so it cannot become this guardian's login.`);
  }
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
      if (!isCalendarDay(input.dateOfBirth)) throw new ServiceError("invalid_input", "Date of birth must be a real date written YYYY-MM-DD.");
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
        if (input.login?.username?.trim().toLowerCase().startsWith(GUARDIAN_USERNAME_PREFIX)) {
          throw new ServiceError("invalid_input", `Usernames starting with "${GUARDIAN_USERNAME_PREFIX}" are reserved for parent logins.`);
        }
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
        // One entry per person (by normalized phone) before anything is chosen; a repeated number carries its primary flag to the kept entry.
        const people: { g: GuardianInput; phone: string; primary: boolean }[] = [];
        for (const g of guardians) {
          const phone = normalizeSriLankaPhone(g.phone)!;
          const kept = people.find((x) => x.phone === phone);
          if (kept) kept.primary ||= g.isPrimary === true;
          else people.push({ g, phone, primary: g.isPrimary === true });
        }
        const wantPrimary = Math.max(0, people.findIndex((x) => x.primary));
        for (const [i, { g, phone }] of people.entries()) {
          let row = await findGuardianByPhone(tx, phone);
          const created = !row;
          if (!row) {
            [row] = await tx
              .insert(guardian)
              .values({ fullName: clean(g.fullName), phone, address: clean(g.address) || null, nic: g.nic ?? null, email: normalizeGuardianEmail(g.email) })
              .returning();
          }
          const uid = await ensureGuardianLogin(tx, row!);
          await tx.insert(studentGuardian).values({
            studentId: stu!.id,
            guardianId: row!.id,
            relationship: g.relationship ?? null,
            isPrimary: i === wantPrimary,
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

    /**
     * One student with guardians, branches and enrolments. The caller has already been checked (see `authorizeStudent`). `scope` is the caller's
     * `students.read` scope from `branchScope`: enrolments are shown only for courses of those branches (`"all"` shows every one), because
     * a student enrolled in branches A and B is readable by staff of A only for A's part (I1, I2).
     */
    async get(input: { studentId: string; scope: "all" | string[] }) {
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
        .innerJoin(course, eq(course.id, enrollment.courseId))
        .where(and(eq(enrollment.studentId, stu.id), input.scope === "all" ? undefined : inArray(course.branchId, input.scope)))
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
          if (!isCalendarDay(input.dateOfBirth)) throw new ServiceError("invalid_input", "Date of birth must be a real date written YYYY-MM-DD.");
          const today = await todayFor(tx, now());
          if (input.dateOfBirth > today) throw new ServiceError("invalid_input", "Date of birth is in the future.");
          if (input.dateOfBirth !== old.dateOfBirth) {
            // The same rule as unlinking the last guardian: a student under the age limit keeps one. The student row is locked (as in the
            // guardian link changes), so the last guardian cannot be removed between this check and the write.
            const org = await loadOrganization(tx);
            if (ageOn(input.dateOfBirth, today) < org.guardianRequiredBelowAge) {
              const [linked] = await tx.select({ id: studentGuardian.guardianId }).from(studentGuardian).where(eq(studentGuardian.studentId, old.id)).limit(1);
              if (!linked) throw new ServiceError("guardian_required", `A student under ${org.guardianRequiredBelowAge} needs a guardian. Link one first, then correct the date of birth.`);
            }
          }
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
      const rows = await db.select().from(guardian).where(isNull(guardian.userId)).orderBy(asc(guardian.createdAt), asc(guardian.id));
      let provisioned = 0;
      const skipped: string[] = [];
      const conflicts: string[] = [];
      const groups = new Map<string, typeof rows>();
      for (const g of rows) {
        const phone = g.phone ? normalizeSriLankaPhone(g.phone) : null;
        if (!phone) skipped.push(g.id);
        else groups.set(phone, [...(groups.get(phone) ?? []), g]);
      }
      // Guardians that share a number are one person entered twice. They need a human to merge them (their students and notices reference
      // each row), so none of them is provisioned; they are reported and everyone else still is.
      const duplicates = [...groups.values()].filter((g) => g.length > 1).map((g) => g.map((x) => x.id));
      for (const [, group] of groups) {
        if (group.length > 1) continue;
        const g = group[0]!;
        try {
          // Each guardian in its own transaction: one that cannot be provisioned does not undo the rest, and a rerun picks up where this stopped.
          if (await db.transaction((tx) => ensureGuardianLogin(tx, g))) provisioned++;
        } catch (e) {
          if (e instanceof ServiceError && e.code === "phone_taken") conflicts.push(g.id);
          else throw e;
        }
      }
      return { provisioned, skipped, duplicates, conflicts };
    },
  };
}
export type StudentService = ReturnType<typeof createStudentService>;
