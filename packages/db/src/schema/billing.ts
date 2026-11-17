import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { course, enrollment, intake } from "./academics";
import { branch, file, OVERDUE_ACTIONS, organization, user } from "./core";
import { createdAt, day, money, oneOf, pk, tstz } from "./helpers";
import { contentPurchase } from "./content";
import { gradeLevel, student } from "./people";

export const FEE_BILLING_TYPES = ["recurring", "one_time_package"] as const;
export const FEE_FREQUENCIES = ["monthly", "per_term"] as const;
export const INVOICE_STATUSES = ["pending", "partial", "paid", "overdue", "waived", "cancelled"] as const;
export const INVOICE_ITEM_KINDS = ["recurring_fee", "package_fee", "content", "adjustment", "discount"] as const;
export const PAYMENT_METHOD_TYPES = ["bank_transfer", "cash", "gateway"] as const;
export const PAYMENT_STATUSES = ["pending_verification", "verified", "rejected", "voided"] as const;
export const RECEIPT_STATUSES = ["issued", "void"] as const;
export const INSTALLMENT_STATUSES = ["pending", "partial", "paid", "overdue"] as const;
export const FEE_EXCEPTION_KINDS = ["alternate_option", "discount"] as const;
export const DISCOUNT_TYPES = ["percent", "fixed"] as const;

/**
 * Fees are set on the class (invariant D1). A class has at most one default, active structure,
 * and enrolling attaches it automatically. Structures without a course are general fees (admission, materials).
 */
export const feeStructure = pgTable(
  "fee_structure",
  {
    id: pk(),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    courseId: uuid("course_id"),
    intakeId: uuid("intake_id"),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    billingType: text("billing_type").notNull(),
    frequency: text("frequency"),
    /** One-time packages only. null = lifetime access. */
    accessDurationMonths: integer("access_duration_months"),
    overdueGraceDays: integer("overdue_grace_days"),
    overdueAction: text("overdue_action"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique("fee_structure_id_course_uq").on(t.id, t.courseId),
    // The structure's branch must be its course's branch, and its intake must belong to its course.
    foreignKey({
      name: "fee_structure_course_branch_fk",
      columns: [t.courseId, t.branchId],
      foreignColumns: [course.id, course.branchId],
    }),
    foreignKey({
      name: "fee_structure_intake_course_fk",
      columns: [t.intakeId, t.courseId],
      foreignColumns: [intake.id, intake.courseId],
    }),
    oneOf("fee_structure_billing_type_check", t.billingType, FEE_BILLING_TYPES),
    // D4
    check(
      "fee_structure_frequency_check",
      sql`(${t.billingType} = 'recurring' AND ${t.frequency} IS NOT NULL AND ${t.frequency} IN ('monthly', 'per_term')) OR (${t.billingType} = 'one_time_package' AND ${t.frequency} IS NULL)`,
    ),
    check(
      "fee_structure_duration_check",
      sql`${t.accessDurationMonths} IS NULL OR (${t.billingType} = 'one_time_package' AND ${t.accessDurationMonths} > 0)`,
    ),
    check("fee_structure_intake_needs_course_check", sql`${t.intakeId} IS NULL OR ${t.courseId} IS NOT NULL`),
    check("fee_structure_default_needs_course_check", sql`NOT ${t.isDefault} OR ${t.courseId} IS NOT NULL`),
    check("fee_structure_grace_days_check", sql`${t.overdueGraceDays} IS NULL OR ${t.overdueGraceDays} >= 0`),
    check(
      "fee_structure_overdue_action_check",
      sql`${t.overdueAction} IS NULL OR ${t.overdueAction} IN (${sql.raw(OVERDUE_ACTIONS.map((v) => `'${v}'`).join(", "))})`,
    ),
    // D1: at most one default, active structure per class.
    uniqueIndex("fee_structure_one_default_per_course_uq")
      .on(t.courseId)
      .where(sql`${t.isDefault} AND ${t.isActive}`),
    index("fee_structure_course_idx").on(t.courseId),
  ],
);

/** Amounts by grade and date range [effective_from, effective_to). Overlap is blocked by an exclusion constraint (D5). */
export const feeRate = pgTable(
  "fee_rate",
  {
    id: pk(),
    feeStructureId: uuid("fee_structure_id")
      .notNull()
      .references((): AnyPgColumn => feeStructure.id),
    /** null = the same rate for all grades. */
    gradeLevelId: uuid("grade_level_id").references((): AnyPgColumn => gradeLevel.id),
    amount: money("amount").notNull(),
    effectiveFrom: day("effective_from").notNull(),
    effectiveTo: day("effective_to"),
  },
  (t) => [
    check("fee_rate_amount_check", sql`${t.amount} > 0`),
    check("fee_rate_dates_check", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
    index("fee_rate_structure_idx").on(t.feeStructureId),
  ],
);

export const paymentMethod = pgTable(
  "payment_method",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references((): AnyPgColumn => organization.id),
    type: text("type").notNull(),
    label: text("label").notNull(),
    /** Bank transfer is the default method. */
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    config: jsonb("config"),
  },
  (t) => [
    oneOf("payment_method_type_check", t.type, PAYMENT_METHOD_TYPES),
    uniqueIndex("payment_method_one_default_uq").on(t.organizationId).where(sql`${t.isDefault}`),
  ],
);

export const bankAccount = pgTable(
  "bank_account",
  {
    id: pk(),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    bankName: text("bank_name").notNull(),
    branchName: text("branch_name"),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    unique("bank_account_id_branch_uq").on(t.id, t.branchId),
    unique("bank_account_number_uq").on(t.branchId, t.bankName, t.accountNumber),
  ],
);

/** Installment plans offered on a one-time package (D10, D11). Chosen when the invoice is issued. */
export const installmentOption = pgTable(
  "installment_option",
  {
    id: pk(),
    feeStructureId: uuid("fee_structure_id")
      .notNull()
      .references((): AnyPgColumn => feeStructure.id),
    name: text("name").notNull(),
    installmentCount: integer("installment_count").notNull(),
    /** Share of the total due at issue, 0 to under 100. */
    downPaymentPercent: numeric("down_payment_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    /** Days between installments. */
    intervalDays: integer("interval_days").notNull(),
    surchargePercent: numeric("surcharge_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    unique("installment_option_structure_name_uq").on(t.feeStructureId, t.name),
    check("installment_option_count_check", sql`${t.installmentCount} >= 2`),
    check(
      "installment_option_down_payment_check",
      sql`${t.downPaymentPercent} >= 0 AND ${t.downPaymentPercent} < 100`,
    ),
    check("installment_option_interval_check", sql`${t.intervalDays} > 0`),
    check("installment_option_surcharge_check", sql`${t.surchargePercent} >= 0`),
    index("installment_option_structure_idx").on(t.feeStructureId),
  ],
);

/**
 * Optional fee exception (D15 to D22): another fee option of the same class, or a discount, for one enrolment.
 * Ended (effective_to, ended_by), never deleted. Overlap per (enrolment, kind) is blocked by an exclusion constraint (D18).
 * course_id repeats the enrolment's course so composite foreign keys can keep the alternate option in the same class (D20).
 */
export const feeException = pgTable(
  "fee_exception",
  {
    id: pk(),
    enrollmentId: uuid("enrollment_id").notNull(),
    courseId: uuid("course_id").notNull(),
    kind: text("kind").notNull(),
    alternateFeeStructureId: uuid("alternate_fee_structure_id"),
    discountType: text("discount_type"),
    /** Percent 0 to 100 (100 = free place) or a fixed amount. */
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }),
    effectiveFrom: day("effective_from").notNull(),
    /** Exclusive end. null = until ended. */
    effectiveTo: day("effective_to"),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references((): AnyPgColumn => user.id),
    endedBy: uuid("ended_by").references((): AnyPgColumn => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("fee_exception_id_enrollment_uq").on(t.id, t.enrollmentId),
    foreignKey({
      name: "fee_exception_enrollment_course_fk",
      columns: [t.enrollmentId, t.courseId],
      foreignColumns: [enrollment.id, enrollment.courseId],
    }),
    // D20: the alternate option belongs to the same class.
    foreignKey({
      name: "fee_exception_alternate_course_fk",
      columns: [t.alternateFeeStructureId, t.courseId],
      foreignColumns: [feeStructure.id, feeStructure.courseId],
    }),
    oneOf("fee_exception_kind_check", t.kind, FEE_EXCEPTION_KINDS),
    // D16: columns required or empty by kind.
    check(
      "fee_exception_kind_columns_check",
      sql`(${t.kind} = 'alternate_option' AND ${t.alternateFeeStructureId} IS NOT NULL AND ${t.discountType} IS NULL AND ${t.discountValue} IS NULL) OR (${t.kind} = 'discount' AND ${t.alternateFeeStructureId} IS NULL AND ${t.discountType} IS NOT NULL AND ${t.discountType} IN ('percent', 'fixed') AND ${t.discountValue} IS NOT NULL)`,
    ),
    // D19: percent is 0 to 100, fixed is at least 0.
    check(
      "fee_exception_discount_value_check",
      sql`${t.discountType} IS NULL OR (${t.discountValue} IS NOT NULL AND ${t.discountValue} >= 0 AND (${t.discountType} <> 'percent' OR ${t.discountValue} <= 100))`,
    ),
    // D17
    check("fee_exception_reason_check", sql`length(btrim(${t.reason})) > 0`),
    check("fee_exception_dates_check", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
    // D21: an exception that was ended by someone has an end date.
    check("fee_exception_ended_check", sql`${t.endedBy} IS NULL OR ${t.effectiveTo} IS NOT NULL`),
    index("fee_exception_enrollment_idx").on(t.enrollmentId),
  ],
);

/**
 * Invoice header. Totals are caches of the items and are inserted with their final values (D8, D9):
 * total = subtotal - discount_total, where items are signed amounts. Issued invoices are append-only (D26).
 */
export const invoice = pgTable(
  "invoice",
  {
    id: pk(),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    /** null = pay in full. Fixed at issue time (D11). */
    installmentOptionId: uuid("installment_option_id").references((): AnyPgColumn => installmentOption.id),
    issuedOn: day("issued_on").notNull().default(sql`CURRENT_DATE`),
    dueDate: day("due_date").notNull(),
    /** Total before discounts. */
    subtotal: money("subtotal").notNull().default("0"),
    /** Positive: minus the sum of discount items. */
    discountTotal: money("discount_total").notNull().default("0"),
    /** Sum of all signed items. */
    total: money("total").notNull().default("0"),
    /** Cache of the active allocations (E1). */
    amountPaid: money("amount_paid").notNull().default("0"),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("invoice_id_student_uq").on(t.id, t.studentId),
    // Phase 4: a content purchase and its invoice share the branch (D13, D24).
    unique("invoice_id_branch_uq").on(t.id, t.branchId),
    oneOf("invoice_status_check", t.status, INVOICE_STATUSES),
    check("invoice_discount_range_check", sql`${t.discountTotal} >= 0 AND ${t.discountTotal} <= ${t.subtotal}`),
    check("invoice_total_formula_check", sql`${t.total} = ${t.subtotal} - ${t.discountTotal}`),
    check("invoice_paid_range_check", sql`${t.amountPaid} >= 0 AND ${t.amountPaid} <= ${t.total}`),
    check("invoice_zero_total_check", sql`${t.total} > 0 OR ${t.status} IN ('waived', 'cancelled')`),
    check("invoice_due_date_check", sql`${t.dueDate} >= ${t.issuedOn}`),
    index("invoice_student_idx").on(t.studentId),
    index("invoice_status_due_idx").on(t.status, t.dueDate),
  ],
);

/**
 * Installments follow the invoice (D10, D25). Amounts sum to the invoice total (checked in the transaction).
 * amount_paid and status are caches derived by the waterfall over the invoice's allocations (E16).
 */
export const invoiceInstallment = pgTable(
  "invoice_installment",
  {
    id: pk(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references((): AnyPgColumn => invoice.id),
    seq: integer("seq").notNull(),
    dueDate: day("due_date").notNull(),
    amount: money("amount").notNull(),
    amountPaid: money("amount_paid").notNull().default("0"),
    status: text("status").notNull().default("pending"),
  },
  (t) => [
    unique("invoice_installment_seq_uq").on(t.invoiceId, t.seq),
    oneOf("invoice_installment_status_check", t.status, INSTALLMENT_STATUSES),
    check("invoice_installment_seq_check", sql`${t.seq} >= 1`),
    check("invoice_installment_amount_check", sql`${t.amount} > 0`),
    check("invoice_installment_paid_check", sql`${t.amountPaid} >= 0 AND ${t.amountPaid} <= ${t.amount}`),
    index("invoice_installment_due_idx").on(t.status, t.dueDate),
  ],
);

/**
 * Signed invoice lines (D8, D23): fee and content items are positive, discount items negative,
 * adjustments either. Discounts and negative adjustments point at the payable item they reduce.
 *  */
export const invoiceItem = pgTable(
  "invoice_item",
  {
    id: pk(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references((): AnyPgColumn => invoice.id),
    kind: text("kind").notNull(),
    description: text("description"),
    amount: money("amount").notNull(),
    enrollmentId: uuid("enrollment_id").references((): AnyPgColumn => enrollment.id),
    feeStructureId: uuid("fee_structure_id").references((): AnyPgColumn => feeStructure.id),
    /** The grade used for the rate. */
    gradeLevelId: uuid("grade_level_id").references((): AnyPgColumn => gradeLevel.id),
    appliesToItemId: uuid("applies_to_item_id"),
    /** Content items: the purchase this line charges. The purchase must point at the same invoice. */
    contentPurchaseId: uuid("content_purchase_id"),
    /** Discount items created by a fee exception (D19). */
    feeExceptionId: uuid("fee_exception_id").references((): AnyPgColumn => feeException.id),
    /** Set on every item when the invoice is cancelled (D26). */
    cancelledAt: tstz("cancelled_at"),
    periodStart: day("period_start"),
    /** Exclusive end. */
    periodEnd: day("period_end"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("invoice_item_id_invoice_uq").on(t.id, t.invoiceId),
    foreignKey({
      name: "invoice_item_applies_to_fk",
      columns: [t.appliesToItemId, t.invoiceId],
      foreignColumns: [t.id, t.invoiceId],
    }),
    foreignKey({
      name: "invoice_item_purchase_invoice_fk",
      columns: [t.contentPurchaseId, t.invoiceId],
      foreignColumns: [contentPurchase.id, contentPurchase.invoiceId],
    }),
    oneOf("invoice_item_kind_check", t.kind, INVOICE_ITEM_KINDS),
    check(
      "invoice_item_content_fields_check",
      sql`(${t.kind} = 'content' AND ${t.contentPurchaseId} IS NOT NULL) OR (${t.kind} <> 'content' AND ${t.contentPurchaseId} IS NULL)`,
    ),
    // One active content line per purchase.
    uniqueIndex("invoice_item_content_purchase_uq")
      .on(t.contentPurchaseId)
      .where(sql`${t.kind} = 'content' AND ${t.cancelledAt} IS NULL`),
    check(
      "invoice_item_sign_check",
      sql`(${t.kind} IN ('recurring_fee', 'package_fee', 'content') AND ${t.amount} > 0) OR (${t.kind} = 'discount' AND ${t.amount} < 0) OR (${t.kind} = 'adjustment' AND ${t.amount} <> 0)`,
    ),
    check("invoice_item_exception_kind_check", sql`${t.feeExceptionId} IS NULL OR ${t.kind} = 'discount'`),
    check("invoice_item_discount_applies_check", sql`${t.kind} <> 'discount' OR ${t.appliesToItemId} IS NOT NULL`),
    check(
      "invoice_item_negative_adjustment_check",
      sql`${t.kind} <> 'adjustment' OR ${t.amount} > 0 OR ${t.appliesToItemId} IS NOT NULL`,
    ),
    check(
      "invoice_item_applies_kind_check",
      sql`${t.appliesToItemId} IS NULL OR ${t.kind} IN ('discount', 'adjustment')`,
    ),
    check(
      "invoice_item_recurring_fields_check",
      sql`${t.kind} <> 'recurring_fee' OR (${t.enrollmentId} IS NOT NULL AND ${t.feeStructureId} IS NOT NULL AND ${t.periodStart} IS NOT NULL AND ${t.periodEnd} IS NOT NULL)`,
    ),
    check(
      "invoice_item_package_fields_check",
      sql`${t.kind} <> 'package_fee' OR (${t.enrollmentId} IS NOT NULL AND ${t.feeStructureId} IS NOT NULL)`,
    ),
    check(
      "invoice_item_period_check",
      sql`${t.periodStart} IS NULL OR ${t.periodEnd} IS NULL OR ${t.periodEnd} > ${t.periodStart}`,
    ),
    // D7: recurring generation is idempotent, and a cancelled invoice does not block reissuing.
    uniqueIndex("invoice_item_recurring_uq")
      .on(t.enrollmentId, t.periodStart)
      .where(sql`${t.kind} = 'recurring_fee' AND ${t.cancelledAt} IS NULL`),
    index("invoice_item_invoice_idx").on(t.invoiceId),
    index("invoice_item_enrollment_idx").on(t.enrollmentId),
  ],
);

/**
 * A payment is entered against one or more invoices of the same student and branch (E7).
 * Verification and allocation are one atomic step, guarded by a deferred constraint trigger (E3).
 */
export const payment = pgTable(
  "payment",
  {
    id: pk(),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    /** The student, a guardian, or the staff member recording cash. */
    submittedBy: uuid("submitted_by").references((): AnyPgColumn => user.id),
    /** The branch that received the money. */
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    paymentMethodId: uuid("payment_method_id")
      .notNull()
      .references((): AnyPgColumn => paymentMethod.id),
    bankAccountId: uuid("bank_account_id"),
    slipFileId: uuid("slip_file_id").references((): AnyPgColumn => file.id),
    amount: money("amount").notNull(),
    /** Date on the slip, or the cash date. */
    paidOn: day("paid_on"),
    referenceNo: text("reference_no"),
    status: text("status").notNull().default("pending_verification"),
    rejectionReason: text("rejection_reason"),
    verifiedBy: uuid("verified_by").references((): AnyPgColumn => user.id),
    verifiedAt: tstz("verified_at"),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references((): AnyPgColumn => user.id),
    voidedAt: tstz("voided_at"),
    submittedAt: tstz("submitted_at").notNull().defaultNow(),
  },
  (t) => [
    unique("payment_id_student_uq").on(t.id, t.studentId),
    // E15: a bank transfer's branch is its bank account's branch.
    foreignKey({
      name: "payment_bank_account_branch_fk",
      columns: [t.bankAccountId, t.branchId],
      foreignColumns: [bankAccount.id, bankAccount.branchId],
    }),
    oneOf("payment_status_check", t.status, PAYMENT_STATUSES),
    check("payment_amount_check", sql`${t.amount} > 0`),
    check(
      "payment_verified_fields_check",
      sql`${t.status} <> 'verified' OR (${t.verifiedBy} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)`,
    ),
    check(
      "payment_rejected_fields_check",
      sql`${t.status} <> 'rejected' OR ${t.rejectionReason} IS NOT NULL`,
    ),
    check(
      "payment_voided_fields_check",
      sql`${t.status} <> 'voided' OR (${t.voidReason} IS NOT NULL AND ${t.voidedBy} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
    // E10: the same bank reference cannot be used twice on one account unless the earlier payment was rejected.
    uniqueIndex("payment_bank_reference_uq")
      .on(t.bankAccountId, t.referenceNo)
      .where(sql`${t.bankAccountId} IS NOT NULL AND ${t.referenceNo} IS NOT NULL AND ${t.status} <> 'rejected'`),
    index("payment_student_idx").on(t.studentId),
    index("payment_status_idx").on(t.status),
  ],
);

/** The financial source of truth (E1). Reversed (reversed_at), never deleted. */
export const paymentAllocation = pgTable(
  "payment_allocation",
  {
    id: pk(),
    paymentId: uuid("payment_id").notNull(),
    studentId: uuid("student_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    /** The payable item this money pays (E7). Installments are derived, never allocated to directly (E16). */
    invoiceItemId: uuid("invoice_item_id").notNull(),
    amount: money("amount").notNull(),
    reversedAt: tstz("reversed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // E6, E7: payment, invoice and allocation share the student; the item belongs to the invoice.
    foreignKey({
      name: "payment_allocation_payment_student_fk",
      columns: [t.paymentId, t.studentId],
      foreignColumns: [payment.id, payment.studentId],
    }),
    foreignKey({
      name: "payment_allocation_invoice_student_fk",
      columns: [t.invoiceId, t.studentId],
      foreignColumns: [invoice.id, invoice.studentId],
    }),
    foreignKey({
      name: "payment_allocation_item_invoice_fk",
      columns: [t.invoiceItemId, t.invoiceId],
      foreignColumns: [invoiceItem.id, invoiceItem.invoiceId],
    }),
    check("payment_allocation_amount_check", sql`${t.amount} > 0`),
    index("payment_allocation_payment_idx").on(t.paymentId),
    index("payment_allocation_invoice_idx").on(t.invoiceId),
    index("payment_allocation_item_idx").on(t.invoiceItemId),
  ],
);

export const receipt = pgTable(
  "receipt",
  {
    id: pk(),
    paymentId: uuid("payment_id")
      .notNull()
      .references((): AnyPgColumn => payment.id),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    /** Taken from receipt_counter inside the issuing transaction (E13). */
    receiptNo: text("receipt_no").notNull(),
    /** Public verify URL and QR code. */
    verificationCode: text("verification_code").notNull().unique(),
    contentHash: text("content_hash").notNull(),
    signature: text("signature").notNull(),
    signedAt: tstz("signed_at").notNull(),
    issuedAt: tstz("issued_at").notNull().defaultNow(),
    status: text("status").notNull().default("issued"),
    replacedByReceiptId: uuid("replaced_by_receipt_id").references((): AnyPgColumn => receipt.id),
    fileId: uuid("file_id").references((): AnyPgColumn => file.id),
  },
  (t) => [
    unique("receipt_branch_no_uq").on(t.branchId, t.receiptNo),
    oneOf("receipt_status_check", t.status, RECEIPT_STATUSES),
    check("receipt_replaced_check", sql`${t.replacedByReceiptId} IS NULL OR ${t.status} = 'void'`),
    // E12: a payment has exactly one active receipt. Voided receipts are kept.
    uniqueIndex("receipt_one_issued_per_payment_uq").on(t.paymentId).where(sql`${t.status} = 'issued'`),
  ],
);

/**
 * Per-branch receipt number counter (E13). Implementation detail of the design's "per-branch counter":
 * inside the issuing transaction, UPDATE ... SET last_number = last_number + 1 ... RETURNING last_number.
 */
export const receiptCounter = pgTable(
  "receipt_counter",
  {
    branchId: uuid("branch_id")
      .primaryKey()
      .references((): AnyPgColumn => branch.id),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [check("receipt_counter_check", sql`${t.lastNumber} >= 0`)],
);
