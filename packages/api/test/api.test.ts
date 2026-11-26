/**
 * HTTP API: cookies, CSRF guard, error mapping, sign-in steps, branch-scoped admin routes, portals.
 */
import { afterAll, describe, test } from "bun:test";
import { createApi, withPeerAddress } from "../src";
import { createAuthService, hashPassword, totp } from "@workspace/auth";
import { createAccessControlService, createContentService, createAttendanceService, createEnrollmentService, createExamService, createFeeExceptionService, createCommissionRuleService, createGuardianService, createNoticeService, createPayoutService, createReportService, createPromotionService, createPaymentService, createStudentService, hmacSigner } from "@workspace/domain";
import { eq } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

const now = () => new Date("2027-03-10T10:00:00Z");
await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = '{"parent_portal": true, "content_store": true, "online_exams": true, "commissions": true, "lecturer_portal": true}'::jsonb`);
// The auth clock moves forward 30 s for each authenticator code, because a code is accepted only once per 30-second step.
let authAt = now();
const authNow = () => authAt;
const auth = createAuthService(db, { secretKey: "test-secret-key-0123456789", now: authNow });
const acl = createAccessControlService(db);
const content = createContentService(db, { now });
const notices = createNoticeService(db, { now });
const reports = createReportService(db, { now });
const guardians = createGuardianService(db, { now });
const commissionRules = createCommissionRuleService(db, { now });
const payments = createPaymentService(db, { signer: hmacSigner("s"), now, hooks: content.hooks });
const students = createStudentService(db, { now });
const enrollment = createEnrollmentService(db, { now });
const attendance = createAttendanceService(db, { now });
const exams = createExamService(db, { now });
const feeExceptions = createFeeExceptionService(db, { now });
const promotion = createPromotionService(db, { now });
const payouts = createPayoutService(db, { now });
const ORIGIN = "https://admin.example.test";
const app = createApi({ db, auth, acl, payments, content, notices, reports, guardians, commissionRules, students, enrollment, attendance, exams, feeExceptions, promotion, payouts, config: { trustedOrigins: [ORIGIN], secureCookie: true } });

type Res = { status: number; json: any; cookie: string | null };
async function call(method: string, path: string, opts: { body?: unknown; cookie?: string | null; origin?: string | null; raw?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.origin !== null && method !== "GET") headers.origin = opts.origin ?? ORIGIN;
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined || opts.raw !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(path, { method, headers, body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)) });
  const set = res.headers.get("set-cookie");
  return { status: res.status, json: await res.json().catch(() => null), cookie: set ? set.split(";")[0]! : null };
}
const get = (path: string, cookie?: string | null) => call("GET", path, { cookie });
const post = (path: string, body?: unknown, cookie?: string | null) => call("POST", path, { body, cookie });

const GOOD = "correct horse battery";
const goodHash = await hashPassword(GOOD);
let n = 0;
const newUser = (extra: { phone?: string; username?: string; password?: boolean } = {}) =>
  id(`INSERT INTO "user" (email, username, phone, password_hash) VALUES ($1,$2,$3,$4)`, [extra.username ? null : `api${++n}@example.com`, extra.username ?? null, extra.phone ?? null, extra.password === false ? null : goodHash]);
const emailOf = async (userId: string) => String((await q(`SELECT email FROM "user" WHERE id = $1`, [userId]))[0]!.email);

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const root = await newUser();
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });

/** Signs in over HTTP and, for staff, enrols and confirms an authenticator, so the cookie opens the admin portal. */
const secrets = new Map<string, string>();
async function staffCookie(userId: string): Promise<string> {
  const s = await post("/auth/sign-in", { identifier: await emailOf(userId), password: GOOD });
  const cookie = s.cookie!;
  const known = secrets.get(userId);
  if (known) {
    authAt = new Date(authAt.getTime() + 30_000);
    eq((await post("/auth/mfa/verify", { code: totp(known, authNow()) }, cookie)).status, 200);
    return cookie;
  }
  const { secret } = (await post("/auth/mfa/begin", undefined, cookie)).json;
  secrets.set(userId, secret);
  eq((await post("/auth/mfa/confirm", { code: totp(secret, authNow()) }, cookie)).status, 200);
  return cookie;
}
const plainCookie = async (userId: string) => (await post("/auth/sign-in", { identifier: await emailOf(userId), password: GOOD })).cookie!;

describe("guards and errors", () => {
  test("health works; a write from a foreign origin is refused; a missing origin from curl is fine", async () => {
    eq((await get("/health")).json, { ok: true });
    const evil = await call("POST", "/auth/sign-in", { body: { identifier: "a@b.c", password: "x" }, origin: "https://evil.test" });
    eq([evil.status, evil.json.error.code], [403, "bad_origin"]);
    const none = await call("POST", "/auth/sign-in", { body: { identifier: "a@b.c", password: "x" }, origin: null });
    eq(none.status, 401);
  });

  test("an empty trusted-origin list is refused at start-up", () => {
    let err: unknown;
    try {
      createApi({ db, auth, acl, payments, content, notices, reports, guardians, commissionRules, students, enrollment, attendance, exams, feeExceptions, promotion, payouts, config: { trustedOrigins: [] } });
    } catch (e) {
      err = e;
    }
    eq(err instanceof Error, true);
  });

  test("bad bodies are 400; unknown routes are 404; nothing leaks from unexpected errors", async () => {
    const a = await call("POST", "/auth/sign-in", { raw: "{not json" });
    eq([a.status, a.json.error.code], [400, "invalid_json"]);
    const b = await post("/auth/sign-in", { identifier: 5 });
    eq([b.status, b.json.error.code], [400, "invalid_request"]);
    eq((await get("/nope")).status, 404);
  });

  test("an oversized JSON body is 413 before it is parsed, on a public route and on the larger-limit routes", async () => {
    const huge = JSON.stringify({ identifier: "a".repeat(70 * 1024), password: "x" });
    const a = await call("POST", "/auth/sign-in", { raw: huge });
    eq([a.status, a.json.error.code], [413, "payload_too_large"]);
    // Under the default limit it reaches validation as before.
    const b = await call("POST", "/auth/sign-in", { raw: JSON.stringify({ identifier: "a".repeat(1000), password: "x" }) });
    eq(b.status === 413, false);
    // A route that checks the session first never reads the body of a signed-out caller.
    const c = await call("POST", "/admin/attendance/sessions/00000000-0000-4000-8000-000000000000/mark", { raw: huge, cookie: null });
    eq(c.status, 401);
  });
});

describe("sign-in over HTTP", () => {
  test("sets an httpOnly, secure cookie; /me needs it; sign-out ends it", async () => {
    const u = await newUser();
    const res = await app.request("/auth/sign-in", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ identifier: await emailOf(u), password: GOOD }) });
    const set = res.headers.get("set-cookie")!;
    eq(res.status, 200);
    eq([/sms_session=/.test(set), /HttpOnly/i.test(set), /Secure/i.test(set), /SameSite=Lax/i.test(set)], [true, true, true, true]);
    const cookie = set.split(";")[0]!;
    const me = await get("/auth/me", cookie);
    eq([me.status, me.json.userId], [200, u]);
    eq((await get("/auth/me")).status, 401);
    const out = await post("/auth/sign-out", undefined, cookie);
    eq(out.status, 200);
    eq((await get("/auth/me", cookie)).status, 401);
  });

  test("wrong details are 401 and the ninth further failure is 429", async () => {
    const u = await newUser();
    const email = await emailOf(u);
    const bad = await post("/auth/sign-in", { identifier: email, password: "wrong password!!" });
    eq([bad.status, bad.json.error.code, bad.cookie], [401, "invalid_credentials", null]);
    for (let i = 0; i < 9; i++) await post("/auth/sign-in", { identifier: email, password: "wrong password!!" });
    eq((await post("/auth/sign-in", { identifier: email, password: GOOD })).status, 429);
  });

  test("change-password works over HTTP and needs the current password", async () => {
    const u = await newUser();
    const cookie = await plainCookie(u);
    eq((await post("/auth/change-password", { currentPassword: "wrong password!!", newPassword: "a brand new password" }, cookie)).status, 401);
    eq((await post("/auth/change-password", { currentPassword: GOOD, newPassword: "a brand new password" }, cookie)).status, 200);
  });
});

describe("admin portal", () => {
  test("staff need the second step before anything opens; people who are not staff never get in", async () => {
    const u = await newUser();
    await acl.assignRole({ userId: u, roleName: "payment_handler", branchId: b1, actor: root });
    const s = await post("/auth/sign-in", { identifier: await emailOf(u), password: GOOD });
    eq(s.json.restriction, "mfa_setup");
    const early = await get("/admin/payments", s.cookie);
    eq([early.status, early.json.error.code], [403, "mfa_setup_required"]);
    // Half signed in: the password cannot be changed yet, but the enrolment route stays open.
    const early2 = await post("/auth/change-password", { currentPassword: GOOD, newPassword: "a brand new password" }, s.cookie);
    eq([early2.status, early2.json.error.code], [403, "mfa_setup_required"]);
    eq((await post("/auth/mfa/begin", {}, s.cookie)).status, 200);
    const cookie = await staffCookie(u);
    eq((await get("/admin/payments", cookie)).status, 200);
    eq((await get("/admin/payments")).status, 401);

    const nobody = await newUser();
    const plain = await plainCookie(nobody);
    const r = await get("/admin/payments", plain);
    eq([r.status, r.json.error.code], [403, "forbidden"]);
  });

  test("payments are scoped to the caller's branches and verified once", async () => {
    const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Silva')`);
    const stu = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('API1','Kid','2014-05-01')`);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [stu, b1]);
    const item = await content.createItem({ lecturerId: lec, kind: "recording", title: "Paid", externalUrl: "https://youtu.be/abc", accessType: "paid", price: "500.00", branchIds: [b1] });
    await content.setStatus({ actor: root, contentId: item.id, status: "published" });
    const purchase = await content.purchase({ contentId: item.id, studentId: stu });
    const method = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
    const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1,'BOC','T','1')`, [b1]);
    const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/api.jpg','image/jpeg',10)`);
    const pending = await payments.submitPayment({ studentId: stu, branchId: b1, paymentMethodId: method, bankAccountId: bank, slipFileId: slip, amount: "500.00", paidOn: "2027-03-10", referenceNo: "API-1", submittedBy: root, invoiceIds: [purchase.invoiceId!] } as never);

    const here = await newUser();
    const there = await newUser();
    await acl.assignRole({ userId: here, roleName: "payment_handler", branchId: b1, actor: root });
    await acl.assignRole({ userId: there, roleName: "payment_handler", branchId: b2, actor: root });
    const hereCookie = await staffCookie(here);
    const thereCookie = await staffCookie(there);

    eq((await get("/admin/payments", hereCookie)).json.payments.map((p: { id: string }) => p.id), [pending.id]);
    eq((await get("/admin/payments", thereCookie)).json.payments, []);
    const denied = await post(`/admin/payments/${pending.id}/verify`, {}, thereCookie);
    eq([denied.status, denied.json.error.code], [403, "forbidden"]);
    eq((await post(`/admin/payments/${pending.id}/reject`, { reason: "no" }, hereCookie)).status, 400);

    const ok = await post(`/admin/payments/${pending.id}/verify`, {}, hereCookie);
    eq(ok.status, 200);
    eq(typeof ok.json.receiptNo, "string");
    const again = await post(`/admin/payments/${pending.id}/verify`, {}, hereCookie);
    eq([again.status, again.json.error.code], [409, "payment_not_pending"]);
    eq((await get("/admin/payments?status=verified", hereCookie)).json.payments.length, 1);

    const noVoid = await post(`/admin/payments/${pending.id}/void`, { reason: "mistake" }, hereCookie);
    eq([noVoid.status, noVoid.json.error.code], [403, "forbidden"]);
    const rootCookie = await staffCookie(root);
    eq((await post(`/admin/payments/${pending.id}/void`, { reason: "mistake" }, rootCookie)).status, 200);
    eq((await post(`/admin/payments/${await id(`SELECT gen_random_uuid() AS id`).catch(() => "00000000-0000-0000-0000-000000000000")}/verify`, {}, rootCookie)).status, 404);
  });

  test("roles: only roles.manage can assign; disabling a user ends their session", async () => {
    const target = await newUser();
    const counselor = await newUser();
    await acl.assignRole({ userId: counselor, roleName: "student_counselor", actor: root });
    const counselorCookie = await staffCookie(counselor);
    const refused = await post("/admin/roles/assign", { userId: target, roleName: "attendance_marker", branchId: b1 }, counselorCookie);
    eq([refused.status, refused.json.error.code], [403, "forbidden"]);

    const rootCookie = await staffCookie(root);
    eq((await post("/admin/roles/assign", { userId: target, roleName: "attendance_marker", branchId: b1 }, rootCookie)).json.created, true);
    eq((await post("/admin/roles/revoke", { userId: target, roleName: "attendance_marker", branchId: b1 }, rootCookie)).json.revoked, true);
    const last = await post("/admin/roles/revoke", { userId: root, roleName: "root_admin" }, rootCookie);
    eq([last.status, last.json.error.code], [409, "last_root_admin"]);

    eq((await get("/admin/payments", counselorCookie)).status, 403);
    eq((await post(`/admin/users/${counselor}/status`, { status: "disabled" }, rootCookie)).json.status, "disabled");
    eq((await get("/auth/me", counselorCookie)).status, 401);
    // enabling again must not bring the old session back
    eq((await post(`/admin/users/${counselor}/status`, { status: "active" }, rootCookie)).json.status, "active");
    eq((await get("/auth/me", counselorCookie)).status, 401);
    // a root administrator cannot reset their own second step by writing their id in upper case
    const self = await post(`/admin/users/${root.toUpperCase()}/reset-mfa`, {}, rootCookie);
    eq([self.status, self.json.error.code], [403, "forbidden"]);
  });
});

describe("portals", () => {
  test("a student sees their own library; a parent signs in with the phone, sets a password, then sees only their child", async () => {
    const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Ms Perera')`);
    const free = await content.createItem({ lecturerId: lec, kind: "recording", title: "Free lesson", externalUrl: "https://youtu.be/free", accessType: "free_registered", branchIds: [b1] });
    await content.setStatus({ actor: root, contentId: free.id, status: "published" });

    const su = await newUser();
    const stu = await id(`INSERT INTO student (student_no, full_name, date_of_birth, user_id) VALUES ('API2','Mine','2012-01-01',$1)`, [su]);
    const otherStu = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('API3','Other','2012-01-01')`);
    for (const s of [stu, otherStu]) await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [s, b1]);
    const sc = await plainCookie(su);
    const lib = await get("/student/content", sc);
    eq(lib.status, 200);
    eq(JSON.stringify(lib.json).includes(free.id), true);
    eq((await get(`/student/content/${free.id}`, sc)).json.title, "Free lesson");
    eq((await get("/parent/children", sc)).status, 403);

    const pu = await newUser({ username: "parent-94771239000", phone: "94771239000", password: false });
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Parent','94771239000',$1,true)`, [pu]);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, relationship, is_primary) VALUES ($1,$2,'mother',true)`, [stu, g]);

    const first = await post("/auth/first-login", { phone: "077 123 9000" });
    eq([first.status, first.json.restriction], [200, "set_password"]);
    const blocked = await get("/parent/children", first.cookie);
    eq([blocked.status, blocked.json.error.code], [403, "password_setup_required"]);
    eq((await post("/auth/set-password", { newPassword: "short" }, first.cookie)).status, 400);
    const done = await post("/auth/set-password", { newPassword: "my new password 1" }, first.cookie);
    eq([done.status, done.json.restriction], [200, null]);

    const kids = await get("/parent/children", first.cookie);
    eq(kids.json.children.map((c: { id: string }) => c.id), [stu]);
    eq((await get(`/parent/children/${stu}/content`, first.cookie)).status, 200);
    const other = await get(`/parent/children/${otherStu}/content`, first.cookie);
    eq([other.status, other.json.error.code], [403, "forbidden"]);
    eq((await get("/admin/payments", first.cookie)).status, 403);
    eq((await post("/auth/first-login", { phone: "0771239000" })).status, 401);
  });
});

describe("students, enrolments and invoices", () => {
  const body = (over: Record<string, unknown> = {}) => ({ branchId: b1, fullName: "Nimal Fernando", dateOfBirth: "1995-02-02", ...over });

  test("registering needs students.create in the branch; lists and records follow the branch", async () => {
    const c1 = await newUser();
    const c2 = await newUser();
    const outsider = await newUser();
    await acl.assignRole({ userId: c1, roleName: "student_counselor", branchId: b1, actor: root });
    await acl.assignRole({ userId: c2, roleName: "student_counselor", branchId: b2, actor: root });
    const k1 = await staffCookie(c1);
    const k2 = await staffCookie(c2);

    const made = await post("/admin/students", body({ fullName: "Route Student One" }), k1);
    eq(made.status, 201);
    eq(/^STU-\d{6}$/.test(made.json.student.studentNo), true);
    const sid = made.json.student.id as string;
    const wrongBranch = await post("/admin/students", body({ branchId: b2 }), k1);
    eq([wrongBranch.status, wrongBranch.json.error.code], [403, "forbidden"]);
    eq((await post("/admin/students", { fullName: "x" }, k1)).status, 400);
    const young = await post("/admin/students", body({ dateOfBirth: "2018-01-01" }), k1);
    eq([young.status, young.json.error.code], [422, "guardian_required"]);
    const withParent = await post("/admin/students", body({ fullName: "Route Kid", dateOfBirth: "2018-01-01", guardians: [{ fullName: "Mum", phone: "0771110077", address: "Kandy" }] }), k1);
    eq([withParent.status, withParent.json.guardians.length], [201, 1]);

    eq((await get("/admin/students?q=Route Student", k1)).json.students.map((s: { id: string }) => s.id), [sid]);
    eq((await get("/admin/students?q=Route Student", k2)).json.students, []);
    eq((await get(`/admin/students/${sid}`, k1)).json.student.fullName, "Route Student One");
    const hidden = await get(`/admin/students/${sid}`, k2);
    eq([hidden.status, hidden.json.error.code], [403, "forbidden"]);
    eq((await get("/admin/students/00000000-0000-0000-0000-000000000000", k1)).status, 404);
    eq((await get("/admin/students", await plainCookie(outsider))).status, 403);
    const marker = await newUser();
    await q(`INSERT INTO role (name, description) VALUES ('fee_only', 'custom')`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'fee_only' AND p.code = 'fees.manage'`);
    await acl.assignRole({ userId: marker, roleName: "fee_only", branchId: b1, actor: root });
    const noRead = await get("/admin/students", await staffCookie(marker));
    eq([noRead.status, noRead.json.error.code], [403, "forbidden"]);

    const edited = await call("PATCH", `/admin/students/${sid}`, { body: { schoolName: "Royal College", status: "suspended" }, cookie: k1 });
    eq([edited.status, edited.json.student.schoolName, edited.json.student.status], [200, "Royal College", "suspended"]);
    eq((await call("PATCH", `/admin/students/${sid}`, { body: { status: "gone" }, cookie: k1 })).status, 400);
    eq((await call("PATCH", `/admin/students/${sid}`, { body: { fullName: "No" }, cookie: k2 })).status, 403);
  });

  test("a record shows only the enrolments of the caller's branches; impossible birth dates are client errors", async () => {
    const subj = await id(`INSERT INTO subject (name) VALUES ('Scope Maths')`);
    const mk = async (branch: string, name: string) => {
      const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'program','self_paced',false)`, [subj, branch, name]);
      return { c, fs: await id(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type) VALUES ($1,$2,'Pkg',true,'one_time_package')`, [branch, c]) };
    };
    const c1 = await newUser();
    const c2 = await newUser();
    await acl.assignRole({ userId: c1, roleName: "student_counselor", branchId: b1, actor: root });
    await acl.assignRole({ userId: c2, roleName: "student_counselor", branchId: b2, actor: root });
    const [k1, k2, kr] = [await staffCookie(c1), await staffCookie(c2), await staffCookie(root)];
    const sid = (await post("/admin/students", body({ fullName: "Two Branch Route" }), k1)).json.student.id as string;
    await q(`INSERT INTO student_branch (student_id, branch_id) VALUES ($1,$2)`, [sid, b2]);
    const [a, b] = [await mk(b1, "Scope A"), await mk(b2, "Scope B")];
    for (const x of [a, b]) await q(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1,$2,$3)`, [x.c, sid, x.fs]);
    const seen = async (k: string) => ((await get(`/admin/students/${sid}`, k)).json.enrolments as { courseId: string }[]).map((e) => e.courseId).sort();
    eq(await seen(k1), [a.c], "branch 1 staff");
    eq(await seen(k2), [b.c], "branch 2 staff");
    eq(await seen(kr), [a.c, b.c].sort(), "all-branches staff");

    // registration and update share the schema: an impossible day is a 400 before anything is written
    const before = (await q(`SELECT count(*)::int AS c FROM student`))[0]!.c;
    for (const dob of ["2027-02-31", "1995-13-01", "1995-00-10"]) {
      const reg = await post("/admin/students", body({ dateOfBirth: dob }), k1);
      eq([reg.status, reg.json.error.code], [400, "invalid_request"]); // the schema answers, before the service
    }
    eq((await q(`SELECT count(*)::int AS c FROM student`))[0]!.c, before, "nothing registered");
    const bad = await call("PATCH", `/admin/students/${sid}`, { body: { dateOfBirth: "2025-02-30" }, cookie: k1 });
    eq([bad.status, bad.json.error.code], [400, "invalid_request"]); // the shared schema; the service's own check is covered in the domain tests
    const future = await call("PATCH", `/admin/students/${sid}`, { body: { dateOfBirth: "2999-01-01" }, cookie: k1 });
    eq([future.status, future.json.error.code], [400, "invalid_input"]);
    const noGuardian = await call("PATCH", `/admin/students/${sid}`, { body: { dateOfBirth: "2018-01-01" }, cookie: k1 });
    eq([noGuardian.status, noGuardian.json.error.code], [422, "guardian_required"]);
  });

  test("enrolling uses the course's branch, makes an invoice, and the invoice is readable only in its branch", async () => {
    const subj = await id(`INSERT INTO subject (name) VALUES ('Route Maths')`);
    const course = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Route Course','program','self_paced',false)`, [subj, b1]);
    const fee = await id(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type) VALUES ($1,$2,'Pkg',true,'one_time_package')`, [b1, course]);
    await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1,'7500','2020-01-01')`, [fee]);

    const c1 = await newUser();
    const c2 = await newUser();
    const h1 = await newUser();
    const h2 = await newUser();
    await acl.assignRole({ userId: c1, roleName: "student_counselor", branchId: b1, actor: root });
    await acl.assignRole({ userId: c2, roleName: "student_counselor", branchId: b2, actor: root });
    await acl.assignRole({ userId: h1, roleName: "payment_handler", branchId: b1, actor: root });
    await acl.assignRole({ userId: h2, roleName: "payment_handler", branchId: b2, actor: root });
    const [k1, k2, p1, p2] = [await staffCookie(c1), await staffCookie(c2), await staffCookie(h1), await staffCookie(h2)];

    const sid = (await post("/admin/students", body({ fullName: "Enrol Me" }), k1)).json.student.id as string;
    const denied = await post("/admin/enrollments", { studentId: sid, courseId: course }, k2);
    eq([denied.status, denied.json.error.code], [403, "forbidden"]);
    eq((await post("/admin/enrollments", { studentId: sid, courseId: "00000000-0000-0000-0000-000000000000" }, k1)).status, 404);
    eq((await post("/admin/enrollments", { studentId: "nope", courseId: course }, k1)).status, 400);
    const ok = await post("/admin/enrollments", { studentId: sid, courseId: course }, k1);
    eq(ok.status, 201);
    const invoiceId = ok.json.invoiceId as string;
    const dup = await post("/admin/enrollments", { studentId: sid, courseId: course }, k1);
    eq(dup.status >= 400, true);

    const mine = await get(`/admin/students/${sid}/invoices`, p1);
    eq([mine.status, mine.json.invoices.map((i: { id: string }) => i.id)], [200, [invoiceId]]);
    eq((await get(`/admin/students/${sid}/invoices`, p2)).json.invoices, []);
    const one = await get(`/admin/invoices/${invoiceId}`, p1);
    eq([one.status, one.json.invoice.total, one.json.items.length], [200, "7500.00", 1]);
    eq((await get(`/admin/invoices/${invoiceId}`, p2)).status, 403);
    eq((await get(`/admin/invoices/${invoiceId}`, k1)).status, 200);
    eq((await get(`/admin/invoices/${invoiceId}`, k2)).status, 403);
    eq((await get("/admin/invoices/00000000-0000-0000-0000-000000000000", p1)).status, 404);

    const enrolId = String((await q(`SELECT id FROM enrollment WHERE student_id = $1`, [sid]))[0]!.id);
    eq((await post(`/admin/enrollments/${enrolId}/drop`, {}, k2)).status, 403);
    const dropped = await post(`/admin/enrollments/${enrolId}/drop`, { reason: "moved away" }, k1);
    eq([dropped.status, dropped.json.enrollment.status], [200, "dropped"]);
    eq((await post(`/admin/enrollments/${enrolId}/drop`, {}, k1)).status, 400);
  });
});

describe("attendance, lecturer portal and exams", () => {
  const subj = id(`INSERT INTO subject (name) VALUES ('Route Science')`);
  let k = 0;
  async function enrolledStudent(courseId: string) {
    const userId = await newUser();
    const studentId = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,$2,$3,'2012-01-01')`, [userId, `AT${++k}`, `Pupil ${k}`]);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [studentId, b1]);
    await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2027-01-01')`, [courseId, studentId]);
    return { userId, studentId };
  }

  test("markers work in their branch only; students and parents see the result; a marked session cannot be cancelled", async () => {
    const courseId = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled, delivery_mode) VALUES ($1,$2,'Route Class','class','scheduled',true,'physical')`, [await subj, b1]);
    const pupil = await enrolledStudent(courseId);
    const m1 = await newUser();
    const m2 = await newUser();
    await acl.assignRole({ userId: m1, roleName: "attendance_marker", branchId: b1, actor: root });
    await acl.assignRole({ userId: m2, roleName: "attendance_marker", branchId: b2, actor: root });
    const [k1, k2] = [await staffCookie(m1), await staffCookie(m2)];

    const sess = { courseId, sessionDate: "2027-03-10", startsAt: "16:00", endsAt: "18:00" };
    const denied = await post("/admin/attendance/sessions", sess, k2);
    eq([denied.status, denied.json.error.code], [403, "forbidden"]);
    const made = await post("/admin/attendance/sessions", sess, k1);
    eq(made.status, 201);
    const sid = made.json.session.id as string;
    eq((await post("/admin/attendance/sessions", sess, k1)).status, 422);
    eq((await get(`/admin/attendance/sessions/${sid}/roster`, k2)).status, 403);
    eq((await get(`/admin/attendance/sessions/${sid}/roster`, k1)).json.students.map((s: { studentId: string }) => s.studentId), [pupil.studentId]);

    eq((await post(`/admin/attendance/sessions/${sid}/mark`, { entries: [{ studentId: pupil.studentId, status: "bogus" }] }, k1)).status, 400);
    eq((await post(`/admin/attendance/sessions/${sid}/mark`, { entries: [{ studentId: pupil.studentId, status: "present" }] }, k2)).status, 403);
    eq((await post(`/admin/attendance/sessions/${sid}/mark`, { entries: [{ studentId: pupil.studentId, status: "present" }] }, k1)).status, 200);
    eq((await post(`/admin/attendance/sessions/${sid}/mark-remaining-absent`, {}, k1)).json.marked, 0);
    const cancel = await post(`/admin/attendance/sessions/${sid}/cancel`, {}, k1);
    eq([cancel.status, cancel.json.error.code], [422, "session_has_attendance"]);

    const mine = await get("/student/attendance", await plainCookie(pupil.userId));
    eq(mine.status, 200);
    eq(JSON.stringify(mine.json).includes('"present":1'), true);
    eq((await get(`/admin/students/${pupil.studentId}/attendance`, k1)).status, 200);
    eq((await get(`/admin/students/${pupil.studentId}/attendance`, k2)).status, 403);

    const pu = await newUser({ username: "parent-94771237777", phone: "94771237777" });
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('Mum','94771237777',$1,true)`, [pu]);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, relationship, is_primary) VALUES ($1,$2,'mother',true)`, [pupil.studentId, g]);
    const stranger = await enrolledStudent(courseId);
    const pc = (await post("/auth/sign-in", { identifier: "0771237777", password: GOOD })).cookie!;
    eq((await get(`/parent/children/${pupil.studentId}/attendance`, pc)).status, 200);
    eq((await get(`/parent/children/${stranger.studentId}/attendance`, pc)).status, 403);

    // dates: an impossible day is a 400 on both portals; from is inclusive and to is exclusive
    for (const path of ["/student/attendance", `/parent/children/${pupil.studentId}/attendance`]) {
      const ck = path.startsWith("/student") ? await plainCookie(pupil.userId) : pc;
      for (const bad of ["from=2027-02-30", "to=2027-13-01", "from=2027-00-10"]) {
        const r = await get(`${path}?${bad}`, ck);
        eq([r.status, r.json.error.code], [400, "invalid_request"], `${path}?${bad}`);
      }
      eq((await get(`${path}?from=2027-03-10&to=2027-03-11`, ck)).json.sessions, 1, "inclusive from");
      eq((await get(`${path}?from=2027-03-01&to=2027-03-10`, ck)).json.sessions, 0, "exclusive to");
    }

    // a guardian who is also staff with students.read in this branch still sees only their own children through the parent portal
    await acl.assignRole({ userId: pu, roleName: "student_counselor", branchId: b1, actor: root });
    await q(`UPDATE "user" SET email = 'dual-role@example.com' WHERE id = $1`, [pu]); // so the helper can sign them in
    const both = await staffCookie(pu); // staff need two-step sign-in; the same account is still the parent
    eq((await get(`/admin/students/${stranger.studentId}/attendance`, both)).status, 200, "as staff they may read this student");
    eq((await get(`/parent/children/${stranger.studentId}/attendance`, both)).status, 403);
    eq((await get(`/parent/children/${stranger.studentId}/content`, both)).status, 403);
    eq((await get(`/parent/children/${pupil.studentId}/content`, both)).status, 200);
    eq((await get(`/parent/children/${pupil.studentId}/attendance`, both)).status, 200);
  });

  test("a lecturer builds and runs an exam on their own course; other lecturers are kept out; root can fix a question", async () => {
    const courseId = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Exam Class','class','scheduled',false)`, [await subj, b1]);
    const otherCourse = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Not Mine','class','scheduled',false)`, [await subj, b1]);
    const lu1 = await newUser();
    const lu2 = await newUser();
    const lec1 = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Lec One', $1)`, [lu1]);
    const lec2 = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Lec Two', $1)`, [lu2]);
    for (const l of [lec1, lec2]) await acl.setLecturerPortal({ lecturerId: l, enabled: true, actor: root });
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2)`, [courseId, lec1]);
    const [c1, c2] = [await plainCookie(lu1), await plainCookie(lu2)];
    const pupil = await enrolledStudent(courseId);
    const pupil2 = await enrolledStudent(courseId);

    eq((await get("/admin/payments", c1)).status, 403);
    const opt = [{ body: "Right", isCorrect: true }, { body: "Wrong", isCorrect: false }];
    const q1 = (await post("/lecturer/questions", { body: "Two plus two?", options: opt, defaultMarks: 2 }, c1)).json.question.id as string;
    const q2 = (await post("/lecturer/questions", { body: "Capital of Sri Lanka?", options: opt, defaultMarks: 2 }, c1)).json.question.id as string;
    eq((await post("/lecturer/questions", { body: "x", options: [{ body: "a", isCorrect: true }] }, c1)).status, 400);
    // Revoking the lecturer role closes question creation even while the portal flag stays on (as it does for updates); restoring it reopens it.
    await acl.revokeRole({ userId: lu2, roleName: "lecturer", actor: root });
    eq((await post("/lecturer/questions", { body: "Revoked", options: opt, defaultMarks: 1 }, c2)).status, 403, "no role, no new questions");
    await acl.assignRole({ userId: lu2, roleName: "lecturer", actor: root });
    eq((await post("/lecturer/questions", { body: "Restored", options: opt, defaultMarks: 1 }, c2)).status, 201, "role back");

    const window = { opensAt: "2027-03-10T08:00:00Z", closesAt: "2027-03-10T12:00:00Z", maxAttempts: 1 };
    const notMine = await post("/lecturer/exams", { title: "Bad", mode: "online_mcq", courseIds: [otherCourse], ...window }, c1);
    eq([notMine.status, notMine.json.error.code], [403, "forbidden"]);
    const made = await post("/lecturer/exams", { title: "Route Quiz", mode: "online_mcq", courseIds: [courseId], ...window }, c1);
    eq(made.status, 201);
    const examId = made.json.exam.id as string;

    eq((await call("PUT", `/lecturer/questions/${q1}`, { body: { body: "Hacked", options: opt }, cookie: c2 })).status, 403);
    eq((await call("PUT", `/lecturer/exams/${examId}/questions`, { body: { questions: [{ questionId: q1 }] }, cookie: c2 })).status, 403);
    eq((await post(`/lecturer/exams/${examId}/publish`, {}, c2)).status, 403);
    eq((await call("PUT", `/lecturer/exams/${examId}/questions`, { body: { questions: [{ questionId: q1 }, { questionId: q2 }] }, cookie: c1 })).status, 200);
    eq((await post(`/lecturer/exams/${examId}/publish`, {}, c1)).status, 200);

    const sc = await plainCookie(pupil.userId);
    eq((await post("/lecturer/questions", { body: "x", options: opt }, sc)).status, 403);
    eq((await post("/admin/exams/exams", { title: "x", mode: "paper", courseIds: [courseId] }, sc)).status, 403);
    const started = await post(`/student/exams/${examId}/attempts`, {}, sc);
    eq(started.status, 201);
    const paper = started.json.paper;
    eq(JSON.stringify(paper).includes("isCorrect"), false);
    const attemptId = paper.attemptId as string;
    const answers = paper.questions.map((x: { examQuestionId: string }) => ({ examQuestionId: x.examQuestionId, selectedOptionKey: "A" }));
    eq((await call("PUT", `/student/attempts/${attemptId}/answers`, { body: { answers }, cookie: sc })).status, 200);
    eq((await get(`/student/attempts/${attemptId}`, await plainCookie(pupil2.userId))).status >= 400, true);
    eq((await post(`/student/attempts/${attemptId}/submit`, {}, await plainCookie(pupil2.userId))).status >= 400, true);
    const submitted = await post(`/student/attempts/${attemptId}/submit`, {}, sc);
    // the default exam shows results only after release: the attempt answers carry the status but no score
    eq([submitted.status, submitted.json.status, submitted.json.score], [200, "graded", null]);
    const readBack = await get(`/student/attempts/${attemptId}`, sc);
    eq([readBack.status, readBack.json.score, readBack.json.scoreHidden], [200, null, true]);
    eq((await get(`/student/exams/${examId}/result`, sc)).json.visible, false);
    eq((await post(`/student/exams/${examId}/attempts`, {}, sc)).status >= 400, true);

    eq((await get(`/lecturer/exams/${examId}/results`, c2)).status, 403);
    const res = await get(`/lecturer/exams/${examId}/results`, c1);
    eq(res.status, 200);
    eq(JSON.stringify(res.json).includes(pupil.studentId), true);
    const rel = await post(`/lecturer/exams/${examId}/release`, {}, c1);
    eq([rel.status, rel.json.error.code], [403, "forbidden"]);

    const rootCookie = await staffCookie(root);
    const fixed = await call("PUT", `/admin/exams/questions/${q1}`, { body: { body: "Two plus two equals?", options: opt }, cookie: rootCookie });
    eq(fixed.status, 200);
    const counselor = await newUser();
    await acl.assignRole({ userId: counselor, roleName: "student_counselor", actor: root });
    const refused = await call("PUT", `/admin/exams/questions/${q1}`, { body: { body: "Nope", options: opt }, cookie: await staffCookie(counselor) });
    eq(refused.status, 403);
  });

  test("with the online_exams module off every exam route is refused, for every portal that mounts it", async () => {
    const ON = `'{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true}'::jsonb`;
    const OFF = `'{"parent_portal": true, "content_store": true, "lecturer_portal": true}'::jsonb`;
    await q(`UPDATE organization SET enabled_modules = ${ON}`);
    // real session users and real resources, built while the module is on, so a refusal can only come from the module
    const subj = await id(`INSERT INTO subject (name) VALUES ('Off Subject')`);
    const course = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Off Class','class','scheduled',false)`, [subj, b1]);
    const lu = await newUser();
    const lec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Off Lec', $1)`, [lu]);
    await acl.setLecturerPortal({ lecturerId: lec, enabled: true, actor: root });
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2)`, [course, lec]);
    const lecCookie = await plainCookie(lu);
    const rootCookie = await staffCookie(root);
    const su = await newUser();
    const stu = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,$2,$3,'2012-01-01')`, [su, `OFF${++n}`, `Off Pupil ${n}`]);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [stu, b1]);
    await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2020-01-01')`, [course, stu]);
    const stuCookie = await plainCookie(su);
    const opts = [{ body: "a", isCorrect: true }, { body: "b", isCorrect: false }];
    const qn = await post("/lecturer/questions", { body: "Off question", options: opts }, lecCookie);
    eq(qn.status, 201, "question");
    const questionId = qn.json.question?.id ?? qn.json.id;
    const mk = await post("/lecturer/exams", { title: "Off exam", mode: "online_mcq", courseIds: [course], opensAt: "2020-01-01T00:00:00Z", closesAt: "2099-01-01T00:00:00Z", maxAttempts: 2 }, lecCookie);
    eq(mk.status, 201, "exam");
    const examId = mk.json.exam.id as string;
    eq((await call("PUT", `/lecturer/exams/${examId}/questions`, { body: { questions: [{ questionId }] }, cookie: lecCookie })).status, 200);
    eq((await post(`/lecturer/exams/${examId}/publish`, {}, lecCookie)).status, 200);
    const started = await post(`/student/exams/${examId}/attempts`, {}, stuCookie);
    eq(started.status, 201, "attempt");
    const attemptId = started.json.paper.attemptId as string;
    const examQuestionId = started.json.paper.questions[0].examQuestionId as string;
    const paperEx = await post("/lecturer/exams", { title: "Off paper", mode: "paper", courseIds: [course], examDate: "2027-03-20", maxMarks: 100 }, lecCookie);
    eq(paperEx.status, 201, "paper exam");

    const routes: [string, string, string, unknown, string][] = [];
    for (const [prefix, cookie] of [["/lecturer", lecCookie], ["/admin/exams", rootCookie]] as const) {
      routes.push(
        ["POST", `${prefix}/questions`, prefix, { body: "x", options: opts }, cookie],
        ["PUT", `${prefix}/questions/${questionId}`, prefix, { body: "x", options: opts }, cookie],
        ["POST", `${prefix}/exams`, prefix, { title: "t", mode: "paper", courseIds: [course], examDate: "2027-03-20", maxMarks: 100 }, cookie],
        ["PUT", `${prefix}/exams/${examId}/questions`, prefix, { questions: [{ questionId }] }, cookie],
        ["POST", `${prefix}/exams/${examId}/publish`, prefix, {}, cookie],
        ["POST", `${prefix}/exams/${examId}/close`, prefix, {}, cookie],
        ["POST", `${prefix}/exams/${paperEx.json.exam.id}/marks`, prefix, { entries: [{ studentId: stu, marks: 1 }] }, cookie],
        ["POST", `${prefix}/exams/${examId}/release`, prefix, {}, cookie],
        ["GET", `${prefix}/exams/${examId}/results`, prefix, undefined, cookie],
      );
    }
    routes.push(
      ["POST", `/student/exams/${examId}/attempts`, "/student", {}, stuCookie],
      ["GET", `/student/attempts/${attemptId}`, "/student", undefined, stuCookie],
      ["PUT", `/student/attempts/${attemptId}/answers`, "/student", { answers: [{ examQuestionId, selectedOptionKey: "A" }] }, stuCookie],
      ["POST", `/student/attempts/${attemptId}/submit`, "/student", {}, stuCookie],
      ["GET", `/student/exams/${examId}/result`, "/student", undefined, stuCookie],
    );
    eq(routes.length, 23, "every exam route is in the list: 9 on each of two mounts and 5 for students");

    await q(`UPDATE organization SET enabled_modules = ${OFF}`);
    try {
      for (const [method, path, , body, cookie] of routes) {
        const r = await call(method, path, { body, cookie });
        eq([method, path, r.status, r.json?.error?.code], [method, path, 403, "module_disabled"]);
      }
    } finally {
      await q(`UPDATE organization SET enabled_modules = ${ON}`);
    }
    // the same sessions and resources work again once the module is back, so the refusals above were the module's alone
    eq((await get(`/student/attempts/${attemptId}`, stuCookie)).status, 200);
    eq((await get(`/lecturer/exams/${examId}/results`, lecCookie)).status, 200);
  });
});

describe("fee exceptions, promotion and payouts", () => {
  const MODULES = `'{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true, "fee_exceptions": true, "commissions": true}'::jsonb`;
  async function withRole(name: string, codes: string[], branchId: string | null) {
    await q(`INSERT INTO role (name, description) VALUES ($1, 'custom') ON CONFLICT DO NOTHING`, [name]);
    for (const code of codes) await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = $1 AND p.code = $2 ON CONFLICT DO NOTHING`, [name, code]);
    const u = await newUser();
    await acl.assignRole({ userId: u, roleName: name, branchId, actor: root });
    return staffCookie(u);
  }

  test("fee exceptions follow the course's branch; promotion and payouts need an all-branches role", async () => {
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Money Subject')`);
    const courseId = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Money Course','program','self_paced',false)`, [subj, b1]);
    const fee = await id(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type) VALUES ($1,$2,'Pkg',true,'one_time_package')`, [b1, courseId]);
    await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1,'9000','2020-01-01')`, [fee]);
    const rootCookie = await staffCookie(root);
    const sid = (await post("/admin/students", { branchId: b1, fullName: "Money Student", dateOfBirth: "1999-01-01" }, rootCookie)).json.student.id as string;
    await post("/admin/enrollments", { studentId: sid, courseId }, rootCookie);
    const enrolId = String((await q(`SELECT id FROM enrollment WHERE student_id = $1`, [sid]))[0]!.id);

    const here = await withRole("fee_here", ["fees.override"], b1);
    const there = await withRole("fee_there", ["fees.override"], b2);
    const body = { enrollmentId: enrolId, kind: "discount", discountType: "percent", discountValue: "10", effectiveFrom: "2027-03-01", reason: "Sibling discount" };
    const denied = await post("/admin/fee-exceptions", body, there);
    eq([denied.status, denied.json.error.code], [403, "forbidden"]);
    eq((await post("/admin/fee-exceptions", { ...body, reason: "x" }, here)).status, 400);
    const made = await post("/admin/fee-exceptions", body, here);
    eq(made.status, 201);
    const exId = made.json.exception.id as string;
    eq((await post(`/admin/fee-exceptions/${exId}/end`, {}, there)).status, 403);
    eq((await post(`/admin/fee-exceptions/${exId}/end`, { effectiveTo: "2027-04-31" }, here)).status, 400);
    // K: with the module off an authorized operator cannot end it either
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"fee_exceptions": false}'::jsonb`);
    try {
      const off = await post(`/admin/fee-exceptions/${exId}/end`, { effectiveTo: "2027-04-01" }, here);
      eq([off.status, off.json.error.code], [403, "module_disabled"]);
    } finally {
      await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"fee_exceptions": true}'::jsonb`);
    }
    eq((await post(`/admin/fee-exceptions/${exId}/end`, { effectiveTo: "2027-04-01" }, here)).status, 200);
    eq((await post("/admin/fee-exceptions/00000000-0000-0000-0000-000000000000/end", {}, here)).status, 404);

    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true}'::jsonb`);
    const off = await post("/admin/fee-exceptions", body, here);
    eq([off.status, off.json.error.code], [403, "module_disabled"]);
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);

    const promoBranch = await withRole("promo_branch", ["promotion.run", "payouts.manage"], b1);
    eq((await post("/admin/promotion/runs", {}, promoBranch)).status, 403);
    eq((await get("/admin/payouts", promoBranch)).status, 403);
    const promoAll = await withRole("promo_all", ["promotion.run", "payouts.manage"], null);
    eq((await post("/admin/promotion/runs", { effectiveDate: "2027-04-31" }, promoAll)).status, 400);
    const draft = await post("/admin/promotion/runs", {}, promoAll);
    eq(draft.status, 201);
    const runId = draft.json.runId as string;
    const view = await get(`/admin/promotion/runs/${runId}`, promoAll);
    eq([view.status, view.json.run.status], [200, "draft"]);
    eq((await get(`/admin/promotion/runs/${runId}`, promoBranch)).status, 403);
    eq((await call("PUT", `/admin/promotion/runs/${runId}/effective-date`, { body: { effectiveDate: "2027-05-01" }, cookie: promoAll })).status, 200);
    eq((await call("PUT", `/admin/promotion/runs/${runId}/effective-date`, { body: { effectiveDate: "soon" }, cookie: promoAll })).status, 400);
    eq((await post(`/admin/promotion/runs/${runId}/discard`, {}, promoAll)).status, 200);
    const again = await post(`/admin/promotion/runs/${runId}/confirm`, {}, promoAll);
    eq([again.status, again.json.error.code], [422, "promotion_not_draft"]);
    const clear = await post(`/admin/enrollments/${enrolId}/clear-billing-grade`, { reason: "wrong grade" }, there);
    eq(clear.status, 403);
  });

  test("payouts: preview and carry-forward over HTTP; a lecturer sees only their own approved statements", async () => {
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);
    const lu1 = await newUser();
    const lu2 = await newUser();
    const lec1 = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Pay One', $1)`, [lu1]);
    const lec2 = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Pay Two', $1)`, [lu2]);
    for (const l of [lec1, lec2]) await acl.setLecturerPortal({ lecturerId: l, enabled: true, actor: root });
    const all = await withRole("pay_all", ["payouts.manage"], null);

    const prev = await get(`/admin/payouts/preview?lecturerId=${lec1}`, all);
    eq([prev.status, prev.json.blocker], [200, "no_entries"]);
    const future = await post("/admin/payouts", { lecturerId: lec1, periodEnd: "2027-03-31" }, all);
    eq([future.status, future.json.error.code], [422, "payout_period_invalid"]);
    const cf = await post("/admin/payouts", { lecturerId: lec1, periodEnd: "2027-03-10" }, all);
    eq([cf.status, cf.json.status, cf.json.reason], [200, "carried_forward", "no_entries"]);
    eq((await post("/admin/payouts", { lecturerId: lec1, periodEnd: "march" }, all)).status, 400);
    // an impossible day is a 400 from the shared schema (it used to reach the database cast and answer 500)
    eq((await post("/admin/payouts", { lecturerId: lec1, periodEnd: "2027-02-31" }, all)).status, 400);
    eq((await get(`/admin/payouts/preview?lecturerId=${lec1}&periodEnd=2027-02-31`, all)).status, 400);

    const draft = await id(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable, status) VALUES ($1,'2027-01-01','2027-02-01','1000','200','800','draft')`, [lec1]);
    const approved = await id(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1,'2027-02-01','2027-03-01','1000','100','900')`, [lec1]);
    await q(`UPDATE teacher_payout SET status = 'approved', approved_by = $2 WHERE id = $1`, [approved, root]);
    const theirs = await id(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1,'2027-02-01','2027-03-01','500','50','450')`, [lec2]);
    await q(`UPDATE teacher_payout SET status = 'approved', approved_by = $2 WHERE id = $1`, [theirs, root]);

    eq((await get("/admin/payouts?status=draft", all)).json.payouts.map((p: { id: string }) => p.id), [draft]);
    eq((await get(`/admin/payouts/${draft}`, all)).status, 200);
    const c1 = await plainCookie(lu1);
    eq((await get("/lecturer/payouts", c1)).json.payouts.map((p: { id: string }) => p.id), [approved]);
    eq((await get(`/lecturer/payouts/${approved}`, c1)).status, 200);
    eq((await get(`/lecturer/payouts/${draft}`, c1)).status, 404);
    eq((await get(`/lecturer/payouts/${theirs}`, c1)).status, 404);
    eq((await get(`/admin/payouts/${approved}`, c1)).status, 403);
    eq((await get("/lecturer/payouts")).status, 401);

    const paid = await post(`/admin/payouts/${approved}/paid`, { paymentReference: "BANK-123", paidOn: "2027-03-10" }, all);
    eq(paid.status, 200);
    eq(paid.json.payout.status, "paid");
    eq((await post(`/admin/payouts/${approved}/paid`, { paymentReference: "" }, all)).status, 400);
    // approve and refresh share one shape: { payout, pulledReversals }.
    const second = await id(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable, status) VALUES ($1,'2027-03-01','2027-04-01','100','20','80','draft')`, [lec2]);
    // One accrual entry in the draft, without building the payment chain behind it (foreign keys are skipped for this insert only).
    try {
      await q(`SET session_replication_role = replica`);
      await q(`INSERT INTO commission_entry (payment_allocation_id, rule_id, lecturer_id, entry_type, calc_type_applied, rate_applied, share_percent_applied, basis_applied, base_amount, commission_amount, teacher_amount, status, payout_id) VALUES (gen_random_uuid(), gen_random_uuid(), $1,'accrual','percent',20,100,'paid',100,20,80,'settled',$2)`, [lec2, second]);
    } finally {
      await q(`SET session_replication_role = origin`);
    }
    const refreshed = await post(`/admin/payouts/${second}/refresh`, {}, all);
    eq([refreshed.status, refreshed.json.payout.id, typeof refreshed.json.pulledReversals], [200, second, "number"]);
    const ok = await post(`/admin/payouts/${second}/approve`, {}, all);
    eq([ok.status, ok.json.payout.id, ok.json.payout.status, typeof ok.json.pulledReversals], [200, second, "approved", "number"]);
    eq((await post(`/admin/payouts/${draft}/discard`, { reason: "test" }, all)).status, 200);
    eq((await post(`/admin/payouts/${draft}/approve`, {}, c1)).status, 403);
  });
});

describe("content management", () => {
  const MODULES = `'{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true, "commissions": true}'::jsonb`;
  const link = "https://youtu.be/route";

  test("a lecturer manages their own content in branches where they teach; others are refused", async () => {
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Content Subject')`);
    const courseId = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Content Course','class','scheduled',false)`, [subj, b1]);
    const lu1 = await newUser();
    const lu2 = await newUser();
    const lec1 = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Content One', $1)`, [lu1]);
    const lec2 = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Content Two', $1)`, [lu2]);
    for (const l of [lec1, lec2]) await acl.setLecturerPortal({ lecturerId: l, enabled: true, actor: root });
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2)`, [courseId, lec1]);
    const [c1, c2] = [await plainCookie(lu1), await plainCookie(lu2)];

    const bad = await post("/lecturer/content/items", { kind: "recording", title: "No link", branchIds: [b1] }, c1);
    eq([bad.status, bad.json.error.code], [422, "content_invalid"]);
    const elsewhere = await post("/lecturer/content/items", { kind: "recording", title: "X", externalUrl: link, accessType: "free_registered", branchIds: [b2] }, c1);
    eq([elsewhere.status, elsewhere.json.error.code], [403, "forbidden"]);
    eq((await post("/lecturer/content/items", { kind: "recording", title: "Lonely", externalUrl: link, branchIds: [b1] }, c2)).status, 403);

    const made = await post("/lecturer/content/items", { kind: "recording", title: "Lesson 1", externalUrl: link, accessType: "free_registered", branchIds: [b1] }, c1);
    eq(made.status, 201);
    const itemId = made.json.item.id as string;
    eq((await call("PATCH", `/lecturer/content/items/${itemId}`, { body: { title: "Hacked" }, cookie: c2 })).status, 403);
    eq((await call("PATCH", `/lecturer/content/items/${itemId}`, { body: { title: "Lesson One" }, cookie: c1 })).json.item.title, "Lesson One");
    eq((await post(`/lecturer/content/items/${itemId}/status`, { status: "published" }, c2)).status, 403);
    eq((await post(`/lecturer/content/items/${itemId}/status`, { status: "published" }, c1)).json.item.status, "published");
    eq((await post(`/lecturer/content/items/${itemId}/branches`, { branchIds: [b2] }, c1)).status, 403);

    const sec = await post(`/lecturer/content/courses/${courseId}/sections`, { title: "Week 1" }, c1);
    eq(sec.status, 201);
    eq((await post(`/lecturer/content/courses/${courseId}/sections`, { title: "Week 1" }, c2)).status, 403);
    eq((await post(`/lecturer/content/courses/${courseId}/content`, { contentId: itemId, sectionId: sec.json.section.id }, c1)).status, 201);
    // A position-only repeat attach keeps the section; an explicit null clears it.
    const moved = await post(`/lecturer/content/courses/${courseId}/content`, { contentId: itemId, position: 5 }, c1);
    eq([moved.json.link.sectionId, moved.json.link.position], [sec.json.section.id, 5], "section kept");
    eq((await post(`/lecturer/content/courses/${courseId}/content`, { contentId: itemId, sectionId: null }, c1)).json.link.sectionId, null, "explicit null clears");
    await post(`/lecturer/content/courses/${courseId}/content`, { contentId: itemId, sectionId: sec.json.section.id }, c1);
    eq((await post(`/lecturer/content/courses/${courseId}/content`, { contentId: itemId }, c2)).status, 403);
    eq((await call("DELETE", `/lecturer/content/courses/${courseId}/content/${itemId}`, { cookie: c2 })).status, 403);
    eq((await call("DELETE", `/lecturer/content/courses/${courseId}/content/${itemId}`, { cookie: c1 })).status, 200);
    eq((await get("/lecturer/content/handovers", c1)).status, 404);
  });

  test("staff list content only in branches where they hold content.manage; students buy and cancel only their own purchases", async () => {
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);
    const lecturerId = await id(`INSERT INTO lecturer (full_name) VALUES ('Staff Owned')`);
    await q(`INSERT INTO role (name, description) VALUES ('content_b1', 'custom'), ('handover_b1', 'custom'), ('handover_b2', 'custom')`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE (r.name = 'content_b1' AND p.code = 'content.manage') OR (r.name LIKE 'handover_%' AND p.code = 'content.handover')`);
    const mk = async (role: string, branchId: string) => {
      const u = await newUser();
      await acl.assignRole({ userId: u, roleName: role, branchId, actor: root });
      return staffCookie(u);
    };
    const [mgr, h1, h2] = [await mk("content_b1", b1), await mk("handover_b1", b1), await mk("handover_b2", b2)];

    const body = { lecturerId, kind: "physical_book", title: "Workbook", accessType: "paid", price: "1200.00" };
    eq((await post("/admin/content/items", { ...body, branchIds: [b2] }, mgr)).status, 403);
    eq((await post("/admin/content/items", { ...body, branchIds: [] }, mgr)).status, 403);
    eq((await post("/admin/content/items", { ...body }, "sms_session=bogus")).status, 401);
    const made = await post("/admin/content/items", { ...body, branchIds: [b1] }, mgr);
    eq(made.status, 201);
    const itemId = made.json.item.id as string;
    eq((await post(`/admin/content/items/${itemId}/status`, { status: "published" }, mgr)).status, 200);
    eq((await call("PATCH", `/admin/content/items/${itemId}`, { body: { price: "1500.00" }, cookie: h1 })).status, 403);

    const su = await newUser();
    const stu = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,'CT1','Buyer','2000-01-01')`, [su]);
    const other = await newUser();
    await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,'CT2','Other Buyer','2000-01-01')`, [other]);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [stu, b1]);
    const sc = await plainCookie(su);
    const bought = await post(`/student/content/${itemId}/purchase`, {}, sc);
    eq(bought.status, 201);
    const purchaseId = String((await q(`SELECT id FROM content_purchase WHERE student_id = $1`, [stu]))[0]!.id);
    eq((await post(`/student/purchases/${purchaseId}/cancel`, {}, await plainCookie(other))).status, 404);

    const early = await post(`/admin/content/purchases/${purchaseId}/hand-over`, {}, h1);
    eq([early.status, early.json.error.code], [422, "purchase_not_paid"]);
    eq((await post(`/admin/content/purchases/${purchaseId}/hand-over`, {}, h2)).status, 403);
    // Force the purchase into the waiting-for-handover state to check branch scoping of the list.
    await q(`UPDATE content_purchase SET status = 'paid', channel = 'physical' WHERE id = $1`, [purchaseId]);
    eq((await get("/admin/content/handovers", h1)).json.handovers.map((x: { purchase: { id: string } }) => x.purchase.id), [purchaseId], "own branch sees it");
    eq((await get("/admin/content/handovers", h2)).json.handovers, [], "other branch sees nothing");
    await q(`UPDATE content_purchase SET status = 'pending' WHERE id = $1`, [purchaseId]);
    eq((await get("/admin/content/handovers", mgr)).status, 403);
    eq((await post(`/admin/content/purchases/${purchaseId}/cancel`, {}, h2)).status, 403);
    eq((await post(`/student/purchases/${purchaseId}/cancel`, {}, sc)).json.purchase.status, "cancelled");
  });
});

describe("content authorization hardening", () => {
  const MODULES = `'{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true, "commissions": true}'::jsonb`;
  const link = "https://youtu.be/hardening";

  test("a price or archive change needs content.manage in every branch the item is listed in", async () => {
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);
    const lecturerId = await id(`INSERT INTO lecturer (full_name) VALUES ('Shared Owner')`);
    await q(`INSERT INTO role (name, description) VALUES ('content_wide', 'custom') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'content_wide' AND p.code = 'content.manage' ON CONFLICT DO NOTHING`);
    const mk = async (...branches: string[]) => {
      const u = await newUser();
      for (const branchId of branches) await acl.assignRole({ userId: u, roleName: "content_wide", branchId, actor: root });
      return staffCookie(u);
    };
    const [onlyA, both, rootC] = [await mk(b1), await mk(b1, b2), await staffCookie(root)];
    const shared = await post("/admin/content/items", { lecturerId, kind: "physical_book", title: "Shared Book", accessType: "paid", price: "1200.00", branchIds: [b1, b2] }, rootC);
    eq(shared.status, 201);
    const sid = shared.json.item.id as string;
    const single = await post("/admin/content/items", { lecturerId, kind: "physical_book", title: "Single Book", accessType: "paid", price: "900.00", branchIds: [b1] }, onlyA);
    eq(single.status, 201);
    const oid = single.json.item.id as string;

    // the manager of one of two listing branches cannot reprice or archive the shared item
    eq((await call("PATCH", `/admin/content/items/${sid}`, { body: { price: "1.00" }, cookie: onlyA })).status, 403);
    eq((await post(`/admin/content/items/${sid}/status`, { status: "archived" }, onlyA)).status, 403);
    eq(String((await q(`SELECT price::text AS p, status FROM content_item WHERE id = $1`, [sid]))[0]!.p), "1200.00");
    eq(String((await q(`SELECT status FROM content_item WHERE id = $1`, [sid]))[0]!.status) !== "archived", true);
    // staff of every listing branch, and an all-branches role, still can
    eq((await call("PATCH", `/admin/content/items/${sid}`, { body: { price: "1300.00" }, cookie: both })).json.item.price, "1300.00");
    eq((await post(`/admin/content/items/${sid}/status`, { status: "published" }, rootC)).status, 200);
    // a single-branch item stays manageable by that branch's manager
    eq((await call("PATCH", `/admin/content/items/${oid}`, { body: { price: "950.00" }, cookie: onlyA })).status, 200);
    eq((await post(`/admin/content/items/${oid}/status`, { status: "published" }, onlyA)).status, 200);
    eq((await post(`/admin/content/items/${oid}/status`, { status: "archived" }, onlyA)).status, 200);
    // an item listed nowhere is for all-branches staff only
    const unlisted = await post("/admin/content/items", { lecturerId, kind: "recording", title: "Unlisted", externalUrl: link, accessType: "course", branchIds: [] }, rootC);
    eq(unlisted.status, 201);
    eq((await call("PATCH", `/admin/content/items/${unlisted.json.item.id}`, { body: { title: "Renamed" }, cookie: onlyA })).status, 403);
    eq((await call("PATCH", `/admin/content/items/${unlisted.json.item.id}`, { body: { title: "Renamed" }, cookie: rootC })).status, 200);
  });

  test("a lecturer without the role's content.manage cannot create; a co-teacher cannot unlink another lecturer's item", async () => {
    await q(`UPDATE organization SET enabled_modules = ${MODULES}`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Hardening Content')`);
    const courseId = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Shared Course','class','scheduled',false)`, [subj, b1]);
    const [u1, u2, u3] = [await newUser(), await newUser(), await newUser()];
    const [l1, l2, l3] = [
      await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Owner', $1)`, [u1]),
      await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Co Teacher', $1)`, [u2]),
      await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Revoked', $1)`, [u3]),
    ];
    for (const l of [l1, l2, l3]) await acl.setLecturerPortal({ lecturerId: l, enabled: true, actor: root });
    for (const l of [l1, l2, l3]) await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2)`, [courseId, l]);
    const [c1, c2, c3] = [await plainCookie(u1), await plainCookie(u2), await plainCookie(u3)];

    // unlink: both teach the course, only the owner may remove the owner's item from it
    const made = await post("/lecturer/content/items", { kind: "recording", title: "Owner Lesson", externalUrl: link, accessType: "free_registered", branchIds: [b1] }, c1);
    eq(made.status, 201);
    const itemId = made.json.item.id as string;
    eq((await post(`/lecturer/content/courses/${courseId}/content`, { contentId: itemId }, c1)).status, 201);
    eq((await call("DELETE", `/lecturer/content/courses/${courseId}/content/${itemId}`, { cookie: c2 })).status, 403);
    eq((await q(`SELECT count(*)::int AS c FROM course_content WHERE course_id = $1 AND content_id = $2`, [courseId, itemId]))[0]!.c, 1, "link kept");
    eq((await call("DELETE", `/lecturer/content/courses/${courseId}/content/${itemId}`, { cookie: c1 })).status, 200);

    // create: the lecturer role without content.manage, portal still open
    await q(`DELETE FROM role_permission WHERE role_id = (SELECT id FROM role WHERE name = 'lecturer') AND permission_id = (SELECT id FROM permission WHERE code = 'content.manage')`);
    try {
      const noPerm = await post("/lecturer/content/items", { kind: "recording", title: "Orphan", externalUrl: link, accessType: "course" }, c3);
      eq([noPerm.status, noPerm.json.error.code], [403, "forbidden"]);
      eq((await post("/lecturer/content/items", { kind: "recording", title: "Orphan 2", externalUrl: link, accessType: "free_registered", branchIds: [b1] }, c3)).status, 403);
      eq((await q(`SELECT count(*)::int AS c FROM content_item WHERE title LIKE 'Orphan%'`))[0]!.c, 0, "nothing created");
    } finally {
      await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'lecturer' AND p.code = 'content.manage' ON CONFLICT DO NOTHING`);
    }
    eq((await post("/lecturer/content/items", { kind: "recording", title: "Fine again", externalUrl: link, accessType: "course" }, c3)).status, 201);
  });
});

describe("notices", () => {
  test("staff write notices in their own branch; students and parents read what is aimed at them", async () => {
    await q(`DELETE FROM notice`);
    await q(`INSERT INTO role (name, description) VALUES ('notice_b1', 'custom') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'notice_b1' AND p.code = 'notices.manage' ON CONFLICT DO NOTHING`);
    const wu = await newUser();
    await acl.assignRole({ userId: wu, roleName: "notice_b1", branchId: b1, actor: root });
    const w = await staffCookie(wu);

    eq((await post("/admin/notices", { branchId: b2, title: "Kandy", body: "x" }, w)).status, 403);
    eq((await post("/admin/notices", { branchId: b2.toUpperCase(), title: "Kandy", body: "x" }, w)).status, 403);
    const own = await post("/admin/notices", { branchId: b1.toUpperCase(), title: "Own branch", body: "x" }, w);
    eq([own.status, own.json.notice.branchId], [201, b1]);
    eq((await call("DELETE", `/admin/notices/${own.json.notice.id}`, { cookie: w })).status, 200);
    eq((await post("/admin/notices", { branchId: null, title: "Org", body: "x" }, w)).status, 403);
    eq((await post("/admin/notices", { branchId: b1, title: " ", body: "x" }, w)).json.error.code, "invalid_input");
    eq((await post("/admin/notices", { branchId: b1, title: "t", body: "x", extra: 1 }, w)).status, 400);
    eq((await post("/admin/notices", { branchId: b1, title: "t", body: "x" }, "sms_session=bogus")).status, 401);

    const su = await newUser();
    const stu = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,'NT1','Reader','2000-01-01')`, [su]);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [stu, b1]);
    const other = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('NT2','Other','2000-01-01')`);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [other, b1]);

    const all = await post("/admin/notices", { branchId: b1, title: "Hello all", body: "x" }, w);
    eq(all.status, 201);
    await post("/admin/notices", { branchId: b1, title: "Only Reader", body: "x", targets: [{ type: "student", id: stu }] }, w);
    await post("/admin/notices", { branchId: b1, title: "Only Other", body: "x", targets: [{ type: "student", id: other }] }, w);
    await post("/admin/notices", { branchId: null, title: "Org wide", body: "x" }, await staffCookie(root));
    const kandy = await post("/admin/notices", { branchId: b2, title: "Kandy only", body: "x" }, await staffCookie(root));

    const sc = await plainCookie(su);
    eq((await get("/student/notices", sc)).json.notices.map((n: { title: string }) => n.title).sort(), ["Hello all", "Only Reader", "Org wide"]);

    const pu = await newUser({ username: "parent-94771230001", phone: "94771230001", password: false });
    const g = await id(`INSERT INTO guardian (full_name, phone, user_id, portal_enabled) VALUES ('NParent','94771230001',$1,true)`, [pu]);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, relationship, is_primary) VALUES ($1,$2,'mother',true)`, [stu, g]);
    const first = await post("/auth/first-login", { phone: "94771230001" });
    const pc = (await post("/auth/set-password", { newPassword: "my new password 2" }, first.cookie)).cookie ?? first.cookie;
    eq((await get("/parent/notices", pc)).json.notices.map((n: { title: string }) => n.title).sort(), ["Hello all", "Only Reader", "Org wide"]);
    eq((await get("/admin/notices", sc)).status, 403);
    eq((await get("/student/notices", pc)).status, 403);

    // management lists and edits are branch-scoped
    eq((await get("/admin/notices", w)).json.notices.every((n: { branchId: string }) => n.branchId === b1), true);
    eq((await get(`/admin/notices/${kandy.json.notice.id}`, w)).status, 403);
    eq((await call("PATCH", `/admin/notices/${kandy.json.notice.id}`, { body: { title: "Hacked" }, cookie: w })).status, 403);
    eq((await call("DELETE", `/admin/notices/${kandy.json.notice.id}`, { cookie: w })).status, 403);
    eq((await call("PATCH", `/admin/notices/${all.json.notice.id}`, { body: { title: "Hello everyone" }, cookie: w })).json.notice.title, "Hello everyone");
    eq((await call("DELETE", `/admin/notices/${all.json.notice.id}`, { cookie: w })).status, 200);
    eq((await get(`/admin/notices/${all.json.notice.id}`, w)).status, 404);
    eq((await get("/admin/notices/mine", w)).json.notices, []);
  });
});

describe("reports", () => {
  test("owner reports are branch-scoped and need reports.read", async () => {
    await q(`INSERT INTO role (name, description) VALUES ('report_b1', 'custom') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'report_b1' AND p.code = 'reports.read' ON CONFLICT DO NOTHING`);
    const vu = await newUser();
    await acl.assignRole({ userId: vu, roleName: "report_b1", branchId: b1, actor: root });
    const viewer = await staffCookie(vu);
    const rootC = await staffCookie(root);
    const hu = await newUser();
    await acl.assignRole({ userId: hu, roleName: "payment_handler", branchId: b1, actor: root });

    const mk = async (no: string, b: string, due: string, total: string) => {
      const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2010-01-01')`, [no, `Debtor ${no}`]);
      await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [s, b]);
      await q(`INSERT INTO invoice (student_id, branch_id, issued_on, due_date, subtotal, total) VALUES ($1,$2,'2026-01-01',$3,$4,$4)`, [s, b, due, total]);
    };
    await mk("RP1", b1, "2027-03-01", "111.00");
    await mk("RP2", b2, "2027-03-01", "222.00");

    const names = (r: { json: { report: { rows: { studentNo: string }[] } } }) => r.json.report.rows.map((x) => x.studentNo).filter((x) => x.startsWith("RP")).sort();
    eq(names(await get("/admin/reports/overdue", rootC)), ["RP1", "RP2"]);
    eq(names(await get("/admin/reports/overdue", viewer)), ["RP1"]);
    eq((await get(`/admin/reports/overdue?branchId=${b2}`, viewer)).status, 403);
    eq((await get(`/admin/reports/overdue?branchId=${b2.toUpperCase()}`, viewer)).status, 403);
    eq(names(await get(`/admin/reports/overdue?branchId=${b1.toUpperCase()}`, viewer)), ["RP1"]);
    eq((await get(`/admin/reports/collections?from=2027-03-01&to=2027-03-31&branchId=${b1.toUpperCase()}`, viewer)).status, 200);
    eq(names(await get(`/admin/reports/overdue?branchId=${b2}`, rootC)), ["RP2"]);
    eq((await get("/admin/reports/overdue", await staffCookie(hu))).status, 403);
    eq((await get("/admin/reports/overdue", "sms_session=bogus")).status, 401);
    eq((await get("/admin/reports/overdue?limit=0", rootC)).status, 400);
    eq((await get("/admin/reports/overdue?surprise=1", rootC)).status, 400);

    const ok = await get("/admin/reports/collections?from=2027-03-01&to=2027-03-31", viewer);
    eq([ok.status, ok.json.report.from, typeof ok.json.report.collected], [200, "2027-03-01", "string"]);
    eq((await get("/admin/reports/collections?from=2027-03-31&to=2027-03-01", viewer)).json.error.code, "invalid_input");
    eq((await get("/admin/reports/collections?from=2027-03-01", viewer)).status, 400);
    eq((await get(`/admin/reports/collections?from=2027-03-01&to=2027-03-31&branchId=${b2}`, viewer)).status, 403);
    eq((await get("/admin/reports/collections?from=2027-03-01&to=2027-03-31", await staffCookie(hu))).status, 403);
  });
});

describe("guardians and commission rules", () => {
  test("guardian routes are checked through the student's branches", async () => {
    await q(`INSERT INTO role (name, description) VALUES ('guardian_b1', 'custom') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'guardian_b1' AND p.code = 'guardians.manage' ON CONFLICT DO NOTHING`);
    const eu = await newUser();
    await acl.assignRole({ userId: eu, roleName: "guardian_b1", branchId: b1, actor: root });
    const editor = await staffCookie(eu);
    const mkKid = async (no: string, b: string) => {
      const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2018-01-01')`, [no, `Kid ${no}`]);
      await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [s, b]);
      return s;
    };
    const near = await mkKid("GA1", b1);
    const far = await mkKid("GA2", b2);

    const made = await post(`/admin/students/${near}/guardians`, { fullName: "Route Mum", phone: "0779990001", relationship: "mother" }, editor);
    eq([made.status, made.json.link.isPrimary, made.json.link.created], [201, true, true]);
    const gid = made.json.link.guardianId as string;
    eq((await post(`/admin/students/${far}/guardians`, { fullName: "X", phone: "0779990002" }, editor)).status, 403);
    const dupLink = await post(`/admin/students/${near}/guardians`, { fullName: "Route Mum", phone: "0779990001" }, editor);
    eq([dupLink.status, dupLink.json.error.code], [409, "guardian_linked"]);
    eq((await post(`/admin/students/${near}/guardians`, { fullName: "X", phone: "0779990003", extra: 1 }, editor)).status, 400);
    eq((await post(`/admin/students/${near}/guardians`, { fullName: "X", phone: "bad" }, editor)).json.error.code, "invalid_input");
    eq((await post(`/admin/students/${near}/guardians`, { fullName: "X", phone: "0779990004" }, "sms_session=bogus")).status, 401);

    eq((await call("PATCH", `/admin/guardians/${gid}`, { body: { address: "Kandy road" }, cookie: editor })).json.guardian.address, "Kandy road");
    const dad = await post(`/admin/students/${near}/guardians`, { fullName: "Route Dad", phone: "0779990005" }, editor);
    eq((await call("PATCH", `/admin/students/${near}/guardians/${dad.json.link.guardianId}`, { body: { isPrimary: true, relationship: "father" }, cookie: editor })).json.link.isPrimary, true);
    eq((await call("PATCH", `/admin/students/${near}/guardians/${dad.json.link.guardianId}`, { body: { isPrimary: false }, cookie: editor })).status, 400);
    const taken = await post(`/admin/guardians/${gid}/phone`, { phone: "0779990005" }, editor);
    eq([taken.status, taken.json.error.code], [409, "phone_taken"]);
    eq((await post(`/admin/guardians/${gid}/phone`, { phone: "0779990006" }, editor)).json.guardian.phone, "94779990006");

    const farG = await post(`/admin/students/${far}/guardians`, { fullName: "Far Mum", phone: "0779990007" }, await staffCookie(root));
    eq((await call("PATCH", `/admin/guardians/${farG.json.link.guardianId}`, { body: { address: "x" }, cookie: editor })).status, 403);
    eq((await post(`/admin/guardians/${farG.json.link.guardianId}/phone`, { phone: "0779990008" }, editor)).status, 403);
    eq((await call("DELETE", `/admin/students/${far}/guardians/${farG.json.link.guardianId}`, { cookie: editor })).status, 403);
    eq((await call("DELETE", `/admin/students/${near}/guardians/${dad.json.link.guardianId}`, { cookie: editor })).status, 200);
    eq((await call("DELETE", `/admin/students/${near}/guardians/${gid}`, { cookie: editor })).json.error.code, "guardian_required");
  });

  test("commission rule routes need an all-branches commissions.manage", async () => {
    await q(`INSERT INTO role (name, description) VALUES ('rules_b1', 'custom') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'rules_b1' AND p.code = 'commissions.manage' ON CONFLICT DO NOTHING`);
    const bu = await newUser();
    await acl.assignRole({ userId: bu, roleName: "rules_b1", branchId: b1, actor: root });
    const branchOnly = await staffCookie(bu);
    const rootC = await staffCookie(root);
    const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('API Rule Teacher')`);
    const body = { lecturerId: lec, calcType: "percent", rate: "15", effectiveFrom: "2027-01-01" };

    eq((await post("/admin/commission-rules", body, branchOnly)).status, 403);
    eq((await get("/admin/commission-rules", branchOnly)).status, 403);
    eq((await post("/admin/commission-rules", body, "sms_session=bogus")).status, 401);
    const made = await post("/admin/commission-rules", body, rootC);
    eq([made.status, made.json.rule.commissionRate, made.json.warnings], [201, "15.00", []]);
    const rid = made.json.rule.id as string;
    const overlap = await post("/admin/commission-rules", body, rootC);
    eq([overlap.status, overlap.json.error.code], [409, "rule_overlap"]);
    eq((await post("/admin/commission-rules", { ...body, rate: "150", effectiveFrom: "2031-01-01", effectiveTo: "2032-01-01" }, rootC)).json.error.code, "invalid_input");
    eq((await post("/admin/commission-rules", { ...body, calcType: "flat" }, rootC)).status, 400);
    eq((await post("/admin/commission-rules", { ...body, surprise: 1 }, rootC)).status, 400);
    eq((await get(`/admin/commission-rules?lecturerId=${lec}&activeOn=2027-06-01`, rootC)).json.rules.length, 1);
    eq((await get(`/admin/commission-rules?lecturerId=${lec}&activeOn=2026-06-01`, rootC)).json.rules.length, 0);
    eq((await post(`/admin/commission-rules/${rid}/end`, { effectiveTo: "2027-12-01" }, branchOnly)).status, 403);
    eq((await post(`/admin/commission-rules/${rid}/end`, { effectiveTo: "2027-12-01" }, rootC)).json.rule.effectiveTo, "2027-12-01");
    eq((await post(`/admin/commission-rules/${rid}/end`, { effectiveTo: "2028-12-01" }, rootC)).json.error.code, "invalid_input");
    eq((await call("DELETE", `/admin/commission-rules/${rid}`, { cookie: branchOnly })).status, 403);
    eq((await call("DELETE", `/admin/commission-rules/${rid}`, { cookie: rootC })).status, 200);

    // K: with the commissions switch off every rule route answers module_disabled and nothing is written
    const count0 = (await q(`SELECT count(*)::int AS c FROM commission_rule`))[0]!.c;
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"commissions": false}'::jsonb`);
    try {
      const off = [
        await post("/admin/commission-rules", { ...body, effectiveFrom: "2040-01-01" }, rootC),
        await get("/admin/commission-rules", rootC),
        await post(`/admin/commission-rules/${rid}/end`, { effectiveTo: "2027-12-01" }, rootC),
        await call("DELETE", `/admin/commission-rules/${rid}`, { cookie: rootC }),
      ];
      for (const r of off) eq([r.status, r.json.error.code], [403, "module_disabled"]);
      eq((await q(`SELECT count(*)::int AS c FROM commission_rule`))[0]!.c, count0);
    } finally {
      await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"commissions": true}'::jsonb`);
    }
    eq((await call("DELETE", `/admin/commission-rules/${rid}`, { cookie: rootC })).status, 404);
  });
});

// ---- review hardening

const deps = { db, auth, acl, payments, content, notices, reports, guardians, commissionRules, students, enrollment, attendance, exams, feeExceptions, promotion, payouts };
const appWith = (config: Record<string, unknown>, over: Record<string, unknown> = {}) => createApi({ ...deps, ...over, config: { trustedOrigins: [ORIGIN], secureCookie: true, ...config } } as Parameters<typeof createApi>[0]);
const signInWrong = (a: ReturnType<typeof appWith>, headers: Record<string, string> = {}, env?: unknown) =>
  a.request("/auth/sign-in", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: JSON.stringify({ identifier: "nobody@example.com", password: "wrong password!!" }) }, env);
const ipKeys = async () => (await q(`SELECT key FROM auth_rate_limit WHERE key LIKE 'signin:ip:%' ORDER BY key`)).map((r) => String(r.key));

describe("unmatched routes", () => {
  test("answer the JSON envelope, whatever the method, mount or sign-in state", async () => {
    for (const r of [await get("/nope"), await call("POST", "/nope", { body: {} }), await get("/auth/nope"), await get("/lecturer/nope")]) {
      eq([r.status, r.json?.error?.code], [404, "not_found"]);
    }
    const k = await staffCookie(root);
    const inside = await get("/admin/nope", k);
    eq([inside.status, inside.json?.error?.code], [404, "not_found"]);
    const res = await app.request("/nope");
    eq(res.headers.get("content-type")?.includes("application/json"), true);
  });
});

describe("one lecturer guard per request", () => {
  test("payouts, exam and content routes authenticate the session once", async () => {
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true}'::jsonb`);
    const lu = await newUser();
    const lec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Guard Once', $1)`, [lu]);
    await acl.setLecturerPortal({ lecturerId: lec, enabled: true, actor: root });
    const cookie = await plainCookie(lu);
    let calls = 0;
    const counting = new Proxy(auth, {
      get(t, prop) {
        const v = Reflect.get(t, prop, t);
        if (prop === "authenticate") return (...a: unknown[]) => (calls++, (v as (...x: unknown[]) => unknown).apply(t, a));
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    const counted = appWith({}, { auth: counting });
    const hit = async (method: string, path: string, body?: unknown) => {
      calls = 0;
      const res = await counted.request(path, { method, headers: { cookie, origin: ORIGIN, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, calls };
    };
    eq((await hit("GET", "/lecturer/payouts")).calls, 1, "payout list");
    eq((await hit("GET", "/lecturer/payouts/00000000-0000-4000-8000-000000000000")).calls, 1, "payout statement");
    eq((await hit("POST", "/lecturer/content/items", {})).calls, 1, "content");
    const exam = await hit("GET", "/lecturer/exams/00000000-0000-4000-8000-000000000000/results");
    eq(exam.calls, 1, "exam results");
    eq((await hit("POST", "/lecturer/questions", {})).calls, 1, "questions");
    // the guard is still there on every one of them
    const anon = await counted.request("/lecturer/exams/00000000-0000-4000-8000-000000000000/results");
    eq(anon.status, 401);
    eq((await counted.request("/lecturer/questions", { method: "POST", headers: { origin: ORIGIN } })).status, 401);
    eq((await counted.request("/lecturer/payouts")).status, 401);
  });
});

describe("address limit behind and without a proxy", () => {
  test("the peer address from the adapter is counted; forwarded headers are ignored unless the proxy is trusted", async () => {
    await q(`DELETE FROM auth_rate_limit WHERE key LIKE 'signin:ip:%'`);
    const direct = appWith({});
    await signInWrong(direct, { "x-forwarded-for": "6.6.6.6" }, { peerAddress: "10.9.8.7" });
    eq(await ipKeys(), ["signin:ip:10.9.8.7"], "peer counted, forged header ignored");
    await signInWrong(direct, {});
    eq(await ipKeys(), ["signin:ip:10.9.8.7"], "no address at all: no address counter, no crash");

    await q(`DELETE FROM auth_rate_limit WHERE key LIKE 'signin:ip:%'`);
    const proxied = appWith({ trustProxy: true });
    await signInWrong(proxied, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }, { peerAddress: "10.0.0.1" });
    await signInWrong(proxied, {}, { peerAddress: "10.0.0.2" });
    eq(await ipKeys(), ["signin:ip:1.2.3.4", "signin:ip:10.0.0.2"], "trusted proxy header first, else the peer");
  });

  test("withPeerAddress hands the socket's address to the app, not a header", async () => {
    await q(`DELETE FROM auth_rate_limit WHERE key LIKE 'signin:ip:%'`);
    const handler = withPeerAddress(appWith({}));
    const req = new Request("http://api.test/auth/sign-in", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": "6.6.6.6" }, body: JSON.stringify({ identifier: "nobody@example.com", password: "wrong password!!" }) });
    await handler(req, { requestIP: () => ({ address: "192.0.2.44" }) });
    eq(await ipKeys(), ["signin:ip:192.0.2.44"]);
  });
});

describe("CORS for trusted origins", () => {
  const preflight = (origin: string, extra: Record<string, string> = {}) =>
    app.request("/auth/sign-in", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type", ...extra } });

  test("a trusted origin's preflight is answered with credentials; others get no CORS headers", async () => {
    const ok = await preflight(ORIGIN);
    eq(ok.status, 204);
    eq([ok.headers.get("access-control-allow-origin"), ok.headers.get("access-control-allow-credentials")], [ORIGIN, "true"]);
    eq(ok.headers.get("access-control-allow-methods")?.includes("DELETE"), true);
    eq(ok.headers.get("access-control-allow-headers"), "content-type");
    eq(ok.headers.get("vary")?.includes("Origin"), true);
    // the same normalization as the CSRF guard: case and a trailing slash do not matter
    eq((await preflight("HTTPS://Admin.Example.Test/")).headers.get("access-control-allow-origin"), "HTTPS://Admin.Example.Test/");
    const evil = await preflight("https://evil.test");
    eq([evil.status, evil.headers.get("access-control-allow-origin"), evil.headers.get("access-control-allow-credentials")], [204, null, null]);
  });

  test("real responses carry the headers for a trusted origin, errors included, and never for a foreign one", async () => {
    const ok = await app.request("/auth/sign-in", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ identifier: "nobody@example.com", password: "wrong password!!" }) });
    eq(ok.status, 401);
    eq([ok.headers.get("access-control-allow-origin"), ok.headers.get("access-control-allow-credentials")], [ORIGIN, "true"]);
    const read = await app.request("/admin/payments", { headers: { origin: ORIGIN } });
    eq([read.status, read.headers.get("access-control-allow-origin")], [401, ORIGIN]);
    const missing = await app.request("/nope", { headers: { origin: ORIGIN } });
    eq([missing.status, missing.headers.get("access-control-allow-origin")], [404, ORIGIN]);
    const evil = await app.request("/auth/sign-in", { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: "{}" });
    eq([evil.status, evil.headers.get("access-control-allow-origin")], [403, null]);
  });
});

describe("attendance request hardening", () => {
  test("times, upper-case ids, branch-scoped summaries and the QR module gate over HTTP", async () => {
    const subjA = await id(`INSERT INTO subject (name) VALUES ('Hardening Maths')`);
    const mk = (branch: string, name: string) => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled, delivery_mode) VALUES ($1,$2,$3,'class','scheduled',true,'physical')`, [subjA, branch, name]);
    const [ca, cb] = [await mk(b1, "Hard A"), await mk(b2, "Hard B")];
    const pu = await newUser();
    const stu = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,'HARD1','Hard Pupil','2012-01-01')`, [pu]);
    for (const b of [b1, b2]) await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,$3)`, [stu, b, b === b1]);
    for (const c of [ca, cb]) await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2027-01-01')`, [c, stu]);
    const rootC = await staffCookie(root);

    // times
    const sess = (courseId: string, over: Record<string, unknown>) => post("/admin/attendance/sessions", { courseId, sessionDate: "2027-03-10", startsAt: "09:00", endsAt: "10:00", ...over }, rootC);
    eq((await sess(ca, { startsAt: "09:60" })).status, 400);
    eq((await sess(ca, { endsAt: "25:00" })).status, 400);
    const same = await sess(ca, { startsAt: "09:00", endsAt: "09:00:00" });
    eq([same.status, same.json.error.code], [422, "session_invalid"]);
    const a1 = await sess(ca, {});
    eq([a1.status, a1.json.session.startsAt], [201, "09:00:00"]);
    const b1s = await sess(cb, { startsAt: "09:00:00", endsAt: "10:00" });
    eq(b1s.status, 201);

    // upper-case student id
    const marked = await post(`/admin/attendance/sessions/${a1.json.session.id}/mark`, { entries: [{ studentId: stu.toUpperCase(), status: "present" }] }, rootC);
    eq([marked.status, marked.json.marked], [200, 1]);
    eq((await post(`/admin/attendance/sessions/${b1s.json.session.id}/mark`, { entries: [{ studentId: stu, status: "absent" }] }, rootC)).status, 200);

    // summary only for the caller's branches
    const reader = await newUser();
    await acl.assignRole({ userId: reader, roleName: "attendance_marker", branchId: b1, actor: root });
    const rc = await staffCookie(reader);
    eq((await get(`/admin/students/${stu}/attendance`, rootC)).json.sessions, 2);
    const mine = await get(`/admin/students/${stu}/attendance`, rc);
    eq([mine.status, mine.json.sessions, mine.json.present, mine.json.absent], [200, 1, 1, 0]);
    eq((await get(`/admin/students/${stu}/attendance?courseId=${cb}`, rc)).status, 403);
    eq((await get(`/admin/students/${stu}/attendance?courseId=${ca}`, rc)).json.sessions, 1);

    // QR rotation is gated by the module
    const tok = async () => String((await q(`SELECT qr_token FROM student WHERE id = $1`, [stu]))[0]!.qr_token);
    const before = await tok();
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"qr_attendance": false}'::jsonb`);
    try {
      const off = await post(`/admin/students/${stu}/rotate-qr`, {}, rootC);
      eq([off.status, off.json.error.code], [403, "module_disabled"]);
      eq(await tok(), before, "token untouched");
    } finally {
      await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"qr_attendance": true}'::jsonb`);
    }
    eq((await post(`/admin/students/${stu}/rotate-qr`, {}, rootC)).status, 200);
    eq((await tok()) !== before, true);
  });
});

describe("origin guard configuration and headerless writes", () => {
  const mk = (trustedOrigins: string[]) => appWith({ trustedOrigins });
  const write = (a: ReturnType<typeof appWith>, headers: Record<string, string>) =>
    a.request("/auth/sign-in", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ identifier: "nobody@example.com", password: "wrong password!!" }) });

  test("entries are canonical origins: default ports are dropped, other ports stay distinct", async () => {
    const a = mk(["https://admin.example.test:443", "http://plain.example.test:80", "https://Other.Example.Test:8443/"]);
    eq((await write(a, { origin: "https://admin.example.test" })).status, 401);
    eq((await write(a, { origin: "https://admin.example.test:443" })).status, 401);
    eq((await write(a, { origin: "http://plain.example.test" })).status, 401);
    eq((await write(a, { origin: "https://other.example.test:8443" })).status, 401);
    eq((await write(a, { origin: "https://other.example.test" })).status, 403);
    eq((await write(a, { origin: "http://admin.example.test" })).status, 403);
    eq((await write(a, { origin: "https://admin.example.test:8443" })).status, 403);
    eq((await write(a, { origin: "null" })).status, 403);
    const pre = await a.request("/auth/sign-in", { method: "OPTIONS", headers: { origin: "https://admin.example.test", "access-control-request-method": "POST" } });
    eq(pre.headers.get("access-control-allow-origin"), "https://admin.example.test");
  });

  test("an allowlist with an invalid entry is refused at start-up and names the entry", () => {
    const err = (list: string[]) => {
      try {
        mk(list);
      } catch (e) {
        return (e as Error).message;
      }
      return null;
    };
    for (const bad of [[" "], [""], ["admin.example.com"], ["ftp://admin.example.com"], ["https://admin.example.com/app"], ["https://admin.example.com?x=1"], ["https://user:pw@admin.example.com"]]) {
      eq(typeof err(bad), "string", JSON.stringify(bad));
    }
    eq(err([ORIGIN, "nope"])!.includes("trustedOrigins[1]"), true);
    eq(err([ORIGIN, " https://ok.example.test/ "]), null);
  });

  test("a write without Origin passes only when the browser says it is the same origin or there is no session cookie", async () => {
    const cookie = await staffCookie(root);
    const out = (headers: Record<string, string>) => app.request("/auth/sign-out", { method: "POST", headers });
    for (const site of ["same-site", "cross-site", "weird"]) {
      const r = await out({ cookie, "sec-fetch-site": site });
      eq([r.status, (await r.json()).error.code], [403, "bad_origin"], site);
    }
    const bare = await out({ cookie });
    eq([bare.status, (await bare.json()).error.code], [403, "bad_origin"], "cookie, no headers");
    eq((await get("/auth/me", cookie)).status, 200); // none of the refused sign-outs touched the session
    eq((await out({ "sec-fetch-site": "same-site" })).status, 403);
    eq((await out({})).status !== 403, true, "no cookie, no headers: server to server");
    eq((await out({ cookie: "other=1" })).status !== 403, true, "an unrelated cookie is not a session");
    eq((await out({ cookie, "sec-fetch-site": "same-origin" })).status !== 403, true);
    eq((await get("/auth/me", cookie)).status, 401, "a same-origin sign-out works");
  });
});

describe("unexpected errors are logged without personal data", () => {
  test("a failed student insert reaches the log as name, SQLSTATE, constraint and path only", async () => {
    const { sql } = await import("drizzle-orm");
    const { Hono } = await import("hono");
    const { onError } = await import("../src");
    // a real driver failure carrying personal values, as a failed student registration would
    const failing = () =>
      db.execute(sql`INSERT INTO student (student_no, full_name, date_of_birth, nic, phone, email) VALUES ('LOGSECRET1', 'Secret Pupil Name', ${"not-a-date"}, 'NIC-SECRET-123', '+94770001111', 'secret.parent@example.com')`);
    const thrown = await failing().then(() => null, (e: unknown) => e as Error);
    if (!thrown) throw new Error("the insert should have failed");
    eq(/Secret Pupil Name|NIC-SECRET-123|secret\.parent/.test(`${thrown.message} ${JSON.stringify((thrown as { cause?: unknown }).cause ?? "")}`), true, "the raw error does carry the data");

    const probe = new Hono();
    probe.onError(onError);
    probe.post("/students/:id", async () => {
      await failing();
      return new Response("unreachable");
    });
    probe.post("/plain", () => {
      throw new Error("programmer error");
    });
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const res = await probe.request("/students/abc", { method: "POST" });
      eq([res.status, (await res.json()).error.code], [500, "internal_error"]);
      const plain = await probe.request("/plain", { method: "POST" });
      eq(plain.status, 500);
    } finally {
      console.error = original;
    }
    eq(logged.length, 2);
    const first = logged[0]!;
    const text = first.map((a) => (typeof a === "string" ? a : JSON.stringify(a, Object.getOwnPropertyNames(Object(a))))).join(" ");
    for (const secret of ["Secret Pupil Name", "NIC-SECRET-123", "secret.parent@example.com", "+94770001111", "LOGSECRET1", "not-a-date", "INSERT INTO student"]) {
      eq(text.includes(secret), false, `the log must not contain ${secret}`);
    }
    const entry = first[1] as Record<string, unknown>;
    eq([entry.kind, entry.path, entry.method, typeof entry.code], ["database_error", "/students/abc", "POST", "string"]);
    eq(Object.keys(entry).sort(), ["code", "constraint", "kind", "method", "name", "path"].filter((k) => k in entry).sort());
    // an unexpected error that is not a query failure is still logged whole
    eq((logged[1]![1] as Error).message, "programmer error");
  });
});

describe("exam routes: shared exams and timestamps", () => {
  async function roleCookie(name: string, codes: string[], branchId: string | null) {
    await q(`INSERT INTO role (name, description) VALUES ($1, 'custom') ON CONFLICT DO NOTHING`, [name]);
    for (const code of codes) await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = $1 AND p.code = $2 ON CONFLICT DO NOTHING`, [name, code]);
    const u = await newUser();
    await acl.assignRole({ userId: u, roleName: name, branchId, actor: root });
    return staffCookie(u);
  }
  async function pupil(courseId: string, branch: string) {
    const userId = await newUser();
    const studentId = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,$2,$3,'2012-01-01')`, [userId, `SX${++n}`, `Shared ${n}`]);
    await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,true)`, [studentId, branch]);
    await q(`INSERT INTO enrollment (course_id, student_id, access_starts_on) VALUES ($1,$2,'2027-01-01')`, [courseId, studentId]);
    return studentId;
  }

  test("a manager of one branch sees and marks only that branch's results of a shared exam; root and the all-branches manager see all", async () => {
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "online_exams": true, "lecturer_portal": true}'::jsonb`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Shared Subject')`);
    const mkCourse = (branch: string, name: string) => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'class','scheduled',false)`, [subj, branch, name]);
    const [cA, cB] = [await mkCourse(b1, "Shared A"), await mkCourse(b2, "Shared B")];
    const lecId = await id(`INSERT INTO lecturer (full_name) VALUES ('Shared Lecturer')`);
    const rootCookie = await staffCookie(root);
    const made = await post("/admin/exams/exams", { lecturerId: lecId, title: "Shared paper", mode: "paper", courseIds: [cA, cB], examDate: "2027-03-20", maxMarks: 100 }, rootCookie);
    eq(made.status, 201);
    const examId = made.json.exam.id as string;
    eq((await post(`/admin/exams/exams/${examId}/publish`, {}, rootCookie)).status, 200);
    const [sA, sB] = [await pupil(cA, b1), await pupil(cB, b2)];
    const managerA = await roleCookie("exam_mgr_a", ["exams.manage"], b1);
    const managerAll = await roleCookie("exam_mgr_all", ["exams.manage"], null);

    // B's student is out of A's reach; the batch is refused as a whole, even with an A entry in it
    const mixed = await post(`/admin/exams/exams/${examId}/marks`, { entries: [{ studentId: sA, marks: 70 }, { studentId: sB, marks: 60 }] }, managerA);
    eq([mixed.status, mixed.json.error.code], [403, "forbidden"]);
    eq(Number((await q(`SELECT count(*)::int AS c FROM exam_result WHERE exam_id = $1`, [examId]))[0]!.c), 0, "nothing written");
    eq((await post(`/admin/exams/exams/${examId}/marks`, { entries: [{ studentId: sA, marks: 70 }] }, managerA)).status, 200);
    eq((await post(`/admin/exams/exams/${examId}/marks`, { entries: [{ studentId: sB, marks: 30 }] }, managerAll)).status, 200);

    const seen = async (cookie: string) => (await get(`/admin/exams/exams/${examId}/results`, cookie)).json;
    const a = await seen(managerA);
    eq([a.results.map((r: { studentId: string }) => r.studentId), a.count, a.average, a.highest], [[sA], 1, "70.00", "70.00"], "A only, aggregates too");
    for (const cookie of [managerAll, rootCookie]) {
      const all = await seen(cookie);
      eq([all.results.map((r: { studentId: string }) => r.studentId).sort(), all.count, all.average, all.highest], [[sA, sB].sort(), 2, "50.00", "70.00"], "everything");
    }
  });

  test("paper exam date and weight are validated as input errors, not database errors", async () => {
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "online_exams": true, "lecturer_portal": true}'::jsonb`);
    const lecId = await id(`INSERT INTO lecturer (full_name) VALUES ('Input Lecturer')`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Input Subject')`);
    const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Input Class','class','scheduled',false)`, [subj, b1]);
    const rootCookie = await staffCookie(root);
    const paper = { lecturerId: lecId, title: "Paper", mode: "paper", courseIds: [c], examDate: "2027-03-20", maxMarks: 100 };
    eq((await post("/admin/exams/exams", { ...paper, examDate: "2027-02-30" }, rootCookie)).status, 400, "impossible date");
    eq((await post("/admin/exams/exams", { ...paper, weight: "0" }, rootCookie)).status, 400, "zero weight");
    eq((await post("/admin/exams/exams", { ...paper, weight: 0 }, rootCookie)).status, 400, "numeric zero weight");
    eq((await post("/admin/exams/exams", { ...paper, maxMarks: "0.00" }, rootCookie)).status, 400, "zero total marks");
    const ok = await post("/admin/exams/exams", { ...paper, weight: "0.5" }, rootCookie);
    eq([ok.status, ok.json.exam.examDate, ok.json.exam.weight], [201, "2027-03-20", "0.50"], "valid values unchanged");
    // zero stays valid for marks earned
    eq((await post(`/admin/exams/exams/${ok.json.exam.id}/publish`, {}, rootCookie)).status, 200);
    const stu = await pupil(c, b1);
    eq((await post(`/admin/exams/exams/${ok.json.exam.id}/marks`, { entries: [{ studentId: stu, marks: 0 }] }, rootCookie)).status, 200, "zero marks earned");
  });

  test("with online_exams off every exam route answers module_disabled before it looks anything up", async () => {
    const rootCookie = await staffCookie(root);
    const none = "00000000-0000-4000-8000-000000000000";
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "lecturer_portal": true}'::jsonb`);
    try {
      for (const [m, path] of [["GET", `/admin/exams/exams/${none}/results`], ["POST", `/admin/exams/exams/${none}/publish`], ["POST", `/admin/exams/exams/${none}/marks`], ["PUT", `/admin/exams/questions/${none}`]] as const) {
        const r = await call(m, path, { body: m === "GET" ? undefined : {}, cookie: rootCookie });
        eq([path, r.status, r.json.error.code], [path, 403, "module_disabled"]);
      }
      eq((await get(`/admin/exams/exams/${none}/results`)).status, 401, "sign-in is still checked first");
    } finally {
      await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "online_exams": true, "lecturer_portal": true}'::jsonb`);
    }
    eq((await get(`/admin/exams/exams/${none}/results`, rootCookie)).status, 404, "module on: a missing exam is a 404");
  });

  test("exam times must be timestamps with an explicit zone; null, numbers and zone-less strings are refused, and omitted fields stay unset", async () => {
    const lecId = await id(`INSERT INTO lecturer (full_name) VALUES ('Time Lecturer')`);
    const subj = await id(`INSERT INTO subject (name) VALUES ('Time Subject')`);
    const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,'Time Class','class','scheduled',false)`, [subj, b1]);
    const rootCookie = await staffCookie(root);
    const base = { lecturerId: lecId, title: "Timed", mode: "online_mcq", courseIds: [c], maxAttempts: 1 };
    const closes = "2099-01-01T12:00:00Z";
    for (const bad of [null, 0, "2099-01-01T08:00:00", "2099-01-01", "soon"]) {
      eq((await post("/admin/exams/exams", { ...base, opensAt: bad, closesAt: closes }, rootCookie)).status, 400, `opensAt ${JSON.stringify(bad)}`);
    }
    eq((await post("/admin/exams/exams", { ...base, opensAt: "2099-01-01T08:00:00Z", closesAt: null }, rootCookie)).status, 400, "closesAt null");
    const ok = await post("/admin/exams/exams", { ...base, opensAt: "2099-01-01T13:30:00+05:30", closesAt: closes }, rootCookie);
    eq([ok.status, new Date(ok.json.exam.opensAt).toISOString()], [201, "2099-01-01T08:00:00.000Z"], "an offset is honoured");
    const missing = await post("/admin/exams/exams", { ...base, closesAt: closes }, rootCookie);
    eq([missing.status, missing.json.error.code], [422, "exam_invalid"]);
  });
});

describe("fixtures leave constraint enforcement on", () => {
  // Runs last: a fixture that skipped foreign keys and failed before restoring them would show here instead of silently weakening every later check.
  test("the connection is back in normal replication mode and foreign keys reject a dangling reference", async () => {
    eq((await q(`SHOW session_replication_role`))[0]!.session_replication_role, "origin", "role");
    let message = "";
    try {
      await q(`INSERT INTO enrollment (course_id, student_id) VALUES (gen_random_uuid(), gen_random_uuid())`);
    } catch (e) {
      message = String((e as Error).message);
    }
    eq(/foreign key|violates/i.test(message), true, "a dangling reference is refused");
  });
});
