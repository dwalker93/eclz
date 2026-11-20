/**
 * Payments and receipts (E rules) against an in-process PostgreSQL: submit, verify and allocate, void, cash, signed receipts.
 */
import { afterAll, beforeAll, describe, test } from "bun:test";
import { toCents } from "@workspace/db/money";
import {
  createPaymentService,
  hmacSigner,
  linkedTotals,
  verifyReceipt,
} from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: false });
afterAll(async () => {
  await close();
});

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);

const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);

const staff = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);

const bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);

const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'Test Institute', '123')`, [b1]);

const bankB2 = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'Test Institute', '456')`, [b2]);

const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/1.jpg', 'image/jpeg', 1000)`);

const st1 = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Nimal', '2014-05-01')`);

const st2 = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S2', 'Kamal', '2013-02-01')`);

const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);

const course = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Grade 6 Science', 'class', 'scheduled')`, [subj, b1]);

const fee = await id(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type) VALUES ($1, $2, 'Package', 'one_time_package')`, [b1, course]);

const enr1 = await id(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`, [course, st1, fee]);

const enr2 = await id(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`, [course, st2, fee]);

const svc = createPaymentService(db, { signer: hmacSigner("test-secret") });

async function mkInvoice(student: string, branch: string, due: string, total: number, discount = 0) {
  return id(
    `INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, $3, $4, $5, $6)`,
    [student, branch, due, total + discount, discount, total],
  );
}

const mkItem = (invoice: string, enrollment: string, amount: number, applies: string | null = null, kind = "package_fee") =>
  id(
    kind === "discount"
      ? `INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', $2, $3)`
      : `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id) VALUES ($1, 'package_fee', $3, $2, '${fee}')`,
    kind === "discount" ? [invoice, amount, applies] : [invoice, enrollment, amount],
  );

const submit = (student: string, amount: string, ref: string, over: Record<string, unknown> = {}) =>
  svc.submitPayment({ studentId: student, branchId: b1, paymentMethodId: bankMethod, bankAccountId: bank, slipFileId: slip, amount, referenceNo: ref, submittedBy: staff, ...over });

const invoiceRow = async (invoice: string) => (await q(`SELECT amount_paid, status FROM invoice WHERE id = $1`, [invoice]))[0]!;

const instState = async () => (await q(`SELECT amount_paid, status FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [invInst])).map((r) => `${r.amount_paid}/${r.status}`);

let invA: Awaited<ReturnType<typeof mkInvoice>>;
let itemA: Awaited<ReturnType<typeof mkItem>>;
let itemB: Awaited<ReturnType<typeof mkItem>>;
let pay1: Awaited<ReturnType<typeof submit>>;
let v1: Awaited<ReturnType<typeof svc.verifyPayment>>;
let pay2: Awaited<ReturnType<typeof submit>>;
let pay3: Awaited<ReturnType<typeof submit>>;
let pay4: Awaited<ReturnType<typeof submit>>;
let invLate: Awaited<ReturnType<typeof mkInvoice>>;
let invEarly: Awaited<ReturnType<typeof mkInvoice>>;
let payMulti: Awaited<ReturnType<typeof submit>>;
let invInst: Awaited<ReturnType<typeof mkInvoice>>;
let payI1: Awaited<ReturnType<typeof submit>>;
let payI2: Awaited<ReturnType<typeof submit>>;
let vI2: Awaited<ReturnType<typeof svc.verifyPayment>>;

describe("Submitting a payment", () => {
  test("a bank transfer needs the slip", () => fails("slip_required", () => submit(st1, "100.00", "X1", { slipFileId: null })));
  test("a bank transfer needs a bank account", () => fails("bank_account_invalid", () => submit(st1, "100.00", "X2", { bankAccountId: null })));
  test("the bank account must belong to the payment's branch", () => fails("bank_account_invalid", () => submit(st1, "100.00", "X3", { bankAccountId: bankB2 })));
  test("an amount must be positive", () => fails("invalid_input", () => submit(st1, "0.00", "X4")));
  test("an amount must be a money value", () => fails("invalid_input", () => submit(st1, "abc", "X5")));
  test("staff cannot submit cash as a bank payment", () => fails("payment_method_invalid", async () => {
    const cash = String((await q(`SELECT id FROM payment_method WHERE type = 'cash'`))[0]!.id);
    await submit(st1, "100.00", "X6", { paymentMethodId: cash });
  }));
});

describe("Submitted payment and duplicate references", () => {
  beforeAll(async () => {
    invA = await mkInvoice(st1, b1, "2027-03-01", 2700, 300);
    itemA = await mkItem(invA, enr1, 2000);
    itemB = await mkItem(invA, enr1, 1000);
    await mkItem(invA, enr1, -300, itemA, "discount");
    pay1 = await submit(st1, "1000.00", "REF-1");
  });

  test("a submitted payment waits for verification", async () => eq(pay1.status, "pending_verification"));
  test("a duplicate bank reference is refused", () => fails("duplicate_reference", () => submit(st1, "50.00", "REF-1")));
});

describe("Verifying a payment: pro rata split and receipt (E7, E12, E13)", () => {
  beforeAll(async () => {
    v1 = await svc.verifyPayment({ paymentId: pay1.id, verifiedBy: staff });
  });

  test("E7: the split is pro rata to net outstanding (discount counted once)", async () => {
    const byItem = new Map(v1.allocations.map((a) => [a.invoiceItemId, a.amount]));
    eq(byItem.get(itemA), "629.63");
    eq(byItem.get(itemB), "370.37");
    eq(v1.allocations.reduce((s, a) => s + toCents(a.amount), 0), 100000);
  });
  test("E1: the invoice caches follow the allocations", async () => {
    const r = await invoiceRow(invA);
    eq(r.amount_paid, "1000.00");
    eq(r.status, "partial");
  });
  test("E13: the first receipt gets number 000001 and a verification code", async () => {
    eq(v1.receipt.receiptNo, "000001");
    if (v1.receipt.verificationCode.length < 16) throw new Error("code too short");
  });
  test("the receipt verifies", async () => {
    const check = await verifyReceipt(db, v1.receipt.verificationCode, hmacSigner("test-secret"));
    eq(check.valid, true);
  });
  test("a receipt does not verify with another key", async () => {
    const check = await verifyReceipt(db, v1.receipt.verificationCode, hmacSigner("other-secret"));
    eq(check, { valid: false, reason: "bad_signature" });
  });
  test("verifying writes an audit row", async () => {
    const r = await q(`SELECT action, actor_user_id FROM audit_log WHERE entity_id = $1`, [pay1.id]);
    eq(r.map((x) => x.action), ["payment.verify"]);
  });
  test("a verified payment cannot be verified again", () => fails("payment_not_pending", () => svc.verifyPayment({ paymentId: pay1.id, verifiedBy: staff })));
});

describe("Allocation rules and receipt numbering (E4, E5)", () => {
  beforeAll(async () => {
    pay2 = await submit(st1, "100.00", "REF-2");
  });

  test("E5: an allocation cannot exceed the item's outstanding", () => fails("allocation_exceeds_outstanding", () =>
    svc.verifyPayment({ paymentId: pay2.id, verifiedBy: staff, allocations: [{ invoiceItemId: itemB, amount: "700.00" }] })));
  test("E4: explicit allocations must equal the payment", () => fails("allocation_mismatch", () =>
    svc.verifyPayment({ paymentId: pay2.id, verifiedBy: staff, allocations: [{ invoiceItemId: itemB, amount: "60.00" }] })));
  test("a failed verification leaves the payment pending with nothing allocated", async () => {
    eq((await q(`SELECT status FROM payment WHERE id = $1`, [pay2.id]))[0]!.status, "pending_verification");
    eq((await q(`SELECT count(*)::int n FROM payment_allocation WHERE payment_id = $1`, [pay2.id]))[0]!.n, 0);
  });
  test("explicit allocations are accepted when they add up", () =>
    svc.verifyPayment({ paymentId: pay2.id, verifiedBy: staff, allocations: [{ invoiceItemId: itemB, amount: "100.00" }] }));
  test("receipts are numbered in sequence", async () => {
    eq((await q(`SELECT receipt_no FROM receipt ORDER BY receipt_no`)).map((r) => r.receipt_no), ["000001", "000002"]);
  });
});

describe("Finishing the invoice", () => {
  beforeAll(async () => {
    pay3 = await submit(st1, "1600.00", "REF-3");
  });

  test("the rest of the invoice is paid and the status becomes paid", async () => {
    await svc.verifyPayment({ paymentId: pay3.id, verifiedBy: staff });
    const r = await invoiceRow(invA);
    eq(r.amount_paid, "2700.00");
    eq(r.status, "paid");
  });
});

describe("No advance payments and rejection (E4)", () => {
  beforeAll(async () => {
    pay4 = await submit(st1, "100.00", "REF-4");
  });

  test("E4: no advance payments, so leftover money blocks verification", () => fails("allocation_mismatch", () =>
    svc.verifyPayment({ paymentId: pay4.id, verifiedBy: staff })));
  test("a paid invoice cannot take more payments", () => fails("invoice_not_payable", () =>
    svc.verifyPayment({ paymentId: pay4.id, verifiedBy: staff, invoiceIds: [invA] })));
  test("a payment is rejected with a reason", async () => {
    const r = await svc.rejectPayment({ paymentId: pay4.id, rejectedBy: staff, reason: "Slip unreadable" });
    eq(r.status, "rejected");
  });
  test("a rejection needs a reason", () => fails("reason_required", () => svc.rejectPayment({ paymentId: pay4.id, rejectedBy: staff, reason: "  " })));
  test("a rejected payment cannot be verified", () => fails("payment_not_pending", () => svc.verifyPayment({ paymentId: pay4.id, verifiedBy: staff })));
});

describe("One payment across invoices (E6, E7, E15)", () => {
  beforeAll(async () => {
    invLate = await mkInvoice(st2, b1, "2027-05-01", 1000);
    await mkItem(invLate, enr2, 1000);
    invEarly = await mkInvoice(st2, b1, "2027-04-01", 1000);
    await mkItem(invEarly, enr2, 1000);
    payMulti = await submit(st2, "1500.00", "REF-M");
  });

  test("E7: one payment covers two invoices, oldest due date first", async () => {
    await svc.verifyPayment({ paymentId: payMulti.id, verifiedBy: staff, invoiceIds: [invLate, invEarly] });
    eq((await invoiceRow(invEarly)).status, "paid");
    const late = await invoiceRow(invLate);
    eq(late.amount_paid, "500.00");
    eq(late.status, "partial");
  });
  test("E6: another student's invoice cannot be used", () => fails("invoice_not_payable", async () => {
    const p = await submit(st2, "10.00", "REF-O");
    await svc.verifyPayment({ paymentId: p.id, verifiedBy: staff, invoiceIds: [invA] });
  }));
  test("E15: an invoice of another branch cannot be used", () => fails("invoice_not_payable", async () => {
    const other = await mkInvoice(st2, b2, "2027-06-01", 500);
    await mkItem(other, enr2, 500);
    const p = await submit(st2, "10.00", "REF-P");
    await svc.verifyPayment({ paymentId: p.id, verifiedBy: staff, invoiceIds: [other] });
  }));
});

describe("Installments: first payment (E16)", () => {
  beforeAll(async () => {
    invInst = await mkInvoice(st1, b1, "2027-07-01", 3000);
    await mkItem(invInst, enr1, 3000);
    for (const [seq, due] of [[1, "2027-07-01"], [2, "2027-08-01"], [3, "2027-09-01"]] as const) {
      await q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, $2, $3, 1000)`, [invInst, seq, due]);
    }
    payI1 = await submit(st1, "1500.00", "REF-I1");
    await svc.verifyPayment({ paymentId: payI1.id, verifiedBy: staff, invoiceIds: [invInst] });
  });

  test("E16: 1500 on three installments of 1000", async () => eq(await instState(), ["1000.00/paid", "500.00/partial", "0.00/pending"]));
});

describe("Installments: completing, void and repay (E9, E16)", () => {
  beforeAll(async () => {
    payI2 = await submit(st1, "1500.00", "REF-I2");
    vI2 = await svc.verifyPayment({ paymentId: payI2.id, verifiedBy: staff, invoiceIds: [invInst] });
  });

  test("E16: the second payment completes all installments", async () => eq(await instState(), ["1000.00/paid", "1000.00/paid", "1000.00/paid"]));
  test("a void needs a reason", () => fails("reason_required", () => svc.voidPayment({ paymentId: payI2.id, voidedBy: staff, reason: "" })));
  test("E9: a void reverses allocations, voids the receipt and re-derives caches", async () => {
    const ev = await svc.voidPayment({ paymentId: payI2.id, voidedBy: staff, reason: "Bank reversed the transfer" });
    eq(ev.payment.status, "voided");
    eq(ev.reversedAllocations.length, 1);
    eq(await instState(), ["1000.00/paid", "500.00/partial", "0.00/pending"]);
    const r = await invoiceRow(invInst);
    eq(r.amount_paid, "1500.00");
    eq(r.status, "partial");
    eq((await q(`SELECT status FROM receipt WHERE payment_id = $1`, [payI2.id]))[0]!.status, "void");
    eq((await q(`SELECT count(*)::int n FROM payment_allocation WHERE payment_id = $1`, [payI2.id]))[0]!.n, 1);
  });
  test("a voided receipt reports as void", async () => {
    eq(await verifyReceipt(db, vI2.receipt.verificationCode, hmacSigner("test-secret")), { valid: false, reason: "void" });
  });
  test("a payment cannot be voided twice", () => fails("payment_not_verified", () => svc.voidPayment({ paymentId: payI2.id, voidedBy: staff, reason: "again" })));
  test("a pending payment cannot be voided", () => fails("payment_not_verified", async () => {
    const p = await submit(st1, "10.00", "REF-V");
    await svc.voidPayment({ paymentId: p.id, voidedBy: staff, reason: "x" });
  }));
  test("after a void the invoice can be paid again", async () => {
    const p = await submit(st1, "1500.00", "REF-I3");
    await svc.verifyPayment({ paymentId: p.id, verifiedBy: staff, invoiceIds: [invInst] });
    eq((await invoiceRow(invInst)).status, "paid");
  });
});

describe("Cash (E11)", () => {
  test("E11: cash is recorded already verified with a receipt", async () => {
    const inv = await mkInvoice(st2, b1, "2027-08-01", 400);
    const item = await mkItem(inv, enr2, 400);
    const ev = await svc.recordCashPayment({ studentId: st2, branchId: b1, amount: "400.00", recordedBy: staff, invoiceIds: [inv] });
    eq(ev.payment.status, "verified");
    eq(ev.allocations.map((a) => a.invoiceItemId), [item]);
    eq((await invoiceRow(inv)).status, "paid");
    eq(ev.receipt.status, "issued");
  });
});

describe("Linked positive adjustments count once (D23)", () => {
  const adjustment = (invoice: string, amount: number, applies: string | null) =>
    id(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'adjustment', $2, $3)`, [invoice, amount, applies]);

  test("linkedTotals adds a linked line to its root once, also through a chain", () => {
    const m = linkedTotals([
      { id: "fee", cents: 10000, appliesToItemId: null },
      { id: "adj", cents: 2000, appliesToItemId: "fee" },
      { id: "adj2", cents: 500, appliesToItemId: "adj" },
      { id: "disc", cents: -300, appliesToItemId: "fee" },
      { id: "solo", cents: 700, appliesToItemId: null },
    ]);
    eq([m.get("fee"), m.get("adj"), m.get("solo")], [2200, undefined, undefined]);
  });
  test("a payment of the invoice total settles it, allocated to the item and not to its linked adjustment", async () => {
    const inv = await mkInvoice(st2, b1, "2027-05-01", 12000);
    const item = await mkItem(inv, enr2, 10000);
    await adjustment(inv, 2000, item);
    const ev = await svc.recordCashPayment({ studentId: st2, branchId: b1, amount: "12000.00", recordedBy: staff, invoiceIds: [inv] });
    eq(ev.allocations.map((a) => [a.invoiceItemId, a.amount]), [[item, "12000.00"]]);
    eq((await invoiceRow(inv)).status, "paid");
  });
  test("a payment above the invoice total is refused", () => fails("allocation_mismatch", async () => {
    const inv = await mkInvoice(st2, b1, "2027-05-01", 12000);
    const item = await mkItem(inv, enr2, 10000);
    await adjustment(inv, 2000, item);
    await svc.recordCashPayment({ studentId: st2, branchId: b1, amount: "12100.00", recordedBy: staff, invoiceIds: [inv] });
  }));
  test("a standalone positive adjustment is still its own payable item", async () => {
    const inv = await mkInvoice(st2, b1, "2027-05-01", 10500);
    const item = await mkItem(inv, enr2, 10000);
    const solo = await adjustment(inv, 500, null);
    const ev = await svc.recordCashPayment({ studentId: st2, branchId: b1, amount: "10500.00", recordedBy: staff, invoiceIds: [inv] });
    eq(new Map(ev.allocations.map((a) => [a.invoiceItemId, a.amount])).get(solo), "500.00");
    eq(new Map(ev.allocations.map((a) => [a.invoiceItemId, a.amount])).get(item), "10000.00");
  });
});

describe("Receipt branch is part of what is verified", () => {
  test("a receipt moved to another branch is reported as tampered; an untouched one verifies", async () => {
    const inv = await mkInvoice(st2, b1, "2027-05-01", 100);
    await mkItem(inv, enr2, 100);
    const ev = await svc.recordCashPayment({ studentId: st2, branchId: b1, amount: "100.00", recordedBy: staff, invoiceIds: [inv] });
    eq((await verifyReceipt(db, ev.receipt.verificationCode, hmacSigner("test-secret"))).valid, true);
    await q(`UPDATE receipt SET branch_id = $2 WHERE id = $1`, [ev.receipt.id, b2]);
    eq(await verifyReceipt(db, ev.receipt.verificationCode, hmacSigner("test-secret")), { valid: false, reason: "tampered" });
  });
});

describe("Receipt tamper detection", () => {
  test("tampering with the stored hash is detected", async () => {
    await q(`UPDATE receipt SET content_hash = repeat('0', 64) WHERE id = $1`, [v1.receipt.id]);
    eq(await verifyReceipt(db, v1.receipt.verificationCode, hmacSigner("test-secret")), { valid: false, reason: "tampered" });
  });
  test("an unknown code is not found", async () => {
    eq(await verifyReceipt(db, "nope", hmacSigner("test-secret")), { valid: false, reason: "not_found" });
  });
});

describe("Hooks join the transaction", () => {
  test("a failing hook rolls the whole verification back", async () => {
    const hooked = createPaymentService(db, {
      signer: hmacSigner("test-secret"),
      hooks: {
        afterVerify: async () => {
          throw new Error("commission accrual failed");
        },
      },
    });
    const inv = await mkInvoice(st1, b1, "2027-09-01", 300);
    await mkItem(inv, enr1, 300);
    const p = await submit(st1, "300.00", "REF-H");
    const before = (await q(`SELECT last_number FROM receipt_counter WHERE branch_id = $1`, [b1]))[0]!.last_number;
    let threw = false;
    try {
      await hooked.verifyPayment({ paymentId: p.id, verifiedBy: staff });
    } catch {
      threw = true;
    }
    eq(threw, true);
    eq((await q(`SELECT status FROM payment WHERE id = $1`, [p.id]))[0]!.status, "pending_verification");
    eq((await q(`SELECT count(*)::int n FROM payment_allocation WHERE payment_id = $1`, [p.id]))[0]!.n, 0);
    eq((await q(`SELECT last_number FROM receipt_counter WHERE branch_id = $1`, [b1]))[0]!.last_number, before);
    eq((await invoiceRow(inv)).status, "pending");
  });
});
