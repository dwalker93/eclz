import { and, asc, eq, ne } from "drizzle-orm";
import { authSession, guardian, student, studentGuardian, user } from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { branchScope, requireStudent } from "./authorization";
import { ageOn } from "./dates";
import { ServiceError } from "./errors";
import { loadOrganization, todayFor } from "./lookups";
import { normalizeSriLankaPhone } from "./notifications";
import { ensureGuardianLogin } from "./students";
import { type Db } from "./types";
import { studentBranch } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

const clean = (s: string | undefined | null) => (s ?? "").trim();

/**
 * Guardians after registration: correct their details, change a phone number, add a guardian to a student, remove one, change who is primary.
 * Everything needs `guardians.manage`. A student-level change is checked through the student's branches. A guardian can have several children,
 * so a change to the guardian record needs the permission in any branch of any of their children (an all-branches role always passes).
 * A guardian's login record is kept when they are unlinked: it still serves their other children.
 */
export function createGuardianService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function requireGuardian(actor: string, guardianId: string) {
    const [g] = await db.select().from(guardian).where(eq(guardian.id, guardianId));
    if (!g) throw new ServiceError("not_found", "Guardian not found.");
    const scope = await branchScope(db, actor, "guardians.manage");
    if (scope === "all") return g;
    if (scope.length > 0) {
      const [hit] = await db
        .select({ b: studentBranch.branchId })
        .from(studentGuardian)
        .innerJoin(studentBranch, eq(studentBranch.studentId, studentGuardian.studentId))
        .where(and(eq(studentGuardian.guardianId, guardianId), inArray(studentBranch.branchId, scope)))
        .limit(1);
      if (hit) return g;
    }
    throw new ServiceError("forbidden", "You may not do this (guardians.manage).");
  }

  return {
    /** Name, address, NIC and email. The phone number has its own method because it is also the parent's login. */
    async update(input: { guardianId: string; actor: string; fullName?: string; address?: string | null; nic?: string | null; email?: string | null }) {
      const cur = await requireGuardian(input.actor, input.guardianId);
      const patch: Partial<typeof guardian.$inferInsert> = {};
      if (input.fullName !== undefined) {
        if (!clean(input.fullName)) throw new ServiceError("invalid_input", "A guardian needs a name.");
        patch.fullName = clean(input.fullName);
      }
      if (input.address !== undefined) patch.address = clean(input.address) || null;
      if (input.nic !== undefined) patch.nic = clean(input.nic) || null;
      if (input.email !== undefined) {
        const email = clean(input.email).toLowerCase() || null;
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ServiceError("invalid_input", "Invalid email address.");
        patch.email = email;
      }
      if (Object.keys(patch).length === 0) return cur;
      return db.transaction(async (tx) => {
        const [row] = await tx.update(guardian).set(patch).where(eq(guardian.id, cur.id)).returning();
        await writeAudit(tx, { actor: input.actor, action: "guardian.update", entityType: "guardian", entityId: cur.id, before: { fullName: cur.fullName, address: cur.address, nic: cur.nic, email: cur.email }, after: patch });
        return row!;
      });
    },

    /**
     * Changes the phone number and the parent's login with it (the username is `parent-<phone>`). Their sessions end, so they sign in again with
     * the new number. A number another guardian already has is refused.
     */
    async changePhone(input: { guardianId: string; actor: string; phone: string }) {
      const cur = await requireGuardian(input.actor, input.guardianId);
      const phone = normalizeSriLankaPhone(input.phone);
      if (!phone) throw new ServiceError("invalid_input", `Invalid phone number: ${input.phone}`);
      if (phone === cur.phone) return cur;
      return db.transaction(async (tx) => {
        const [dup] = await tx.select({ id: guardian.id }).from(guardian).where(and(eq(guardian.phone, phone), ne(guardian.id, cur.id)));
        if (dup) throw new ServiceError("phone_taken", "Another guardian already has this phone number.");
        if (cur.userId) {
          const [u] = await tx.select().from(user).where(eq(user.id, cur.userId));
          if (u) {
            const [clash] = await tx.select({ id: user.id }).from(user).where(and(eq(user.phone, phone), ne(user.id, u.id)));
            const username = `parent-${phone}`;
            const [nameClash] = await tx.select({ id: user.id }).from(user).where(and(eq(user.username, username), ne(user.id, u.id)));
            if (clash || nameClash) throw new ServiceError("phone_taken", "This phone number belongs to another login.");
            await tx.update(user).set({ phone, ...(u.username?.startsWith("parent-") ? { username } : {}) }).where(eq(user.id, u.id));
            await tx.delete(authSession).where(eq(authSession.userId, u.id));
          }
        }
        const [row] = await tx.update(guardian).set({ phone }).where(eq(guardian.id, cur.id)).returning();
        await writeAudit(tx, { actor: input.actor, action: "guardian.change_phone", entityType: "guardian", entityId: cur.id, before: { phone: cur.phone }, after: { phone } });
        return row!;
      });
    },

    /** Adds a guardian to a student. A phone number that matches an existing guardian links that person (a sibling's parent) instead of duplicating. */
    async link(input: { studentId: string; actor: string; fullName: string; phone: string; address?: string | null; nic?: string | null; email?: string | null; relationship?: string | null; isPrimary?: boolean }) {
      await requireStudent(db, input.actor, "guardians.manage", input.studentId);
      const phone = normalizeSriLankaPhone(input.phone);
      if (!phone) throw new ServiceError("invalid_input", `Invalid phone number: ${input.phone}`);
      if (!clean(input.fullName)) throw new ServiceError("invalid_input", "A guardian needs a name.");
      return db.transaction(async (tx) => {
        let [row] = await tx.select().from(guardian).where(eq(guardian.phone, phone));
        const created = !row;
        if (!row) {
          [row] = await tx
            .insert(guardian)
            .values({ fullName: clean(input.fullName), phone, address: clean(input.address) || null, nic: clean(input.nic) || null, email: clean(input.email).toLowerCase() || null })
            .returning();
        }
        const [already] = await tx.select().from(studentGuardian).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, row!.id)));
        if (already) throw new ServiceError("guardian_linked", "This guardian is already linked to the student.");
        const others = await tx.select({ id: studentGuardian.guardianId }).from(studentGuardian).where(eq(studentGuardian.studentId, input.studentId));
        const primary = input.isPrimary === true || others.length === 0;
        if (primary) await tx.update(studentGuardian).set({ isPrimary: false }).where(eq(studentGuardian.studentId, input.studentId));
        const uid = await ensureGuardianLogin(tx, row!);
        await tx.insert(studentGuardian).values({ studentId: input.studentId, guardianId: row!.id, relationship: clean(input.relationship) || null, isPrimary: primary });
        await writeAudit(tx, { actor: input.actor, action: "guardian.link", entityType: "student", entityId: input.studentId, after: { guardianId: row!.id, created, relationship: input.relationship ?? null, isPrimary: primary } });
        return { guardianId: row!.id, userId: uid, created, isPrimary: primary };
      });
    },

    /** Changes the relationship or makes this guardian the primary one (the previous primary steps down). */
    async updateLink(input: { studentId: string; guardianId: string; actor: string; relationship?: string | null; isPrimary?: true }) {
      await requireStudent(db, input.actor, "guardians.manage", input.studentId);
      return db.transaction(async (tx) => {
        const [cur] = await tx.select().from(studentGuardian).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, input.guardianId)));
        if (!cur) throw new ServiceError("not_found", "This guardian is not linked to the student.");
        if (input.isPrimary) await tx.update(studentGuardian).set({ isPrimary: false }).where(eq(studentGuardian.studentId, input.studentId));
        const patch: Partial<typeof studentGuardian.$inferInsert> = {};
        if (input.relationship !== undefined) patch.relationship = clean(input.relationship) || null;
        if (input.isPrimary) patch.isPrimary = true;
        if (Object.keys(patch).length) await tx.update(studentGuardian).set(patch).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, input.guardianId)));
        await writeAudit(tx, { actor: input.actor, action: "guardian.update_link", entityType: "student", entityId: input.studentId, before: { relationship: cur.relationship, isPrimary: cur.isPrimary }, after: { guardianId: input.guardianId, ...patch } });
        return { ...cur, ...patch };
      });
    },

    /**
     * Removes the link, not the guardian. A student under the guardian-required age keeps at least one guardian. When the primary is removed,
     * the next guardian by name becomes primary.
     */
    async unlink(input: { studentId: string; guardianId: string; actor: string }) {
      await requireStudent(db, input.actor, "guardians.manage", input.studentId);
      await db.transaction(async (tx) => {
        const links = await tx.select().from(studentGuardian).where(eq(studentGuardian.studentId, input.studentId));
        const cur = links.find((l) => l.guardianId === input.guardianId);
        if (!cur) throw new ServiceError("not_found", "This guardian is not linked to the student.");
        if (links.length === 1) {
          const [s] = await tx.select({ dob: student.dateOfBirth }).from(student).where(eq(student.id, input.studentId));
          const org = await loadOrganization(tx);
          if (ageOn(s!.dob, await todayFor(tx, now())) < org.guardianRequiredBelowAge) throw new ServiceError("guardian_required", `A student under ${org.guardianRequiredBelowAge} needs a guardian.`);
        }
        await tx.delete(studentGuardian).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, input.guardianId)));
        let promoted: string | null = null;
        if (cur.isPrimary && links.length > 1) {
          const [next] = await tx
            .select({ id: guardian.id })
            .from(studentGuardian)
            .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
            .where(eq(studentGuardian.studentId, input.studentId))
            .orderBy(asc(guardian.fullName), asc(guardian.id))
            .limit(1);
          promoted = next!.id;
          await tx.update(studentGuardian).set({ isPrimary: true }).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, promoted)));
        }
        await writeAudit(tx, { actor: input.actor, action: "guardian.unlink", entityType: "student", entityId: input.studentId, before: { guardianId: input.guardianId, isPrimary: cur.isPrimary }, after: { promoted } });
      });
    },
  };
}

export type GuardianService = ReturnType<typeof createGuardianService>;
