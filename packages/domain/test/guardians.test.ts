/** Guardians after registration: edit, phone change, link, unlink, primary. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createGuardianService, ensureGuardianLogin } from "../src";
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

// ---- review hardening

/** The same db, but `hook` runs just before the first transaction starts: a rival write landing between a check and a write. */
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
const racing = (hook: () => Promise<void>) => createGuardianService(withBefore(hook), { now: () => new Date("2027-03-10T10:00:00Z") });
const orphan = (phone: string) => id(`INSERT INTO guardian (full_name, phone) VALUES ('Imported', $1)`, [phone]);

describe("changing a phone", () => {
  test("a number or login name held by another login is refused even when the guardian has no login", async () => {
    const g = await orphan("94775550201");
    await q(`INSERT INTO "user" (email, phone) VALUES ('holder@example.com', '94775550202')`);
    await fails("phone_taken", () => guardians.changePhone({ guardianId: g, actor: root, phone: "0775550202" }));
    await q(`INSERT INTO "user" (username) VALUES ('parent-94775550203')`);
    await fails("phone_taken", () => guardians.changePhone({ guardianId: g, actor: root, phone: "0775550203" }));
    eq((await q(`SELECT phone FROM guardian WHERE id = $1`, [g]))[0]!.phone, "94775550201", "unchanged");
    eq((await guardians.changePhone({ guardianId: g, actor: root, phone: "0775550204" })).phone, "94775550204", "a free number works");
  });

  test("a login provisioned after the guardian was first read follows the new number", async () => {
    const g = await orphan("94775550211");
    const rival = racing(async () => void (await db.transaction((tx) => ensureGuardianLogin(tx, { id: g }))));
    await rival.changePhone({ guardianId: g, actor: root, phone: "0775550212" });
    const [row] = await q(`SELECT g.phone AS gp, u.phone AS up, u.username FROM guardian g JOIN "user" u ON u.id = g.user_id WHERE g.id = $1`, [g]);
    eq([row!.gp, row!.up, row!.username], ["94775550212", "94775550212", "parent-94775550212"], "login moved with the guardian");
  });

  test("a rival that claims the number first wins; the second change is refused", async () => {
    const a = await orphan("94775550221");
    const b = await orphan("94775550222");
    const rival = racing(async () => void (await guardians.changePhone({ guardianId: b, actor: root, phone: "0775550223" })));
    await fails("phone_taken", () => rival.changePhone({ guardianId: a, actor: root, phone: "0775550223" }));
    eq((await q(`SELECT phone FROM guardian WHERE id = $1`, [a]))[0]!.phone, "94775550221");
  });
});

describe("editing details", () => {
  test("the audit before-image is the row as it was when the edit locked it", async () => {
    const g = await orphan("94775550231");
    await guardians.update({ guardianId: g, actor: root, address: "X" });
    const rival = racing(async () => void (await guardians.update({ guardianId: g, actor: root, address: "Y" })));
    await rival.update({ guardianId: g, actor: root, address: "Z" });
    const rows = await q(`SELECT before_data->>'address' AS b, after_data->>'address' AS a FROM audit_log WHERE entity_id = $1 AND action = 'guardian.update' ORDER BY created_at, id`, [g]);
    eq(rows.map((r) => [r.b, r.a]), [[null, "X"], ["X", "Y"], ["Y", "Z"]], "each edit records what it replaced");
  });

  test("email is checked the same way on create and edit; blank stays optional", async () => {
    const kid = await mkStudent(b1);
    await fails("invalid_input", () => guardians.link({ studentId: kid, actor: root, fullName: "Bad", phone: "0775550241", email: "not-an-email" }));
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE phone = '94775550241'`))[0]!.c, 0, "nothing created");
    const ok = await guardians.link({ studentId: kid, actor: root, fullName: "Good", phone: "0775550242", email: " Mixed@Example.COM " });
    eq((await q(`SELECT email FROM guardian WHERE id = $1`, [ok.guardianId]))[0]!.email, "mixed@example.com");
    await guardians.link({ studentId: kid, actor: root, fullName: "Blank", phone: "0775550243", email: "  " });
    await fails("invalid_input", () => guardians.update({ guardianId: ok.guardianId, actor: root, email: "not-an-email" }));
    eq((await guardians.update({ guardianId: ok.guardianId, actor: root, email: "" })).email, null);
  });
});

describe("linking across branches", () => {
  test("reusing a guardian who only has children elsewhere needs a manager of that guardian, not just of the student", async () => {
    const far = await mkStudent(b2);
    const g = await guardians.link({ studentId: far, actor: root, fullName: "Far Parent", phone: "0775550251" });
    const near = await mkStudent(b1);
    await fails("forbidden", () => guardians.link({ studentId: near, actor: editor1, fullName: "Whoever", phone: "+94 77 555 0251" }));
    eq(await links(near), [], "no link made");
    await fails("forbidden", () => guardians.update({ guardianId: g.guardianId, actor: editor1, fullName: "Hijacked" }));
    eq((await guardians.link({ studentId: near, actor: root, fullName: "Whoever", phone: "0775550251" })).guardianId, g.guardianId, "an all-branches manager may");
    // now the guardian has a child in b1, so a branch-1 editor can link a sibling
    const sibling = await mkStudent(b1);
    eq((await guardians.link({ studentId: sibling, actor: editor1, fullName: "x", phone: "0775550251" })).guardianId, g.guardianId, "verified sibling reuse works");
    const orphanId = await orphan("94775550252");
    eq((await guardians.link({ studentId: sibling, actor: editor1, fullName: "x", phone: "0775550252" })).guardianId, orphanId, "a guardian with no student yet can be reused");
  });

  test("an account that is not a bare guardian login is never attached", async () => {
    const stuUser = await id(`INSERT INTO "user" (username, phone) VALUES ('parent-94775550261', '94775550261')`);
    await q(`INSERT INTO student (student_no, full_name, date_of_birth, user_id) VALUES ('GX1','Teen','2008-01-01',$1)`, [stuUser]);
    const kid = await mkStudent(b1);
    await fails("phone_taken", () => guardians.link({ studentId: kid, actor: root, fullName: "Parent", phone: "0775550261" }));
    eq(await links(kid), [], "rolled back");
    eq((await q(`SELECT count(*)::int AS c FROM guardian WHERE user_id = $1 OR phone = '94775550261'`, [stuUser]))[0]!.c, 0, "no guardian created or bound");
  });
});

describe("link changes", () => {
  test("ids match whatever the letter case", async () => {
    const kid = await mkStudent(b1);
    const a = await guardians.link({ studentId: kid, actor: root, fullName: "Alpha", phone: "0775550271" });
    const b = await guardians.link({ studentId: kid, actor: root, fullName: "Beta", phone: "0775550272" });
    await guardians.updateLink({ studentId: kid, guardianId: b.guardianId.toUpperCase(), actor: root, relationship: "aunt" });
    await guardians.unlink({ studentId: kid, guardianId: a.guardianId.toUpperCase(), actor: root });
    eq((await links(kid)).map((l) => [l.full_name, l.relationship, l.is_primary]), [["Beta", "aunt", true]]);
  });

  test("a removal that sees only one link keeps it for an underage student", async () => {
    const kid = await mkStudent(b1);
    const a = await guardians.link({ studentId: kid, actor: root, fullName: "Alpha", phone: "0775550281" });
    const b = await guardians.link({ studentId: kid, actor: root, fullName: "Beta", phone: "0775550282" });
    const rival = racing(async () => void (await guardians.unlink({ studentId: kid, guardianId: b.guardianId, actor: root })));
    await fails("guardian_required", () => rival.unlink({ studentId: kid, guardianId: a.guardianId, actor: root }));
    eq((await links(kid)).length, 1, "one guardian remains");
  });

  test("a primary change whose link disappears fails and keeps the old primary", async () => {
    const kid = await mkStudent(b1);
    await guardians.link({ studentId: kid, actor: root, fullName: "Alpha", phone: "0775550291" });
    const b = await guardians.link({ studentId: kid, actor: root, fullName: "Beta", phone: "0775550292" });
    await q(`CREATE FUNCTION skip_promotion() RETURNS trigger AS $$ BEGIN RETURN NULL; END $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER skip_promotion BEFORE UPDATE ON student_guardian FOR EACH ROW WHEN (NEW.is_primary AND NOT OLD.is_primary) EXECUTE FUNCTION skip_promotion()`);
    try {
      await fails("not_found", () => guardians.updateLink({ studentId: kid, guardianId: b.guardianId, actor: root, isPrimary: true }));
    } finally {
      await q(`DROP TRIGGER skip_promotion ON student_guardian`);
      await q(`DROP FUNCTION skip_promotion()`);
    }
    eq((await links(kid)).map((l) => [l.full_name, l.is_primary]), [["Alpha", true], ["Beta", false]], "demotion rolled back");
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id = $1 AND action = 'guardian.update_link'`, [kid]))[0]!.c, 0, "no success audited");
  });
});
