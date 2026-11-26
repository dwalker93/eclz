/**
 * Student registration (B1, B2) and automatic guardian logins.
 */
import { afterAll, describe, test } from "bun:test";
import { ageOn, createAccessControlService, createAttendanceService, createStudentService } from "../src";
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
const service = createStudentService(db, { now });
const acl = createAccessControlService(db);
const newUser = () => id(`INSERT INTO "user" (email, status) VALUES ($1, 'active')`, [`u${Math.random().toString(36).slice(2)}@example.com`]);
const root = await newUser();
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });
/** Registers as the all-branches administrator unless a test names another actor. */
const students = { ...service, register: (i: Omit<Parameters<typeof service.register>[0], "actor"> & { actor?: string }) => service.register({ actor: root, ...i }) };
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

describe("guardian logins and phone identity", () => {
  const studentCount = async () => Number((await q(`SELECT count(*)::int AS c FROM student`))[0]!.c);

  test("a student login cannot use the reserved parent- prefix", async () => {
    const before = await studentCount();
    await fails("invalid_input", () => students.register({ fullName: "Sneaky", dateOfBirth: "2005-01-01", login: { username: "Parent-94771119998" } }));
    eq(await studentCount(), before, "nothing saved");
  });

  test("an account that is not a bare guardian login is never attached to a guardian", async () => {
    // Older data: a student account whose username looks like another family's parent login.
    const stuUser = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94771190909', NULL)`);
    await q(`INSERT INTO student (student_no, full_name, date_of_birth, user_id) VALUES ('SX1','Teen','2008-01-01',$1)`, [stuUser]);
    const before = await studentCount();
    await fails("phone_taken", () => students.register({ fullName: "Child", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0771190909" })] }));
    eq(await studentCount(), before, "registration rolled back");
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE user_id = $1`, [stuUser]))[0]!.c, 0, "student account not attached");
    // Even with the right phone and username, an account that belongs to a student is not a guardian login.
    await q(`UPDATE "user" SET phone = '94771190909' WHERE id = $1`, [stuUser]);
    await fails("phone_taken", () => students.register({ fullName: "Child", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0771190909" })] }));
  });

  test("a bare guardian login left without its guardian is reused", async () => {
    const orphan = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94771118888', '94771118888')`);
    const r = await students.register({ fullName: "Child", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0771118888" })] });
    eq(r.guardians[0]!.userId, orphan, "reused");
  });

  test("a guardian stored in another phone format is found, not duplicated", async () => {
    const old = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Old Parent', '0777000444')`);
    await students.provisionGuardianLogins();
    const r = await students.register({ fullName: "Child", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "+94 77 700 0444" })] });
    eq([r.guardians[0]!.guardianId, r.guardians[0]!.created], [old, false], "same guardian");
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%777000444'`))[0]!.c, 1, "one row");
  });

  test("the primary flag on a repeated phone lands on the kept guardian", async () => {
    const r = await students.register({
      fullName: "Child Q",
      dateOfBirth: "2015-01-01",
      guardians: [parent({ phone: "0755550011", fullName: "Other" }), parent({ phone: "0755550010", fullName: "First" }), { ...parent({ phone: "075 555 0010", fullName: "First again" }), isPrimary: true }],
    });
    const rows = await q(`SELECT g.full_name, sg.is_primary FROM student_guardian sg JOIN guardian g ON g.id = sg.guardian_id WHERE sg.student_id = $1 ORDER BY g.full_name`, [r.student.id]);
    eq(rows.map((x) => [x.full_name, x.is_primary]), [["First", true], ["Other", false]], "one primary, the flagged person");
    const none = await students.register({ fullName: "Child R", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0755550012" }), parent({ phone: "0755550013" })] });
    eq((await q(`SELECT count(*)::int AS c FROM student_guardian WHERE student_id = $1 AND is_primary`, [none.student.id]))[0]!.c, 1, "first is the default");
  });

  test("provisioning reports duplicate numbers and conflicts without undoing the rest", async () => {
    const d1 = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Dup One', '0777000222')`);
    const d2 = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Dup Two', '+94 77 700 0222')`);
    const fine = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Fine', '0777000333')`);
    const stuUser = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94777000555', '94777000555')`);
    await q(`INSERT INTO student (student_no, full_name, date_of_birth, user_id) VALUES ('SX2','Teen','2008-01-01',$1)`, [stuUser]);
    const clash = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Clash', '0777000555')`);
    const r = await students.provisionGuardianLogins();
    eq(r.provisioned, 1, "only the clean one");
    eq(r.duplicates.map((g) => [...g].sort()), [[d1, d2].sort()], "duplicates reported");
    eq(r.conflicts, [clash], "conflict reported");
    eq((await q(`SELECT user_id IS NOT NULL AS has FROM guardian WHERE id = $1`, [fine]))[0]!.has, true, "clean guardian linked");
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE id IN ($1,$2,$3) AND user_id IS NOT NULL`, [d1, d2, clash]))[0]!.c, 0, "unresolved ones untouched");
    const again = await students.provisionGuardianLogins();
    eq([again.provisioned, again.duplicates.length, again.conflicts], [0, 1, [clash]], "a rerun gives the same report");
  });
});

describe("student record hardening", () => {
  const adult = (over: Record<string, unknown> = {}) => ({ fullName: "Adult Learner", dateOfBirth: "2000-01-01", ...over });
  const actor = () => id(`INSERT INTO "user" (email) VALUES ($1)`, [`hard${Math.random().toString(36).slice(2)}@example.com`]);

  test("get shows only the enrolments of courses in the caller's branches", async () => {
    const bB = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Branch B')`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Scope Subject')`);
    const r = await students.register({ fullName: "Two Branch", dateOfBirth: "2000-01-01", branchId: b1 });
    await q(`INSERT INTO student_branch (student_id, branch_id) VALUES ($1,$2)`, [r.student.id, bB]);
    const enrol = async (branchId: string, name: string) => {
      const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1,$2,$3,'class','scheduled')`, [subj, branchId, name]);
      const fs = await id(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1,$2,'Fee','recurring','monthly')`, [branchId, c]);
      await q(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1,$2,$3)`, [c, r.student.id, fs]);
      return c;
    };
    const cA = await enrol(b1, "Course A");
    const cB = await enrol(bB, "Course B");
    const courses = async (scope: "all" | string[]) => (await students.get({ studentId: r.student.id, scope })).enrolments.map((e) => e.courseId).sort();
    eq(await courses("all"), [cA, cB].sort(), "all-branches staff see everything");
    eq(await courses([b1]), [cA], "branch A staff see A only");
    eq(await courses([bB]), [cB], "branch B staff see B only");
    eq(await courses([b1, bB]), [cA, cB].sort(), "both branches");
    eq(await courses([]), [], "no branch, nothing");
  });

  test("a birth date must be a real day on registration and update; a leap day is fine", async () => {
    const a = await actor();
    const r = await students.register({ ...adult({ branchId: b1 }) });
    await fails("invalid_input", () => students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2025-02-30" }));
    await fails("invalid_input", () => students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2025-13-01" }));
    await fails("invalid_input", () => students.register({ fullName: "Impossible", dateOfBirth: "2005-02-30" }));
    eq((await students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2000-02-29" })).dateOfBirth, "2000-02-29", "a real leap day");
  });

  test("a birth date in the future is refused on update, as on registration; edits without one are unaffected", async () => {
    const a = await actor();
    const r = await students.register({ ...adult({ branchId: b1 }) });
    await fails("invalid_input", () => students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2027-03-11" }));
    eq((await students.update({ studentId: r.student.id, actor: a, schoolName: "Edited" })).schoolName, "Edited");
    const g = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Newborn Parent', '94771239875')`);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [r.student.id, g]);
    eq((await students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2027-03-10" })).dateOfBirth, "2027-03-10", "today is not the future");
  });

  test("a correction that puts the student under the age limit needs a guardian first", async () => {
    const a = await actor();
    const r = await students.register({ ...adult({ branchId: b1 }) });
    await fails("guardian_required", () => students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2015-01-01" }));
    eq((await q(`SELECT date_of_birth::text AS d FROM student WHERE id = $1`, [r.student.id]))[0]!.d, "2000-01-01", "unchanged");
    const g = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Linked Parent', '94771239876')`);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [r.student.id, g]);
    eq((await students.update({ studentId: r.student.id, actor: a, dateOfBirth: "2015-01-01" })).dateOfBirth, "2015-01-01", "allowed once a guardian is linked");
    // an older student stays unaffected, and re-saving the same date is not re-checked
    const kid = await students.register({ fullName: "Kid", dateOfBirth: "2015-01-01", guardians: [parent({ phone: "0771239877" })] });
    await q(`DELETE FROM student_guardian WHERE student_id = $1`, [kid.student.id]);
    eq((await students.update({ studentId: kid.student.id, actor: a, dateOfBirth: "2015-01-01", schoolName: "Same date" })).schoolName, "Same date");
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

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Galle')`);

describe("branch, list, get, update", () => {
  const adult = (over: Record<string, unknown> = {}) => ({ fullName: "Adult Learner", dateOfBirth: "1990-01-01", ...over });

  test("a registered student joins the given branch as primary; an unknown branch is refused", async () => {
    const r = await students.register(adult({ branchId: b1 }));
    eq(await q(`SELECT branch_id, is_primary FROM student_branch WHERE student_id = $1`, [r.student.id]), [{ branch_id: b1, is_primary: true }]);
    await fails("not_found", () => students.register(adult({ branchId: "00000000-0000-0000-0000-000000000000" })));
    const none = await students.register(adult());
    eq(Number((await q(`SELECT count(*)::int AS c FROM student_branch WHERE student_id = $1`, [none.student.id]))[0]!.c), 0);
  });

  test("list respects the branch scope, searches, and shows a student once", async () => {
    const a = await students.register(adult({ fullName: "Zed Unique Alpha", branchId: b1, contactPhone: "0779990001" }));
    const b = await students.register(adult({ fullName: "Zed Unique Beta", branchId: b2 }));
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,false)`, [a.student.id, b2]);
    const names = async (scope: "all" | string[], search = "Zed Unique") => (await students.list({ scope, search })).map((s) => s.fullName);
    eq(await names("all"), ["Zed Unique Alpha", "Zed Unique Beta"]);
    eq(await names([b1]), ["Zed Unique Alpha"]);
    eq(await names([b2]), ["Zed Unique Alpha", "Zed Unique Beta"]);
    eq(await names([]), []);
    eq(await names("all", "0779990001"), ["Zed Unique Alpha"]);
    eq(await names("all", b.student.studentNo), ["Zed Unique Beta"]);
    // A literal % or _ in the search is not a wildcard: only the name that really contains it matches (an unescaped % would match both).
    await students.register(adult({ fullName: "Pct100% Complete" }));
    await students.register(adult({ fullName: "Pct100 Students" }));
    await students.register(adult({ fullName: "Under_Score Pupil" }));
    await students.register(adult({ fullName: "UnderXScore Pupil" }));
    eq(await names("all", "Pct100%"), ["Pct100% Complete"]);
    eq(await names("all", "Under_Score"), ["Under_Score Pupil"]);
    eq((await students.list({ scope: "all", search: "Zed Unique", limit: 1, offset: 1 })).map((s) => s.fullName), ["Zed Unique Beta"]);
  });

  test("get returns guardians, branches and enrolments", async () => {
    const r = await students.register({ fullName: "Young One", dateOfBirth: "2015-06-01", branchId: b1, guardians: [parent({ phone: "0771119999" })] });
    const g = await students.get({ studentId: r.student.id, scope: "all" });
    eq([g.student.fullName, g.guardians.map((x) => x.fullName), g.branches.map((x) => x.branchId), g.enrolments], ["Young One", ["Kamala Perera"], [b1], []]);
    await fails("not_found", () => students.get({ studentId: "00000000-0000-0000-0000-000000000000", scope: "all" }));
  });

  test("update changes only the given fields and is audited with before and after", async () => {
    const r = await students.register(adult({ branchId: b1, schoolName: "Old School" }));
    const actor = await id(`INSERT INTO "user" (email) VALUES ('editor@example.com')`);
    const row = await students.update({ studentId: r.student.id, actor, schoolName: "New School", status: "suspended" });
    eq([row.schoolName, row.status, row.fullName], ["New School", "suspended", "Adult Learner"]);
    const [a] = await q(`SELECT before_data, after_data FROM audit_log WHERE action = 'student.update' AND entity_id = $1`, [r.student.id]);
    eq([a!.before_data, a!.after_data], [{ status: "active", schoolName: "Old School" }, { status: "suspended", schoolName: "New School" }]);
    await students.update({ studentId: r.student.id, actor });
    eq(Number((await q(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'student.update' AND entity_id = $1`, [r.student.id]))[0]!.c), 1);
    await fails("invalid_input", () => students.update({ studentId: r.student.id, actor, fullName: "  " }));
    await fails("invalid_input", () => students.update({ studentId: r.student.id, actor, dateOfBirth: "1/1/90" }));
    await fails("invalid_input", () => students.update({ studentId: r.student.id, actor, status: "gone" as never }));
    await fails("not_found", () => students.update({ studentId: "00000000-0000-0000-0000-000000000000", actor, fullName: "X" }));
  });
});

describe("guardian reuse at registration is scoped like guardians.link", () => {
  test("a branch-only caller cannot pull in another branch's guardian by a different spelling of the phone; sibling and orphan reuse still work", async () => {
    const editorA = await newUser();
    await acl.assignRole({ userId: editorA, roleName: "student_counselor", branchId: b1, actor: root });
    // a guardian of a branch-2 student, stored in the legacy local format
    const other = await id(`INSERT INTO guardian (full_name, phone, address) VALUES ('Branch B Parent', '0777000888', 'Galle')`);
    const kidB = (await students.register({ fullName: "B Kid", dateOfBirth: "2000-01-01", branchId: b2 })).student.id;
    await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [kidB, other]);
    const counts = async () => [(await q(`SELECT count(*)::int AS c FROM student`))[0]!.c, (await q(`SELECT count(*)::int AS c FROM student_guardian WHERE guardian_id = $1`, [other]))[0]!.c];
    const before = await counts();

    await fails("forbidden", () => students.register({ actor: editorA, fullName: "A Kid", dateOfBirth: "2015-01-01", branchId: b1, guardians: [parent({ phone: "+94 77 700 0888" })] }));
    eq(await counts(), before, "nothing was created and nothing linked");

    // a guardian of a branch-1 student: sibling reuse by the branch-1 caller is allowed
    const sib = await students.register({ actor: editorA, fullName: "A Sib 1", dateOfBirth: "2015-01-01", branchId: b1, guardians: [parent({ phone: "0777000889", fullName: "A Parent" })] });
    const sib2 = await students.register({ actor: editorA, fullName: "A Sib 2", dateOfBirth: "2016-01-01", branchId: b1, guardians: [parent({ phone: "+94 77 700 0889" })] });
    eq(sib2.guardians[0]!.guardianId, sib.guardians[0]!.guardianId, "sibling reuse");
    eq(sib2.guardians[0]!.created, false, "not duplicated");

    // a guardian with no student yet can be reused by anyone who registers
    const orphan = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Orphan Parent', '0777000890')`);
    const viaOrphan = await students.register({ actor: editorA, fullName: "A Orphan Kid", dateOfBirth: "2015-01-01", branchId: b1, guardians: [parent({ phone: "+94 77 700 0890" })] });
    eq(viaOrphan.guardians[0]!.guardianId, orphan, "orphan reuse");

    // an all-branches administrator may reuse the branch-2 guardian
    const byRoot = await students.register({ fullName: "Root Kid", dateOfBirth: "2015-01-01", branchId: b1, guardians: [parent({ phone: "+94 77 700 0888" })] });
    eq(byRoot.guardians[0]!.guardianId, other, "all-branches reuse");
  });
});
