/**
 * Teacher payouts: create, carry-forward, approve, pay, discard (H rules).
 */
import { afterAll, describe, test } from "bun:test";
import {
  createCommissionService,
  createEnrollmentService,
  createInvoicingService,
  createPaymentService,
  createPayoutService,
  hmacSigner,
  ServiceError,
} from "../src";
import { eq } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = jsonb_set(COALESCE(enabled_modules,'{}'::jsonb), '{commissions}', 'true')`);

const now = () => new Date("2027-03-10T10:00:00Z");

const commissions = createCommissionService({ now });

const pay = createPaymentService(db, { signer: hmacSigner("s"), now, hooks: commissions.hooks });

const enrol = createEnrollmentService(db, { now });

const inv = createInvoicingService(db, { now });

const payouts = createPayoutService(db, { now });

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
  try {
    await fn();
  } catch (e) {
    return e instanceof ServiceError ? e.code : `other: ${String((e as Error).message).slice(0, 200)}`;
  }
  return "no error";
}

const myEntries = (lec: string) => q(`SELECT * FROM commission_entry WHERE lecturer_id = $1 ORDER BY created_at, id`, [lec]);

const periodEnd = "2027-03-11";

async function lecturerWithRule() {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  return lec;
}

describe("Creating payouts", () => {
  test("H8: a payout takes the accrued entries and marks them settled", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    await payIt(await scenario([{ lec, share: 100 }]), "5000");
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error(`expected created, got ${r.status}`);
    eq([r.payout.grossCollected, r.payout.commissionTotal, r.payout.netPayable, r.payout.status], ["15000.00", "1500.00", "13500.00", "draft"]);
    eq(r.payout.periodEnd, periodEnd);
    eq(r.entryIds.length, 2);
    const e = await myEntries(lec);
    eq(e.map((x) => x.status), ["settled", "settled"]);
    eq(e.every((x) => x.payout_id === r.payout.id), true);
    const detail = await payouts.getPayout({ payoutId: r.payout.id });
    eq(detail.entries.length, 2);
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1`, [r.payout.id])).map((a) => a.action), ["payout.create"]);
  });
  test("creating again finds nothing left, and entries are never taken twice", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    const again = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    eq(again.status, "carried_forward");
    if (again.status === "carried_forward") eq(again.reason, "no_entries");
  });
  test("entries created after the period end are left for the next payout", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    await payIt(await scenario([{ lec, share: 100 }]), "4000");
    await q(`UPDATE commission_entry SET created_at = '2027-03-20T10:00:00Z' WHERE lecturer_id = $1 AND base_amount = 4000`, [lec]);
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error("expected created");
    eq(r.payout.netPayable, "9000.00");
    eq((await myEntries(lec)).map((x) => x.status), ["settled", "accrued"]);
  });
  test("the period end uses the organization's time zone", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    // 2027-03-10 20:00 UTC is already 2027-03-11 in Colombo (UTC+5:30), so it is after the end of 10 March there.
    await q(`UPDATE commission_entry SET created_at = '2027-03-10T20:00:00Z' WHERE lecturer_id = $1`, [lec]);
    await q(`UPDATE organization SET timezone = 'Asia/Colombo'`);
    const colombo = await payouts.createPayout({ lecturerId: lec, periodEnd: "2027-03-11", createdBy: staff });
    eq(colombo.status, "carried_forward");
    await q(`UPDATE organization SET timezone = 'UTC'`);
    const utc = await payouts.createPayout({ lecturerId: lec, periodEnd: "2027-03-11", createdBy: staff });
    eq(utc.status, "created");
  });
  test("H8: a negative net creates no payout and carries forward", async () => {
    const lec = await lecturerWithRule();
    const sc = await scenario([{ lec, share: 100 }]);
    const p = await payIt(sc, "10000");
    const first = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (first.status !== "created") throw new Error("expected created");
    await payouts.approvePayout({ payoutId: first.payout.id, approvedBy: staff });
    await payouts.markPaid({ payoutId: first.payout.id, paidBy: staff, paymentReference: "TRX-1" });
    await pay.voidPayment({ paymentId: p, voidedBy: staff, reason: "chargeback" });

    const later = createPayoutService(db, { now: () => new Date("2027-04-15T10:00:00Z") });
    const neg = await later.createPayout({ lecturerId: lec, periodEnd: "2027-04-01", createdBy: staff });
    eq(neg.status, "carried_forward");
    if (neg.status === "carried_forward") eq([neg.reason, neg.net, neg.entryCount], ["net_not_positive", "-9000.00", 1]);
    eq((await q(`SELECT count(*)::int AS n FROM teacher_payout WHERE lecturer_id = $1`, [lec]))[0]!.n, 1);
    eq((await myEntries(lec)).map((x) => x.status), ["settled", "accrued"]);

    // exactly zero is not paid either
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    const zero = await later.createPayout({ lecturerId: lec, periodEnd: "2027-04-01", createdBy: staff });
    eq(zero.status, "carried_forward");

    // a later, larger accrual brings it positive; the carried reversal is deducted
    await payIt(await scenario([{ lec, share: 100 }]), "5000");
    const preview = await later.previewPayout({ lecturerId: lec, periodEnd: "2027-04-01" });
    eq([preview.entryCount, preview.gross, preview.commission, preview.net, preview.blocker], [3, "5000.00", "500.00", "4500.00", null]);
    const ok2 = await later.createPayout({ lecturerId: lec, periodEnd: "2027-04-01", createdBy: staff });
    if (ok2.status !== "created") throw new Error("expected created");
    eq([ok2.payout.grossCollected, ok2.payout.commissionTotal, ok2.payout.netPayable], ["5000.00", "500.00", "4500.00"]);
    eq(ok2.payout.periodStart, periodEnd);
    eq(ok2.entryIds.length, 3);
  });
  test("payout periods of one lecturer cannot overlap or run into the future", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    const r = await payouts.createPayout({ lecturerId: lec, periodStart: "2027-03-01", periodEnd, createdBy: staff });
    eq(r.status, "created");
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodStart: "2027-03-05", periodEnd, createdBy: staff })), "payout_period_invalid");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff })), "payout_period_invalid");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodEnd: "2027-03-12", createdBy: staff })), "payout_period_invalid");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodEnd: "11/03/2027", createdBy: staff })), "invalid_input");
    eq(await code(() => payouts.createPayout({ lecturerId: "00000000-0000-0000-0000-000000000001", periodEnd, createdBy: staff })), "not_found");
  });
});

describe("Approving payouts", () => {
  test("approve: reversals of the draft's own entries join it and the totals are rebuilt", async () => {
    const lec = await lecturerWithRule();
    const p1 = await payIt(await scenario([{ lec, share: 100 }]), "10000");
    await payIt(await scenario([{ lec, share: 100 }]), "5000");
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error("expected created");
    await pay.voidPayment({ paymentId: p1, voidedBy: staff, reason: "bounced" });
    eq((await myEntries(lec)).map((x) => x.status), ["settled", "settled", "accrued"]);
    const a = await payouts.approvePayout({ payoutId: r.payout.id, approvedBy: staff });
    eq(a.pulledReversals, 1);
    eq([a.payout.status, a.payout.approvedBy, a.payout.grossCollected, a.payout.commissionTotal, a.payout.netPayable], ["approved", staff, "5000.00", "500.00", "4500.00"]);
    eq((await myEntries(lec)).map((x) => x.status), ["settled", "settled", "settled"]);
    eq((await q(`SELECT count(*)::int AS n FROM commission_entry WHERE payout_id = $1`, [r.payout.id]))[0]!.n, 3);
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at, id`, [r.payout.id])).map((x) => x.action).sort(), ["payout.approve", "payout.create"]);
  });
  test("approve: a draft left with nothing to pay is refused and left unchanged", async () => {
    const lec = await lecturerWithRule();
    const p1 = await payIt(await scenario([{ lec, share: 100 }]), "10000");
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error("expected created");
    await pay.voidPayment({ paymentId: p1, voidedBy: staff, reason: "bounced" });
    eq(await code(() => payouts.approvePayout({ payoutId: r.payout.id, approvedBy: staff })), "payout_nothing_to_pay");
    const [row] = await q(`SELECT status, net_payable FROM teacher_payout WHERE id = $1`, [r.payout.id]);
    eq([row!.status, row!.net_payable], ["draft", "9000.00"]);
    eq((await myEntries(lec)).map((x) => x.status), ["settled", "accrued"]);
    // discarding frees both entries, which then net to zero
    const d = await payouts.discardDraft({ payoutId: r.payout.id, discardedBy: staff, reason: "voided" });
    eq(d.releasedEntryIds.length, 1);
    eq((await myEntries(lec)).map((x) => [x.status, x.payout_id]), [["accrued", null], ["accrued", null]]);
    const pv = await payouts.previewPayout({ lecturerId: lec });
    eq([pv.entryCount, pv.net, pv.blocker], [2, "0.00", "net_not_positive"]);
  });
  test("after approval the totals are frozen: a later void becomes a reversal for the next payout", async () => {
    const lec = await lecturerWithRule();
    const p1 = await payIt(await scenario([{ lec, share: 100 }]), "10000");
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error("expected created");
    await payouts.approvePayout({ payoutId: r.payout.id, approvedBy: staff });
    await pay.voidPayment({ paymentId: p1, voidedBy: staff, reason: "chargeback" });
    const e = await myEntries(lec);
    eq([e[1]!.entry_type, e[1]!.status, e[1]!.payout_id], ["reversal", "accrued", null]);
    eq((await q(`SELECT net_payable FROM teacher_payout WHERE id = $1`, [r.payout.id]))[0]!.net_payable, "9000.00");
    eq(await code(() => payouts.refreshDraft({ payoutId: r.payout.id })), "payout_not_draft");
  });
});

describe("Paying payouts", () => {
  test("H8, J3: mark paid needs an approved payout, a reference and a sane date; then it is immutable", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error("expected created");
    const id1 = r.payout.id;
    eq(await code(() => payouts.markPaid({ payoutId: id1, paidBy: staff, paymentReference: "TRX-9" })), "payout_not_approved");
    await payouts.approvePayout({ payoutId: id1, approvedBy: staff });
    eq(await code(() => payouts.approvePayout({ payoutId: id1, approvedBy: staff })), "payout_not_draft");
    eq(await code(() => payouts.discardDraft({ payoutId: id1, discardedBy: staff })), "payout_not_draft");
    eq(await code(() => payouts.markPaid({ payoutId: id1, paidBy: staff, paymentReference: "   " })), "invalid_input");
    eq(await code(() => payouts.markPaid({ payoutId: id1, paidBy: staff, paymentReference: "TRX-9", paidOn: "2027-03-11" })), "invalid_input");
    eq(await code(() => payouts.markPaid({ payoutId: id1, paidBy: staff, paymentReference: "TRX-9", proofFileId: "00000000-0000-0000-0000-000000000001" })), "not_found");
    const paid = await payouts.markPaid({ payoutId: id1, paidBy: staff, paymentReference: " TRX-9 ", proofFileId: slip });
    eq([paid.status, paid.paidOn, paid.paymentReference, paid.proofFileId], ["paid", "2027-03-10", "TRX-9", slip]);
    eq(await code(() => payouts.markPaid({ payoutId: id1, paidBy: staff, paymentReference: "again" })), "payout_not_approved");
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1`, [id1])).map((x) => x.action).sort(), ["payout.approve", "payout.create", "payout.pay"]);
    let blocked = false;
    try { await q(`UPDATE teacher_payout SET payment_reference = 'x' WHERE id = $1`, [id1]); } catch { blocked = true; }
    eq(blocked, true);
    eq((await payouts.listPayouts({ lecturerId: lec, status: "paid" })).length, 1);
    eq((await payouts.listPayouts({ lecturerId: lec, status: "draft" })).length, 0);
  });
});

describe("Discarding drafts and the module gate", () => {
  test("discarding a draft releases its entries to the next payout", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    if (r.status !== "created") throw new Error("expected created");
    const d = await payouts.discardDraft({ payoutId: r.payout.id, discardedBy: staff, reason: "wrong period" });
    eq(d.releasedEntryIds.length, 1);
    eq((await q(`SELECT count(*)::int AS n FROM teacher_payout WHERE id = $1`, [r.payout.id]))[0]!.n, 0);
    eq((await myEntries(lec)).map((x) => [x.status, x.payout_id]), [["accrued", null]]);
    const again = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    eq(again.status, "created");
    const [a] = await q(`SELECT reason FROM audit_log WHERE action = 'payout.discard' AND entity_id = $1`, [r.payout.id]);
    eq(a!.reason, "wrong period");
  });
  test("impossible calendar dates are invalid_input; valid dates that break a business rule keep their own code", async () => {
    const lec = await lecturerWithRule();
    eq(await code(() => payouts.previewPayout({ lecturerId: lec, periodEnd: "2027-02-31" })), "invalid_input");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodEnd: "2027-02-31", createdBy: staff })), "invalid_input");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodStart: "2027-13-01", periodEnd, createdBy: staff })), "invalid_input");
    eq(await code(() => payouts.markPaid({ payoutId: lec, paidBy: staff, paymentReference: "R1", paidOn: "2027-02-30" })), "invalid_input");
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodEnd: "2099-12-31", createdBy: staff })), "payout_period_invalid");
  });
  test("H9: with the commissions module off nothing in the payout service works", async () => {
    const lec = await lecturerWithRule();
    await payIt(await scenario([{ lec, share: 100 }]), "10000");
    await q(`UPDATE organization SET enabled_modules = jsonb_set(enabled_modules, '{commissions}', 'false')`);
    eq(await code(() => payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff })), "module_disabled");
    eq(await code(() => payouts.previewPayout({ lecturerId: lec })), "module_disabled");
    eq(await code(() => payouts.listPayouts()), "module_disabled");
    await q(`UPDATE organization SET enabled_modules = jsonb_set(enabled_modules, '{commissions}', 'true')`);
    eq((await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff })).status, "created");
  });
  test("a lecturer with no entries gets no payout", async () => {
    const lec = await lecturer();
    const r = await payouts.createPayout({ lecturerId: lec, periodEnd, createdBy: staff });
    eq(r.status, "carried_forward");
    if (r.status === "carried_forward") eq([r.reason, r.entryCount], ["no_entries", 0]);
  });
});
