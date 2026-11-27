/**
 * Authorization: permissions with branch scope (A6), lecturer ownership (A5), portals (A3, A4), last root admin (A7), audit (J3), module switches (K).
 */
import { afterAll, describe, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import {
  authorize,
  authorizeAnywhere,
  authorizeResource,
  authorizeStudent,
  requireStudent,
  branchScope,
  canAccessStudent,
  canonicalUuid,
  createAccessControlService,
  createContentService,
  createExamService,
  firstLoginStillValidIn,
  requireModule,
  requirePermission,
  resolveIdentity,
} from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { pg, db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

const setModules = (m: Record<string, boolean>) => q(`UPDATE organization SET timezone = 'UTC', enabled_modules = $1::jsonb`, [JSON.stringify(m)]);
await setModules({ lecturer_portal: true, parent_portal: true });
const acl = createAccessControlService(db);

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
let n = 0;
const newUser = (status = "active") => id(`INSERT INTO "user" (email, status) VALUES ($1, $2)`, [`u${++n}@example.com`, status]);
const root = await newUser();
const admin = await newUser();
const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const courseIn = (branchId: string) => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'class','scheduled',false)`, [subj, branchId, `C${++n}`]);
const newStudent = async (branches: string[]) => {
  const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`A${++n}`, `S${n}`]);
  for (const [i, b] of branches.entries()) await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,$3)`, [s, b, i === 0]);
  return s;
};
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });

describe("permissions and branch scope (A6)", () => {
  test("root admin has every permission in every branch; an unassigned user has none", async () => {
    eq(await authorize(db, root, "fees.manage", { branchId: b2 }), true);
    eq(await authorize(db, root, "roles.manage"), true);
    const nobody = await newUser();
    eq(await authorize(db, nobody, "students.read", { branchId: b1 }), false);
    await fails("forbidden", () => requirePermission(db, nobody, "students.read", { branchId: b1 }));
  });

  test("a branch assignment covers that branch only; no branch given means all-branches only", async () => {
    const u = await newUser();
    await acl.assignRole({ userId: u, roleName: "payment_handler", branchId: b1, actor: root });
    eq(await authorize(db, u, "payments.verify", { branchId: b1 }), true);
    eq(await authorize(db, u, "payments.verify", { branchId: b2 }), false);
    eq(await authorize(db, u, "payments.verify"), false);
    eq(await authorizeAnywhere(db, u, "payments.verify"), true);
    eq(await authorize(db, u, "fees.manage", { branchId: b1 }), false);
    eq(await branchScope(db, u, "payments.verify"), [b1]);
    await acl.assignRole({ userId: u, roleName: "payment_handler", actor: root });
    eq(await authorize(db, u, "payments.verify", { branchId: b2 }), true);
    eq(await branchScope(db, u, "payments.verify"), "all");
  });

  test("roles in different branches add up, and a disabled user holds nothing", async () => {
    const u = await newUser();
    await acl.assignRole({ userId: u, roleName: "payment_handler", branchId: b1, actor: root });
    await acl.assignRole({ userId: u, roleName: "attendance_marker", branchId: b2, actor: root });
    eq(await authorize(db, u, "attendance.mark", { branchId: b2 }), true);
    eq(await authorize(db, u, "attendance.mark", { branchId: b1 }), false);
    await acl.setUserStatus({ userId: u, status: "disabled", actor: root });
    eq(await authorize(db, u, "attendance.mark", { branchId: b2 }), false);
    eq(await authorizeAnywhere(db, u, "payments.verify"), false);
    eq(await branchScope(db, u, "payments.verify"), []);
    await acl.setUserStatus({ userId: u, status: "active", actor: root });
    eq(await authorize(db, u, "attendance.mark", { branchId: b2 }), true);
  });

  test("assigning is idempotent, audited, and revoking removes the permission", async () => {
    const u = await newUser();
    const first = await acl.assignRole({ userId: u, roleName: "student_counselor", branchId: b1, actor: admin });
    const again = await acl.assignRole({ userId: u, roleName: "student_counselor", branchId: b1, actor: admin });
    eq([first.created, again.created, first.id === again.id], [true, false, true]);
    eq(Number((await q(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'role.assign' AND entity_id = $1`, [u]))[0]!.c), 1);
    eq(await acl.revokeRole({ userId: u, roleName: "student_counselor", branchId: b1, actor: admin }), true);
    eq(await acl.revokeRole({ userId: u, roleName: "student_counselor", branchId: b1, actor: admin }), false);
    eq(await authorize(db, u, "students.read", { branchId: b1 }), false);
    eq(Number((await q(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'role.revoke' AND entity_id = $1`, [u]))[0]!.c), 1);
    await fails("not_found", () => acl.assignRole({ userId: u, roleName: "no_such_role", actor: admin }));
    await fails("invalid_input", () => acl.assignRole({ userId: u, roleName: "root_admin", branchId: b1, actor: admin }));
  });
});

describe("last root administrator (A7)", () => {
  test("cannot be revoked or disabled while it is the only one, and can once another exists", async () => {
    await fails("last_root_admin", () => acl.revokeRole({ userId: root, roleName: "root_admin", actor: root }));
    await fails("last_root_admin", () => acl.setUserStatus({ userId: root, status: "disabled", actor: root }));
    const second = await newUser();
    await acl.assignRole({ userId: second, roleName: "root_admin", actor: root });
    await acl.setUserStatus({ userId: second, status: "disabled", actor: root });
    // a disabled root admin does not count as another one
    await fails("last_root_admin", () => acl.revokeRole({ userId: root, roleName: "root_admin", actor: root }));
    await acl.setUserStatus({ userId: second, status: "active", actor: root });
    eq(await acl.revokeRole({ userId: root, roleName: "root_admin", actor: root }), true);
    await fails("last_root_admin", () => acl.revokeRole({ userId: second, roleName: "root_admin", actor: second }));
    await acl.assignRole({ userId: root, roleName: "root_admin", actor: second });
  });
});

const lecUser = await newUser();
const otherUser = await newUser();
const lecA = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Mr A', $1)`, [lecUser]);
const lecB = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Ms B', $1)`, [otherUser]);
const course = await courseIn(b1);
await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2)`, [course, lecA]);
const contentA = await id(`INSERT INTO content_item (lecturer_id, kind, title, external_url) VALUES ($1,'recording','T','https://youtu.be/x')`, [lecA]);
const contentB = await id(`INSERT INTO content_item (lecturer_id, kind, title, external_url) VALUES ($1,'recording','T','https://youtu.be/y')`, [lecB]);


describe("lecturer ownership (A5) and portal (A3, A4)", () => {
  test("portal on gives the lecturer role; the lecturer reaches only what they own", async () => {
    const noUser = await id(`INSERT INTO lecturer (full_name) VALUES ('No user')`);
    await fails("invalid_input", () => acl.setLecturerPortal({ lecturerId: noUser, enabled: true, actor: root }));
    await acl.setLecturerPortal({ lecturerId: lecA, enabled: true, actor: root });
    await acl.setLecturerPortal({ lecturerId: lecB, enabled: true, actor: root });
    eq(await authorizeResource(db, lecUser, "content.manage", { type: "content", id: contentA }), true);
    eq(await authorizeResource(db, lecUser, "content.manage", { type: "content", id: contentB }), false);
    eq(await authorizeResource(db, lecUser, "exams.manage", { type: "course", id: course }), true);
    eq(await authorizeResource(db, otherUser, "exams.manage", { type: "course", id: course }), false);
    eq(await authorizeResource(db, lecUser, "fees.manage", { type: "course", id: course }), false);
  });

  test("the lecturer role alone grants no branch-wide permission", async () => {
    eq(await authorize(db, lecUser, "students.read", { branchId: b1 }), false);
    eq(await authorizeAnywhere(db, lecUser, "content.manage"), false);
    eq(await canAccessStudent(db, lecUser, await newStudent([b1])), false);
  });

  test("staff in the branch reach the resource; staff in another branch do not", async () => {
    const mine = await newUser();
    const far = await newUser();
    await acl.assignRole({ userId: mine, roleName: "student_counselor", branchId: b1, actor: root });
    await acl.assignRole({ userId: far, roleName: "student_counselor", branchId: b2, actor: root });
    eq(await authorizeResource(db, mine, "content.handover", { type: "course", id: course }), true);
    eq(await authorizeResource(db, far, "content.handover", { type: "course", id: course }), false);
    await fails("not_found", () => authorizeResource(db, mine, "content.handover", { type: "course", id: "00000000-0000-0000-0000-000000000000" }));
  });

  test("portal off removes login rights and the role but keeps the lecturer and their courses (A4)", async () => {
    await acl.setLecturerPortal({ lecturerId: lecA, enabled: false, actor: root });
    eq(await authorizeResource(db, lecUser, "content.manage", { type: "content", id: contentA }), false);
    const identity = await resolveIdentity(db, lecUser);
    eq(identity!.portals.lecturer, false);
    eq(identity!.staffAssignments, []);
    eq(Number((await q(`SELECT count(*)::int AS c FROM course_lecturer WHERE lecturer_id = $1`, [lecA]))[0]!.c), 1);
    eq(Number((await q(`SELECT count(*)::int AS c FROM audit_log WHERE action IN ('lecturer.portal_on','lecturer.portal_off') AND entity_id = $1`, [lecA]))[0]!.c), 2);
    await acl.setLecturerPortal({ lecturerId: lecA, enabled: true, actor: root });
    eq(await authorizeResource(db, lecUser, "content.manage", { type: "content", id: contentA }), true);
  });

  test("the lecturer_portal module off closes the lecturer portal and ownership access (K)", async () => {
    await setModules({ parent_portal: true });
    eq(await authorizeResource(db, lecUser, "content.manage", { type: "content", id: contentA }), false);
    eq((await resolveIdentity(db, lecUser))!.portals.lecturer, false);
    await fails("module_disabled", () => acl.setLecturerPortal({ lecturerId: lecB, enabled: true, actor: root }));
    await setModules({ lecturer_portal: true, parent_portal: true });
  });
});

describe("one user, several roles (A1) and student access", () => {
  test("a user can be lecturer, guardian and staff at once, and each portal follows its own switch", async () => {
    const u = await newUser();
    const lec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Dual', $1)`, [u]);
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Dual Parent', '0771234567', $1, true)`, [u]);
    await acl.setLecturerPortal({ lecturerId: lec, enabled: true, actor: root });
    await acl.assignRole({ userId: u, roleName: "attendance_marker", branchId: b1, actor: root });
    let i = (await resolveIdentity(db, u))!;
    eq([i.portals.admin, i.portals.lecturer, i.portals.parent, i.portals.student], [true, true, true, false]);
    eq([i.lecturerId, i.guardianId], [lec, g]);
    await setModules({ lecturer_portal: true });
    i = (await resolveIdentity(db, u))!;
    eq(i.portals.parent, false);
    await setModules({ lecturer_portal: true, parent_portal: true });
    await acl.setUserStatus({ userId: u, status: "disabled", actor: root });
    i = (await resolveIdentity(db, u))!;
    eq([i.active, i.portals.admin, i.portals.lecturer, i.portals.parent], [false, false, false, false]);
    eq(await resolveIdentity(db, "00000000-0000-0000-0000-000000000000"), null);
  });

  test("a student sees themselves, a linked guardian sees the child, staff see their branch only", async () => {
    const su = await newUser();
    const stu = await newStudent([b1]);
    const sibling = await newStudent([b1]);
    await q(`UPDATE student SET user_id = $1 WHERE id = $2`, [su, stu]);
    eq(await canAccessStudent(db, su, stu), true);
    eq(await canAccessStudent(db, su, sibling), false);

    const gu = await newUser();
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Parent', '0779999999', $1, true)`, [gu]);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, relationship, is_primary) VALUES ($1,$2,'mother',true)`, [stu, g]);
    eq(await canAccessStudent(db, gu, stu), true);
    eq(await canAccessStudent(db, gu, sibling), false);
    await setModules({ lecturer_portal: true });
    eq(await canAccessStudent(db, gu, stu), false);
    await setModules({ lecturer_portal: true, parent_portal: true });

    const mine = await newUser();
    const far = await newUser();
    await acl.assignRole({ userId: mine, roleName: "student_counselor", branchId: b1, actor: root });
    await acl.assignRole({ userId: far, roleName: "student_counselor", branchId: b2, actor: root });
    const inB2 = await newStudent([b2]);
    eq([await canAccessStudent(db, mine, stu), await canAccessStudent(db, mine, inB2)], [true, false]);
    eq([await canAccessStudent(db, far, stu), await canAccessStudent(db, far, inB2)], [false, true]);
    eq(await canAccessStudent(db, root, inB2), true);
    await q(`UPDATE student SET status = 'suspended' WHERE id = $1`, [stu]);
    eq(await canAccessStudent(db, su, stu), false);
  });
});

describe("module switches (K)", () => {
  test("requireModule throws module_disabled when the flag is off or missing", async () => {
    await setModules({});
    await fails("module_disabled", () => requireModule(db, "online_exams"));
    await setModules({ online_exams: true });
    await requireModule(db, "online_exams");
    await setModules({ online_exams: false });
    await fails("module_disabled", () => requireModule(db, "online_exams"));
  });

  test("online_exams off: every exam action is refused and the jobs skip quietly", async () => {
    await setModules({});
    const ex = createExamService(db);
    await fails("module_disabled", () => ex.createQuestion({ actor: null } as never));
    await fails("module_disabled", () => ex.startAttempt({ examId: "x", studentId: "y" }));
    eq(await ex.finalizeExpiredAttempts(), 0);
    eq(await ex.runReleaseJob(), { closed: 0, released: 0, errors: [] });
  });

  test("content_store off: content actions are refused", async () => {
    await setModules({});
    const content = createContentService(db);
    await fails("module_disabled", () => content.purchase({ contentId: "x", studentId: "y" }));
    await fails("module_disabled", () => content.listForStudent({ studentId: "y" }));
    await fails("module_disabled", () => content.pendingHandovers());
  });
});

describe("questions belong to their lecturer; root admin can change them", () => {
  const opts = [{ body: "a", isCorrect: true }, { body: "b", isCorrect: false }];
  test("the owner and a root administrator may change a question; other lecturers and other staff may not", async () => {
    await setModules({ lecturer_portal: true, online_exams: true });
    const ex = createExamService(db);
    const ownerUser = await newUser();
    const otherUser = await newUser();
    const ownerLec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Owner', $1)`, [ownerUser]);
    const otherLec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Other', $1)`, [otherUser]);
    await acl.setLecturerPortal({ lecturerId: ownerLec, enabled: true, actor: root });
    await acl.setLecturerPortal({ lecturerId: otherLec, enabled: true, actor: root });
    const staff = await newUser();
    await q(`INSERT INTO role (name, description) VALUES ('exam_officer', 'custom')`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'exam_officer' AND p.code = 'exams.manage'`);
    await acl.assignRole({ userId: staff, roleName: "exam_officer", actor: root });
    eq(await authorize(db, staff, "exams.manage", { branchId: b1 }), true);

    const qn = await ex.createQuestion({ actor: ownerUser, lecturerId: ownerLec, body: "Q1", options: opts });
    await fails("forbidden", () => ex.createQuestion({ actor: otherUser, lecturerId: ownerLec, body: "Q2", options: opts }));
    await ex.createQuestion({ actor: root, lecturerId: ownerLec, body: "Q3", options: opts });

    await ex.updateQuestion({ actor: ownerUser, questionId: qn.id, body: "Q1 edited", options: opts });
    await ex.updateQuestion({ actor: root, questionId: qn.id, body: "Q1 by admin", options: opts });
    await fails("forbidden", () => ex.updateQuestion({ actor: otherUser, questionId: qn.id, body: "x", options: opts }));
    await fails("forbidden", () => ex.updateQuestion({ actor: staff, questionId: qn.id, body: "x", options: opts }));
    eq(String((await q(`SELECT body FROM question WHERE id = $1`, [qn.id]))[0]!.body), "Q1 by admin");
    await setModules({ lecturer_portal: true, parent_portal: true });
  });
});

describe("parent first login by phone, then set a password", () => {
  test("the phone number alone finds the account while it has no password; then the password is set once", async () => {
    const u = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94771110001', '94771110001')`);
    await q(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('First Login', '94771110001', $1, true)`, [u]);
    eq(await acl.findFirstLoginUser({ phone: "077 111 0001" }), { userId: u });
    eq(await acl.findFirstLoginUser({ phone: "0771110001" }), { userId: u });
    eq((await resolveIdentity(db, u))!.needsPasswordSetup, true);
    await acl.setInitialPassword({ userId: u, passwordHash: "hash-1" });
    eq((await resolveIdentity(db, u))!.needsPasswordSetup, false);
    eq(await acl.findFirstLoginUser({ phone: "0771110001" }), null);
    await fails("forbidden", () => acl.setInitialPassword({ userId: u, passwordHash: "hash-2" }));
    eq(String((await q(`SELECT password_hash FROM "user" WHERE id = $1`, [u]))[0]!.password_hash), "hash-1");
    eq(Number((await q(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_set' AND entity_id = $1`, [u]))[0]!.c), 1);
  });

  test("setInitialPassword refuses an account that became staff or a lecturer after the phone-only session opened", async () => {
    const mk = async (phone: string) => {
      const u = await id(`INSERT INTO "user" (username, phone) VALUES ('late-${phone}', '${phone}')`);
      await q(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Late', '${phone}', $1, true)`, [u]);
      return u;
    };
    const hash = async (u: string) => (await q(`SELECT password_hash FROM "user" WHERE id = $1`, [u]))[0]!.password_hash;
    const s = await mk("94771110091");
    await q(`INSERT INTO staff_role_assignment (user_id, role_id, branch_id) VALUES ($1, (SELECT id FROM role WHERE name = 'root_admin'), NULL)`, [s]);
    await fails("forbidden", () => acl.setInitialPassword({ userId: s, passwordHash: "x" }));
    eq(await hash(s), null, "staff: nothing stored");
    const l = await mk("94771110092");
    await q(`INSERT INTO lecturer (full_name, user_id) VALUES ('Late Lec', $1)`, [l]);
    await fails("forbidden", () => acl.setInitialPassword({ userId: l, passwordHash: "x" }));
    eq(await hash(l), null, "lecturer: nothing stored");
  });

  test("firstLoginStillValidIn reads the organisation's modules under FOR SHARE, before the user checks, and is false when parent_portal is off", async () => {
    const u = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94771110070', '94771110070')`);
    await q(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Locked', '94771110070', $1, true)`, [u]);
    const log: string[] = [];
    const logged = drizzle(pg, { schema, logger: { logQuery: (t: string) => void log.push(t) } }) as unknown as typeof db;
    eq(await logged.transaction((tx) => firstLoginStillValidIn(tx, u, "94771110070")), true, "module on");
    const orgRead = log.findIndex((t) => /from "organization"/.test(t));
    eq(orgRead === 0 && /for share/.test(log[orgRead]!), true, "the first statement reads the organisation row FOR SHARE");
    await setModules({ lecturer_portal: true });
    eq(await db.transaction((tx) => firstLoginStillValidIn(tx, u, "94771110070")), false, "module off");
    await setModules({ lecturer_portal: true, parent_portal: true });
  });

  test("nothing is found for a wrong number, a disabled user, a portal that is off, or the module off", async () => {
    eq(await acl.findFirstLoginUser({ phone: "0700000000" }), null);
    eq(await acl.findFirstLoginUser({ phone: "abc" }), null);
    const u = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94771110002', '94771110002')`);
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('P2', '94771110002', $1, true)`, [u]);
    eq((await acl.findFirstLoginUser({ phone: "0771110002" }))?.userId, u);
    await q(`UPDATE guardian SET portal_enabled = false WHERE id = $1`, [g]);
    eq(await acl.findFirstLoginUser({ phone: "0771110002" }), null);
    await q(`UPDATE guardian SET portal_enabled = true WHERE id = $1`, [g]);
    await setModules({ lecturer_portal: true });
    eq(await acl.findFirstLoginUser({ phone: "0771110002" }), null);
    await setModules({ lecturer_portal: true, parent_portal: true });
    await acl.setUserStatus({ userId: u, status: "disabled", actor: root });
    eq(await acl.findFirstLoginUser({ phone: "0771110002" }), null);
  });

  test("never for staff or lecturers, even when they are also a guardian without a password", async () => {
    const u = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94771110003', '94771110003')`);
    await q(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Staff Parent', '94771110003', $1, true)`, [u]);
    eq((await acl.findFirstLoginUser({ phone: "0771110003" }))?.userId, u);
    await acl.assignRole({ userId: u, roleName: "payment_handler", actor: root });
    eq(await acl.findFirstLoginUser({ phone: "0771110003" }), null);
    await acl.revokeRole({ userId: u, roleName: "payment_handler", actor: root });
    const lec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Lec Parent', $1)`, [u]);
    eq(await acl.findFirstLoginUser({ phone: "0771110003" }), null);
    eq(lec.length > 0, true);
  });
});

describe("staff access to one student (I2)", () => {
  test("an all-branches assignment, or one for a branch the student is in; a student with no branch needs all-branches", async () => {
    const inB1 = await newStudent([b1]);
    const inB2 = await newStudent([b2]);
    const nowhere = await newStudent([]);
    const mine = await newUser();
    const all = await newUser();
    await acl.assignRole({ userId: mine, roleName: "student_counselor", branchId: b1, actor: root });
    await acl.assignRole({ userId: all, roleName: "student_counselor", actor: root });
    eq([await authorizeStudent(db, mine, "students.update", inB1), await authorizeStudent(db, mine, "students.update", inB2), await authorizeStudent(db, mine, "students.update", nowhere)], [true, false, false]);
    eq([await authorizeStudent(db, all, "students.update", inB2), await authorizeStudent(db, all, "students.update", nowhere)], [true, true]);
    eq(await authorizeStudent(db, mine, "fees.manage", inB1), false);
    await requireStudent(db, mine, "students.update", inB1);
    await fails("forbidden", () => requireStudent(db, mine, "students.update", inB2));
    await fails("not_found", () => requireStudent(db, mine, "students.update", "00000000-0000-0000-0000-000000000000"));
  });
});

describe("canonicalUuid", () => {
  const id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  test("accepts the spellings PostgreSQL accepts and nothing else", () => {
    for (const ok of [id, id.toUpperCase(), id.replace(/-/g, ""), `{${id}}`, `{${id.toUpperCase()}}`, `{${id.replace(/-/g, "")}}`, "a0eebc99-9c0b4ef8-bb6d6bb9-bd380a11", "a0ee-bc99-9c0b-4ef8-bb6d-6bb9-bd38-0a11"]) {
      eq(canonicalUuid(ok), id, ok);
    }
    for (const bad of [`a0eebc99-9c0b-4ef8-bb6d-6bb9{bd380a11}`, `{a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`, `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11}`, `{{${id}}}`, `a0eebc99--9c0b-4ef8-bb6d-6bb9bd380a11`, `-${id}`, `${id}-`, "a0ee-bc9-99c0-b4ef-8bb6-d6bb-9bd3-80a11", `${id}0`, "not a uuid", ""]) {
      eq(canonicalUuid(bad), bad, `${bad} is left alone`);
    }
  });
});
