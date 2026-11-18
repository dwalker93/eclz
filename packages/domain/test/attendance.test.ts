/**
 * Class sessions and attendance: marking, QR, absence notices, summaries.
 */
import { afterAll, describe, test } from "bun:test";
import { attendanceRate, createAttendanceService } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = '{"qr_attendance": true, "parent_portal": true, "sms": true}'::jsonb`);
const org = String((await q(`SELECT id FROM organization`))[0]!.id);
await q(`INSERT INTO notification_channel (organization_id, channel, is_enabled) VALUES ($1,'sms',true) ON CONFLICT (organization_id, channel) DO UPDATE SET is_enabled = true`, [org]);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const now = () => new Date("2027-03-10T10:00:00Z");
const att = createAttendanceService(db, { now });
const staff = await id(`INSERT INTO "user" (email) VALUES ('marker@example.com')`);
const subj = await id(`INSERT INTO subject (name) VALUES ('Maths')`);

let n = 0;
const newCourse = (opts: { attendance?: boolean; mode?: string } = {}) =>
  id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled, delivery_mode) VALUES ($1,$2,$3,'class','scheduled',$4,$5)`, [
    subj, b1, `Class ${++n}`, opts.attendance ?? true, opts.mode ?? "physical",
  ]);
async function newStudent(courseId: string | null, opts: { starts?: string; ends?: string | null; status?: string; preferred?: string } = {}) {
  const userId = await id(`INSERT INTO "user" (email) VALUES ($1)`, [`s${++n}@example.com`]);
  const studentId = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,$2,$3,'2014-05-01')`, [userId, `A${++n}`, `Student ${String(n).padStart(3, "0")}`]);
  if (courseId) {
    await q(`INSERT INTO enrollment (course_id, student_id, status, access_starts_on, access_ends_on, preferred_mode) VALUES ($1,$2,$3,$4,$5,$6)`, [
      courseId, studentId, opts.status ?? "active", opts.starts ?? "2027-01-01", opts.ends ?? null, opts.preferred ?? null,
    ]);
  }
  return { userId, studentId };
}
const session = (courseId: string, date = "2027-03-10", startsAt = "16:00") => att.createSession({ courseId, sessionDate: date, startsAt, endsAt: "18:00" });
const markOf = async (sessionId: string, studentId: string) =>
  (await q(`SELECT status, attended_via, marked_via FROM attendance WHERE session_id = $1 AND student_id = $2`, [sessionId, studentId]))[0];

describe("pure", () => {
  test("attendanceRate counts present and late, ignores excused", () => {
    eq(attendanceRate({ present: 6, late: 2, absent: 2, excused: 5 }), 80, "rate");
    eq(attendanceRate({ present: 0, late: 0, absent: 0, excused: 3 }), null, "nothing counts");
  });
});

describe("sessions", () => {
  test("create, duplicate, bad times, attendance off, bad intake", async () => {
    const c = await newCourse();
    const s = await session(c);
    eq([s.status, s.deliveryMode], ["scheduled", "physical"], "defaults to the course");
    await fails("session_invalid", () => session(c));
    await fails("session_invalid", () => att.createSession({ courseId: c, sessionDate: "2027-03-11", startsAt: "18:00", endsAt: "16:00" }));
    await fails("session_invalid", () => att.createSession({ courseId: c, sessionDate: "2027-03-11", startsAt: "10:00", endsAt: "11:00", meeting: { provider: "zoom" } }));
    await fails("attendance_disabled", async () => session(await newCourse({ attendance: false })));
    await fails("not_found", () => att.createSession({ courseId: "00000000-0000-0000-0000-000000000000", sessionDate: "2027-03-11", startsAt: "10:00", endsAt: "11:00" }));
    const other = await newCourse();
    const intake = await id(`INSERT INTO intake (course_id, name, starts_on, capacity) VALUES ($1,'I1','2027-01-01',10)`, [other]);
    await fails("session_invalid", () => att.createSession({ courseId: c, sessionDate: "2027-03-12", startsAt: "10:00", endsAt: "11:00", intakeId: intake }));
  });

  test("a cancelled slot can be reused; a session with marks cannot be cancelled", async () => {
    const c = await newCourse();
    const a = await session(c);
    await att.cancelSession({ sessionId: a.id });
    await session(c);
    const st = await newStudent(c);
    const b = await session(c, "2027-03-09");
    await att.mark({ sessionId: b.id, entries: [{ studentId: st.studentId, status: "present" }], actor: staff });
    await fails("session_has_attendance", () => att.cancelSession({ sessionId: b.id }));
  });
});

describe("marking", () => {
  test("roster lists only enrolled students in their window; marking sets held", async () => {
    const c = await newCourse();
    const ok = await newStudent(c);
    await newStudent(c, { status: "dropped" });
    await newStudent(c, { starts: "2027-04-01" });
    await newStudent(c, { ends: "2027-03-10" }); // access ended that day (exclusive end)
    await newStudent(null);
    const s = await session(c);
    const roster = await att.getRoster({ sessionId: s.id });
    eq(roster.students.map((r) => r.studentId), [ok.studentId], "roster");
    eq(roster.students[0]!.status, null, "unmarked");
    const r = await att.mark({ sessionId: s.id, entries: [{ studentId: ok.studentId, status: "present", note: "on time" }], actor: staff });
    eq([r.marked, r.changed], [1, 1], "result");
    eq((await markOf(s.id, ok.studentId))!.attended_via, "physical", "physical session");
    eq((await q(`SELECT status FROM class_session WHERE id = $1`, [s.id]))[0]!.status, "held", "held");
  });

  test("rules: enrolled only, no duplicates, not future, not cancelled, hybrid needs a mode", async () => {
    const c = await newCourse({ mode: "hybrid" });
    const a = await newStudent(c);
    const b = await newStudent(c, { preferred: "online" });
    const outsider = await newStudent(null);
    const s = await session(c);
    await fails("student_not_enrolled", () => att.mark({ sessionId: s.id, entries: [{ studentId: outsider.studentId, status: "absent" }], actor: staff }));
    await fails("invalid_input", () => att.mark({ sessionId: s.id, entries: [], actor: staff }));
    await fails("invalid_input", () => att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "present" }, { studentId: a.studentId, status: "late" }], actor: staff }));
    await fails("invalid_input", () => att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "present" }], actor: staff }));
    await att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "present", attendedVia: "online" }, { studentId: b.studentId, status: "late" }], actor: staff });
    eq((await markOf(s.id, a.studentId))!.attended_via, "online", "explicit");
    eq((await markOf(s.id, b.studentId))!.attended_via, "online", "from the enrolment's preferred mode");
    const future = await session(c, "2027-03-11");
    await fails("session_in_future", () => att.mark({ sessionId: future.id, entries: [{ studentId: a.studentId, status: "present", attendedVia: "online" }], actor: staff }));
    const gone = await session(c, "2027-03-08");
    await att.cancelSession({ sessionId: gone.id });
    await fails("session_not_open", () => att.mark({ sessionId: gone.id, entries: [{ studentId: a.studentId, status: "absent" }], actor: staff }));
  });

  test("a later mark corrects the earlier one, and absent has no attended_via", async () => {
    const c = await newCourse();
    const a = await newStudent(c);
    const s = await session(c);
    await att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "present" }], actor: staff });
    const r = await att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "absent" }], actor: staff });
    eq(r.changed, 1, "changed");
    eq(r.changed === 1 && (await markOf(s.id, a.studentId))!.attended_via, null, "via cleared");
    eq((await att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "absent" }], actor: staff })).changed, 0, "same mark again");
    eq((await q(`SELECT count(*)::int AS c FROM attendance WHERE session_id = $1`, [s.id]))[0]!.c, 1, "one row");
  });

  test("markRemainingAbsent only touches unmarked students", async () => {
    const c = await newCourse();
    const a = await newStudent(c);
    const b = await newStudent(c);
    const s = await session(c);
    await att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: "present" }], actor: staff });
    eq((await att.markRemainingAbsent({ sessionId: s.id, actor: staff })).marked, 1, "one");
    eq((await markOf(s.id, a.studentId))!.status, "present", "a kept");
    eq((await markOf(s.id, b.studentId))!.status, "absent", "b absent");
    eq((await att.markRemainingAbsent({ sessionId: s.id, actor: staff })).marked, 0, "nothing left");
  });
});

describe("absence notices", () => {
  async function withParent(c: string) {
    const st = await newStudent(c);
    const gUser = await id(`INSERT INTO "user" (email, phone) VALUES ($1,'0771234567')`, [`p${++n}@example.com`]);
    const g = await id(`INSERT INTO guardian (user_id, full_name, portal_enabled) VALUES ($1,'Parent',true)`, [gUser]);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [st.studentId, g]);
    return { ...st, gUser };
  }
  const notes = (u: string) => q(`SELECT channel, status, payload FROM notification WHERE user_id = $1 AND event = 'attendance_marked' ORDER BY channel`, [u]);

  test("parents are told once when a student is marked absent, not for present or excused", async () => {
    const c = await newCourse();
    const p = await withParent(c);
    const s = await session(c);
    await att.mark({ sessionId: s.id, entries: [{ studentId: p.studentId, status: "excused" }], actor: staff });
    eq((await notes(p.gUser)).length, 0, "excused");
    const r = await att.mark({ sessionId: s.id, entries: [{ studentId: p.studentId, status: "absent" }], actor: staff });
    eq(r.notifications, 2, "in-app and sms");
    eq((await notes(p.gUser)).map((x) => `${x.channel}:${x.status}`), ["in_app:sent", "sms:queued"], "rows");
    eq(((await notes(p.gUser))[0]!.payload as { courseName: string }).courseName.startsWith("Class"), true, "payload");
    eq((await notes(p.userId)).length, 0, "the student is not notified");
    await att.mark({ sessionId: s.id, entries: [{ studentId: p.studentId, status: "present" }], actor: staff });
    const again = await att.mark({ sessionId: s.id, entries: [{ studentId: p.studentId, status: "absent" }], actor: staff });
    eq(again.notifications, 0, "same session and student never twice");
  });

  test("no notices when the parent portal is off", async () => {
    const c = await newCourse();
    const p = await withParent(c);
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"parent_portal": false}'::jsonb`);
    const s = await session(c);
    eq((await att.mark({ sessionId: s.id, entries: [{ studentId: p.studentId, status: "absent" }], actor: staff })).notifications, 0, "none");
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"parent_portal": true}'::jsonb`);
  });
});

describe("QR", () => {
  const tokenOf = async (studentId: string) => String((await q(`SELECT qr_token FROM student WHERE id = $1`, [studentId]))[0]!.qr_token);

  test("scan marks present once, can be late, and corrects an earlier absence", async () => {
    const c = await newCourse();
    const a = await newStudent(c);
    const b = await newStudent(c);
    const s = await session(c);
    const r1 = await att.markByQr({ sessionId: s.id, qrToken: await tokenOf(a.studentId), actor: staff });
    eq([r1.status, r1.alreadyMarked], ["present", false], "first scan");
    eq((await markOf(s.id, a.studentId))!.marked_via, "qr", "marked via qr");
    const r2 = await att.markByQr({ sessionId: s.id, qrToken: await tokenOf(a.studentId), late: true, actor: staff });
    eq([r2.status, r2.alreadyMarked], ["present", true], "second scan changes nothing");
    await att.mark({ sessionId: s.id, entries: [{ studentId: b.studentId, status: "absent" }], actor: staff });
    const r3 = await att.markByQr({ sessionId: s.id, qrToken: await tokenOf(b.studentId), late: true, actor: staff });
    eq(r3.status, "late", "absent becomes late");
  });

  test("unknown card, not enrolled, module off, rotated token", async () => {
    const c = await newCourse();
    const a = await newStudent(c);
    const out = await newStudent(null);
    const s = await session(c);
    await fails("qr_unknown", () => att.markByQr({ sessionId: s.id, qrToken: "nope", actor: staff }));
    await fails("student_not_enrolled", async () => att.markByQr({ sessionId: s.id, qrToken: await tokenOf(out.studentId), actor: staff }));
    const old = await tokenOf(a.studentId);
    const fresh = await att.rotateQrToken({ studentId: a.studentId });
    eq(fresh !== old, true, "new token");
    await fails("qr_unknown", () => att.markByQr({ sessionId: s.id, qrToken: old, actor: staff }));
    await att.markByQr({ sessionId: s.id, qrToken: fresh, actor: staff });
    await fails("not_found", () => att.rotateQrToken({ studentId: "00000000-0000-0000-0000-000000000000" }));
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"qr_attendance": false}'::jsonb`);
    await fails("module_disabled", () => att.markByQr({ sessionId: s.id, qrToken: fresh, actor: staff }));
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"qr_attendance": true}'::jsonb`);
  });
});

describe("summary", () => {
  test("counts, rate, course and date filters; cancelled sessions are ignored", async () => {
    const c = await newCourse();
    const a = await newStudent(c);
    const days = ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05"];
    const status = ["present", "late", "absent", "excused", "present"] as const;
    for (const [i, d] of days.entries()) {
      const s = await session(c, d);
      await att.mark({ sessionId: s.id, entries: [{ studentId: a.studentId, status: status[i]! }], actor: staff });
    }
    const all = await att.studentSummary({ studentId: a.studentId });
    eq(all, { present: 2, late: 1, absent: 1, excused: 1, sessions: 5, rate: 75 }, "all");
    eq((await att.studentSummary({ studentId: a.studentId, courseId: c, from: "2027-03-03", to: "2027-03-05" })).sessions, 2, "range, end exclusive");
    const bad = await q(`SELECT id FROM class_session WHERE course_id = $1 AND session_date = '2027-03-03'`, [c]);
    await q(`UPDATE class_session SET status = 'cancelled' WHERE id = $1`, [String(bad[0]!.id)]);
    eq((await att.studentSummary({ studentId: a.studentId })).absent, 0, "cancelled ignored");
  });
});
