/**
 * Exams: question snapshots, attempts, grading, results and release (G1 to G9).
 */
import { afterAll, describe, test } from "bun:test";
import {
  attemptDeadline,
  buildSnapshot,
  createExamService,
  gradeAnswer,
  pickCounted,
  seededOrder,
  studentView,
} from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = '{"parent_portal": true, "online_exams": true}'::jsonb`);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
let clock = new Date("2027-03-10T07:00:00Z");
const ex = createExamService(db, { now: () => clock });
const at = (hhmm: string) => (clock = new Date(`2027-03-10T${hhmm}:00Z`));

const staff = await id(`INSERT INTO "user" (email) VALUES ('lecturer@example.com')`);
const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Silva')`);
const lec2 = await id(`INSERT INTO lecturer (full_name) VALUES ('Mrs Other')`);
const subj = await id(`INSERT INTO subject (name) VALUES ('Maths')`);
let n = 0;
const newCourse = () => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'class','scheduled',false)`, [subj, b1, `Class ${++n}`]);
async function newStudent(courses: string[], opts: { restricted?: boolean } = {}) {
  const userId = await id(`INSERT INTO "user" (email) VALUES ($1)`, [`x${++n}@example.com`]);
  const studentId = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,$2,$3,'2014-05-01')`, [userId, `X${++n}`, `Student ${String(n).padStart(3, "0")}`]);
  const enrollmentIds: string[] = [];
  for (const c of courses) enrollmentIds.push(await id(`INSERT INTO enrollment (course_id, student_id, access_status, access_starts_on) VALUES ($1,$2,$3,'2027-01-01')`, [c, studentId, opts.restricted ? "restricted" : "active"]));
  return { userId, studentId, enrollmentIds };
}
const mcq = (body: string, correctIndex = 0, marks: number | string = 2) =>
  ex.createQuestion({ actor: null, lecturerId: lec, body, defaultMarks: marks, explanation: "because", options: ["Alpha", "Beta", "Gamma"].map((b, i) => ({ body: b, isCorrect: i === correctIndex })) });

/** An online exam from 08:00 to 12:00, with two 2-mark questions (correct answers A and B), published. */
async function publishedExam(opts: Partial<Parameters<typeof ex.createExam>[0]> = {}, courses?: string[]) {
  const cs = courses ?? [await newCourse()];
  const e = await ex.createExam({
    lecturerId: lec,
    title: `Test ${++n}`,
    mode: "online_mcq",
    courseIds: cs,
    opensAt: new Date("2027-03-10T08:00:00Z"),
    closesAt: new Date("2027-03-10T12:00:00Z"),
    maxAttempts: 2,
    ...opts,
  });
  const q1 = await mcq("Q1", 0);
  const q2 = await mcq("Q2", 1);
  await ex.setQuestions({ examId: e.id, questions: [{ questionId: q1.id }, { questionId: q2.id }] });
  await ex.publishExam({ examId: e.id });
  const eqs = await q(`SELECT id, position FROM exam_question WHERE exam_id = $1 ORDER BY position`, [e.id]);
  return { exam: e, courses: cs, q1: String(eqs[0]!.id), q2: String(eqs[1]!.id) };
}
const answer = (attemptId: string, studentId: string, a: [string, string | null][]) =>
  ex.saveAnswers({ attemptId, studentId, answers: a.map(([examQuestionId, selectedOptionKey]) => ({ examQuestionId, selectedOptionKey })) });

describe("pure", () => {
  const snap = buildSnapshot({ body: "Q", imageFileId: null, explanation: "e" }, [
    { body: "second", isCorrect: false, position: 2 },
    { body: "first", isCorrect: true, position: 1 },
  ]);
  test("snapshot orders options by position and keys them A, B", () => {
    eq(snap.options.map((o) => [o.key, o.body, o.isCorrect]), [["A", "first", true], ["B", "second", false]], "options");
  });
  test("the student view hides correct flags and the explanation", () => {
    const v = studentView(snap);
    eq(JSON.stringify(v).includes("isCorrect") || JSON.stringify(v).includes("explanation"), false, "hidden");
  });
  test("grading uses the snapshot only; blank and unknown keys score zero", () => {
    eq(gradeAnswer(snap, "A", "2.5"), { isCorrect: true, marksAwarded: "2.50" }, "right");
    eq(gradeAnswer(snap, "B", "2"), { isCorrect: false, marksAwarded: "0.00" }, "wrong");
    eq(gradeAnswer(snap, null, "2"), { isCorrect: false, marksAwarded: "0.00" }, "blank");
    eq(gradeAnswer(snap, "Z", "2"), { isCorrect: false, marksAwarded: "0.00" }, "unknown");
  });
  test("pickCounted: best keeps the earliest of equal scores, latest takes the last attempt", () => {
    const a = [{ attemptNo: 1, score: "3.00" }, { attemptNo: 2, score: "5.00" }, { attemptNo: 3, score: "5.00" }, { attemptNo: 4, score: "1.00" }];
    eq(pickCounted(a, "best")!.attemptNo, 2, "best");
    eq(pickCounted(a, "latest")!.attemptNo, 4, "latest");
    eq(pickCounted([], "best"), null, "none");
  });
  test("deadline is the earlier of time limit and closing time", () => {
    const s = new Date("2027-03-10T09:00:00Z");
    const close = new Date("2027-03-10T10:00:00Z");
    eq(attemptDeadline(s, 30, close).toISOString(), "2027-03-10T09:30:00.000Z", "limit first");
    eq(attemptDeadline(s, 90, close).toISOString(), "2027-03-10T10:00:00.000Z", "close first");
    eq(attemptDeadline(s, null, close).toISOString(), "2027-03-10T10:00:00.000Z", "no limit");
  });
  test("seededOrder is repeatable and keeps every item", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    eq(seededOrder(items, "abc"), seededOrder(items, "abc"), "same seed");
    eq([...seededOrder(items, "abc")].sort(), items, "same items");
  });
});

describe("setup and publishing (G4)", () => {
  test("question rules", async () => {
    await fails("question_invalid", () => ex.createQuestion({ actor: null, lecturerId: lec, body: " ", options: [{ body: "a", isCorrect: true }, { body: "b", isCorrect: false }] }));
    await fails("question_invalid", () => ex.createQuestion({ actor: null, lecturerId: lec, body: "Q", options: [{ body: "a", isCorrect: true }] }));
    await fails("question_invalid", () => ex.createQuestion({ actor: null, lecturerId: lec, body: "Q", options: [{ body: "a", isCorrect: true }, { body: "b", isCorrect: true }] }));
    await fails("question_invalid", () => ex.createQuestion({ actor: null, lecturerId: lec, body: "Q", options: [{ body: "a", isCorrect: false }, { body: "b", isCorrect: false }] }));
    await fails("question_invalid", () => ex.createQuestion({ actor: null, lecturerId: lec, body: "Q", defaultMarks: 0, options: [{ body: "a", isCorrect: true }, { body: "b", isCorrect: false }] }));
  });

  test("exam rules per mode", async () => {
    const c = await newCourse();
    const base = { lecturerId: lec, title: "T", courseIds: [c] };
    const win = { opensAt: new Date("2027-03-10T08:00:00Z"), closesAt: new Date("2027-03-10T09:00:00Z") };
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "online_mcq", maxAttempts: 1 }));
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "online_mcq", ...win }));
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "online_mcq", opensAt: win.closesAt, closesAt: win.opensAt, maxAttempts: 1 }));
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "online_mcq", ...win, maxAttempts: 0 }));
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "online_mcq", ...win, maxAttempts: 1, maxMarks: 50 }));
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "paper" }));
    await fails("exam_invalid", () => ex.createExam({ ...base, mode: "paper", examDate: "2027-03-20", maxMarks: 100, maxAttempts: 1 }));
    await fails("exam_invalid", () => ex.createExam({ ...base, courseIds: [], mode: "paper", examDate: "2027-03-20", maxMarks: 100 }));
    await fails("not_found", () => ex.createExam({ ...base, courseIds: ["00000000-0000-0000-0000-000000000000"], mode: "paper", examDate: "2027-03-20", maxMarks: 100 }));
  });

  test("questions: draft only, own bank only, no repeats; publish needs questions", async () => {
    const c = await newCourse();
    const e = await ex.createExam({ lecturerId: lec, title: "Draft", mode: "online_mcq", courseIds: [c], opensAt: new Date("2027-03-10T08:00:00Z"), closesAt: new Date("2027-03-10T09:00:00Z"), maxAttempts: 1 });
    await fails("exam_invalid", () => ex.publishExam({ examId: e.id }));
    const mine = await mcq("mine");
    const other = await ex.createQuestion({ actor: null, lecturerId: lec2, body: "theirs", options: [{ body: "a", isCorrect: true }, { body: "b", isCorrect: false }] });
    await fails("question_invalid", () => ex.setQuestions({ examId: e.id, questions: [{ questionId: other.id }] }));
    await fails("question_invalid", () => ex.setQuestions({ examId: e.id, questions: [{ questionId: mine.id }, { questionId: mine.id }] }));
    await ex.setQuestions({ examId: e.id, questions: [{ questionId: mine.id, marks: 3 }] });
    const r = await ex.publishExam({ examId: e.id });
    eq(r.exam.maxMarks, "3.00", "total marks from the questions");
    await fails("exam_not_draft", () => ex.setQuestions({ examId: e.id, questions: [] }));
    await fails("exam_not_draft", () => ex.publishExam({ examId: e.id }));
  });

  test("question edits after publish never change the exam (G4)", async () => {
    const p = await publishedExam();
    const [row] = await q(`SELECT question_id, snapshot FROM exam_question WHERE id = $1`, [p.q1]);
    await ex.updateQuestion({ actor: null, questionId: String(row!.question_id), body: "Changed!", options: [{ body: "X", isCorrect: false }, { body: "Y", isCorrect: true }] });
    const [after] = await q(`SELECT snapshot FROM exam_question WHERE id = $1`, [p.q1]);
    eq(JSON.stringify(after!.snapshot), JSON.stringify(row!.snapshot), "snapshot frozen");
    eq(JSON.stringify(after!.snapshot).includes("Changed!"), false, "old text kept");
    // the database refuses to touch frozen rows as well
    let refused = false;
    await q(`UPDATE exam_question SET marks = 9 WHERE id = $1`, [p.q1]).catch(() => (refused = true));
    eq(refused, true, "trigger");
  });

  test("publishing notifies enrolled students once", async () => {
    const c = await newCourse();
    const s = await newStudent([c]);
    const e = await ex.createExam({ lecturerId: lec, title: "Notify", mode: "online_mcq", courseIds: [c], opensAt: new Date("2027-03-10T08:00:00Z"), closesAt: new Date("2027-03-10T09:00:00Z"), maxAttempts: 1 });
    const qn = await mcq("N");
    await ex.setQuestions({ examId: e.id, questions: [{ questionId: qn.id }] });
    const r = await ex.publishExam({ examId: e.id });
    eq(r.notifications >= 1, true, "queued");
    eq((await q(`SELECT count(*)::int AS c FROM notification WHERE user_id = $1 AND event = 'exam_published'`, [s.userId]))[0]!.c, 1, "student told");
  });
});

describe("taking an exam (G1, G2, G3, G6)", () => {
  test("window is enforced with server time", async () => {
    const p = await publishedExam();
    const s = await newStudent(p.courses);
    at("07:59");
    await fails("exam_not_open", () => ex.startAttempt({ examId: p.exam.id, studentId: s.studentId }));
    at("12:00");
    await fails("exam_not_open", () => ex.startAttempt({ examId: p.exam.id, studentId: s.studentId }));
    at("08:00");
    const r = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    eq(r.resumed, false, "started at the opening time");
  });

  test("eligibility: needs effective access in an attached course (G1)", async () => {
    const p = await publishedExam();
    const stranger = await newStudent([await newCourse()]);
    const restricted = await newStudent(p.courses, { restricted: true });
    const ok = await newStudent(p.courses);
    at("09:00");
    await fails("student_not_eligible", () => ex.startAttempt({ examId: p.exam.id, studentId: stranger.studentId }));
    await fails("student_not_eligible", () => ex.startAttempt({ examId: p.exam.id, studentId: restricted.studentId }));
    await ex.startAttempt({ examId: p.exam.id, studentId: ok.studentId });
    await fails("not_found", () => ex.startAttempt({ examId: p.exam.id, studentId: "00000000-0000-0000-0000-000000000000" }));
  });

  test("the attempt records the enrolment used, and the limit counts across courses (G2, G3)", async () => {
    const c1 = await newCourse();
    const c2 = await newCourse();
    const p = await publishedExam({ maxAttempts: 2 }, [c1, c2]);
    const s = await newStudent([c1, c2]);
    at("09:00");
    const a1 = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId, enrollmentId: s.enrollmentIds[1] });
    const [row] = await q(`SELECT enrollment_id, course_id, attempt_no FROM exam_attempt WHERE id = $1`, [a1.paper.attemptId]);
    eq([row!.enrollment_id, row!.course_id, row!.attempt_no], [s.enrollmentIds[1], c2, 1], "second course's enrolment");
    await ex.submitAttempt({ attemptId: a1.paper.attemptId, studentId: s.studentId });
    const a2 = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId, enrollmentId: s.enrollmentIds[0] });
    await ex.submitAttempt({ attemptId: a2.paper.attemptId, studentId: s.studentId });
    await fails("attempt_limit_reached", () => ex.startAttempt({ examId: p.exam.id, studentId: s.studentId }));
    eq((await q(`SELECT count(*)::int AS c FROM exam_attempt WHERE exam_id = $1`, [p.exam.id]))[0]!.c, 2, "two attempts");
  });

  test("G1: a running attempt cannot be resumed once the student has no access, and resumes again when access returns", async () => {
    const p = await publishedExam();
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    await q(`UPDATE enrollment SET access_status = 'restricted' WHERE student_id = $1`, [s.studentId]);
    await fails("student_not_eligible", () => ex.startAttempt({ examId: p.exam.id, studentId: s.studentId }));
    const [row] = await q(`SELECT status FROM exam_attempt WHERE id = $1`, [a.paper.attemptId]);
    eq(row!.status, "in_progress", "attempt untouched");
    eq(Number((await q(`SELECT count(*)::int AS c FROM attempt_answer WHERE attempt_id = $1 AND selected_option_key = 'A'`, [a.paper.attemptId]))[0]!.c), 1, "answer kept");
    await q(`UPDATE enrollment SET access_status = 'active' WHERE student_id = $1`, [s.studentId]);
    const back = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    eq([back.resumed, back.paper.attemptId], [true, a.paper.attemptId], "resumed after access returned");
  });

  test("starting again resumes the running attempt with saved answers, and the paper hides the answers", async () => {
    const p = await publishedExam();
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    const again = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    eq([again.resumed, again.paper.attemptId], [true, a.paper.attemptId], "same attempt");
    eq(again.paper.questions.find((x) => x.examQuestionId === p.q1)!.selectedOptionKey, "A", "answer kept");
    const text = JSON.stringify(again.paper);
    eq(text.includes("isCorrect") || text.includes("because"), false, "no answers leaked");
  });

  test("answers are validated and only the owner can touch an attempt", async () => {
    const p = await publishedExam();
    const s = await newStudent(p.courses);
    const other = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await fails("invalid_input", () => answer(a.paper.attemptId, s.studentId, [[p.q1, "Z"]]));
    await fails("not_found", () => answer(a.paper.attemptId, s.studentId, [["00000000-0000-0000-0000-000000000000", "A"]]));
    await fails("not_found", () => answer(a.paper.attemptId, other.studentId, [[p.q1, "A"]]));
    await fails("not_found", () => ex.getAttempt({ attemptId: a.paper.attemptId, studentId: other.studentId }));
    await fails("not_found", () => ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: other.studentId }));
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    await answer(a.paper.attemptId, s.studentId, [[p.q1, null]]);
    eq((await ex.getAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId })).paper.questions[0]!.selectedOptionKey, null, "cleared");
  });
});

describe("answer locking (per exam)", () => {
  const saved = (attemptId: string, examQuestionId: string) =>
    q(`SELECT selected_option_key AS k FROM attempt_answer WHERE attempt_id = $1 AND exam_question_id = $2`, [attemptId, examQuestionId]).then((r) => r[0]?.k ?? null);

  test("by default an answer can be changed and cleared until the attempt ends", async () => {
    const p = await publishedExam();
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    eq(a.paper.lockAnswers, false, "flag on the paper");
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "B"]]);
    eq(await saved(a.paper.attemptId, p.q1), "B", "changed");
    await answer(a.paper.attemptId, s.studentId, [[p.q1, null]]);
    eq(await saved(a.paper.attemptId, p.q1), null, "cleared");
  });

  test("with locking the first choice is final; the same choice again is accepted; the batch is all or nothing", async () => {
    const p = await publishedExam({ lockAnswers: true, resultsVisibility: "immediate" });
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    eq(a.paper.lockAnswers, true, "flag on the paper");
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]); // a retry after a network blip
    await fails("answer_locked", () => answer(a.paper.attemptId, s.studentId, [[p.q1, "B"]]));
    await fails("answer_locked", () => answer(a.paper.attemptId, s.studentId, [[p.q1, null]]));
    eq(await saved(a.paper.attemptId, p.q1), "A", "still A");
    await fails("answer_locked", () => answer(a.paper.attemptId, s.studentId, [[p.q2, "B"], [p.q1, "C"]]));
    eq(await saved(a.paper.attemptId, p.q2), null, "nothing from the refused batch was saved");
    await answer(a.paper.attemptId, s.studentId, [[p.q2, "B"]]);
    const r = await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
    eq(r.score, "4.00", "graded normally");
  });

  test("with locking, saving a blank first does not lock the question, and a new attempt starts unlocked", async () => {
    const p = await publishedExam({ lockAnswers: true, maxAttempts: 2 });
    const s = await newStudent(p.courses);
    at("09:00");
    const a1 = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a1.paper.attemptId, s.studentId, [[p.q1, null]]);
    await answer(a1.paper.attemptId, s.studentId, [[p.q1, "C"]]);
    eq(await saved(a1.paper.attemptId, p.q1), "C", "chosen after a blank");
    await ex.submitAttempt({ attemptId: a1.paper.attemptId, studentId: s.studentId });
    const a2 = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a2.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    eq(await saved(a2.paper.attemptId, p.q1), "A", "second attempt is separate");
  });
});

describe("grading and results (G5, G7)", () => {
  test("submit grades from the snapshot, blanks score zero, and a result appears", async () => {
    const p = await publishedExam({ resultsVisibility: "immediate" });
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]); // q1 right, q2 blank
    at("09:10");
    const r = await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
    eq([r.status, r.score, r.alreadyFinished], ["graded", "2.00", false], "submit");
    const rows = await q(`SELECT is_correct, marks_awarded FROM attempt_answer WHERE attempt_id = $1 ORDER BY exam_question_id`, [a.paper.attemptId]);
    eq(rows.length, 2, "a row for the blank too");
    const [res] = await q(`SELECT marks, source, attempt_id FROM exam_result WHERE exam_id = $1 AND student_id = $2`, [p.exam.id, s.studentId]);
    eq([res!.marks, res!.source, res!.attempt_id], ["2.00", "attempt", a.paper.attemptId], "result");
    eq((await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId })).alreadyFinished, true, "submit twice is harmless");
    await fails("attempt_not_running", () => answer(a.paper.attemptId, s.studentId, [[p.q1, "B"]]));
  });

  test("best scoring keeps the best attempt; latest follows the newest", async () => {
    for (const scoring of ["best", "latest"] as const) {
      const p = await publishedExam({ maxAttempts: 2, attemptScoring: scoring });
      const s = await newStudent(p.courses);
      at("09:00");
      const a1 = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
      await answer(a1.paper.attemptId, s.studentId, [[p.q1, "A"], [p.q2, "B"]]); // 4
      await ex.submitAttempt({ attemptId: a1.paper.attemptId, studentId: s.studentId });
      const a2 = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
      await answer(a2.paper.attemptId, s.studentId, [[p.q1, "C"], [p.q2, "B"]]); // 2
      await ex.submitAttempt({ attemptId: a2.paper.attemptId, studentId: s.studentId });
      const [res] = await q(`SELECT marks, attempt_id FROM exam_result WHERE exam_id = $1`, [p.exam.id]);
      eq([res!.marks, res!.attempt_id], scoring === "best" ? ["4.00", a1.paper.attemptId] : ["2.00", a2.paper.attemptId], scoring);
    }
  });

  test("time limit: late saves are refused, the attempt is finalised from saved answers (G6)", async () => {
    const p = await publishedExam({ timeLimitMinutes: 30 });
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    eq(a.paper.deadline.toISOString(), "2027-03-10T09:30:00.000Z", "deadline");
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    at("09:31");
    await fails("attempt_time_over", () => answer(a.paper.attemptId, s.studentId, [[p.q2, "B"]]));
    const [row] = await q(`SELECT status, score, to_char(submitted_at AT TIME ZONE 'UTC', 'HH24:MI') AS ended FROM exam_attempt WHERE id = $1`, [a.paper.attemptId]);
    eq([row!.status, row!.score], ["expired", "2.00"], "expired with the saved answer graded");
    eq(row!.ended, "09:30", "ended at the deadline");
    const sub = await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
    eq([sub.status, sub.alreadyFinished], ["expired", true], "submit after the time returns the finalised attempt");
    eq((await q(`SELECT marks FROM exam_result WHERE exam_id = $1`, [p.exam.id]))[0]!.marks, "2.00", "counts toward the result");
  });

  test("closing the exam ends running attempts; finalizeExpiredAttempts handles the overdue ones", async () => {
    const p = await publishedExam();
    const s1 = await newStudent(p.courses);
    const s2 = await newStudent(p.courses);
    at("09:00");
    const a1 = await ex.startAttempt({ examId: p.exam.id, studentId: s1.studentId });
    await answer(a1.paper.attemptId, s1.studentId, [[p.q1, "A"], [p.q2, "B"]]);
    const a2 = await ex.startAttempt({ examId: p.exam.id, studentId: s2.studentId });
    at("12:30");
    eq(await ex.finalizeExpiredAttempts() >= 2, true, "both finalised");
    eq((await q(`SELECT status FROM exam_attempt WHERE id = $1`, [a1.paper.attemptId]))[0]!.status, "expired", "a1");
    eq((await q(`SELECT score FROM exam_attempt WHERE id = $1`, [a2.paper.attemptId]))[0]!.score, "0.00", "a2 scored zero");

    const p2 = await publishedExam();
    const s3 = await newStudent(p2.courses);
    at("10:00");
    const a3 = await ex.startAttempt({ examId: p2.exam.id, studentId: s3.studentId });
    await answer(a3.paper.attemptId, s3.studentId, [[p2.q1, "A"]]);
    const closed = await ex.closeExam({ examId: p2.exam.id });
    eq(closed.expired, 1, "running attempt ended by closing");
    await fails("exam_not_published", () => ex.closeExam({ examId: p2.exam.id }));
    await fails("exam_not_published", () => ex.startAttempt({ examId: p2.exam.id, studentId: s3.studentId }));
  });
});

describe("release and visibility (G8, G9)", () => {
  async function examWithResult(visibility: "immediate" | "after_release" | "manual") {
    const p = await publishedExam({ resultsVisibility: visibility });
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
    return { p, s, a };
  }

  test("visibility: immediate shows a provisional score, the others wait for release (G9)", async () => {
    const imm = await examWithResult("immediate");
    const aft = await examWithResult("after_release");
    const man = await examWithResult("manual");
    const view = (t: { p: { exam: { id: string } }; s: { studentId: string } }) => ex.getResultForStudent({ examId: t.p.exam.id, studentId: t.s.studentId });
    const v1 = await view(imm);
    eq(v1.visible && [v1.provisional, v1.marks], [true, "2.00"], "immediate is provisional");
    eq(await view(aft), { visible: false, reason: "not_released" }, "after_release hidden");
    eq(await view(man), { visible: false, reason: "not_released" }, "manual hidden");
    for (const t of [imm, aft, man]) {
      await ex.closeExam({ examId: t.p.exam.id });
      await ex.releaseResults({ examId: t.p.exam.id });
    }
    for (const t of [imm, aft, man]) {
      const v = await view(t);
      eq(v.visible && [v.provisional, v.marks, v.maxMarks], [false, "2.00", "4.00"], "released");
    }
  });

  test("release needs a closed exam; an exam past its closing time is closed first; paper exams are closed by hand", async () => {
    const t = await examWithResult("manual");
    await fails("exam_not_closed", () => ex.releaseResults({ examId: t.p.exam.id }));
    at("12:05");
    eq(await ex.releaseResults({ examId: t.p.exam.id }), 1, "released after the closing time");
    eq((await q(`SELECT status FROM exam WHERE id = $1`, [t.p.exam.id]))[0]!.status, "closed", "closed on the way");
    eq(await ex.releaseResults({ examId: t.p.exam.id }), 0, "second release changes nothing");
  });

  test("a released result is never recomputed (G8)", async () => {
    const t = await examWithResult("after_release");
    at("12:05");
    await ex.releaseResults({ examId: t.p.exam.id });
    // Force an attempt to finish again after release, with a better answer sheet: the result must not move.
    await q(`UPDATE exam_attempt SET status = 'in_progress', submitted_at = NULL, score = NULL WHERE id = $1`, [t.a.paper.attemptId]);
    await q(`UPDATE attempt_answer SET selected_option_key = 'B' WHERE attempt_id = $1 AND exam_question_id = $2`, [t.a.paper.attemptId, t.p.q2]);
    await ex.submitAttempt({ attemptId: t.a.paper.attemptId, studentId: t.s.studentId });
    eq((await q(`SELECT score FROM exam_attempt WHERE id = $1`, [t.a.paper.attemptId]))[0]!.score, "4.00", "the attempt itself regraded");
    eq((await q(`SELECT marks FROM exam_result WHERE exam_id = $1`, [t.p.exam.id]))[0]!.marks, "2.00", "result unchanged");
  });

  test("overriding a released result needs a reason, is audited, and stops recomputation", async () => {
    const t = await examWithResult("after_release");
    await fails("exam_not_closed", () => ex.overrideResult({ examId: t.p.exam.id, studentId: t.s.studentId, marks: 3, reason: "x", actor: staff }));
    at("12:05");
    await ex.releaseResults({ examId: t.p.exam.id });
    await fails("reason_required", () => ex.overrideResult({ examId: t.p.exam.id, studentId: t.s.studentId, marks: 3, reason: " ", actor: staff }));
    await fails("invalid_input", () => ex.overrideResult({ examId: t.p.exam.id, studentId: t.s.studentId, marks: 5, reason: "too high", actor: staff }));
    await ex.overrideResult({ examId: t.p.exam.id, studentId: t.s.studentId, marks: 3, reason: "Question 2 was ambiguous", actor: staff });
    const [r] = await q(`SELECT marks, source FROM exam_result WHERE exam_id = $1`, [t.p.exam.id]);
    eq([r!.marks, r!.source], ["3.00", "manual_override"], "overridden");
    const [log] = await q(`SELECT action, reason, actor_user_id FROM audit_log WHERE action = 'exam_result.edit_after_release' ORDER BY created_at DESC LIMIT 1`);
    eq([log!.reason, log!.actor_user_id], ["Question 2 was ambiguous", staff], "audit row");
    const [full] = await q(`SELECT before_data, after_data FROM audit_log WHERE action = 'exam_result.edit_after_release' ORDER BY created_at DESC LIMIT 1`);
    eq(["remarks" in (full!.before_data as object), "remarks" in (full!.after_data as object)], [true, true], "audit keeps remarks before and after");
  });

  test("the release job closes and releases automatic exams but leaves manual ones", async () => {
    const auto = await examWithResult("after_release");
    const man = await examWithResult("manual");
    at("12:10");
    const r = await ex.runReleaseJob();
    eq(r.released >= 1 && r.errors.length === 0, true, "job result");
    eq((await q(`SELECT released_at IS NOT NULL AS done FROM exam_result WHERE exam_id = $1`, [auto.p.exam.id]))[0]!.done, true, "auto released");
    eq((await q(`SELECT released_at IS NOT NULL AS done FROM exam_result WHERE exam_id = $1`, [man.p.exam.id]))[0]!.done, false, "manual waits");
  });

  test("getResults gives staff the rows, average and highest", async () => {
    const p = await publishedExam();
    const marks = [["A", "B"], ["A", null], [null, null]] as const;
    for (const m of marks) {
      const s = await newStudent(p.courses);
      at("09:00");
      const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
      await answer(a.paper.attemptId, s.studentId, [[p.q1, m[0]], [p.q2, m[1]]]);
      await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
    }
    const r = await ex.getResults({ examId: p.exam.id });
    eq([r.count, r.average, r.highest], [3, "2.00", "4.00"], "summary");
  });
});

describe("paper exams (G7, G8)", () => {
  async function paper() {
    const c = await newCourse();
    const e = await ex.createExam({ lecturerId: lec, title: "Term test", mode: "paper", courseIds: [c], examDate: "2027-03-20", maxMarks: 100 });
    const s = await newStudent([c]);
    return { e, c, s };
  }

  test("marks are entered by hand within the total, only for enrolled students", async () => {
    const { e, s } = await paper();
    await fails("exam_not_published", () => ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: 50 }], actor: staff }));
    await ex.publishExam({ examId: e.id });
    await fails("invalid_input", () => ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: 101 }], actor: staff }));
    await fails("invalid_input", () => ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: -1 }], actor: staff }));
    const stranger = await newStudent([]);
    await fails("student_not_enrolled", () => ex.enterMarks({ examId: e.id, entries: [{ studentId: stranger.studentId, marks: 10 }], actor: staff }));
    await ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: "72.5", grade: "A", remarks: "good" }], actor: staff });
    await ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: 74 }], actor: staff });
    const [r] = await q(`SELECT marks, source, enrollment_id IS NOT NULL AS has_enr FROM exam_result WHERE exam_id = $1`, [e.id]);
    eq([r!.marks, r!.source, r!.has_enr], ["74.00", "manual", true], "corrected before release");
    await fails("exam_invalid", () => ex.startAttempt({ examId: e.id, studentId: s.studentId }));
  });

  test("a paper exam must be closed by hand before release; edits after release need a reason and are audited", async () => {
    const { e, s } = await paper();
    await ex.publishExam({ examId: e.id });
    await ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: 60 }], actor: staff });
    at("12:05");
    await fails("exam_not_closed", () => ex.releaseResults({ examId: e.id }));
    await ex.closeExam({ examId: e.id });
    eq(await ex.releaseResults({ examId: e.id }), 1, "released");
    await fails("reason_required", () => ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: 65 }], actor: staff }));
    await ex.enterMarks({ examId: e.id, entries: [{ studentId: s.studentId, marks: 65 }], actor: staff, reason: "Totalling error" });
    eq((await q(`SELECT marks FROM exam_result WHERE exam_id = $1`, [e.id]))[0]!.marks, "65.00", "changed");
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_type = 'exam_result' AND reason = 'Totalling error'`))[0]!.c, 1, "audited");
    await fails("exam_invalid", () => ex.overrideResult({ examId: e.id, studentId: s.studentId, marks: 1, reason: "x", actor: staff }));
  });

  test("online and paper never mix: entering marks on an online exam is refused", async () => {
    const p = await publishedExam();
    const s = await newStudent(p.courses);
    await fails("exam_invalid", () => ex.enterMarks({ examId: p.exam.id, entries: [{ studentId: s.studentId, marks: 1 }], actor: staff }));
  });
});

describe("a question allocation that cannot be published", () => {
  async function draft() {
    const c = await newCourse();
    return ex.createExam({ lecturerId: lec, title: `Big ${++n}`, mode: "online_mcq", courseIds: [c], opensAt: new Date("2027-03-10T08:00:00Z"), closesAt: new Date("2027-03-10T12:00:00Z"), maxAttempts: 1 });
  }
  const big = async () => (await mcq(`Big ${++n}`, 0, 100000)).id;

  test("setQuestions refuses a total above numeric(8,2), counting the bank's default marks, and keeps the old allocation", async () => {
    const e = await draft();
    const small = await mcq("Small", 0, 1);
    await ex.setQuestions({ examId: e.id, questions: [{ questionId: small.id }] });
    const ids = await Promise.all(Array.from({ length: 11 }, big));
    await fails("exam_invalid", () => ex.setQuestions({ examId: e.id, questions: ids.map((questionId) => ({ questionId })) }));
    eq(Number((await q(`SELECT count(*)::int AS c FROM exam_question WHERE exam_id = $1`, [e.id]))[0]!.c), 1, "the earlier allocation is kept");
    eq(await ex.setQuestions({ examId: e.id, questions: ids.slice(0, 9).map((questionId) => ({ questionId })) }), 9, "900000.00 fits");
    await fails("exam_invalid", () => ex.setQuestions({ examId: e.id, questions: ids.slice(0, 10).map((questionId) => ({ questionId })) }));
  });

  test("publishExam gives a domain error for an existing draft whose total is out of range", async () => {
    const e = await draft();
    const one = await mcq("One", 0, 1);
    await ex.setQuestions({ examId: e.id, questions: [{ questionId: one.id }] });
    const ids = await Promise.all(Array.from({ length: 10 }, big));
    await q(`INSERT INTO exam_question (exam_id, question_id, marks, position) SELECT $1, id, 100000, 1 + row_number() OVER () FROM question WHERE id = ANY($2::uuid[])`, [e.id, ids]);
    await fails("exam_invalid", () => ex.publishExam({ examId: e.id }));
    eq(String((await q(`SELECT status FROM exam WHERE id = $1`, [e.id]))[0]!.status), "draft", "still a draft");
  });
});

describe("an exam shared by two branches: results and marks are scoped per result", () => {
  async function shared() {
    const cA = await newCourse();
    const cB = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'class','scheduled',false)`, [subj, b2, `Class B ${++n}`]);
    const e = await ex.createExam({ lecturerId: lec, title: "Shared paper", mode: "paper", courseIds: [cA, cB], examDate: "2027-03-20", maxMarks: 100 });
    await ex.publishExam({ examId: e.id });
    const sA = await newStudent([cA]);
    const sB = await newStudent([cB]);
    const both = await newStudent([cA, cB]);
    return { e, cA, cB, sA, sB, both };
  }
  const names = (r: { results: { studentId: string }[] }) => r.results.map((x) => x.studentId).sort();

  test("getResults with a branch set returns only that branch's rows and aggregates", async () => {
    const t = await shared();
    await ex.enterMarks({ examId: t.e.id, entries: [{ studentId: t.sA.studentId, marks: 80 }, { studentId: t.sB.studentId, marks: 40 }], actor: staff });
    const all = await ex.getResults({ examId: t.e.id });
    eq([all.count, all.average, all.highest], [2, "60.00", "80.00"], "everything for the unscoped caller");
    const a = await ex.getResults({ examId: t.e.id, branchIds: [b1] });
    eq([names(a), a.count, a.average, a.highest], [[t.sA.studentId], 1, "80.00", "80.00"], "A only, aggregates too");
    const none = await ex.getResults({ examId: t.e.id, branchIds: [] });
    eq([none.count, none.average, none.highest], [0, null, null], "an empty set sees nothing");
  });

  test("enterMarks with a branch set rejects the whole batch when an entry is in another branch, and writes nothing", async () => {
    const t = await shared();
    await fails("forbidden", () => ex.enterMarks({ examId: t.e.id, entries: [{ studentId: t.sA.studentId, marks: 70 }, { studentId: t.sB.studentId, marks: 60 }], actor: staff, branchIds: [b1] }));
    eq(Number((await q(`SELECT count(*)::int AS c FROM exam_result WHERE exam_id = $1`, [t.e.id]))[0]!.c), 0, "nothing written, not even the A entry");
    eq(await ex.enterMarks({ examId: t.e.id, entries: [{ studentId: t.sA.studentId, marks: 70 }], actor: staff, branchIds: [b1] }), 1, "in scope");
    await fails("forbidden", () => ex.enterMarks({ examId: t.e.id, entries: [{ studentId: t.sA.studentId, marks: 70 }], actor: staff, branchIds: [] }));
    const nobody = await newStudent([]);
    await fails("student_not_enrolled", () => ex.enterMarks({ examId: t.e.id, entries: [{ studentId: nobody.studentId, marks: 1 }], actor: staff, branchIds: [b1] }));
  });

  test("a student in both branches is recorded in the manager's own branch, and a stored result in another branch cannot be corrected", async () => {
    const t = await shared();
    await ex.enterMarks({ examId: t.e.id, entries: [{ studentId: t.both.studentId, marks: 50 }], actor: staff, branchIds: [b2] });
    const [r] = await q(`SELECT course_id FROM exam_result WHERE exam_id = $1 AND student_id = $2`, [t.e.id, t.both.studentId]);
    eq(String(r!.course_id), t.cB, "recorded in B, the manager's branch");
    await fails("forbidden", () => ex.enterMarks({ examId: t.e.id, entries: [{ studentId: t.both.studentId, marks: 55 }], actor: staff, branchIds: [b1] }));
    eq(String((await q(`SELECT marks FROM exam_result WHERE exam_id = $1 AND student_id = $2`, [t.e.id, t.both.studentId]))[0]!.marks), "50.00", "unchanged");
  });
});

describe("review hardening", () => {
  const hiddenRows = (attemptId: string) => q(`SELECT status, score FROM exam_attempt WHERE id = $1`, [attemptId]);

  test("G9: an attempt's score follows the exam's result visibility", async () => {
    for (const vis of ["after_release", "manual"] as const) {
      const p = await publishedExam({ resultsVisibility: vis });
      const s = await newStudent(p.courses);
      at("09:00");
      const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
      await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
      at("09:10");
      const sub = await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
      eq([sub.status, sub.score, sub.alreadyFinished], ["graded", null, false], `${vis}: submit hides the score`);
      const again = await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
      eq([again.score, again.alreadyFinished], [null, true], `${vis}: a second submit too`);
      const read = await ex.getAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
      eq([read.status, read.score, read.scoreHidden], ["graded", null, true], `${vis}: reading it back`);
      eq((await hiddenRows(a.paper.attemptId))[0]!.score, "2.00", "the score is stored");
      // once the result is released the score is visible again
      await ex.closeExam({ examId: p.exam.id });
      await q(`UPDATE exam_result SET released_at = now() WHERE exam_id = $1 AND student_id = $2`, [p.exam.id, s.studentId]);
      const released = await ex.getAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId });
      eq([released.score, released.scoreHidden], ["2.00", false], `${vis}: released`);
      eq((await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId })).score, "2.00");
    }
    // immediate exams keep their provisional score
    const p = await publishedExam({ resultsVisibility: "immediate" });
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    eq((await ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId })).score, "2.00");
    eq((await ex.getAttempt({ attemptId: a.paper.attemptId, studentId: s.studentId })).score, "2.00");
    // a running attempt never shows a score, and is not "hidden" either
    const p2 = await publishedExam();
    const s2 = await newStudent(p2.courses);
    const a2 = await ex.startAttempt({ examId: p2.exam.id, studentId: s2.studentId });
    const running = await ex.getAttempt({ attemptId: a2.paper.attemptId, studentId: s2.studentId });
    eq([running.status, running.score, running.scoreHidden], ["in_progress", null, false]);
  });

  test("a student's call never finalizes another student's overdue attempt; the scheduled job does", async () => {
    const p = await publishedExam({ timeLimitMinutes: 30 });
    const owner = await newStudent(p.courses);
    const other = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: owner.studentId });
    await answer(a.paper.attemptId, owner.studentId, [[p.q1, "A"]]);
    at("09:45");
    const untouched = async () => eq([(await hiddenRows(a.paper.attemptId))[0]!.status, (await hiddenRows(a.paper.attemptId))[0]!.score], ["in_progress", null], "still running, ungraded");
    await fails("not_found", () => ex.getAttempt({ attemptId: a.paper.attemptId, studentId: other.studentId }));
    await untouched();
    await fails("not_found", () => ex.submitAttempt({ attemptId: a.paper.attemptId, studentId: other.studentId }));
    await untouched();
    await fails("not_found", () => answer(a.paper.attemptId, other.studentId, [[p.q1, "B"]]));
    await untouched();
    eq((await q(`SELECT count(*)::int AS c FROM exam_result WHERE exam_id = $1`, [p.exam.id]))[0]!.c, 0, "no result written");
    // the owner's own call still finalizes it, and so does the scheduled job for another overdue attempt
    eq((await ex.getAttempt({ attemptId: a.paper.attemptId, studentId: owner.studentId })).status, "expired");
    const p2 = await publishedExam({ timeLimitMinutes: 30 });
    const s2 = await newStudent(p2.courses);
    at("09:00");
    const b = await ex.startAttempt({ examId: p2.exam.id, studentId: s2.studentId });
    at("09:45");
    eq(await ex.finalizeExpiredAttempts() >= 1, true);
    eq((await hiddenRows(b.paper.attemptId))[0]!.status, "expired");
  });

  test("G6 under the lock: a deadline that passes after the first check expires the attempt, commits it, then refuses", async () => {
    const p = await publishedExam({ timeLimitMinutes: 30 });
    const s = await newStudent(p.courses);
    at("09:00");
    const a = await ex.startAttempt({ examId: p.exam.id, studentId: s.studentId });
    await answer(a.paper.attemptId, s.studentId, [[p.q1, "A"]]);
    // the first look (before the lock) sees 09:29:59, the look under the write lock sees 09:30:01
    const times = [new Date("2027-03-10T09:29:59Z"), new Date("2027-03-10T09:30:01Z")];
    const racing = createExamService(db, { now: () => times.shift() ?? clock });
    await fails("attempt_time_over", () => racing.saveAnswers({ attemptId: a.paper.attemptId, studentId: s.studentId, answers: [{ examQuestionId: p.q2, selectedOptionKey: "B" }] }));
    const [row] = await q(`SELECT status, score FROM exam_attempt WHERE id = $1`, [a.paper.attemptId]);
    eq([row!.status, row!.score], ["expired", "2.00"], "finalized and committed");
    eq((await q(`SELECT selected_option_key FROM attempt_answer WHERE attempt_id = $1 AND exam_question_id = $2`, [a.paper.attemptId, p.q2]))[0]!.selected_option_key, null, "the late answer was not saved");
    await fails("attempt_time_over", () => answer(a.paper.attemptId, s.studentId, [[p.q2, "B"]])); // a retry sees the finished attempt

    // the same for a submission: it ends the attempt as expired, not graded
    const p2 = await publishedExam({ timeLimitMinutes: 30 });
    const s2 = await newStudent(p2.courses);
    at("09:00");
    const b = await ex.startAttempt({ examId: p2.exam.id, studentId: s2.studentId });
    await answer(b.paper.attemptId, s2.studentId, [[p2.q1, "A"]]);
    const t2 = [new Date("2027-03-10T09:29:59Z"), new Date("2027-03-10T09:30:01Z")];
    const racing2 = createExamService(db, { now: () => t2.shift() ?? clock });
    const sub = await racing2.submitAttempt({ attemptId: b.paper.attemptId, studentId: s2.studentId });
    eq([sub.status, sub.alreadyFinished], ["expired", true]);
    eq((await hiddenRows(b.paper.attemptId))[0]!.status, "expired");
  });
});
