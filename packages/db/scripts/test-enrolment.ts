/**
 * Scenario tests for the enrolment, invoicing and fee exception services on PGlite. Run with: bun run db:test:enrolment
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
  addDays,
  addMonths,
  buildInstallmentSchedule,
  createEnrollmentService,
  createFeeExceptionService,
  createInvoicingService,
  createPaymentService,
  discountCents,
  hmacSigner,
  localDate,
  monthlyPeriods,
  ServiceError,
  type Db,
  type ServiceErrorCode,
} from "../src/services";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite({ extensions: { btree_gist } });
const db = drizzle(pg, { schema }) as unknown as Db;

let passed = 0;
let failed = 0;
const failures: string[] = [];
function record(ok: boolean, name: string, detail = "") {
  if (ok) passed++;
  else {
    failed++;
    failures.push(`${name} ${detail}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
}
async function ok(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    record(true, name);
  } catch (e) {
    record(false, name, String((e as Error).message).slice(0, 400));
  }
}
function eq<T>(actual: T, expected: T, what = "value") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}
async function fails(name: string, code: ServiceErrorCode, fn: () => Promise<unknown>) {
  try {
    await fn();
    record(false, name, "expected an error but it succeeded");
  } catch (e) {
    const err = e as ServiceError;
    record(err instanceof ServiceError && err.code === code, name, `got ${err.name}/${(err as { code?: string }).code}: ${err.message.slice(0, 200)}`);
  }
}
type Row = Record<string, unknown>;
const q = async (text: string, params: unknown[] = []): Promise<Row[]> =>
  (await pg.query<Row>(text, params)).rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])),
  );
const id = async (text: string, params: unknown[] = []) => String((await q(text + " RETURNING id", params))[0]!.id);

// ---- pure date and schedule maths
await ok("addDays and addMonths clamp to month end", async () => {
  eq(addDays("2027-02-27", 3), "2027-03-02");
  eq(addMonths("2027-01-31", 1), "2027-02-28");
  eq(addMonths("2028-01-31", 1), "2028-02-29");
  eq(addMonths("2027-03-15", 12), "2028-03-15");
});
await ok("monthlyPeriods are calendar months from the start month", async () => {
  const p = monthlyPeriods("2027-01-20", "2027-03-01");
  eq(p.map((x) => x.start), ["2027-01-01", "2027-02-01", "2027-03-01"]);
  eq(p[0]!.end, "2027-02-01");
});
await ok("localDate uses the time zone, not UTC", async () => {
  eq(localDate(new Date("2027-01-01T20:00:00Z"), "Asia/Colombo"), "2027-01-02");
  eq(localDate(new Date("2027-01-01T20:00:00Z"), "UTC"), "2027-01-01");
});
await ok("installment schedule: down payment first, sums exactly", async () => {
  const s = buildInstallmentSchedule({ total: 100000, count: 3, downPaymentPercent: "40", intervalDays: 30, issuedOn: "2027-01-01" });
  eq(s.map((x) => x.cents), [40000, 30000, 30000]);
  eq(s.map((x) => x.dueDate), ["2027-01-01", "2027-01-31", "2027-03-02"]);
  const t = buildInstallmentSchedule({ total: 10000, count: 3, downPaymentPercent: "0", intervalDays: 7, issuedOn: "2027-01-01" });
  eq(t.map((x) => x.cents), [3334, 3333, 3333]);
});
await ok("discountCents: percent rounds half up and never exceeds the base", async () => {
  eq(discountCents(100000, "percent", "10"), 10000);
  eq(discountCents(100000, "percent", "100"), 100000);
  eq(discountCents(5000, "fixed", "9000"), 5000);
  eq(discountCents(333, "percent", "50"), 167);
});

// ---- database
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
for (const e of journal.entries) await pg.exec(readFileSync(join(root, "drizzle", `${e.tag}.sql`), "utf8"));
await seedDefaults(db as never, { organizationName: "Test Institute", type: "institution" });
await q(`UPDATE organization SET timezone = 'UTC'`);

let clock = new Date("2027-03-10T10:00:00Z");
const now = () => clock;
const enrol = createEnrollmentService(db, { now });
const inv = createInvoicingService(db, { now });
const exc = createFeeExceptionService(db, { now });
const pay = createPaymentService(db, { signer: hmacSigner("s"), now });

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const staff = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);
const grade = async (name: string) => String((await q(`SELECT id FROM grade_level WHERE name = $1`, [name]))[0]!.id);
const g6 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal OFFSET 5 LIMIT 1`))[0]!.id);
const g7 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal OFFSET 6 LIMIT 1`))[0]!.id);
void grade;
const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
let n = 0;
const mkStudent = async (level?: string, from = "2027-01-01") => {
  const sid = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1, $2, '2014-05-01')`, [`E${++n}`, `Student ${n}`]);
  if (level) await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1, $2, $3)`, [sid, level, from]);
  return sid;
};
const mkCourse = (o: { kind?: string; mode?: string; capacity?: number | null; status?: string; branch?: string; term?: string | null } = {}) =>
  id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, capacity, status, term_id, attendance_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
    subj, o.branch ?? b1, `Course ${++n}`, o.kind ?? "class", o.mode ?? "scheduled", o.capacity ?? null, o.status ?? "active", o.term ?? null, (o.mode ?? "scheduled") !== "self_paced",
  ]);
const mkFee = (course: string, o: { type?: string; freq?: string | null; def?: boolean; months?: number | null; intake?: string | null; branch?: string; name?: string } = {}) =>
  id(`INSERT INTO fee_structure (branch_id, course_id, intake_id, name, is_default, billing_type, frequency, access_duration_months) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
    o.branch ?? b1, course, o.intake ?? null, o.name ?? `Fee ${++n}`, o.def ?? true, o.type ?? "recurring", o.type === "one_time_package" ? null : (o.freq ?? "monthly"), o.months ?? null,
  ]);
const mkRate = (fee: string, amount: number, grade: string | null, from = "2020-01-01", to: string | null = null) =>
  q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from, effective_to) VALUES ($1,$2,$3,$4,$5)`, [fee, grade, amount, from, to]);

// ---- enrolment
await ok("enrol into a class uses the default fee option, adds student_branch, no invoice", async () => {
  const c = await mkCourse();
  const f = await mkFee(c);
  await mkRate(f, 1000, null);
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  eq(r.enrollment.feeStructureId, f);
  eq(r.enrollment.accessStartsOn, "2027-03-10");
  eq(r.enrollment.accessEndsOn, null);
  eq(r.invoiceId, null);
  const sb = await q(`SELECT branch_id, is_primary FROM student_branch WHERE student_id = $1`, [s]);
  eq(sb.length, 1);
  eq(sb[0]!.is_primary, true);
  // a second branch is not primary
  const c2 = await mkCourse({ branch: b2 });
  const f2 = await mkFee(c2, { branch: b2 });
  await mkRate(f2, 500, null);
  await enrol.enrollStudent({ studentId: s, courseId: c2 });
  eq((await q(`SELECT count(*)::int n FROM student_branch WHERE student_id = $1 AND is_primary`, [s]))[0]!.n, 1);
  eq((await q(`SELECT count(*)::int n FROM student_branch WHERE student_id = $1`, [s]))[0]!.n, 2);
});
await ok("C4: enrolling twice is refused", async () => {
  const c = await mkCourse();
  await mkFee(c);
  const s = await mkStudent(g6);
  await enrol.enrollStudent({ studentId: s, courseId: c });
  let code = "";
  try { await enrol.enrollStudent({ studentId: s, courseId: c }); } catch (e) { code = (e as ServiceError).code; }
  eq(code, "duplicate_enrollment");
});
await fails("C5: a full course refuses", "capacity_full", async () => {
  const c = await mkCourse({ capacity: 1 });
  await mkFee(c);
  await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
});
await ok("C5: a dropped place frees the seat", async () => {
  const c = await mkCourse({ capacity: 1 });
  await mkFee(c);
  const a = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  await enrol.dropEnrollment({ enrollmentId: a.enrollment.id, actorUserId: staff, reason: "left" });
  await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
});
await fails("a draft course is not open", "course_not_open", async () => {
  const c = await mkCourse({ status: "draft" });
  await mkFee(c);
  await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
});
await fails("a suspended student cannot enrol", "student_not_eligible", async () => {
  const c = await mkCourse();
  await mkFee(c);
  const s = await mkStudent(g6);
  await q(`UPDATE student SET status = 'suspended' WHERE id = $1`, [s]);
  await enrol.enrollStudent({ studentId: s, courseId: c });
});
await ok("C6: grade list is enforced, and an override is audited", async () => {
  const c = await mkCourse();
  await mkFee(c);
  await q(`INSERT INTO course_grade_level (course_id, grade_level_id) VALUES ($1, $2)`, [c, g6]);
  const wrong = await mkStudent(g7);
  let code = "";
  try { await enrol.enrollStudent({ studentId: wrong, courseId: c }); } catch (e) { code = (e as ServiceError).code; }
  eq(code, "grade_not_allowed");
  let code2 = "";
  try { await enrol.enrollStudent({ studentId: wrong, courseId: c, gradeOverride: { by: staff, reason: " " } }); } catch (e) { code2 = (e as ServiceError).code; }
  eq(code2, "reason_required");
  await enrol.enrollStudent({ studentId: wrong, courseId: c, gradeOverride: { by: staff, reason: "Gifted student" } });
  eq((await q(`SELECT count(*)::int n FROM audit_log WHERE action = 'enrollment.grade_override'`))[0]!.n, 1);
  await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
});
await ok("C2/C3: scheduled programs need an open intake of their own", async () => {
  const c = await mkCourse({ kind: "program" });
  await mkFee(c);
  const other = await mkCourse({ kind: "program" });
  const it = await id(`INSERT INTO intake (course_id, name, starts_on, capacity) VALUES ($1, 'Batch 1', '2027-04-01', 1)`, [c]);
  const itOther = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'X', '2027-04-01')`, [other]);
  const s1 = await mkStudent(g6);
  const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: s1, courseId: c })), "intake_invalid");
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: s1, courseId: c, intakeId: itOther })), "intake_invalid");
  await enrol.enrollStudent({ studentId: s1, courseId: c, intakeId: it });
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, intakeId: it })), "capacity_full");
  await q(`UPDATE intake SET status = 'closed' WHERE id = $1`, [it]);
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, intakeId: it })), "intake_invalid");
  // classes and self-paced programs take no intake
  const cls = await mkCourse();
  await mkFee(cls);
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: s1, courseId: cls, intakeId: it })), "intake_invalid");
});
await ok("D1: fee option resolution (default, single, none, invalid)", async () => {
  const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
  const c = await mkCourse();
  const a = await mkFee(c, { def: false });
  const b = await mkFee(c, { def: false });
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c })), "fee_structure_required");
  const r = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, feeStructureId: b });
  eq(r.enrollment.feeStructureId, b);
  const other = await mkCourse();
  const foreign = await mkFee(other);
  eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, feeStructureId: foreign })), "fee_structure_invalid");
  await q(`UPDATE fee_structure SET is_default = true WHERE id = $1`, [a]);
  eq((await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c })).enrollment.feeStructureId, a);
  const solo = await mkCourse();
  const only = await mkFee(solo, { def: false });
  eq((await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: solo })).enrollment.feeStructureId, only);
});
await ok("D12: package enrolment issues an invoice and sets access end", async () => {
  const c = await mkCourse({ kind: "program", mode: "self_paced" });
  const f = await mkFee(c, { type: "one_time_package", months: 6 });
  await mkRate(f, 12000, null);
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  eq(r.enrollment.accessEndsOn, "2027-09-10");
  const i = (await q(`SELECT * FROM invoice WHERE id = $1`, [r.invoiceId]))[0]!;
  eq(i.total, "12000.00");
  eq(i.status, "pending");
  eq(i.due_date, "2027-03-17");
  const items = await q(`SELECT kind, amount, enrollment_id FROM invoice_item WHERE invoice_id = $1`, [r.invoiceId]);
  eq(items.length, 1);
  eq(items[0]!.kind, "package_fee");
  // lifetime access
  const c2 = await mkCourse({ kind: "program", mode: "self_paced" });
  const f2 = await mkFee(c2, { type: "one_time_package", months: null });
  await mkRate(f2, 100, null);
  eq((await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c2 })).enrollment.accessEndsOn, null);
});
await ok("D10: package with installments adds surcharge and a schedule", async () => {
  const c = await mkCourse({ kind: "program", mode: "self_paced" });
  const f = await mkFee(c, { type: "one_time_package", months: 12 });
  await mkRate(f, 10000, null);
  const plan = await id(`INSERT INTO installment_option (fee_structure_id, name, installment_count, down_payment_percent, interval_days, surcharge_percent) VALUES ($1,'3 pay',3,'40',30,'10')`, [f]);
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c, installmentOptionId: plan });
  const i = (await q(`SELECT * FROM invoice WHERE id = $1`, [r.invoiceId]))[0]!;
  eq(i.total, "11000.00");
  const ins = await q(`SELECT seq, amount, due_date FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [r.invoiceId]);
  eq(ins.map((x) => x.amount), ["4400.00", "3300.00", "3300.00"]);
  eq(i.due_date, ins[2]!.due_date);
  const items = await q(`SELECT kind, amount FROM invoice_item WHERE invoice_id = $1 ORDER BY kind`, [r.invoiceId]);
  eq(items.map((x) => x.kind), ["adjustment", "package_fee"]);
});
await fails("D6: a missing rate fails loudly and creates nothing", "rate_missing", async () => {
  const c = await mkCourse({ kind: "program", mode: "self_paced" });
  await mkFee(c, { type: "one_time_package" });
  const s = await mkStudent(g6);
  try { await enrol.enrollStudent({ studentId: s, courseId: c }); } finally {
    eq((await q(`SELECT count(*)::int n FROM enrollment WHERE student_id = $1`, [s]))[0]!.n, 0);
  }
});
await ok("C7: drop ends access and keeps history", async () => {
  const c = await mkCourse();
  await mkFee(c);
  const r = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  const d = await enrol.dropEnrollment({ enrollmentId: r.enrollment.id });
  eq(d.status, "dropped");
  eq(d.endReason, "dropped");
  eq(d.accessEndsOn, "2027-03-11");
  let code = "";
  try { await enrol.dropEnrollment({ enrollmentId: r.enrollment.id }); } catch (e) { code = (e as ServiceError).code; }
  eq(code, "invalid_input");
});

// ---- recurring invoice generation
const recurring = async (o: { rate?: number; start?: string; grade?: string | null } = {}) => {
  const c = await mkCourse();
  const f = await mkFee(c);
  if (o.rate !== undefined) await mkRate(f, o.rate, o.grade === undefined ? g6 : o.grade);
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  if (o.start) await q(`UPDATE enrollment SET access_starts_on = $2, enrolled_on = $2 WHERE id = $1`, [r.enrollment.id, o.start]);
  return { c, f, s, enr: r.enrollment.id };
};
await ok("D7: generates each due month once, and is idempotent", async () => {
  const { enr, s } = await recurring({ rate: 1500, start: "2027-01-15" });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq(rep.invoicesCreated.length, 1);
  eq(rep.invoicesCreated[0]!.periodStarts, ["2027-01-01", "2027-02-01", "2027-03-01"]);
  eq(rep.failures, []);
  const items = await q(`SELECT amount, period_start FROM invoice_item WHERE enrollment_id = $1 AND kind = 'recurring_fee' ORDER BY period_start`, [enr]);
  eq(items.map((x) => x.amount), ["1500.00", "1500.00", "1500.00"]);
  const i = (await q(`SELECT total, due_date, issued_on, student_id FROM invoice WHERE id = $1`, [rep.invoicesCreated[0]!.invoiceId]))[0]!;
  eq(i.total, "4500.00");
  eq(i.due_date, "2027-03-10");
  eq(i.student_id, s);
  const again = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq(again.invoicesCreated.length, 0);
  eq(again.alreadyInvoiced, 3);
  clock = new Date("2027-04-02T10:00:00Z");
  const next = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq(next.invoicesCreated[0]!.periodStarts, ["2027-04-01"]);
  clock = new Date("2027-03-10T10:00:00Z");
});
await ok("D24: one invoice per student, branch and due date across courses", async () => {
  const s = await mkStudent(g6);
  const mk = async (branch: string) => {
    const c = await mkCourse({ branch });
    const f = await mkFee(c, { branch });
    await mkRate(f, 1000, g6);
    const r = await enrol.enrollStudent({ studentId: s, courseId: c });
    await q(`UPDATE enrollment SET access_starts_on = '2027-03-01' WHERE id = $1`, [r.enrollment.id]);
    return r.enrollment.id;
  };
  const e1 = await mk(b1), e2 = await mk(b1), e3 = await mk(b2);
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [e1, e2, e3] });
  eq(rep.invoicesCreated.length, 2);
  const byBranch = new Map(rep.invoicesCreated.map((x) => [x.branchId, x]));
  eq((await q(`SELECT count(*)::int n FROM invoice_item WHERE invoice_id = $1`, [byBranch.get(b1)!.invoiceId]))[0]!.n, 2);
  eq((await q(`SELECT total FROM invoice WHERE id = $1`, [byBranch.get(b1)!.invoiceId]))[0]!.total, "2000.00");
});
await ok("D6: a missing rate is reported and nothing is billed", async () => {
  const { enr } = await recurring();
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq(rep.invoicesCreated.length, 0);
  eq(rep.failures.length, 1);
  eq(rep.failures[0]!.code, "rate_missing");
  eq((await q(`SELECT count(*)::int n FROM invoice_item WHERE enrollment_id = $1`, [enr]))[0]!.n, 0);
});
await ok("D6: the rate on the period start applies, grade first, then all-grades", async () => {
  const c = await mkCourse();
  const f = await mkFee(c);
  await mkRate(f, 900, null);
  await mkRate(f, 1000, g6, "2020-01-01", "2027-02-01");
  await mkRate(f, 1200, g6, "2027-02-01", null);
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  await q(`UPDATE enrollment SET access_starts_on = '2027-01-01' WHERE id = $1`, [r.enrollment.id]);
  await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
  const items = await q(`SELECT amount FROM invoice_item WHERE enrollment_id = $1 ORDER BY period_start`, [r.enrollment.id]);
  eq(items.map((x) => x.amount), ["1000.00", "1200.00", "1200.00"]);
  // a student with no grade uses the all-grades rate
  const c2 = await mkCourse();
  const f2 = await mkFee(c2);
  await mkRate(f2, 900, null);
  await mkRate(f2, 1000, g6);
  const none = await mkStudent();
  const r2 = await enrol.enrollStudent({ studentId: none, courseId: c2 });
  await inv.generateRecurringInvoices({ enrollmentIds: [r2.enrollment.id] });
  eq((await q(`SELECT amount FROM invoice_item WHERE enrollment_id = $1`, [r2.enrollment.id]))[0]!.amount, "900.00");
});
await ok("B8: a pinned billing grade keeps the old rate after promotion", async () => {
  const c = await mkCourse();
  const f = await mkFee(c);
  await mkRate(f, 1000, g6);
  await mkRate(f, 1500, g7);
  const s = await mkStudent(g7);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c, billingGradeLevelId: g6 });
  await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
  eq((await q(`SELECT amount, grade_level_id FROM invoice_item WHERE enrollment_id = $1`, [r.enrollment.id]))[0]!.amount, "1000.00");
});
await ok("access end stops billing", async () => {
  const { enr } = await recurring({ rate: 800, start: "2027-01-01" });
  await q(`UPDATE enrollment SET access_ends_on = '2027-03-01' WHERE id = $1`, [enr]);
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq(rep.invoicesCreated[0]!.periodStarts, ["2027-01-01", "2027-02-01"]);
});
await ok("per-term fees bill the term once, and fail without a term", async () => {
  const term = await id(`INSERT INTO academic_term (name, starts_on, ends_on) VALUES ('T1', '2027-03-01', '2027-06-30')`);
  const c = await mkCourse({ term });
  const f = await mkFee(c, { freq: "per_term" });
  await mkRate(f, 6000, null);
  const r = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
  eq(rep.invoicesCreated[0]!.periodStarts, ["2027-03-01"]);
  eq((await q(`SELECT period_end FROM invoice_item WHERE enrollment_id = $1`, [r.enrollment.id]))[0]!.period_end, "2027-07-01");
  const c2 = await mkCourse();
  const f2 = await mkFee(c2, { freq: "per_term" });
  await mkRate(f2, 6000, null);
  const r2 = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c2 });
  const rep2 = await inv.generateRecurringInvoices({ enrollmentIds: [r2.enrollment.id] });
  eq(rep2.failures.length, 1);
});
await ok("catch-up is bounded by maxPeriodsPerEnrollment, oldest first", async () => {
  const { enr } = await recurring({ rate: 100, start: "2026-01-01", grade: null });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr], maxPeriodsPerEnrollment: 2 });
  eq(rep.invoicesCreated[0]!.periodStarts, ["2026-01-01", "2026-02-01"]);
});
await ok("leadDays bills the next month early", async () => {
  clock = new Date("2027-03-28T10:00:00Z");
  const { enr } = await recurring({ rate: 100, start: "2027-03-01" });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr], leadDays: 7 });
  eq(rep.invoicesCreated.flatMap((x) => x.periodStarts).sort(), ["2027-03-01", "2027-04-01"]);
  clock = new Date("2027-03-10T10:00:00Z");
});

// ---- fee exceptions
const onModule = () => q(`UPDATE organization SET enabled_modules = jsonb_set(COALESCE(enabled_modules, '{}'::jsonb), '{fee_exceptions}', 'true')`);
const offModule = () => q(`UPDATE organization SET enabled_modules = jsonb_set(COALESCE(enabled_modules, '{}'::jsonb), '{fee_exceptions}', 'false')`);
await fails("D21: fee exceptions need the module switched on", "module_disabled", async () => {
  await offModule();
  const { enr } = await recurring({ rate: 1000 });
  await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "percent", discountValue: "10", effectiveFrom: "2027-03-01", reason: "x", createdBy: staff });
});
await onModule();
await ok("D19: a percent discount is a negative line linked to the fee and the exception", async () => {
  const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
  const ex = await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "percent", discountValue: "25", effectiveFrom: "2027-03-01", reason: "Sibling", createdBy: staff });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  const i = (await q(`SELECT * FROM invoice WHERE id = $1`, [rep.invoicesCreated[0]!.invoiceId]))[0]!;
  eq(i.total, "750.00");
  eq(i.discount_total, "250.00");
  eq(i.subtotal, "1000.00");
  const d = (await q(`SELECT amount, applies_to_item_id, fee_exception_id FROM invoice_item WHERE invoice_id = $1 AND kind = 'discount'`, [i.id]))[0]!;
  eq(d.amount, "-250.00");
  eq(d.fee_exception_id, ex.id);
  eq(d.applies_to_item_id !== null, true);
});
await ok("D9/D19: a 100% discount makes a waived zero invoice", async () => {
  const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
  await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "percent", discountValue: "100", effectiveFrom: "2027-03-01", reason: "Scholarship", createdBy: staff });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  const i = (await q(`SELECT total, status FROM invoice WHERE id = $1`, [rep.invoicesCreated[0]!.invoiceId]))[0]!;
  eq(i.total, "0.00");
  eq(i.status, "waived");
});
await ok("D20: an alternate option replaces the fee for its dates only", async () => {
  const c = await mkCourse();
  const f = await mkFee(c);
  const alt = await mkFee(c, { def: false, name: "Reduced" });
  await mkRate(f, 1000, null);
  await mkRate(alt, 400, null);
  const r = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  await q(`UPDATE enrollment SET access_starts_on = '2027-01-01' WHERE id = $1`, [r.enrollment.id]);
  await exc.createFeeException({ enrollmentId: r.enrollment.id, kind: "alternate_option", alternateFeeStructureId: alt, effectiveFrom: "2027-02-01", effectiveTo: "2027-03-01", reason: "Hardship", createdBy: staff });
  await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
  const items = await q(`SELECT amount, fee_structure_id FROM invoice_item WHERE enrollment_id = $1 ORDER BY period_start`, [r.enrollment.id]);
  eq(items.map((x) => x.amount), ["1000.00", "400.00", "1000.00"]);
  eq(items[1]!.fee_structure_id, alt);
  eq((await q(`SELECT fee_structure_id FROM enrollment WHERE id = $1`, [r.enrollment.id]))[0]!.fee_structure_id, f);
});
await ok("D21: an active exception keeps applying after the module is switched off", async () => {
  await onModule();
  const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
  await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "fixed", discountValue: "300", effectiveFrom: "2027-03-01", reason: "r", createdBy: staff });
  await offModule();
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq((await q(`SELECT total FROM invoice WHERE id = $1`, [rep.invoicesCreated[0]!.invoiceId]))[0]!.total, "700.00");
  await onModule();
});
await ok("exception validation, overlap, and ending", async () => {
  const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
  const base = { enrollmentId: enr, createdBy: staff, reason: "r" };
  const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
  eq(await codeOf(async () => exc.createFeeException({ ...base, kind: "discount", discountType: "percent", discountValue: "150", effectiveFrom: "2027-03-01" })), "exception_invalid");
  eq(await codeOf(async () => exc.createFeeException({ ...base, kind: "discount", effectiveFrom: "2027-03-01" })), "exception_invalid");
  eq(await codeOf(async () => exc.createFeeException({ ...base, kind: "discount", discountType: "fixed", discountValue: "10", effectiveFrom: "2027-03-01", effectiveTo: "2027-03-01" })), "exception_invalid");
  eq(await codeOf(async () => exc.createFeeException({ ...base, reason: "", kind: "discount", discountType: "fixed", discountValue: "10", effectiveFrom: "2027-03-01" })), "reason_required");
  const other = await mkCourse();
  const foreign = await mkFee(other);
  eq(await codeOf(async () => exc.createFeeException({ ...base, kind: "alternate_option", alternateFeeStructureId: foreign, effectiveFrom: "2027-03-01" })), "exception_invalid");
  const ex = await exc.createFeeException({ ...base, kind: "discount", discountType: "fixed", discountValue: "10", effectiveFrom: "2027-03-01" });
  eq(await codeOf(async () => exc.createFeeException({ ...base, kind: "discount", discountType: "fixed", discountValue: "20", effectiveFrom: "2027-04-01" })), "exception_invalid");
  const ended = await exc.endFeeException({ exceptionId: ex.id, endedBy: staff, effectiveTo: "2027-04-01" });
  eq(ended.effectiveTo, "2027-04-01");
  eq(await codeOf(async () => exc.endFeeException({ exceptionId: ex.id, endedBy: staff, effectiveTo: "2027-05-01" })), "exception_invalid");
  await exc.createFeeException({ ...base, kind: "discount", discountType: "fixed", discountValue: "20", effectiveFrom: "2027-04-01" });
});

// ---- adjustments and cancellation
const packageInvoice = async (installments = false) => {
  const c = await mkCourse({ kind: "program", mode: "self_paced" });
  const f = await mkFee(c, { type: "one_time_package", months: 6 });
  await mkRate(f, 10000, null);
  const plan = installments
    ? await id(`INSERT INTO installment_option (fee_structure_id, name, installment_count, down_payment_percent, interval_days, surcharge_percent) VALUES ($1,'p',3,'0',30,'0')`, [f])
    : undefined;
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c, installmentOptionId: plan });
  const item = String((await q(`SELECT id FROM invoice_item WHERE invoice_id = $1`, [r.invoiceId]))[0]!.id);
  return { invoiceId: r.invoiceId!, item, student: s, branch: b1 };
};
const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/1.jpg', 'image/jpeg', 1000)`);
const bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'T', '1')`, [b1]);
let ref = 0;
const payInvoice = async (p: { student: string; invoiceId: string }, amount: string) => {
  const sub = await pay.submitPayment({ studentId: p.student, branchId: b1, paymentMethodId: bankMethod, bankAccountId: bank, slipFileId: slip, amount, paidOn: "2027-03-10", referenceNo: `R${++ref}`, submittedBy: staff, invoiceIds: [p.invoiceId] } as never);
  await pay.verifyPayment({ paymentId: sub.id, verifiedBy: staff });
  return sub;
};
await ok("D8/D23: a discount line updates totals and keeps old lines unchanged", async () => {
  const p = await packageInvoice();
  const before = (await q(`SELECT amount FROM invoice_item WHERE id = $1`, [p.item]))[0]!.amount;
  const r = await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-1500", appliesToItemId: p.item, description: "Goodwill", createdBy: staff, reason: "Late start" });
  eq(r.invoice.total, "8500.00");
  eq(r.invoice.discountTotal, "1500.00");
  eq(r.invoice.subtotal, "10000.00");
  eq((await q(`SELECT amount FROM invoice_item WHERE id = $1`, [p.item]))[0]!.amount, before);
  eq((await q(`SELECT count(*)::int n FROM audit_log WHERE action = 'invoice.add_discount'`))[0]!.n, 1);
});
await ok("D25: installments are re-spread after an adjustment", async () => {
  const p = await packageInvoice(true);
  await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "adjustment", amount: "500", description: "Extra", createdBy: staff, reason: "Materials" });
  const ins = await q(`SELECT amount FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [p.invoiceId]);
  eq(ins.map((x) => x.amount), ["3500.00", "3500.00", "3500.00"]);
  await payInvoice(p, "3500");
  await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-1000", appliesToItemId: p.item, description: "d", createdBy: staff, reason: "r" });
  const after = await q(`SELECT amount, amount_paid, status FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [p.invoiceId]);
  eq(after.map((x) => x.amount), ["3500.00", "3000.00", "3000.00"]);
  eq(after[0]!.status, "paid");
  const i = (await q(`SELECT total, amount_paid, status FROM invoice WHERE id = $1`, [p.invoiceId]))[0]!;
  eq(i.total, "9500.00");
  eq(i.amount_paid, "3500.00");
  eq(i.status, "partial");
});
await fails("D26: a change that puts the total below what is paid is refused", "total_below_paid", async () => {
  const p = await packageInvoice();
  await payInvoice(p, "6000");
  await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-5000", appliesToItemId: p.item, description: "d", createdBy: staff, reason: "r" });
});
await ok("adjustment validation", async () => {
  const p = await packageInvoice();
  const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
  const base = { invoiceId: p.invoiceId, description: "d", createdBy: staff, reason: "r" };
  eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "discount", amount: "500", appliesToItemId: p.item })), "invalid_input");
  eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "discount", amount: "-500" })), "invalid_input");
  eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "adjustment", amount: "0" })), "invalid_input");
  eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "discount", amount: "-20000", appliesToItemId: p.item })), "invalid_input");
  eq(await codeOf(async () => inv.addInvoiceLine({ ...base, reason: " ", kind: "adjustment", amount: "10" })), "reason_required");
});
await ok("a full discount turns the invoice into a waived zero invoice", async () => {
  const p = await packageInvoice();
  const r = await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-10000", appliesToItemId: p.item, description: "Free", createdBy: staff, reason: "Scholarship" });
  eq(r.invoice.total, "0.00");
  eq(r.invoice.status, "waived");
});
await ok("D26: cancel works without payments and frees the recurring period", async () => {
  const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
  const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  const iid = rep.invoicesCreated[0]!.invoiceId;
  const c = await inv.cancelInvoice({ invoiceId: iid, cancelledBy: staff, reason: "Wrong class" });
  eq(c.status, "cancelled");
  eq((await q(`SELECT count(*)::int n FROM invoice_item WHERE invoice_id = $1 AND cancelled_at IS NULL`, [iid]))[0]!.n, 0);
  const again = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
  eq(again.invoicesCreated.length, 1);
  eq(again.invoicesCreated[0]!.periodStarts, ["2027-03-01"]);
  eq((await inv.cancelInvoice({ invoiceId: iid, cancelledBy: staff, reason: "again" })).status, "cancelled");
});
await fails("D26: an invoice with payments cannot be cancelled", "invoice_has_payments", async () => {
  const p = await packageInvoice();
  await payInvoice(p, "1000");
  await inv.cancelInvoice({ invoiceId: p.invoiceId, cancelledBy: staff, reason: "x" });
});
await fails("a cancelled invoice cannot be adjusted", "invoice_not_adjustable", async () => {
  const p = await packageInvoice();
  await inv.cancelInvoice({ invoiceId: p.invoiceId, cancelledBy: staff, reason: "x" });
  await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "adjustment", amount: "10", description: "d", createdBy: staff, reason: "r" });
});
await ok("cash payments take the date in the organization's time zone", async () => {
  await q(`UPDATE organization SET timezone = 'Asia/Colombo'`);
  clock = new Date("2027-03-10T20:00:00Z");
  const p = await packageInvoice();
  const r = await pay.recordCashPayment({ studentId: p.student, branchId: b1, amount: "1000", recordedBy: staff, invoiceIds: [p.invoiceId] } as never);
  eq((await q(`SELECT paid_on FROM payment WHERE id = $1`, [(r as { id?: string; payment?: { id: string } }).id ?? (r as { payment: { id: string } }).payment.id]))[0]!.paid_on, "2027-03-11");
  await q(`UPDATE organization SET timezone = 'UTC'`);
  clock = new Date("2027-03-10T10:00:00Z");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
