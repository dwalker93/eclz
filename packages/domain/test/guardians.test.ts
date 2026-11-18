/** Guardians after registration: edit, phone change, link, unlink, primary. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createGuardianService } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

const guardians = createGuardianService(db, { now: () => new Date("2027-03-10T10:00:00Z") });
const acl = createAccessControlService(db);
let n = 0;
const newUser = () => id(`INSERT INTO "user" (email, status) VALUES ($1, 'active')`, [`g${++n}@example.com`]);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const root = await newUser();
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });
await q(`INSERT INTO role (name, description) VALUES ('guardian_editor', 'custom')`);
await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'guardian_editor' AND p.code = 'guardians.manage'`);
const editor1 = await newUser();
await acl.assignRole({ userId: editor1, roleName: "guardian_editor", branchId: b1, actor: root });

const mkStudent = async (b: string, dob = "2018-05-01") => {
  const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,$3)`, [`G${++n}`, `Kid ${n}`, dob]);
  await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [s, b]);
  return s;
};
const links = (s: string) => q(`SELECT g.full_name, sg.relationship, sg.is_primary FROM student_guardian sg JOIN guardian g ON g.id = sg.guardian_id WHERE sg.student_id = $1 ORDER BY g.full_name`, [s]);

describe("linking guardians", () => {
  test("the first guardian becomes primary, a later primary demotes the old one, a known phone links the same person", async () => {
    const kid = await mkStudent(b1);
    const a = await guardians.link({ studentId: kid, actor: editor1, fullName: "Anula", phone: "0771110001", address: "Colombo", relationship: "mother" });
    eq([a.created, a.isPrimary, a.userId !== null], [true, true, true]);
    const b = await guardians.link({ studentId: kid, actor: editor1, fullName: "Bandara", phone: "077 111 0002", relationship: "father" });
    eq(b.isPrimary, false);
    await guardians.link({ studentId: kid, actor: editor1, fullName: "Chitra", phone: "0771110003", isPrimary: true });
    eq((await links(kid)).map((l) => [l.full_name, l.is_primary]), [["Anula", false], ["Bandara", false], ["Chitra", true]]);
    await fails("guardian_linked", () => guardians.link({ studentId: kid, actor: editor1, fullName: "Anula", phone: "+94771110001" }));
    await fails("invalid_input", () => guardians.link({ studentId: kid, actor: editor1, fullName: "X", phone: "abc" }));
    await fails("invalid_input", () => guardians.link({ studentId: kid, actor: editor1, fullName: " ", phone: "0771110009" }));
    const sibling = await mkStudent(b1);
    const again = await guardians.link({ studentId: sibling, actor: editor1, fullName: "Anula M", phone: "0771110001" });
    eq([again.created, again.guardianId], [false, a.guardianId]);
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE phone = '94771110001'`))[0]!.c, 1);
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1 AND action = 'guardian.link'`, [kid])).length, 3);
  });

  test("only staff with guardians.manage in the student's branch may change links", async () => {
    const far = await mkStudent(b2);
    await fails("forbidden", () => guardians.link({ studentId: far, actor: editor1, fullName: "Z", phone: "0771110004" }));
    const nobody = await newUser();
    const near = await mkStudent(b1);
    await fails("forbidden", () => guardians.link({ studentId: near, actor: nobody, fullName: "Z", phone: "0771110004" }));
    await fails("not_found", () => guardians.link({ studentId: "00000000-0000-4000-8000-000000000000", actor: root, fullName: "Z", phone: "0771110004" }));
    eq((await guardians.link({ studentId: far, actor: root, fullName: "Z", phone: "0771110004" })).created, true);
  });
});

describe("changing links", () => {
  test("make primary, change the relationship, unlink with automatic promotion", async () => {
    const kid = await mkStudent(b1);
    const a = await guardians.link({ studentId: kid, actor: root, fullName: "Alpha", phone: "0772220001" });
    const b = await guardians.link({ studentId: kid, actor: root, fullName: "Beta", phone: "0772220002" });
    await guardians.updateLink({ studentId: kid, guardianId: b.guardianId, actor: editor1, isPrimary: true, relationship: "aunt" });
    eq((await links(kid)).map((l) => [l.full_name, l.relationship, l.is_primary]), [["Alpha", null, false], ["Beta", "aunt", true]]);
    await fails("not_found", () => guardians.updateLink({ studentId: kid, guardianId: "00000000-0000-4000-8000-000000000000", actor: root, relationship: "x" }));
    await guardians.unlink({ studentId: kid, guardianId: b.guardianId, actor: editor1 });
    eq((await links(kid)).map((l) => [l.full_name, l.is_primary]), [["Alpha", true]]);
    await fails("guardian_required", () => guardians.unlink({ studentId: kid, guardianId: a.guardianId, actor: editor1 }));
    await fails("not_found", () => guardians.unlink({ studentId: kid, guardianId: b.guardianId, actor: editor1 }));
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE id = $1`, [b.guardianId]))[0]!.c, 1); // the person stays
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1 AND action LIKE 'guardian.%' ORDER BY created_at, id`, [kid])).map((r) => r.action).slice(-3), ["guardian.link", "guardian.update_link", "guardian.unlink"].slice(0, 3));
  });

  test("an adult student may end up with no guardian", async () => {
    const adult = await mkStudent(b1, "2000-01-01");
    const g = await guardians.link({ studentId: adult, actor: root, fullName: "Old", phone: "0773330001" });
    await guardians.unlink({ studentId: adult, guardianId: g.guardianId, actor: root });
    eq(await links(adult), []);
  });
});

describe("guardian details", () => {
  test("update is checked through any of the guardian's children and audited", async () => {
    const kid = await mkStudent(b1);
    const far = await mkStudent(b2);
    const g = await guardians.link({ studentId: kid, actor: root, fullName: "Shared", phone: "0774440001" });
    const stranger = await guardians.link({ studentId: far, actor: root, fullName: "Far", phone: "0774440002" });
    const row = await guardians.update({ guardianId: g.guardianId, actor: editor1, fullName: " Shared Parent ", address: "Galle", email: "Shared@Example.com", nic: "" });
    eq([row.fullName, row.address, row.email, row.nic], ["Shared Parent", "Galle", "shared@example.com", null]);
    await fails("forbidden", () => guardians.update({ guardianId: stranger.guardianId, actor: editor1, fullName: "Hacked" }));
    await fails("invalid_input", () => guardians.update({ guardianId: g.guardianId, actor: editor1, fullName: " " }));
    await fails("invalid_input", () => guardians.update({ guardianId: g.guardianId, actor: editor1, email: "nope" }));
    await fails("not_found", () => guardians.update({ guardianId: "00000000-0000-4000-8000-000000000000", actor: root, fullName: "x" }));
    // a second child in the other branch widens access
    await guardians.link({ studentId: kid, actor: root, fullName: "Far", phone: "0774440002" });
    eq((await guardians.update({ guardianId: stranger.guardianId, actor: editor1, fullName: "Far Parent" })).fullName, "Far Parent");
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1`, [g.guardianId])).map((r) => r.action), ["guardian.update"]);
  });

  test("changing the phone moves the login, ends sessions and refuses a number in use", async () => {
    const kid = await mkStudent(b1);
    const g = await guardians.link({ studentId: kid, actor: root, fullName: "Phone", phone: "0775550001" });
    const other = await guardians.link({ studentId: kid, actor: root, fullName: "Other", phone: "0775550002" });
    await q(`INSERT INTO auth_session (user_id, token_hash, expires_at) VALUES ($1, 'h1', now() + interval '1 day')`, [g.userId]);
    await fails("phone_taken", () => guardians.changePhone({ guardianId: g.guardianId, actor: editor1, phone: "0775550002" }));
    await fails("invalid_input", () => guardians.changePhone({ guardianId: g.guardianId, actor: editor1, phone: "12" }));
    const row = await guardians.changePhone({ guardianId: g.guardianId, actor: editor1, phone: "077 555 0009" });
    eq(row.phone, "94775550009");
    const u = (await q(`SELECT username, phone FROM "user" WHERE id = $1`, [g.userId]))[0]!;
    eq([u.username, u.phone], ["parent-94775550009", "94775550009"]);
    eq((await q(`SELECT count(*)::int AS c FROM auth_session WHERE user_id = $1`, [g.userId]))[0]!.c, 0);
    eq((await guardians.changePhone({ guardianId: g.guardianId, actor: editor1, phone: "0775550009" })).phone, "94775550009"); // unchanged is a no-op
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id = $1 AND action = 'guardian.change_phone'`, [g.guardianId]))[0]!.c, 1);
    void other;
    await id(`INSERT INTO guardian (full_name, phone) VALUES ('No Login', '94775550077')`); // an old record without a login
    await fails("phone_taken", () => guardians.changePhone({ guardianId: g.guardianId, actor: editor1, phone: "0775550077" }));
  });
});
