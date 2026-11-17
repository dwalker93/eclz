import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { course, subject } from "./academics";
import { file, user } from "./core";
import { paymentAllocation } from "./billing";
import { createdAt, day, money, oneOf, pk, tstz } from "./helpers";
import { gradeLevel, lecturer } from "./people";

export const COMMISSION_CALC_TYPES = ["percent", "fixed_per_student_month"] as const;
export const COMMISSION_ENTRY_TYPES = ["accrual", "reversal"] as const;
export const COMMISSION_ENTRY_STATUSES = ["accrued", "settled", "void"] as const;
export const COMMISSION_BASIS = ["paid", "list"] as const;
export const PAYOUT_STATUSES = ["draft", "approved", "paid"] as const;

/**
 * What the institute keeps from a lecturer's fees (H1). The most specific effective rule wins (H4):
 * course, then subject plus grade, then subject, then the lecturer default. Overlaps are blocked by an
 * exclusion constraint in the phase 4 constraints migration.
 */
export const commissionRule = pgTable(
  "commission_rule",
  {
    id: pk(),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    subjectId: uuid("subject_id").references((): AnyPgColumn => subject.id),
    gradeLevelId: uuid("grade_level_id").references((): AnyPgColumn => gradeLevel.id),
    courseId: uuid("course_id").references((): AnyPgColumn => course.id),
    calcType: text("calc_type").notNull(),
    /** What the institute keeps: a percent of the base (0 to 100) or a fixed amount per student per month. */
    commissionRate: money("commission_rate").notNull(),
    effectiveFrom: day("effective_from").notNull(),
    /** Exclusive end. null = current. */
    effectiveTo: day("effective_to"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("commission_rule_id_lecturer_uq").on(t.id, t.lecturerId),
    oneOf("commission_rule_calc_type_check", t.calcType, COMMISSION_CALC_TYPES),
    // H12: percent rates are 0 to 100, fixed amounts at least 0.
    check(
      "commission_rule_rate_check",
      sql`${t.commissionRate} >= 0 AND (${t.calcType} <> 'percent' OR ${t.commissionRate} <= 100)`,
    ),
    check("commission_rule_dates_check", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
    // H4 shapes: course alone, or subject plus optional grade, or the lecturer default. A grade needs a subject.
    check(
      "commission_rule_scope_check",
      sql`(${t.courseId} IS NOT NULL AND ${t.subjectId} IS NULL AND ${t.gradeLevelId} IS NULL) OR (${t.courseId} IS NULL AND (${t.gradeLevelId} IS NULL OR ${t.subjectId} IS NOT NULL))`,
    ),
    index("commission_rule_lecturer_idx").on(t.lecturerId),
  ],
);

/**
 * A teacher payout (H8). Totals are caches inserted with their final values: gross_collected is the sum of the entries' base,
 * commission_total the sum of their commission, and net_payable what is owed. A negative net is not paid out, it carries
 * forward to the next payout. A paid payout is immutable (trigger).
 */
export const teacherPayout = pgTable(
  "teacher_payout",
  {
    id: pk(),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    periodStart: day("period_start").notNull(),
    /** Exclusive end. */
    periodEnd: day("period_end").notNull(),
    grossCollected: money("gross_collected").notNull(),
    commissionTotal: money("commission_total").notNull(),
    netPayable: money("net_payable").notNull(),
    status: text("status").notNull().default("draft"),
    paidOn: day("paid_on"),
    paymentReference: text("payment_reference"),
    proofFileId: uuid("proof_file_id").references((): AnyPgColumn => file.id),
    approvedBy: uuid("approved_by").references((): AnyPgColumn => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("teacher_payout_id_lecturer_uq").on(t.id, t.lecturerId),
    oneOf("teacher_payout_status_check", t.status, PAYOUT_STATUSES),
    check("teacher_payout_period_check", sql`${t.periodEnd} > ${t.periodStart}`),
    check(
      "teacher_payout_amounts_check",
      sql`${t.grossCollected} >= 0 AND ${t.commissionTotal} >= 0 AND ${t.netPayable} >= 0 AND ${t.netPayable} = ${t.grossCollected} - ${t.commissionTotal}`,
    ),
    check(
      "teacher_payout_approved_check",
      sql`${t.status} = 'draft' OR ${t.approvedBy} IS NOT NULL`,
    ),
    check(
      "teacher_payout_paid_check",
      sql`${t.status} <> 'paid' OR (${t.paidOn} IS NOT NULL AND ${t.paymentReference} IS NOT NULL)`,
    ),
    index("teacher_payout_lecturer_idx").on(t.lecturerId),
  ],
);

/**
 * One entry per (allocation, lecturer) (H2, H11). Each entry snapshots the rule, calc type, rate, share and basis (H6),
 * so later rule edits never change past earnings. Reversal entries are the exact negatives of what they reverse (H7, H12).
 * Only status and payout_id ever change after insert (trigger).
 */
export const commissionEntry = pgTable(
  "commission_entry",
  {
    id: pk(),
    paymentAllocationId: uuid("payment_allocation_id")
      .notNull()
      .references((): AnyPgColumn => paymentAllocation.id),
    ruleId: uuid("rule_id").notNull(),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    payoutId: uuid("payout_id"),
    reversesEntryId: uuid("reverses_entry_id").references((): AnyPgColumn => commissionEntry.id),
    entryType: text("entry_type").notNull(),
    calcTypeApplied: text("calc_type_applied").notNull(),
    rateApplied: money("rate_applied").notNull(),
    sharePercentApplied: numeric("share_percent_applied", { precision: 5, scale: 2 }).notNull(),
    basisApplied: text("basis_applied").notNull(),
    /** True when the calculated commission was limited to the base (H12). */
    capped: boolean("capped").notNull().default(false),
    baseAmount: money("base_amount").notNull(),
    /** Kept by the institute. Negative on reversal. */
    commissionAmount: money("commission_amount").notNull(),
    /** Owed to the teacher. Negative on reversal. */
    teacherAmount: money("teacher_amount").notNull(),
    status: text("status").notNull().default("accrued"),
    createdAt: createdAt(),
  },
  (t) => [
    // The rule and the payout belong to the same lecturer as the entry.
    foreignKey({
      name: "commission_entry_rule_lecturer_fk",
      columns: [t.ruleId, t.lecturerId],
      foreignColumns: [commissionRule.id, commissionRule.lecturerId],
    }),
    foreignKey({
      name: "commission_entry_payout_lecturer_fk",
      columns: [t.payoutId, t.lecturerId],
      foreignColumns: [teacherPayout.id, teacherPayout.lecturerId],
    }),
    oneOf("commission_entry_type_check", t.entryType, COMMISSION_ENTRY_TYPES),
    oneOf("commission_entry_status_check", t.status, COMMISSION_ENTRY_STATUSES),
    oneOf("commission_entry_calc_type_check", t.calcTypeApplied, COMMISSION_CALC_TYPES),
    oneOf("commission_entry_basis_check", t.basisApplied, COMMISSION_BASIS),
    check(
      "commission_entry_share_check",
      sql`${t.sharePercentApplied} >= 0 AND ${t.sharePercentApplied} <= 100`,
    ),
    check("commission_entry_rate_check", sql`${t.rateApplied} >= 0`),
    check("commission_entry_split_check", sql`${t.teacherAmount} = ${t.baseAmount} - ${t.commissionAmount}`),
    // H12: an accrual's commission is between 0 and its base, so the teacher amount is never negative.
    // A reversal is zero or negative throughout, with the reversed entry named.
    check(
      "commission_entry_type_amounts_check",
      sql`(${t.entryType} = 'accrual' AND ${t.reversesEntryId} IS NULL AND ${t.baseAmount} >= 0 AND ${t.commissionAmount} >= 0 AND ${t.commissionAmount} <= ${t.baseAmount}) OR (${t.entryType} = 'reversal' AND ${t.reversesEntryId} IS NOT NULL AND ${t.baseAmount} <= 0 AND ${t.commissionAmount} <= 0 AND ${t.commissionAmount} >= ${t.baseAmount})`,
    ),
    // A settled entry has a payout, and only a settled entry does (H8).
    check("commission_entry_payout_check", sql`(${t.status} = 'settled') = (${t.payoutId} IS NOT NULL)`),
    // H2: one accrual per allocation and lecturer, unless it was voided.
    uniqueIndex("commission_entry_accrual_uq")
      .on(t.paymentAllocationId, t.lecturerId)
      .where(sql`${t.entryType} = 'accrual' AND ${t.status} <> 'void'`),
    // H7: an entry is reversed at most once.
    uniqueIndex("commission_entry_reversal_uq")
      .on(t.reversesEntryId)
      .where(sql`${t.reversesEntryId} IS NOT NULL`),
    index("commission_entry_lecturer_idx").on(t.lecturerId, t.status),
    index("commission_entry_allocation_idx").on(t.paymentAllocationId),
  ],
);
