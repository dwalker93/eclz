import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  attemptAnswer,
  course,
  enrollment,
  exam,
  examAttempt,
  examCourse,
  examQuestion,
  examResult,
  lecturer,
  question,
  questionOption,
  student,
} from "@workspace/db/schema";
import { fromCents, toCents } from "@workspace/db/money";
import { accessState } from "./access";
import { writeAudit, isConstraintError } from "./audit";
import { loadOrganization, todayFor } from "./lookups";
import { queueNotifications, resolveRecipients } from "./notifications";
import { gateModule, isRootAdmin, requireLecturerPermission, requireResource } from "./authorization";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

type ExamRow = typeof exam.$inferSelect;
type AttemptRow = typeof examAttempt.$inferSelect;

// ---- snapshot and grading (G4, G5): pure

export interface SnapshotOption {
  key: string;
  body: string;
  isCorrect: boolean;
}
export interface QuestionSnapshot {
  body: string;
  imageFileId: string | null;
  explanation: string | null;
  options: SnapshotOption[];
}

/** Option keys are letters by position: A, B, C ... (up to 26 options). */
export const optionKey = (index: number) => String.fromCharCode(65 + index);

export function buildSnapshot(q: { body: string; imageFileId: string | null; explanation: string | null }, options: { body: string; isCorrect: boolean; position: number }[]): QuestionSnapshot {
  return {
    body: q.body,
    imageFileId: q.imageFileId,
    explanation: q.explanation,
    options: [...options].sort((a, b) => a.position - b.position).map((o, i) => ({ key: optionKey(i), body: o.body, isCorrect: o.isCorrect })),
  };
}

/** What a student may see: no correct flags and no explanation. */
export function studentView(s: QuestionSnapshot): { body: string; imageFileId: string | null; options: { key: string; body: string }[] } {
  return { body: s.body, imageFileId: s.imageFileId, options: s.options.map((o) => ({ key: o.key, body: o.body })) };
}

/** G5: grades one answer from the snapshot alone. A blank or unknown key scores zero. Marks are cents-exact strings. */
export function gradeAnswer(snapshot: QuestionSnapshot, selectedKey: string | null, marks: string): { isCorrect: boolean; marksAwarded: string } {
  const picked = selectedKey ? snapshot.options.find((o) => o.key === selectedKey) : undefined;
  const isCorrect = picked?.isCorrect === true;
  return { isCorrect, marksAwarded: isCorrect ? fromCents(toCents(marks)) : "0.00" };
}

/** The attempt that counts for a result: best score (earliest on a tie) or the latest attempt number. */
export function pickCounted<T extends { attemptNo: number; score: string }>(attempts: T[], scoring: "best" | "latest"): T | null {
  if (attempts.length === 0) return null;
  if (scoring === "latest") return attempts.reduce((a, b) => (b.attemptNo > a.attemptNo ? b : a));
  return attempts.reduce((a, b) => (toCents(b.score) > toCents(a.score) || (toCents(b.score) === toCents(a.score) && b.attemptNo < a.attemptNo) ? b : a));
}

/** G6: an attempt ends at the time limit or the closing time, whichever is first. */
export function attemptDeadline(startedAt: Date, timeLimitMinutes: number | null, closesAt: Date): Date {
  const byLimit = timeLimitMinutes ? new Date(startedAt.getTime() + timeLimitMinutes * 60_000) : null;
  return byLimit && byLimit < closesAt ? byLimit : closesAt;
}

/** A repeatable shuffle for one attempt, so a refresh keeps the same order. */
export function seededOrder<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ---- service

export interface QuestionInput {
  body: string;
  options: { body: string; isCorrect: boolean }[];
  defaultMarks?: string | number;
  explanation?: string;
  imageFileId?: string;
}

/** The largest total a numeric(8,2) column can hold, in cents: an exam's total marks are the sum of its question marks. */
const MAX_TOTAL_CENTS = 99_999_999;
const totalTooLarge = () => new ServiceError("exam_invalid", "The questions add up to more marks than an exam can hold (999999.99).");

function checkQuestion(input: QuestionInput) {
  if (!input.body?.trim()) throw new ServiceError("question_invalid", "The question text is required.");
  if (input.options.length < 2 || input.options.length > 26) throw new ServiceError("question_invalid", "A question needs 2 to 26 options.");
  if (input.options.some((o) => !o.body?.trim())) throw new ServiceError("question_invalid", "Every option needs text.");
  if (input.options.filter((o) => o.isCorrect).length !== 1) throw new ServiceError("question_invalid", "Exactly one option must be correct.");
  const m = input.defaultMarks ?? 1;
  if (!(Number(m) > 0)) throw new ServiceError("question_invalid", "Marks must be above zero.");
}

function buildExamService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function loadExam(tx: Tx, examId: string, lock = false): Promise<ExamRow> {
    const q = tx.select().from(exam).where(eq(exam.id, examId));
    const [e] = await (lock ? q.for("update") : q);
    if (!e) throw new ServiceError("not_found", "Exam not found.");
    return e;
  }

  async function snapshots(tx: Tx, examId: string) {
    const rows = await tx.select().from(examQuestion).where(eq(examQuestion.examId, examId)).orderBy(asc(examQuestion.position));
    return rows.map((r) => ({ ...r, snap: r.snapshot as QuestionSnapshot }));
  }

  /** Grades the saved answers of a running attempt and ends it: `graded` when the student submitted, `expired` when time ran out or the exam closed. */
  async function finish(tx: Tx, attempt: AttemptRow, ex: ExamRow, endedAt: Date, status: "graded" | "expired") {
    const qs = await snapshots(tx, ex.id);
    const saved = await tx.select().from(attemptAnswer).where(eq(attemptAnswer.attemptId, attempt.id));
    const byQ = new Map(saved.map((a) => [a.examQuestionId, a]));
    let total = 0;
    for (const q of qs) {
      const a = byQ.get(q.id);
      const g = gradeAnswer(q.snap, a?.selectedOptionKey ?? null, q.marks);
      total += toCents(g.marksAwarded);
      if (a) await tx.update(attemptAnswer).set({ isCorrect: g.isCorrect, marksAwarded: g.marksAwarded }).where(eq(attemptAnswer.id, a.id));
      else
        await tx.insert(attemptAnswer).values({ attemptId: attempt.id, examId: ex.id, examQuestionId: q.id, selectedOptionKey: null, isCorrect: false, marksAwarded: "0.00" });
    }
    await tx.update(examAttempt).set({ status, score: fromCents(total), submittedAt: endedAt }).where(eq(examAttempt.id, attempt.id));
    await recomputeResult(tx, ex, attempt.studentId);
    return fromCents(total);
  }

  /** G7: the result of an online exam follows its counted attempt until it is released or manually overridden. */
  async function recomputeResult(tx: Tx, ex: ExamRow, studentId: string) {
    const [existing] = await tx.select().from(examResult).where(and(eq(examResult.examId, ex.id), eq(examResult.studentId, studentId)));
    if (existing && (existing.releasedAt || existing.source === "manual_override")) return;
    const attempts = (await tx.select().from(examAttempt).where(and(eq(examAttempt.examId, ex.id), eq(examAttempt.studentId, studentId), inArray(examAttempt.status, ["graded", "expired"])))).filter((a) => a.score !== null);
    const counted = pickCounted(attempts.map((a) => ({ ...a, score: a.score! })), ex.attemptScoring as "best" | "latest");
    if (!counted) return;
    const values = { marks: counted.score, attemptId: counted.id, enrollmentId: counted.enrollmentId, courseId: counted.courseId, source: "attempt", updatedAt: now() };
    if (existing) await tx.update(examResult).set(values).where(eq(examResult.id, existing.id));
    else await tx.insert(examResult).values({ examId: ex.id, studentId, ...values });
  }

  /** When a running attempt must end now, and at what time it is recorded as ended: past its deadline (the deadline), or the exam closed (now). */
  function endOf(a: AttemptRow, ex: ExamRow): Date | null {
    const deadline = attemptDeadline(a.startedAt, ex.timeLimitMinutes, ex.closesAt!);
    if (now() >= deadline) return deadline;
    return ex.status === "closed" ? now() : null;
  }

  /**
   * Ends a running attempt that is past its deadline. Its own transaction, so it commits before an operation that then refuses. A student's
   * call passes their id and the attempt is locked and selected by both ids, so another student's attempt is never written to; only the
   * scheduled job calls it with the attempt id alone.
   */
  async function finalizeLate(attemptId: string, studentId?: string) {
    await db.transaction(async (tx) => {
      const [a] = await tx
        .select()
        .from(examAttempt)
        .where(studentId === undefined ? eq(examAttempt.id, attemptId) : and(eq(examAttempt.id, attemptId), eq(examAttempt.studentId, studentId)))
        .for("update");
      if (!a || a.status !== "in_progress") return;
      const ex = await loadExam(tx, a.examId);
      const endedAt = endOf(a, ex);
      if (endedAt) await finish(tx, a, ex, endedAt, "expired");
    });
  }

  /** G9 for an attempt: its score is shown on the same terms as the exam result: always for `immediate`, otherwise only once the student's result is released. */
  async function scoreVisible(tx: Tx, ex: ExamRow, studentId: string): Promise<boolean> {
    if (ex.resultsVisibility === "immediate") return true;
    const [r] = await tx.select({ releasedAt: examResult.releasedAt }).from(examResult).where(and(eq(examResult.examId, ex.id), eq(examResult.studentId, studentId)));
    return !!r?.releasedAt;
  }

  function paperFor(ex: ExamRow, attempt: AttemptRow, qs: Awaited<ReturnType<typeof snapshots>>, answers: (typeof attemptAnswer.$inferSelect)[]) {
    const ordered = ex.shuffleQuestions ? seededOrder(qs, attempt.id) : qs;
    const byQ = new Map(answers.map((a) => [a.examQuestionId, a.selectedOptionKey]));
    return {
      attemptId: attempt.id,
      examId: ex.id,
      title: ex.title,
      lockAnswers: ex.lockAnswers,
      deadline: attemptDeadline(attempt.startedAt, ex.timeLimitMinutes, ex.closesAt!),
      questions: ordered.map((q) => ({ examQuestionId: q.id, marks: q.marks, ...studentView(q.snap), selectedOptionKey: byQ.get(q.id) ?? null })),
    };
  }

  return {
    // ---- question bank

    /** The question belongs to `lecturerId`. `actor` (a user id) must be that lecturer or a root administrator; null is a trusted system call. */
    async createQuestion(input: QuestionInput & { lecturerId: string; actor: string | null }) {
      checkQuestion(input);
      return db.transaction(async (tx) => {
        if (input.actor !== null) {
          const [l] = await tx.select({ userId: lecturer.userId }).from(lecturer).where(eq(lecturer.id, input.lecturerId));
          // Ownership alone is not enough: the lecturer role must still carry exams.manage (as updateQuestion requires), so revoking the role closes this
          // even while the portal flag stays on.
          const own = !!l && l.userId === input.actor && (await requireLecturerPermission(tx, input.actor, "exams.manage").then(() => true, () => false));
          if (!own && !(await isRootAdmin(tx, input.actor))) throw new ServiceError("forbidden", "Only the lecturer or a root administrator can add their questions.");
        }
        const [l] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.id, input.lecturerId));
        if (!l) throw new ServiceError("not_found", "Lecturer not found.");
        const [q] = await tx
          .insert(question)
          .values({ lecturerId: input.lecturerId, body: input.body.trim(), imageFileId: input.imageFileId ?? null, explanation: input.explanation ?? null, defaultMarks: String(input.defaultMarks ?? 1) })
          .returning();
        await tx.insert(questionOption).values(input.options.map((o, i) => ({ questionId: q!.id, body: o.body.trim(), isCorrect: o.isCorrect, position: i + 1 })));
        return q!;
      });
    },

    /** Replaces a question's text and options. Published exams keep their frozen copy (G4); drafts pick the change up at publish. */
    async updateQuestion(input: QuestionInput & { questionId: string; actor: string | null }) {
      checkQuestion(input);
      return db.transaction(async (tx) => {
        if (input.actor !== null) await requireResource(tx, input.actor, "exams.manage", { type: "question", id: input.questionId });
        const [q] = await tx.select().from(question).where(eq(question.id, input.questionId)).for("update");
        if (!q) throw new ServiceError("not_found", "Question not found.");
        await tx.update(question).set({ body: input.body.trim(), imageFileId: input.imageFileId ?? null, explanation: input.explanation ?? null, defaultMarks: String(input.defaultMarks ?? q.defaultMarks) }).where(eq(question.id, q.id));
        await tx.delete(questionOption).where(eq(questionOption.questionId, q.id));
        await tx.insert(questionOption).values(input.options.map((o, i) => ({ questionId: q.id, body: o.body.trim(), isCorrect: o.isCorrect, position: i + 1 })));
        return q.id;
      });
    },

    // ---- exam setup

    /**
     * Creates a draft. Online MCQ needs an opening and closing time (closing after opening) and an attempt limit; paper needs an exam date
     * and total marks and no online settings. At least one course must be attached.
     */
    async createExam(input: {
      lecturerId: string;
      title: string;
      mode: "online_mcq" | "paper";
      courseIds: string[];
      examDate?: string;
      maxMarks?: string | number;
      weight?: string | number;
      opensAt?: Date;
      closesAt?: Date;
      timeLimitMinutes?: number;
      maxAttempts?: number;
      attemptScoring?: "best" | "latest";
      shuffleQuestions?: boolean;
      /** true: an answer is final once chosen. false (default): answers can change until the attempt ends. */
      lockAnswers?: boolean;
      resultsVisibility?: "immediate" | "after_release" | "manual";
    }) {
      if (!input.title?.trim()) throw new ServiceError("exam_invalid", "The title is required.");
      if (input.courseIds.length === 0) throw new ServiceError("exam_invalid", "Attach the exam to at least one course.");
      if (input.mode === "online_mcq") {
        if (!input.opensAt || !input.closesAt) throw new ServiceError("exam_invalid", "An online exam needs an opening and closing time.");
        if (input.closesAt <= input.opensAt) throw new ServiceError("exam_invalid", "The exam must close after it opens.");
        if (!Number.isInteger(input.maxAttempts) || (input.maxAttempts ?? 0) < 1) throw new ServiceError("exam_invalid", "An online exam needs an attempt limit of at least 1.");
        if (input.timeLimitMinutes !== undefined && (!Number.isInteger(input.timeLimitMinutes) || input.timeLimitMinutes < 1)) throw new ServiceError("exam_invalid", "The time limit must be a whole number of minutes.");
        if (input.examDate || input.maxMarks !== undefined) throw new ServiceError("exam_invalid", "An online exam takes its total marks from its questions.");
      } else {
        if (!input.examDate || input.maxMarks === undefined || !(Number(input.maxMarks) > 0)) throw new ServiceError("exam_invalid", "A paper exam needs a date and total marks.");
        if (input.opensAt || input.closesAt || input.timeLimitMinutes !== undefined || input.maxAttempts !== undefined) throw new ServiceError("exam_invalid", "A paper exam has no online settings.");
      }
      return db.transaction(async (tx) => {
        const [l] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.id, input.lecturerId));
        if (!l) throw new ServiceError("not_found", "Lecturer not found.");
        const courses = await tx.select({ id: course.id }).from(course).where(inArray(course.id, input.courseIds));
        if (courses.length !== new Set(input.courseIds).size) throw new ServiceError("not_found", "A course was not found.");
        const [e] = await tx
          .insert(exam)
          .values({
            lecturerId: input.lecturerId,
            title: input.title.trim(),
            mode: input.mode,
            examDate: input.examDate ?? null,
            maxMarks: input.maxMarks === undefined ? null : String(input.maxMarks),
            weight: input.weight === undefined ? null : String(input.weight),
            opensAt: input.opensAt ?? null,
            closesAt: input.closesAt ?? null,
            timeLimitMinutes: input.timeLimitMinutes ?? null,
            maxAttempts: input.maxAttempts ?? null,
            attemptScoring: input.attemptScoring ?? "best",
            shuffleQuestions: input.shuffleQuestions ?? false,
            lockAnswers: input.lockAnswers ?? false,
            resultsVisibility: input.resultsVisibility ?? "after_release",
          })
          .returning();
        await tx.insert(examCourse).values([...new Set(input.courseIds)].map((courseId) => ({ examId: e!.id, courseId })));
        return e!;
      });
    },

    /** Sets the questions of a draft online exam, in order. Questions must be the exam lecturer's. Marks default to the question's own. */
    async setQuestions(input: { examId: string; questions: { questionId: string; marks?: string | number }[] }) {
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId, true);
        if (ex.status !== "draft") throw new ServiceError("exam_not_draft", "Only a draft exam can change its questions.");
        if (ex.mode !== "online_mcq") throw new ServiceError("exam_invalid", "A paper exam has no questions.");
        const ids = input.questions.map((q) => q.questionId);
        if (new Set(ids).size !== ids.length) throw new ServiceError("question_invalid", "A question appears twice.");
        const bank = ids.length ? await tx.select().from(question).where(inArray(question.id, ids)) : [];
        if (bank.length !== ids.length) throw new ServiceError("not_found", "A question was not found.");
        if (bank.some((q) => q.lecturerId !== ex.lecturerId)) throw new ServiceError("question_invalid", "A question belongs to another lecturer.");
        const byId = new Map(bank.map((q) => [q.id, q]));
        // The total, with the bank's defaults for entries that give no marks, must fit before anything is replaced.
        let total = 0;
        for (const q of input.questions) {
          const m = String(q.marks ?? byId.get(q.questionId)!.defaultMarks);
          if (!(Number(m) > 0)) throw new ServiceError("question_invalid", "Marks must be above zero.");
          total += toCents(m);
        }
        if (total > MAX_TOTAL_CENTS) throw totalTooLarge();
        await tx.delete(examQuestion).where(eq(examQuestion.examId, ex.id));
        for (const [i, q] of input.questions.entries()) {
          const marks = String(q.marks ?? byId.get(q.questionId)!.defaultMarks);
          if (!(Number(marks) > 0)) throw new ServiceError("question_invalid", "Marks must be above zero.");
          await tx.insert(examQuestion).values({ examId: ex.id, questionId: q.questionId, marks, position: i + 1 });
        }
        return input.questions.length;
      });
    },

    /**
     * G4: publishes a draft. Online: every question and its options are copied into `exam_question.snapshot` (correct flags included), the
     * exam's total marks become the sum of the question marks, and enrolled students are notified (`exam_published`). Paper: just the status.
     * From here the questions cannot change.
     */
    async publishExam(input: { examId: string }) {
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId, true);
        if (ex.status !== "draft") throw new ServiceError("exam_not_draft", "The exam is already published.");
        let maxMarks = ex.maxMarks;
        if (ex.mode === "online_mcq") {
          const qs = await tx.select().from(examQuestion).where(eq(examQuestion.examId, ex.id));
          if (qs.length === 0) throw new ServiceError("exam_invalid", "Add at least one question before publishing.");
          // A draft saved before the total was checked can still be out of range.
          if (qs.reduce((sum, r) => sum + toCents(r.marks), 0) > MAX_TOTAL_CENTS) throw totalTooLarge();
          let total = 0;
          for (const eq_ of qs) {
            const [q] = await tx.select().from(question).where(eq(question.id, eq_.questionId));
            const options = await tx.select().from(questionOption).where(eq(questionOption.questionId, eq_.questionId));
            await tx.update(examQuestion).set({ snapshot: buildSnapshot(q!, options) }).where(eq(examQuestion.id, eq_.id));
            total += toCents(eq_.marks);
          }
          maxMarks = fromCents(total);
        }
        const [row] = await tx.update(exam).set({ status: "published", maxMarks }).where(eq(exam.id, ex.id)).returning();

        // tell the students who can reach it
        const courseIds = (await tx.select({ id: examCourse.courseId }).from(examCourse).where(eq(examCourse.examId, ex.id))).map((c) => c.id);
        const studentIds = (await tx.selectDistinct({ id: enrollment.studentId }).from(enrollment).where(and(inArray(enrollment.courseId, courseIds), eq(enrollment.status, "active")))).map((r) => r.id).sort();
        const org = await loadOrganization(tx);
        let notifications = 0;
        for (const sid of studentIds) {
          const { userIds } = await resolveRecipients(tx, org, sid);
          notifications += await queueNotifications(tx, org, {
            event: "exam_published",
            userIds,
            items: [{ eventKey: `exam:${ex.id}`, payload: { examTitle: ex.title, examId: ex.id, opensAt: ex.opensAt?.toISOString() ?? null, closesAt: ex.closesAt?.toISOString() ?? null, examDate: ex.examDate } }],
            at: now(),
          });
        }
        return { exam: row!, notifications };
      });
    },

    /**
     * Closes a published exam. Attempts still running are ended on the spot (graded from their saved answers, status `expired`), so
     * nothing can change a result afterwards (G8).
     */
    async closeExam(input: { examId: string }) {
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId, true);
        if (ex.status !== "published") throw new ServiceError("exam_not_published", "Only a published exam can be closed.");
        const running = await tx.select().from(examAttempt).where(and(eq(examAttempt.examId, ex.id), eq(examAttempt.status, "in_progress"))).orderBy(asc(examAttempt.id)).for("update");
        for (const a of running) {
          const deadline = attemptDeadline(a.startedAt, ex.timeLimitMinutes, ex.closesAt!);
          await finish(tx, a, ex, now() >= deadline ? deadline : now(), "expired");
        }
        const [row] = await tx.update(exam).set({ status: "closed" }).where(eq(exam.id, ex.id)).returning();
        return { exam: row!, expired: running.length };
      });
    },

    // ---- taking an exam (online)

    /**
     * Starts an attempt, or resumes the running one. G1: the student needs effective access (C8) in at least one attached course; that
     * enrolment is recorded on the attempt (G3). G6: server time must be inside the window. G2: the attempt limit counts every attempt of the
     * student in this exam, across courses. Returns the paper without correct answers.
     */
    async startAttempt(input: { examId: string; studentId: string; enrollmentId?: string }) {
      await db
        .select({ id: examAttempt.id })
        .from(examAttempt)
        .where(and(eq(examAttempt.examId, input.examId), eq(examAttempt.studentId, input.studentId), eq(examAttempt.status, "in_progress")))
        .then((rows) => Promise.all(rows.map((r) => finalizeLate(r.id, input.studentId))));
      try {
        return await db.transaction(async (tx) => {
          // closeExam takes this same lock, so starting and closing serialize.
          const ex = await loadExam(tx, input.examId, true);
          if (ex.mode !== "online_mcq") throw new ServiceError("exam_invalid", "This is a paper exam.");
          if (ex.status !== "published") throw new ServiceError("exam_not_published", "The exam is not open.");
          const at = now();
          if (at < ex.opensAt! || at >= ex.closesAt!) throw new ServiceError("exam_not_open", "The exam is outside its opening window.");
          const [stu] = await tx.select().from(student).where(eq(student.id, input.studentId));
          if (!stu) throw new ServiceError("not_found", "Student not found.");
          if (stu.status !== "active") throw new ServiceError("student_not_eligible", "The student is not active.");

          const today = await todayFor(tx, at);
          const attached = (await tx.select({ id: examCourse.courseId }).from(examCourse).where(eq(examCourse.examId, ex.id))).map((c) => c.id);
          const enrols = await tx.select().from(enrollment).where(and(eq(enrollment.studentId, stu.id), inArray(enrollment.courseId, attached))).orderBy(asc(enrollment.id));
          const accessible = enrols.filter((e) => accessState(e, today).allowed);
          if (accessible.length === 0) throw new ServiceError("student_not_eligible", "The student has no access to any course this exam belongs to.");

          const qs = await snapshots(tx, ex.id);
          const [running] = await tx.select().from(examAttempt).where(and(eq(examAttempt.examId, ex.id), eq(examAttempt.studentId, stu.id), eq(examAttempt.status, "in_progress")));
          if (running) {
            const answers = await tx.select().from(attemptAnswer).where(eq(attemptAnswer.attemptId, running.id));
            return { resumed: true, paper: paperFor(ex, running, qs, answers) };
          }

          const enr = accessible.find((e) => !input.enrollmentId || e.id === input.enrollmentId);
          if (!enr) throw new ServiceError("student_not_eligible", "The student has no access to any course this exam belongs to.");

          const prior = await tx.select({ n: examAttempt.attemptNo }).from(examAttempt).where(and(eq(examAttempt.examId, ex.id), eq(examAttempt.studentId, stu.id))).orderBy(desc(examAttempt.attemptNo));
          if (prior.length >= ex.maxAttempts!) throw new ServiceError("attempt_limit_reached", "No attempts left.");
          const [attempt] = await tx
            .insert(examAttempt)
            .values({ examId: ex.id, studentId: stu.id, enrollmentId: enr.id, courseId: enr.courseId, attemptNo: (prior[0]?.n ?? 0) + 1, startedAt: at })
            .returning();
          return { resumed: false, paper: paperFor(ex, attempt!, qs, []) };
        });
      } catch (err) {
        // two starts at once: the unique indexes decide, the loser sees a clear error
        if (isConstraintError(err, "exam_attempt_one_running_uq") || isConstraintError(err, "exam_attempt_no_uq")) {
          throw new ServiceError("attempt_limit_reached", "An attempt was just started for this exam.");
        }
        throw err;
      }
    },

    /** The student's own view of an attempt (never anyone else's). */
    async getAttempt(input: { attemptId: string; studentId: string }) {
      await finalizeLate(input.attemptId, input.studentId);
      return db.transaction(async (tx) => {
        const [a] = await tx.select().from(examAttempt).where(and(eq(examAttempt.id, input.attemptId), eq(examAttempt.studentId, input.studentId)));
        if (!a) throw new ServiceError("not_found", "Attempt not found.");
        const ex = await loadExam(tx, a.examId);
        const answers = await tx.select().from(attemptAnswer).where(eq(attemptAnswer.attemptId, a.id));
        // The score follows the exam's result visibility (G9): hidden while an after_release or manual result is unreleased.
        const showScore = a.status !== "in_progress" && (await scoreVisible(tx, ex, a.studentId));
        return { status: a.status, score: showScore ? a.score : null, scoreHidden: a.status !== "in_progress" && !showScore, paper: paperFor(ex, a, await snapshots(tx, ex.id), answers) };
      });
    },

    /** Saves answers (G5: the key must exist in the snapshot; null clears). Refused when the attempt is over or time has run out (G6). */
    async saveAnswers(input: { attemptId: string; studentId: string; answers: { examQuestionId: string; selectedOptionKey: string | null }[] }) {
      await finalizeLate(input.attemptId, input.studentId);
      const saved = await db.transaction(async (tx) => {
        const [a] = await tx.select().from(examAttempt).where(and(eq(examAttempt.id, input.attemptId), eq(examAttempt.studentId, input.studentId))).for("update");
        if (!a) throw new ServiceError("not_found", "Attempt not found.");
        if (a.status !== "in_progress") throw new ServiceError(a.status === "expired" ? "attempt_time_over" : "attempt_not_running", "This attempt has ended.");
        const ex = await loadExam(tx, a.examId);
        // G6 again, now that this transaction holds the attempt's lock: the deadline may have passed since the check above. The expiry is
        // committed with this transaction and the refusal is thrown after it, so a retry sees the finished attempt.
        const endedAt = endOf(a, ex);
        if (endedAt) {
          await finish(tx, a, ex, endedAt, "expired");
          return "expired" as const;
        }
        const qs = new Map((await snapshots(tx, a.examId)).map((q) => [q.id, q]));
        for (const ans of input.answers) {
          const q = qs.get(ans.examQuestionId);
          if (!q) throw new ServiceError("not_found", "A question does not belong to this exam.");
          if (ans.selectedOptionKey !== null && !q.snap.options.some((o) => o.key === ans.selectedOptionKey)) throw new ServiceError("invalid_input", "That option does not exist for the question.");
          if (ex.lockAnswers) {
            // locked exam: the first choice is final. Saving the same choice again (a network retry) is fine.
            const [prev] = await tx.select().from(attemptAnswer).where(and(eq(attemptAnswer.attemptId, a.id), eq(attemptAnswer.examQuestionId, q.id)));
            if (prev?.selectedOptionKey && prev.selectedOptionKey !== ans.selectedOptionKey) {
              throw new ServiceError("answer_locked", "This exam does not allow changing an answer once it is chosen.");
            }
            if (prev?.selectedOptionKey) continue;
            if (ans.selectedOptionKey === null) continue;
          }
          await tx
            .insert(attemptAnswer)
            .values({ attemptId: a.id, examId: a.examId, examQuestionId: q.id, selectedOptionKey: ans.selectedOptionKey })
            .onConflictDoUpdate({ target: [attemptAnswer.attemptId, attemptAnswer.examQuestionId], set: { selectedOptionKey: ans.selectedOptionKey } });
        }
        return input.answers.length;
      });
      if (saved === "expired") throw new ServiceError("attempt_time_over", "This attempt has ended.");
      return saved;
    },

    /**
     * Submits an attempt and grades it from the snapshot (G5). The result is recomputed (G7) unless it is released or overridden.
     * Submitting twice returns the same score. An attempt that already ran out of time is returned as it was finalised (`expired`).
     */
    async submitAttempt(input: { attemptId: string; studentId: string }): Promise<{ status: string; score: string | null; alreadyFinished: boolean }> {
      await finalizeLate(input.attemptId, input.studentId);
      return db.transaction(async (tx) => {
        const [a] = await tx.select().from(examAttempt).where(and(eq(examAttempt.id, input.attemptId), eq(examAttempt.studentId, input.studentId))).for("update");
        if (!a) throw new ServiceError("not_found", "Attempt not found.");
        const ex = await loadExam(tx, a.examId);
        // The score is returned on the same terms as the exam result (G9): null while an after_release or manual result is unreleased.
        const shown = async (score: string | null) => ((await scoreVisible(tx, ex, a.studentId)) ? score : null);
        if (a.status !== "in_progress") return { status: a.status, score: await shown(a.score), alreadyFinished: true };
        // The deadline may have passed between the check above and this lock: such a submission ends the attempt as expired, not graded.
        const endedAt = endOf(a, ex);
        if (endedAt) return { status: "expired", score: await shown(await finish(tx, a, ex, endedAt, "expired")), alreadyFinished: true };
        const score = await finish(tx, a, ex, now(), "graded");
        return { status: "graded", score: await shown(score), alreadyFinished: false };
      });
    },

    /** Ends every running attempt that is past its deadline. Run it every few minutes; the student calls above do the same on demand. */
    async finalizeExpiredAttempts() {
      const running = await db.select({ id: examAttempt.id }).from(examAttempt).where(eq(examAttempt.status, "in_progress")).orderBy(asc(examAttempt.id));
      let done = 0;
      for (const r of running) {
        await finalizeLate(r.id);
        const [a] = await db.select({ status: examAttempt.status }).from(examAttempt).where(eq(examAttempt.id, r.id));
        if (a?.status !== "in_progress") done++;
      }
      return done;
    },

    // ---- results

    /** Paper exams (G7): enters or corrects marks. Marks cannot exceed the total. After release a reason is required and the change is audited (G8, J3). */
    async enterMarks(input: { examId: string; entries: { studentId: string; marks: string | number; grade?: string; remarks?: string }[]; actor: string | null; reason?: string; branchIds?: string[] }) {
      // `branchIds` limits the batch to results recorded in courses of those branches (a manager of one branch of a shared exam). Any entry outside it
      // fails the whole batch, which rolls back, so no marks are written.
      if (input.entries.length === 0) throw new ServiceError("invalid_input", "Nothing to enter.");
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId, true);
        if (ex.mode !== "paper") throw new ServiceError("exam_invalid", "Online exam results come from attempts.");
        if (ex.status === "draft") throw new ServiceError("exam_not_published", "Publish the exam before entering marks.");
        const attached = (await tx.select({ id: examCourse.courseId }).from(examCourse).where(eq(examCourse.examId, ex.id))).map((c) => c.id);
        // The attached courses inside the caller's branches: where a new result may be recorded, and what a stored result's course is checked against.
        const inScope = input.branchIds
          ? input.branchIds.length === 0
            ? []
            : (await tx.select({ id: course.id }).from(course).where(and(inArray(course.id, attached), inArray(course.branchId, input.branchIds)))).map((c) => c.id)
          : null;
        let written = 0;
        for (const e of input.entries) {
          const cents = toCents(typeof e.marks === "number" ? e.marks : String(e.marks));
          if (cents < 0 || cents > toCents(ex.maxMarks!)) throw new ServiceError("invalid_input", `Marks must be between 0 and ${ex.maxMarks}.`);
          const [existing] = await tx.select().from(examResult).where(and(eq(examResult.examId, ex.id), eq(examResult.studentId, e.studentId))).for("update");
          const candidates = (courseIds: string[]) =>
            courseIds.length === 0 ? Promise.resolve([]) : tx.select().from(enrollment).where(and(eq(enrollment.studentId, e.studentId), inArray(enrollment.courseId, courseIds), eq(enrollment.status, "active"))).orderBy(asc(enrollment.id)).limit(1);
          let [enr] = await candidates(inScope ?? attached);
          if (!enr && inScope && (await candidates(attached))[0]) throw new ServiceError("forbidden", "A student's result is in a branch you may not manage.");
          if (!enr) throw new ServiceError("student_not_enrolled", "A student is not enrolled in a course of this exam.");
          if (input.branchIds && existing?.courseId && !inScope!.includes(existing.courseId)) throw new ServiceError("forbidden", "A student's result is in a branch you may not manage.");
          const values = { marks: fromCents(cents), grade: e.grade ?? null, remarks: e.remarks ?? null, source: "manual", enrollmentId: existing?.enrollmentId ?? enr.id, courseId: existing?.courseId ?? enr.courseId, updatedAt: now() };
          if (existing?.releasedAt) {
            if (!input.reason?.trim()) throw new ServiceError("reason_required", "A reason is required to change a released result.");
            await tx.update(examResult).set(values).where(eq(examResult.id, existing.id));
            await writeAudit(tx, { actor: input.actor, action: "exam_result.edit_after_release", entityType: "exam_result", entityId: existing.id, before: { marks: existing.marks, grade: existing.grade, remarks: existing.remarks }, after: { marks: values.marks, grade: values.grade, remarks: values.remarks }, reason: input.reason });
          } else if (existing) {
            await tx.update(examResult).set(values).where(eq(examResult.id, existing.id));
          } else {
            await tx.insert(examResult).values({ examId: ex.id, studentId: e.studentId, ...values });
          }
          written++;
        }
        return written;
      });
    },

    /**
     * G8: changes a released online result. A reason is required, the change is audited, and the result becomes `manual_override` so no
     * recompute touches it again. Before release an online result cannot be edited by hand.
     */
    async overrideResult(input: { examId: string; studentId: string; marks: string | number; remarks?: string; reason: string; actor: string | null }) {
      if (!input.reason?.trim()) throw new ServiceError("reason_required", "A reason is required.");
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId, true);
        if (ex.mode !== "online_mcq") throw new ServiceError("exam_invalid", "Use enterMarks for paper exams.");
        const [r] = await tx.select().from(examResult).where(and(eq(examResult.examId, ex.id), eq(examResult.studentId, input.studentId))).for("update");
        if (!r) throw new ServiceError("not_found", "No result for this student.");
        if (!r.releasedAt) throw new ServiceError("exam_not_closed", "Only a released result can be overridden; before release it follows the attempts.");
        const cents = toCents(typeof input.marks === "number" ? input.marks : String(input.marks));
        if (cents < 0 || cents > toCents(ex.maxMarks!)) throw new ServiceError("invalid_input", `Marks must be between 0 and ${ex.maxMarks}.`);
        await tx.update(examResult).set({ marks: fromCents(cents), remarks: input.remarks ?? r.remarks, source: "manual_override", updatedAt: now() }).where(eq(examResult.id, r.id));
        await writeAudit(tx, { actor: input.actor, action: "exam_result.edit_after_release", entityType: "exam_result", entityId: r.id, before: { marks: r.marks, remarks: r.remarks, source: r.source }, after: { marks: fromCents(cents), remarks: input.remarks ?? r.remarks, source: "manual_override" }, reason: input.reason });
        return fromCents(cents);
      });
    },

    /**
     * G8: releases every result of a closed exam. An online exam whose closing time has passed is closed first (its running attempts end),
     * a paper exam must have been closed by hand. Already released results keep their release time. Returns how many were released.
     */
    async releaseResults(input: { examId: string }) {
      let ex = await db.transaction((tx) => loadExam(tx, input.examId));
      if (ex.status === "published" && ex.mode === "online_mcq" && ex.closesAt! <= now()) await this.closeExam({ examId: ex.id });
      return db.transaction(async (tx) => {
        ex = await loadExam(tx, input.examId, true);
        if (ex.status !== "closed") throw new ServiceError("exam_not_closed", "Close the exam before releasing results.");
        const rows = await tx.update(examResult).set({ releasedAt: now() }).where(and(eq(examResult.examId, ex.id), isNull(examResult.releasedAt))).returning({ id: examResult.id });
        return rows.length;
      });
    },

    /**
     * Daily job: closes online exams past their closing time and releases the results of closed exams whose visibility is `immediate` or
     * `after_release`. `manual` exams wait for `releaseResults`.
     */
    async runReleaseJob() {
      const due = await db.select().from(exam).where(and(inArray(exam.status, ["published", "closed"]), inArray(exam.resultsVisibility, ["immediate", "after_release"]))).orderBy(asc(exam.id));
      const out = { closed: 0, released: 0, errors: [] as { examId: string; message: string }[] };
      for (const ex of due) {
        try {
          const wasPublished = ex.status === "published";
          if (wasPublished && !(ex.mode === "online_mcq" && ex.closesAt! <= now())) continue;
          const n = await this.releaseResults({ examId: ex.id });
          if (wasPublished) out.closed++;
          out.released += n;
        } catch (err) {
          out.errors.push({ examId: ex.id, message: String((err as Error).message).slice(0, 300) });
        }
      }
      return out;
    },

    /**
     * G9: what a student (or a parent through the student) may see. `immediate`: the score as soon as it exists, marked provisional until
     * released. `after_release` and `manual`: nothing until released. Staff use `getResults`.
     */
    async getResultForStudent(input: { examId: string; studentId: string }) {
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId);
        const [r] = await tx.select().from(examResult).where(and(eq(examResult.examId, ex.id), eq(examResult.studentId, input.studentId)));
        if (!r) return { visible: false as const, reason: "no_result" as const };
        if (!r.releasedAt && ex.resultsVisibility !== "immediate") return { visible: false as const, reason: "not_released" as const };
        return { visible: true as const, provisional: !r.releasedAt, marks: r.marks, maxMarks: ex.maxMarks, grade: r.grade, remarks: r.remarks, releasedAt: r.releasedAt };
      });
    },

    /** Staff view: every result with the student and whether it is released, plus count, average and highest in marks. */
    async getResults(input: { examId: string; branchIds?: string[] }) {
      // `branchIds` keeps only results recorded in courses of those branches, in the rows and in the count, average and highest alike.
      return db.transaction(async (tx) => {
        const ex = await loadExam(tx, input.examId);
        if (input.branchIds && input.branchIds.length === 0) return { exam: ex, results: [], count: 0, average: null, highest: null };
        const rows = await tx
          .select({ r: examResult, name: student.fullName, studentNo: student.studentNo })
          .from(examResult)
          .innerJoin(student, eq(student.id, examResult.studentId))
          .leftJoin(course, eq(course.id, examResult.courseId))
          .where(and(eq(examResult.examId, ex.id), input.branchIds ? inArray(course.branchId, input.branchIds) : undefined))
          .orderBy(asc(student.fullName), asc(student.id));
        const cents = rows.map((x) => toCents(x.r.marks));
        return {
          exam: ex,
          results: rows.map((x) => ({ studentId: x.r.studentId, studentNo: x.studentNo, name: x.name, marks: x.r.marks, grade: x.r.grade, source: x.r.source, releasedAt: x.r.releasedAt })),
          count: rows.length,
          average: rows.length ? fromCents(Math.round(cents.reduce((a, b) => a + b, 0) / rows.length)) : null,
          highest: rows.length ? fromCents(Math.max(...cents)) : null,
        };
      });
    },
  };
}

/** K: every exam action needs the online_exams module. The two scheduled jobs skip quietly when it is off. */
export function createExamService(db: Db, opts: { now?: () => Date } = {}) {
  return gateModule(db, "online_exams", buildExamService(db, opts), {
    finalizeExpiredAttempts: 0,
    runReleaseJob: () => ({ closed: 0, released: 0, errors: [] as { examId: string; message: string }[] }),
  });
}
export type ExamService = ReturnType<typeof buildExamService>;
