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
await ok("seed: notification channels, in-app on and the rest off", async () => {
  const r = await q(`SELECT channel, is_enabled FROM notification_channel ORDER BY channel`);
  const on = r.filter((x) => x.is_enabled).map((x) => x.channel);
  if (r.length !== 4 || on.length !== 1 || on[0] !== "in_app") throw new Error("channel seed wrong");
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

// ---- phase 2: installments, fee exceptions, notifications, push, messaging
const optA = await id(
  `INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, '3 installments', 3, 30)`,
  [feeOther],
);
await rejects("installment option needs at least 2 installments", /installment_option_count_check/, () =>
  q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, 'one', 1, 30)`, [feeOther]),
);
await rejects("installment down payment must be under 100 percent", /installment_option_down_payment_check/, () =>
  q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, down_payment_percent, interval_days) VALUES ($1, 'full', 2, 100, 30)`, [feeOther]),
);
await rejects("installment interval must be positive", /installment_option_interval_check/, () =>
  q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, 'zero', 2, 0)`, [feeOther]),
);
await rejects("installment option names are unique per fee structure", /installment_option_structure_name_uq/, () =>
  q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, '3 installments', 4, 30)`, [feeOther]),
);
const invInst = await id(
  `INSERT INTO invoice (student_id, branch_id, installment_option_id, due_date, subtotal, total) VALUES ($1, $2, $3, CURRENT_DATE + 7, 3000, 3000)`,
  [st1, b1, optA],
);
await ok("D10: installments with sequence numbers", async () => {
  await q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, 1, CURRENT_DATE + 7, 1000), ($1, 2, CURRENT_DATE + 37, 1000), ($1, 3, CURRENT_DATE + 67, 1000)`, [invInst]);
});
await rejects("D10: installment sequence is unique per invoice", /invoice_installment_seq_uq/, () =>
  q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, 2, CURRENT_DATE + 90, 10)`, [invInst]),
);
await rejects("installment amount must be positive", /invoice_installment_amount_check/, () =>
  q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, 9, CURRENT_DATE, 0)`, [invInst]),
);
await rejects("installment paid amount cannot exceed its amount", /invoice_installment_paid_check/, () =>
  q(`UPDATE invoice_installment SET amount_paid = 1500 WHERE invoice_id = $1 AND seq = 1`, [invInst]),
);
await rejects("installment status must be a known value", /invoice_installment_status_check/, () =>
  q(`UPDATE invoice_installment SET status = 'late' WHERE invoice_id = $1 AND seq = 1`, [invInst]),
);

const feeAlt = await id(
  `INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'Quarterly', 'recurring', 'monthly')`,
  [b1, cls],
);
const mkExc = (kind: string, from: string, to: string | null, alt: string | null, dType: string | null, dVal: number | null, reason = "Hardship", course = cls, enrollment = enr) =>
  id(
    `INSERT INTO fee_exception (enrollment_id, course_id, kind, alternate_fee_structure_id, discount_type, discount_value, effective_from, effective_to, reason, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [enrollment, course, kind, alt, dType, dVal, from, to, reason, u1],
  );
const enrFresh = await id(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, st2]);
const exc1 = await mkExc("discount", "2027-02-01", "2027-06-01", null, "percent", 50);
await ok("D16: an alternate option of the same class", () => mkExc("alternate_option", "2027-02-01", null, feeAlt, null, null));
await rejects("D20: an alternate option cannot come from another class", /fee_exception_alternate_course_fk/, () =>
  mkExc("alternate_option", "2028-01-01", null, feeOther, null, null, "Hardship", cls, enrFresh),
);
await rejects("D16: a discount cannot name an alternate option", /fee_exception_kind_columns_check/, () =>
  mkExc("discount", "2028-01-01", null, feeAlt, "percent", 10),
);
await rejects("D16: an alternate option cannot carry a discount", /fee_exception_kind_columns_check/, () =>
  mkExc("alternate_option", "2028-01-01", null, feeAlt, "percent", 10),
);
await rejects("D16: a discount needs a type and a value (NULL-safe)", /fee_exception_kind_columns_check/, () =>
  mkExc("discount", "2028-01-01", null, null, null, null),
);
await rejects("D19: a percent discount is at most 100", /fee_exception_discount_value_check/, () =>
  mkExc("discount", "2028-01-01", null, null, "percent", 150),
);
await rejects("D19: a fixed discount cannot be negative", /fee_exception_discount_value_check/, () =>
  mkExc("discount", "2028-01-01", null, null, "fixed", -5),
);
await ok("D19: a 100 percent discount (free place) is allowed", () => mkExc("discount", "2027-06-01", "2027-07-01", null, "percent", 100));
await rejects("D17: an exception needs a reason", /fee_exception_reason_check/, () =>
  mkExc("discount", "2028-01-01", null, null, "fixed", 100, "   "),
);
await rejects("D17: an exception ends after it starts", /fee_exception_dates_check/, () =>
  mkExc("discount", "2028-01-01", "2028-01-01", null, "fixed", 100),
);
await rejects("D18: two discounts cannot overlap on one enrolment", /fee_exception_no_overlap/, () =>
  mkExc("discount", "2027-05-01", "2027-08-01", null, "fixed", 100),
);
await rejects("D18: an open-ended exception overlaps a later one", /fee_exception_no_overlap/, () =>
  mkExc("alternate_option", "2030-01-01", null, feeAlt, null, null),
);
await ok("D18: ranges are end-exclusive, so back to back is allowed", () =>
  mkExc("discount", "2027-07-01", null, null, "fixed", 200),
);
await rejects("D21: ended_by without effective_to is rejected", /fee_exception_ended_check/, () =>
  q(`INSERT INTO fee_exception (enrollment_id, course_id, kind, discount_type, discount_value, effective_from, reason, created_by, ended_by) VALUES ($1, $2, 'discount', 'fixed', 5, '2040-01-01', 'x', $3, $3)`, [enr, cls, u1]),
);
await rejects("an exception's course must be its enrolment's course", /fee_exception_enrollment_course_fk/, () =>
  mkExc("discount", "2035-01-01", null, null, "fixed", 1, "x", sched, enrFresh),
);
await ok("D19: a discount item can link to its exception", () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id, fee_exception_id) VALUES ($1, 'discount', -500, $2, $3)`, [inv1, item1, exc1]),
);
await rejects("only discount items can carry a fee exception", /invoice_item_exception_kind_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id) VALUES ($1, 'adjustment', 10, $2)`, [inv1, exc1]),
);

const u2 = await id(`INSERT INTO "user" (email) VALUES ('parent@example.com')`);
await ok("J2: a notification is created", () =>
  q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'in_app', 'installment_due', 'inst-1')`, [u2]),
);
await rejects("J2: the same user, event key and channel cannot repeat", /notification_dedupe_uq/, () =>
  q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'in_app', 'installment_due', 'inst-1')`, [u2]),
);
await ok("J2: another channel for the same event key is allowed", () =>
  q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'sms', 'installment_due', 'inst-1')`, [u2]),
);
await rejects("a sent notification needs sent_at", /notification_sent_check/, () =>
  q(`INSERT INTO notification (user_id, channel, event, event_key, status) VALUES ($1, 'email', 'notice', 'n-1', 'sent')`, [u2]),
);
await rejects("a failed notification needs an error (NULL-safe)", /notification_failed_check/, () =>
  q(`INSERT INTO notification (user_id, channel, event, event_key, status) VALUES ($1, 'email', 'notice', 'n-2', 'failed')`, [u2]),
);
await rejects("a notification channel must be known", /notification_channel_value_check/, () =>
  q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'fax', 'notice', 'n-3')`, [u2]),
);
await ok("a notification channel can be switched on", () =>
  q(`UPDATE notification_channel SET is_enabled = true WHERE channel = 'sms'`),
);
await rejects("one row per notification channel", /notification_channel_uq/, () =>
  q(`INSERT INTO notification_channel (organization_id, channel) VALUES ((SELECT id FROM organization), 'sms')`),
);
await ok("a notification template", () =>
  q(`INSERT INTO notification_template (organization_id, event, channel, body) VALUES ((SELECT id FROM organization), 'payment_verified', 'sms', 'Payment received')`),
);
await rejects("one template per event and channel", /notification_template_uq/, () =>
  q(`INSERT INTO notification_template (organization_id, event, channel, body) VALUES ((SELECT id FROM organization), 'payment_verified', 'sms', 'Again')`),
);
await ok("a push subscription", () =>
  q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1, 'https://push.example/1', 'k', 'a')`, [u2]),
);
await rejects("a push endpoint is unique", /push_subscription_endpoint_unique/, () =>
  q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1, 'https://push.example/1', 'k', 'a')`, [u1]),
);

const thread = await id(`INSERT INTO message_thread (subject, created_by) VALUES ('Fees question', $1)`, [u2]);
await q(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2), ($1, $3)`, [thread, u1, u2]);
await ok("a participant can post a message", () =>
  q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'Hello')`, [thread, u2]),
);
const u3 = await id(`INSERT INTO "user" (email) VALUES ('outsider@example.com')`);
await rejects("a non-participant cannot post", /message_sender_participant_fk/, () =>
  q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'Hi')`, [thread, u3]),
);
await rejects("a message cannot be blank", /message_body_check/, () =>
  q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, '  ')`, [thread, u2]),
);
await rejects("a user joins a thread only once", /thread_participant_pk/, () =>
  q(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2)`, [thread, u2]),
);

// ---- phase 3: exams
const mkOnline = (title = "Unit test 1", extra = "") =>
  id(
    `INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts${extra ? ", " + extra.split("=")[0] : ""}) VALUES ($1, $2, 'online_mcq', now() - interval '1 hour', now() + interval '1 day', 2${extra ? ", " + extra.split("=")[1] : ""})`,
    [lec, title],
  );
const qA = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'What is H2O?')`, [lec]);
const qB = await id(`INSERT INTO question (lecturer_id, body, default_marks) VALUES ($1, 'Boiling point of water?', 2)`, [lec]);
await rejects("a question body cannot be blank", /question_body_check/, () =>
  q(`INSERT INTO question (lecturer_id, body) VALUES ($1, '  ')`, [lec]),
);
await rejects("question marks must be positive", /question_marks_check/, () =>
  q(`INSERT INTO question (lecturer_id, body, default_marks) VALUES ($1, 'x', 0)`, [lec]),
);
await ok("question options", () =>
  q(`INSERT INTO question_option (question_id, body, is_correct, position) VALUES ($1, 'Water', true, 1), ($1, 'Salt', false, 2)`, [qA]),
);
await rejects("option positions are unique per question", /question_option_position_uq/, () =>
  q(`INSERT INTO question_option (question_id, body, position) VALUES ($1, 'Dup', 1)`, [qA]),
);

const examA = await mkOnline();
await rejects("an online exam needs a window and attempt limit", /exam_mode_fields_check/, () =>
  q(`INSERT INTO exam (lecturer_id, title, mode) VALUES ($1, 'No window', 'online_mcq')`, [lec]),
);
await rejects("a paper exam cannot carry online settings", /exam_mode_fields_check/, () =>
  q(`INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks, max_attempts) VALUES ($1, 'Paper', 'paper', '2027-03-01', 100, 3)`, [lec]),
);
await rejects("a paper exam needs a date and total marks (NULL-safe)", /exam_mode_fields_check/, () =>
  q(`INSERT INTO exam (lecturer_id, title, mode) VALUES ($1, 'Paper', 'paper')`, [lec]),
);
await rejects("an exam closes after it opens", /exam_window_check/, () =>
  q(`INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts) VALUES ($1, 'Bad', 'online_mcq', now(), now() - interval '1 day', 1)`, [lec]),
);
await rejects("an exam allows at least one attempt", /exam_attempts_check/, () =>
  q(`INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts) VALUES ($1, 'Bad', 'online_mcq', now(), now() + interval '1 day', 0)`, [lec]),
);
const paperExam = await id(
  `INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks) VALUES ($1, 'Term test', 'paper', '2027-03-01', 100)`,
  [lec],
);
await q(`INSERT INTO exam_course (exam_id, course_id) VALUES ($1, $2), ($3, $2)`, [examA, cls, paperExam]);
await rejects("G4: an online exam cannot publish with no questions", /needs at least one question/, async () => {
  const empty = await mkOnline("Empty");
  await q(`UPDATE exam SET status = 'published' WHERE id = $1`, [empty]);
});
const eqA = await id(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 1)`, [examA, qA]);
await ok("a second question in the exam", () =>
  q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 2, 2)`, [examA, qB]),
);
await rejects("exam question positions are unique", /exam_question_position_uq/, () =>
  q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 2)`, [examA, qA]),
);
await rejects("a question is used once per exam", /exam_question_question_uq/, () =>
  q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 3)`, [examA, qA]),
);
await rejects("G4: publishing needs every snapshot", /needs its snapshot/, () =>
  q(`UPDATE exam SET status = 'published' WHERE id = $1`, [examA]),
);
await q(`UPDATE exam_question SET snapshot = '{"body":"What is H2O?","options":[{"key":"o1","body":"Water","correct":true}]}'::jsonb WHERE exam_id = $1`, [examA]);
await ok("G4: publish once every question has its snapshot", () =>
  q(`UPDATE exam SET status = 'published' WHERE id = $1`, [examA]),
);
await rejects("G4: a published exam cannot gain a question", /exam_question_frozen/, async () => {
  const q3 = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'Late question')`, [lec]);
  await q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 9)`, [examA, q3]);
});
await rejects("G4: a published exam's question cannot change", /exam_question_frozen/, () =>
  q(`UPDATE exam_question SET marks = 5 WHERE id = $1`, [eqA]),
);
await rejects("G4: a published exam's question cannot be removed", /exam_question_frozen/, () =>
  q(`DELETE FROM exam_question WHERE id = $1`, [eqA]),
);
await rejects("an exam cannot go back to draft", /cannot move an exam from published to draft/, () =>
  q(`UPDATE exam SET status = 'draft' WHERE id = $1`, [examA]),
);
await rejects("a draft exam cannot jump to closed", /cannot move an exam from draft to closed/, async () => {
  const d = await mkOnline("Draft only");
  await q(`UPDATE exam SET status = 'closed' WHERE id = $1`, [d]);
});
await rejects("the mode of a published exam cannot change", /mode of a published exam/, () =>
  q(`UPDATE exam SET mode = 'paper' WHERE id = $1`, [examA]),
);

const attempt1 = await id(
  `INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 1)`,
  [examA, st1, enr, cls],
);
await rejects("G2: one running attempt per student and exam", /exam_attempt_one_running_uq/, () =>
  q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 2)`, [examA, st1, enr, cls]),
);
await rejects("G2: attempt numbers are unique per exam and student", /exam_attempt_no_uq/, () =>
  q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no, status, submitted_at) VALUES ($1, $2, $3, $4, 1, 'expired', now())`, [examA, st1, enr, cls]),
);
await rejects("G3: the enrolment must belong to the student", /exam_attempt_enrollment_fk/, async () => {
  const attached = await mkOnline("Attached");
  await q(`INSERT INTO exam_course (exam_id, course_id) VALUES ($1, $2)`, [attached, cls]);
  await q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 1)`, [attached, st1, enrFresh, cls]);
});
await rejects("G3: the exam must be attached to the enrolment's course", /exam_attempt_exam_course_fk/, async () => {
  const unattached = await mkOnline("Unattached");
  await q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 1)`, [unattached, st1, enr, cls]);
});
await rejects("a submitted attempt needs its submission time", /exam_attempt_submitted_check/, () =>
  q(`UPDATE exam_attempt SET status = 'submitted' WHERE id = $1`, [attempt1]),
);
await rejects("a graded attempt needs a score", /exam_attempt_graded_check|exam_attempt_submitted_check/, () =>
  q(`UPDATE exam_attempt SET status = 'graded', submitted_at = now() WHERE id = $1`, [attempt1]),
);
await ok("an answer stores the selected option key", () =>
  q(`INSERT INTO attempt_answer (attempt_id, exam_id, exam_question_id, selected_option_key, is_correct, marks_awarded) VALUES ($1, $2, $3, 'o1', true, 1)`, [attempt1, examA, eqA]),
);
await rejects("one answer per question in an attempt", /attempt_answer_uq/, () =>
  q(`INSERT INTO attempt_answer (attempt_id, exam_id, exam_question_id) VALUES ($1, $2, $3)`, [attempt1, examA, eqA]),
);
await rejects("an answer's question must belong to the attempt's exam", /attempt_answer_question_exam_fk/, async () => {
  const other = await mkOnline("Other exam");
  const q4 = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'Other')`, [lec]);
  const eqOther = await id(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 1)`, [other, q4]);
  await q(`INSERT INTO attempt_answer (attempt_id, exam_id, exam_question_id) VALUES ($1, $2, $3)`, [attempt1, examA, eqOther]);
});
await q(`UPDATE exam_attempt SET status = 'graded', submitted_at = now(), score = 3 WHERE id = $1`, [attempt1]);

await rejects("G7: an online exam result cannot be entered manually", /comes from an attempt/, () =>
  q(`INSERT INTO exam_result (exam_id, student_id, marks, source) VALUES ($1, $2, 3, 'manual')`, [examA, st1]),
);
await rejects("G7: an attempt result needs its attempt (NULL-safe)", /exam_result_source_attempt_check/, () =>
  q(`INSERT INTO exam_result (exam_id, student_id, marks, source) VALUES ($1, $2, 3, 'attempt')`, [examA, st1]),
);
await rejects("an attempt result must use that student's attempt", /exam_result_attempt_fk/, () =>
  q(`INSERT INTO exam_result (exam_id, student_id, attempt_id, marks, source) VALUES ($1, $2, $3, 3, 'attempt')`, [examA, st2, attempt1]),
);
const resA = await id(
  `INSERT INTO exam_result (exam_id, student_id, enrollment_id, course_id, attempt_id, marks, source) VALUES ($1, $2, $3, $4, $5, 3, 'attempt')`,
  [examA, st1, enr, cls, attempt1],
);
await rejects("G7: one result per exam and student", /exam_result_uq/, () =>
  q(`INSERT INTO exam_result (exam_id, student_id, attempt_id, marks, source) VALUES ($1, $2, $3, 3, 'attempt')`, [examA, st1, attempt1]),
);
await rejects("a result's enrolment needs its course (pair)", /exam_result_enrollment_pair_check/, () =>
  q(`INSERT INTO exam_result (exam_id, student_id, enrollment_id, marks, source) VALUES ($1, $2, $3, 50, 'manual')`, [paperExam, st1, enr]),
);
await rejects("G7: a paper exam result cannot come from an attempt", /paper exam result is entered manually/, () =>
  q(`INSERT INTO exam_result (exam_id, student_id, attempt_id, marks, source) VALUES ($1, $2, $3, 50, 'attempt')`, [paperExam, st1, attempt1]),
);
await ok("G7: a paper result is entered manually", () =>
  q(`INSERT INTO exam_result (exam_id, student_id, enrollment_id, course_id, marks, grade, source) VALUES ($1, $2, $3, $4, 78, 'B', 'manual')`, [paperExam, st1, enr, cls]),
);
await rejects("G8: a result cannot be released before the exam closes", /released only after the exam is closed/, () =>
  q(`UPDATE exam_result SET released_at = now() WHERE id = $1`, [resA]),
);
await q(`UPDATE exam SET status = 'closed' WHERE id = $1`, [examA]);
await ok("G8: a result can be released once the exam is closed", () =>
  q(`UPDATE exam_result SET released_at = now() WHERE id = $1`, [resA]),
);
await ok("G8: a released online result can become a manual override", () =>
  q(`UPDATE exam_result SET source = 'manual_override', marks = 4 WHERE id = $1`, [resA]),
);

// ---- phase 4: content purchases, commissions, payouts
const cPaid = await id(
  `INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type, price) VALUES ($1, 'recording', 'Paid lesson', 'https://youtu.be/p', 'paid', 500)`,
  [lec],
);
const cPaid2 = await id(
  `INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type, price) VALUES ($1, 'recording', 'Paid lesson 2', 'https://youtu.be/p2', 'paid', 700)`,
  [lec],
);
const cBook = await id(
  `INSERT INTO content_item (lecturer_id, kind, title, access_type, price) VALUES ($1, 'physical_book', 'Science workbook', 'paid', 1500)`,
  [lec],
);
const cFree = await id(`INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type) VALUES ($1, 'recording', 'Free lesson', 'https://youtu.be/f', 'free_registered')`, [lec]);
await q(`INSERT INTO content_branch (content_id, branch_id) VALUES ($1, $5), ($2, $5), ($2, $6), ($3, $5), ($4, $5)`, [cPaid, cPaid2, cBook, cFree, b1, b2]);
const invC = await mkInvoice(st1, 500);
const purch = await id(
  `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 500)`,
  [cPaid, st1, invC, b1],
);
await rejects("F5: no second pending purchase of the same item", /content_purchase_active_uq/, () =>
  q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 500)`, [cPaid, st1, b1]),
);
await rejects("only a paid content item can be purchased", /only a paid content item/, () =>
  q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 100)`, [cFree, st2, b1]),
);
await rejects("D13: the branch must be one the item is listed in", /content_purchase_listed_branch_fk/, () =>
  q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 500)`, [cPaid, st2, b2]),
);
await rejects("a purchase's invoice must belong to the same student", /content_purchase_invoice_student_fk/, () =>
  q(`INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 700)`, [cPaid2, st2, invC, b1]),
);
await rejects("D24: a purchase's invoice must be in the purchase's branch", /content_purchase_invoice_branch_fk/, async () => {
  const invB2 = await mkInvoice(st1, 700, b2);
  await q(`INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 700)`, [cPaid2, st1, invB2, b1]);
});
await rejects("a purchase price must be positive", /content_purchase_price_check/, () =>
  q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 0)`, [cPaid2, st2, b1]),
);
await ok("an invoice line charges the purchase", () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'content', 500, $2)`, [invC, purch]),
);
await rejects("a content line needs its purchase (NULL-safe)", /invoice_item_content_fields_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'content', 500)`, [invC]),
);
await rejects("only content lines carry a purchase", /invoice_item_content_fields_check/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'adjustment', 5, $2)`, [invC, purch]),
);
await rejects("a purchase has one active content line", /invoice_item_content_purchase_uq/, () =>
  q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'content', 500, $2)`, [invC, purch]),
);
await rejects("a content line must use the purchase's own invoice", /invoice_item_purchase_invoice_fk/, async () => {
  const invOwn = await mkInvoice(st1, 700);
  const purch2 = await id(
    `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 700)`,
    [cPaid2, st1, invOwn, b1],
  );
  const other = await mkInvoice(st1, 700);
  await q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'content', 700, $2)`, [other, purch2]);
});
await rejects("F6: a pending purchase cannot be handed over", /content_purchase_handover_check/, () =>
  q(`UPDATE content_purchase SET handed_over_at = now(), handed_over_by = $2 WHERE id = $1`, [purch, u1]),
);
const invBook = await mkInvoice(st1, 1500);
const bookPurchase = await id(
  `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'physical', 1500)`,
  [cBook, st1, invBook, b1],
);
await q(`UPDATE content_purchase SET status = 'paid' WHERE id = $1`, [bookPurchase]);
await rejects("F6: handover records who handed it over", /content_purchase_handover_check/, () =>
  q(`UPDATE content_purchase SET handed_over_at = now() WHERE id = $1`, [bookPurchase]),
);
await ok("F6: a paid physical purchase can be handed over", () =>
  q(`UPDATE content_purchase SET handed_over_at = now(), handed_over_by = $2 WHERE id = $1`, [bookPurchase, u1]),
);
await rejects("F6: an online purchase has no handover", /content_purchase_handover_check/, async () => {
  await q(`UPDATE content_purchase SET status = 'paid' WHERE id = $1`, [purch]);
  await q(`UPDATE content_purchase SET handed_over_at = now(), handed_over_by = $2 WHERE id = $1`, [purch, u1]);
});
await q(`UPDATE content_purchase SET status = 'cancelled' WHERE id = $1`, [purch]);
await ok("F5: a cancelled purchase can be bought again", () =>
  q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 500)`, [cPaid, st1, b1]),
);

const lec3 = await id(`INSERT INTO lecturer (full_name) VALUES ('Ms Perera')`);
const ruleDefault = await id(
  `INSERT INTO commission_rule (lecturer_id, calc_type, commission_rate, effective_from) VALUES ($1, 'percent', 20, '2027-01-01')`,
  [lec],
);
await rejects("H4: overlapping rules of the same scope are rejected", /commission_rule_no_overlap/, () =>
  q(`INSERT INTO commission_rule (lecturer_id, calc_type, commission_rate, effective_from) VALUES ($1, 'percent', 25, '2028-01-01')`, [lec]),
);
await ok("H4: a rule for a different scope can overlap in dates", () =>
  q(`INSERT INTO commission_rule (lecturer_id, course_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'fixed_per_student_month', 150, '2027-01-01')`, [lec, cls]),
);
await ok("H4: another lecturer's default rule is independent", () =>
  q(`INSERT INTO commission_rule (lecturer_id, calc_type, commission_rate, effective_from) VALUES ($1, 'percent', 10, '2027-01-01')`, [lec3]),
);
await rejects("H12: a percent rate is at most 100", /commission_rule_rate_check/, () =>
  q(`INSERT INTO commission_rule (lecturer_id, subject_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'percent', 150, '2027-01-01')`, [lec, subj]),
);
await rejects("H12: a rate cannot be negative", /commission_rule_rate_check/, () =>
  q(`INSERT INTO commission_rule (lecturer_id, subject_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'fixed_per_student_month', -1, '2027-01-01')`, [lec, subj]),
);
await rejects("H4: a grade needs a subject", /commission_rule_scope_check/, () =>
  q(`INSERT INTO commission_rule (lecturer_id, grade_level_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'percent', 10, '2027-01-01')`, [lec, g6]),
);
await rejects("H4: a course rule is a course alone", /commission_rule_scope_check/, () =>
  q(`INSERT INTO commission_rule (lecturer_id, course_id, subject_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, $3, 'percent', 10, '2027-01-01')`, [lec, cls, subj]),
);
await rejects("a rule ends after it starts", /commission_rule_dates_check/, () =>
  q(`INSERT INTO commission_rule (lecturer_id, subject_id, calc_type, commission_rate, effective_from, effective_to) VALUES ($1, $2, 'percent', 10, '2027-01-01', '2027-01-01')`, [lec, subj]),
);

const invFee = await mkInvoice(st1, 1000);
const itemFee = await id(
  `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2027-05-01', '2027-06-01')`,
  [invFee, enr, fee1],
);
const payFee = await mkPayment(1000, "REF-FEE");
await pg.transaction(async (tx) => {
  await tx.query(verify(payFee));
  await tx.query(alloc(payFee, invFee, itemFee, 1000));
});
const feeAlloc = String((await q(`SELECT id FROM payment_allocation WHERE payment_id = $1`, [payFee]))[0]!.id);
const invAdj = await mkInvoice(st1, 300);
const itemAdj = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 300)`, [invAdj]);
const payAdj = await mkPayment(300, "REF-ADJ");
await pg.transaction(async (tx) => {
  await tx.query(verify(payAdj));
  await tx.query(alloc(payAdj, invAdj, itemAdj, 300));
});
const adjAlloc = String((await q(`SELECT id FROM payment_allocation WHERE payment_id = $1`, [payAdj]))[0]!.id);
const mkEntry = (opts: { type?: string; alloc?: string; rule?: string; lecturer?: string; base?: number; comm?: number; teacher?: number; reverses?: string | null; share?: number; status?: string; payout?: string | null } = {}) =>
  id(
    `INSERT INTO commission_entry (payment_allocation_id, rule_id, lecturer_id, payout_id, reverses_entry_id, entry_type, calc_type_applied, rate_applied, share_percent_applied, basis_applied, base_amount, commission_amount, teacher_amount, status) VALUES ($1, $2, $3, $4, $5, $6, 'percent', 20, $7, 'paid', $8, $9, $10, $11)`,
    [opts.alloc ?? feeAlloc, opts.rule ?? ruleDefault, opts.lecturer ?? lec, opts.payout ?? null, opts.reverses ?? null, opts.type ?? "accrual", opts.share ?? 60, opts.base ?? 100, opts.comm ?? 20, opts.teacher ?? 80, opts.status ?? "accrued"],
  );
const lecB = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Fernando')`);
await q(`INSERT INTO course_lecturer (course_id, lecturer_id, share_percent) VALUES ($1, $2, 40)`, [cls, lecB]);
const entry1 = await mkEntry();
await rejects("H2: one accrual per allocation and lecturer", /commission_entry_accrual_uq/, () => mkEntry());
await rejects("H1: teacher amount is base minus commission", /commission_entry_split_check/, () => mkEntry({ lecturer: lecB, rule: ruleDefault, teacher: 70 }));
await rejects("H12: an accrual's commission cannot exceed its base", /commission_entry_type_amounts_check/, () =>
  mkEntry({ comm: 120, teacher: -20 }),
);
await rejects("H12: an accrual cannot be negative", /commission_entry_type_amounts_check/, () =>
  mkEntry({ base: -100, comm: -20, teacher: -80 }),
);
await rejects("share applied is 0 to 100", /commission_entry_share_check/, () => mkEntry({ share: 120 }));
await rejects("the entry's rule must belong to its lecturer", /commission_entry_rule_lecturer_fk/, () =>
  mkEntry({ lecturer: lecB, rule: ruleDefault }),
);
await rejects("H11: the lecturer must teach the fee item's course", /does not teach the course/, async () => {
  const ruleLec3 = String((await q(`SELECT id FROM commission_rule WHERE lecturer_id = $1`, [lec3]))[0]!.id);
  await mkEntry({ lecturer: lec3, rule: ruleLec3 });
});
await rejects("H11: only fee items accrue commission", /only fee items accrue commission/, () => mkEntry({ alloc: adjAlloc, lecturer: lec, rule: ruleDefault }));
await rejects("a settled entry needs a payout", /commission_entry_payout_check/, () =>
  q(`UPDATE commission_entry SET status = 'settled' WHERE id = $1`, [entry1]),
);
await rejects("H7: a reversal must reverse something", /must reverse an accrual|commission_entry_type_amounts_check/, () =>
  mkEntry({ type: "reversal", base: -100, comm: -20, teacher: -80 }),
);
await rejects("H12: a reversal must be the exact negative", /exact negative/, () =>
  mkEntry({ type: "reversal", reverses: entry1, base: -100, comm: -10, teacher: -90 }),
);
const rev1 = await mkEntry({ type: "reversal", reverses: entry1, base: -100, comm: -20, teacher: -80 });
await ok("H7: an exact reversal entry", async () => {
  if (!rev1) throw new Error("no reversal");
});
await rejects("H7: an entry is reversed once", /commission_entry_reversal_uq/, () =>
  mkEntry({ type: "reversal", reverses: entry1, base: -100, comm: -20, teacher: -80 }),
);
await rejects("H7: a reversal cannot be reversed", /must reverse an accrual/, () =>
  mkEntry({ type: "reversal", reverses: rev1, base: 100, comm: 20, teacher: 80 }),
);
await rejects("H6: entry amounts cannot be edited", /only status and payout can change/, () =>
  q(`UPDATE commission_entry SET base_amount = 200, commission_amount = 40, teacher_amount = 160 WHERE id = $1`, [entry1]),
);
await rejects("commission entries are never deleted", /never deleted/, () => q(`DELETE FROM commission_entry WHERE id = $1`, [entry1]));

const payout = await id(
  `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-01-01', '2027-02-01', 100, 20, 80)`,
  [lec],
);
await rejects("a payout's net is gross minus commission", /teacher_payout_amounts_check/, () =>
  q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-02-01', '2027-03-01', 100, 20, 90)`, [lec]),
);
await rejects("H8: a payout cannot be negative", /teacher_payout_amounts_check/, () =>
  q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-02-01', '2027-03-01', 0, 20, -20)`, [lec]),
);
await rejects("a payout period ends after it starts", /teacher_payout_period_check/, () =>
  q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-02-01', '2027-02-01', 0, 0, 0)`, [lec]),
);
await rejects("an entry cannot join another lecturer's payout", /commission_entry_payout_lecturer_fk/, async () => {
  const otherPayout = await id(
    `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-01-01', '2027-02-01', 0, 0, 0)`,
    [lec3],
  );
  await q(`UPDATE commission_entry SET status = 'settled', payout_id = $2 WHERE id = $1`, [entry1, otherPayout]);
});
await ok("H8: an entry is settled in the payout", () =>
  q(`UPDATE commission_entry SET status = 'settled', payout_id = $2 WHERE id = $1`, [entry1, payout]),
);
await rejects("an approved payout needs an approver (NULL-safe)", /teacher_payout_approved_check/, () =>
  q(`UPDATE teacher_payout SET status = 'approved' WHERE id = $1`, [payout]),
);
await rejects("a payout cannot skip approval", /cannot move a payout from draft to paid/, () =>
  q(`UPDATE teacher_payout SET status = 'paid', approved_by = $2, paid_on = '2027-02-05', payment_reference = 'TRX-1' WHERE id = $1`, [payout, u1]),
);
await q(`UPDATE teacher_payout SET status = 'approved', approved_by = $2 WHERE id = $1`, [payout, u1]);
await rejects("an approved payout cannot be deleted", /only a draft payout can be deleted/, () => q(`DELETE FROM teacher_payout WHERE id = $1`, [payout]));
await rejects("a paid payout needs its date and reference", /teacher_payout_paid_check/, () =>
  q(`UPDATE teacher_payout SET status = 'paid' WHERE id = $1`, [payout]),
);
await ok("a payout is marked paid", () =>
  q(`UPDATE teacher_payout SET status = 'paid', paid_on = '2027-02-05', payment_reference = 'TRX-1' WHERE id = $1`, [payout]),
);
await rejects("H8: a paid payout is immutable", /paid payout is immutable/, () =>
  q(`UPDATE teacher_payout SET payment_reference = 'edited' WHERE id = $1`, [payout]),
);
await rejects("H8: an entry in a paid payout cannot change", /entry in a paid payout cannot change/, () =>
  q(`UPDATE commission_entry SET status = 'void', payout_id = NULL WHERE id = $1`, [entry1]),
);
await ok("a draft payout can be deleted", async () => {
  const d = await id(
    `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2028-01-01', '2028-02-01', 0, 0, 0)`,
    [lec],
  );
  await q(`DELETE FROM teacher_payout WHERE id = $1`, [d]);
});

// ---- phase 5: gateway
const gwMethod = await id(
  `INSERT INTO payment_method (organization_id, type, label) VALUES ((SELECT id FROM organization), 'gateway', 'Card payment')`,
);
const gwPayment = await id(
  `INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 1200, $4)`,
  [st1, b1, gwMethod, u1],
);
const gwTx = await id(`INSERT INTO gateway_transaction (payment_id, provider) VALUES ($1, 'payhere')`, [gwPayment]);
await ok("a gateway transaction starts initiated with no reference", async () => {
  const r = await q(`SELECT status, provider_ref FROM gateway_transaction WHERE id = $1`, [gwTx]);
  if (r[0]!.status !== "initiated" || r[0]!.provider_ref !== null) throw new Error("unexpected defaults");
});
await rejects("a gateway transaction needs a gateway payment", /must use a gateway payment method/, () =>
  q(`INSERT INTO gateway_transaction (payment_id, provider) VALUES ($1, 'payhere')`, [payA]),
);
await rejects("a succeeded transaction needs its provider reference (NULL-safe)", /gateway_transaction_succeeded_check/, () =>
  q(`UPDATE gateway_transaction SET status = 'succeeded' WHERE id = $1`, [gwTx]),
);
await rejects("a transaction status must be known", /gateway_transaction_status_check/, () =>
  q(`UPDATE gateway_transaction SET status = 'refunded' WHERE id = $1`, [gwTx]),
);
await rejects("a blank provider reference is rejected", /gateway_transaction_ref_check/, () =>
  q(`UPDATE gateway_transaction SET provider_ref = '  ' WHERE id = $1`, [gwTx]),
);
await ok("a callback records the provider reference and payload", () =>
  q(`UPDATE gateway_transaction SET status = 'succeeded', provider_ref = 'PH-1001', raw_payload = '{"status_code":2}'::jsonb WHERE id = $1`, [gwTx]),
);
await rejects("E14: a provider reference is unique per provider", /gateway_transaction_provider_ref_uq/, async () => {
  const pay2 = await id(
    `INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 500, $4)`,
    [st1, b1, gwMethod, u1],
  );
  await q(`INSERT INTO gateway_transaction (payment_id, provider, provider_ref) VALUES ($1, 'payhere', 'PH-1001')`, [pay2]);
});
await ok("E14: the same reference at another provider is allowed", async () => {
  const pay3 = await id(
    `INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 500, $4)`,
    [st1, b1, gwMethod, u1],
  );
  await q(`INSERT INTO gateway_transaction (payment_id, provider, provider_ref) VALUES ($1, 'stripe', 'PH-1001')`, [pay3]);
});
await ok("transactions without a reference yet can coexist", () =>
  q(`INSERT INTO gateway_transaction (payment_id, provider) VALUES ($1, 'payhere')`, [gwPayment]),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
