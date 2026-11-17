/**
 * Scenario tests for effective access and the overdue rules (C8, C9) on PGlite. Run with: bun run db:test:access
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/schema";
import { seedDefaults } from "../src/seed";
import {
  accessState,
  createAccessService,
  evaluateOverdue,
  hasAccess,
  resolveOverdueSettings,
  ServiceError,
  createEnrollmentService,
  createInvoicingService,
  createPaymentService,
  hmacSigner,
  type Db,
} from "../src/services";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite({ extensions: { btree_gist } });
const db = drizzle(pg, { schema }) as unknown as Db;

let passed = 0;
let failed = 0;
const failures: string[] = [];
async function ok(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    const m = String((e as Error).message).slice(0, 400);
    failures.push(`${name} ${m}`);
    console.log(`FAIL  ${name}  -> ${m}`);
  }
}
function eq<T>(actual: T, expected: T, what = "value") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}
type Row = Record<string, unknown>;
const q = async (text: string, params: unknown[] = []): Promise<Row[]> =>
  (await pg.query<Row>(text, params)).rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])),
  );
const id = async (text: string, params: unknown[] = []) => String((await q(text + " RETURNING id", params))[0]!.id);

// ---- database
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
for (const e of journal.entries) await pg.exec(readFileSync(join(root, "drizzle", `${e.tag}.sql`), "utf8"));
await seedDefaults(db as never, { organizationName: "Test Institute", type: "institution" });
await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = jsonb_set(COALESCE(enabled_modules,'{}'::jsonb), '{commissions}', 'true')`);

const now = () => new Date("2027-03-10T10:00:00Z");
const access = createAccessService(db, { now });
const pay = createPaymentService(db, { signer: hmacSigner("s"), now, hooks: access.hooks });
const enrol = createEnrollmentService(db, { now });
const inv = createInvoicingService(db, { now });

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const staff = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);
const g6 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal OFFSET 5 LIMIT 1`))[0]!.id);
const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/1.jpg', 'image/jpeg', 1000)`);
const bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'T', '1')`, [b1]);
let n = 0;
let ref = 0;
const lecturer = () => id(`INSERT INTO lecturer (full_name) VALUES ($1)`, [`Lecturer ${++n}`]);
const setRule = (lec: string, calc: string, rate: number, scope: { course?: string; subject?: string; grade?: string } = {}) =>
  id(`INSERT INTO commission_rule (lecturer_id, course_id, subject_id, grade_level_id, calc_type, commission_rate, effective_from) VALUES ($1,$2,$3,$4,$5,$6,'2020-01-01')`, [
    lec, scope.course ?? null, scope.subject ?? null, scope.grade ?? null, calc, rate,
  ]);

/** A self-paced package course taught by the given lecturers, with a 10 000.00 package and the student enrolled (one invoice). */
async function scenario(teachers: { lec: string; share: number }[], price = 10000) {
  const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'program','self_paced',false)`, [subj, b1, `Course ${++n}`]);
  for (const [i, t] of teachers.entries()) {
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id, is_primary, share_percent) VALUES ($1,$2,$3,$4)`, [c, t.lec, i === 0, t.share]);
  }
  const f = await id(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type) VALUES ($1,$2,'Pkg',true,'one_time_package')`, [b1, c]);
  await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1,$2,'2020-01-01')`, [f, price]);
  const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`C${++n}`, `Student ${n}`]);
  await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1,$2,'2027-01-01')`, [s, g6]);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  const item = String((await q(`SELECT id FROM invoice_item WHERE invoice_id = $1`, [r.invoiceId]))[0]!.id);
  return { course: c, student: s, invoiceId: r.invoiceId!, item };
}
async function payIt(sc: { student: string; invoiceId: string }, amount: string) {
  const sub = await pay.submitPayment({ studentId: sc.student, branchId: b1, paymentMethodId: bankMethod, bankAccountId: bank, slipFileId: slip, amount, paidOn: "2027-03-10", referenceNo: `R${++ref}`, submittedBy: staff, invoiceIds: [sc.invoiceId] } as never);
  await pay.verifyPayment({ paymentId: sub.id, verifiedBy: staff });
  return sub.id as string;
}
const entries = (lec: string) => q(`SELECT * FROM commission_entry WHERE lecturer_id = $1 ORDER BY created_at, id`, [lec]);


async function code(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); } catch (e) { return e instanceof ServiceError ? e.code : `other: ${String((e as Error).message).slice(0, 200)}`; }
  return "no error";
}
const setAction = (a: string, grace = 7) => q(`UPDATE organization SET overdue_action = $1, overdue_grace_days = $2`, [a, grace]);
const enrolmentOf = async (studentId: string) => String((await q(`SELECT id FROM enrollment WHERE student_id = $1`, [studentId]))[0]!.id);
const accessStatus = async (enrolmentId: string) => String((await q(`SELECT access_status FROM enrollment WHERE id = $1`, [enrolmentId]))[0]!.access_status);
const invStatus = async (invoiceId: string) => String((await q(`SELECT status FROM invoice WHERE id = $1`, [invoiceId]))[0]!.status);
const dueOn = (invoiceId: string, date: string) => q(`UPDATE invoice SET issued_on = '2026-01-01', due_date = $2 WHERE id = $1`, [invoiceId, date]);
const notes = (userId: string) => q(`SELECT channel, status, event_key, payload FROM notification WHERE user_id = $1 ORDER BY channel, event_key`, [userId]);
async function withUser(studentId: string) {
  const u = await id(`INSERT INTO "user" (email) VALUES ($1)`, [`s${++n}@example.com`]);
  await q(`UPDATE student SET user_id = $2 WHERE id = $1`, [studentId, u]);
  return u;
}
/** An unpaid 10 000.00 package enrolment, due on the given day. */
async function owing(due: string) {
  const sc = await scenario([]);
  await dueOn(sc.invoiceId, due);
  return { ...sc, enrolment: await enrolmentOf(sc.student) };
}

// ---- pure
await ok("C8: effective access and the reason it is denied", async () => {
  const e = { status: "active", accessStartsOn: "2027-01-01", accessEndsOn: null, accessStatus: "active" };
  eq(accessState(e, "2027-03-10"), { allowed: true });
  eq(accessState({ ...e, status: "completed" }, "2027-03-10"), { allowed: true });
  eq(accessState({ ...e, status: "dropped" }, "2027-03-10"), { allowed: false, reason: "not_active" });
  eq(accessState(e, "2026-12-31"), { allowed: false, reason: "not_started" });
  eq(accessState({ ...e, accessEndsOn: "2027-03-10" }, "2027-03-09"), { allowed: true });
  eq(accessState({ ...e, accessEndsOn: "2027-03-10" }, "2027-03-10"), { allowed: false, reason: "ended" });
  eq(accessState({ ...e, accessStatus: "restricted" }, "2027-03-10"), { allowed: false, reason: "restricted" });
  eq(hasAccess(e, "2027-03-10"), true);
});
await ok("C9: settings come from the fee option field by field, else the organization", async () => {
  const org = { overdueGraceDays: 7, overdueAction: "notify" };
  eq(resolveOverdueSettings(org, null), { graceDays: 7, action: "notify", notify: true, restrict: false });
  eq(resolveOverdueSettings(org, { overdueGraceDays: null, overdueAction: null }).graceDays, 7);
  eq(resolveOverdueSettings(org, { overdueGraceDays: 30, overdueAction: null }), { graceDays: 30, action: "notify", notify: true, restrict: false });
  eq(resolveOverdueSettings(org, { overdueGraceDays: null, overdueAction: "restrict" }), { graceDays: 7, action: "restrict", notify: false, restrict: true });
  eq(resolveOverdueSettings(org, { overdueGraceDays: 0, overdueAction: "none" }), { graceDays: 0, action: "none", notify: false, restrict: false });
});
await ok("C9: overdue starts the day after the grace period, per installment when there are some", async () => {
  const inv = { dueDate: "2027-03-01", total: "100.00", amountPaid: "0.00", installments: [] };
  eq(evaluateOverdue(inv, 7, "2027-03-08").overdue, false);
  eq(evaluateOverdue(inv, 7, "2027-03-09").overdue, true);
  eq(evaluateOverdue(inv, 0, "2027-03-02").overdue, true);
  eq(evaluateOverdue({ ...inv, amountPaid: "100.00" }, 0, "2027-12-01").overdue, false);
  const inst = { ...inv, installments: [
    { seq: 1, dueDate: "2027-02-01", amount: "50.00", amountPaid: "50.00" },
    { seq: 2, dueDate: "2027-03-01", amount: "50.00", amountPaid: "10.00" },
  ] };
  eq(evaluateOverdue(inst, 7, "2027-03-08"), { overdue: false, installments: [{ seq: 1, overdue: false }, { seq: 2, overdue: false }] });
  eq(evaluateOverdue(inst, 7, "2027-03-09"), { overdue: true, installments: [{ seq: 1, overdue: false }, { seq: 2, overdue: true }] });
});

// ---- job
await ok("C9: the job marks the invoice overdue, restricts the enrolment, notifies once and audits", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  const user = await withUser(sc.student);
  const r = await access.runOverdueJob();
  eq(r.errors, []);
  eq(await invStatus(sc.invoiceId), "overdue");
  eq(await accessStatus(sc.enrolment), "restricted");
  const nt = await notes(user);
  eq(nt.map((x) => [x.channel, x.status, x.event_key]), [["in_app", "sent", `overdue:${sc.invoiceId}:0`]]);
  eq((nt[0]!.payload as Record<string, unknown>).amountDue, "10000.00");
  const [a] = await q(`SELECT actor_user_id, reason FROM audit_log WHERE action = 'access.restrict' AND entity_id = $1`, [sc.enrolment]);
  eq([a!.actor_user_id, a!.reason], [null, "overdue payment"]);
  const again = await access.runOverdueJob();
  eq([again.restricted, again.markedOverdue, again.notifications], [0, 0, 0]);
  eq((await notes(user)).length, 1);
  eq((await q(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'access.restrict' AND entity_id = $1`, [sc.enrolment]))[0]!.n, 1);
  eq((await access.getAccess({ enrollmentId: sc.enrolment })), { allowed: false, reason: "restricted" });
});
await ok("C9: inside the grace period nothing happens", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-03-05"); // grace 7 days: overdue from 2027-03-13
  await access.runOverdueJob();
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["pending", "active"]);
  await dueOn(sc.invoiceId, "2027-03-02"); // overdue from 2027-03-10, which is today
  await access.runOverdueJob();
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "restricted"]);
});
await ok("C9: the action decides what happens (notify, restrict, none)", async () => {
  const run = async (action: string) => {
    await setAction(action);
    const sc = await owing("2027-02-01");
    const user = await withUser(sc.student);
    await access.runOverdueJob();
    return [await invStatus(sc.invoiceId), await accessStatus(sc.enrolment), (await notes(user)).length];
  };
  eq(await run("notify"), ["overdue", "active", 1]);
  eq(await run("restrict"), ["overdue", "restricted", 0]);
  eq(await run("none"), ["overdue", "active", 0]);
  await setAction("notify_and_restrict");
});
await ok("C9: a fee option's own grace days and action override the organization's", async () => {
  await setAction("notify_and_restrict", 7);
  const sc = await owing("2027-02-01");
  const f = String((await q(`SELECT fee_structure_id FROM invoice_item WHERE invoice_id = $1`, [sc.invoiceId]))[0]!.fee_structure_id);
  await q(`UPDATE fee_structure SET overdue_grace_days = 60 WHERE id = $1`, [f]);
  await access.runOverdueJob();
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["pending", "active"]);
  await q(`UPDATE fee_structure SET overdue_grace_days = 5, overdue_action = 'notify' WHERE id = $1`, [f]);
  await access.runOverdueJob();
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "active"]);
});

// ---- payments
await ok("C9: a verified payment clears the restriction in the same transaction, with an audit row by the verifier", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  await access.runOverdueJob();
  eq(await accessStatus(sc.enrolment), "restricted");
  await payIt(sc, "10000");
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["paid", "active"]);
  const [a] = await q(`SELECT actor_user_id FROM audit_log WHERE action = 'access.restore' AND entity_id = $1`, [sc.enrolment]);
  eq(a!.actor_user_id, staff);
});
await ok("C9: a part-paid overdue invoice keeps the restriction", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  await access.runOverdueJob();
  await payIt(sc, "4000");
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "restricted"]);
  await payIt(sc, "6000");
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["paid", "active"]);
});
await ok("C9: voiding a payment on a past-grace invoice makes it overdue and restricts again at once", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  await access.runOverdueJob();
  const p = await payIt(sc, "10000");
  eq(await accessStatus(sc.enrolment), "active");
  await pay.voidPayment({ paymentId: p, voidedBy: staff, reason: "bounced" });
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "restricted"]);
});
await ok("C9: a restriction stays while another past-grace invoice of the enrolment is unpaid", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  const second = await inv.addInvoiceLine({ invoiceId: sc.invoiceId, kind: "adjustment", amount: "500", description: "Materials", createdBy: staff, reason: "r" });
  void second;
  await access.runOverdueJob();
  eq(await accessStatus(sc.enrolment), "restricted");
  await payIt(sc, "10500");
  eq(await accessStatus(sc.enrolment), "active");
});
await ok("C9: installments are judged one by one, and the invoice follows", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-06-01");
  await q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1,1,'2027-02-01',5000), ($1,2,'2027-06-01',5000)`, [sc.invoiceId]);
  const user = await withUser(sc.student);
  await access.runOverdueJob();
  eq((await q(`SELECT seq, status FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [sc.invoiceId])).map((x) => x.status), ["overdue", "pending"]);
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "restricted"]);
  eq((await notes(user)).map((x) => x.event_key), [`overdue:${sc.invoiceId}:1`]);
  await payIt(sc, "5000");
  eq((await q(`SELECT seq, status FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [sc.invoiceId])).map((x) => x.status), ["paid", "pending"]);
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["partial", "active"]);
});
await ok("C9: a cancelled invoice is ignored and releases its restriction", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  await access.runOverdueJob();
  eq(await accessStatus(sc.enrolment), "restricted");
  await inv.cancelInvoice({ invoiceId: sc.invoiceId, cancelledBy: staff, reason: "wrong" });
  const r = await access.runOverdueJob();
  eq(r.restored >= 1, true);
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["cancelled", "active"]);
});
await ok("C9: an enrolment that was dropped is left alone", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  await q(`UPDATE enrollment SET status = 'dropped', end_reason = 'dropped' WHERE id = $1`, [sc.enrolment]);
  await access.runOverdueJob();
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "active"]);
});

// ---- notifications
await ok("J1, J2: external channels need the module and the channel switch; guardians need the parent portal", async () => {
  await setAction("notify");
  const org = String((await q(`SELECT id FROM organization`))[0]!.id);
  const sc = await owing("2027-02-01");
  const user = await withUser(sc.student);
  const gUser = await id(`INSERT INTO "user" (email) VALUES ($1)`, [`g${++n}@example.com`]);
  const g = await id(`INSERT INTO guardian (user_id, full_name, portal_enabled) VALUES ($1,'Parent',true)`, [gUser]);
  await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [sc.student, g]);
  await q(`INSERT INTO notification_channel (organization_id, channel, is_enabled) VALUES ($1,'sms',true) ON CONFLICT (organization_id, channel) DO UPDATE SET is_enabled = true`, [org]);
  await access.runOverdueJob();
  eq((await notes(user)).map((x) => x.channel), ["in_app"]); // sms module is off
  eq((await notes(gUser)).length, 0); // parent portal is off
  await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"sms": true, "parent_portal": true}'::jsonb`);
  await q(`UPDATE invoice SET status = 'pending' WHERE id = $1`, [sc.invoiceId]);
  await access.runOverdueJob();
  eq((await notes(user)).map((x) => [x.channel, x.status]), [["in_app", "sent"], ["sms", "queued"]]);
  eq((await notes(gUser)).map((x) => x.channel), ["in_app", "sms"]);
  await access.runOverdueJob();
  eq((await notes(user)).length, 2);
  await q(`UPDATE organization SET enabled_modules = enabled_modules - 'sms' - 'parent_portal'`);
});
await ok("a student without a portal login still gets the status and the restriction", async () => {
  await setAction("notify_and_restrict");
  const sc = await owing("2027-02-01");
  await access.runOverdueJob();
  eq([await invStatus(sc.invoiceId), await accessStatus(sc.enrolment)], ["overdue", "restricted"]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
