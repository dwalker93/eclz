import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  time,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { branch, user } from "./core";
import { feeStructure } from "./billing";
import { createdAt, day, oneOf, pk, tstz } from "./helpers";
import { gradeLevel, lecturer, student } from "./people";

export const COURSE_KINDS = ["class", "program"] as const;
export const LEARNING_MODES = ["scheduled", "self_paced"] as const;
export const DELIVERY_MODES = ["physical", "online", "hybrid"] as const;
export const COURSE_STATUSES = ["draft", "active", "closed", "archived"] as const;
export const INTAKE_STATUSES = ["open", "running", "closed"] as const;
export const ENROLLMENT_STATUSES = ["active", "dropped", "completed"] as const;
export const ENROLLMENT_END_REASONS = ["dropped", "promoted", "course_ended", "transferred"] as const;
export const ACCESS_STATUSES = ["active", "restricted"] as const;
export const PREFERRED_MODES = ["physical", "online"] as const;
export const MEETING_PROVIDERS = ["zoom", "teams", "other"] as const;
export const SESSION_STATUSES = ["scheduled", "held", "cancelled"] as const;
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export const ATTENDED_VIA = ["physical", "online"] as const;
export const MARKED_VIA = ["manual", "qr"] as const;

export const academicTerm = pgTable(
  "academic_term",
  {
    id: pk(),
    name: text("name").notNull(),
    /** Display dates: ends_on is the last day (an exception to the end-exclusive convention). */
    startsOn: day("starts_on").notNull(),
    endsOn: day("ends_on").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (t) => [
    check("academic_term_dates_check", sql`${t.endsOn} >= ${t.startsOn}`),
    uniqueIndex("academic_term_one_current_uq").on(t.isCurrent).where(sql`${t.isCurrent}`),
  ],
);

export const subject = pgTable("subject", {
  id: pk(),
  code: text("code").unique(),
  name: text("name").notNull(),
});

/** Classes created together by the class setup form, one per grade (invariant C11). */
export const courseGroup = pgTable(
  "course_group",
  {
    id: pk(),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references((): AnyPgColumn => subject.id),
    name: text("name").notNull(),
    batchLabel: text("batch_label"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("course_group_id_branch_uq").on(t.id, t.branchId),
    unique("course_group_id_subject_uq").on(t.id, t.subjectId),
  ],
);

export const course = pgTable(
  "course",
  {
    id: pk(),
    subjectId: uuid("subject_id")
      .notNull()
      .references((): AnyPgColumn => subject.id),
    courseGroupId: uuid("course_group_id"),
    termId: uuid("term_id").references((): AnyPgColumn => academicTerm.id),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    learningMode: text("learning_mode").notNull().default("scheduled"),
    deliveryMode: text("delivery_mode").notNull().default("physical"),
    attendanceEnabled: boolean("attendance_enabled").notNull().default(true),
    batchLabel: text("batch_label"),
    capacity: integer("capacity"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("course_id_branch_uq").on(t.id, t.branchId),
    // A grouped class must be in the same branch and subject as its group.
    foreignKey({
      name: "course_group_branch_fk",
      columns: [t.courseGroupId, t.branchId],
      foreignColumns: [courseGroup.id, courseGroup.branchId],
    }),
    foreignKey({
      name: "course_group_subject_fk",
      columns: [t.courseGroupId, t.subjectId],
      foreignColumns: [courseGroup.id, courseGroup.subjectId],
    }),
    oneOf("course_kind_check", t.kind, COURSE_KINDS),
    oneOf("course_learning_mode_check", t.learningMode, LEARNING_MODES),
    oneOf("course_delivery_mode_check", t.deliveryMode, DELIVERY_MODES),
    oneOf("course_status_check", t.status, COURSE_STATUSES),
    // Invariant C1
    check("course_class_is_scheduled_check", sql`${t.kind} <> 'class' OR ${t.learningMode} = 'scheduled'`),
    check(
      "course_self_paced_no_attendance_check",
      sql`${t.learningMode} <> 'self_paced' OR NOT ${t.attendanceEnabled}`,
    ),
    check("course_capacity_check", sql`${t.capacity} IS NULL OR ${t.capacity} > 0`),
    index("course_branch_idx").on(t.branchId),
    index("course_group_idx").on(t.courseGroupId),
  ],
);

export const courseGradeLevel = pgTable(
  "course_grade_level",
  {
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    gradeLevelId: uuid("grade_level_id")
      .notNull()
      .references((): AnyPgColumn => gradeLevel.id),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.gradeLevelId] })],
);

export const courseLecturer = pgTable(
  "course_lecturer",
  {
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    /** Share of the course revenue, for co-taught courses. Shares of a course sum to 100 (checked in the app). */
    sharePercent: numeric("share_percent", { precision: 5, scale: 2 }).notNull().default("100"),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.lecturerId] }),
    check("course_lecturer_share_check", sql`${t.sharePercent} >= 0 AND ${t.sharePercent} <= 100`),
    uniqueIndex("course_lecturer_one_primary_uq").on(t.courseId).where(sql`${t.isPrimary}`),
  ],
);

export const intake = pgTable(
  "intake",
  {
    id: pk(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    name: text("name").notNull(),
    /** Display dates: ends_on is the last day. */
    startsOn: day("starts_on").notNull(),
    endsOn: day("ends_on"),
    capacity: integer("capacity"),
    status: text("status").notNull().default("open"),
  },
  (t) => [
    unique("intake_id_course_uq").on(t.id, t.courseId),
    oneOf("intake_status_check", t.status, INTAKE_STATUSES),
    check("intake_dates_check", sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
    check("intake_capacity_check", sql`${t.capacity} IS NULL OR ${t.capacity} > 0`),
  ],
);

export const enrollment = pgTable(
  "enrollment",
  {
    id: pk(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    /** Required for scheduled programs, absent for classes and self-paced programs (C2, trigger). */
    intakeId: uuid("intake_id"),
    /** The class default option, attached automatically. Never rewritten by fee exceptions. */
    feeStructureId: uuid("fee_structure_id"),
    /** Pins the grade used for rates when a student stays in a class after promotion (B8). */
    billingGradeLevelId: uuid("billing_grade_level_id").references((): AnyPgColumn => gradeLevel.id),
    preferredMode: text("preferred_mode"),
    status: text("status").notNull().default("active"),
    endReason: text("end_reason"),
    promotedFromEnrollmentId: uuid("promoted_from_enrollment_id").references(
      (): AnyPgColumn => enrollment.id,
    ),
    /** Billing overlay only: set to restricted by the overdue job (C9). */
    accessStatus: text("access_status").notNull().default("active"),
    enrolledOn: day("enrolled_on").notNull().default(sql`CURRENT_DATE`),
    accessStartsOn: day("access_starts_on").notNull().default(sql`CURRENT_DATE`),
    /** Exclusive: the first day WITHOUT access. null = lifetime or ongoing. */
    accessEndsOn: day("access_ends_on"),
    createdAt: createdAt(),
  },
  (t) => [
    // Phase 2: fee exceptions tie an enrolment to its course (D20).
    unique("enrollment_id_course_uq").on(t.id, t.courseId),
    // Phase 3: exam attempts and results tie an enrolment to its student and course (G3).
    unique("enrollment_id_student_course_uq").on(t.id, t.studentId, t.courseId),
    // C3: the intake must belong to the enrolment's course.
    foreignKey({
      name: "enrollment_intake_course_fk",
      columns: [t.intakeId, t.courseId],
      foreignColumns: [intake.id, intake.courseId],
    }),
    // D2: the fee structure must belong to the enrolment's course.
    foreignKey({
      name: "enrollment_fee_structure_course_fk",
      columns: [t.feeStructureId, t.courseId],
      foreignColumns: [feeStructure.id, feeStructure.courseId],
    }),
    oneOf("enrollment_status_check", t.status, ENROLLMENT_STATUSES),
    oneOf("enrollment_access_status_check", t.accessStatus, ACCESS_STATUSES),
    check(
      "enrollment_end_reason_check",
      sql`${t.endReason} IS NULL OR ${t.endReason} IN ('dropped', 'promoted', 'course_ended', 'transferred')`,
    ),
    check(
      "enrollment_preferred_mode_check",
      sql`${t.preferredMode} IS NULL OR ${t.preferredMode} IN ('physical', 'online')`,
    ),
    check("enrollment_active_has_no_end_reason_check", sql`${t.status} <> 'active' OR ${t.endReason} IS NULL`),
    check(
      "enrollment_access_dates_check",
      sql`${t.accessEndsOn} IS NULL OR ${t.accessEndsOn} > ${t.accessStartsOn}`,
    ),
    // C4: one active enrolment per (student, course, intake).
    uniqueIndex("enrollment_one_active_no_intake_uq")
      .on(t.studentId, t.courseId)
      .where(sql`${t.status} = 'active' AND ${t.intakeId} IS NULL`),
    uniqueIndex("enrollment_one_active_per_intake_uq")
      .on(t.studentId, t.courseId, t.intakeId)
      .where(sql`${t.status} = 'active' AND ${t.intakeId} IS NOT NULL`),
    index("enrollment_student_idx").on(t.studentId),
    index("enrollment_course_idx").on(t.courseId),
  ],
);

export const scheduleSlot = pgTable(
  "schedule_slot",
  {
    id: pk(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    intakeId: uuid("intake_id"),
    /** ISO weekday: 1 = Monday ... 7 = Sunday. */
    weekday: integer("weekday").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    room: text("room"),
  },
  (t) => [
    foreignKey({
      name: "schedule_slot_intake_course_fk",
      columns: [t.intakeId, t.courseId],
      foreignColumns: [intake.id, intake.courseId],
    }),
    check("schedule_slot_weekday_check", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("schedule_slot_time_check", sql`${t.endsAt} > ${t.startsAt}`),
    index("schedule_slot_course_idx").on(t.courseId),
  ],
);

export const classSession = pgTable(
  "class_session",
  {
    id: pk(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    intakeId: uuid("intake_id"),
    sessionDate: day("session_date").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    topic: text("topic"),
    deliveryMode: text("delivery_mode").notNull().default("physical"),
    meetingProvider: text("meeting_provider"),
    meetingUrl: text("meeting_url"),
    meetingRef: text("meeting_ref"),
    status: text("status").notNull().default("scheduled"),
  },
  (t) => [
    foreignKey({
      name: "class_session_intake_course_fk",
      columns: [t.intakeId, t.courseId],
      foreignColumns: [intake.id, intake.courseId],
    }),
    oneOf("class_session_delivery_mode_check", t.deliveryMode, DELIVERY_MODES),
    oneOf("class_session_status_check", t.status, SESSION_STATUSES),
    check(
      "class_session_meeting_provider_check",
      sql`${t.meetingProvider} IS NULL OR ${t.meetingProvider} IN ('zoom', 'teams', 'other')`,
    ),
    check("class_session_time_check", sql`${t.endsAt} > ${t.startsAt}`),
    index("class_session_course_date_idx").on(t.courseId, t.sessionDate),
  ],
);

export const attendance = pgTable(
  "attendance",
  {
    id: pk(),
    sessionId: uuid("session_id")
      .notNull()
      .references((): AnyPgColumn => classSession.id),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    status: text("status").notNull(),
    attendedVia: text("attended_via"),
    markedVia: text("marked_via").notNull().default("manual"),
    note: text("note"),
    markedBy: uuid("marked_by").references((): AnyPgColumn => user.id),
    markedAt: tstz("marked_at").notNull().defaultNow(),
  },
  (t) => [
    unique("attendance_session_student_uq").on(t.sessionId, t.studentId),
    oneOf("attendance_status_check", t.status, ATTENDANCE_STATUSES),
    oneOf("attendance_marked_via_check", t.markedVia, MARKED_VIA),
    check(
      "attendance_attended_via_check",
      sql`${t.attendedVia} IS NULL OR ${t.attendedVia} IN ('physical', 'online')`,
    ),
    index("attendance_student_idx").on(t.studentId),
  ],
);
