/**
 * Sign-in: passwords, parent first login, sessions, staff authenticator codes, rate limits, resets.
 */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, resolveIdentity, ServiceError } from "@workspace/domain";
import { createAuthService, hashPassword, totp, verifyTotp } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb();
afterAll(async () => {
  await close();
});

let clock = new Date("2027-03-10T10:00:00Z");
const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));
const MIN = 60_000;
const HOUR = 3_600_000;
const auth = createAuthService(db, { secretKey: "test-secret-key-0123456789", now: () => clock });
const acl = createAccessControlService(db);
await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "lecturer_portal": true}'::jsonb`);

const GOOD = "correct horse battery";
const goodHash = await hashPassword(GOOD);
let n = 0;
async function newUser(opts: { email?: string; username?: string; phone?: string; password?: string | null; status?: string } = {}) {
  const email = opts.email ?? (opts.username ? null : `u${++n}@example.com`);
  return id(`INSERT INTO "user" (email, username, phone, password_hash, status) VALUES ($1,$2,$3,$4,$5)`, [
    email, opts.username ?? null, opts.phone ?? null, opts.password === null ? null : goodHash, opts.status ?? "active",
  ]);
}
const count = async (sqlText: string, params: unknown[] = []) => Number((await q(sqlText, params))[0]!.c);

const root = await newUser({ email: "root@example.com" });
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });

describe("totp", () => {
  test("matches the RFC 6238 test vector and allows one step of clock drift only", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    eq(totp(secret, new Date(59_000)), "287082");
    eq(verifyTotp(secret, "287082", new Date(59_000)) !== null, true);
    eq(verifyTotp(secret, "287082", new Date(59_000 + 30_000)) !== null, true);
    eq(verifyTotp(secret, "287082", new Date(59_000 + 90_000)), null);
    eq(verifyTotp(secret, "28708", new Date(59_000)), null);
    eq(verifyTotp(secret, "abcdef", new Date(59_000)), null);
  });
});

describe("password sign-in", () => {
  test("works by email, username and phone; the token is stored only as a hash", async () => {
    const byEmail = await newUser({ email: "ann@example.com" });
    const byName = await newUser({ username: "ann_staff" });
    const byPhone = await newUser({ username: "parent-94770000001", phone: "94770000001" });
    const a = await auth.signIn({ identifier: " Ann@Example.com ", password: GOOD });
    eq(a.principal.userId, byEmail, "email user");
    eq((await auth.signIn({ identifier: "ann_staff", password: GOOD })).principal.userId, byName);
    eq((await auth.signIn({ identifier: "077 000 0001", password: GOOD })).principal.userId, byPhone);
    eq(await count(`SELECT count(*)::int AS c FROM auth_session WHERE token_hash = $1`, [a.token]), 0);
    eq(await count(`SELECT count(*)::int AS c FROM auth_session WHERE user_id = $1`, [byEmail]), 1);
    eq(((await q(`SELECT last_login_at FROM "user" WHERE id = $1`, [byEmail]))[0]!.last_login_at as Date).toISOString(), clock.toISOString());
    eq((await auth.authenticate(a.token)).userId, byEmail);
  });

  test("every failure looks the same: wrong password, unknown user, disabled, no password yet", async () => {
    await newUser({ email: "dis@example.com", status: "disabled" });
    await newUser({ email: "nopw@example.com", password: null });
    for (const [identifier, password] of [["ann@example.com", "wrong password!!"], ["nobody@example.com", GOOD], ["dis@example.com", GOOD], ["nopw@example.com", GOOD], ["", GOOD]] as const) {
      await fails("invalid_credentials", () => auth.signIn({ identifier, password }));
    }
  });

  test("a phone shared by two accounts cannot be used to sign in with a password", async () => {
    await newUser({ username: "twin-a", phone: "94770000002" });
    await newUser({ username: "twin-b", phone: "94770000002" });
    await fails("invalid_credentials", () => auth.signIn({ identifier: "0770000002", password: GOOD }));
  });
});

describe("rate limits", () => {
  test("ten failed attempts lock an identifier for the window, then it opens again; success resets the count", async () => {
    await newUser({ email: "lock@example.com" });
    for (let i = 0; i < 10; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: "lock@example.com", password: "wrong password!!" }));
    await fails("rate_limited", () => auth.signIn({ identifier: "lock@example.com", password: GOOD }));
    advance(16 * MIN);
    await auth.signIn({ identifier: "lock@example.com", password: GOOD });
    for (let i = 0; i < 9; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: "lock@example.com", password: "wrong password!!" }));
    await auth.signIn({ identifier: "lock@example.com", password: GOOD });
    for (let i = 0; i < 9; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: "lock@example.com", password: "wrong password!!" }));
  });

  test("an address is limited across identifiers", async () => {
    for (let i = 0; i < 60; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: `x${i}@example.com`, password: GOOD, ip: "10.0.0.9" }));
    await fails("rate_limited", () => auth.signIn({ identifier: "x@example.com", password: GOOD, ip: "10.0.0.9" }));
    await fails("invalid_credentials", () => auth.signIn({ identifier: "x@example.com", password: GOOD, ip: "10.0.0.10" }));
  });
});

describe("sessions", () => {
  test("staff sessions last 12 hours, others 30 days; expiry, sign-out and disabling end them", async () => {
    const lecUser = await newUser({ email: "lec@example.com" });
    const lec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('L', $1)`, [lecUser]);
    await acl.setLecturerPortal({ lecturerId: lec, enabled: true, actor: root });
    const plain = await auth.signIn({ identifier: "lec@example.com", password: GOOD });
    eq(plain.expiresAt.getTime() - clock.getTime(), 30 * 24 * HOUR);
    eq(plain.principal.restriction, null);
    eq(plain.principal.portals.lecturer, true);

    const staffUser = await newUser({ email: "staff12@example.com" });
    await acl.assignRole({ userId: staffUser, roleName: "payment_handler", actor: root });
    const staff = await auth.signIn({ identifier: "staff12@example.com", password: GOOD });
    eq(staff.expiresAt.getTime() - clock.getTime(), 12 * HOUR);

    advance(13 * HOUR);
    await fails("unauthenticated", () => auth.authenticate(staff.token));
    await auth.authenticate(plain.token);
    await fails("unauthenticated", () => auth.authenticate(null));
    await fails("unauthenticated", () => auth.authenticate("not-a-token"));

    await auth.signOut(plain.token);
    await fails("unauthenticated", () => auth.authenticate(plain.token));

    const again = await auth.signIn({ identifier: "lec@example.com", password: GOOD });
    await acl.setUserStatus({ userId: lecUser, status: "disabled", actor: root });
    await fails("unauthenticated", () => auth.authenticate(again.token));
    await acl.setUserStatus({ userId: lecUser, status: "active", actor: root });
    await auth.authenticate(again.token);
    await auth.signOutEverywhere(lecUser);
    await fails("unauthenticated", () => auth.authenticate(again.token));
  });

  test("purgeExpired removes only expired sessions", async () => {
    const u = await newUser();
    const s = await auth.signIn({ identifier: (await q(`SELECT email FROM "user" WHERE id = $1`, [u]))[0]!.email as string, password: GOOD });
    eq(await auth.purgeExpired() >= 0, true);
    await auth.authenticate(s.token);
    advance(31 * 24 * HOUR);
    eq((await auth.purgeExpired()) >= 1, true);
    await fails("unauthenticated", () => auth.authenticate(s.token));
  });
});

describe("staff second step", () => {
  test("staff must enrol an authenticator, then every sign-in needs a code; recovery codes work once", async () => {
    const u = await newUser({ email: "counselor@example.com" });
    await acl.assignRole({ userId: u, roleName: "student_counselor", actor: root });
    let s = await auth.signIn({ identifier: "counselor@example.com", password: GOOD });
    eq([s.principal.restriction, s.principal.portals.admin], ["mfa_setup", false]);
    await fails("mfa_setup_required", async () => auth.assertReady(s.principal));
    await fails("mfa_setup_required", () => auth.verifyMfa({ token: s.token, code: "123456" }));

    const { secret, uri } = await auth.beginMfaEnrollment({ token: s.token });
    eq(uri.startsWith("otpauth://totp/"), true);
    eq(uri.includes(`secret=${secret}`), true);
    eq(await count(`SELECT count(*)::int AS c FROM user_two_factor WHERE user_id = $1 AND secret_cipher = $2`, [u, secret]), 0);
    await fails("invalid_code", () => auth.confirmMfaEnrollment({ token: s.token, code: "000000" }));
    const { recoveryCodes } = await auth.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) });
    eq(recoveryCodes.length, 8);
    eq(new Set(recoveryCodes).size, 8);
    const p = await auth.authenticate(s.token);
    eq([p.restriction, p.portals.admin], [null, true]);
    auth.requirePortal(p, "admin");
    await fails("forbidden", async () => auth.requirePortal(p, "parent"));
    await fails("forbidden", () => auth.beginMfaEnrollment({ token: s.token }));
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.mfa_enabled' AND entity_id = $1`, [u]), 1);

    s = await auth.signIn({ identifier: "counselor@example.com", password: GOOD });
    eq([s.principal.restriction, s.principal.portals.admin], ["mfa", false]);
    await fails("mfa_required", async () => auth.assertReady(s.principal));
    await fails("invalid_code", () => auth.verifyMfa({ token: s.token, code: "000000" }));
    const ok = await auth.verifyMfa({ token: s.token, code: totp(secret, new Date(clock.getTime() + 30_000)) });
    eq([ok.restriction, ok.portals.admin], [null, true]);

    s = await auth.signIn({ identifier: "counselor@example.com", password: GOOD });
    await auth.verifyMfa({ token: s.token, code: recoveryCodes[0]!.toUpperCase() });
    s = await auth.signIn({ identifier: "counselor@example.com", password: GOOD });
    await fails("invalid_code", () => auth.verifyMfa({ token: s.token, code: recoveryCodes[0]! }));
    await auth.verifyMfa({ token: s.token, code: recoveryCodes[1]!.replace("-", " ") });
  });

  test("code attempts are limited", async () => {
    const u = await newUser({ email: "brute@example.com" });
    await acl.assignRole({ userId: u, roleName: "attendance_marker", actor: root });
    const s = await auth.signIn({ identifier: "brute@example.com", password: GOOD });
    const { secret } = await auth.beginMfaEnrollment({ token: s.token });
    for (let i = 0; i < 8; i++) await fails("invalid_code", () => auth.confirmMfaEnrollment({ token: s.token, code: "111111" }));
    await fails("rate_limited", () => auth.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) }));
    advance(11 * MIN);
    await auth.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) });
  });

  test("a lecturer or student needs no code until they turn one on", async () => {
    const u = await newUser({ email: "stud@example.com" });
    const stu = await id(`INSERT INTO student (student_no, full_name, date_of_birth, user_id) VALUES ('AU1','S','2012-01-01',$1)`, [u]);
    const s = await auth.signIn({ identifier: "stud@example.com", password: GOOD });
    eq([s.principal.restriction, s.principal.portals.student, s.principal.identity.studentId], [null, true, stu]);
    const { secret } = await auth.beginMfaEnrollment({ token: s.token });
    await auth.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) });
    const again = await auth.signIn({ identifier: "stud@example.com", password: GOOD });
    eq(again.principal.restriction, "mfa");
  });

  test("only another root administrator can reset someone's second step, and they enrol again", async () => {
    const u = await newUser({ email: "lostphone@example.com" });
    await acl.assignRole({ userId: u, roleName: "payment_handler", actor: root });
    const s = await auth.signIn({ identifier: "lostphone@example.com", password: GOOD });
    const { secret } = await auth.beginMfaEnrollment({ token: s.token });
    await auth.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) });
    await fails("forbidden", () => auth.resetMfa({ userId: u, actor: u }));
    const outsider = await newUser();
    await fails("forbidden", () => auth.resetMfa({ userId: u, actor: outsider }));
    await fails("forbidden", () => auth.resetMfa({ userId: root, actor: root }));
    await auth.resetMfa({ userId: u, actor: root });
    await fails("unauthenticated", () => auth.authenticate(s.token));
    await fails("not_found", () => auth.resetMfa({ userId: u, actor: root }));
    eq((await auth.signIn({ identifier: "lostphone@example.com", password: GOOD })).principal.restriction, "mfa_setup");
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.mfa_reset' AND entity_id = $1`, [u]), 1);
  });
});

describe("parent first login", () => {
  async function newParent(phone: string) {
    const u = await newUser({ username: `parent-${phone}`, phone, password: null });
    await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Parent', $1, $2, true)`, [phone, u]);
    return u;
  }

  test("the phone number opens a restricted session; setting a password completes it", async () => {
    const u = await newParent("94771230001");
    const first = await auth.firstLogin({ phone: "077 123 0001" });
    eq([first.principal.userId, first.principal.restriction], [u, "set_password"]);
    eq(Object.values(first.principal.portals), [false, false, false, false]);
    await fails("password_setup_required", async () => auth.assertReady(first.principal));
    await fails("password_setup_required", () => auth.changePassword({ token: first.token, currentPassword: "x", newPassword: GOOD }));
    await fails("weak_password", () => auth.setPassword({ token: first.token, newPassword: "short" }));
    await fails("weak_password", () => auth.setPassword({ token: first.token, newPassword: "aaaaaaaaaaaa" }));

    const other = await auth.firstLogin({ phone: "0771230001" });
    const done = await auth.setPassword({ token: first.token, newPassword: "my new password 1" });
    eq([done.restriction, done.portals.parent], [null, true]);
    await fails("unauthenticated", () => auth.authenticate(other.token));
    await fails("invalid_credentials", () => auth.firstLogin({ phone: "0771230001" }));
    await fails("forbidden", () => auth.setPassword({ token: first.token, newPassword: "another one 12345" }));
    eq((await auth.signIn({ identifier: "0771230001", password: "my new password 1" })).principal.restriction, null);
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_set' AND entity_id = $1`, [u]), 1);
  });

  test("first login is refused for unknown numbers, a closed portal, the module off, and staff or lecturers", async () => {
    await fails("invalid_credentials", () => auth.firstLogin({ phone: "0700000000" }));
    await fails("invalid_credentials", () => auth.firstLogin({ phone: "not a number" }));
    const u = await newParent("94771230002");
    await q(`UPDATE guardian SET portal_enabled = false WHERE user_id = $1`, [u]);
    await fails("invalid_credentials", () => auth.firstLogin({ phone: "0771230002" }));
    await q(`UPDATE guardian SET portal_enabled = true WHERE user_id = $1`, [u]);
    await q(`UPDATE organization SET enabled_modules = '{}'::jsonb`);
    await fails("invalid_credentials", () => auth.firstLogin({ phone: "0771230002" }));
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "lecturer_portal": true}'::jsonb`);
    await auth.firstLogin({ phone: "0771230002" });
    await acl.assignRole({ userId: u, roleName: "payment_handler", actor: root });
    await fails("invalid_credentials", () => auth.firstLogin({ phone: "0771230002" }));
  });

  test("five tries per number in a window", async () => {
    for (let i = 0; i < 5; i++) await fails("invalid_credentials", () => auth.firstLogin({ phone: "0771239999" }));
    await fails("rate_limited", () => auth.firstLogin({ phone: "0771239999" }));
    const u = await newParent("94771230003");
    for (let i = 0; i < 30; i++) await fails("invalid_credentials", () => auth.firstLogin({ phone: `07712${String(40000 + i)}`, ip: "10.1.1.1" }));
    await fails("rate_limited", () => auth.firstLogin({ phone: "0771230003", ip: "10.1.1.1" }));
    eq(u.length > 0, true);
  });
});

describe("changing and resetting passwords", () => {
  test("change needs the current password, ends other sessions and is audited", async () => {
    const u = await newUser({ email: "chg@example.com" });
    const a = await auth.signIn({ identifier: "chg@example.com", password: GOOD });
    const b = await auth.signIn({ identifier: "chg@example.com", password: GOOD });
    await fails("invalid_credentials", () => auth.changePassword({ token: a.token, currentPassword: "wrong password!!", newPassword: "a brand new password" }));
    await fails("weak_password", () => auth.changePassword({ token: a.token, currentPassword: GOOD, newPassword: "short" }));
    await auth.changePassword({ token: a.token, currentPassword: GOOD, newPassword: "a brand new password" });
    await auth.authenticate(a.token);
    await fails("unauthenticated", () => auth.authenticate(b.token));
    await fails("invalid_credentials", () => auth.signIn({ identifier: "chg@example.com", password: GOOD }));
    await auth.signIn({ identifier: "chg@example.com", password: "a brand new password" });
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_changed' AND entity_id = $1`, [u]), 1);
  });

  test("staff with guardians.manage can reset a parent, who then signs in with the phone again", async () => {
    const pu = await newUser({ username: "parent-94771230010", phone: "94771230010" });
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Forgetful', '94771230010', $1, true)`, [pu]);
    const s = await auth.signIn({ identifier: "0771230010", password: GOOD });
    const counselor = await newUser();
    await acl.assignRole({ userId: counselor, roleName: "student_counselor", branchId: String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id), actor: root });
    const nobody = await newUser();
    await fails("forbidden", () => auth.resetParentPassword({ guardianId: g, actor: nobody }));
    await auth.resetParentPassword({ guardianId: g, actor: counselor });
    await fails("unauthenticated", () => auth.authenticate(s.token));
    await fails("invalid_credentials", () => auth.signIn({ identifier: "0771230010", password: GOOD }));
    eq((await auth.firstLogin({ phone: "0771230010" })).principal.restriction, "set_password");
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_reset' AND entity_id = $1`, [pu]), 1);
    const noLogin = await id(`INSERT INTO guardian (full_name, phone) VALUES ('No login','0770000000')`);
    await fails("not_found", () => auth.resetParentPassword({ guardianId: noLogin, actor: counselor }));
  });

  test("a parent who is also staff cannot be reset into phone-only entry", async () => {
    const u = await newUser({ email: "both@example.com", phone: "94771230011" });
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Both', '94771230011', $1, true)`, [u]);
    await acl.assignRole({ userId: u, roleName: "payment_handler", actor: root });
    await fails("forbidden", () => auth.resetParentPassword({ guardianId: g, actor: root }));
    eq((await resolveIdentity(db, u))!.needsPasswordSetup, false);
  });
});

describe("construction", () => {
  test("a short secret key is refused", () => {
    let err: unknown;
    try {
      createAuthService(db, { secretKey: "short" });
    } catch (e) {
      err = e;
    }
    eq(err instanceof Error && !(err instanceof ServiceError), true);
  });
});
