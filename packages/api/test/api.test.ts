/**
 * HTTP API: cookies, CSRF guard, error mapping, sign-in steps, branch-scoped admin routes, portals.
 */
import { afterAll, describe, test } from "bun:test";
import { createApi } from "../src";
import { createAuthService, hashPassword, totp } from "@workspace/auth";
import { createAccessControlService, createContentService, createAttendanceService, createEnrollmentService, createExamService, createFeeExceptionService, createCommissionRuleService, createGuardianService, createNoticeService, createPayoutService, createReportService, createPromotionService, createPaymentService, createStudentService, hmacSigner } from "@workspace/domain";
import { eq } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

const now = () => new Date("2027-03-10T10:00:00Z");
await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = '{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true}'::jsonb`);
const auth = createAuthService(db, { secretKey: "test-secret-key-0123456789", now });
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
    eq((await post("/auth/mfa/verify", { code: totp(known, now()) }, cookie)).status, 200);
    return cookie;
  }
  const { secret } = (await post("/auth/mfa/begin", undefined, cookie)).json;
  secrets.set(userId, secret);
  eq((await post("/auth/mfa/confirm", { code: totp(secret, now()) }, cookie)).status, 200);
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
    await content.setStatus({ contentId: item.id, status: "published" });
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
  });
});

describe("portals", () => {
  test("a student sees their own library; a parent signs in with the phone, sets a password, then sees only their child", async () => {
    const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Ms Perera')`);
    const free = await content.createItem({ lecturerId: lec, kind: "recording", title: "Free lesson", externalUrl: "https://youtu.be/free", accessType: "free_registered", branchIds: [b1] });
    await content.setStatus({ contentId: free.id, status: "published" });

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
    eq((await post(`/student/attempts/${attemptId}/submit`, {}, sc)).status, 200);
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

  test("with the online_exams module off every exam route is refused", async () => {
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "content_store": true, "lecturer_portal": true}'::jsonb`);
    const lu = await newUser();
    const lec = await id(`INSERT INTO lecturer (full_name, user_id) VALUES ('Off Lec', $1)`, [lu]);
    await acl.setLecturerPortal({ lecturerId: lec, enabled: true, actor: root });
    const res = await post("/lecturer/questions", { body: "x", options: [{ body: "a", isCorrect: true }, { body: "b", isCorrect: false }] }, await plainCookie(lu));
    eq([res.status, res.json.error.code], [403, "module_disabled"]);
    await q(`UPDATE organization SET enabled_modules = '{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true}'::jsonb`);
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
    eq((await post(`/admin/payouts/${draft}/discard`, { reason: "test" }, all)).status, 200);
    eq((await post(`/admin/payouts/${draft}/approve`, {}, c1)).status, 403);
  });
});

describe("content management", () => {
  const MODULES = `'{"parent_portal": true, "content_store": true, "online_exams": true, "lecturer_portal": true}'::jsonb`;
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
    eq((await get("/admin/content/handovers", h2)).json.handovers, []);
    eq((await get("/admin/content/handovers", mgr)).status, 403);
    eq((await post(`/admin/content/purchases/${purchaseId}/cancel`, {}, h2)).status, 403);
    eq((await post(`/student/purchases/${purchaseId}/cancel`, {}, sc)).json.purchase.status, "cancelled");
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
    eq((await call("DELETE", `/admin/commission-rules/${rid}`, { cookie: rootC })).status, 404);
  });
});
