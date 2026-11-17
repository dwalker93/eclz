/**
 * Scenario tests for the payment services on an in-process PostgreSQL (PGlite). Run with: bun run db:test:services
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
  createPaymentService,
  deriveInvoiceStatus,
  fromCents,
  hmacSigner,
  planAllocation,
  ServiceError,
  splitProRata,
  toCents,
  verifyReceipt,
  waterfall,
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
    record(false, name, String((e as Error).message).slice(0, 300));
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
const q = async (text: string, params: unknown[] = []): Promise<Row[]> => (await pg.query<Row>(text, params)).rows;
const id = async (text: string, params: unknown[] = []) => String((await q(text + " RETURNING id", params))[0]!.id);

// ---- pure arithmetic
await ok("toCents and fromCents round trip", async () => {
  eq(toCents("1500.00"), 150000);
  eq(toCents("0.5"), 50);
  eq(toCents(12.34), 1234);
  eq(toCents("-3.07"), -307);
  eq(fromCents(150000), "1500.00");
  eq(fromCents(-307), "-3.07");
  eq(fromCents(5), "0.05");
});
await ok("E7: pro rata split uses largest remainder and sums exactly", async () => {
  const parts = splitProRata(10000, [{ id: "a", weight: 10000 }, { id: "b", weight: 10000 }, { id: "c", weight: 10000 }]);
  eq(parts.map((p) => p.cents), [3334, 3333, 3333]);
  const uneven = splitProRata(100000, [{ id: "a", weight: 170000 }, { id: "b", weight: 100000 }]);
  eq(uneven.reduce((s, p) => s + p.cents, 0), 100000);
  eq(uneven.map((p) => p.cents), [62963, 37037]);
});
await ok("E7: a split never gives an item more than its outstanding", async () => {
  const items = [{ id: "a", weight: 1 }, { id: "b", weight: 1 }, { id: "c", weight: 998 }];
  for (const amount of [1, 2, 3, 500, 999, 1000]) {
    const parts = splitProRata(amount, items);
    eq(parts.reduce((s, p) => s + p.cents, 0), amount, `sum for ${amount}`);
    for (const p of parts) if (p.cents > items.find((i) => i.id === p.id)!.weight) throw new Error("over-allocated");
  }
});
await ok("E7: the default plan fills the oldest due date first", async () => {
  const plan = planAllocation(15000, [
    { invoiceId: "late", issuedOn: "2027-01-01", dueDate: "2027-03-01", items: [{ id: "l1", weight: 10000 }] },
    { invoiceId: "early", issuedOn: "2027-01-01", dueDate: "2027-02-01", items: [{ id: "e1", weight: 10000 }] },
  ]);
  eq(plan.allocations, [
    { invoiceId: "early", invoiceItemId: "e1", cents: 10000 },
    { invoiceId: "late", invoiceItemId: "l1", cents: 5000 },
  ]);
  eq(plan.unallocated, 0);
  eq(planAllocation(30000, [{ invoiceId: "x", issuedOn: "2027-01-01", dueDate: "2027-02-01", items: [{ id: "x1", weight: 10000 }] }]).unallocated, 20000);
});
await ok("E16: the waterfall spills into the next installment", async () => {
  eq(waterfall([100000, 100000, 100000], 150000), [100000, 50000, 0]);
  eq(waterfall([100000, 100000], 250000), [100000, 100000]);
  eq(waterfall([100000], 0), [0]);
});
await ok("invoice status derivation keeps overdue until paid", async () => {
  eq(deriveInvoiceStatus("pending", 100, 40), "partial");
  eq(deriveInvoiceStatus("overdue", 100, 40), "overdue");
  eq(deriveInvoiceStatus("overdue", 100, 100), "paid");
  eq(deriveInvoiceStatus("paid", 100, 0), "pending");
  eq(deriveInvoiceStatus("cancelled", 100, 0), "cancelled");
});

// ---- database
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
for (const e of journal.entries) await pg.exec(readFileSync(join(root, "drizzle", `${e.tag}.sql`), "utf8"));
await seedDefaults(db as never, { organizationName: "Test Institute", type: "institution" });

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

// ---- submit rules
await fails("a bank transfer needs the slip", "slip_required", () => submit(st1, "100.00", "X1", { slipFileId: null }));
await fails("a bank transfer needs a bank account", "bank_account_invalid", () => submit(st1, "100.00", "X2", { bankAccountId: null }));
await fails("the bank account must belong to the payment's branch", "bank_account_invalid", () => submit(st1, "100.00", "X3", { bankAccountId: bankB2 }));
await fails("an amount must be positive", "invalid_input", () => submit(st1, "0.00", "X4"));
await fails("an amount must be a money value", "invalid_input", () => submit(st1, "abc", "X5"));
await fails("staff cannot submit cash as a bank payment", "payment_method_invalid", async () => {
  const cash = String((await q(`SELECT id FROM payment_method WHERE type = 'cash'`))[0]!.id);
  await submit(st1, "100.00", "X6", { paymentMethodId: cash });
});

// ---- happy path: discount, pro rata, receipt
const invA = await mkInvoice(st1, b1, "2027-03-01", 2700, 300);
const itemA = await mkItem(invA, enr1, 2000);
const itemB = await mkItem(invA, enr1, 1000);
await mkItem(invA, enr1, -300, itemA, "discount");
const pay1 = await submit(st1, "1000.00", "REF-1");
await ok("a submitted payment waits for verification", async () => eq(pay1.status, "pending_verification"));
await fails("a duplicate bank reference is refused", "duplicate_reference", () => submit(st1, "50.00", "REF-1"));
const v1 = await svc.verifyPayment({ paymentId: pay1.id, verifiedBy: staff });
await ok("E7: the split is pro rata to net outstanding (discount counted once)", async () => {
  const byItem = new Map(v1.allocations.map((a) => [a.invoiceItemId, a.amount]));
  eq(byItem.get(itemA), "629.63");
  eq(byItem.get(itemB), "370.37");
  eq(v1.allocations.reduce((s, a) => s + toCents(a.amount), 0), 100000);
});
await ok("E1: the invoice caches follow the allocations", async () => {
  const r = await invoiceRow(invA);
  eq(r.amount_paid, "1000.00");
  eq(r.status, "partial");
});
await ok("E13: the first receipt gets number 000001 and a verification code", async () => {
  eq(v1.receipt.receiptNo, "000001");
  if (v1.receipt.verificationCode.length < 16) throw new Error("code too short");
});
await ok("the receipt verifies", async () => {
  const check = await verifyReceipt(db, v1.receipt.verificationCode, hmacSigner("test-secret"));
  eq(check.valid, true);
});
await ok("a receipt does not verify with another key", async () => {
  const check = await verifyReceipt(db, v1.receipt.verificationCode, hmacSigner("other-secret"));
  eq(check, { valid: false, reason: "bad_signature" });
});
await ok("verifying writes an audit row", async () => {
  const r = await q(`SELECT action, actor_user_id FROM audit_log WHERE entity_id = $1`, [pay1.id]);
  eq(r.map((x) => x.action), ["payment.verify"]);
});
await fails("a verified payment cannot be verified again", "payment_not_pending", () => svc.verifyPayment({ paymentId: pay1.id, verifiedBy: staff }));

// ---- E4, E5
const pay2 = await submit(st1, "100.00", "REF-2");
await fails("E5: an allocation cannot exceed the item's outstanding", "allocation_exceeds_outstanding", () =>
  svc.verifyPayment({ paymentId: pay2.id, verifiedBy: staff, allocations: [{ invoiceItemId: itemB, amount: "700.00" }] }),
);
await fails("E4: explicit allocations must equal the payment", "allocation_mismatch", () =>
  svc.verifyPayment({ paymentId: pay2.id, verifiedBy: staff, allocations: [{ invoiceItemId: itemB, amount: "60.00" }] }),
);
await ok("a failed verification leaves the payment pending with nothing allocated", async () => {
  eq((await q(`SELECT status FROM payment WHERE id = $1`, [pay2.id]))[0]!.status, "pending_verification");
  eq((await q(`SELECT count(*)::int n FROM payment_allocation WHERE payment_id = $1`, [pay2.id]))[0]!.n, 0);
});
await ok("explicit allocations are accepted when they add up", () =>
  svc.verifyPayment({ paymentId: pay2.id, verifiedBy: staff, allocations: [{ invoiceItemId: itemB, amount: "100.00" }] }),
);
await ok("receipts are numbered in sequence", async () => {
  eq((await q(`SELECT receipt_no FROM receipt ORDER BY receipt_no`)).map((r) => r.receipt_no), ["000001", "000002"]);
});
const pay3 = await submit(st1, "1600.00", "REF-3");
await ok("the rest of the invoice is paid and the status becomes paid", async () => {
  await svc.verifyPayment({ paymentId: pay3.id, verifiedBy: staff });
  const r = await invoiceRow(invA);
  eq(r.amount_paid, "2700.00");
  eq(r.status, "paid");
});
const pay4 = await submit(st1, "100.00", "REF-4");
await fails("E4: no advance payments, so leftover money blocks verification", "allocation_mismatch", () =>
  svc.verifyPayment({ paymentId: pay4.id, verifiedBy: staff }),
);
await fails("a paid invoice cannot take more payments", "invoice_not_payable", () =>
  svc.verifyPayment({ paymentId: pay4.id, verifiedBy: staff, invoiceIds: [invA] }),
);
await ok("a payment is rejected with a reason", async () => {
  const r = await svc.rejectPayment({ paymentId: pay4.id, rejectedBy: staff, reason: "Slip unreadable" });
  eq(r.status, "rejected");
});
await fails("a rejection needs a reason", "reason_required", () => svc.rejectPayment({ paymentId: pay4.id, rejectedBy: staff, reason: "  " }));
await fails("a rejected payment cannot be verified", "payment_not_pending", () => svc.verifyPayment({ paymentId: pay4.id, verifiedBy: staff }));

// ---- E7 multi-invoice, oldest due first
const invLate = await mkInvoice(st2, b1, "2027-05-01", 1000);
await mkItem(invLate, enr2, 1000);
const invEarly = await mkInvoice(st2, b1, "2027-04-01", 1000);
await mkItem(invEarly, enr2, 1000);
const payMulti = await submit(st2, "1500.00", "REF-M");
await ok("E7: one payment covers two invoices, oldest due date first", async () => {
  await svc.verifyPayment({ paymentId: payMulti.id, verifiedBy: staff, invoiceIds: [invLate, invEarly] });
  eq((await invoiceRow(invEarly)).status, "paid");
  const late = await invoiceRow(invLate);
  eq(late.amount_paid, "500.00");
  eq(late.status, "partial");
});
await fails("E6: another student's invoice cannot be used", "invoice_not_payable", async () => {
  const p = await submit(st2, "10.00", "REF-O");
  await svc.verifyPayment({ paymentId: p.id, verifiedBy: staff, invoiceIds: [invA] });
});
await fails("E15: an invoice of another branch cannot be used", "invoice_not_payable", async () => {
  const other = await mkInvoice(st2, b2, "2027-06-01", 500);
  await mkItem(other, enr2, 500);
  const p = await submit(st2, "10.00", "REF-P");
  await svc.verifyPayment({ paymentId: p.id, verifiedBy: staff, invoiceIds: [other] });
});

// ---- E16 installments and void
const invInst = await mkInvoice(st1, b1, "2027-07-01", 3000);
await mkItem(invInst, enr1, 3000);
for (const [seq, due] of [[1, "2027-07-01"], [2, "2027-08-01"], [3, "2027-09-01"]] as const) {
  await q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, $2, $3, 1000)`, [invInst, seq, due]);
}
const instState = async () => (await q(`SELECT amount_paid, status FROM invoice_installment WHERE invoice_id = $1 ORDER BY seq`, [invInst])).map((r) => `${r.amount_paid}/${r.status}`);
const payI1 = await submit(st1, "1500.00", "REF-I1");
await svc.verifyPayment({ paymentId: payI1.id, verifiedBy: staff, invoiceIds: [invInst] });
await ok("E16: 1500 on three installments of 1000", async () => eq(await instState(), ["1000.00/paid", "500.00/partial", "0.00/pending"]));
const payI2 = await submit(st1, "1500.00", "REF-I2");
const vI2 = await svc.verifyPayment({ paymentId: payI2.id, verifiedBy: staff, invoiceIds: [invInst] });
await ok("E16: the second payment completes all installments", async () => eq(await instState(), ["1000.00/paid", "1000.00/paid", "1000.00/paid"]));
await fails("a void needs a reason", "reason_required", () => svc.voidPayment({ paymentId: payI2.id, voidedBy: staff, reason: "" }));
await ok("E9: a void reverses allocations, voids the receipt and re-derives caches", async () => {
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
await ok("a voided receipt reports as void", async () => {
  eq(await verifyReceipt(db, vI2.receipt.verificationCode, hmacSigner("test-secret")), { valid: false, reason: "void" });
});
await fails("a payment cannot be voided twice", "payment_not_verified", () => svc.voidPayment({ paymentId: payI2.id, voidedBy: staff, reason: "again" }));
await fails("a pending payment cannot be voided", "payment_not_verified", async () => {
  const p = await submit(st1, "10.00", "REF-V");
  await svc.voidPayment({ paymentId: p.id, voidedBy: staff, reason: "x" });
});
await ok("after a void the invoice can be paid again", async () => {
  const p = await submit(st1, "1500.00", "REF-I3");
  await svc.verifyPayment({ paymentId: p.id, verifiedBy: staff, invoiceIds: [invInst] });
  eq((await invoiceRow(invInst)).status, "paid");
});

// ---- cash
await ok("E11: cash is recorded already verified with a receipt", async () => {
  const inv = await mkInvoice(st2, b1, "2027-08-01", 400);
  const item = await mkItem(inv, enr2, 400);
  const ev = await svc.recordCashPayment({ studentId: st2, branchId: b1, amount: "400.00", recordedBy: staff, invoiceIds: [inv] });
  eq(ev.payment.status, "verified");
  eq(ev.allocations.map((a) => a.invoiceItemId), [item]);
  eq((await invoiceRow(inv)).status, "paid");
  eq(ev.receipt.status, "issued");
});

// ---- tamper detection
await ok("tampering with the stored hash is detected", async () => {
  await q(`UPDATE receipt SET content_hash = repeat('0', 64) WHERE id = $1`, [v1.receipt.id]);
  eq(await verifyReceipt(db, v1.receipt.verificationCode, hmacSigner("test-secret")), { valid: false, reason: "tampered" });
});
await ok("an unknown code is not found", async () => {
  eq(await verifyReceipt(db, "nope", hmacSigner("test-secret")), { valid: false, reason: "not_found" });
});

// ---- hooks join the transaction
await ok("a failing hook rolls the whole verification back", async () => {
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
