/**
 * Enrolment, recurring and package invoicing, invoice adjustment and cancellation, fee exceptions (C, D rules).
 */
import { afterAll, beforeAll, describe, test } from "bun:test";
import {
  createEnrollmentService,
  createFeeExceptionService,
  createInvoicingService,
  createPaymentService,
  hmacSigner,
  ServiceError,
} from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

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

const recurring = async (o: { rate?: number; start?: string; grade?: string | null } = {}) => {
  const c = await mkCourse();
  const f = await mkFee(c);
  if (o.rate !== undefined) await mkRate(f, o.rate, o.grade === undefined ? g6 : o.grade);
  const s = await mkStudent(g6);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  if (o.start) await q(`UPDATE enrollment SET access_starts_on = $2, enrolled_on = $2 WHERE id = $1`, [r.enrollment.id, o.start]);
  return { c, f, s, enr: r.enrollment.id };
};

const onModule = () => q(`UPDATE organization SET enabled_modules = jsonb_set(COALESCE(enabled_modules, '{}'::jsonb), '{fee_exceptions}', 'true')`);

const offModule = () => q(`UPDATE organization SET enabled_modules = jsonb_set(COALESCE(enabled_modules, '{}'::jsonb), '{fee_exceptions}', 'false')`);

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

const payInvoice = async (p: { student: string; invoiceId: string }, amount: string) => {
  const sub = await pay.submitPayment({ studentId: p.student, branchId: b1, paymentMethodId: bankMethod, bankAccountId: bank, slipFileId: slip, amount, paidOn: "2027-03-10", referenceNo: `R${++ref}`, submittedBy: staff, invoiceIds: [p.invoiceId] } as never);
  await pay.verifyPayment({ paymentId: sub.id, verifiedBy: staff });
  return sub;
};

let slip: string;
let bankMethod: string;
let bank: string;
let ref: number;

describe("Enrolment, recurring and package invoicing", () => {
  test("enrol into a class uses the default fee option, adds student_branch, no invoice", async () => {
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
  test("C4: enrolling twice is refused", async () => {
    const c = await mkCourse();
    await mkFee(c);
    const s = await mkStudent(g6);
    await enrol.enrollStudent({ studentId: s, courseId: c });
    let code = "";
    try { await enrol.enrollStudent({ studentId: s, courseId: c }); } catch (e) { code = (e as ServiceError).code; }
    eq(code, "duplicate_enrollment");
  });
  test("C5: a full course refuses", () => fails("capacity_full", async () => {
    const c = await mkCourse({ capacity: 1 });
    await mkFee(c);
    await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
    await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  }));
  test("C5: a dropped place frees the seat", async () => {
    const c = await mkCourse({ capacity: 1 });
    await mkFee(c);
    const a = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
    await enrol.dropEnrollment({ enrollmentId: a.enrollment.id, actorUserId: staff, reason: "left" });
    await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  });
  test("a draft course is not open", () => fails("course_not_open", async () => {
    const c = await mkCourse({ status: "draft" });
    await mkFee(c);
    await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
  }));
  test("a suspended student cannot enrol", () => fails("student_not_eligible", async () => {
    const c = await mkCourse();
    await mkFee(c);
    const s = await mkStudent(g6);
    await q(`UPDATE student SET status = 'suspended' WHERE id = $1`, [s]);
    await enrol.enrollStudent({ studentId: s, courseId: c });
  }));
  test("C6: grade list is enforced, and an override is audited", async () => {
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
  test("C2/C3: scheduled programs need an open intake of their own", async () => {
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
  test("D1: fee option resolution (default, single, none, invalid)", async () => {
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
  test("D1/D12: a course with no fee structure is free: enrolled with no fee option and no invoice", async () => {
    const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
    const free = await mkCourse();
    const s = await mkStudent(g6);
    const r = await enrol.enrollStudent({ studentId: s, courseId: free });
    eq([r.enrollment.feeStructureId, r.invoiceId], [null, null]);
    eq((await q(`SELECT count(*)::int n FROM invoice WHERE student_id = $1`, [s]))[0]!.n, 0);
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
    eq(rep.invoicesCreated.length, 0);
    // an explicit but invalid choice, an installment plan on a free course, and a course whose only fee option is switched off are still refused
    eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: free, feeStructureId: await mkFee(await mkCourse()) })), "fee_structure_invalid");
    eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: free, installmentOptionId: free })), "invalid_input");
    const off = await mkCourse();
    await q(`UPDATE fee_structure SET is_active = false WHERE id = $1`, [await mkFee(off)]);
    eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: off })), "fee_structure_required");
  });
  test("C5: course capacity applies only without an intake; each intake has its own", async () => {
    const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
    const c = await mkCourse({ kind: "program", capacity: 1 });
    await mkFee(c);
    const a = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'A', '2027-04-01')`, [c]);
    const b = await id(`INSERT INTO intake (course_id, name, starts_on, capacity) VALUES ($1, 'B', '2027-05-01', 1)`, [c]);
    await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, intakeId: a });
    await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, intakeId: b });
    eq(await codeOf(async () => enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c, intakeId: b })), "capacity_full");
  });
  test("B7: the first branch is primary, a repeat of a branch adds nothing", async () => {
    const s = await mkStudent(g6);
    const c1 = await mkCourse({ branch: b1 }), c2 = await mkCourse({ branch: b2 }), c3 = await mkCourse({ branch: b1 });
    for (const c of [c1, c2, c3]) await mkFee(c, { branch: (await q(`SELECT branch_id FROM course WHERE id = $1`, [c]))[0]!.branch_id as string });
    for (const c of [c1, c2, c3]) await enrol.enrollStudent({ studentId: s, courseId: c });
    const rows = await q(`SELECT branch_id, is_primary FROM student_branch WHERE student_id = $1 ORDER BY is_primary DESC`, [s]);
    eq(rows.length, 2);
    eq(rows.filter((r) => r.is_primary).map((r) => r.branch_id), [b1]);
  });
  test("D12: package enrolment issues an invoice and sets access end", async () => {
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
  test("D10: package with installments adds surcharge and a schedule", async () => {
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
  test("D6: a missing rate fails loudly and creates nothing", () => fails("rate_missing", async () => {
    const c = await mkCourse({ kind: "program", mode: "self_paced" });
    await mkFee(c, { type: "one_time_package" });
    const s = await mkStudent(g6);
    try { await enrol.enrollStudent({ studentId: s, courseId: c }); } finally {
      eq((await q(`SELECT count(*)::int n FROM enrollment WHERE student_id = $1`, [s]))[0]!.n, 0);
    }
  }));
  test("C7: drop ends access and keeps history", async () => {
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
  test("D7: generates each due month once, and is idempotent", async () => {
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
  test("D24: one invoice per student, branch and due date across courses", async () => {
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
  test("D6: a missing rate is reported and nothing is billed", async () => {
    const { enr } = await recurring();
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
    eq(rep.invoicesCreated.length, 0);
    eq(rep.failures.length, 1);
    eq(rep.failures[0]!.code, "rate_missing");
    eq((await q(`SELECT count(*)::int n FROM invoice_item WHERE enrollment_id = $1`, [enr]))[0]!.n, 0);
  });
  test("D6: the rate on the period start applies, grade first, then all-grades", async () => {
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
  test("B8: a pinned billing grade keeps the old rate after promotion", async () => {
    const c = await mkCourse();
    const f = await mkFee(c);
    await mkRate(f, 1000, g6);
    await mkRate(f, 1500, g7);
    const s = await mkStudent(g7);
    const r = await enrol.enrollStudent({ studentId: s, courseId: c, billingGradeLevelId: g6 });
    await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
    eq((await q(`SELECT amount, grade_level_id FROM invoice_item WHERE enrollment_id = $1`, [r.enrollment.id]))[0]!.amount, "1000.00");
  });
  test("access end stops billing", async () => {
    const { enr } = await recurring({ rate: 800, start: "2027-01-01" });
    await q(`UPDATE enrollment SET access_ends_on = '2027-03-01' WHERE id = $1`, [enr]);
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
    eq(rep.invoicesCreated[0]!.periodStarts, ["2027-01-01", "2027-02-01"]);
  });
  test("per-term fees bill the term once, and fail without a term", async () => {
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
  test("catch-up is bounded by maxPeriodsPerEnrollment, oldest first", async () => {
    const { enr } = await recurring({ rate: 100, start: "2026-01-01", grade: null });
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr], maxPeriodsPerEnrollment: 2 });
    eq(rep.invoicesCreated[0]!.periodStarts, ["2026-01-01", "2026-02-01"]);
  });
  test("leadDays bills the next month early", async () => {
    clock = new Date("2027-03-28T10:00:00Z");
    const { enr } = await recurring({ rate: 100, start: "2027-03-01" });
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr], leadDays: 7 });
    eq(rep.invoicesCreated.flatMap((x) => x.periodStarts).sort(), ["2027-03-01", "2027-04-01"]);
    clock = new Date("2027-03-10T10:00:00Z");
  });
  test("D21: fee exceptions need the module switched on", () => fails("module_disabled", async () => {
    await offModule();
    const { enr } = await recurring({ rate: 1000 });
    await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "percent", discountValue: "10", effectiveFrom: "2027-03-01", reason: "x", createdBy: staff });
  }));
});

describe("Fee exceptions (D19 to D21)", () => {
  beforeAll(async () => {
    await onModule();
  });

  test("D19: a percent discount is a negative line linked to the fee and the exception", async () => {
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
  test("D9/D19: a 100% discount makes a waived zero invoice", async () => {
    const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
    await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "percent", discountValue: "100", effectiveFrom: "2027-03-01", reason: "Scholarship", createdBy: staff });
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
    const i = (await q(`SELECT total, status FROM invoice WHERE id = $1`, [rep.invoicesCreated[0]!.invoiceId]))[0]!;
    eq(i.total, "0.00");
    eq(i.status, "waived");
  });
  test("D20: an alternate option replaces the fee for its dates only", async () => {
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
  test("D20: an alternate option must bill on the same cycle as the enrolled option", async () => {
    await onModule();
    const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
    const c = await mkCourse();
    const f = await mkFee(c);
    const termAlt = await mkFee(c, { def: false, freq: "per_term", name: "Per term" });
    await mkRate(f, 1000, null);
    await mkRate(termAlt, 3000, null);
    const r = await enrol.enrollStudent({ studentId: await mkStudent(g6), courseId: c });
    eq(await codeOf(async () => exc.createFeeException({ enrollmentId: r.enrollment.id, kind: "alternate_option", alternateFeeStructureId: termAlt, effectiveFrom: "2027-02-01", reason: "r", createdBy: staff })), "exception_invalid");
    // a mismatched exception that got in some other way is reported by the generator and bills nothing for its periods
    await q(`UPDATE enrollment SET access_starts_on = '2027-03-01' WHERE id = $1`, [r.enrollment.id]);
    await q(`INSERT INTO fee_exception (enrollment_id, course_id, kind, alternate_fee_structure_id, effective_from, reason, created_by) VALUES ($1, $2, 'alternate_option', $3, '2027-03-01', 'r', $4)`, [r.enrollment.id, c, termAlt, staff]);
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [r.enrollment.id] });
    eq(rep.invoicesCreated.length, 0);
    eq(rep.failures.map((x) => x.code), ["fee_structure_invalid"]);
  });
  test("D7: a conflict with another run bills the remaining periods and counts only the clashing one", async () => {
    const { enr, s, f } = await recurring({ rate: 1000, start: "2027-01-01" });
    // The second transaction of the run is the group insert. Before it starts, "another run" bills January.
    let calls = 0;
    const racing = new Proxy(db, {
      get(t, k, r) {
        if (k !== "transaction") return Reflect.get(t, k, r);
        return async (...a: unknown[]) => {
          if (++calls === 2) {
            const i = await id(`INSERT INTO invoice (student_id, branch_id, due_date, subtotal, total) VALUES ($1, $2, CURRENT_DATE + 7, 1000, 1000)`, [s, b1]);
            await q(`INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2027-01-01', '2027-02-01')`, [i, enr, f]);
          }
          return (t.transaction as (...x: unknown[]) => unknown).apply(t, a);
        };
      },
    });
    const rep = await createInvoicingService(racing, { now }).generateRecurringInvoices({ enrollmentIds: [enr] });
    eq(rep.invoicesCreated.map((x) => x.periodStarts), [["2027-02-01", "2027-03-01"]]);
    eq(rep.alreadyInvoiced, 1);
    eq((await q(`SELECT period_start FROM invoice_item WHERE enrollment_id = $1 AND cancelled_at IS NULL ORDER BY period_start`, [enr])).map((x) => String(x.period_start).slice(0, 10)), ["2027-01-01", "2027-02-01", "2027-03-01"]);
  });
  test("D21: an active exception keeps applying after the module is switched off", async () => {
    await onModule();
    const { enr } = await recurring({ rate: 1000, start: "2027-03-01" });
    await exc.createFeeException({ enrollmentId: enr, kind: "discount", discountType: "fixed", discountValue: "300", effectiveFrom: "2027-03-01", reason: "r", createdBy: staff });
    await offModule();
    const rep = await inv.generateRecurringInvoices({ enrollmentIds: [enr] });
    eq((await q(`SELECT total FROM invoice WHERE id = $1`, [rep.invoicesCreated[0]!.invoiceId]))[0]!.total, "700.00");
    await onModule();
  });
  test("exception validation, overlap, and ending", async () => {
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
});

describe("Invoice adjustment and cancellation (D8, D23 to D26)", () => {
  beforeAll(async () => {
    slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/1.jpg', 'image/jpeg', 1000)`);
    bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
    bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'T', '1')`, [b1]);
    ref = 0;
  });

  test("D8/D23: a discount line updates totals and keeps old lines unchanged", async () => {
    const p = await packageInvoice();
    const before = (await q(`SELECT amount FROM invoice_item WHERE id = $1`, [p.item]))[0]!.amount;
    const r = await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-1500", appliesToItemId: p.item, description: "Goodwill", createdBy: staff, reason: "Late start" });
    eq(r.invoice.total, "8500.00");
    eq(r.invoice.discountTotal, "1500.00");
    eq(r.invoice.subtotal, "10000.00");
    eq((await q(`SELECT amount FROM invoice_item WHERE id = $1`, [p.item]))[0]!.amount, before);
    eq((await q(`SELECT count(*)::int n FROM audit_log WHERE action = 'invoice.add_discount'`))[0]!.n, 1);
  });
  test("D25: installments are re-spread after an adjustment", async () => {
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
  test("D25: an adjustment on a fully paid schedule gets its own installment", async () => {
    const p = await packageInvoice(true);
    await payInvoice(p, "10000");
    await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "adjustment", amount: "2000", description: "Extra", createdBy: staff, reason: "Materials" });
    const ins = await q(`SELECT seq, amount, amount_paid, status FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [p.invoiceId]);
    eq(ins.length, 4);
    eq([ins[3]!.seq, ins[3]!.amount, ins[3]!.amount_paid, ins[3]!.status], [4, "2000.00", "0.00", "pending"]);
    eq(ins.slice(0, 3).every((x) => x.status === "paid"), true);
    eq((await q(`SELECT sum(amount)::text s FROM invoice_installment WHERE invoice_id = $1`, [p.invoiceId]))[0]!.s, "12000.00");
    eq((await q(`SELECT total, status FROM invoice WHERE id = $1`, [p.invoiceId]))[0]!.status, "partial");
  });
  test("D26: a change that puts the total below what is paid is refused", () => fails("total_below_paid", async () => {
    const p = await packageInvoice();
    await payInvoice(p, "6000");
    await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-5000", appliesToItemId: p.item, description: "d", createdBy: staff, reason: "r" });
  }));
  test("adjustment validation", async () => {
    const p = await packageInvoice();
    const codeOf = async (fn: () => Promise<unknown>) => { try { await fn(); return "none"; } catch (e) { return (e as ServiceError).code; } };
    const base = { invoiceId: p.invoiceId, description: "d", createdBy: staff, reason: "r" };
    eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "discount", amount: "500", appliesToItemId: p.item })), "invalid_input");
    eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "discount", amount: "-500" })), "invalid_input");
    eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "adjustment", amount: "0" })), "invalid_input");
    eq(await codeOf(async () => inv.addInvoiceLine({ ...base, kind: "discount", amount: "-20000", appliesToItemId: p.item })), "invalid_input");
    eq(await codeOf(async () => inv.addInvoiceLine({ ...base, reason: " ", kind: "adjustment", amount: "10" })), "reason_required");
  });
  test("a full discount turns the invoice into a waived zero invoice", async () => {
    const p = await packageInvoice();
    const r = await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "discount", amount: "-10000", appliesToItemId: p.item, description: "Free", createdBy: staff, reason: "Scholarship" });
    eq(r.invoice.total, "0.00");
    eq(r.invoice.status, "waived");
  });
  test("D26: cancel works without payments and frees the recurring period", async () => {
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
  test("D26: an invoice with payments cannot be cancelled", () => fails("invoice_has_payments", async () => {
    const p = await packageInvoice();
    await payInvoice(p, "1000");
    await inv.cancelInvoice({ invoiceId: p.invoiceId, cancelledBy: staff, reason: "x" });
  }));
  test("a cancelled invoice cannot be adjusted", () => fails("invoice_not_adjustable", async () => {
    const p = await packageInvoice();
    await inv.cancelInvoice({ invoiceId: p.invoiceId, cancelledBy: staff, reason: "x" });
    await inv.addInvoiceLine({ invoiceId: p.invoiceId, kind: "adjustment", amount: "10", description: "d", createdBy: staff, reason: "r" });
  }));
  test("cash payments take the date in the organization's time zone", async () => {
    await q(`UPDATE organization SET timezone = 'Asia/Colombo'`);
    clock = new Date("2027-03-10T20:00:00Z");
    const p = await packageInvoice();
    const r = await pay.recordCashPayment({ studentId: p.student, branchId: b1, amount: "1000", recordedBy: staff, invoiceIds: [p.invoiceId] } as never);
    eq((await q(`SELECT paid_on FROM payment WHERE id = $1`, [(r as { id?: string; payment?: { id: string } }).id ?? (r as { payment: { id: string } }).payment.id]))[0]!.paid_on, "2027-03-11");
    await q(`UPDATE organization SET timezone = 'UTC'`);
    clock = new Date("2027-03-10T10:00:00Z");
  });
});
