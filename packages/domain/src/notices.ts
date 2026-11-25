import { and, desc, eq, inArray, isNull, or, gt, lte, sql } from "drizzle-orm";
import { branch, course, enrollment, gradeLevel, notice, noticeTarget, role, staffRoleAssignment, student, studentBranch, studentGuardian, studentLevel } from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { branchScope, canonicalUuid, requirePermission } from "./authorization";
import { ServiceError } from "./errors";
import { todayFor } from "./lookups";
import { type Db, type Tx } from "./types";

export type NoticeTargetInput =
  | { type: "all" }
  | { type: "role" | "course" | "grade" | "student"; id: string };

export interface NoticeView {
  id: string;
  authorId: string;
  branchId: string | null;
  title: string;
  body: string;
  publishedAt: Date;
  expiresAt: Date | null;
  targets: { type: string; id: string | null }[];
}

/**
 * Notices (ERD section 8). A notice belongs to one branch or to all branches (`branchId` null) and is aimed at everyone, a staff role, a course,
 * a grade or one student. Writing needs `notices.manage` in the notice's branch (an all-branches notice needs an all-branches assignment).
 * Students and parents see a notice when it is published, not expired, in one of the student's branches (or all) and aimed at them.
 */
export function createNoticeService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function validateTargets(tx: Tx, branchId: string | null, targets: NoticeTargetInput[]) {
    const seen = new Set<string>();
    for (const t of targets) {
      const key = t.type === "all" ? "all" : `${t.type}:${t.id}`;
      if (seen.has(key)) throw new ServiceError("invalid_input", "The same target is listed twice.");
      seen.add(key);
      if (t.type === "all") {
        if (targets.length > 1) throw new ServiceError("invalid_input", "A notice for everyone cannot have other targets.");
        continue;
      }
      if (t.type === "role") {
        const [r] = await tx.select({ id: role.id }).from(role).where(eq(role.id, t.id));
        if (!r) throw new ServiceError("invalid_input", "Role not found.");
      } else if (t.type === "grade") {
        const [g] = await tx.select({ id: gradeLevel.id }).from(gradeLevel).where(eq(gradeLevel.id, t.id));
        if (!g) throw new ServiceError("invalid_input", "Grade not found.");
      } else if (t.type === "course") {
        const [c] = await tx.select({ branchId: course.branchId }).from(course).where(eq(course.id, t.id));
        if (!c) throw new ServiceError("invalid_input", "Course not found.");
        if (branchId && c.branchId !== branchId) throw new ServiceError("invalid_input", "The course is in another branch.");
      } else {
        const [s] = await tx.select({ id: student.id }).from(student).where(eq(student.id, t.id));
        if (!s) throw new ServiceError("invalid_input", "Student not found.");
        if (branchId) {
          const [m] = await tx.select({ id: studentBranch.studentId }).from(studentBranch).where(and(eq(studentBranch.studentId, t.id), eq(studentBranch.branchId, branchId)));
          if (!m) throw new ServiceError("invalid_input", "The student is not in this branch.");
        }
      }
    }
  }

  async function withTargets(rows: (typeof notice.$inferSelect)[], q: Db | Tx = db): Promise<NoticeView[]> {
    if (rows.length === 0) return [];
    const ts = await q.select().from(noticeTarget).where(inArray(noticeTarget.noticeId, rows.map((r) => r.id)));
    // One pass groups the targets by notice, so a long feed costs its size and not size squared.
    const byNotice = new Map<string, { type: string; id: string | null }[]>();
    for (const t of ts) {
      const list = byNotice.get(t.noticeId) ?? [];
      list.push({ type: t.targetType, id: t.targetId });
      byNotice.set(t.noticeId, list);
    }
    return rows.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      branchId: r.branchId,
      title: r.title,
      body: r.body,
      publishedAt: r.publishedAt,
      expiresAt: r.expiresAt,
      targets: byNotice.get(r.id) ?? [],
    }));
  }

  /** Notices a set of students may see right now (union), newest first. */
  async function visibleTo(studentIds: string[]): Promise<NoticeView[]> {
    if (studentIds.length === 0) return [];
    const at = now();
    // The organization's local day, from the same clock as `at`, decides which grade and which course access are in effect (as access.ts does).
    const today = await todayFor(db, at);
    const [branches, courses, levels] = await Promise.all([
      db.select({ s: studentBranch.studentId, b: studentBranch.branchId }).from(studentBranch).where(inArray(studentBranch.studentId, studentIds)),
      // A course notice reaches an enrolment whose access has started and not ended; a confirmed move starts its new enrolment on a later day.
      db
        .select({ s: enrollment.studentId, c: enrollment.courseId })
        .from(enrollment)
        .where(and(inArray(enrollment.studentId, studentIds), eq(enrollment.status, "active"), lte(enrollment.accessStartsOn, today), or(isNull(enrollment.accessEndsOn), gt(enrollment.accessEndsOn, today)))),
      // The grade in effect today: a promotion confirmed in March for 1 April closes the old grade on 1 April, so the new row must not count yet.
      db
        .select({ s: studentLevel.studentId, g: studentLevel.gradeLevelId })
        .from(studentLevel)
        .where(and(inArray(studentLevel.studentId, studentIds), lte(studentLevel.fromDate, today), or(isNull(studentLevel.toDate), gt(studentLevel.toDate, today)))),
    ]);
    const live = await db
      .select()
      .from(notice)
      .where(and(lte(notice.publishedAt, at), or(isNull(notice.expiresAt), gt(notice.expiresAt, at))))
      .orderBy(desc(notice.publishedAt), desc(notice.id));
    const views = await withTargets(live);
    return views.filter((n) =>
      studentIds.some((sid) => {
        if (n.branchId && !branches.some((x) => x.s === sid && x.b === n.branchId)) return false;
        return n.targets.some((t) => {
          if (t.type === "all") return true;
          if (t.type === "student") return t.id === sid;
          if (t.type === "course") return courses.some((x) => x.s === sid && x.c === t.id);
          if (t.type === "grade") return levels.some((x) => x.s === sid && x.g === t.id);
          return false; // role targets are for staff only
        });
      }),
    );
  }

  return {
    async create(input: { actor: string; branchId: string | null; title: string; body: string; expiresAt?: Date | null; publishAt?: Date; targets?: NoticeTargetInput[] }): Promise<NoticeView> {
      // One spelling of the branch for the permission check, the target checks and the audit row.
      if (input.branchId) input = { ...input, branchId: canonicalUuid(input.branchId) };
      await requirePermission(db, input.actor, "notices.manage", { branchId: input.branchId });
      const title = input.title.trim();
      const body = input.body.trim();
      if (!title || title.length > 200) throw new ServiceError("invalid_input", "A title of 1 to 200 characters is required.");
      if (!body || body.length > 10000) throw new ServiceError("invalid_input", "A body of 1 to 10000 characters is required.");
      const publishedAt = input.publishAt ?? now();
      if (input.expiresAt && input.expiresAt <= publishedAt) throw new ServiceError("invalid_input", "The expiry must be after the publish time.");
      const targets = input.targets && input.targets.length > 0 ? input.targets : [{ type: "all" as const }];
      return db.transaction(async (tx) => {
        if (input.branchId) {
          const [b] = await tx.select({ id: branch.id }).from(branch).where(eq(branch.id, input.branchId));
          if (!b) throw new ServiceError("invalid_input", "Branch not found.");
        }
        await validateTargets(tx, input.branchId, targets);
        const [n] = await tx.insert(notice).values({ authorId: input.actor, branchId: input.branchId, title, body, publishedAt, expiresAt: input.expiresAt ?? null }).returning();
        await tx.insert(noticeTarget).values(targets.map((t) => ({ noticeId: n!.id, targetType: t.type, targetId: t.type === "all" ? null : t.id })));
        await writeAudit(tx, { actor: input.actor, action: "notice.create", entityType: "notice", entityId: n!.id, after: { title, branchId: input.branchId, targets } });
        const [view] = await withTargets([n!], tx);
        return view!;
      });
    },

    /** Change the wording or the expiry. The branch and the audience stay as published. */
    async update(input: { noticeId: string; actor: string; title?: string; body?: string; expiresAt?: Date | null }): Promise<NoticeView> {
      const [seen] = await db.select().from(notice).where(eq(notice.id, input.noticeId));
      if (!seen) throw new ServiceError("not_found", "Notice not found.");
      await requirePermission(db, input.actor, "notices.manage", { branchId: seen.branchId });
      return db.transaction(async (tx) => {
        // The fields left out of the patch come from the row as locked here, so a title edit never writes back an older body.
        const [cur] = await tx.select().from(notice).where(eq(notice.id, input.noticeId)).for("update");
        if (!cur) throw new ServiceError("not_found", "Notice not found.");
        const title = input.title === undefined ? cur.title : input.title.trim();
        const body = input.body === undefined ? cur.body : input.body.trim();
        if (!title || title.length > 200) throw new ServiceError("invalid_input", "A title of 1 to 200 characters is required.");
        if (!body || body.length > 10000) throw new ServiceError("invalid_input", "A body of 1 to 10000 characters is required.");
        const expiresAt = input.expiresAt === undefined ? cur.expiresAt : input.expiresAt;
        if (expiresAt && expiresAt <= cur.publishedAt) throw new ServiceError("invalid_input", "The expiry must be after the publish time.");
        const [n] = await tx.update(notice).set({ title, body, expiresAt }).where(eq(notice.id, cur.id)).returning();
        if (!n) throw new ServiceError("not_found", "Notice not found.");
        await writeAudit(tx, { actor: input.actor, action: "notice.update", entityType: "notice", entityId: cur.id, before: { title: cur.title, body: cur.body, expiresAt: cur.expiresAt }, after: { title, body, expiresAt } });
        const [view] = await withTargets([n], tx);
        return view!;
      });
    },

    /** Take a notice down for good (its targets go with it). The audit trail keeps what it said. */
    async remove(input: { noticeId: string; actor: string }): Promise<void> {
      const [seen] = await db.select().from(notice).where(eq(notice.id, input.noticeId));
      if (!seen) throw new ServiceError("not_found", "Notice not found.");
      await requirePermission(db, input.actor, "notices.manage", { branchId: seen.branchId });
      await db.transaction(async (tx) => {
        // The audit records the row the delete actually removed; if another manager removed it first there is nothing to delete or audit.
        const [gone] = await tx.delete(notice).where(eq(notice.id, seen.id)).returning();
        if (!gone) throw new ServiceError("not_found", "Notice not found.");
        await writeAudit(tx, { actor: input.actor, action: "notice.remove", entityType: "notice", entityId: gone.id, before: { title: gone.title, body: gone.body, branchId: gone.branchId } });
      });
    },

    /** Every notice a manager may maintain (live, scheduled and expired): all of them with an all-branches assignment, else those of their branches. */
    async listManaged(input: { actor: string; limit?: number; offset?: number }): Promise<NoticeView[]> {
      const scope = await branchScope(db, input.actor, "notices.manage");
      if (scope !== "all" && scope.length === 0) throw new ServiceError("forbidden", "You do not have the notices.manage permission.");
      const rows = await db
        .select()
        .from(notice)
        .where(scope === "all" ? undefined : inArray(notice.branchId, scope))
        .orderBy(desc(notice.publishedAt), desc(notice.id))
        .limit(Math.min(input.limit ?? 50, 200))
        .offset(input.offset ?? 0);
      return withTargets(rows);
    },

    async get(input: { noticeId: string; actor: string }): Promise<NoticeView> {
      const [cur] = await db.select().from(notice).where(eq(notice.id, input.noticeId));
      if (!cur) throw new ServiceError("not_found", "Notice not found.");
      await requirePermission(db, input.actor, "notices.manage", { branchId: cur.branchId });
      return (await withTargets([cur]))[0]!;
    },

    listForStudent: (studentId: string) => visibleTo([studentId]),

    /** A parent sees what any of their children sees, once each. */
    async listForGuardian(guardianId: string): Promise<NoticeView[]> {
      const kids = await db.select({ id: studentGuardian.studentId }).from(studentGuardian).where(eq(studentGuardian.guardianId, guardianId));
      return visibleTo(kids.map((k) => k.id));
    },

    /** Staff see the live notices aimed at a role they hold, in their branches. `all` targets reach students and parents only. */
    async listForStaff(userId: string): Promise<NoticeView[]> {
      const at = now();
      const mine = await db.select({ roleId: staffRoleAssignment.roleId, branchId: staffRoleAssignment.branchId }).from(staffRoleAssignment).where(eq(staffRoleAssignment.userId, userId));
      if (mine.length === 0) return [];
      const allBranches = mine.some((m) => m.branchId === null);
      const live = await db
        .select()
        .from(notice)
        .where(and(lte(notice.publishedAt, at), or(isNull(notice.expiresAt), gt(notice.expiresAt, at))))
        .orderBy(desc(notice.publishedAt), desc(notice.id));
      const views = await withTargets(live);
      return views.filter((n) => {
        if (n.branchId && !allBranches && !mine.some((m) => m.branchId === n.branchId)) return false;
        return n.targets.some((t) => t.type === "role" && mine.some((m) => m.roleId === t.id && (m.branchId === null || !n.branchId || m.branchId === n.branchId)));
      });
    },
  };
}

export type NoticeService = ReturnType<typeof createNoticeService>;
