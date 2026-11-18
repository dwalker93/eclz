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
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { course, enrollment } from "./academics";
import { file } from "./core";
import { createdAt, day, oneOf, pk, tstz } from "./helpers";
import { lecturer, student } from "./people";

export const EXAM_MODES = ["online_mcq", "paper"] as const;
export const EXAM_SCORING = ["best", "latest"] as const;
export const EXAM_VISIBILITY = ["immediate", "after_release", "manual"] as const;
export const EXAM_STATUSES = ["draft", "published", "closed"] as const;
export const ATTEMPT_STATUSES = ["in_progress", "submitted", "graded", "expired"] as const;
export const RESULT_SOURCES = ["attempt", "manual", "manual_override"] as const;

/** Marks and weights: numeric, returned by Drizzle as strings. */
const marks = (name: string) => numeric(name, { precision: 8, scale: 2 });

/** The lecturer's question bank. Edits never change published exams, which use frozen snapshots (G4). */
export const question = pgTable(
  "question",
  {
    id: pk(),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    body: text("body").notNull(),
    imageFileId: uuid("image_file_id").references((): AnyPgColumn => file.id),
    explanation: text("explanation"),
    defaultMarks: marks("default_marks").notNull().default("1"),
    createdAt: createdAt(),
  },
  (t) => [
    check("question_body_check", sql`length(btrim(${t.body})) > 0`),
    check("question_marks_check", sql`${t.defaultMarks} > 0`),
    index("question_lecturer_idx").on(t.lecturerId),
  ],
);

export const questionOption = pgTable(
  "question_option",
  {
    id: pk(),
    questionId: uuid("question_id")
      .notNull()
      .references((): AnyPgColumn => question.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("question_option_position_uq").on(t.questionId, t.position),
    check("question_option_body_check", sql`length(btrim(${t.body})) > 0`),
    check("question_option_position_check", sql`${t.position} >= 1`),
  ],
);

/**
 * Online MCQ or paper exam. It attaches to courses through exam_course, so branch-specific or shared
 * is just which courses it is attached to. Online exams need a window and an attempt limit; paper exams need a date.
 * Status moves draft -> published -> closed only (trigger in the phase 3 constraints migration).
 */
export const exam = pgTable(
  "exam",
  {
    id: pk(),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    title: text("title").notNull(),
    mode: text("mode").notNull(),
    examDate: day("exam_date"),
    /** Paper exams enter it directly. Online exams use the sum of question marks (set at publish). */
    maxMarks: marks("max_marks"),
    /** Share of this exam in an overall mark, if the buyer uses one. */
    weight: marks("weight"),
    opensAt: tstz("opens_at"),
    closesAt: tstz("closes_at"),
    /** null = no time limit inside the window. */
    timeLimitMinutes: integer("time_limit_minutes"),
    maxAttempts: integer("max_attempts"),
    attemptScoring: text("attempt_scoring").notNull().default("best"),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    /** true = an answer is final once chosen (it cannot be changed or cleared); false = answers can change until the attempt ends. */
    lockAnswers: boolean("lock_answers").notNull().default(false),
    resultsVisibility: text("results_visibility").notNull().default("after_release"),
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("exam_mode_check", t.mode, EXAM_MODES),
    oneOf("exam_scoring_check", t.attemptScoring, EXAM_SCORING),
    oneOf("exam_visibility_check", t.resultsVisibility, EXAM_VISIBILITY),
    oneOf("exam_status_check", t.status, EXAM_STATUSES),
    check("exam_title_check", sql`length(btrim(${t.title})) > 0`),
    check("exam_max_marks_check", sql`${t.maxMarks} IS NULL OR ${t.maxMarks} > 0`),
    check("exam_weight_check", sql`${t.weight} IS NULL OR ${t.weight} > 0`),
    check("exam_time_limit_check", sql`${t.timeLimitMinutes} IS NULL OR ${t.timeLimitMinutes} > 0`),
    check("exam_attempts_check", sql`${t.maxAttempts} IS NULL OR ${t.maxAttempts} >= 1`),
    check(
      "exam_window_check",
      sql`${t.opensAt} IS NULL OR ${t.closesAt} IS NULL OR ${t.closesAt} > ${t.opensAt}`,
    ),
    // Online: window and attempt limit required. Paper: date and total marks required, no online settings.
    check(
      "exam_mode_fields_check",
      sql`(${t.mode} = 'online_mcq' AND ${t.opensAt} IS NOT NULL AND ${t.closesAt} IS NOT NULL AND ${t.maxAttempts} IS NOT NULL) OR (${t.mode} = 'paper' AND ${t.examDate} IS NOT NULL AND ${t.maxMarks} IS NOT NULL AND ${t.opensAt} IS NULL AND ${t.closesAt} IS NULL AND ${t.timeLimitMinutes} IS NULL AND ${t.maxAttempts} IS NULL)`,
    ),
    index("exam_lecturer_idx").on(t.lecturerId),
  ],
);

export const examCourse = pgTable(
  "exam_course",
  {
    examId: uuid("exam_id")
      .notNull()
      .references((): AnyPgColumn => exam.id),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
  },
  (t) => [primaryKey({ name: "exam_course_pk", columns: [t.examId, t.courseId] }), index("exam_course_course_idx").on(t.courseId)],
);

/**
 * A question placed in an exam. snapshot holds the question, options and correct flags frozen at publish (G4).
 * While the exam is a draft the snapshot may be empty. After publish the rows cannot change (trigger).
 */
export const examQuestion = pgTable(
  "exam_question",
  {
    id: pk(),
    examId: uuid("exam_id")
      .notNull()
      .references((): AnyPgColumn => exam.id),
    questionId: uuid("question_id")
      .notNull()
      .references((): AnyPgColumn => question.id),
    marks: marks("marks").notNull(),
    position: integer("position").notNull(),
    snapshot: jsonb("snapshot"),
  },
  (t) => [
    unique("exam_question_id_exam_uq").on(t.id, t.examId),
    unique("exam_question_position_uq").on(t.examId, t.position),
    unique("exam_question_question_uq").on(t.examId, t.questionId),
    check("exam_question_marks_check", sql`${t.marks} > 0`),
    check("exam_question_position_check", sql`${t.position} >= 1`),
  ],
);

/**
 * One attempt by a student. The attempt limit applies per (exam, student) across all attached courses (G2),
 * and the enrolment used must be the student's, in a course the exam is attached to (G3).
 */
export const examAttempt = pgTable(
  "exam_attempt",
  {
    id: pk(),
    examId: uuid("exam_id").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    enrollmentId: uuid("enrollment_id").notNull(),
    /** The enrolment's course, repeated so a composite foreign key can prove the exam is attached to it. */
    courseId: uuid("course_id").notNull(),
    attemptNo: integer("attempt_no").notNull(),
    startedAt: tstz("started_at").notNull().defaultNow(),
    submittedAt: tstz("submitted_at"),
    score: marks("score"),
    status: text("status").notNull().default("in_progress"),
  },
  (t) => [
    unique("exam_attempt_no_uq").on(t.examId, t.studentId, t.attemptNo),
    unique("exam_attempt_id_exam_uq").on(t.id, t.examId),
    unique("exam_attempt_id_exam_student_uq").on(t.id, t.examId, t.studentId),
    foreignKey({
      name: "exam_attempt_exam_course_fk",
      columns: [t.examId, t.courseId],
      foreignColumns: [examCourse.examId, examCourse.courseId],
    }),
    foreignKey({
      name: "exam_attempt_enrollment_fk",
      columns: [t.enrollmentId, t.studentId, t.courseId],
      foreignColumns: [enrollment.id, enrollment.studentId, enrollment.courseId],
    }),
    oneOf("exam_attempt_status_check", t.status, ATTEMPT_STATUSES),
    check("exam_attempt_no_check", sql`${t.attemptNo} >= 1`),
    check("exam_attempt_score_check", sql`${t.score} IS NULL OR ${t.score} >= 0`),
    check(
      "exam_attempt_submitted_check",
      sql`(${t.status} IN ('submitted', 'graded') AND ${t.submittedAt} IS NOT NULL) OR (${t.status} = 'in_progress' AND ${t.submittedAt} IS NULL) OR ${t.status} = 'expired'`,
    ),
    check("exam_attempt_graded_check", sql`${t.status} <> 'graded' OR ${t.score} IS NOT NULL`),
    // A student has one running attempt per exam.
    uniqueIndex("exam_attempt_one_running_uq")
      .on(t.examId, t.studentId)
      .where(sql`${t.status} = 'in_progress'`),
    index("exam_attempt_student_idx").on(t.studentId),
  ],
);

/** Answers refer to option keys inside the exam_question snapshot, and grading uses only the snapshot (G5). */
export const attemptAnswer = pgTable(
  "attempt_answer",
  {
    id: pk(),
    attemptId: uuid("attempt_id").notNull(),
    examId: uuid("exam_id").notNull(),
    examQuestionId: uuid("exam_question_id").notNull(),
    /** null = left blank. */
    selectedOptionKey: text("selected_option_key"),
    isCorrect: boolean("is_correct"),
    marksAwarded: marks("marks_awarded"),
  },
  (t) => [
    unique("attempt_answer_uq").on(t.attemptId, t.examQuestionId),
    // The attempt and the question must belong to the same exam.
    foreignKey({
      name: "attempt_answer_attempt_exam_fk",
      columns: [t.attemptId, t.examId],
      foreignColumns: [examAttempt.id, examAttempt.examId],
    }),
    foreignKey({
      name: "attempt_answer_question_exam_fk",
      columns: [t.examQuestionId, t.examId],
      foreignColumns: [examQuestion.id, examQuestion.examId],
    }),
    check("attempt_answer_marks_check", sql`${t.marksAwarded} IS NULL OR ${t.marksAwarded} >= 0`),
  ],
);

/**
 * Calculated summary, unique per (exam, student) (G7). source = attempt for online exams, manual for paper,
 * manual_override after a released online result is changed. The exam-mode and release rules are triggers (G7, G8).
 */
export const examResult = pgTable(
  "exam_result",
  {
    id: pk(),
    examId: uuid("exam_id")
      .notNull()
      .references((): AnyPgColumn => exam.id),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    /** The enrolment the result is recorded against, with its course. Both or neither. */
    enrollmentId: uuid("enrollment_id"),
    courseId: uuid("course_id"),
    /** The counted attempt. null for paper exams. */
    attemptId: uuid("attempt_id"),
    marks: marks("marks").notNull(),
    grade: text("grade"),
    remarks: text("remarks"),
    source: text("source").notNull(),
    /** Final release, only after the exam is closed (G8). */
    releasedAt: tstz("released_at"),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("exam_result_uq").on(t.examId, t.studentId),
    foreignKey({
      name: "exam_result_attempt_fk",
      columns: [t.attemptId, t.examId, t.studentId],
      foreignColumns: [examAttempt.id, examAttempt.examId, examAttempt.studentId],
    }),
    foreignKey({
      name: "exam_result_enrollment_fk",
      columns: [t.enrollmentId, t.studentId, t.courseId],
      foreignColumns: [enrollment.id, enrollment.studentId, enrollment.courseId],
    }),
    foreignKey({
      name: "exam_result_exam_course_fk",
      columns: [t.examId, t.courseId],
      foreignColumns: [examCourse.examId, examCourse.courseId],
    }),
    oneOf("exam_result_source_check", t.source, RESULT_SOURCES),
    check("exam_result_marks_check", sql`${t.marks} >= 0`),
    check("exam_result_enrollment_pair_check", sql`(${t.enrollmentId} IS NULL) = (${t.courseId} IS NULL)`),
    // attempt results point at their attempt, manual ones do not.
    check(
      "exam_result_source_attempt_check",
      sql`(${t.source} = 'attempt' AND ${t.attemptId} IS NOT NULL) OR (${t.source} = 'manual' AND ${t.attemptId} IS NULL) OR ${t.source} = 'manual_override'`,
    ),
    index("exam_result_student_idx").on(t.studentId),
  ],
);
