/** Notices: who may write them (branch scope), who sees them (audience, branch, time), audit. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createEnrollmentService, createNoticeService } from "../src";
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
  await q(`INSERT INTO student_branch (student_id, branch_id, is_primary, joined_on) VALUES ($1,$2,true,'2026-01-01')`, [s, b]);
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
    // upper-case spellings: the manager's own branch is allowed (and stored in one form), another branch is still refused
    const upper = await notices.create({ actor: writer1, branchId: b1.toUpperCase(), title: "Upper", body: "own branch" });
    eq(upper.branchId, b1);
    await fails("forbidden", () => notices.create({ actor: writer1, branchId: b2.toUpperCase(), title: "x", body: "y" }));
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
    await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2026-01-01')`, [course1, sA]);
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
    const e = await id(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2026-01-01')`, [c, s]);
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

// ---- review hardening

/** The same db, but `hook` runs just before the first transaction starts: a rival write landing between a read and a write. */
function withBefore(hook: () => Promise<void>): typeof db {
  let fired = false;
  return new Proxy(db, {
    get(t, prop) {
      const v = Reflect.get(t, prop, t);
      if (prop === "transaction") {
        return async (...args: unknown[]) => {
          if (!fired) {
            fired = true;
            await hook();
          }
          return (v as (...a: unknown[]) => unknown).apply(t, args);
        };
      }
      return typeof v === "function" ? v.bind(t) : v;
    },
  }) as typeof db;
}
const racing = (hook: () => Promise<void>) => createNoticeService(withBefore(hook), { now: () => clock });
const withClock = async (at: string, run: () => Promise<void>) => {
  const before = clock;
  clock = new Date(at);
  try {
    await run();
  } finally {
    clock = before;
  }
};
const triggerOn = async (table: string, event: "UPDATE" | "DELETE", name: string, run: () => Promise<void>) => {
  await q(`CREATE FUNCTION ${name}() RETURNS trigger AS $$ BEGIN RETURN NULL; END $$ LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER ${name} BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`);
  try {
    await run();
  } finally {
    await q(`DROP TRIGGER ${name} ON ${table}`);
    await q(`DROP FUNCTION ${name}()`);
  }
};

describe("notice views", () => {
  test("each notice gets its own targets, in the feed's order; none means an empty list", async () => {
    const c = await mkCourse(b1);
    const one = await notices.create({ actor: root, branchId: null, title: "View One", body: "b", targets: [{ type: "grade", id: grade6 }] });
    const two = await notices.create({ actor: root, branchId: null, title: "View Two", body: "b", targets: [{ type: "grade", id: grade7 }, { type: "course", id: c }] });
    const bare = await id(`INSERT INTO notice (author_id, title, body, published_at) VALUES ($1, 'View Bare', 'b', $2)`, [root, new Date(clock.getTime() + 1000)]);
    const feed = await notices.listManaged({ actor: root });
    const view = (title: string) => feed.find((x) => x.title === title)!;
    eq(view("View One").targets, [{ type: "grade", id: grade6 }]);
    eq(view("View Two").targets.map((t) => t.type).sort(), ["course", "grade"]);
    eq(view("View Bare").targets, [], "no targets, an empty list");
    const at = (nid: string) => feed.findIndex((x) => x.id === nid);
    eq(at(bare) < at(one.id) && at(bare) < at(two.id), true, "the later-published notice comes first");
  });
});

describe("notice edits under contention", () => {
  test("a title edit keeps a body that was saved after it read the notice", async () => {
    const note = await notices.create({ actor: root, branchId: null, title: "T0", body: "B0" });
    const rival = racing(async () => void (await notices.update({ noticeId: note.id, actor: root, body: "B1" })));
    const out = await rival.update({ noticeId: note.id, actor: root, title: "T1" });
    eq([out.title, out.body], ["T1", "B1"], "both edits survive");
    const audit = await q(`SELECT before_data->>'body' AS b FROM audit_log WHERE entity_id = $1 AND action = 'notice.update' ORDER BY created_at, id`, [note.id]);
    eq(audit.map((a) => a.b), ["B0", "B1"], "the second edit records the body it saw");
  });

  test("an update whose notice vanished is not_found, with no audit entry", async () => {
    const gone = await notices.create({ actor: root, branchId: null, title: "Gone", body: "b" });
    const rival = racing(async () => void (await notices.remove({ noticeId: gone.id, actor: root })));
    await fails("not_found", () => rival.update({ noticeId: gone.id, actor: root, title: "Late" }));
    const kept = await notices.create({ actor: root, branchId: null, title: "Kept", body: "b" });
    await triggerOn("notice", "UPDATE", "skip_notice_update", () => fails("not_found", () => notices.update({ noticeId: kept.id, actor: root, title: "Skipped" })));
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id = $1 AND action = 'notice.update'`, [kept.id]))[0]!.c, 0);
  });

  test("the removal audit records the deleted text, and a second removal finds nothing", async () => {
    const note = await notices.create({ actor: root, branchId: null, title: "R0", body: "B0" });
    const edit = racing(async () => void (await notices.update({ noticeId: note.id, actor: root, title: "R1", body: "B1" })));
    await edit.remove({ noticeId: note.id, actor: root });
    const [a] = await q(`SELECT before_data FROM audit_log WHERE entity_id = $1 AND action = 'notice.remove'`, [note.id]);
    const was = a!.before_data as { title: string; body: string };
    eq([was.title, was.body], ["R1", "B1"], "the text that was removed");

    const twice = await notices.create({ actor: root, branchId: null, title: "Twice", body: "b" });
    const rival = racing(async () => void (await notices.remove({ noticeId: twice.id, actor: root })));
    await fails("not_found", () => rival.remove({ noticeId: twice.id, actor: root }));
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id = $1 AND action = 'notice.remove'`, [twice.id]))[0]!.c, 1, "one removal audited");

    const kept = await notices.create({ actor: root, branchId: null, title: "Kept2", body: "b" });
    await triggerOn("notice", "DELETE", "skip_notice_delete", () => fails("not_found", () => notices.remove({ noticeId: kept.id, actor: root })));
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id = $1 AND action = 'notice.remove'`, [kept.id]))[0]!.c, 0, "nothing deleted, nothing audited");
  });
});

describe("who sees a notice on the day it takes effect", () => {
  test("a grade notice follows the grade in effect today, not the grade booked for later", async () => {
    const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`N${++n}`, `Grader`]);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [s, b1]);
    await q(`INSERT INTO student_level (student_id, grade_level_id, from_date, to_date) VALUES ($1,$2,'2026-01-01','2027-04-01')`, [s, grade6]);
    await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1,$2,'2027-04-01')`, [s, grade7]);
    await notices.create({ actor: root, branchId: null, title: "Old grade", body: "b", targets: [{ type: "grade", id: grade6 }] });
    await notices.create({ actor: root, branchId: null, title: "New grade", body: "b", targets: [{ type: "grade", id: grade7 }] });
    const seen = async (at: string) => {
      let out: string[] = [];
      await withClock(at, async () => void (out = titles((await notices.listForStudent(s)).filter((x) => x.title.endsWith("grade")))));
      return out;
    };
    eq(await seen("2027-03-10T10:00:00Z"), ["Old grade"], "March: still the old grade");
    eq(await seen("2027-04-01T10:00:00Z"), ["New grade"], "1 April: only the new grade");
  });

  test("a course notice reaches an enrolment only while its access window is open", async () => {
    const c = await mkCourse(b1);
    const s = await mkStudent(b1);
    await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2027-04-01')`, [c, s]);
    await notices.create({ actor: root, branchId: b1, title: "Course window", body: "b", targets: [{ type: "course", id: c }] });
    const sees = async (at: string) => {
      let out = false;
      await withClock(at, async () => void (out = (await notices.listForStudent(s)).some((x) => x.title === "Course window")));
      return out;
    };
    eq(await sees("2027-03-10T10:00:00Z"), false, "before access starts");
    eq(await sees("2027-04-01T10:00:00Z"), true, "from the first day");
    await q(`UPDATE enrollment SET access_ends_on = '2027-05-01' WHERE course_id = $1 AND student_id = $2`, [c, s]);
    eq(await sees("2027-04-30T10:00:00Z"), true, "the last day before the end");
    eq(await sees("2027-05-01T10:00:00Z"), false, "on the end date, as accessState treats it");
  });

  test("a promoted pair: the old class's notices stay until the effective day, the new class's start on it", async () => {
    const oldC = await mkCourse(b1);
    const newC = await mkCourse(b1);
    const s = await mkStudent(b1);
    // the old enrolment is completed at confirmation but its access runs to the effective day, which is exclusive; the successor starts on it
    await q(`INSERT INTO enrollment (course_id, student_id, status, end_reason, access_starts_on, access_ends_on) VALUES ($1,$2,'completed','promoted','2026-01-01','2027-04-01')`, [oldC, s]);
    await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2027-04-01')`, [newC, s]);
    await notices.create({ actor: root, branchId: b1, title: "Old class notice", body: "b", targets: [{ type: "course", id: oldC }] });
    await notices.create({ actor: root, branchId: b1, title: "New class notice", body: "b", targets: [{ type: "course", id: newC }] });
    const seen = async (at: string) => {
      let out: string[] = [];
      await withClock(at, async () => void (out = titles((await notices.listForStudent(s)).filter((x) => x.title.endsWith("class notice")))));
      return out;
    };
    eq(await seen("2027-03-10T10:00:00Z"), ["Old class notice"], "after confirmation, before the effective day");
    eq(await seen("2027-03-31T10:00:00Z"), ["Old class notice"], "the last day of the old access");
    eq(await seen("2027-04-01T10:00:00Z"), ["New class notice"], "on the effective day only the new class");
    eq(await seen("2027-04-02T10:00:00Z"), ["New class notice"], "after it");
  });

  test("a branch counts from its joined day: the destination branch's notices reach a promoted student on the effective day, not before", async () => {
    const s = await mkStudent(b1, grade6);
    // promotion writes the destination branch at confirmation, joined on the effective day
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary, joined_on) VALUES ($1,$2,false,'2027-04-01')`, [s, b2]);
    await notices.create({ actor: root, branchId: b2, title: "Destination branch notice", body: "b", targets: [{ type: "all" }] });
    await notices.create({ actor: root, branchId: b1, title: "Current branch notice", body: "b", targets: [{ type: "all" }] });
    const seen = async (at: string) => {
      let out: string[] = [];
      await withClock(at, async () => void (out = titles((await notices.listForStudent(s)).filter((x) => x.title.endsWith("branch notice")))));
      return out;
    };
    eq(await seen("2027-03-31T10:00:00Z"), ["Current branch notice"], "before the effective day");
    eq(await seen("2027-04-01T10:00:00Z"), ["Current branch notice", "Destination branch notice"], "from the effective day");
  });
  test("an enrolment in another course of the destination branch moves a future promotion join date back to the enrolment day", async () => {
    const s = await mkStudent(b1, grade6);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary, joined_on) VALUES ($1,$2,false,'2027-04-01')`, [s, b2]);
    await notices.create({ actor: root, branchId: b2, title: "Kandy branch notice", body: "b", targets: [{ type: "all" }] });
    const other = await mkCourse(b2);
    const enrol = createEnrollmentService(db, { now: () => new Date("2027-03-20T10:00:00Z") });
    await enrol.enrollStudent({ studentId: s, courseId: other });
    const row = (await q(`SELECT joined_on, is_primary FROM student_branch WHERE student_id = $1 AND branch_id = $2`, [s, b2]))[0]!;
    eq([row.joined_on, row.is_primary], ["2027-03-20", false], "joined on the enrolment day, still not primary");
    let out: string[] = [];
    await withClock("2027-03-21T10:00:00Z", async () => void (out = titles((await notices.listForStudent(s)).filter((x) => x.title === "Kandy branch notice"))));
    eq(out, ["Kandy branch notice"], "the branch notice reaches the student now");
    // a later enrolment never pushes the day forward
    const third = await mkCourse(b2);
    await createEnrollmentService(db, { now: () => new Date("2027-05-01T10:00:00Z") }).enrollStudent({ studentId: s, courseId: third });
    eq((await q(`SELECT joined_on FROM student_branch WHERE student_id = $1 AND branch_id = $2`, [s, b2]))[0]!.joined_on, "2027-03-20");
    // and a membership still in the future stays hidden while only the promotion exists
    const t = await mkStudent(b1, grade6);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary, joined_on) VALUES ($1,$2,false,'2027-04-01')`, [t, b2]);
    await withClock("2027-03-21T10:00:00Z", async () => void (out = titles((await notices.listForStudent(t)).filter((x) => x.title === "Kandy branch notice"))));
    eq(out, [], "future-only membership stays hidden");
  });
});
