/**
 * Applies every migration to an in-process PostgreSQL (PGlite) and checks the database-level
 * rules from the invariants file. Run with: npm run db:test
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { seedDefaults } from "../src/seed";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite({ extensions: { btree_gist } });

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
    record(false, name, String((e as Error).message).slice(0, 200));
  }
}
async function rejects(name: string, pattern: RegExp, fn: () => Promise<unknown>) {
  try {
    await fn();
    record(false, name, "expected an error but it succeeded");
  } catch (e) {
    const err = e as Error & { cause?: { message?: string } };
    const msg = `${err.message} ${err.cause?.message ?? ""}`;
    record(pattern.test(msg), name, `wrong error: ${msg.slice(0, 200)}`);
  }
}
type Row = Record<string, unknown>;
async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await pg.query<Row>(text, params)).rows;
}
async function id(text: string, params: unknown[] = []): Promise<string> {
  const rows = await q(text + " RETURNING id", params);
  return String(rows[0]!.id);
}

// ---- apply migrations in journal order
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
for (const e of journal.entries) {
  await pg.exec(readFileSync(join(root, "drizzle", `${e.tag}.sql`), "utf8"));
  console.log(`applied ${e.tag}`);
}

// ---- seed through the Drizzle schema (also proves the TypeScript schema matches the SQL)
const db = drizzle(pg);
const seeded = await seedDefaults(db, { organizationName: "Test Institute", type: "institution" });
const b1 = seeded.defaultBranchId;

await ok("seed: 13 grades, 5 roles, default payment method is bank transfer", async () => {
  const g = await q(`SELECT count(*)::int AS n FROM grade_level`);
  const r = await q(`SELECT count(*)::int AS n FROM role`);
  const m = await q(`SELECT type FROM payment_method WHERE is_default`);
  if (g[0]!.n !== 13 || r[0]!.n !== 5 || m[0]!.type !== "bank_transfer") throw new Error("seed content wrong");
});
await rejects("A2: a second organization is rejected", /organization_singleton/, () =>
  q(`INSERT INTO organization (name, type) VALUES ('Second', 'individual')`),
);
await rejects("seed cannot run twice on one deployment", /organization_singleton/, () =>
  seedDefaults(db, { organizationName: "Again", type: "individual" }),
);

// ---- fixtures
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const u1 = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);
const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const g6 = String((await q(`SELECT id FROM grade_level WHERE name = 'Grade 6'`))[0]!.id);
const g7 = String((await q(`SELECT id FROM grade_level WHERE name = 'Grade 7'`))[0]!.id);
const st1 = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Nimal', '2014-05-01')`);
const st2 = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S2', 'Kamal', '2013-02-01')`);

await ok("student gets a generated 32-character QR token", async () => {
  const t = String((await q(`SELECT qr_token FROM student WHERE id = $1`, [st1]))[0]!.qr_token);
  if (t.length !== 32) throw new Error(`token length ${t.length}`);
});
await rejects("a user needs an email or a username", /user_has_login_check/, () =>
  q(`INSERT INTO "user" (phone) VALUES ('0770000000')`),
);
await rejects("a lecturer portal needs a user account", /lecturer_portal_needs_user_check/, () =>
  q(`INSERT INTO lecturer (full_name, portal_enabled) VALUES ('Ms Perera', true)`),
);

// ---- courses (C1)
const cls = await id(
  `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Grade 6 Science', 'class', 'scheduled')`,
  [subj, b1],
);
await rejects("C1: a class must be scheduled", /course_class_is_scheduled_check/, () =>
  q(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'x', 'class', 'self_paced')`, [subj, b1]),
);
await rejects("C1: a self-paced program has attendance off", /course_self_paced_no_attendance_check/, () =>
  q(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1, $2, 'x', 'program', 'self_paced', true)`, [subj, b1]),
);
const selfPaced = await id(
  `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1, $2, 'Photography online', 'program', 'self_paced', false)`,
  [subj, b1],
);
const sched = await id(
  `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Sewing', 'program', 'scheduled')`,
  [subj, b1],
);
const sched2 = await id(
  `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Carpentry', 'program', 'scheduled')`,
  [subj, b1],
);
const grp = await id(`INSERT INTO course_group (branch_id, subject_id, name) VALUES ($1, $2, 'Science 6-11')`, [b1, subj]);
await ok("a class can join a group of the same branch and subject", () =>
  q(`UPDATE course SET course_group_id = $1 WHERE id = $2`, [grp, cls]),
);
await rejects("a class cannot join a group of another branch", /course_group_branch_fk/, () =>
  q(`INSERT INTO course (subject_id, branch_id, course_group_id, name, kind) VALUES ($1, $2, $3, 'x', 'class')`, [subj, b2, grp]),
);

// ---- intakes and enrolments (C2, C3, C4, D2)
const intake1 = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'March intake', '2027-03-01')`, [sched]);
const intakeOther = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'Carpentry intake', '2027-03-01')`, [sched2]);
const intakeOnClass = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'bad', '2027-03-01')`, [cls]);

await rejects("C2: a class enrolment cannot have an intake", /C2/, () =>
  q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [cls, st1, intakeOnClass]),
);
await rejects("C2: a scheduled program enrolment needs an intake", /C2/, () =>
  q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [sched, st1]),
);
await rejects("C3: the intake must belong to the enrolment's course", /enrollment_intake_course_fk/, () =>
  q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [sched, st1, intakeOther]),
);
await rejects("C2: a self-paced enrolment cannot have an intake", /C2|enrollment_intake_course_fk/, () =>
  q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [selfPaced, st1, intake1]),
);
await ok("scheduled program with its own intake, and self-paced without one", async () => {
  await q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [sched, st1, intake1]);
  await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [selfPaced, st1]);
});

// ---- fee structures and rates (D1, D4, D5)
const fee1 = await id(
  `INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type, frequency) VALUES ($1, $2, 'Monthly', true, 'recurring', 'monthly')`,
  [b1, cls],
);
await rejects("D1: only one default fee structure per class", /fee_structure_one_default_per_course_uq/, () =>
  q(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type, frequency) VALUES ($1, $2, 'Other', true, 'recurring', 'monthly')`, [b1, cls]),
);
await rejects("D4: a recurring structure needs a frequency", /fee_structure_frequency_check/, () =>
  q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type) VALUES ($1, $2, 'x', 'recurring')`, [b1, cls]),
);
await rejects("D4: a package has no frequency", /fee_structure_frequency_check/, () =>
  q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'x', 'one_time_package', 'monthly')`, [b1, cls]),
);
await rejects("a fee structure's branch must be its course's branch", /fee_structure_course_branch_fk/, () =>
  q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'x', 'recurring', 'monthly')`, [b2, cls]),
);
await ok("a general fee has no course", () =>
  q(`INSERT INTO fee_structure (branch_id, name, billing_type) VALUES ($1, 'Admission', 'one_time_package')`, [b1]),
);

await ok("D5: rates for different grades and an all-grades rate coexist", async () => {
  await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1000, '2026-01-01')`, [fee1, g6]);
  await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1200, '2026-01-01')`, [fee1, g7]);
  await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 900, '2026-01-01')`, [fee1]);
});
await rejects("D5: overlapping rates for the same grade are rejected", /fee_rate_no_overlap/, () =>
  q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1100, '2026-06-01')`, [fee1, g6]),
);
await rejects("D5: overlapping all-grades rates are rejected", /fee_rate_no_overlap/, () =>
  q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 950, '2026-06-01')`, [fee1]),
);
await ok("D5: a new rate can start on the day the old one ends (end-exclusive)", async () => {
  await q(`UPDATE fee_rate SET effective_to = '2026-07-01' WHERE fee_structure_id = $1 AND grade_level_id = $2`, [fee1, g6]);
  await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1100, '2026-07-01')`, [fee1, g6]);
});

await ok("D2: an enrolment can use its own class's fee structure", () =>
  q(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`, [cls, st1, fee1]),
);
const feeOther = await id(
  `INSERT INTO fee_structure (branch_id, course_id, name, billing_type) VALUES ($1, $2, 'Sewing package', 'one_time_package')`,
  [b1, sched],
);
await rejects("D2: an enrolment cannot use another class's fee structure", /enrollment_fee_structure_course_fk/, () =>
  q(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`, [cls, st2, feeOther]),
);

// ---- C4, active enrolment uniqueness
await rejects("C4: one active enrolment per student and class", /enrollment_one_active_no_intake_uq/, () =>
  q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, st1]),
);
await rejects("an active enrolment has no end reason", /enrollment_active_has_no_end_reason_check/, () =>
  q(`INSERT INTO enrollment (course_id, student_id, end_reason) VALUES ($1, $2, 'dropped')`, [cls, st2]),
);
await ok("C4: after dropping, the student can enrol again", async () => {
  await q(`UPDATE enrollment SET status = 'dropped', end_reason = 'dropped' WHERE course_id = $1 AND student_id = $2`, [cls, st1]);
  await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, st1]);
});

// ---- grade history (B3, B4)
await ok("B3, B4: grade ranges can be adjacent (end-exclusive)", async () => {
  await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1, $2, '2026-01-01')`, [st1, g6]);
  await q(`UPDATE student_level SET to_date = '2026-12-01' WHERE student_id = $1`, [st1]);
  await q(`INSERT INTO student_level (student_id, grade_level_id, from_date, reason) VALUES ($1, $2, '2026-12-01', 'promotion')`, [st1, g7]);
});
await rejects("B3: only one current grade row per student", /student_level_one_current_uq/, () =>
  q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1, $2, '2027-06-01')`, [st1, g7]),
);
await rejects("B4: overlapping grade ranges are rejected", /student_level_no_overlap/, () =>
  q(`INSERT INTO student_level (student_id, grade_level_id, from_date, to_date) VALUES ($1, $2, '2026-06-01', '2026-07-01')`, [st1, g6]),
);

// ---- invoices and items (D7, D8, D9, D23, D26)
const enr = String((await q(`SELECT id FROM enrollment WHERE course_id = $1 AND student_id = $2 AND status = 'active'`, [cls, st1]))[0]!.id);
const mkInvoice = (student: string, total: number, branch = b1) =>
  id(
    `INSERT INTO invoice (student_id, branch_id, due_date, subtotal, total) VALUES ($1, $2, CURRENT_DATE + 7, $3, $3)`,
    [student, branch, total],
  );
const inv1 = await mkInvoice(st1, 1000);
const item1 = await id(
  `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2026-03-01', '2026-04-01')`,
  [inv1, enr, fee1],
);
await rejects("D7: the same recurring fee cannot be billed twice", /invoice_item_recurring_uq/, async () => {
  const dup = await mkInvoice(st1, 1000);
  await q(
    `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2026-03-01', '2026-04-01')`,
    [dup, enr, fee1],
  );
});
await ok("D26: after cancelling, the recurring fee can be reissued", async () => {
  await q(`UPDATE invoice_item SET cancelled_at = now() WHERE id = $1`, [item1]);
  await q(`UPDATE invoice SET status = 'cancelled' WHERE id = $1`, [inv1]);
  const again = await mkInvoice(st1, 1000);
  await q(
    `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2026-03-01', '2026-04-01')`,
    [again, enr, fee1],
  );
});
await rejects("D8: total must equal subtotal minus discount", /invoice_total_formula_check/, () =>
  q(`INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, CURRENT_DATE, 1000, 100, 1000)`, [st1, b1]),
);
await rejects("D9: a discount cannot exceed the subtotal", /invoice_discount_range_check/, () =>
  q(`INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, CURRENT_DATE, 100, 200, -100)`, [st1, b1]),
);
await rejects("D9: a zero total is allowed only when waived or cancelled", /invoice_zero_total_check/, () =>
  q(`INSERT INTO invoice (student_id, branch_id, due_date) VALUES ($1, $2, CURRENT_DATE)`, [st1, b1]),
);
await ok("D9: a free place is a waived invoice with a zero total", () =>
  q(`INSERT INTO invoice (student_id, branch_id, due_date, status) VALUES ($1, $2, CURRENT_DATE, 'waived')`, [st1, b1]),
);

const inv2 = await mkInvoice(st1, 1000);
const pay2 = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 1000)`, [inv2]);
await ok("D23: a discount item is negative and points at the item it reduces", () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', -100, $2)`, [inv2, pay2]),
);
await rejects("D8: a discount item cannot be positive", /invoice_item_sign_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', 100, $2)`, [inv2, pay2]),
);
await rejects("D23: a discount item must name the item it reduces", /invoice_item_discount_applies_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'discount', -100)`, [inv2]),
);
await rejects("D23: a negative adjustment must name the item it reduces", /invoice_item_negative_adjustment_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', -50)`, [inv2]),
);
await rejects("D23: a discount cannot reduce an item of another invoice", /invoice_item_applies_to_fk/, async () => {
  const other = await mkInvoice(st1, 500);
  await q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', -50, $2)`, [other, pay2]);
});
await rejects("a recurring fee item needs its enrolment and period", /invoice_item_recurring_fields_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'recurring_fee', 500)`, [inv2]),
);

// ---- payments, allocations (E3, E4, E6, E7, E10, E15)
const bank = await id(
  `INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'Test Institute', '123456')`,
  [b1],
);
const bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
const mkPayment = (amount: number, ref: string | null, student = st1, branch = b1, bankId: string | null = bank) =>
  id(
    `INSERT INTO payment (student_id, branch_id, payment_method_id, bank_account_id, amount, reference_no, submitted_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [student, branch, bankMethod, bankId, amount, ref, u1],
  );
const payA = await mkPayment(900, "REF-A");
await rejects("E10: the same bank reference cannot be used twice on an account", /payment_bank_reference_uq/, () => mkPayment(100, "REF-A"));
await rejects("E15: a bank payment's branch must be its bank account's branch", /payment_bank_account_branch_fk/, () =>
  mkPayment(100, "REF-B", st1, b2),
);
await rejects("a verified payment needs the verifier and time", /payment_verified_fields_check/, () =>
  q(`UPDATE payment SET status = 'verified' WHERE id = $1`, [payA]),
);
await ok("E10: a rejected payment frees its bank reference", async () => {
  await q(`UPDATE payment SET status = 'rejected', rejection_reason = 'blurry slip' WHERE id = $1`, [payA]);
  await mkPayment(900, "REF-A");
});

const payB = await mkPayment(900, "REF-C");
const verify = (payment: string) =>
  `UPDATE payment SET status = 'verified', verified_by = '${u1}', verified_at = now() WHERE id = '${payment}'`;
const alloc = (payment: string, invoice: string, item: string, amount: number, student = st1) =>
  `INSERT INTO payment_allocation (payment_id, student_id, invoice_id, invoice_item_id, amount) VALUES ('${payment}', '${student}', '${invoice}', '${item}', ${amount})`;

await rejects("E3, E4: verifying without allocations fails at commit", /E3\/E4/, () =>
  pg.transaction(async (tx) => {
    await tx.query(verify(payB));
  }),
);
await rejects("E4: allocations must sum exactly to the payment amount", /E3\/E4/, () =>
  pg.transaction(async (tx) => {
    await tx.query(verify(payB));
    await tx.query(alloc(payB, inv2, pay2, 800));
  }),
);
await rejects("E3: a payment that is not verified cannot hold allocations", /E3: payment/, () =>
  pg.transaction(async (tx) => {
    await tx.query(alloc(payB, inv2, pay2, 900));
  }),
);
await rejects("E6: an allocation cannot use another student's invoice", /payment_allocation_invoice_student_fk/, async () => {
  const otherInvoice = await mkInvoice(st2, 900);
  const otherItem = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 900)`, [otherInvoice]);
  await pg.transaction(async (tx) => {
    await tx.query(verify(payB));
    await tx.query(alloc(payB, otherInvoice, otherItem, 900, st1));
  });
});
await rejects("E7: an allocation's item must belong to its invoice", /payment_allocation_item_invoice_fk/, async () => {
  const otherInvoice = await mkInvoice(st1, 300);
  await pg.transaction(async (tx) => {
    await tx.query(verify(payB));
    await tx.query(alloc(payB, otherInvoice, pay2, 900));
  });
});
await ok("E3: verify and allocate in one transaction", () =>
  pg.transaction(async (tx) => {
    await tx.query(verify(payB));
    await tx.query(alloc(payB, inv2, pay2, 900));
  }),
);
await ok("E7: one payment can cover several invoices of the same student", async () => {
  const invX = await mkInvoice(st1, 1000);
  const itemX = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 1000)`, [invX]);
  const invY = await mkInvoice(st1, 500);
  const itemY = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 500)`, [invY]);
  const multi = await mkPayment(1500, "REF-MULTI");
  await pg.transaction(async (tx) => {
    await tx.query(verify(multi));
    await tx.query(alloc(multi, invX, itemX, 1000));
    await tx.query(alloc(multi, invY, itemY, 500));
  });
});
await ok("E9: voiding reverses the allocations and passes the integrity check", () =>
  pg.transaction(async (tx) => {
    await tx.query(
      `UPDATE payment SET status = 'voided', void_reason = 'duplicate', voided_by = '${u1}', voided_at = now() WHERE id = '${payB}'`,
    );
    await tx.query(`UPDATE payment_allocation SET reversed_at = now() WHERE payment_id = '${payB}'`);
  }),
);
await rejects("E9: voiding without reversing the allocations fails", /E3: payment/, async () => {
  const payC = await mkPayment(100, "REF-D");
  const invC = await mkInvoice(st1, 100);
  const itemC = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 100)`, [invC]);
  await pg.transaction(async (tx) => {
    await tx.query(verify(payC));
    await tx.query(alloc(payC, invC, itemC, 100));
  });
  await pg.transaction(async (tx) => {
    await tx.query(
      `UPDATE payment SET status = 'voided', void_reason = 'x', voided_by = '${u1}', voided_at = now() WHERE id = '${payC}'`,
    );
  });
});

// ---- receipts (E12, E13)
const verifiedPay = String((await q(`SELECT id FROM payment WHERE status = 'verified' LIMIT 1`))[0]!.id);
const mkReceipt = (no: string, code: string, status = "issued") =>
  id(
    `INSERT INTO receipt (payment_id, branch_id, receipt_no, verification_code, content_hash, signature, signed_at, status) VALUES ($1, $2, $3, $4, 'hash', 'sig', now(), $5)`,
    [verifiedPay, b1, no, code, status],
  );
const r1 = await mkReceipt("R-1", "code-1");
await rejects("E12: a payment has only one active receipt", /receipt_one_issued_per_payment_uq/, () => mkReceipt("R-2", "code-2"));
await ok("E12: a voided receipt can be replaced", async () => {
  await q(`UPDATE receipt SET status = 'void' WHERE id = $1`, [r1]);
  const r3 = await mkReceipt("R-3", "code-3");
  await q(`UPDATE receipt SET replaced_by_receipt_id = $1 WHERE id = $2`, [r3, r1]);
});
await rejects("E13: receipt numbers are unique per branch", /receipt_branch_no_uq/, () => mkReceipt("R-3", "code-4", "void"));

// ---- audit log (J4)
const audit = await id(`INSERT INTO audit_log (actor_user_id, action, entity_type) VALUES ($1, 'payment.verify', 'payment')`, [u1]);
await rejects("J4: audit log rows cannot be updated", /J4/, () => q(`UPDATE audit_log SET reason = 'edited' WHERE id = $1`, [audit]));
await rejects("J4: audit log rows cannot be deleted", /J4/, () => q(`DELETE FROM audit_log WHERE id = $1`, [audit]));
await rejects("J4: the audit log cannot be truncated", /J4/, () => q(`TRUNCATE audit_log`));

// ---- content, attendance, notices
const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Silva')`);
await rejects("F1: a recording needs a link", /content_item_kind_fields_check/, () =>
  q(`INSERT INTO content_item (lecturer_id, kind, title) VALUES ($1, 'recording', 'Lesson 1')`, [lec]),
);
await rejects("F2: paid content needs a price", /content_item_paid_price_check/, () =>
  q(`INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type) VALUES ($1, 'recording', 'L', 'https://youtu.be/x', 'paid')`, [lec]),
);
await ok("a recording with a link is accepted", () =>
  q(`INSERT INTO content_item (lecturer_id, kind, title, external_url) VALUES ($1, 'recording', 'Lesson 1', 'https://youtu.be/x')`, [lec]),
);
const sess = await id(
  `INSERT INTO class_session (course_id, session_date, starts_at, ends_at) VALUES ($1, '2026-03-02', '16:00', '17:30')`,
  [cls],
);
await ok("attendance is recorded once per student and session", () =>
  q(`INSERT INTO attendance (session_id, student_id, status) VALUES ($1, $2, 'present')`, [sess, st1]),
);
await rejects("attendance cannot be recorded twice for one student and session", /attendance_session_student_uq/, () =>
  q(`INSERT INTO attendance (session_id, student_id, status) VALUES ($1, $2, 'late')`, [sess, st1]),
);
const noticeId = await id(`INSERT INTO notice (author_id, title, body) VALUES ($1, 'Holiday', 'No class on Monday')`, [u1]);
await rejects("a notice for everyone has no target id", /notice_target_id_check/, () =>
  q(`INSERT INTO notice_target (notice_id, target_type, target_id) VALUES ($1, 'all', $2)`, [noticeId, st1]),
);
await rejects("a notice for a course needs its id", /notice_target_id_check/, () =>
  q(`INSERT INTO notice_target (notice_id, target_type) VALUES ($1, 'course')`, [noticeId]),
);

// ---- more rules: shares, primaries, sections, promotion items, NULL-safe checks
await rejects("H3: a co-teacher share cannot exceed 100", /course_lecturer_share_check/, () =>
  q(`INSERT INTO course_lecturer (course_id, lecturer_id, share_percent) VALUES ($1, $2, 120)`, [cls, lec]),
);
await ok("a course can have one primary lecturer", () =>
  q(`INSERT INTO course_lecturer (course_id, lecturer_id, is_primary, share_percent) VALUES ($1, $2, true, 60)`, [cls, lec]),
);
await rejects("a course cannot have two primary lecturers", /course_lecturer_one_primary_uq/, async () => {
  const lec2 = await id(`INSERT INTO lecturer (full_name) VALUES ('Ms Fernando')`);
  await q(`INSERT INTO course_lecturer (course_id, lecturer_id, is_primary, share_percent) VALUES ($1, $2, true, 40)`, [cls, lec2]);
});
await ok("a role can be assigned for all branches once", () =>
  q(`INSERT INTO staff_role_assignment (user_id, role_id) VALUES ($1, (SELECT id FROM role WHERE name = 'root_admin'))`, [u1]),
);
await rejects("the same all-branch role cannot be assigned twice", /staff_role_all_branches_uq/, () =>
  q(`INSERT INTO staff_role_assignment (user_id, role_id) VALUES ($1, (SELECT id FROM role WHERE name = 'root_admin'))`, [u1]),
);
await ok("a student can have one primary branch", () =>
  q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1, $2, true)`, [st1, b1]),
);
await rejects("a student cannot have two primary branches", /student_branch_one_primary_uq/, () =>
  q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1, $2, true)`, [st1, b2]),
);
const secA = await id(`INSERT INTO course_section (course_id, title) VALUES ($1, 'Unit 1')`, [cls]);
const secOther = await id(`INSERT INTO course_section (course_id, title) VALUES ($1, 'Other unit')`, [sched]);
const recId = String((await q(`SELECT id FROM content_item LIMIT 1`))[0]!.id);
await ok("content can be placed in a section of the same course", () =>
  q(`INSERT INTO course_content (course_id, section_id, content_id) VALUES ($1, $2, $3)`, [cls, secA, recId]),
);
await rejects("content cannot use a section of another course", /course_content_section_course_fk/, () =>
  q(`INSERT INTO course_content (course_id, section_id, content_id) VALUES ($1, $2, $3)`, [sched, secA, recId]),
);
const run = await id(`INSERT INTO promotion_run (performed_by, effective_date) VALUES ($1, '2027-01-01')`, [u1]);
await ok("a promotion item per class enrolment", () =>
  q(`INSERT INTO promotion_item (promotion_run_id, student_id, from_enrollment_id) VALUES ($1, $2, $3)`, [run, st1, enr]),
);
await rejects("a promotion run has one item per enrolment", /promotion_item_run_enrollment_uq/, () =>
  q(`INSERT INTO promotion_item (promotion_run_id, student_id, from_enrollment_id) VALUES ($1, $2, $3)`, [run, st1, enr]),
);
await rejects("a confirmed promotion run needs its confirmation time", /promotion_run_confirmed_check/, () =>
  q(`UPDATE promotion_run SET status = 'confirmed' WHERE id = $1`, [run]),
);
await rejects("a recurring fee structure with no frequency is rejected (NULL-safe)", /fee_structure_frequency_check/, () =>
  q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'y', 'recurring', NULL)`, [b1, cls]),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
