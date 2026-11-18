/** Notices: who may write them (branch scope), who sees them (audience, branch, time), audit. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createNoticeService } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

let clock = new Date("2026-11-16T10:00:00Z");
const notices = createNoticeService(db, { now: () => clock });
const acl = createAccessControlService(db);
let n = 0;
const newUser = () => id(`INSERT INTO "user" (email, status) VALUES ($1, 'active')`, [`n${++n}@example.com`]);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const root = await newUser();
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });
await q(`INSERT INTO role (name, description) VALUES ('notice_writer', 'custom')`);
await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'notice_writer' AND p.code = 'notices.manage'`);
const writer1 = await newUser();
await acl.assignRole({ userId: writer1, roleName: "notice_writer", branchId: b1, actor: root });

const subj = await id(`INSERT INTO subject (name) VALUES ('Maths')`);
const mkCourse = (b: string) => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'class','scheduled',false)`, [subj, b, `C${++n}`]);
const grade6 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal LIMIT 1`))[0]!.id);
const grade7 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal OFFSET 1 LIMIT 1`))[0]!.id);
const mkStudent = async (b: string, grade?: string) => {
  const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`N${++n}`, `S${n}`]);
  await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [s, b]);
  if (grade) await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1,$2,'2026-01-01')`, [s, grade]);
  return s;
};
const titles = (l: { title: string }[]) => l.map((x) => x.title).sort();

describe("writing notices", () => {
  test("a manager writes only in their own branch; an all-branches notice needs an all-branches role", async () => {
    await fails("forbidden", () => notices.create({ actor: writer1, branchId: b2, title: "x", body: "y" }));
    await fails("forbidden", () => notices.create({ actor: writer1, branchId: null, title: "x", body: "y" }));
    const nobody = await newUser();
    await fails("forbidden", () => notices.create({ actor: nobody, branchId: b1, title: "x", body: "y" }));
    const ok = await notices.create({ actor: writer1, branchId: b1, title: "Holiday", body: "Closed Monday" });
    eq(ok.targets, [{ type: "all", id: null }]);
    eq((await notices.create({ actor: root, branchId: null, title: "Org", body: "Hello" })).branchId, null);
    const audit = await q(`SELECT action FROM audit_log WHERE entity_id = $1`, [ok.id]);
    eq(audit.map((a) => a.action), ["notice.create"]);
  });

  test("input and targets are validated", async () => {
    await fails("invalid_input", () => notices.create({ actor: root, branchId: null, title: " ", body: "y" }));
    await fails("invalid_input", () => notices.create({ actor: root, branchId: null, title: "t", body: "" }));
    await fails("invalid_input", () => notices.create({ actor: root, branchId: null, title: "t", body: "b", expiresAt: new Date("2026-11-15T00:00:00Z") }));
    const c2 = await mkCourse(b2);
    await fails("invalid_input", () => notices.create({ actor: root, branchId: b1, title: "t", body: "b", targets: [{ type: "course", id: c2 }] }));
    const s2 = await mkStudent(b2);
    await fails("invalid_input", () => notices.create({ actor: root, branchId: b1, title: "t", body: "b", targets: [{ type: "student", id: s2 }] }));
    await fails("invalid_input", () => notices.create({ actor: root, branchId: null, title: "t", body: "b", targets: [{ type: "all" }, { type: "grade", id: grade6 }] }));
    await fails("invalid_input", () => notices.create({ actor: root, branchId: null, title: "t", body: "b", targets: [{ type: "grade", id: grade6 }, { type: "grade", id: grade6 }] }));
    await fails("invalid_input", () => notices.create({ actor: root, branchId: null, title: "t", body: "b", targets: [{ type: "grade", id: "00000000-0000-4000-8000-000000000000" }] }));
  });

  test("update and remove need the notice's branch and are audited; listManaged is scoped", async () => {
    const mine = await notices.create({ actor: root, branchId: b1, title: "Mine", body: "b" });
    const theirs = await notices.create({ actor: root, branchId: b2, title: "Theirs", body: "b" });
    await fails("forbidden", () => notices.update({ noticeId: theirs.id, actor: writer1, title: "Changed" }));
    await fails("forbidden", () => notices.remove({ noticeId: theirs.id, actor: writer1 }));
    await fails("forbidden", () => notices.get({ noticeId: theirs.id, actor: writer1 }));
    eq((await notices.update({ noticeId: mine.id, actor: writer1, title: "Mine 2" })).title, "Mine 2");
    await fails("invalid_input", () => notices.update({ noticeId: mine.id, actor: writer1, expiresAt: new Date("2020-01-01T00:00:00Z") }));
    const managed = await notices.listManaged({ actor: writer1 });
    eq(managed.every((x) => x.branchId === b1), true);
    eq(managed.some((x) => x.id === theirs.id), false);
    eq((await notices.listManaged({ actor: root })).some((x) => x.id === theirs.id), true);
    const stranger = await newUser();
    await fails("forbidden", () => notices.listManaged({ actor: stranger }));
    await notices.remove({ noticeId: mine.id, actor: writer1 });
    await fails("not_found", () => notices.get({ noticeId: mine.id, actor: root }));
    eq((await q(`SELECT count(*)::int AS c FROM notice_target WHERE notice_id = $1`, [mine.id]))[0]!.c, 0);
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at, id`, [mine.id])).map((a) => a.action), ["notice.create", "notice.update", "notice.remove"]);
  });
});

describe("who sees a notice", () => {
  test("branch, audience, schedule and expiry decide what a student and a parent see", async () => {
    await q(`DELETE FROM notice`);
    clock = new Date("2026-11-16T10:00:00Z");
    const course1 = await mkCourse(b1);
    const sA = await mkStudent(b1, grade6);
    const sB = await mkStudent(b1, grade7);
    const sC = await mkStudent(b2, grade6);
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1,$2)`, [course1, sA]);
    const mk = (title: string, extra: Partial<Parameters<typeof notices.create>[0]> = {}) => notices.create({ actor: root, branchId: null, title, body: "b", ...extra });
    await mk("everyone");
    await mk("b1 only", { branchId: b1 });
    await mk("b2 only", { branchId: b2 });
    await mk("grade6", { targets: [{ type: "grade", id: grade6 }] });
    await mk("course1", { branchId: b1, targets: [{ type: "course", id: course1 }] });
    await mk("just B", { targets: [{ type: "student", id: sB }] });
    await mk("scheduled", { publishAt: new Date("2026-11-17T00:00:00Z") });
    await mk("short", { expiresAt: new Date("2026-11-16T12:00:00Z") });
    const rid = String((await q(`SELECT id FROM role WHERE name = 'notice_writer'`))[0]!.id);
    await mk("staff only", { targets: [{ type: "role", id: rid }] });

    eq(titles(await notices.listForStudent(sA)), ["b1 only", "course1", "everyone", "grade6", "short"]);
    eq(titles(await notices.listForStudent(sB)), ["b1 only", "everyone", "just B", "short"]);
    eq(titles(await notices.listForStudent(sC)), ["b2 only", "everyone", "grade6", "short"]);

    clock = new Date("2026-11-16T13:00:00Z");
    eq(titles(await notices.listForStudent(sA)).includes("short"), false);
    clock = new Date("2026-11-17T01:00:00Z");
    eq(titles(await notices.listForStudent(sA)).includes("scheduled"), true);

    const g = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Parent', '0771234567')`);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true), ($3,$2,false)`, [sA, g, sB]);
    const seen = titles(await notices.listForGuardian(g));
    eq(seen.filter((t) => t === "everyone").length, 1);
    eq(seen.includes("just B") && seen.includes("course1"), true);
    const lonely = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Nobody', '0770000000')`);
    eq(await notices.listForGuardian(lonely), []);
  });

  test("a dropped enrolment and a finished grade stop the matching notices; staff see only role notices for their roles and branches", async () => {
    await q(`DELETE FROM notice`);
    clock = new Date("2026-11-20T10:00:00Z");
    const c = await mkCourse(b1);
    const s = await mkStudent(b1, grade6);
    const e = await id(`INSERT INTO enrollment (course_id, student_id) VALUES ($1,$2)`, [c, s]);
    await notices.create({ actor: root, branchId: b1, title: "course notice", body: "b", targets: [{ type: "course", id: c }] });
    await notices.create({ actor: root, branchId: null, title: "grade notice", body: "b", targets: [{ type: "grade", id: grade6 }] });
    eq(titles(await notices.listForStudent(s)), ["course notice", "grade notice"]);
    await q(`UPDATE enrollment SET status = 'dropped', end_reason = 'dropped' WHERE id = $1`, [e]);
    await q(`UPDATE student_level SET to_date = '2026-11-19' WHERE student_id = $1`, [s]);
    eq(await notices.listForStudent(s), []);

    const rid = String((await q(`SELECT id FROM role WHERE name = 'notice_writer'`))[0]!.id);
    await notices.create({ actor: root, branchId: b2, title: "kandy staff", body: "b", targets: [{ type: "role", id: rid }] });
    await notices.create({ actor: root, branchId: null, title: "all staff", body: "b", targets: [{ type: "role", id: rid }] });
    eq(titles(await notices.listForStaff(writer1)), ["all staff"]);
    const plain = await newUser();
    eq(await notices.listForStaff(plain), []);
  });
});
