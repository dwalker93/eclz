import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "./core";
import { course, enrollment } from "./academics";
import { day, oneOf, pk, tstz } from "./helpers";
import { gradeLevel, student } from "./people";

export const PROMOTION_STATUSES = ["draft", "confirmed", "discarded"] as const;
export const PROMOTION_DECISIONS = ["move", "stay", "skip", "needs_review"] as const;
export const LEVEL_REASONS = ["admission", "promotion", "correction"] as const;

/** Draft, review and confirm flow (invariants B6, B8, C12 to C15). */
export const promotionRun = pgTable(
  "promotion_run",
  {
    id: pk(),
    performedBy: uuid("performed_by")
      .notNull()
      .references((): AnyPgColumn => user.id),
    status: text("status").notNull().default("draft"),
    /** Default: first day of the next billing month. New student_level rows start on this date. */
    effectiveDate: day("effective_date").notNull(),
    performedAt: tstz("performed_at").notNull().defaultNow(),
    confirmedAt: tstz("confirmed_at"),
    note: text("note"),
  },
  (t) => [
    oneOf("promotion_run_status_check", t.status, PROMOTION_STATUSES),
    check("promotion_run_confirmed_check", sql`${t.status} <> 'confirmed' OR ${t.confirmedAt} IS NOT NULL`),
  ],
);

/** A student's grade over time. Ranges are [from_date, to_date): the end is exclusive (B4, B5). */
export const studentLevel = pgTable(
  "student_level",
  {
    id: pk(),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    gradeLevelId: uuid("grade_level_id")
      .notNull()
      .references((): AnyPgColumn => gradeLevel.id),
    promotionRunId: uuid("promotion_run_id").references((): AnyPgColumn => promotionRun.id),
    fromDate: day("from_date").notNull(),
    toDate: day("to_date"),
    reason: text("reason").notNull().default("admission"),
  },
  (t) => [
    oneOf("student_level_reason_check", t.reason, LEVEL_REASONS),
    check("student_level_dates_check", sql`${t.toDate} IS NULL OR ${t.toDate} > ${t.fromDate}`),
    // B3: at most one current row. B4 (no overlapping ranges) is an exclusion constraint in the constraints migration.
    uniqueIndex("student_level_one_current_uq").on(t.studentId).where(sql`${t.toDate} IS NULL`),
    index("student_level_student_idx").on(t.studentId),
  ],
);

/** One item per active class enrolment of each student; a student with no enrolment gets one item with none. */
export const promotionItem = pgTable(
  "promotion_item",
  {
    id: pk(),
    promotionRunId: uuid("promotion_run_id")
      .notNull()
      .references((): AnyPgColumn => promotionRun.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    fromEnrollmentId: uuid("from_enrollment_id").references((): AnyPgColumn => enrollment.id),
    toCourseId: uuid("to_course_id").references((): AnyPgColumn => course.id),
    decision: text("decision").notNull().default("needs_review"),
    toEnrollmentId: uuid("to_enrollment_id").references((): AnyPgColumn => enrollment.id),
    note: text("note"),
  },
  (t) => [
    oneOf("promotion_item_decision_check", t.decision, PROMOTION_DECISIONS),
    uniqueIndex("promotion_item_run_enrollment_uq")
      .on(t.promotionRunId, t.fromEnrollmentId)
      .where(sql`${t.fromEnrollmentId} IS NOT NULL`),
    uniqueIndex("promotion_item_run_student_no_enrollment_uq")
      .on(t.promotionRunId, t.studentId)
      .where(sql`${t.fromEnrollmentId} IS NULL`),
    index("promotion_item_run_idx").on(t.promotionRunId),
  ],
);
