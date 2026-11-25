import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  authSession,
  contentBranch,
  contentItem,
  course,
  courseLecturer,
  exam,
  examCourse,
  guardian,
  lecturer,
  organization,
  permission,
  question,
  role,
  rolePermission,
  staffRoleAssignment,
  student,
  studentBranch,
  studentGuardian,
  user,
  type MODULES,
} from "@workspace/db/schema";
import type { STARTER_PERMISSIONS } from "@workspace/db/seed";
import { writeAudit } from "./audit";
import { ServiceError } from "./errors";
import { normalizeSriLankaPhone } from "./notifications";
import { type Db, type Tx } from "./types";

type Q = Db | Tx;
export type ModuleName = (typeof MODULES)[number];
/** The built-in permission codes. Roles and permissions are data, so a custom code is also a plain string. */
export type PermissionCode = (typeof STARTER_PERMISSIONS)[number] | (string & {});

// ---- modules (K)

export function moduleEnabled(enabledModules: unknown, name: ModuleName): boolean {
  return ((enabledModules ?? {}) as Record<string, boolean | undefined>)[name] === true;
}

/** K: the one server-side guard for a switched module. Call it in every action of the module. */
export async function requireModule(q: Q, name: ModuleName): Promise<void> {
  const [org] = await q.select({ m: organization.enabledModules }).from(organization);
  if (!moduleEnabled(org?.m, name)) throw new ServiceError("module_disabled", `The ${name.replace("_", " ")} module is not switched on.`);
}

export async function isModuleOn(q: Q, name: ModuleName): Promise<boolean> {
  const [org] = await q.select({ m: organization.enabledModules }).from(organization);
  return moduleEnabled(org?.m, name);
}

/**
 * K: wraps a service so every method first checks the module switch and throws `module_disabled` when it is off. Non-function members
 * (such as payment `hooks`) pass through, so money already taken still settles. `jobs` maps a method name to the value it returns when the
 * module is off: scheduled jobs skip quietly instead of failing.
 */
export function gateModule<T extends object>(db: Db, name: ModuleName, service: T, jobs: Partial<Record<keyof T, unknown>> = {}): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(service)) {
    if (typeof value !== "function") {
      out[key] = value;
      continue;
    }
    out[key] = async (...args: unknown[]) => {
      if (key in jobs && !(await isModuleOn(db, name))) return typeof jobs[key as keyof T] === "function" ? (jobs[key as keyof T] as () => unknown)() : jobs[key as keyof T];
      await requireModule(db, name);
      return (value as (...a: unknown[]) => unknown).apply(service, args);
    };
  }
  return out as T;
}

// ---- permissions (A5, A6, I2)

const LECTURER_ROLE = "lecturer";

async function isActive(q: Q, userId: string): Promise<boolean> {
  const [u] = await q.select({ status: user.status }).from(user).where(eq(user.id, userId));
  return u?.status === "active";
}

/** Role assignments of a user that carry a permission. `includeLecturer` is only ever true inside an ownership check (A5). */
async function assignmentsWith(q: Q, userId: string, code: string, includeLecturer: boolean) {
  return q
    .select({ branchId: staffRoleAssignment.branchId, roleName: role.name })
    .from(staffRoleAssignment)
    .innerJoin(role, eq(role.id, staffRoleAssignment.roleId))
    .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .innerJoin(permission, eq(permission.id, rolePermission.permissionId))
    .where(and(eq(staffRoleAssignment.userId, userId), eq(permission.code, code), includeLecturer ? undefined : ne(role.name, LECTURER_ROLE)));
}

/**
 * A6: does the user hold the permission? An inactive user never does. With a `branchId`, an assignment for that branch or for all branches
 * (null) counts. Without one (an organization-wide action such as managing roles) only an all-branches assignment counts, so branch staff
 * cannot act outside their branches. The built-in `lecturer` role never grants anything here: it is ownership-scoped (A5), see `authorizeResource`.
 */
export async function authorize(q: Q, userId: string, code: PermissionCode, scope: { branchId?: string | null } = {}): Promise<boolean> {
  if (!(await isActive(q, userId))) return false;
  const rows = await assignmentsWith(q, userId, code, false);
  // Stored ids are lower case; an upper-case or braced spelling of the same branch is the same branch.
  const wanted = scope.branchId != null ? canonicalUuid(scope.branchId) : null;
  return rows.some((r) => r.branchId === null || (wanted !== null && r.branchId === wanted));
}

export async function requirePermission(q: Q, userId: string, code: PermissionCode, scope: { branchId?: string | null } = {}): Promise<void> {
  if (!(await authorize(q, userId, code, scope))) throw new ServiceError("forbidden", `You do not have the ${code} permission.`);
}

/** Like `authorize`, but true when the user holds the permission in at least one branch (for example to show a menu). */
export async function authorizeAnywhere(q: Q, userId: string, code: PermissionCode): Promise<boolean> {
  if (!(await isActive(q, userId))) return false;
  return (await assignmentsWith(q, userId, code, false)).length > 0;
}

/** Branch ids the user may use the permission in: `"all"` for an all-branches assignment, else the list (possibly empty). I2 reads use this. */
export async function branchScope(q: Q, userId: string, code: PermissionCode): Promise<"all" | string[]> {
  if (!(await isActive(q, userId))) return [];
  const rows = await assignmentsWith(q, userId, code, false);
  if (rows.some((r) => r.branchId === null)) return "all";
  return [...new Set(rows.flatMap((r) => (r.branchId ? [r.branchId] : [])))].sort();
}

/**
 * Whether the actor holds `guardians.manage` in all branches, or in a branch of one of the guardian's children. A guardian with no student in
 * a branch can only be managed by an all-branches holder. Every guardian action (edit, phone change, password reset) uses this one rule.
 */
export async function guardianInScope(q: Q, actor: string, guardianId: string): Promise<boolean> {
  const scope = await branchScope(q, actor, "guardians.manage");
  if (scope === "all") return true;
  if (scope.length === 0) return false;
  const [hit] = await q
    .select({ b: studentBranch.branchId })
    .from(studentGuardian)
    .innerJoin(studentBranch, eq(studentBranch.studentId, studentGuardian.studentId))
    .where(and(eq(studentGuardian.guardianId, guardianId), inArray(studentBranch.branchId, scope)))
    .limit(1);
  return !!hit;
}

/** The canonical spelling (lower-case, hyphenated) of any form PostgreSQL accepts for a uuid; anything else is returned unchanged. */
export function canonicalUuid(value: string): string {
  const h = value.replace(/[{}-]/g, "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(h) ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : value;
}

export async function isRootAdmin(q: Q, userId: string): Promise<boolean> {
  if (!(await isActive(q, userId))) return false;
  const rows = await q
    .select({ id: staffRoleAssignment.id })
    .from(staffRoleAssignment)
    .innerJoin(role, eq(role.id, staffRoleAssignment.roleId))
    .where(and(eq(staffRoleAssignment.userId, userId), eq(role.name, "root_admin"), isNull(staffRoleAssignment.branchId)));
  return rows.length > 0;
}

// ---- ownership (A5)

export type Resource =
  | { type: "course"; id: string }
  | { type: "content"; id: string }
  | { type: "exam"; id: string }
  | { type: "question"; id: string };

/** The lecturer row a user may act as: portal on, user active, lecturer_portal module on (A3, A4, K). */
export async function activeLecturerOf(q: Q, userId: string): Promise<{ id: string } | null> {
  if (!(await isActive(q, userId)) || !(await isModuleOn(q, "lecturer_portal"))) return null;
  const [l] = await q.select({ id: lecturer.id, on: lecturer.portalEnabled }).from(lecturer).where(eq(lecturer.userId, userId));
  return l?.on ? { id: l.id } : null;
}

async function resourceFacts(q: Q, r: Resource): Promise<{ branchIds: string[]; lecturerIds: string[] }> {
  if (r.type === "course") {
    const [c] = await q.select({ branchId: course.branchId }).from(course).where(eq(course.id, r.id));
    if (!c) throw new ServiceError("not_found", "Course not found.");
    const lecs = await q.select({ id: courseLecturer.lecturerId }).from(courseLecturer).where(eq(courseLecturer.courseId, r.id));
    return { branchIds: [c.branchId], lecturerIds: lecs.map((l) => l.id) };
  }
  if (r.type === "content") {
    const [c] = await q.select({ lecturerId: contentItem.lecturerId }).from(contentItem).where(eq(contentItem.id, r.id));
    if (!c) throw new ServiceError("not_found", "Content not found.");
    const bs = await q.select({ id: contentBranch.branchId }).from(contentBranch).where(eq(contentBranch.contentId, r.id));
    return { branchIds: bs.map((b) => b.id), lecturerIds: [c.lecturerId] };
  }
  if (r.type === "exam") {
    const [e] = await q.select({ lecturerId: exam.lecturerId }).from(exam).where(eq(exam.id, r.id));
    if (!e) throw new ServiceError("not_found", "Exam not found.");
    const bs = await q.select({ id: course.branchId }).from(examCourse).innerJoin(course, eq(course.id, examCourse.courseId)).where(eq(examCourse.examId, r.id));
    return { branchIds: [...new Set(bs.map((b) => b.id))], lecturerIds: [e.lecturerId] };
  }
  const [qu] = await q.select({ lecturerId: question.lecturerId }).from(question).where(eq(question.id, r.id));
  if (!qu) throw new ServiceError("not_found", "Question not found.");
  return { branchIds: [], lecturerIds: [qu.lecturerId] };
}

/**
 * A5, I2: may this user use the permission on this course, content item, exam or question? Yes for staff whose assignment covers the
 * resource's branch (any of its branches; a question has none, so it needs an all-branches assignment). Yes for the lecturer who owns it
 * (teaches the course, created the content, exam or question) when the user has the `lecturer` role with the permission and their lecturer
 * portal is on. No one else.
 */
export async function authorizeResource(q: Q, userId: string, code: PermissionCode, resource: Resource): Promise<boolean> {
  if (!(await isActive(q, userId))) return false;
  const facts = await resourceFacts(q, resource);
  const staff = await assignmentsWith(q, userId, code, false);
  // A question belongs to the lecturer who created it. Besides that lecturer, only a root administrator may change it.
  if (resource.type === "question") {
    if (staff.some((a) => a.roleName === "root_admin" && a.branchId === null)) return true;
  } else if (staff.some((a) => a.branchId === null || facts.branchIds.includes(a.branchId))) return true;
  const lec = await activeLecturerOf(q, userId);
  if (!lec || !facts.lecturerIds.includes(lec.id)) return false;
  return (await assignmentsWith(q, userId, code, true)).some((a) => a.roleName === LECTURER_ROLE);
}

export async function requireResource(q: Q, userId: string, code: PermissionCode, resource: Resource): Promise<void> {
  if (!(await authorizeResource(q, userId, code, resource))) throw new ServiceError("forbidden", `You may not do this (${code}).`);
}

/**
 * Which branches' results of an exam the user may see or change with `code`: "all" for all-branches staff and for the lecturer who owns the
 * exam (with the lecturer role's permission and an open portal); otherwise the branches of the user's staff assignments, which the caller
 * applies to each result's recorded course. An exam shared by branches A and B passes `requireResource` for a manager of A alone, so the
 * per-result scope is what keeps B's students out. Empty when the user has no standing on the exam at all.
 */
export async function examResultScope(q: Q, userId: string, code: PermissionCode, examId: string): Promise<"all" | string[]> {
  if (!(await isActive(q, userId))) return [];
  const facts = await resourceFacts(q, { type: "exam", id: examId });
  const staff = await assignmentsWith(q, userId, code, false);
  if (staff.some((a) => a.branchId === null)) return "all";
  const lec = await activeLecturerOf(q, userId);
  if (lec && facts.lecturerIds.includes(lec.id) && (await assignmentsWith(q, userId, code, true)).some((a) => a.roleName === LECTURER_ROLE)) return "all";
  return [...new Set(staff.flatMap((a) => (a.branchId && facts.branchIds.includes(a.branchId) ? [a.branchId] : [])))].sort();
}

/**
 * For a change that reaches every place a content item is listed (price, archive): staff need the permission in all-branches, or in EVERY
 * branch the item is currently listed in (an item listed nowhere needs an all-branches assignment). A manager of only one of two listing
 * branches would otherwise change the other branch's storefront. The owning lecturer, with the lecturer role's permission and an open portal,
 * still passes, as in `authorizeResource`.
 */
export async function requireContentWide(q: Q, userId: string, code: PermissionCode, contentId: string): Promise<void> {
  if (!(await isActive(q, userId))) throw new ServiceError("forbidden", `You may not do this (${code}).`);
  const facts = await resourceFacts(q, { type: "content", id: contentId });
  const staff = await assignmentsWith(q, userId, code, false);
  if (staff.some((a) => a.branchId === null)) return;
  if (facts.branchIds.length > 0 && facts.branchIds.every((b) => staff.some((a) => a.branchId === b))) return;
  const lec = await activeLecturerOf(q, userId);
  if (lec && facts.lecturerIds.includes(lec.id) && (await assignmentsWith(q, userId, code, true)).some((a) => a.roleName === LECTURER_ROLE)) return;
  throw new ServiceError("forbidden", `You may not do this (${code}): the item is listed in branches you do not manage.`);
}

/** A lecturer acting in their own portal: the portal must be open and the `lecturer` role must (still) carry the permission. Revoking the role closes this even while the portal flag stays on. */
export async function requireLecturerPermission(q: Q, userId: string, code: PermissionCode): Promise<void> {
  const lec = await activeLecturerOf(q, userId);
  if (!lec || !(await assignmentsWith(q, userId, code, true)).some((a) => a.roleName === LECTURER_ROLE)) throw new ServiceError("forbidden", `You may not do this (${code}).`);
}

/**
 * I2: may this staff user use the permission on this student? An all-branches assignment, or an assignment for any branch the student
 * belongs to. A student who is in no branch yet can only be reached by an all-branches assignment.
 */
export async function authorizeStudent(q: Q, userId: string, code: PermissionCode, studentId: string): Promise<boolean> {
  const scope = await branchScope(q, userId, code);
  if (scope === "all") return true;
  if (scope.length === 0) return false;
  const [hit] = await q.select({ b: studentBranch.branchId }).from(studentBranch).where(and(eq(studentBranch.studentId, studentId), inArray(studentBranch.branchId, scope))).limit(1);
  return !!hit;
}

export async function requireStudent(q: Q, userId: string, code: PermissionCode, studentId: string): Promise<void> {
  const [s] = await q.select({ id: student.id }).from(student).where(eq(student.id, studentId));
  if (!s) throw new ServiceError("not_found", "Student not found.");
  if (!(await authorizeStudent(q, userId, code, studentId))) throw new ServiceError("forbidden", `You may not do this (${code}).`);
}

// ---- who is this user (A1, A3)

export interface Identity {
  userId: string;
  active: boolean;
  staffAssignments: { role: string; branchId: string | null }[];
  lecturerId: string | null;
  studentId: string | null;
  guardianId: string | null;
  /** True while the user has no password yet (a parent's first login): sign-in must go straight to the set-password form. */
  needsPasswordSetup: boolean;
  /** Which portals this user may enter right now. Login itself needs `active`. */
  portals: { admin: boolean; lecturer: boolean; student: boolean; parent: boolean };
}

/**
 * A1, A3: a user can be staff, lecturer, student and guardian at once. A portal is open when its flag or link is set:
 * admin needs a staff role other than `lecturer`; lecturer needs `portal_enabled` and the lecturer_portal module; student needs a linked,
 * active student; parent needs `guardian.portal_enabled` and the parent_portal module. A disabled user has no portal.
 */
export async function resolveIdentity(q: Q, userId: string): Promise<Identity | null> {
  const [u] = await q.select({ status: user.status, hash: user.passwordHash }).from(user).where(eq(user.id, userId));
  if (!u) return null;
  const active = u.status === "active";
  const assignments = await q
    .select({ role: role.name, branchId: staffRoleAssignment.branchId })
    .from(staffRoleAssignment)
    .innerJoin(role, eq(role.id, staffRoleAssignment.roleId))
    .where(eq(staffRoleAssignment.userId, userId))
    .orderBy(asc(role.name), asc(staffRoleAssignment.id));
  const [lec] = await q.select({ id: lecturer.id, on: lecturer.portalEnabled }).from(lecturer).where(eq(lecturer.userId, userId));
  const [stu] = await q.select({ id: student.id, status: student.status }).from(student).where(eq(student.userId, userId));
  const [gua] = await q.select({ id: guardian.id, on: guardian.portalEnabled }).from(guardian).where(eq(guardian.userId, userId));
  const lecturerPortal = !!lec?.on && (await isModuleOn(q, "lecturer_portal"));
  const parentPortal = !!gua?.on && (await isModuleOn(q, "parent_portal"));
  return {
    userId,
    active,
    needsPasswordSetup: u.hash === null,
    staffAssignments: assignments,
    lecturerId: lec?.id ?? null,
    studentId: stu?.id ?? null,
    guardianId: gua?.id ?? null,
    portals: {
      admin: active && assignments.some((a) => a.role !== LECTURER_ROLE),
      lecturer: active && lecturerPortal,
      student: active && !!stu && stu.status === "active",
      parent: active && parentPortal,
    },
  };
}

/**
 * May this user see this student's record? The student themselves, a guardian with portal access (parent_portal on) linked to the student,
 * or staff holding `students.read` in one of the student's branches (all-branches assignments cover everyone).
 */
export async function canAccessStudent(q: Q, userId: string, studentId: string): Promise<boolean> {
  const id = await resolveIdentity(q, userId);
  if (!id?.active) return false;
  if (id.portals.student && id.studentId === studentId) return true;
  if (id.portals.parent && id.guardianId) {
    const [link] = await q.select({ id: studentGuardian.studentId }).from(studentGuardian).where(and(eq(studentGuardian.studentId, studentId), eq(studentGuardian.guardianId, id.guardianId)));
    if (link) return true;
  }
  const scope = await branchScope(q, userId, "students.read");
  if (scope === "all") return true;
  if (scope.length === 0) return false;
  const [hit] = await q.select({ b: studentBranch.branchId }).from(studentBranch).where(and(eq(studentBranch.studentId, studentId), inArray(studentBranch.branchId, scope))).limit(1);
  return !!hit;
}

// ---- role management (A4, A7, J3, K)

/**
 * The body of `setInitialPassword`, for callers that must commit more in the same transaction (the auth package also ends the other
 * sessions there). Locks the user row, so it serializes with sign-in and other credential changes.
 */
export async function setInitialPasswordIn(tx: Tx, input: { userId: string; passwordHash: string }) {
  const [u] = await tx.select().from(user).where(eq(user.id, input.userId)).for("update");
  if (!u) throw new ServiceError("not_found", "User not found.");
  if (u.status !== "active" || u.passwordHash !== null) throw new ServiceError("forbidden", "A password is already set.");
  // The same exclusion as findFirstLoginUser (A1), repeated after the row lock: a phone-only session opened before staff roles were assigned or a
  // lecturer record was linked still carries the set_password restriction, and must not store a password on the now-privileged account.
  const [staff] = await tx.select({ id: staffRoleAssignment.id }).from(staffRoleAssignment).where(eq(staffRoleAssignment.userId, u.id)).limit(1);
  const [lec] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.userId, u.id)).limit(1);
  if (staff || lec) throw new ServiceError("forbidden", "This account cannot set a password with a phone number alone.");
  await tx.update(user).set({ passwordHash: input.passwordHash }).where(eq(user.id, u.id));
  await writeAudit(tx, { actor: u.id, action: "user.password_set", entityType: "user", entityId: u.id });
}

export function createAccessControlService(db: Db) {
  async function rootAdmins(tx: Tx, exceptUser?: string) {
    return tx
      .select({ userId: staffRoleAssignment.userId })
      .from(staffRoleAssignment)
      .innerJoin(role, eq(role.id, staffRoleAssignment.roleId))
      .innerJoin(user, eq(user.id, staffRoleAssignment.userId))
      .where(and(eq(role.name, "root_admin"), isNull(staffRoleAssignment.branchId), eq(user.status, "active"), exceptUser ? ne(user.id, exceptUser) : undefined));
  }

  return {
    /**
     * Gives a user a role, for one branch or all branches (`branchId` null). The `lecturer` role needs a lecturer row for the user and the
     * lecturer_portal module (K). `root_admin` is always all-branches. Giving the same role twice is a no-op. Audited (J3).
     */
    async assignRole(input: { userId: string; roleName: string; branchId?: string | null; actor: string }) {
      return db.transaction(async (tx) => {
        const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.id, input.userId));
        if (!u) throw new ServiceError("not_found", "User not found.");
        const [r] = await tx.select().from(role).where(eq(role.name, input.roleName));
        if (!r) throw new ServiceError("not_found", "Role not found.");
        const branchId = input.branchId ?? null;
        if (r.name === "root_admin" && branchId) throw new ServiceError("invalid_input", "root_admin applies to all branches.");
        if (r.name === LECTURER_ROLE) {
          await requireModule(tx, "lecturer_portal");
          const [l] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.userId, input.userId));
          if (!l) throw new ServiceError("invalid_input", "The user has no lecturer record.");
        }
        const [existing] = await tx
          .select({ id: staffRoleAssignment.id })
          .from(staffRoleAssignment)
          .where(and(eq(staffRoleAssignment.userId, input.userId), eq(staffRoleAssignment.roleId, r.id), branchId ? eq(staffRoleAssignment.branchId, branchId) : isNull(staffRoleAssignment.branchId)));
        if (existing) return { id: existing.id, created: false };
        const [row] = await tx.insert(staffRoleAssignment).values({ userId: input.userId, roleId: r.id, branchId }).returning({ id: staffRoleAssignment.id });
        await writeAudit(tx, { actor: input.actor, action: "role.assign", entityType: "user", entityId: input.userId, after: { role: r.name, branchId } });
        return { id: row!.id, created: true };
      });
    },

    /** Takes a role away. The last active all-branches `root_admin` cannot be removed (A7). Audited (J3). */
    async revokeRole(input: { userId: string; roleName: string; branchId?: string | null; actor: string }) {
      return db.transaction(async (tx) => {
        const [r] = await tx.select().from(role).where(eq(role.name, input.roleName));
        if (!r) throw new ServiceError("not_found", "Role not found.");
        const branchId = input.branchId ?? null;
        if (r.name === "root_admin") {
          await tx.select({ id: staffRoleAssignment.id }).from(staffRoleAssignment).where(eq(staffRoleAssignment.roleId, r.id)).orderBy(asc(staffRoleAssignment.id)).for("update");
          if ((await rootAdmins(tx, input.userId)).length === 0) throw new ServiceError("last_root_admin", "The last root administrator cannot be removed.");
        }
        const rows = await tx
          .delete(staffRoleAssignment)
          .where(and(eq(staffRoleAssignment.userId, input.userId), eq(staffRoleAssignment.roleId, r.id), branchId ? eq(staffRoleAssignment.branchId, branchId) : isNull(staffRoleAssignment.branchId)))
          .returning({ id: staffRoleAssignment.id });
        if (rows.length === 0) return false;
        await writeAudit(tx, { actor: input.actor, action: "role.revoke", entityType: "user", entityId: input.userId, before: { role: r.name, branchId } });
        return true;
      });
    },

    /** Disables or re-enables a user (a disabled user cannot sign in and holds no permissions). The last active root administrator cannot be disabled (A7). Audited (J3). */
    async setUserStatus(input: { userId: string; status: "active" | "disabled"; actor: string; reason?: string }) {
      return db.transaction(async (tx) => {
        const [u] = await tx.select().from(user).where(eq(user.id, input.userId)).for("update");
        if (!u) throw new ServiceError("not_found", "User not found.");
        if (u.status === input.status) return u;
        if (input.status === "disabled") {
          const [r] = await tx.select({ id: role.id }).from(role).where(eq(role.name, "root_admin"));
          if (r) {
            await tx.select({ id: staffRoleAssignment.id }).from(staffRoleAssignment).where(eq(staffRoleAssignment.roleId, r.id)).orderBy(asc(staffRoleAssignment.id)).for("update");
            const mine = await tx.select({ id: staffRoleAssignment.id }).from(staffRoleAssignment).where(and(eq(staffRoleAssignment.userId, u.id), eq(staffRoleAssignment.roleId, r.id), isNull(staffRoleAssignment.branchId)));
            if (mine.length > 0 && (await rootAdmins(tx, u.id)).length === 0) throw new ServiceError("last_root_admin", "The last root administrator cannot be disabled.");
          }
        }
        const [row] = await tx.update(user).set({ status: input.status }).where(eq(user.id, u.id)).returning();
        // Disabling ends every session for good: re-enabling the account must need a new sign-in, never revive an old token.
        if (input.status === "disabled") await tx.delete(authSession).where(eq(authSession.userId, u.id));
        await writeAudit(tx, { actor: input.actor, action: input.status === "disabled" ? "user.disable" : "user.enable", entityType: "user", entityId: u.id, before: { status: u.status }, after: { status: input.status }, reason: input.reason });
        return row!;
      });
    },

    /**
     * A3, A4, K: switches a lecturer's portal on or off. On needs the lecturer_portal module and a linked user, and gives that user the
     * `lecturer` role. Off removes login rights and the `lecturer` role only; the lecturer row, courses, commissions and history stay. Audited (J3).
     */
    async setLecturerPortal(input: { lecturerId: string; enabled: boolean; actor: string }) {
      return db.transaction(async (tx) => {
        const [l] = await tx.select().from(lecturer).where(eq(lecturer.id, input.lecturerId)).for("update");
        if (!l) throw new ServiceError("not_found", "Lecturer not found.");
        const [r] = await tx.select({ id: role.id }).from(role).where(eq(role.name, LECTURER_ROLE));
        if (input.enabled) {
          await requireModule(tx, "lecturer_portal");
          if (!l.userId) throw new ServiceError("invalid_input", "Link a user to the lecturer first.");
          if (l.portalEnabled) return l;
          const [row] = await tx.update(lecturer).set({ portalEnabled: true }).where(eq(lecturer.id, l.id)).returning();
          if (r) await tx.insert(staffRoleAssignment).values({ userId: l.userId, roleId: r.id, branchId: null }).onConflictDoNothing();
          await writeAudit(tx, { actor: input.actor, action: "lecturer.portal_on", entityType: "lecturer", entityId: l.id, after: { portalEnabled: true } });
          return row!;
        }
        if (!l.portalEnabled) return l;
        const [row] = await tx.update(lecturer).set({ portalEnabled: false }).where(eq(lecturer.id, l.id)).returning();
        if (r && l.userId) await tx.delete(staffRoleAssignment).where(and(eq(staffRoleAssignment.userId, l.userId), eq(staffRoleAssignment.roleId, r.id)));
        await writeAudit(tx, { actor: input.actor, action: "lecturer.portal_off", entityType: "lecturer", entityId: l.id, before: { portalEnabled: true }, after: { portalEnabled: false } });
        return row!;
      });
    },

    /**
     * A parent's first sign-in: the phone number alone is enough, and only while the account has no password. Returns the user to sign in,
     * or null (the same answer for every failure, so nothing is revealed). Needs an active user with a guardian record whose portal is on and
     * the parent_portal module on. After this the sign-in goes to the set-password form (`needsPasswordSetup`).
     */
    async findFirstLoginUser(input: { phone: string }) {
      const phone = normalizeSriLankaPhone(input.phone);
      if (!phone || !(await isModuleOn(db, "parent_portal"))) return null;
      const rows = await db
        .select({ userId: user.id })
        .from(user)
        .innerJoin(guardian, eq(guardian.userId, user.id))
        .where(and(eq(user.phone, phone), eq(user.status, "active"), isNull(user.passwordHash), eq(guardian.portalEnabled, true)))
        .limit(5);
      // Never for staff or lecturers (A1): their accounts must not be enterable with a phone number alone.
      for (const r of rows) {
        const id = await resolveIdentity(db, r.userId);
        if (id && id.staffAssignments.length === 0 && !id.lecturerId) return { userId: r.userId };
      }
      return null;
    },

    /** Saves the first password (already hashed by the auth layer). Only works while there is none; later changes go through the auth package. Audited (J3). */
    async setInitialPassword(input: { userId: string; passwordHash: string }) {
      return db.transaction((tx) => setInitialPasswordIn(tx, input));
    },

    async listAssignments(input: { userId: string }) {
      return db
        .select({ role: role.name, branchId: staffRoleAssignment.branchId })
        .from(staffRoleAssignment)
        .innerJoin(role, eq(role.id, staffRoleAssignment.roleId))
        .where(eq(staffRoleAssignment.userId, input.userId))
        .orderBy(asc(role.name), asc(staffRoleAssignment.id));
    },
  };
}
export type AccessControlService = ReturnType<typeof createAccessControlService>;
