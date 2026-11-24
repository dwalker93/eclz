import { and, asc, eq, ne, or } from "drizzle-orm";
import { authSession, guardian, student, studentGuardian, user } from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { branchScope, guardianInScope, requireStudent } from "./authorization";
import { ageOn } from "./dates";
import { ServiceError } from "./errors";
import { loadOrganization, todayFor } from "./lookups";
import { normalizeSriLankaPhone } from "./notifications";
import { ensureGuardianLogin, findGuardianByPhone, normalizeGuardianEmail } from "./students";
import { lockStudent } from "./lookups";
import { type Db, type Tx } from "./types";

type Q = Db | Tx;

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
    if (!(await guardianInScope(db, actor, guardianId))) throw new ServiceError("forbidden", "You may not do this (guardians.manage).");
    return g;
  }

  return {
    /** Name, address, NIC and email. The phone number has its own method because it is also the parent's login. */
    async update(input: { guardianId: string; actor: string; fullName?: string; address?: string | null; nic?: string | null; email?: string | null }) {
      const seen = await requireGuardian(input.actor, input.guardianId);
      const patch: Partial<typeof guardian.$inferInsert> = {};
      if (input.fullName !== undefined) {
        if (!clean(input.fullName)) throw new ServiceError("invalid_input", "A guardian needs a name.");
        patch.fullName = clean(input.fullName);
      }
      if (input.address !== undefined) patch.address = clean(input.address) || null;
      if (input.nic !== undefined) patch.nic = clean(input.nic) || null;
      if (input.email !== undefined) patch.email = normalizeGuardianEmail(input.email);
      if (Object.keys(patch).length === 0) return seen;
      return db.transaction(async (tx) => {
        // The before-image is the row as locked here, so two concurrent edits each record the value they actually replaced.
        const [cur] = await tx.select().from(guardian).where(eq(guardian.id, input.guardianId)).for("update");
        if (!cur) throw new ServiceError("not_found", "Guardian not found.");
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
      await requireGuardian(input.actor, input.guardianId);
      const phone = normalizeSriLankaPhone(input.phone);
      if (!phone) throw new ServiceError("invalid_input", `Invalid phone number: ${input.phone}`);
      return db.transaction(async (tx) => {
        // Lock order: the number first (inside findGuardianByPhone), then the guardian row. Both are held to the end, so a rival claim of the same
        // number, or a login provisioned meanwhile, is seen here and not missed.
        const dup = await findGuardianByPhone(tx, phone, input.guardianId);
        if (dup) throw new ServiceError("phone_taken", "Another guardian already has this phone number.");
        const [cur] = await tx.select().from(guardian).where(eq(guardian.id, input.guardianId)).for("update");
        if (!cur) throw new ServiceError("not_found", "Guardian not found.");
        if (phone === cur.phone) return cur;
        // The number and its login name must be free whether or not this guardian has a login yet; only the guardian's own login is exempt.
        const username = `parent-${phone}`;
        const [clash] = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(or(eq(user.phone, phone), eq(user.username, username)), cur.userId ? ne(user.id, cur.userId) : undefined))
          .limit(1);
        if (clash) throw new ServiceError("phone_taken", "This phone number belongs to another login.");
        if (cur.userId) {
          const [u] = await tx.select().from(user).where(eq(user.id, cur.userId)).for("update");
          if (u) {
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
      const email = normalizeGuardianEmail(input.email);
      return db.transaction(async (tx) => {
        await lockStudent(tx, input.studentId); // every change to a student's guardian links runs one at a time
        let row = await findGuardianByPhone(tx, phone);
        if (row) {
          // Reusing a known guardian by phone alone would hand this actor that guardian (details, login phone) through the new link. It is allowed
          // when the actor already manages one of the guardian's children, or the guardian has no student yet; otherwise an all-branches
          // manager has to make the link.
          const [anyLink] = await tx.select({ id: studentGuardian.studentId }).from(studentGuardian).where(eq(studentGuardian.guardianId, row.id)).limit(1);
          if (anyLink && !(await guardianInScope(tx, input.actor, row.id))) {
            throw new ServiceError("forbidden", "This phone number belongs to a guardian of students outside your branches. Ask an all-branches manager to link them.");
          }
        }
        const created = !row;
        if (!row) {
          [row] = await tx
            .insert(guardian)
            .values({ fullName: clean(input.fullName), phone, address: clean(input.address) || null, nic: clean(input.nic) || null, email })
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
        await lockStudent(tx, input.studentId);
        const [cur] = await tx.select().from(studentGuardian).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, input.guardianId)));
        if (!cur) throw new ServiceError("not_found", "This guardian is not linked to the student.");
        if (input.isPrimary) await tx.update(studentGuardian).set({ isPrimary: false }).where(eq(studentGuardian.studentId, input.studentId));
        const patch: Partial<typeof studentGuardian.$inferInsert> = {};
        if (input.relationship !== undefined) patch.relationship = clean(input.relationship) || null;
        if (input.isPrimary) patch.isPrimary = true;
        if (Object.keys(patch).length) {
          const done = await tx.update(studentGuardian).set(patch).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, cur.guardianId))).returning({ g: studentGuardian.guardianId });
          // A link that vanished leaves nothing to change: fail, so the demotion above rolls back and no success is audited.
          if (done.length === 0) throw new ServiceError("not_found", "This guardian is not linked to the student.");
        }
        await writeAudit(tx, { actor: input.actor, action: "guardian.update_link", entityType: "student", entityId: input.studentId, before: { relationship: cur.relationship, isPrimary: cur.isPrimary }, after: { guardianId: cur.guardianId, ...patch } });
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
        await lockStudent(tx, input.studentId); // before the links are read, so a concurrent removal or promotion is seen
        const links = await tx.select().from(studentGuardian).where(eq(studentGuardian.studentId, input.studentId));
        // Matched as a uuid by the database, so an upper-case id finds the same link.
        const [found] = await tx.select().from(studentGuardian).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, input.guardianId)));
        const cur = found;
        if (!cur) throw new ServiceError("not_found", "This guardian is not linked to the student.");
        if (links.length === 1) {
          const [s] = await tx.select({ dob: student.dateOfBirth }).from(student).where(eq(student.id, input.studentId));
          const org = await loadOrganization(tx);
          if (ageOn(s!.dob, await todayFor(tx, now())) < org.guardianRequiredBelowAge) throw new ServiceError("guardian_required", `A student under ${org.guardianRequiredBelowAge} needs a guardian.`);
        }
        await tx.delete(studentGuardian).where(and(eq(studentGuardian.studentId, input.studentId), eq(studentGuardian.guardianId, cur.guardianId)));
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
        await writeAudit(tx, { actor: input.actor, action: "guardian.unlink", entityType: "student", entityId: input.studentId, before: { guardianId: cur.guardianId, isPrimary: cur.isPrimary }, after: { promoted } });
      });
    },
  };
}

export type GuardianService = ReturnType<typeof createGuardianService>;
