/**
 * Student registration (B1, B2) and automatic guardian logins.
 */
import { afterAll, describe, test } from "bun:test";
import { ageOn, createAttendanceService, createStudentService } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET timezone = 'UTC', guardian_required_below_age = 16, enabled_modules = '{"parent_portal": true, "sms": true}'::jsonb`);
const org = String((await q(`SELECT id FROM organization`))[0]!.id);
await q(`INSERT INTO notification_channel (organization_id, channel, is_enabled) VALUES ($1,'sms',true) ON CONFLICT (organization_id, channel) DO UPDATE SET is_enabled = true`, [org]);
const now = () => new Date("2027-03-10T10:00:00Z");
const students = createStudentService(db, { now });
const parent = (over: Partial<{ fullName: string; phone: string; address: string; email: string }> = {}) => ({
  fullName: "Kamala Perera",
  phone: "077 123 4567",
  address: "12 Lake Road, Kandy",
  ...over,
});

describe("age", () => {
  test("ageOn counts a birthday on its day", () => {
    eq(ageOn("2011-03-10", "2027-03-10"), 16, "on the birthday");
    eq(ageOn("2011-03-11", "2027-03-10"), 15, "day before");
    eq(ageOn("2000-12-31", "2027-01-01"), 26, "year boundary");
  });
});

describe("registration rules (B1, B2)", () => {
  test("name and date of birth are required and valid", async () => {
    await fails("invalid_input", () => students.register({ fullName: "  ", dateOfBirth: "2000-01-01" }));
    await fails("invalid_input", () => students.register({ fullName: "A", dateOfBirth: "01/01/2000" }));
    await fails("invalid_input", () => students.register({ fullName: "A", dateOfBirth: "2028-01-01" }));
  });

  test("a student under the age limit needs a guardian with name, phone and address", async () => {
    await fails("guardian_required", () => students.register({ fullName: "Child", dateOfBirth: "2015-05-01" }));
    await fails("guardian_required", () => students.register({ fullName: "Child", dateOfBirth: "2015-05-01", guardians: [parent({ address: " " })] }));
    await fails("guardian_required", () => students.register({ fullName: "Child", dateOfBirth: "2015-05-01", guardians: [parent({ phone: "" })] }));
    await fails("guardian_required", () => students.register({ fullName: "Child", dateOfBirth: "2015-05-01", guardians: [parent({ fullName: "" })] }));
    await fails("invalid_input", () => students.register({ fullName: "Child", dateOfBirth: "2015-05-01", guardians: [parent({ phone: "123" })] }));
    eq((await q(`SELECT count(*)::int AS c FROM student`))[0]!.c, 0, "nothing was saved by the failures");
  });

  test("the limit is exclusive: exactly 16 needs no guardian, 15 does", async () => {
    const adult = await students.register({ fullName: "Sixteen", dateOfBirth: "2011-03-10" });
    eq(adult.guardians.length, 0, "no guardian needed");
    await fails("guardian_required", () => students.register({ fullName: "Fifteen", dateOfBirth: "2011-03-11" }));
  });
});

describe("guardians and logins", () => {
  test("a guardian gets a login record with phone, username and portal access, and is the primary one", async () => {
    const r = await students.register({ fullName: "Nimal", dateOfBirth: "2015-05-01", guardians: [parent({ email: "Kamala@Example.com" })] });
    const g = r.guardians[0]!;
    eq([g.created, g.userId !== null], [true, true], "created with login");
    const [u] = await q(`SELECT username, email, phone, password_hash FROM "user" WHERE id = $1`, [g.userId!]);
    eq([u!.username, u!.email, u!.phone, u!.password_hash], ["parent-94771234567", "kamala@example.com", "94771234567", null], "login record");
    const [gr] = await q(`SELECT portal_enabled, phone FROM guardian WHERE id = $1`, [g.guardianId]);
    eq([gr!.portal_enabled, gr!.phone], [true, "94771234567"], "guardian");
    eq((await q(`SELECT is_primary FROM student_guardian WHERE student_id = $1`, [r.student.id]))[0]!.is_primary, true, "primary");
  });

  test("a sibling's parent is linked, not duplicated, even when the number is written differently", async () => {
    const a = await students.register({ fullName: "Sibling A", dateOfBirth: "2014-01-01", guardians: [parent({ phone: "0712223333" })] });
    const b = await students.register({ fullName: "Sibling B", dateOfBirth: "2016-01-01", guardians: [parent({ phone: "+94 71 222 3333", fullName: "K. Perera" })] });
    eq(b.guardians[0]!.created, false, "not created again");
    eq(b.guardians[0]!.guardianId, a.guardians[0]!.guardianId, "same guardian");
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE phone = '94712223333'`))[0]!.c, 1, "one guardian row");
    eq((await q(`SELECT count(*)::int AS c FROM "user" WHERE username = 'parent-94712223333'`))[0]!.c, 1, "one login");
  });

  test("an email already used by someone else does not block the guardian login", async () => {
    await q(`INSERT INTO "user" (email) VALUES ('taken@example.com')`);
    const r = await students.register({ fullName: "Child T", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0755550001", email: "taken@example.com" })] });
    const [u] = await q(`SELECT email, username FROM "user" WHERE id = $1`, [r.guardians[0]!.userId!]);
    eq([u!.email, u!.username], [null, "parent-94755550001"], "login without the email");
  });

  test("two guardians: the flagged one is primary; a repeated number is one guardian", async () => {
    const r = await students.register({
      fullName: "Child P",
      dateOfBirth: "2015-01-01",
      guardians: [parent({ phone: "0755550002", fullName: "Mother" }), { ...parent({ phone: "0755550003", fullName: "Father" }), isPrimary: true }, parent({ phone: "075 555 0002" })],
    });
    eq(r.guardians.length, 2, "repeat ignored");
    const rows = await q(`SELECT g.full_name, sg.is_primary FROM student_guardian sg JOIN guardian g ON g.id = sg.guardian_id WHERE sg.student_id = $1 ORDER BY g.full_name`, [r.student.id]);
    eq(rows.map((x) => [x.full_name, x.is_primary]), [["Father", true], ["Mother", false]], "primary");
  });

  test("provisionGuardianLogins fills in guardians created without a user, and reports unusable phones", async () => {
    const withPhone = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Old Parent', '0777000111')`);
    const noPhone = await id(`INSERT INTO guardian (full_name) VALUES ('No Phone')`);
    const r = await students.provisionGuardianLogins();
    eq(r.provisioned, 1, "one provisioned");
    eq(r.skipped, [noPhone], "skipped");
    eq((await q(`SELECT user_id IS NOT NULL AS has, portal_enabled FROM guardian WHERE id = $1`, [withPhone]))[0], { has: true, portal_enabled: true }, "linked");
    eq((await students.provisionGuardianLogins()).provisioned, 0, "second run does nothing");
  });
});

describe("student record", () => {
  test("numbers are generated in order, a given number must be free, and the grade starts a level", async () => {
    const grade = String((await q(`SELECT id FROM grade_level ORDER BY ordinal LIMIT 1`))[0]!.id);
    const before = Number((await q(`SELECT count(*)::int AS c FROM student`))[0]!.c);
    const a = await students.register({ fullName: "Numbered A", dateOfBirth: "2000-01-01", gradeLevelId: grade });
    const b = await students.register({ fullName: "Numbered B", dateOfBirth: "2000-01-01" });
    eq(a.student.studentNo, `STU-${String(before + 1).padStart(6, "0")}`, "first");
    eq(b.student.studentNo, `STU-${String(before + 2).padStart(6, "0")}`, "second");
    const c = await students.register({ fullName: "Custom", dateOfBirth: "2000-01-01", studentNo: "LEGACY-7" });
    eq(c.student.studentNo, "LEGACY-7", "custom");
    await fails("invalid_input", () => students.register({ fullName: "Dup", dateOfBirth: "2000-01-01", studentNo: "LEGACY-7" }));
    eq((await q(`SELECT from_date, to_date FROM student_level WHERE student_id = $1`, [a.student.id]))[0], { from_date: "2027-03-10", to_date: null }, "level starts on the registration day");
    await fails("not_found", () => students.register({ fullName: "Bad grade", dateOfBirth: "2000-01-01", gradeLevelId: "00000000-0000-0000-0000-000000000000" }));
  });

  test("an own login can be created, and a used email is refused cleanly", async () => {
    const r = await students.register({ fullName: "With Login", dateOfBirth: "2000-01-01", login: { email: "own@example.com" } });
    eq(r.student.userId !== null, true, "has user");
    await fails("invalid_input", () => students.register({ fullName: "Same Email", dateOfBirth: "2000-01-01", login: { email: "own@example.com" } }));
    eq((await q(`SELECT count(*)::int AS c FROM student WHERE full_name = 'Same Email'`))[0]!.c, 0, "rolled back");
  });
});

describe("end to end: an absence reaches a parent who was never given an account by hand", () => {
  test("register child, enrol, mark absent, parent SMS is queued for the auto-created login", async () => {
    const attendance = createAttendanceService(db, { now });
    const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
    const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Sci 6','class','scheduled',true)`, [subj, b1]);
    const staff = await id(`INSERT INTO "user" (email) VALUES ('mark@example.com')`);
    const r = await students.register({ fullName: "E2E Child", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0766000999" })] });
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1,$2)`, [c, r.student.id]);
    const s = await attendance.createSession({ courseId: c, sessionDate: "2027-03-10", startsAt: "16:00", endsAt: "18:00" });
    const m = await attendance.mark({ sessionId: s.id, entries: [{ studentId: r.student.id, status: "absent" }], actor: staff });
    eq(m.notifications, 2, "in-app and sms");
    const rows = await q(`SELECT channel, status FROM notification WHERE user_id = $1 AND event = 'attendance_marked' ORDER BY channel`, [r.guardians[0]!.userId!]);
    eq(rows.map((x) => `${x.channel}:${x.status}`), ["in_app:sent", "sms:queued"], "rows for the parent");
  });
});
