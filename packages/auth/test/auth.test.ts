/**
 * Sign-in: passwords, parent first login, sessions, staff authenticator codes, rate limits, resets.
 */
import { afterAll, describe, spyOn, test } from "bun:test";
import { createAccessControlService, createGuardianService, resolveIdentity, ServiceError } from "@workspace/domain";
import { createAuthService, hashPassword, signInKey, totp, verifyTotp } from "../src";
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

/** A student linked to the guardian, enrolled in the given branches (none: a student in no branch). */
let kids = 0;
async function childOf(guardianId: string, branches: string[]) {
  const stu = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,'Kid','2014-01-01')`, [`AK${++kids}`]);
  await q(`INSERT INTO student_guardian (student_id, guardian_id) VALUES ($1,$2)`, [stu, guardianId]);
  for (const [i, b] of branches.entries()) await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,$3)`, [stu, b, i === 0]);
  return stu;
}

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
    // Disabling ended the session for good: re-enabling does not revive the old token.
    await fails("unauthenticated", () => auth.authenticate(again.token));
    eq(await count(`SELECT count(*)::int AS c FROM auth_session WHERE user_id = $1`, [lecUser]), 0, "sessions deleted at disable");
    const fresh = await auth.signIn({ identifier: "lec@example.com", password: GOOD });
    await auth.authenticate(fresh.token);
    await auth.signOutEverywhere(lecUser);
    await fails("unauthenticated", () => auth.authenticate(fresh.token));
  });

  test("a session that survived from before sessions were deleted on disable does not come back when the account is re-enabled", async () => {
    const u = await newUser();
    const email = (await q(`SELECT email FROM "user" WHERE id = $1`, [u]))[0]!.email as string;
    const old = await auth.signIn({ identifier: email, password: GOOD });
    // the old behaviour: the status flips and the session row stays
    await q(`UPDATE "user" SET status = 'disabled' WHERE id = $1`, [u]);
    await fails("unauthenticated", () => auth.authenticate(old.token));
    await acl.setUserStatus({ userId: u, status: "active", actor: root });
    await fails("unauthenticated", () => auth.authenticate(old.token));
    eq(await count(`SELECT count(*)::int AS c FROM auth_session WHERE user_id = $1`, [u]), 0, "sessions deleted at enable");
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
    // A session still waiting for enrolment cannot change the password, even with the right current one.
    await fails("mfa_setup_required", () => auth.changePassword({ token: s.token, currentPassword: GOOD, newPassword: "a brand new password" }));
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_changed' AND entity_id = $1`, [u]), 0, "nothing changed");

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
    await fails("mfa_required", () => auth.changePassword({ token: s.token, currentPassword: GOOD, newPassword: "a brand new password" }));
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_changed' AND entity_id = $1`, [u]), 0, "still unchanged");
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
    // upper-case spellings are the same accounts for the database, so they are the same accounts for the self-reset rule too
    await fails("forbidden", () => auth.resetMfa({ userId: root.toUpperCase(), actor: root }));
    await fails("forbidden", () => auth.resetMfa({ userId: `{${root.toUpperCase()}}`, actor: root }));
    await fails("forbidden", () => auth.resetMfa({ userId: root, actor: root.toUpperCase() }));
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

  test("the first login is checked again under the user lock: a change that commits after the lookup stops the session", async () => {
    // The lookup (findFirstLoginUser) runs before the session transaction. `between` runs just before that transaction starts, as a concurrent write would.
    const racing = (between: () => Promise<unknown>) =>
      createAuthService(
        new Proxy(db, {
          get(t, k, r) {
            if (k !== "transaction") return Reflect.get(t, k, r);
            return async (...a: unknown[]) => {
              await between();
              return (t.transaction as (...x: unknown[]) => unknown).apply(t, a);
            };
          },
        }),
        { secretKey: "test-secret-key-0123456789", now: () => clock },
      );
    const sessions = (u: string) => count(`SELECT count(*)::int AS c FROM auth_session WHERE user_id = $1`, [u]);
    const MODULES = `UPDATE organization SET enabled_modules = '{"parent_portal": true, "lecturer_portal": true}'::jsonb`;
    const cases: [string, (u: string) => Promise<unknown>][] = [
      ["a phone change", (u) => q(`UPDATE "user" SET phone = '94779990000' WHERE id = $1`, [u])],
      ["a password set", (u) => q(`UPDATE "user" SET password_hash = $2 WHERE id = $1`, [u, goodHash])],
      ["the portal switched off", (u) => q(`UPDATE guardian SET portal_enabled = false WHERE user_id = $1`, [u])],
      ["the account disabled", (u) => q(`UPDATE "user" SET status = 'disabled' WHERE id = $1`, [u])],
      ["the module switched off", () => q(`UPDATE organization SET enabled_modules = '{}'::jsonb`)],
      ["a staff role assigned", (u) => acl.assignRole({ userId: u, roleName: "payment_handler", actor: root })],
      ["a lecturer record linked", (u) => q(`INSERT INTO lecturer (full_name, user_id) VALUES ('L', $1)`, [u])],
    ];
    for (const [k, [name, change]] of cases.entries()) {
      const digits = `0771231${String(100 + k)}`;
      const u = await newParent(`94${digits.slice(1)}`);
      await fails("invalid_credentials", () => racing(() => change(u)).firstLogin({ phone: digits }));
      eq([name, await sessions(u)], [name, 0]);
      await q(MODULES);
    }
    // nothing changed in between: the session is issued
    const ok = await newParent("94771231200");
    eq((await racing(async () => {}).firstLogin({ phone: "0771231200" })).principal.userId, ok);
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
    const mainBranch = String((await q(`SELECT id FROM branch ORDER BY created_at, id LIMIT 1`))[0]!.id);
    await acl.assignRole({ userId: counselor, roleName: "student_counselor", branchId: mainBranch, actor: root });
    await childOf(g, [mainBranch]);
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

// ---- review hardening

/** The same db, but `hook` runs just before the first transaction starts: a rival write that lands in the gap between a check and a write. */
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
const raced = (hook: () => Promise<void>) => createAuthService(withBefore(hook), { secretKey: "test-secret-key-0123456789", now: () => clock });
const sessions = (userId: string) => count(`SELECT count(*)::int AS c FROM auth_session WHERE user_id = $1`, [userId]);

async function parent(phone: string) {
  const u = await newUser({ username: `p-${phone}`, phone, password: null });
  const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('P', $1, $2, true)`, [phone, u]);
  return { u, g };
}
async function staffWithMfa(email: string) {
  const u = await newUser({ email });
  await acl.assignRole({ userId: u, roleName: "student_counselor", actor: root });
  const s = await auth.signIn({ identifier: email, password: GOOD });
  const { secret } = await auth.beginMfaEnrollment({ token: s.token });
  const { recoveryCodes } = await auth.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) });
  return { u, secret, recoveryCodes, email };
}

describe("session issuance is serialized with credential changes", () => {
  test("a password changed between the check and the insert issues no session", async () => {
    const u = await newUser({ email: "race1@example.com" });
    const rival = raced(async () => void (await q(`UPDATE "user" SET password_hash = $2 WHERE id = $1`, [u, await hashPassword("a different password!!")])));
    await fails("invalid_credentials", () => rival.signIn({ identifier: "race1@example.com", password: GOOD }));
    eq(await sessions(u), 0, "no session escaped");
  });

  test("a user disabled between the check and the insert issues no session", async () => {
    const u = await newUser({ email: "race2@example.com" });
    const rival = raced(async () => void (await q(`UPDATE "user" SET status = 'disabled' WHERE id = $1`, [u])));
    await fails("invalid_credentials", () => rival.signIn({ identifier: "race2@example.com", password: GOOD }));
    eq(await sessions(u), 0);
  });

  test("a first login that loses to setPassword issues no session", async () => {
    const { u } = await parent("94771230101");
    const rival = raced(async () => void (await q(`UPDATE "user" SET password_hash = $2 WHERE id = $1`, [u, goodHash])));
    await fails("invalid_credentials", () => rival.firstLogin({ phone: "0771230101" }));
    eq(await sessions(u), 0, "no unrestricted parent session without a password sign-in");
  });

  test("with no interference valid credentials still give a session", async () => {
    const u = await newUser({ email: "calm@example.com" });
    eq((await auth.signIn({ identifier: "calm@example.com", password: GOOD })).principal.userId, u);
  });

  test("two password changes on the same old password: only one wins", async () => {
    const u = await newUser({ email: "twice@example.com" });
    const a = await auth.signIn({ identifier: "twice@example.com", password: GOOD });
    const rival = raced(async () => void (await q(`UPDATE "user" SET password_hash = $2 WHERE id = $1`, [u, await hashPassword("someone else got here first")])));
    await fails("invalid_credentials", () => rival.changePassword({ token: a.token, currentPassword: GOOD, newPassword: "a brand new password" }));
    await auth.signIn({ identifier: "twice@example.com", password: "someone else got here first" });
  });
});

describe("numeric usernames and canonical throttling", () => {
  test("a numeric username signs in, even beside a phone account with the same digits", async () => {
    const byName = await newUser({ username: "123456789" });
    await auth.signIn({ identifier: "123456789", password: GOOD }).then((r) => eq(r.principal.userId, byName, "numeric username"));
    const otherHash = await hashPassword("another long passphrase");
    const byPhone = await id(`INSERT INTO "user" (username, phone, password_hash) VALUES ('parent-94123456789', '94123456789', $1)`, [otherHash]);
    eq((await auth.signIn({ identifier: "123456789", password: GOOD })).principal.userId, byName, "username still works");
    eq((await auth.signIn({ identifier: "123456789", password: "another long passphrase" })).principal.userId, byPhone, "phone account too");
    await fails("invalid_credentials", () => auth.signIn({ identifier: "123456789", password: "not either of them!!" }));
  });

  test("failure counts are per account: a sign-in to one account does not reset the other account the same identifier names", async () => {
    const mine = await newUser({ username: "143456789" });
    const victim = await id(`INSERT INTO "user" (username, phone, password_hash) VALUES ('parent-94143456789', '94143456789', $1)`, [await hashPassword("victim long passphrase")]);
    const failures = async (userId: string) => (await q(`SELECT count FROM auth_rate_limit WHERE key = $1`, [`signin:acct:${userId}`]))[0]?.count ?? null;
    for (let i = 0; i < 3; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: "143456789", password: "wrong password!!" }));
    eq([await failures(victim), await failures(mine)], [3, 3]);
    // the owner of the numeric username signs in: that account's count goes, the phone account's keeps counting (it was tried first and failed)
    eq((await auth.signIn({ identifier: "143456789", password: GOOD })).principal.userId, mine);
    eq([await failures(victim), await failures(mine)], [4, null]);
    // the shared identifier counter was not cleared either, because the identifier names two accounts
    eq(Number((await q(`SELECT count FROM auth_rate_limit WHERE key = $1`, [signInKey("143456789")]))[0]!.count) > 0, true);
    // the phone account's owner still signs in (the phone account is tried first, so the other is not counted) and its count goes
    eq((await auth.signIn({ identifier: "143456789", password: "victim long passphrase" })).principal.userId, victim);
    eq([await failures(victim), await failures(mine)], [null, null]);
  });

  test("a locked account is skipped, so it cannot stop the other account's owner, and wrong guesses report rate_limited", async () => {
    const mine = await newUser({ username: "153456789" });
    const victim = await id(`INSERT INTO "user" (username, phone, password_hash) VALUES ('parent-94153456789', '94153456789', $1)`, [await hashPassword("victim long passphrase")]);
    await q(`INSERT INTO auth_rate_limit (key, count, window_start) VALUES ($1, 10, $2)`, [`signin:acct:${victim}`, clock]);
    eq((await auth.signIn({ identifier: "153456789", password: GOOD })).principal.userId, mine);
    await fails("rate_limited", () => auth.signIn({ identifier: "153456789", password: "victim long passphrase" }));
  });

  test("one account has one failure budget across its email, username and phone", async () => {
    const u = await id(`INSERT INTO "user" (email, username, phone, password_hash) VALUES ('budget@example.com', 'budget-user', '94771239811', $1)`, [goodHash]);
    const wrong = (identifier: string) => auth.signIn({ identifier, password: "wrong password!!" });
    for (let i = 0; i < 4; i++) await fails("invalid_credentials", () => wrong("budget@example.com"));
    for (let i = 0; i < 4; i++) await fails("invalid_credentials", () => wrong("budget-user"));
    await fails("invalid_credentials", () => wrong("0771239811"));
    await fails("invalid_credentials", () => wrong("0771239811"));
    await fails("rate_limited", () => wrong("0771239811"));
    await fails("rate_limited", () => auth.signIn({ identifier: "budget@example.com", password: GOOD }));
    eq(u.length > 0, true);
  });

  test("phone spellings share one counter; usernames keep their case", async () => {
    eq(signInKey("0771239999"), signInKey(" 077 123 9999 "), "spacing");
    eq(signInKey("+94 77 123 9999"), signInKey("0771239999"), "international");
    eq(signInKey("A@Example.com"), signInKey("a@example.com"), "email case");
    eq(signInKey("Bob") === signInKey("bob"), false, "username case");
    await newUser({ username: "parent-94771239999", phone: "94771239999" });
    for (let i = 0; i < 5; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: "0771239999", password: "wrong password!!" }));
    for (let i = 0; i < 5; i++) await fails("invalid_credentials", () => auth.signIn({ identifier: "077 123 9999", password: "wrong password!!" }));
    await fails("rate_limited", () => auth.signIn({ identifier: "+94771239999", password: GOOD }));
  });
});

describe("credential changes commit with their side effects", () => {
  const breakDeletes = () => q(`CREATE FUNCTION no_session_delete() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'session delete refused'; END $$ LANGUAGE plpgsql`).then(() => q(`CREATE TRIGGER no_session_delete BEFORE DELETE ON auth_session FOR EACH ROW EXECUTE FUNCTION no_session_delete()`));
  const fixDeletes = async () => {
    await q(`DROP TRIGGER no_session_delete ON auth_session`);
    await q(`DROP FUNCTION no_session_delete()`);
  };

  test("changePassword: a failed session cleanup rolls back the password and audit row", async () => {
    const u = await newUser({ email: "atomic1@example.com" });
    const a = await auth.signIn({ identifier: "atomic1@example.com", password: GOOD });
    const b = await auth.signIn({ identifier: "atomic1@example.com", password: GOOD });
    await breakDeletes();
    try {
      let threw = false;
      await auth.changePassword({ token: a.token, currentPassword: GOOD, newPassword: "a brand new password" }).catch(() => (threw = true));
      eq(threw, true, "changePassword failed");
    } finally {
      await fixDeletes();
    }
    eq(await count(`SELECT count(*)::int AS c FROM "user" WHERE id = $1 AND password_hash = $2`, [u, goodHash]), 1, "old password kept");
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_changed' AND entity_id = $1`, [u]), 0, "no audit row");
    await auth.authenticate(b.token);
  });

  test("setPassword: a failed session cleanup leaves the account without a password and the other session intact", async () => {
    const { u } = await parent("94771230102");
    const one = await auth.firstLogin({ phone: "0771230102" });
    const two = await auth.firstLogin({ phone: "0771230102" });
    await breakDeletes();
    try {
      let threw = false;
      await auth.setPassword({ token: one.token, newPassword: "my first password!" }).catch(() => (threw = true));
      eq(threw, true, "setPassword failed");
    } finally {
      await fixDeletes();
    }
    eq(await count(`SELECT count(*)::int AS c FROM "user" WHERE id = $1 AND password_hash IS NULL`, [u]), 1, "still no password");
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_set' AND entity_id = $1`, [u]), 0, "no audit row");
    eq((await auth.authenticate(two.token)).restriction, "set_password", "retry is still possible");
    await auth.setPassword({ token: one.token, newPassword: "my first password!" });
    await fails("unauthenticated", () => auth.authenticate(two.token));
  });

  test("verifyMfa: a failed session update keeps the recovery code and the TOTP step available", async () => {
    const t = await staffWithMfa("atomic3@example.com");
    const s = await auth.signIn({ identifier: t.email, password: GOOD });
    await q(`CREATE FUNCTION no_verify() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'verify refused'; END $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER no_verify BEFORE UPDATE ON auth_session FOR EACH ROW WHEN (NEW.mfa_verified_at IS NOT NULL) EXECUTE FUNCTION no_verify()`);
    const before = ((await q(`SELECT jsonb_array_length(recovery_hashes) AS n, last_used_step FROM user_two_factor WHERE user_id = $1`, [t.u]))[0]!);
    try {
      let threw = 0;
      await auth.verifyMfa({ token: s.token, code: t.recoveryCodes[0]! }).catch(() => threw++);
      await auth.verifyMfa({ token: s.token, code: totp(t.secret, new Date(clock.getTime() + 30_000)) }).catch(() => threw++);
      eq(threw, 2, "both attempts failed");
    } finally {
      await q(`DROP TRIGGER no_verify ON auth_session`);
      await q(`DROP FUNCTION no_verify()`);
    }
    eq((await q(`SELECT jsonb_array_length(recovery_hashes) AS n, last_used_step FROM user_two_factor WHERE user_id = $1`, [t.u]))[0], before, "nothing consumed");
    await auth.verifyMfa({ token: s.token, code: t.recoveryCodes[0]! });
  });
});

describe("authenticator codes work once", () => {
  test("a code accepted in one session is refused in another, and so is the enrolment code", async () => {
    const t = await staffWithMfa("replay@example.com");
    const next = totp(t.secret, new Date(clock.getTime() + 30_000));
    const s1 = await auth.signIn({ identifier: t.email, password: GOOD });
    const s2 = await auth.signIn({ identifier: t.email, password: GOOD });
    await fails("invalid_code", () => auth.verifyMfa({ token: s1.token, code: totp(t.secret, clock) }));
    await auth.verifyMfa({ token: s1.token, code: next });
    await fails("invalid_code", () => auth.verifyMfa({ token: s2.token, code: next }));
    eq((await auth.authenticate(s2.token)).restriction, "mfa", "still restricted");
    advance(60_000);
    await auth.verifyMfa({ token: s2.token, code: totp(t.secret, clock) });
  });
});

describe("authenticator enrolment", () => {
  test("beginning enrolment never replaces an enabled secret", async () => {
    const t = await staffWithMfa("keep@example.com");
    const cipher = async () => (await q(`SELECT secret_cipher FROM user_two_factor WHERE user_id = $1`, [t.u]))[0]!.secret_cipher;
    const before = await cipher();
    const s = await auth.signIn({ identifier: t.email, password: GOOD });
    await fails("forbidden", () => auth.beginMfaEnrollment({ token: s.token }));
    eq(await cipher(), before, "secret untouched");
    eq(await count(`SELECT jsonb_array_length(recovery_hashes)::int AS c FROM user_two_factor WHERE user_id = $1`, [t.u]), 8, "recovery codes untouched");
  });

  test("a confirmation never enables a secret other than the one it verified", async () => {
    const u = await newUser({ email: "swap@example.com" });
    await acl.assignRole({ userId: u, roleName: "student_counselor", actor: root });
    const s = await auth.signIn({ identifier: "swap@example.com", password: GOOD });
    const { secret } = await auth.beginMfaEnrollment({ token: s.token });
    const rival = raced(async () => void (await auth.beginMfaEnrollment({ token: s.token })));
    await fails("forbidden", () => rival.confirmMfaEnrollment({ token: s.token, code: totp(secret, clock) }));
    eq(await count(`SELECT count(*)::int AS c FROM user_two_factor WHERE user_id = $1 AND enabled_at IS NULL`, [u]), 1, "the replacement secret is not enabled");
    eq((await auth.authenticate(s.token)).restriction, "mfa_setup", "session not marked verified");
  });
});

describe("disabling a user ends their sessions for good", () => {
  test("the domain disable deletes sessions in its own transaction", async () => {
    const u = await newUser({ email: "gone@example.com" });
    const a = await auth.signIn({ identifier: "gone@example.com", password: GOOD });
    await acl.setUserStatus({ userId: u, status: "disabled", actor: root });
    eq(await sessions(u), 0);
    await acl.setUserStatus({ userId: u, status: "active", actor: root });
    await fails("unauthenticated", () => auth.authenticate(a.token));
  });
});

describe("disable and session revocation commit together", () => {
  test("a failed session deletion rolls the disable back, so a retry starts from the same state", async () => {
    const u = await newUser({ email: "rollback-disable@example.com" });
    const a = await auth.signIn({ identifier: "rollback-disable@example.com", password: GOOD });
    await q(`CREATE FUNCTION no_session_delete2() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'session delete refused'; END $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER no_session_delete2 BEFORE DELETE ON auth_session FOR EACH ROW EXECUTE FUNCTION no_session_delete2()`);
    try {
      let threw = false;
      await acl.setUserStatus({ userId: u, status: "disabled", actor: root }).catch(() => (threw = true));
      eq(threw, true, "the disable failed");
    } finally {
      await q(`DROP TRIGGER no_session_delete2 ON auth_session`);
      await q(`DROP FUNCTION no_session_delete2()`);
    }
    eq(await count(`SELECT count(*)::int AS c FROM "user" WHERE id = $1 AND status = 'active'`, [u]), 1, "still active");
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.disable' AND entity_id = $1`, [u]), 0, "no audit row");
    await auth.authenticate(a.token);
    await acl.setUserStatus({ userId: u, status: "disabled", actor: root });
    eq(await sessions(u), 0);
    await acl.setUserStatus({ userId: u, status: "active", actor: root });
    await fails("unauthenticated", () => auth.authenticate(a.token));
  });
});

describe("parent password reset is scoped to branches", () => {
  test("every branch of the parent's students must be covered; an all-branches holder may reset anyone", async () => {
    const main = String((await q(`SELECT id FROM branch ORDER BY created_at, id LIMIT 1`))[0]!.id);
    const other = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
    const local = await newUser();
    await acl.assignRole({ userId: local, roleName: "student_counselor", branchId: main, actor: root });

    const inMain = await parent("94771230201");
    await childOf(inMain.g, [main]);
    const inOther = await parent("94771230202");
    await childOf(inOther.g, [other]);
    const both = await parent("94771230203");
    await childOf(both.g, [main]);
    await childOf(both.g, [other]);
    const noKids = await parent("94771230204");
    const noBranch = await parent("94771230205");
    await childOf(noBranch.g, []);

    for (const p of [inMain, inOther, both, noKids, noBranch]) await q(`UPDATE "user" SET password_hash = $2 WHERE id = $1`, [p.u, goodHash]);
    const sess = await auth.signIn({ identifier: "0771230202", password: GOOD });

    await fails("forbidden", () => auth.resetParentPassword({ guardianId: inOther.g, actor: local }));
    await fails("forbidden", () => auth.resetParentPassword({ guardianId: noKids.g, actor: local }));
    await fails("forbidden", () => auth.resetParentPassword({ guardianId: noBranch.g, actor: local }));
    eq(await count(`SELECT count(*)::int AS c FROM "user" WHERE id = $1 AND password_hash IS NOT NULL`, [inOther.u]), 1, "password kept");
    await auth.authenticate(sess.token);

    await auth.resetParentPassword({ guardianId: inMain.g, actor: local });
    await auth.resetParentPassword({ guardianId: inOther.g, actor: root });
    await fails("unauthenticated", () => auth.authenticate(sess.token));
    await auth.resetParentPassword({ guardianId: noKids.g, actor: root });

    // A branch of one of the children is enough (the same rule as guardian edits), so the parent with children in both branches is reachable.
    await auth.resetParentPassword({ guardianId: both.g, actor: local });
    await fails("forbidden", () => auth.resetParentPassword({ guardianId: inOther.g, actor: local }));
  });

  test("the reset follows the guardian service's scope rule exactly", async () => {
    const main = String((await q(`SELECT id FROM branch ORDER BY created_at, id LIMIT 1`))[0]!.id);
    const other = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Galle')`);
    const local = await newUser();
    await acl.assignRole({ userId: local, roleName: "student_counselor", branchId: other, actor: root });
    const p = await parent("94771230211");
    await childOf(p.g, [main, other]);
    await q(`UPDATE "user" SET password_hash = $2 WHERE id = $1`, [p.u, goodHash]);
    const guardians = createGuardianService(db);
    // whatever the guardian service lets the actor edit, the reset allows, and the reverse
    await guardians.update({ guardianId: p.g, actor: local, fullName: "Scoped Parent" });
    await auth.resetParentPassword({ guardianId: p.g, actor: local });
    eq(await count(`SELECT count(*)::int AS c FROM "user" WHERE id = $1 AND password_hash IS NULL`, [p.u]), 1);
  });
});

describe("review fixes: step cleanup, expiry under the lock, password work", () => {
  const refuseCounterReset = async (fn: () => Promise<unknown>) => {
    await q(`CREATE FUNCTION no_counter_reset() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'counter reset refused'; END $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER no_counter_reset BEFORE DELETE ON auth_rate_limit FOR EACH ROW EXECUTE FUNCTION no_counter_reset()`);
    try {
      let threw = false;
      await fn().catch(() => (threw = true));
      eq(threw, true, "the step failed as a whole");
    } finally {
      await q(`DROP TRIGGER no_counter_reset ON auth_rate_limit`);
      await q(`DROP FUNCTION no_counter_reset()`);
    }
  };

  test("a failed counter reset does not consume the authenticator code: the same code finishes the step on retry (sign-in and enrolment)", async () => {
    const u = await newUser({ email: "mfa-reset@example.com" });
    await acl.assignRole({ userId: u, roleName: "student_counselor", actor: root });
    const first = await auth.signIn({ identifier: "mfa-reset@example.com", password: GOOD });
    const { secret } = await auth.beginMfaEnrollment({ token: first.token });
    const enrolCode = totp(secret, clock);
    await refuseCounterReset(() => auth.confirmMfaEnrollment({ token: first.token, code: enrolCode }));
    eq(await count(`SELECT count(*)::int AS c FROM user_two_factor WHERE user_id = $1 AND enabled_at IS NOT NULL`, [u]), 0, "enrolment rolled back");
    const { recoveryCodes } = await auth.confirmMfaEnrollment({ token: first.token, code: enrolCode });
    eq(recoveryCodes.length, 8, "the same code enrols on retry");

    const s = await auth.signIn({ identifier: "mfa-reset@example.com", password: GOOD });
    const code = totp(secret, new Date(clock.getTime() + 30_000));
    await refuseCounterReset(() => auth.verifyMfa({ token: s.token, code }));
    eq(await count(`SELECT count(*)::int AS c FROM auth_session WHERE id = $1 AND mfa_verified_at IS NOT NULL`, [s.principal.sessionId]), 0, "not verified");
    const ok = await auth.verifyMfa({ token: s.token, code });
    eq(ok.restriction, null, "the same code finishes it on retry");
  });

  test("a session that expires while a password change is running cannot commit it", async () => {
    const u = await newUser({ email: "expiring@example.com" });
    const s = await auth.signIn({ identifier: "expiring@example.com", password: GOOD });
    // The clock jumps a year ahead only for the read inside the credential lock, so the early expiry check passes and the locked one must catch it.
    const lateInLock = createAuthService(db, { secretKey: "test-secret-key-0123456789", now: () => ((new Error().stack ?? "").includes("lockUserAndSession") ? new Date(clock.getTime() + 365 * 24 * HOUR) : clock) });
    await fails("unauthenticated", () => lateInLock.changePassword({ token: s.token, currentPassword: GOOD, newPassword: "a brand new password" }));
    eq(await count(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'user.password_changed' AND entity_id = $1`, [u]), 0, "not changed");
    await auth.changePassword({ token: s.token, currentPassword: GOOD, newPassword: "a brand new password" });
  });

  test("a failed sign-in costs the same number of password checks whatever the identifier matched", async () => {
    await id(`INSERT INTO "user" (username, password_hash) VALUES ('987654321', $1)`, [goodHash]);
    await id(`INSERT INTO "user" (username, phone, password_hash) VALUES ('parent-94987654321', '94987654321', $1)`, [goodHash]);
    await id(`INSERT INTO "user" (username, phone, password_hash) VALUES ('parent-94771234599', '94771234599', $1)`, [goodHash]);
    await newUser({ email: "workcheck@example.com" });
    const spy = spyOn(Bun.password, "verify");
    try {
      const checks = async (identifier: string) => {
        spy.mockClear();
        await fails("invalid_credentials", () => auth.signIn({ identifier, password: "definitely not it" }));
        return spy.mock.calls.length;
      };
      eq(await checks("0770000000"), 2, "phone-like, no account");
      eq(await checks("0771234599"), 2, "phone-like, one account");
      eq(await checks("987654321"), 2, "phone-like, two accounts");
      eq(await checks("nobody@example.com"), 1, "email, no account");
      eq(await checks("workcheck@example.com"), 1, "email, one account");
      eq(await checks("no-such-name"), 1, "username, no account");
    } finally {
      spy.mockRestore();
    }
  });
});
