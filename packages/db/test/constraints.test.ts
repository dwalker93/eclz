/**
 * Database-level rules from the invariants file: constraints, triggers and uniqueness, checked on an in-process PostgreSQL.
 */
import { afterAll, beforeAll, describe, test } from "bun:test";
import { eq, rejects } from "./helpers";
import { seedDefaults } from "../src/seed";
import { createTestDb } from "./setup";

const { pg, db, q, id, close } = await createTestDb();
afterAll(async () => {
  await close();
});

const seeded = await seedDefaults(db, { organizationName: "Test Institute", type: "institution" });

const b1 = seeded.defaultBranchId;

const mkInvoice = (student: string, total: number, branch = b1) =>
  id(
    `INSERT INTO invoice (student_id, branch_id, due_date, subtotal, total) VALUES ($1, $2, CURRENT_DATE + 7, $3, $3)`,
    [student, branch, total],
  );

const mkPayment = (amount: number, ref: string | null, student = st1, branch = b1, bankId: string | null = bank) =>
  id(
    `INSERT INTO payment (student_id, branch_id, payment_method_id, bank_account_id, amount, reference_no, submitted_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [student, branch, bankMethod, bankId, amount, ref, u1],
  );

const verify = (payment: string) =>
  `UPDATE payment SET status = 'verified', verified_by = '${u1}', verified_at = now() WHERE id = '${payment}'`;

const alloc = (payment: string, invoice: string, item: string, amount: number, student = st1) =>
  `INSERT INTO payment_allocation (payment_id, student_id, invoice_id, invoice_item_id, amount) VALUES ('${payment}', '${student}', '${invoice}', '${item}', ${amount})`;

const mkReceipt = (no: string, code: string, status = "issued") =>
  id(
    `INSERT INTO receipt (payment_id, branch_id, receipt_no, verification_code, content_hash, signature, signed_at, status) VALUES ($1, $2, $3, $4, 'hash', 'sig', now(), $5)`,
    [verifiedPay, b1, no, code, status],
  );

const mkExc = (kind: string, from: string, to: string | null, alt: string | null, dType: string | null, dVal: number | null, reason = "Hardship", course = cls, enrollment = enr) =>
  id(
    `INSERT INTO fee_exception (enrollment_id, course_id, kind, alternate_fee_structure_id, discount_type, discount_value, effective_from, effective_to, reason, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [enrollment, course, kind, alt, dType, dVal, from, to, reason, u1],
  );

const mkOnline = (title = "Unit test 1", extra = "") =>
  id(
    `INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts${extra ? ", " + extra.split("=")[0] : ""}) VALUES ($1, $2, 'online_mcq', now() - interval '1 hour', now() + interval '1 day', 2${extra ? ", " + extra.split("=")[1] : ""})`,
    [lec, title],
  );

const mkEntry = (opts: { type?: string; alloc?: string; rule?: string; lecturer?: string; base?: number; comm?: number; teacher?: number; reverses?: string | null; share?: number; status?: string; payout?: string | null } = {}) =>
  id(
    `INSERT INTO commission_entry (payment_allocation_id, rule_id, lecturer_id, payout_id, reverses_entry_id, entry_type, calc_type_applied, rate_applied, share_percent_applied, basis_applied, base_amount, commission_amount, teacher_amount, status) VALUES ($1, $2, $3, $4, $5, $6, 'percent', 20, $7, 'paid', $8, $9, $10, $11)`,
    [opts.alloc ?? feeAlloc, opts.rule ?? ruleDefault, opts.lecturer ?? lec, opts.payout ?? null, opts.reverses ?? null, opts.type ?? "accrual", opts.share ?? 60, opts.base ?? 100, opts.comm ?? 20, opts.teacher ?? 80, opts.status ?? "accrued"],
  );

let b2: string;
let u1: string;
let subj: string;
let g6: string;
let g7: string;
let st1: string;
let st2: string;
let cls: string;
let selfPaced: string;
let sched: string;
let sched2: string;
let grp: string;
let intake1: string;
let intakeOther: string;
let intakeSelfPaced: string;
let intakeOnClass: string;
let fee1: string;
let feeOther: string;
let enr: string;
let inv1: Awaited<ReturnType<typeof mkInvoice>>;
let item1: string;
let inv2: Awaited<ReturnType<typeof mkInvoice>>;
let pay2: string;
let bank: string;
let bankMethod: string;
let payA: Awaited<ReturnType<typeof mkPayment>>;
let payB: Awaited<ReturnType<typeof mkPayment>>;
let verifiedPay: string;
let r1: Awaited<ReturnType<typeof mkReceipt>>;
let audit: string;
let lec: string;
let sess: string;
let noticeId: string;
let secA: string;
let secOther: string;
let recId: string;
let run: string;
let optA: string;
let invInst: string;
let feeAlt: string;
let enrFresh: string;
let exc1: Awaited<ReturnType<typeof mkExc>>;
let u2: string;
let thread: string;
let u3: string;
let qA: string;
let qB: string;
let examA: Awaited<ReturnType<typeof mkOnline>>;
let paperExam: string;
let eqA: string;
let attempt1: string;
let resA: string;
let cPaid: string;
let cPaid2: string;
let cBook: string;
let cFree: string;
let invC: Awaited<ReturnType<typeof mkInvoice>>;
let purch: string;
let invBook: Awaited<ReturnType<typeof mkInvoice>>;
let bookPurchase: string;
let lec3: string;
let ruleDefault: string;
let invFee: Awaited<ReturnType<typeof mkInvoice>>;
let itemFee: string;
let payFee: Awaited<ReturnType<typeof mkPayment>>;
let feeAlloc: string;
let invAdj: Awaited<ReturnType<typeof mkInvoice>>;
let itemAdj: string;
let payAdj: Awaited<ReturnType<typeof mkPayment>>;
let adjAlloc: string;
let lecB: string;
let entry1: Awaited<ReturnType<typeof mkEntry>>;
let rev1: Awaited<ReturnType<typeof mkEntry>>;
let payout: string;
let gwMethod: string;
let gwPayment: string;
let gwTx: string;

describe("Organization singleton (A2)", () => {
  test("A2: a second organization is rejected", () => rejects(/organization_singleton/, () =>
    q(`INSERT INTO organization (name, type) VALUES ('Second', 'individual')`)));
});

describe("Users, students and lecturers", () => {
  beforeAll(async () => {
    b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
    u1 = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);
    subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
    g6 = String((await q(`SELECT id FROM grade_level WHERE name = 'Grade 6'`))[0]!.id);
    g7 = String((await q(`SELECT id FROM grade_level WHERE name = 'Grade 7'`))[0]!.id);
    st1 = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Nimal', '2014-05-01')`);
    st2 = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S2', 'Kamal', '2013-02-01')`);
  });

  test("student gets a generated 32-character QR token", async () => {
    const t = String((await q(`SELECT qr_token FROM student WHERE id = $1`, [st1]))[0]!.qr_token);
    if (t.length !== 32) throw new Error(`token length ${t.length}`);
  });
  test("a user needs an email or a username", () => rejects(/user_has_login_check/, () =>
    q(`INSERT INTO "user" (phone) VALUES ('0770000000')`)));
  test("a lecturer portal needs a user account", () => rejects(/lecturer_portal_needs_user_check/, () =>
    q(`INSERT INTO lecturer (full_name, portal_enabled) VALUES ('Ms Perera', true)`)));
});

describe("Courses (C1)", () => {
  beforeAll(async () => {
    cls = await id(
      `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Grade 6 Science', 'class', 'scheduled')`,
      [subj, b1],
    );
  });

  test("C1: a class must be scheduled", () => rejects(/course_class_is_scheduled_check/, () =>
    q(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'x', 'class', 'self_paced')`, [subj, b1])));
  test("C1: a self-paced program has attendance off", () => rejects(/course_self_paced_no_attendance_check/, () =>
    q(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1, $2, 'x', 'program', 'self_paced', true)`, [subj, b1])));
});

describe("Course groups", () => {
  beforeAll(async () => {
    selfPaced = await id(
      `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1, $2, 'Photography online', 'program', 'self_paced', false)`,
      [subj, b1],
    );
    sched = await id(
      `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Sewing', 'program', 'scheduled')`,
      [subj, b1],
    );
    sched2 = await id(
      `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Carpentry', 'program', 'scheduled')`,
      [subj, b1],
    );
    grp = await id(`INSERT INTO course_group (branch_id, subject_id, name) VALUES ($1, $2, 'Science 6-11')`, [b1, subj]);
  });

  test("a class can join a group of the same branch and subject", () =>
    q(`UPDATE course SET course_group_id = $1 WHERE id = $2`, [grp, cls]));
  test("a class cannot join a group of another branch", () => rejects(/course_group_branch_fk/, () =>
    q(`INSERT INTO course (subject_id, branch_id, course_group_id, name, kind) VALUES ($1, $2, $3, 'x', 'class')`, [subj, b2, grp])));
});

describe("Intakes and enrolments (C2 to C4, D2)", () => {
  beforeAll(async () => {
    intake1 = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'March intake', '2027-03-01')`, [sched]);
    intakeOther = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'Carpentry intake', '2027-03-01')`, [sched2]);
    // An intake that belongs to the self-paced course itself: the composite foreign key matches, so only the C2 trigger can refuse the enrolment.
    intakeSelfPaced = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'Online intake', '2027-03-01')`, [selfPaced]);
    intakeOnClass = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'bad', '2027-03-01')`, [cls]);
  });

  test("C2: a class enrolment cannot have an intake", () => rejects(/C2/, () =>
    q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [cls, st1, intakeOnClass])));
  test("C2: a scheduled program enrolment needs an intake", () => rejects(/C2/, () =>
    q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [sched, st1])));
  test("C3: the intake must belong to the enrolment's course", () => rejects(/enrollment_intake_course_fk/, () =>
    q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [sched, st1, intakeOther])));
  test("C2: a self-paced enrolment cannot have an intake", () => rejects(/C2/, () =>
    q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [selfPaced, st1, intakeSelfPaced])));
  test("scheduled program with its own intake, and self-paced without one", async () => {
    await q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [sched, st1, intake1]);
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [selfPaced, st1]);
  });
});

describe("Fee structures and rates (D1, D4, D5)", () => {
  beforeAll(async () => {
    fee1 = await id(
      `INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type, frequency) VALUES ($1, $2, 'Monthly', true, 'recurring', 'monthly')`,
      [b1, cls],
    );
  });

  test("D1: only one default fee structure per class", () => rejects(/fee_structure_one_default_per_course_uq/, () =>
    q(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type, frequency) VALUES ($1, $2, 'Other', true, 'recurring', 'monthly')`, [b1, cls])));
  test("D4: a recurring structure needs a frequency", () => rejects(/fee_structure_frequency_check/, () =>
    q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type) VALUES ($1, $2, 'x', 'recurring')`, [b1, cls])));
  test("D4: a package has no frequency", () => rejects(/fee_structure_frequency_check/, () =>
    q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'x', 'one_time_package', 'monthly')`, [b1, cls])));
  test("a fee structure's branch must be its course's branch", () => rejects(/fee_structure_course_branch_fk/, () =>
    q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'x', 'recurring', 'monthly')`, [b2, cls])));
  test("a general fee has no course", () =>
    q(`INSERT INTO fee_structure (branch_id, name, billing_type) VALUES ($1, 'Admission', 'one_time_package')`, [b1]));
  test("D5: rates for different grades and an all-grades rate coexist", async () => {
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1000, '2026-01-01')`, [fee1, g6]);
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1200, '2026-01-01')`, [fee1, g7]);
    await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 900, '2026-01-01')`, [fee1]);
  });
  test("D5: overlapping rates for the same grade are rejected", () => rejects(/fee_rate_no_overlap/, () =>
    q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1100, '2026-06-01')`, [fee1, g6])));
  test("D5: overlapping all-grades rates are rejected", () => rejects(/fee_rate_no_overlap/, () =>
    q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 950, '2026-06-01')`, [fee1])));
  test("D5: a new rate can start on the day the old one ends (end-exclusive)", async () => {
    await q(`UPDATE fee_rate SET effective_to = '2026-07-01' WHERE fee_structure_id = $1 AND grade_level_id = $2`, [fee1, g6]);
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1, $2, 1100, '2026-07-01')`, [fee1, g6]);
  });
  test("D2: an enrolment can use its own class's fee structure", () =>
    q(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`, [cls, st1, fee1]));
});

describe("Fee structure on an enrolment (D2)", () => {
  beforeAll(async () => {
    feeOther = await id(
      `INSERT INTO fee_structure (branch_id, course_id, name, billing_type) VALUES ($1, $2, 'Sewing package', 'one_time_package')`,
      [b1, sched],
    );
  });

  test("D2: an enrolment cannot use another class's fee structure", () => rejects(/enrollment_fee_structure_course_fk/, () =>
    q(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`, [cls, st2, feeOther])));
});

describe("Active enrolment uniqueness (C4)", () => {
  test("C4: one active enrolment per student and class", () => rejects(/enrollment_one_active_no_intake_uq/, () =>
    q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, st1])));
  test("an active enrolment has no end reason", () => rejects(/enrollment_active_has_no_end_reason_check/, () =>
    q(`INSERT INTO enrollment (course_id, student_id, end_reason) VALUES ($1, $2, 'dropped')`, [cls, st2])));
  test("C4: after dropping, the student can enrol again", async () => {
    await q(`UPDATE enrollment SET status = 'dropped', end_reason = 'dropped' WHERE course_id = $1 AND student_id = $2`, [cls, st1]);
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, st1]);
  });
});

describe("Grade history (B3, B4)", () => {
  test("B3, B4: grade ranges can be adjacent (end-exclusive)", async () => {
    await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1, $2, '2026-01-01')`, [st1, g6]);
    await q(`UPDATE student_level SET to_date = '2026-12-01' WHERE student_id = $1`, [st1]);
    await q(`INSERT INTO student_level (student_id, grade_level_id, from_date, reason) VALUES ($1, $2, '2026-12-01', 'promotion')`, [st1, g7]);
  });
  test("B3: only one current grade row per student", () => rejects(/student_level_one_current_uq/, () =>
    q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1, $2, '2027-06-01')`, [st1, g7])));
  test("B4: overlapping grade ranges are rejected", () => rejects(/student_level_no_overlap/, () =>
    q(`INSERT INTO student_level (student_id, grade_level_id, from_date, to_date) VALUES ($1, $2, '2026-06-01', '2026-07-01')`, [st1, g6])));
});

describe("Invoices and items (D7 to D9)", () => {
  beforeAll(async () => {
    enr = String((await q(`SELECT id FROM enrollment WHERE course_id = $1 AND student_id = $2 AND status = 'active'`, [cls, st1]))[0]!.id);
    inv1 = await mkInvoice(st1, 1000);
    item1 = await id(
      `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2026-03-01', '2026-04-01')`,
      [inv1, enr, fee1],
    );
  });

  test("D7: the same recurring fee cannot be billed twice", () => rejects(/invoice_item_recurring_uq/, async () => {
    const dup = await mkInvoice(st1, 1000);
    await q(
      `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2026-03-01', '2026-04-01')`,
      [dup, enr, fee1],
    );
  }));
  test("D26: after cancelling, the recurring fee can be reissued", async () => {
    await q(`UPDATE invoice_item SET cancelled_at = now() WHERE id = $1`, [item1]);
    await q(`UPDATE invoice SET status = 'cancelled' WHERE id = $1`, [inv1]);
    const again = await mkInvoice(st1, 1000);
    await q(
      `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2026-03-01', '2026-04-01')`,
      [again, enr, fee1],
    );
  });
  test("D8: total must equal subtotal minus discount", () => rejects(/invoice_total_formula_check/, () =>
    q(`INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, CURRENT_DATE, 1000, 100, 1000)`, [st1, b1])));
  test("D9: a discount cannot exceed the subtotal", () => rejects(/invoice_discount_range_check/, () =>
    q(`INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, CURRENT_DATE, 100, 200, -100)`, [st1, b1])));
  test("D9: a zero total is allowed only when waived or cancelled", () => rejects(/invoice_zero_total_check/, () =>
    q(`INSERT INTO invoice (student_id, branch_id, due_date) VALUES ($1, $2, CURRENT_DATE)`, [st1, b1])));
  test("D9: a free place is a waived invoice with a zero total", () =>
    q(`INSERT INTO invoice (student_id, branch_id, due_date, status) VALUES ($1, $2, CURRENT_DATE, 'waived')`, [st1, b1]));
});

describe("Discount and fee items (D23, D26)", () => {
  beforeAll(async () => {
    inv2 = await mkInvoice(st1, 1000);
    pay2 = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 1000)`, [inv2]);
  });

  test("D23: a discount item is negative and points at the item it reduces", () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', -100, $2)`, [inv2, pay2]));
  test("D8: a discount item cannot be positive", () => rejects(/invoice_item_sign_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', 100, $2)`, [inv2, pay2])));
  test("D23: a discount item must name the item it reduces", () => rejects(/invoice_item_discount_applies_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'discount', -100)`, [inv2])));
  test("D23: a negative adjustment must name the item it reduces", () => rejects(/invoice_item_negative_adjustment_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', -50)`, [inv2])));
  test("D23: a discount cannot reduce an item of another invoice", () => rejects(/invoice_item_applies_to_fk/, async () => {
    const other = await mkInvoice(st1, 500);
    await q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id) VALUES ($1, 'discount', -50, $2)`, [other, pay2]);
  }));
  test("a recurring fee item needs its enrolment and period", () => rejects(/invoice_item_recurring_fields_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'recurring_fee', 500)`, [inv2])));
});

describe("Bank references (E10)", () => {
  beforeAll(async () => {
    bank = await id(
      `INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'Test Institute', '123456')`,
      [b1],
    );
    bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
    payA = await mkPayment(900, "REF-A");
  });

  test("E10: the same bank reference cannot be used twice on an account", () => rejects(/payment_bank_reference_uq/, () => mkPayment(100, "REF-A")));
  test("E15: a bank payment's branch must be its bank account's branch", () => rejects(/payment_bank_account_branch_fk/, () =>
    mkPayment(100, "REF-B", st1, b2)));
  test("a verified payment needs the verifier and time", () => rejects(/payment_verified_fields_check/, () =>
    q(`UPDATE payment SET status = 'verified' WHERE id = $1`, [payA])));
  test("E10: a rejected payment frees its bank reference", async () => {
    await q(`UPDATE payment SET status = 'rejected', rejection_reason = 'blurry slip' WHERE id = $1`, [payA]);
    await mkPayment(900, "REF-A");
  });
});

describe("Payments and allocations (E3 to E9)", () => {
  beforeAll(async () => {
    payB = await mkPayment(900, "REF-C");
  });

  test("E3, E4: verifying without allocations fails at commit", () => rejects(/E3\/E4/, () =>
    pg.transaction(async (tx) => {
      await tx.query(verify(payB));
    })));
  test("E4: allocations must sum exactly to the payment amount", () => rejects(/E3\/E4/, () =>
    pg.transaction(async (tx) => {
      await tx.query(verify(payB));
      await tx.query(alloc(payB, inv2, pay2, 800));
    })));
  test("E3: a payment that is not verified cannot hold allocations", () => rejects(/E3: payment/, () =>
    pg.transaction(async (tx) => {
      await tx.query(alloc(payB, inv2, pay2, 900));
    })));
  test("E6: an allocation cannot use another student's invoice", () => rejects(/payment_allocation_invoice_student_fk/, async () => {
    const otherInvoice = await mkInvoice(st2, 900);
    const otherItem = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 900)`, [otherInvoice]);
    await pg.transaction(async (tx) => {
      await tx.query(verify(payB));
      await tx.query(alloc(payB, otherInvoice, otherItem, 900, st1));
    });
  }));
  test("E7: an allocation's item must belong to its invoice", () => rejects(/payment_allocation_item_invoice_fk/, async () => {
    const otherInvoice = await mkInvoice(st1, 300);
    await pg.transaction(async (tx) => {
      await tx.query(verify(payB));
      await tx.query(alloc(payB, otherInvoice, pay2, 900));
    });
  }));
  test("E3: verify and allocate in one transaction", () =>
    pg.transaction(async (tx) => {
      await tx.query(verify(payB));
      await tx.query(alloc(payB, inv2, pay2, 900));
    }));
  test("E7: one payment can cover several invoices of the same student", async () => {
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
  test("E9: voiding reverses the allocations and passes the integrity check", () =>
    pg.transaction(async (tx) => {
      await tx.query(
        `UPDATE payment SET status = 'voided', void_reason = 'duplicate', voided_by = '${u1}', voided_at = now() WHERE id = '${payB}'`,
      );
      await tx.query(`UPDATE payment_allocation SET reversed_at = now() WHERE payment_id = '${payB}'`);
    }));
  test("E9: voiding without reversing the allocations fails", () => rejects(/E3: payment/, async () => {
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
  }));
});

describe("Receipts (E12, E13)", () => {
  beforeAll(async () => {
    verifiedPay = String((await q(`SELECT id FROM payment WHERE status = 'verified' LIMIT 1`))[0]!.id);
    r1 = await mkReceipt("R-1", "code-1");
  });

  test("E12: a payment has only one active receipt", () => rejects(/receipt_one_issued_per_payment_uq/, () => mkReceipt("R-2", "code-2")));
  test("E12: a voided receipt can be replaced", async () => {
    await q(`UPDATE receipt SET status = 'void' WHERE id = $1`, [r1]);
    const r3 = await mkReceipt("R-3", "code-3");
    await q(`UPDATE receipt SET replaced_by_receipt_id = $1 WHERE id = $2`, [r3, r1]);
  });
  test("E13: receipt numbers are unique per branch", () => rejects(/receipt_branch_no_uq/, () => mkReceipt("R-3", "code-4", "void")));
});

describe("Audit log (J4)", () => {
  beforeAll(async () => {
    audit = await id(`INSERT INTO audit_log (actor_user_id, action, entity_type) VALUES ($1, 'payment.verify', 'payment')`, [u1]);
  });

  test("J4: audit log rows cannot be updated", () => rejects(/J4/, () => q(`UPDATE audit_log SET reason = 'edited' WHERE id = $1`, [audit])));
  test("J4: audit log rows cannot be deleted", () => rejects(/J4/, () => q(`DELETE FROM audit_log WHERE id = $1`, [audit])));
  test("J4: the audit log cannot be truncated", () => rejects(/J4/, () => q(`TRUNCATE audit_log`)));
});

describe("Recordings (F1)", () => {
  beforeAll(async () => {
    lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Silva')`);
  });

  test("F1: a recording needs a link", () => rejects(/content_item_kind_fields_check/, () =>
    q(`INSERT INTO content_item (lecturer_id, kind, title) VALUES ($1, 'recording', 'Lesson 1')`, [lec])));
  test("F2: paid content needs a price", () => rejects(/content_item_paid_price_check/, () =>
    q(`INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type) VALUES ($1, 'recording', 'L', 'https://youtu.be/x', 'paid')`, [lec])));
  test("a recording with a link is accepted", () =>
    q(`INSERT INTO content_item (lecturer_id, kind, title, external_url) VALUES ($1, 'recording', 'Lesson 1', 'https://youtu.be/x')`, [lec]));
});

describe("Attendance", () => {
  beforeAll(async () => {
    sess = await id(
      `INSERT INTO class_session (course_id, session_date, starts_at, ends_at) VALUES ($1, '2026-03-02', '16:00', '17:30')`,
      [cls],
    );
  });

  test("attendance is recorded once per student and session", () =>
    q(`INSERT INTO attendance (session_id, student_id, status) VALUES ($1, $2, 'present')`, [sess, st1]));
  test("attendance cannot be recorded twice for one student and session", () => rejects(/attendance_session_student_uq/, () =>
    q(`INSERT INTO attendance (session_id, student_id, status) VALUES ($1, $2, 'late')`, [sess, st1])));
});

describe("Notices", () => {
  beforeAll(async () => {
    noticeId = await id(`INSERT INTO notice (author_id, title, body) VALUES ($1, 'Holiday', 'No class on Monday')`, [u1]);
  });

  test("a notice for everyone has no target id", () => rejects(/notice_target_id_check/, () =>
    q(`INSERT INTO notice_target (notice_id, target_type, target_id) VALUES ($1, 'all', $2)`, [noticeId, st1])));
  test("a notice for a course needs its id", () => rejects(/notice_target_id_check/, () =>
    q(`INSERT INTO notice_target (notice_id, target_type) VALUES ($1, 'course')`, [noticeId])));
});

describe("Shares, primaries and sections (H3)", () => {
  test("H3: a co-teacher share cannot exceed 100", () => rejects(/course_lecturer_share_check/, () =>
    q(`INSERT INTO course_lecturer (course_id, lecturer_id, share_percent) VALUES ($1, $2, 120)`, [cls, lec])));
  test("a course can have one primary lecturer", () =>
    q(`INSERT INTO course_lecturer (course_id, lecturer_id, is_primary, share_percent) VALUES ($1, $2, true, 60)`, [cls, lec]));
  test("a course cannot have two primary lecturers", () => rejects(/course_lecturer_one_primary_uq/, async () => {
    const lec2 = await id(`INSERT INTO lecturer (full_name) VALUES ('Ms Fernando')`);
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id, is_primary, share_percent) VALUES ($1, $2, true, 40)`, [cls, lec2]);
  }));
  test("a role can be assigned for all branches once", () =>
    q(`INSERT INTO staff_role_assignment (user_id, role_id) VALUES ($1, (SELECT id FROM role WHERE name = 'root_admin'))`, [u1]));
  test("the same all-branch role cannot be assigned twice", () => rejects(/staff_role_all_branches_uq/, () =>
    q(`INSERT INTO staff_role_assignment (user_id, role_id) VALUES ($1, (SELECT id FROM role WHERE name = 'root_admin'))`, [u1])));
  test("a student can have one primary branch", () =>
    q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1, $2, true)`, [st1, b1]));
  test("a student cannot have two primary branches", () => rejects(/student_branch_one_primary_uq/, () =>
    q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1, $2, true)`, [st1, b2])));
});

describe("Content sections", () => {
  beforeAll(async () => {
    secA = await id(`INSERT INTO course_section (course_id, title) VALUES ($1, 'Unit 1')`, [cls]);
    secOther = await id(`INSERT INTO course_section (course_id, title) VALUES ($1, 'Other unit')`, [sched]);
    recId = String((await q(`SELECT id FROM content_item LIMIT 1`))[0]!.id);
  });

  test("content can be placed in a section of the same course", () =>
    q(`INSERT INTO course_content (course_id, section_id, content_id) VALUES ($1, $2, $3)`, [cls, secA, recId]));
  test("content cannot use a section of another course", () => rejects(/course_content_section_course_fk/, () =>
    q(`INSERT INTO course_content (course_id, section_id, content_id) VALUES ($1, $2, $3)`, [sched, secA, recId])));
});

describe("Promotion items and null-safe checks", () => {
  beforeAll(async () => {
    run = await id(`INSERT INTO promotion_run (performed_by, effective_date) VALUES ($1, '2027-01-01')`, [u1]);
  });

  test("a promotion item per class enrolment", () =>
    q(`INSERT INTO promotion_item (promotion_run_id, student_id, from_enrollment_id) VALUES ($1, $2, $3)`, [run, st1, enr]));
  test("a promotion run has one item per enrolment", () => rejects(/promotion_item_run_enrollment_uq/, () =>
    q(`INSERT INTO promotion_item (promotion_run_id, student_id, from_enrollment_id) VALUES ($1, $2, $3)`, [run, st1, enr])));
  test("a confirmed promotion run needs its confirmation time", () => rejects(/promotion_run_confirmed_check/, () =>
    q(`UPDATE promotion_run SET status = 'confirmed' WHERE id = $1`, [run])));
  test("a recurring fee structure with no frequency is rejected (NULL-safe)", () => rejects(/fee_structure_frequency_check/, () =>
    q(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'y', 'recurring', NULL)`, [b1, cls])));
});

describe("Installment options", () => {
  beforeAll(async () => {
    optA = await id(
      `INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, '3 installments', 3, 30)`,
      [feeOther],
    );
  });

  test("installment option needs at least 2 installments", () => rejects(/installment_option_count_check/, () =>
    q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, 'one', 1, 30)`, [feeOther])));
  test("installment down payment must be under 100 percent", () => rejects(/installment_option_down_payment_check/, () =>
    q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, down_payment_percent, interval_days) VALUES ($1, 'full', 2, 100, 30)`, [feeOther])));
  test("installment interval must be positive", () => rejects(/installment_option_interval_check/, () =>
    q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, 'zero', 2, 0)`, [feeOther])));
  test("installment option names are unique per fee structure", () => rejects(/installment_option_structure_name_uq/, () =>
    q(`INSERT INTO installment_option (fee_structure_id, name, installment_count, interval_days) VALUES ($1, '3 installments', 4, 30)`, [feeOther])));
});

describe("Installments (D10)", () => {
  beforeAll(async () => {
    invInst = await id(
      `INSERT INTO invoice (student_id, branch_id, installment_option_id, due_date, subtotal, total) VALUES ($1, $2, $3, CURRENT_DATE + 7, 3000, 3000)`,
      [st1, b1, optA],
    );
  });

  test("D10: installments with sequence numbers", async () => {
    await q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, 1, CURRENT_DATE + 7, 1000), ($1, 2, CURRENT_DATE + 37, 1000), ($1, 3, CURRENT_DATE + 67, 1000)`, [invInst]);
  });
  test("D10: installment sequence is unique per invoice", () => rejects(/invoice_installment_seq_uq/, () =>
    q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, 2, CURRENT_DATE + 90, 10)`, [invInst])));
  test("installment amount must be positive", () => rejects(/invoice_installment_amount_check/, () =>
    q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount) VALUES ($1, 9, CURRENT_DATE, 0)`, [invInst])));
  test("installment paid amount cannot exceed its amount", () => rejects(/invoice_installment_paid_check/, () =>
    q(`UPDATE invoice_installment SET amount_paid = 1500 WHERE invoice_id = $1 AND seq = 1`, [invInst])));
  test("installment status must be a known value", () => rejects(/invoice_installment_status_check/, () =>
    q(`UPDATE invoice_installment SET status = 'late' WHERE invoice_id = $1 AND seq = 1`, [invInst])));
});

describe("Fee exceptions (D16 to D21)", () => {
  beforeAll(async () => {
    feeAlt = await id(
      `INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1, $2, 'Quarterly', 'recurring', 'monthly')`,
      [b1, cls],
    );
    enrFresh = await id(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, st2]);
    exc1 = await mkExc("discount", "2027-02-01", "2027-06-01", null, "percent", 50);
  });

  test("D16: an alternate option of the same class", () => mkExc("alternate_option", "2027-02-01", null, feeAlt, null, null));
  test("D20: an alternate option cannot come from another class", () => rejects(/fee_exception_alternate_course_fk/, () =>
    mkExc("alternate_option", "2028-01-01", null, feeOther, null, null, "Hardship", cls, enrFresh)));
  test("D16: a discount cannot name an alternate option", () => rejects(/fee_exception_kind_columns_check/, () =>
    mkExc("discount", "2028-01-01", null, feeAlt, "percent", 10)));
  test("D16: an alternate option cannot carry a discount", () => rejects(/fee_exception_kind_columns_check/, () =>
    mkExc("alternate_option", "2028-01-01", null, feeAlt, "percent", 10)));
  test("D16: a discount needs a type and a value (NULL-safe)", () => rejects(/fee_exception_kind_columns_check/, () =>
    mkExc("discount", "2028-01-01", null, null, null, null)));
  test("D19: a percent discount is at most 100", () => rejects(/fee_exception_discount_value_check/, () =>
    mkExc("discount", "2028-01-01", null, null, "percent", 150)));
  test("D19: a fixed discount cannot be negative", () => rejects(/fee_exception_discount_value_check/, () =>
    mkExc("discount", "2028-01-01", null, null, "fixed", -5)));
  test("D19: a 100 percent discount (free place) is allowed", () => mkExc("discount", "2027-06-01", "2027-07-01", null, "percent", 100));
  test("D17: an exception needs a reason", () => rejects(/fee_exception_reason_check/, () =>
    mkExc("discount", "2028-01-01", null, null, "fixed", 100, "   ")));
  test("D17: an exception ends after it starts", () => rejects(/fee_exception_dates_check/, () =>
    mkExc("discount", "2028-01-01", "2028-01-01", null, "fixed", 100)));
  test("D18: two discounts cannot overlap on one enrolment", () => rejects(/fee_exception_no_overlap/, () =>
    mkExc("discount", "2027-05-01", "2027-08-01", null, "fixed", 100)));
  test("D18: an open-ended exception overlaps a later one", () => rejects(/fee_exception_no_overlap/, () =>
    mkExc("alternate_option", "2030-01-01", null, feeAlt, null, null)));
  test("D18: ranges are end-exclusive, so back to back is allowed", () =>
    mkExc("discount", "2027-07-01", null, null, "fixed", 200));
  test("D21: ended_by without effective_to is rejected", () => rejects(/fee_exception_ended_check/, () =>
    q(`INSERT INTO fee_exception (enrollment_id, course_id, kind, discount_type, discount_value, effective_from, reason, created_by, ended_by) VALUES ($1, $2, 'discount', 'fixed', 5, '2040-01-01', 'x', $3, $3)`, [enr, cls, u1])));
  test("an exception's course must be its enrolment's course", () => rejects(/fee_exception_enrollment_course_fk/, () =>
    mkExc("discount", "2035-01-01", null, null, "fixed", 1, "x", sched, enrFresh)));
  test("D19: a discount item can link to its exception", () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id, fee_exception_id, enrollment_id) VALUES ($1, 'discount', -500, $2, $3, $4)`, [inv1, item1, exc1, enr]));
  test("D19: an item with a fee exception needs an enrolment", () => rejects(/invoice_item_exception_enrollment_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id, fee_exception_id) VALUES ($1, 'discount', -10, $2, $3)`, [inv1, item1, exc1])));
  test("D19: a discount's exception must belong to the item's enrolment", () => rejects(/invoice_item_exception_enrollment_fk/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id, fee_exception_id, enrollment_id) VALUES ($1, 'discount', -10, $2, $3, $4)`, [inv1, item1, exc1, enrFresh])));
  test("D19: a discount cannot reduce an item of another enrolment", () => rejects(/D19: a discount must carry the same enrolment/, async () => {
    const other = await id(`INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id) VALUES ($1, 'adjustment', 300, $2)`, [inv1, enrFresh]);
    await q(`INSERT INTO invoice_item (invoice_id, kind, amount, applies_to_item_id, fee_exception_id, enrollment_id) VALUES ($1, 'discount', -10, $2, $3, $4)`, [inv1, other, exc1, enr]);
  }));
  test("only discount items can carry a fee exception", () => rejects(/invoice_item_exception_kind_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, enrollment_id) VALUES ($1, 'adjustment', 10, $2, $3)`, [inv1, exc1, enr])));
});

describe("Notifications and push (J2)", () => {
  beforeAll(async () => {
    u2 = await id(`INSERT INTO "user" (email) VALUES ('parent@example.com')`);
  });

  test("J2: a notification is created", () =>
    q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'in_app', 'installment_due', 'inst-1')`, [u2]));
  test("J2: the same user, event key and channel cannot repeat", () => rejects(/notification_dedupe_uq/, () =>
    q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'in_app', 'installment_due', 'inst-1')`, [u2])));
  test("J2: another channel for the same event key is allowed", () =>
    q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'sms', 'installment_due', 'inst-1')`, [u2]));
  test("a sent notification needs sent_at", () => rejects(/notification_sent_check/, () =>
    q(`INSERT INTO notification (user_id, channel, event, event_key, status) VALUES ($1, 'email', 'notice', 'n-1', 'sent')`, [u2])));
  test("a failed notification needs an error (NULL-safe)", () => rejects(/notification_failed_check/, () =>
    q(`INSERT INTO notification (user_id, channel, event, event_key, status) VALUES ($1, 'email', 'notice', 'n-2', 'failed')`, [u2])));
  test("a notification channel must be known", () => rejects(/notification_channel_value_check/, () =>
    q(`INSERT INTO notification (user_id, channel, event, event_key) VALUES ($1, 'fax', 'notice', 'n-3')`, [u2])));
  test("a notification channel can be switched on", () =>
    q(`UPDATE notification_channel SET is_enabled = true WHERE channel = 'sms'`));
  test("one row per notification channel", () => rejects(/notification_channel_uq/, () =>
    q(`INSERT INTO notification_channel (organization_id, channel) VALUES ((SELECT id FROM organization), 'sms')`)));
  test("a notification template", () =>
    q(`INSERT INTO notification_template (organization_id, event, channel, body) VALUES ((SELECT id FROM organization), 'payment_verified', 'sms', 'Payment received')`));
  test("one template per event and channel", () => rejects(/notification_template_uq/, () =>
    q(`INSERT INTO notification_template (organization_id, event, channel, body) VALUES ((SELECT id FROM organization), 'payment_verified', 'sms', 'Again')`)));
  test("a push subscription", () =>
    q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1, 'https://push.example/1', 'k', 'a')`, [u2]));
  test("a push endpoint is unique", () => rejects(/push_subscription_endpoint_unique/, () =>
    q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1, 'https://push.example/1', 'k', 'a')`, [u1])));
});

describe("Messaging: posting", () => {
  beforeAll(async () => {
    thread = await id(`INSERT INTO message_thread (subject, created_by) VALUES ('Fees question', $1)`, [u2]);
    await q(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2), ($1, $3)`, [thread, u1, u2]);
  });

  test("a participant can post a message", () =>
    q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'Hello')`, [thread, u2]));
});

describe("Messaging: participants", () => {
  beforeAll(async () => {
    u3 = await id(`INSERT INTO "user" (email) VALUES ('outsider@example.com')`);
  });

  test("a non-participant cannot post", () => rejects(/message_sender_participant_fk/, () =>
    q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'Hi')`, [thread, u3])));
  test("a message cannot be blank", () => rejects(/message_body_check/, () =>
    q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, '  ')`, [thread, u2])));
  test("a user joins a thread only once", () => rejects(/thread_participant_pk/, () =>
    q(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2)`, [thread, u2])));
});

describe("Messaging: deletion", () => {
  test("deleting a thread deletes its participants and messages", async () => {
    const t = await id(`INSERT INTO message_thread (subject, created_by) VALUES ('Short-lived', $1)`, [u2]);
    await q(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2), ($1, $3)`, [t, u1, u2]);
    await q(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'Hello')`, [t, u2]);
    await q(`DELETE FROM message_thread WHERE id = $1`, [t]);
    eq((await q(`SELECT 1 FROM message WHERE thread_id = $1`, [t])).length, 0, "messages left");
    eq((await q(`SELECT 1 FROM thread_participant WHERE thread_id = $1`, [t])).length, 0, "participants left");
  });
  test("a participant who has posted cannot be removed on their own", () => rejects(/message_sender_participant_fk/, () =>
    q(`DELETE FROM thread_participant WHERE thread_id = $1 AND user_id = $2`, [thread, u2])));
});

describe("Exam questions", () => {
  beforeAll(async () => {
    qA = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'What is H2O?')`, [lec]);
    qB = await id(`INSERT INTO question (lecturer_id, body, default_marks) VALUES ($1, 'Boiling point of water?', 2)`, [lec]);
  });

  test("a question body cannot be blank", () => rejects(/question_body_check/, () =>
    q(`INSERT INTO question (lecturer_id, body) VALUES ($1, '  ')`, [lec])));
  test("question marks must be positive", () => rejects(/question_marks_check/, () =>
    q(`INSERT INTO question (lecturer_id, body, default_marks) VALUES ($1, 'x', 0)`, [lec])));
  test("question options", () =>
    q(`INSERT INTO question_option (question_id, body, is_correct, position) VALUES ($1, 'Water', true, 1), ($1, 'Salt', false, 2)`, [qA]));
  test("option positions are unique per question", () => rejects(/question_option_position_uq/, () =>
    q(`INSERT INTO question_option (question_id, body, position) VALUES ($1, 'Dup', 1)`, [qA])));
});

describe("Exam windows and attempt limits", () => {
  beforeAll(async () => {
    examA = await mkOnline();
  });

  test("an online exam needs a window and attempt limit", () => rejects(/exam_mode_fields_check/, () =>
    q(`INSERT INTO exam (lecturer_id, title, mode) VALUES ($1, 'No window', 'online_mcq')`, [lec])));
  test("a paper exam cannot carry online settings", () => rejects(/exam_mode_fields_check/, () =>
    q(`INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks, max_attempts) VALUES ($1, 'Paper', 'paper', '2027-03-01', 100, 3)`, [lec])));
  test("a paper exam needs a date and total marks (NULL-safe)", () => rejects(/exam_mode_fields_check/, () =>
    q(`INSERT INTO exam (lecturer_id, title, mode) VALUES ($1, 'Paper', 'paper')`, [lec])));
  test("an exam closes after it opens", () => rejects(/exam_window_check/, () =>
    q(`INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts) VALUES ($1, 'Bad', 'online_mcq', now(), now() - interval '1 day', 1)`, [lec])));
  test("an exam allows at least one attempt", () => rejects(/exam_attempts_check/, () =>
    q(`INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts) VALUES ($1, 'Bad', 'online_mcq', now(), now() + interval '1 day', 0)`, [lec])));
});

describe("Publishing needs questions (G4)", () => {
  beforeAll(async () => {
    paperExam = await id(
      `INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks) VALUES ($1, 'Term test', 'paper', '2027-03-01', 100)`,
      [lec],
    );
    await q(`INSERT INTO exam_course (exam_id, course_id) VALUES ($1, $2), ($3, $2)`, [examA, cls, paperExam]);
  });

  test("G4: an online exam cannot publish with no questions", () => rejects(/needs at least one question/, async () => {
    const empty = await mkOnline("Empty");
    await q(`UPDATE exam SET status = 'published' WHERE id = $1`, [empty]);
  }));
});

describe("Question snapshots (G4)", () => {
  beforeAll(async () => {
    eqA = await id(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 1)`, [examA, qA]);
  });

  test("a second question in the exam", () =>
    q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 2, 2)`, [examA, qB]));
  test("exam question positions are unique", () => rejects(/exam_question_position_uq/, () =>
    q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 2)`, [examA, qA])));
  test("a question is used once per exam", () => rejects(/exam_question_question_uq/, () =>
    q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 3)`, [examA, qA])));
  test("G4: publishing needs every snapshot", () => rejects(/needs its snapshot/, () =>
    q(`UPDATE exam SET status = 'published' WHERE id = $1`, [examA])));
});

describe("Publishing and published exams (G4)", () => {
  beforeAll(async () => {
    await q(`UPDATE exam_question SET snapshot = '{"body":"What is H2O?","options":[{"key":"o1","body":"Water","correct":true}]}'::jsonb WHERE exam_id = $1`, [examA]);
  });

  test("G4: publish once every question has its snapshot", () =>
    q(`UPDATE exam SET status = 'published' WHERE id = $1`, [examA]));
  test("G4: a published exam cannot gain a question", () => rejects(/exam_question_frozen/, async () => {
    const q3 = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'Late question')`, [lec]);
    await q(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 9)`, [examA, q3]);
  }));
  test("G4: a published exam's question cannot change", () => rejects(/exam_question_frozen/, () =>
    q(`UPDATE exam_question SET marks = 5 WHERE id = $1`, [eqA])));
  test("G4: a published exam's question cannot be removed", () => rejects(/exam_question_frozen/, () =>
    q(`DELETE FROM exam_question WHERE id = $1`, [eqA])));
  test("an exam cannot go back to draft", () => rejects(/cannot move an exam from published to draft/, () =>
    q(`UPDATE exam SET status = 'draft' WHERE id = $1`, [examA])));
  test("a draft exam cannot jump to closed", () => rejects(/cannot move an exam from draft to closed/, async () => {
    const d = await mkOnline("Draft only");
    await q(`UPDATE exam SET status = 'closed' WHERE id = $1`, [d]);
  }));
  test("the mode of a published exam cannot change", () => rejects(/mode of a published exam/, () =>
    q(`UPDATE exam SET mode = 'paper' WHERE id = $1`, [examA])));
});

describe("Exam guard hardening (0016)", () => {
  test("G4: a question cannot move out of a published exam into a draft", () => rejects(/exam_question_frozen/, async () => {
    const draft = await mkOnline("Move target");
    await q(`UPDATE exam_question SET exam_id = $1 WHERE id = $2`, [draft, eqA]);
  }));
  test("G4: a question cannot move into a published exam", () => rejects(/exam_question_frozen/, async () => {
    const draft = await mkOnline("Move source");
    const qx = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'Mover')`, [lec]);
    const eqx = await id(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 1)`, [draft, qx]);
    await q(`UPDATE exam_question SET exam_id = $1 WHERE id = $2`, [examA, eqx]);
  }));
  test("G4: an exam cannot be inserted as published", () => rejects(/a new exam must start as a draft/, () =>
    q(`INSERT INTO exam (lecturer_id, title, mode, opens_at, closes_at, max_attempts, status) VALUES ($1, 'Born published', 'online_mcq', now(), now() + interval '1 day', 1, 'published')`, [lec])));
  test("G7: the mode cannot change while the exam has results", () => rejects(/mode of an exam with results cannot change/, async () => {
    const p = await id(`INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks) VALUES ($1, 'Paper with result', 'paper', '2027-04-01', 100)`, [lec]);
    await q(`INSERT INTO exam_result (exam_id, student_id, marks, source) VALUES ($1, $2, 50, 'manual')`, [p, st1]);
    await q(`UPDATE exam SET mode = 'online_mcq', opens_at = now(), closes_at = now() + interval '1 day', max_attempts = 1, exam_date = NULL, max_marks = NULL WHERE id = $1`, [p]);
  }));
});

describe("Attempts and answers (G2)", () => {
  beforeAll(async () => {
    attempt1 = await id(
      `INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 1)`,
      [examA, st1, enr, cls],
    );
  });

  test("G2: one running attempt per student and exam", () => rejects(/exam_attempt_one_running_uq/, () =>
    q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 2)`, [examA, st1, enr, cls])));
  test("G2: attempt numbers are unique per exam and student", () => rejects(/exam_attempt_no_uq/, () =>
    q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no, status, submitted_at) VALUES ($1, $2, $3, $4, 1, 'expired', now())`, [examA, st1, enr, cls])));
  test("G3: the enrolment must belong to the student", () => rejects(/exam_attempt_enrollment_fk/, async () => {
    const attached = await mkOnline("Attached");
    await q(`INSERT INTO exam_course (exam_id, course_id) VALUES ($1, $2)`, [attached, cls]);
    await q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 1)`, [attached, st1, enrFresh, cls]);
  }));
  test("G3: the exam must be attached to the enrolment's course", () => rejects(/exam_attempt_exam_course_fk/, async () => {
    const unattached = await mkOnline("Unattached");
    await q(`INSERT INTO exam_attempt (exam_id, student_id, enrollment_id, course_id, attempt_no) VALUES ($1, $2, $3, $4, 1)`, [unattached, st1, enr, cls]);
  }));
  test("a submitted attempt needs its submission time", () => rejects(/exam_attempt_submitted_check/, () =>
    q(`UPDATE exam_attempt SET status = 'submitted' WHERE id = $1`, [attempt1])));
  test("a graded attempt needs a score", () => rejects(/exam_attempt_graded_check|exam_attempt_submitted_check/, () =>
    q(`UPDATE exam_attempt SET status = 'graded', submitted_at = now() WHERE id = $1`, [attempt1])));
  test("an answer stores the selected option key", () =>
    q(`INSERT INTO attempt_answer (attempt_id, exam_id, exam_question_id, selected_option_key, is_correct, marks_awarded) VALUES ($1, $2, $3, 'o1', true, 1)`, [attempt1, examA, eqA]));
  test("one answer per question in an attempt", () => rejects(/attempt_answer_uq/, () =>
    q(`INSERT INTO attempt_answer (attempt_id, exam_id, exam_question_id) VALUES ($1, $2, $3)`, [attempt1, examA, eqA])));
  test("an answer's question must belong to the attempt's exam", () => rejects(/attempt_answer_question_exam_fk/, async () => {
    const other = await mkOnline("Other exam");
    const q4 = await id(`INSERT INTO question (lecturer_id, body) VALUES ($1, 'Other')`, [lec]);
    const eqOther = await id(`INSERT INTO exam_question (exam_id, question_id, marks, position) VALUES ($1, $2, 1, 1)`, [other, q4]);
    await q(`INSERT INTO attempt_answer (attempt_id, exam_id, exam_question_id) VALUES ($1, $2, $3)`, [attempt1, examA, eqOther]);
  }));
});

describe("Manual and attempt results (G7)", () => {
  beforeAll(async () => {
    await q(`UPDATE exam_attempt SET status = 'graded', submitted_at = now(), score = 3 WHERE id = $1`, [attempt1]);
  });

  test("G7: an online exam result cannot be entered manually", () => rejects(/comes from an attempt/, () =>
    q(`INSERT INTO exam_result (exam_id, student_id, marks, source) VALUES ($1, $2, 3, 'manual')`, [examA, st1])));
  test("G7: an attempt result needs its attempt (NULL-safe)", () => rejects(/exam_result_source_attempt_check/, () =>
    q(`INSERT INTO exam_result (exam_id, student_id, marks, source) VALUES ($1, $2, 3, 'attempt')`, [examA, st1])));
  test("an attempt result must use that student's attempt", () => rejects(/exam_result_attempt_fk/, () =>
    q(`INSERT INTO exam_result (exam_id, student_id, attempt_id, marks, source) VALUES ($1, $2, $3, 3, 'attempt')`, [examA, st2, attempt1])));
});

describe("Results and release (G7, G8)", () => {
  beforeAll(async () => {
    resA = await id(
      `INSERT INTO exam_result (exam_id, student_id, enrollment_id, course_id, attempt_id, marks, source) VALUES ($1, $2, $3, $4, $5, 3, 'attempt')`,
      [examA, st1, enr, cls, attempt1],
    );
  });

  test("G7: one result per exam and student", () => rejects(/exam_result_uq/, () =>
    q(`INSERT INTO exam_result (exam_id, student_id, attempt_id, marks, source) VALUES ($1, $2, $3, 3, 'attempt')`, [examA, st1, attempt1])));
  test("a result's enrolment needs its course (pair)", () => rejects(/exam_result_enrollment_pair_check/, () =>
    q(`INSERT INTO exam_result (exam_id, student_id, enrollment_id, marks, source) VALUES ($1, $2, $3, 50, 'manual')`, [paperExam, st1, enr])));
  test("G7: a paper exam result cannot come from an attempt", () => rejects(/paper exam result is entered manually/, () =>
    q(`INSERT INTO exam_result (exam_id, student_id, attempt_id, marks, source) VALUES ($1, $2, $3, 50, 'attempt')`, [paperExam, st1, attempt1])));
  test("G7: a paper result is entered manually", () =>
    q(`INSERT INTO exam_result (exam_id, student_id, enrollment_id, course_id, marks, grade, source) VALUES ($1, $2, $3, $4, 78, 'B', 'manual')`, [paperExam, st1, enr, cls]));
  test("G8: a result cannot be released before the exam closes", () => rejects(/released only after the exam is closed/, () =>
    q(`UPDATE exam_result SET released_at = now() WHERE id = $1`, [resA])));
});

describe("Released results (G8)", () => {
  beforeAll(async () => {
    await q(`UPDATE exam SET status = 'closed' WHERE id = $1`, [examA]);
  });

  test("G8: a result can be released once the exam is closed", () =>
    q(`UPDATE exam_result SET released_at = now() WHERE id = $1`, [resA]));
  test("G8: a released online result can become a manual override", () =>
    q(`UPDATE exam_result SET source = 'manual_override', marks = 4 WHERE id = $1`, [resA]));
});

describe("Content purchases (F5, F6)", () => {
  beforeAll(async () => {
    cPaid = await id(
      `INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type, price) VALUES ($1, 'recording', 'Paid lesson', 'https://youtu.be/p', 'paid', 500)`,
      [lec],
    );
    cPaid2 = await id(
      `INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type, price) VALUES ($1, 'recording', 'Paid lesson 2', 'https://youtu.be/p2', 'paid', 700)`,
      [lec],
    );
    cBook = await id(
      `INSERT INTO content_item (lecturer_id, kind, title, access_type, price) VALUES ($1, 'physical_book', 'Science workbook', 'paid', 1500)`,
      [lec],
    );
    cFree = await id(`INSERT INTO content_item (lecturer_id, kind, title, external_url, access_type) VALUES ($1, 'recording', 'Free lesson', 'https://youtu.be/f', 'free_registered')`, [lec]);
    await q(`INSERT INTO content_branch (content_id, branch_id) VALUES ($1, $5), ($2, $5), ($2, $6), ($3, $5), ($4, $5)`, [cPaid, cPaid2, cBook, cFree, b1, b2]);
    invC = await mkInvoice(st1, 500);
    purch = await id(
      `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 500)`,
      [cPaid, st1, invC, b1],
    );
  });

  test("F5: no second pending purchase of the same item", () => rejects(/content_purchase_active_uq/, () =>
    q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 500)`, [cPaid, st1, b1])));
  test("a purchase cannot be redirected to a free item", () => rejects(/only a paid content item/, () =>
    q(`UPDATE content_purchase SET content_id = $1 WHERE id = $2`, [cFree, purch])));
  test("a paid purchase needs an invoice", () => rejects(/content_purchase_paid_invoice_check/, () =>
    q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price, status) VALUES ($1, $2, $3, 'online', 500, 'paid')`, [cPaid2, st2, b1])));
  test("only a paid content item can be purchased", () => rejects(/only a paid content item/, () =>
    q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 100)`, [cFree, st2, b1])));
  test("D13: the branch must be one the item is listed in", () => rejects(/content_purchase_listed_branch_fk/, () =>
    q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 500)`, [cPaid, st2, b2])));
  test("a purchase's invoice must belong to the same student", () => rejects(/content_purchase_invoice_student_fk/, () =>
    q(`INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 700)`, [cPaid2, st2, invC, b1])));
  test("D24: a purchase's invoice must be in the purchase's branch", () => rejects(/content_purchase_invoice_branch_fk/, async () => {
    const invB2 = await mkInvoice(st1, 700, b2);
    await q(`INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 700)`, [cPaid2, st1, invB2, b1]);
  }));
  test("a purchase price must be positive", () => rejects(/content_purchase_price_check/, () =>
    q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 0)`, [cPaid2, st2, b1])));
  test("an invoice line charges the purchase", () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'content', 500, $2)`, [invC, purch]));
  test("a content line needs its purchase (NULL-safe)", () => rejects(/invoice_item_content_fields_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'content', 500)`, [invC])));
  test("only content lines carry a purchase", () => rejects(/invoice_item_content_fields_check/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'adjustment', 5, $2)`, [invC, purch])));
  test("a purchase has one active content line", () => rejects(/invoice_item_content_purchase_uq/, () =>
    q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'content', 500, $2)`, [invC, purch])));
  test("a content line must use the purchase's own invoice", () => rejects(/invoice_item_purchase_invoice_fk/, async () => {
    const invOwn = await mkInvoice(st1, 700);
    const purch2 = await id(
      `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'online', 700)`,
      [cPaid2, st1, invOwn, b1],
    );
    const other = await mkInvoice(st1, 700);
    await q(`INSERT INTO invoice_item (invoice_id, kind, amount, content_purchase_id) VALUES ($1, 'content', 700, $2)`, [other, purch2]);
  }));
  test("F6: a pending purchase cannot be handed over", () => rejects(/content_purchase_handover_check/, () =>
    q(`UPDATE content_purchase SET handed_over_at = now(), handed_over_by = $2 WHERE id = $1`, [purch, u1])));
});

describe("Purchase handover (F6)", () => {
  beforeAll(async () => {
    invBook = await mkInvoice(st1, 1500);
    bookPurchase = await id(
      `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price) VALUES ($1, $2, $3, $4, 'physical', 1500)`,
      [cBook, st1, invBook, b1],
    );
    await q(`UPDATE content_purchase SET status = 'paid' WHERE id = $1`, [bookPurchase]);
  });

  test("F6: handover records who handed it over", () => rejects(/content_purchase_handover_check/, () =>
    q(`UPDATE content_purchase SET handed_over_at = now() WHERE id = $1`, [bookPurchase])));
  test("F6: a paid physical purchase can be handed over", () =>
    q(`UPDATE content_purchase SET handed_over_at = now(), handed_over_by = $2 WHERE id = $1`, [bookPurchase, u1]));
  test("F6: an online purchase has no handover", () => rejects(/content_purchase_handover_check/, async () => {
    await q(`UPDATE content_purchase SET status = 'paid' WHERE id = $1`, [purch]);
    await q(`UPDATE content_purchase SET handed_over_at = now(), handed_over_by = $2 WHERE id = $1`, [purch, u1]);
  }));
});

describe("Cancelled purchases (F5)", () => {
  beforeAll(async () => {
    await q(`UPDATE content_purchase SET status = 'cancelled' WHERE id = $1`, [purch]);
  });

  test("F5: a cancelled purchase can be bought again", () =>
    q(`INSERT INTO content_purchase (content_id, student_id, branch_id, channel, price) VALUES ($1, $2, $3, 'online', 500)`, [cPaid, st1, b1]));
});

describe("Commission rules (H4)", () => {
  beforeAll(async () => {
    lec3 = await id(`INSERT INTO lecturer (full_name) VALUES ('Ms Perera')`);
    ruleDefault = await id(
      `INSERT INTO commission_rule (lecturer_id, calc_type, commission_rate, effective_from) VALUES ($1, 'percent', 20, '2027-01-01')`,
      [lec],
    );
  });

  test("H4: overlapping rules of the same scope are rejected", () => rejects(/commission_rule_no_overlap/, () =>
    q(`INSERT INTO commission_rule (lecturer_id, calc_type, commission_rate, effective_from) VALUES ($1, 'percent', 25, '2028-01-01')`, [lec])));
  test("H4: a rule for a different scope can overlap in dates", () =>
    q(`INSERT INTO commission_rule (lecturer_id, course_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'fixed_per_student_month', 150, '2027-01-01')`, [lec, cls]));
  test("H4: another lecturer's default rule is independent", () =>
    q(`INSERT INTO commission_rule (lecturer_id, calc_type, commission_rate, effective_from) VALUES ($1, 'percent', 10, '2027-01-01')`, [lec3]));
  test("H12: a percent rate is at most 100", () => rejects(/commission_rule_rate_check/, () =>
    q(`INSERT INTO commission_rule (lecturer_id, subject_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'percent', 150, '2027-01-01')`, [lec, subj])));
  test("H12: a rate cannot be negative", () => rejects(/commission_rule_rate_check/, () =>
    q(`INSERT INTO commission_rule (lecturer_id, subject_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'fixed_per_student_month', -1, '2027-01-01')`, [lec, subj])));
  test("H4: a grade needs a subject", () => rejects(/commission_rule_scope_check/, () =>
    q(`INSERT INTO commission_rule (lecturer_id, grade_level_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, 'percent', 10, '2027-01-01')`, [lec, g6])));
  test("H4: a course rule is a course alone", () => rejects(/commission_rule_scope_check/, () =>
    q(`INSERT INTO commission_rule (lecturer_id, course_id, subject_id, calc_type, commission_rate, effective_from) VALUES ($1, $2, $3, 'percent', 10, '2027-01-01')`, [lec, cls, subj])));
  test("a rule ends after it starts", () => rejects(/commission_rule_dates_check/, () =>
    q(`INSERT INTO commission_rule (lecturer_id, subject_id, calc_type, commission_rate, effective_from, effective_to) VALUES ($1, $2, 'percent', 10, '2027-01-01', '2027-01-01')`, [lec, subj])));
});

describe("Commission entries (H2 to H12)", () => {
  beforeAll(async () => {
    invFee = await mkInvoice(st1, 1000);
    itemFee = await id(
      `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id, period_start, period_end) VALUES ($1, 'recurring_fee', 1000, $2, $3, '2027-05-01', '2027-06-01')`,
      [invFee, enr, fee1],
    );
    payFee = await mkPayment(1000, "REF-FEE");
    await pg.transaction(async (tx) => {
      await tx.query(verify(payFee));
      await tx.query(alloc(payFee, invFee, itemFee, 1000));
    });
    feeAlloc = String((await q(`SELECT id FROM payment_allocation WHERE payment_id = $1`, [payFee]))[0]!.id);
    invAdj = await mkInvoice(st1, 300);
    itemAdj = await id(`INSERT INTO invoice_item (invoice_id, kind, amount) VALUES ($1, 'adjustment', 300)`, [invAdj]);
    payAdj = await mkPayment(300, "REF-ADJ");
    await pg.transaction(async (tx) => {
      await tx.query(verify(payAdj));
      await tx.query(alloc(payAdj, invAdj, itemAdj, 300));
    });
    adjAlloc = String((await q(`SELECT id FROM payment_allocation WHERE payment_id = $1`, [payAdj]))[0]!.id);
    lecB = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Fernando')`);
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id, share_percent) VALUES ($1, $2, 40)`, [cls, lecB]);
    entry1 = await mkEntry();
  });

  test("H2: one accrual per allocation and lecturer", () => rejects(/commission_entry_accrual_uq/, () => mkEntry()));
  test("H1: teacher amount is base minus commission", () => rejects(/commission_entry_split_check/, () => mkEntry({ lecturer: lecB, rule: ruleDefault, teacher: 70 })));
  test("H12: an accrual's commission cannot exceed its base", () => rejects(/commission_entry_type_amounts_check/, () =>
    mkEntry({ comm: 120, teacher: -20 })));
  test("H12: an accrual cannot be negative", () => rejects(/commission_entry_type_amounts_check/, () =>
    mkEntry({ base: -100, comm: -20, teacher: -80 })));
  test("share applied is 0 to 100", () => rejects(/commission_entry_share_check/, () => mkEntry({ share: 120 })));
  test("the entry's rule must belong to its lecturer", () => rejects(/commission_entry_rule_lecturer_fk/, () =>
    mkEntry({ lecturer: lecB, rule: ruleDefault })));
  test("H11: the lecturer must teach the fee item's course", () => rejects(/does not teach the course/, async () => {
    const ruleLec3 = String((await q(`SELECT id FROM commission_rule WHERE lecturer_id = $1`, [lec3]))[0]!.id);
    await mkEntry({ lecturer: lec3, rule: ruleLec3 });
  }));
  test("H11: only fee items accrue commission", () => rejects(/only fee items accrue commission/, () => mkEntry({ alloc: adjAlloc, lecturer: lec, rule: ruleDefault })));
  test("a settled entry needs a payout", () => rejects(/commission_entry_payout_check/, () =>
    q(`UPDATE commission_entry SET status = 'settled' WHERE id = $1`, [entry1])));
  test("H7: a reversal must reverse something", () => rejects(/must reverse an accrual|commission_entry_type_amounts_check/, () =>
    mkEntry({ type: "reversal", base: -100, comm: -20, teacher: -80 })));
  test("H12: a reversal must be the exact negative", () => rejects(/exact negative/, () =>
    mkEntry({ type: "reversal", reverses: entry1, base: -100, comm: -10, teacher: -90 })));
});

describe("Commission reversals and history (H7)", () => {
  beforeAll(async () => {
    rev1 = await mkEntry({ type: "reversal", reverses: entry1, base: -100, comm: -20, teacher: -80 });
  });

  test("H7: an exact reversal entry", async () => {
    if (!rev1) throw new Error("no reversal");
  });
  test("H7: an entry is reversed once", () => rejects(/commission_entry_reversal_uq/, () =>
    mkEntry({ type: "reversal", reverses: entry1, base: -100, comm: -20, teacher: -80 })));
  test("H7: a reversal cannot be reversed", () => rejects(/must reverse an accrual/, () =>
    mkEntry({ type: "reversal", reverses: rev1, base: 100, comm: 20, teacher: 80 })));
  test("H6: entry amounts cannot be edited", () => rejects(/only status and payout can change/, () =>
    q(`UPDATE commission_entry SET base_amount = 200, commission_amount = 40, teacher_amount = 160 WHERE id = $1`, [entry1])));
  test("commission entries are never deleted", () => rejects(/never deleted/, () => q(`DELETE FROM commission_entry WHERE id = $1`, [entry1])));
});

describe("Teacher payouts", () => {
  beforeAll(async () => {
    payout = await id(
      `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-01-01', '2027-02-01', 100, 20, 80)`,
      [lec],
    );
  });

  test("H8: a payout cannot be inserted as paid", () => rejects(/a new payout must start as a draft/, () =>
    q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable, status, approved_by, paid_on, payment_reference) VALUES ($1, '2029-01-01', '2029-02-01', 0, 0, 0, 'paid', $2, '2029-02-05', 'TRX-9')`, [lec, u1])));
  test("H8: a payout cannot be inserted as approved", () => rejects(/a new payout must start as a draft/, () =>
    q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable, status, approved_by) VALUES ($1, '2029-01-01', '2029-02-01', 0, 0, 0, 'approved', $2)`, [lec, u1])));
  test("a payout's net is gross minus commission", () => rejects(/teacher_payout_amounts_check/, () =>
    q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-02-01', '2027-03-01', 100, 20, 90)`, [lec])));
  test("H8: gross and commission may be negative while the net is positive", async () => {
    const d = await id(
      `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2030-01-01', '2030-02-01', -500, -900, 400)`,
      [lec],
    );
    await q(`DELETE FROM teacher_payout WHERE id = $1`, [d]);
  });
  test("H8: a payout cannot be negative", () => rejects(/teacher_payout_amounts_check/, () =>
    q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-02-01', '2027-03-01', 0, 20, -20)`, [lec])));
  test("a payout period ends after it starts", () => rejects(/teacher_payout_period_check/, () =>
    q(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-02-01', '2027-02-01', 0, 0, 0)`, [lec])));
  test("an entry cannot join another lecturer's payout", () => rejects(/commission_entry_payout_lecturer_fk/, async () => {
    const otherPayout = await id(
      `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2027-01-01', '2027-02-01', 0, 0, 0)`,
      [lec3],
    );
    await q(`UPDATE commission_entry SET status = 'settled', payout_id = $2 WHERE id = $1`, [entry1, otherPayout]);
  }));
  test("H8: an entry is settled in the payout", () =>
    q(`UPDATE commission_entry SET status = 'settled', payout_id = $2 WHERE id = $1`, [entry1, payout]));
  test("an approved payout needs an approver (NULL-safe)", () => rejects(/teacher_payout_approved_check/, () =>
    q(`UPDATE teacher_payout SET status = 'approved' WHERE id = $1`, [payout])));
  test("a payout cannot skip approval", () => rejects(/cannot move a payout from draft to paid/, () =>
    q(`UPDATE teacher_payout SET status = 'paid', approved_by = $2, paid_on = '2027-02-05', payment_reference = 'TRX-1' WHERE id = $1`, [payout, u1])));
});

describe("Payout deletion and status order", () => {
  beforeAll(async () => {
    await q(`UPDATE teacher_payout SET status = 'approved', approved_by = $2 WHERE id = $1`, [payout, u1]);
  });

  test("an approved payout cannot be deleted", () => rejects(/only a draft payout can be deleted/, () => q(`DELETE FROM teacher_payout WHERE id = $1`, [payout])));
  test("a paid payout needs its date and reference", () => rejects(/teacher_payout_paid_check/, () =>
    q(`UPDATE teacher_payout SET status = 'paid' WHERE id = $1`, [payout])));
  test("a payout is marked paid", () =>
    q(`UPDATE teacher_payout SET status = 'paid', paid_on = '2027-02-05', payment_reference = 'TRX-1' WHERE id = $1`, [payout]));
  test("H8: a paid payout is immutable", () => rejects(/paid payout is immutable/, () =>
    q(`UPDATE teacher_payout SET payment_reference = 'edited' WHERE id = $1`, [payout])));
  test("H8: an entry in a paid payout cannot change", () => rejects(/entry in a paid payout cannot change/, () =>
    q(`UPDATE commission_entry SET status = 'void', payout_id = NULL WHERE id = $1`, [entry1])));
  test("a draft payout can be deleted", async () => {
    const d = await id(
      `INSERT INTO teacher_payout (lecturer_id, period_start, period_end, gross_collected, commission_total, net_payable) VALUES ($1, '2028-01-01', '2028-02-01', 0, 0, 0)`,
      [lec],
    );
    await q(`DELETE FROM teacher_payout WHERE id = $1`, [d]);
  });
});

describe("Gateway transactions", () => {
  beforeAll(async () => {
    gwMethod = await id(
      `INSERT INTO payment_method (organization_id, type, label) VALUES ((SELECT id FROM organization), 'gateway', 'Card payment')`,
    );
    gwPayment = await id(
      `INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 1200, $4)`,
      [st1, b1, gwMethod, u1],
    );
    gwTx = await id(`INSERT INTO gateway_transaction (payment_id, provider) VALUES ($1, 'payhere')`, [gwPayment]);
  });

  test("a gateway transaction starts initiated with no reference", async () => {
    const r = await q(`SELECT status, provider_ref FROM gateway_transaction WHERE id = $1`, [gwTx]);
    if (r[0]!.status !== "initiated" || r[0]!.provider_ref !== null) throw new Error("unexpected defaults");
  });
  test("a payment with a gateway transaction cannot move to a non-gateway method", () => rejects(/must keep a gateway payment method/, () =>
    q(`UPDATE payment SET payment_method_id = $1 WHERE id = $2`, [bankMethod, gwPayment])));
  test("a payment method with gateway transactions cannot stop being a gateway method", () => rejects(/must stay a gateway method/, () =>
    q(`UPDATE payment_method SET type = 'cash' WHERE id = $1`, [gwMethod])));
  test("a payment without gateway transactions can still change method", async () => {
    const m = await id(`INSERT INTO payment_method (organization_id, type, label) VALUES ((SELECT id FROM organization), 'cash', 'Counter')`);
    const p = await id(`INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 50, $4)`, [st1, b1, bankMethod, u1]);
    await q(`UPDATE payment SET payment_method_id = $1 WHERE id = $2`, [m, p]);
  });
  test("a gateway transaction needs a gateway payment", () => rejects(/must use a gateway payment method/, () =>
    q(`INSERT INTO gateway_transaction (payment_id, provider) VALUES ($1, 'payhere')`, [payA])));
  test("a succeeded transaction needs its provider reference (NULL-safe)", () => rejects(/gateway_transaction_succeeded_check/, () =>
    q(`UPDATE gateway_transaction SET status = 'succeeded' WHERE id = $1`, [gwTx])));
  test("a transaction status must be known", () => rejects(/gateway_transaction_status_check/, () =>
    q(`UPDATE gateway_transaction SET status = 'refunded' WHERE id = $1`, [gwTx])));
  test("a blank provider reference is rejected", () => rejects(/gateway_transaction_ref_check/, () =>
    q(`UPDATE gateway_transaction SET provider_ref = '  ' WHERE id = $1`, [gwTx])));
  test("a callback records the provider reference and payload", () =>
    q(`UPDATE gateway_transaction SET status = 'succeeded', provider_ref = 'PH-1001', raw_payload = '{"status_code":2}'::jsonb WHERE id = $1`, [gwTx]));
  test("E14: a provider reference is unique per provider", () => rejects(/gateway_transaction_provider_ref_uq/, async () => {
    const pay2 = await id(
      `INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 500, $4)`,
      [st1, b1, gwMethod, u1],
    );
    await q(`INSERT INTO gateway_transaction (payment_id, provider, provider_ref) VALUES ($1, 'payhere', 'PH-1001')`, [pay2]);
  }));
  test("E14: the same reference at another provider is allowed", async () => {
    const pay3 = await id(
      `INSERT INTO payment (student_id, branch_id, payment_method_id, amount, submitted_by) VALUES ($1, $2, $3, 500, $4)`,
      [st1, b1, gwMethod, u1],
    );
    await q(`INSERT INTO gateway_transaction (payment_id, provider, provider_ref) VALUES ($1, 'stripe', 'PH-1001')`, [pay3]);
  });
  test("transactions without a reference yet can coexist", () =>
    q(`INSERT INTO gateway_transaction (payment_id, provider) VALUES ($1, 'payhere')`, [gwPayment]));
});

describe("Course changes keep enrolments valid (C2) and money is never NaN", () => {
  const mkCourse = (kind: string, mode: string) =>
    id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1, $2, $3, $4, $5, $5 = 'scheduled')`, [subj, b1, `chg-${kind}-${mode}-${Math.random()}`, kind, mode]);

  test("a class with an enrolment cannot become a scheduled program (the enrolment has no intake)", async () => {
    const c = await mkCourse("class", "scheduled");
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [c, st1]);
    await rejects(/C2/, () => q(`UPDATE course SET kind = 'program' WHERE id = $1`, [c]));
  });
  test("a scheduled program with an intake enrolment cannot become a class or self-paced", async () => {
    const c = await mkCourse("program", "scheduled");
    const i = await id(`INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'I', '2027-03-01')`, [c]);
    await q(`INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3)`, [c, st1, i]);
    await rejects(/C2/, () => q(`UPDATE course SET learning_mode = 'self_paced' WHERE id = $1`, [c]));
    await rejects(/C2|course_class_is_scheduled_check/, () => q(`UPDATE course SET kind = 'class' WHERE id = $1`, [c]));
  });
  test("a self-paced program with an enrolment cannot become scheduled", async () => {
    const c = await mkCourse("program", "self_paced");
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [c, st1]);
    await rejects(/C2/, () => q(`UPDATE course SET learning_mode = 'scheduled' WHERE id = $1`, [c]));
  });
  test("a course without enrolments can change freely, and other updates are not blocked", async () => {
    const c = await mkCourse("class", "scheduled");
    await q(`UPDATE course SET kind = 'program' WHERE id = $1`, [c]);
    const d = await mkCourse("class", "scheduled");
    await q(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [d, st1]);
    await q(`UPDATE course SET name = 'renamed' WHERE id = $1`, [d]);
  });

  test("the enrolment trigger reads the course FOR SHARE, so a concurrent course change and enrolment insert wait for each other", async () => {
    // PGlite has one connection and cannot show the wait itself; this guards the lock clause (the real-PostgreSQL concurrency test is owed)
    const [fn] = await q(`SELECT pg_get_functiondef('enrollment_check_intake'::regproc) AS def`);
    if (!/FROM "?course"?\s+WHERE "?id"? = NEW\."?course_id"?\s+FOR SHARE/i.test(String(fn!.def))) throw new Error(`enrollment_check_intake must read the course FOR SHARE:\n${fn!.def}`);
  });

  test("the discount-enrolment trigger locks the discount and the item it reduces FOR SHARE before it reads, so a concurrent insert and enrolment change wait for each other", async () => {
    // PGlite has one connection and cannot show the wait itself; this guards the lock clause and its place before the check (the real-PostgreSQL concurrency test is owed)
    const [fn] = await q(`SELECT pg_get_functiondef('invoice_item_check_discount_enrollment'::regproc) AS def`);
    const def = String(fn!.def);
    const lock = def.search(/WHERE "?id"? IN \(NEW\."?id"?, NEW\."?applies_to_item_id"?\)\s+ORDER BY "?id"?\s+FOR SHARE/i);
    if (lock < 0) throw new Error(`invoice_item_check_discount_enrollment must lock both rows in id order FOR SHARE:\n${def}`);
    if (lock > def.search(/IF EXISTS/i)) throw new Error("the lock must be taken before the check reads");
  });

  test("invoice_item is indexed on applies_to_item_id for the discount-enrolment trigger", async () => {
    const rows = await q(`SELECT indexdef FROM pg_indexes WHERE tablename = 'invoice_item' AND indexname = 'invoice_item_applies_to_idx'`);
    if (rows.length !== 1 || !/\(applies_to_item_id\)/.test(String(rows[0]!.indexdef))) throw new Error("invoice_item_applies_to_idx on (applies_to_item_id) is missing");
  });

  test("the exam result guard locks the exam row FOR SHARE before it reads the mode", async () => {
    // PGlite cannot show the wait; this guards the lock clause (test/concurrency.pg.test.ts runs both write orders on a real server)
    const [fn] = await q(`SELECT pg_get_functiondef('exam_result_guard'::regproc) AS def`);
    if (!/FROM exam WHERE id = NEW\.exam_id FOR SHARE/i.test(String(fn!.def))) throw new Error(`exam_result_guard must read the exam FOR SHARE:\n${fn!.def}`);
  });

  test("the payment guard reads the target payment method FOR SHARE, so a concurrent change of its type waits for the payment move", async () => {
    // PGlite has one connection and cannot show the wait itself; this guards the lock clause (the real-PostgreSQL concurrency test is owed)
    const [fn] = await q(`SELECT pg_get_functiondef('payment_gateway_method_guard'::regproc) AS def`);
    if (!/FROM payment_method\s+WHERE id = NEW\.payment_method_id\s+FOR SHARE/i.test(String(fn!.def))) throw new Error(`payment_gateway_method_guard must read the payment method FOR SHARE:\n${fn!.def}`);
  });

  test("NaN is rejected in a money column", () => rejects(/finite_check/, () =>
    q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 'NaN', '2030-01-01')`, [fee1])));

  /** Numeric columns of `tables` (default: every table) with no check on exactly that column that rejects NaN the way the migration writes it. */
  const withoutNanCheck = (tables?: string[]) =>
    q(
      `
      SELECT c.table_name, c.column_name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.data_type = 'numeric'
        AND c.table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        AND ($1::text[] IS NULL OR c.table_name = ANY($1::text[]))
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint k
          JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attname = c.column_name
          WHERE k.conrelid = format('%I.%I', c.table_schema, c.table_name)::regclass AND k.contype = 'c'
            -- a check on exactly this column (not one on another column whose name contains it), with the predicate the migration generates
            AND k.conkey = ARRAY[a.attnum]
            AND pg_get_constraintdef(k.oid) IN (
              format('CHECK ((%I <> ''NaN''::numeric))', c.column_name),
              format('CHECK ((%I <> ''NaN''::numeric)) NOT VALID', c.column_name)))
      ORDER BY c.table_name, c.column_name`,
      [tables ?? null],
    );

  test("every numeric column has a NaN check (add one in the migration for any new numeric column)", async () => {
    const missing = await withoutNanCheck();
    if (missing.length > 0) throw new Error(`numeric columns without a NaN check: ${missing.map((m) => `${m.table_name}.${m.column_name}`).join(", ")}`);
  });

  test("the NaN-check search is exact: another column's check, or a check that still allows NaN, does not count", async () => {
    await q(`CREATE TABLE nan_probe_other (amount numeric, discount_amount numeric, CONSTRAINT p1 CHECK (discount_amount <> 'NaN'::numeric))`);
    await q(`CREATE TABLE nan_probe_loose (amount numeric, CONSTRAINT p2 CHECK (amount = 'NaN'::numeric OR amount > 0))`);
    await q(`CREATE TABLE nan_probe_ok (amount numeric, discount_amount numeric, CONSTRAINT p3 CHECK (amount <> 'NaN'::numeric), CONSTRAINT p4 CHECK (discount_amount <> 'NaN'::numeric) NOT VALID)`);
    try {
      const rows = await withoutNanCheck(["nan_probe_other", "nan_probe_loose", "nan_probe_ok"]);
      const got = rows.map((r) => `${r.table_name}.${r.column_name}`);
      if (JSON.stringify(got) !== JSON.stringify(["nan_probe_loose.amount", "nan_probe_other.amount"])) throw new Error(`unexpected result: ${got.join(", ")}`);
    } finally {
      await q(`DROP TABLE nan_probe_other, nan_probe_loose, nan_probe_ok`);
    }
  });
});
