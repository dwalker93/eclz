/**
 * Local mock fixtures for the Results UI demo.
 *
 * Mirrors `exam`, `exam_course`, `exam_question`, `exam_attempt`,
 * `attempt_answer` and `exam_result`. Candidates come from the shared Courses
 * enrollments, online attempts and their answers are generated
 * deterministically, and a student's result marks come from the counted attempt
 * (best or latest). A `manual_override` keeps the counted attempt but changes
 * the result marks, matching the append-only attempt rule. Nothing here is
 * persisted.
 */

import {
  courses,
  getCourseById,
  getCourseEnrollments,
  type CourseRecord,
} from "@/lib/courses-data"
import { lecturers } from "@/lib/lecturers-data"
import {
  MOCK_TODAY,
  getPrimaryBranch,
  students,
  type StudentRecord,
} from "@/lib/students-data"

export type ExamMode = "online_mcq" | "paper"
export type ExamScoring = "best" | "latest"
export type ExamVisibility = "immediate" | "after_release" | "manual"
export type ExamStatus = "draft" | "published" | "closed"
export type AttemptStatus = "in_progress" | "submitted" | "graded" | "expired"
export type ResultSource = "attempt" | "manual" | "manual_override"
export type ReleaseState = "released" | "provisional" | "not_entered"

export type ExamOptionRecord = {
  key: string
  body: string
  isCorrect: boolean
}

export type ExamQuestionRecord = {
  id: string
  position: number
  body: string
  marks: number
  options: ExamOptionRecord[]
}

export type AttemptAnswerRecord = {
  id: string
  examQuestionId: string
  position: number
  questionBody: string
  options: ExamOptionRecord[]
  selectedOptionKey: string | null
  isCorrect: boolean | null
  marksAwarded: number | null
  marks: number
}

export type ExamAttemptRecord = {
  id: string
  attemptNo: number
  startedAt: string
  submittedAt: string | null
  score: number | null
  status: AttemptStatus
  answers: AttemptAnswerRecord[]
}

export type ExamRecord = {
  id: string
  title: string
  lecturerId: string
  lecturerName: string
  mode: ExamMode
  status: ExamStatus
  courseIds: string[]
  courseNames: string[]
  branchNames: string[]
  examDate: string | null
  maxMarks: number
  weight: number | null
  opensAt: string | null
  closesAt: string | null
  timeLimitMinutes: number | null
  maxAttempts: number | null
  attemptScoring: ExamScoring
  resultsVisibility: ExamVisibility
  questions: ExamQuestionRecord[]
  createdAt: string
}

export type ExamResultRecord = {
  id: string
  examId: string
  studentId: string
  enrollmentId: string | null
  courseId: string | null
  attemptId: string | null
  marks: number
  maxMarks: number
  percentage: number
  grade: string
  remarks: string | null
  source: ResultSource
  releasedAt: string | null
  updatedAt: string
}

export type ExamResultRow = {
  key: string
  studentId: string
  studentNo: string
  studentName: string
  branchId: string
  branchName: string
  courseId: string | null
  courseName: string | null
  result: ExamResultRecord | null
  countedAttempt: ExamAttemptRecord | null
  attempts: ExamAttemptRecord[]
  releaseState: ReleaseState
}

export const examModeLabels: Record<ExamMode, string> = {
  online_mcq: "Online MCQ",
  paper: "Paper",
}

export const examStatusLabels: Record<ExamStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
}

export const examScoringLabels: Record<ExamScoring, string> = {
  best: "Best attempt",
  latest: "Latest attempt",
}

export const examVisibilityLabels: Record<ExamVisibility, string> = {
  immediate: "Immediately after submission",
  after_release: "After results are released",
  manual: "Manual release",
}

export const attemptStatusLabels: Record<AttemptStatus, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  graded: "Graded",
  expired: "Expired",
}

export const resultSourceLabels: Record<ResultSource, string> = {
  attempt: "Attempt",
  manual: "Manual",
  manual_override: "Manual override",
}

export const releaseStateLabels: Record<ReleaseState, string> = {
  released: "Released",
  provisional: "Provisional",
  not_entered: "Not entered",
}

export function gradeFromPercentage(percentage: number) {
  if (percentage >= 75) return "A"
  if (percentage >= 65) return "B"
  if (percentage >= 55) return "C"
  if (percentage >= 40) return "S"
  return "F"
}

/* ------------------------------------------------------------------ */
/* Deterministic attempt generation                                    */
/* ------------------------------------------------------------------ */

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rollPercent(seed: string) {
  return (hashString(seed) % 1000) / 10
}

function abilityThreshold(studentId: string) {
  return 42 + (hashString(`ability-${studentId}`) % 40)
}

function addMinutes(value: string, minutes: number) {
  const parsed = new Date(value)
  parsed.setUTCMinutes(parsed.getUTCMinutes() + minutes)
  return parsed.toISOString()
}

function subtractMinutes(value: string, minutes: number) {
  return addMinutes(value, -minutes)
}

type OptionSeed = [body: string, isCorrect: boolean]

type QuestionSeed = {
  body: string
  marks: number
  options: OptionSeed[]
}

function buildQuestions(seeds: QuestionSeed[]): ExamQuestionRecord[] {
  const optionKeys = ["A", "B", "C", "D", "E"]

  return seeds.map((seed, questionIndex) => ({
    id: `q-${questionIndex + 1}`,
    position: questionIndex + 1,
    body: seed.body,
    marks: seed.marks,
    options: seed.options.map(([body, isCorrect], optionIndex) => ({
      key: optionKeys[optionIndex] ?? `O${optionIndex + 1}`,
      body,
      isCorrect,
    })),
  }))
}

type RosterEntry = {
  attemptCount?: number
  attemptStatus?: AttemptStatus
  source?: ResultSource
  /** Explicit result marks for manual entries and manual overrides. */
  marks?: number
  releasedAt?: string | null
  remarks?: string | null
}

type ExamSeed = {
  id: string
  title: string
  lecturerId: string
  mode: ExamMode
  status: ExamStatus
  courseIds: string[]
  examDate?: string
  paperMaxMarks?: number
  weight?: number
  opensAt?: string
  closesAt?: string
  timeLimitMinutes?: number
  maxAttempts?: number
  attemptScoring?: ExamScoring
  resultsVisibility?: ExamVisibility
  questions?: QuestionSeed[]
  roster: Record<string, RosterEntry>
  createdAt: string
}

const examSeeds: ExamSeed[] = [
  {
    id: "exam-junior-maths-nov",
    title: "Junior Mathematics — Monthly Test (November)",
    lecturerId: "lec-4",
    mode: "online_mcq",
    status: "closed",
    courseIds: ["co-g8-maths", "co-g8-science", "co-g7-maths", "co-g6-maths"],
    opensAt: "2026-11-08T09:00:00+05:30",
    closesAt: "2026-11-08T10:30:00+05:30",
    timeLimitMinutes: 90,
    maxAttempts: 2,
    attemptScoring: "best",
    resultsVisibility: "after_release",
    createdAt: "2026-10-28",
    questions: [
      {
        body: "What is the value of 7 × 8?",
        marks: 4,
        options: [
          ["54", false],
          ["56", true],
          ["63", false],
          ["48", false],
        ],
      },
      {
        body: "Which fraction is equivalent to 0.5?",
        marks: 4,
        options: [
          ["1/3", false],
          ["2/5", false],
          ["1/2", true],
          ["3/4", false],
        ],
      },
      {
        body: "The perimeter of a square of side 6 cm is:",
        marks: 4,
        options: [
          ["12 cm", false],
          ["18 cm", false],
          ["24 cm", true],
          ["36 cm", false],
        ],
      },
      {
        body: "Round 3,472 to the nearest hundred.",
        marks: 4,
        options: [
          ["3,400", false],
          ["3,470", false],
          ["3,500", true],
          ["3,000", false],
        ],
      },
      {
        body: "If a = 4 and b = 3, what is a² + b²?",
        marks: 4,
        options: [
          ["7", false],
          ["12", false],
          ["25", true],
          ["49", false],
        ],
      },
    ],
    roster: {
      "stu-1": {
        attemptCount: 2,
        releasedAt: "2026-11-10T18:00:00+05:30",
      },
      "stu-12": {
        attemptCount: 1,
        releasedAt: "2026-11-10T18:00:00+05:30",
      },
      "stu-3": {
        attemptCount: 1,
        releasedAt: null,
      },
      "stu-8": {
        attemptCount: 1,
        source: "manual_override",
        marks: 16,
        releasedAt: "2026-11-11T10:00:00+05:30",
        remarks:
          "Mark corrected after review of question 4 (audit: F. Rizwan, 11 Nov 2026).",
      },
    },
  },
  {
    id: "exam-al-combined-paper2",
    title: "A/L Combined Mathematics — Paper II",
    lecturerId: "lec-1",
    mode: "paper",
    status: "closed",
    courseIds: ["co-g13-combined"],
    examDate: "2026-11-05",
    paperMaxMarks: 100,
    weight: 60,
    resultsVisibility: "after_release",
    createdAt: "2026-10-20",
    roster: {
      "stu-4": {
        source: "manual",
        marks: 78,
        releasedAt: "2026-11-12T15:30:00+05:30",
        remarks: "Strong on integration; revise vectors.",
      },
      "stu-7": {
        source: "manual",
        marks: 64,
        releasedAt: null,
      },
    },
  },
  {
    id: "exam-g9-ict-term",
    title: "Grade 9 ICT — Term Test",
    lecturerId: "lec-3",
    mode: "online_mcq",
    status: "closed",
    courseIds: ["co-g9-ict"],
    opensAt: "2026-11-06T14:00:00+05:30",
    closesAt: "2026-11-06T15:00:00+05:30",
    timeLimitMinutes: 60,
    maxAttempts: 1,
    attemptScoring: "latest",
    resultsVisibility: "after_release",
    createdAt: "2026-10-25",
    questions: [
      {
        body: "Which of these is an input device?",
        marks: 6,
        options: [
          ["Monitor", false],
          ["Keyboard", true],
          ["Printer", false],
          ["Speaker", false],
        ],
      },
      {
        body: "1 kilobyte is closest to:",
        marks: 5,
        options: [
          ["10 bytes", false],
          ["100 bytes", false],
          ["1,000 bytes", true],
          ["1,000,000 bytes", false],
        ],
      },
      {
        body: "Which file extension is a spreadsheet?",
        marks: 4,
        options: [
          [".docx", false],
          [".xlsx", true],
          [".pptx", false],
          [".mp3", false],
        ],
      },
      {
        body: "The brain of the computer is the:",
        marks: 5,
        options: [
          ["RAM", false],
          ["CPU", true],
          ["Hard disk", false],
          ["Power supply", false],
        ],
      },
    ],
    roster: {
      "stu-5": { attemptCount: 1, releasedAt: null },
      "stu-11": { attemptCount: 1, releasedAt: null },
    },
  },
  {
    id: "exam-g8-science-quiz2",
    title: "Science Quiz 2 (online)",
    lecturerId: "lec-2",
    mode: "online_mcq",
    status: "published",
    courseIds: ["co-g8-science", "co-g10-science"],
    opensAt: "2026-11-05T08:00:00+05:30",
    closesAt: "2026-11-11T20:00:00+05:30",
    timeLimitMinutes: 45,
    maxAttempts: 1,
    attemptScoring: "latest",
    resultsVisibility: "immediate",
    createdAt: "2026-11-09",
    questions: [
      {
        body: "Which gas do plants absorb for photosynthesis?",
        marks: 4,
        options: [
          ["Oxygen", false],
          ["Carbon dioxide", true],
          ["Nitrogen", false],
          ["Hydrogen", false],
        ],
      },
      {
        body: "The unit of force is the:",
        marks: 6,
        options: [
          ["Joule", false],
          ["Watt", false],
          ["Newton", true],
          ["Pascal", false],
        ],
      },
      {
        body: "Water boils at what temperature at sea level?",
        marks: 5,
        options: [
          ["50 °C", false],
          ["90 °C", false],
          ["100 °C", true],
          ["120 °C", false],
        ],
      },
      {
        body: "Which is a renewable energy source?",
        marks: 5,
        options: [
          ["Coal", false],
          ["Diesel", false],
          ["Solar", true],
          ["Natural gas", false],
        ],
      },
    ],
    roster: {
      "stu-1": {
        attemptCount: 1,
        attemptStatus: "in_progress",
        releasedAt: null,
      },
      "stu-11": {
        attemptCount: 1,
        attemptStatus: "submitted",
        releasedAt: null,
      },
    },
  },
]

function lecturerName(lecturerId: string) {
  return (
    lecturers.find((lecturer) => lecturer.id === lecturerId)?.fullName ??
    "Unknown lecturer"
  )
}

function buildExam(seed: ExamSeed): ExamRecord {
  const questions = buildQuestions(seed.questions ?? [])
  const maxMarks =
    seed.mode === "online_mcq"
      ? questions.reduce((total, question) => total + question.marks, 0)
      : (seed.paperMaxMarks ?? 100)

  const attachedCourses = seed.courseIds
    .map((courseId) => getCourseById(courseId))
    .filter((course): course is CourseRecord => course !== undefined)

  return {
    id: seed.id,
    title: seed.title,
    lecturerId: seed.lecturerId,
    lecturerName: lecturerName(seed.lecturerId),
    mode: seed.mode,
    status: seed.status,
    courseIds: attachedCourses.map((course) => course.id),
    courseNames: attachedCourses.map((course) => course.name),
    branchNames: Array.from(
      new Set(attachedCourses.map((course) => course.branchName))
    ),
    examDate: seed.examDate ?? null,
    maxMarks,
    weight: seed.weight ?? null,
    opensAt: seed.opensAt ?? null,
    closesAt: seed.closesAt ?? null,
    timeLimitMinutes: seed.timeLimitMinutes ?? null,
    maxAttempts: seed.maxAttempts ?? null,
    attemptScoring: seed.attemptScoring ?? "best",
    resultsVisibility: seed.resultsVisibility ?? "after_release",
    questions,
    createdAt: seed.createdAt,
  }
}

const studentIndex = new Map(students.map((student) => [student.id, student]))

function buildAttempt(
  exam: ExamRecord,
  studentId: string,
  attemptNo: number,
  status: AttemptStatus
): ExamAttemptRecord {
  const skill = abilityThreshold(studentId)
  const startBase =
    exam.opensAt ?? `${exam.examDate ?? "2026-11-01"}T09:00:00+05:30`
  const startedAt = addMinutes(startBase, (attemptNo - 1) * 20)

  const answers: AttemptAnswerRecord[] = exam.questions.map(
    (question, index) => {
      const correctOption =
        question.options.find((option) => option.isCorrect) ??
        question.options[0]
      const incorrectOptions = question.options.filter(
        (option) => !option.isCorrect
      )
      const isRunning = status === "in_progress"

      // Leave the last questions unanswered while an attempt is running.
      if (isRunning && index >= exam.questions.length - 1) {
        return {
          id: `${exam.id}-${studentId}-a${attemptNo}-q${question.position}`,
          examQuestionId: question.id,
          position: question.position,
          questionBody: question.body,
          options: question.options,
          selectedOptionKey: null,
          isCorrect: null,
          marksAwarded: null,
          marks: question.marks,
        }
      }

      const roll = rollPercent(`${studentId}-${attemptNo}-${question.id}`)
      const isCorrect = roll < skill
      const chosen = isCorrect
        ? correctOption
        : incorrectOptions[
            hashString(`${studentId}-${question.id}-pick`) %
              Math.max(incorrectOptions.length, 1)
          ]

      return {
        id: `${exam.id}-${studentId}-a${attemptNo}-q${question.position}`,
        examQuestionId: question.id,
        position: question.position,
        questionBody: question.body,
        options: question.options,
        selectedOptionKey: chosen?.key ?? null,
        isCorrect,
        marksAwarded: isCorrect ? question.marks : 0,
        marks: question.marks,
      }
    }
  )

  const isRunning = status === "in_progress"
  const score = isRunning
    ? null
    : answers.reduce((total, answer) => total + (answer.marksAwarded ?? 0), 0)

  return {
    id: `${exam.id}-${studentId}-attempt-${attemptNo}`,
    attemptNo,
    startedAt,
    submittedAt: isRunning
      ? null
      : addMinutes(startedAt, exam.timeLimitMinutes ?? 60),
    score,
    status,
    answers,
  }
}

function pickCountedAttempt(
  attempts: ExamAttemptRecord[],
  scoring: ExamScoring
) {
  const graded = attempts.filter(
    (attempt) => attempt.status === "graded" || attempt.status === "submitted"
  )
  if (graded.length === 0) return attempts[attempts.length - 1] ?? null

  if (scoring === "best") {
    return graded.reduce((best, attempt) =>
      (attempt.score ?? 0) > (best.score ?? 0) ? attempt : best
    )
  }

  return graded[graded.length - 1] ?? null
}

const examResults: ExamResultRecord[] = []

for (const seed of examSeeds) {
  const exam = buildExam(seed)

  for (const [studentId, entry] of Object.entries(seed.roster)) {
    const student = studentIndex.get(studentId)
    if (!student) continue

    const enrollment = student.enrollments.find((item) =>
      exam.courseIds.includes(item.courseId)
    )

    const attemptCount = entry.attemptCount ?? 0
    const attemptStatus: AttemptStatus = entry.attemptStatus ?? "graded"

    const attempts: ExamAttemptRecord[] = []
    if (exam.mode === "online_mcq") {
      for (let number = 1; number <= attemptCount; number += 1) {
        const status = number === attemptCount ? attemptStatus : "graded"
        attempts.push(buildAttempt(exam, studentId, number, status))
      }
    }

    const countedAttempt =
      exam.mode === "online_mcq"
        ? pickCountedAttempt(attempts, exam.attemptScoring)
        : null

    // An in-progress attempt has no result yet.
    if (entry.attemptStatus === "in_progress") continue
    if (exam.mode === "online_mcq" && attemptCount === 0) continue

    const marks = entry.marks ?? countedAttempt?.score ?? 0
    const percentage = exam.maxMarks > 0 ? (marks / exam.maxMarks) * 100 : 0
    const source: ResultSource =
      entry.source ?? (exam.mode === "paper" ? "manual" : "attempt")

    examResults.push({
      id: `res-${exam.id}-${studentId}`,
      examId: exam.id,
      studentId,
      enrollmentId: enrollment?.id ?? null,
      courseId: enrollment?.courseId ?? null,
      attemptId: countedAttempt?.id ?? null,
      marks,
      maxMarks: exam.maxMarks,
      percentage,
      grade: gradeFromPercentage(percentage),
      remarks: entry.remarks ?? null,
      source,
      releasedAt: entry.releasedAt ?? null,
      updatedAt:
        entry.releasedAt ?? `${exam.examDate ?? seed.createdAt}T12:00:00+05:30`,
    })
  }
}

export const exams: ExamRecord[] = examSeeds.map(buildExam)

export const results: ExamResultRecord[] = examResults

const attemptsByExamStudent = new Map<string, ExamAttemptRecord[]>()
for (const seed of examSeeds) {
  const exam = buildExam(seed)
  for (const [studentId, entry] of Object.entries(seed.roster)) {
    if (exam.mode !== "online_mcq") continue
    const count = entry.attemptCount ?? 0
    const status = entry.attemptStatus ?? "graded"
    const attempts: ExamAttemptRecord[] = []
    for (let number = 1; number <= count; number += 1) {
      attempts.push(
        buildAttempt(
          exam,
          studentId,
          number,
          number === count ? status : "graded"
        )
      )
    }
    attemptsByExamStudent.set(`${exam.id}:${studentId}`, attempts)
  }
}

export function getExamById(examId: string) {
  return exams.find((exam) => exam.id === examId)
}

export function getExamAttempts(examId: string, studentId: string) {
  return attemptsByExamStudent.get(`${examId}:${studentId}`) ?? []
}

export function getExamResult(examId: string, studentId: string) {
  return results.find(
    (result) => result.examId === examId && result.studentId === studentId
  )
}

export function getExamCandidates(exam: ExamRecord) {
  const map = new Map<string, StudentRecord>()
  for (const courseId of exam.courseIds) {
    for (const enrollment of getCourseEnrollments(courseId)) {
      if (enrollment.status === "dropped") continue
      const student = studentIndex.get(enrollment.studentId)
      if (student) map.set(student.id, student)
    }
  }
  return Array.from(map.values())
}

export function getExamResultRows(exam: ExamRecord): ExamResultRow[] {
  return getExamCandidates(exam)
    .map((student) => {
      const result = getExamResult(exam.id, student.id) ?? null
      const attempts = getExamAttempts(exam.id, student.id)
      const countedAttempt =
        exam.mode === "online_mcq"
          ? pickCountedAttempt(attempts, exam.attemptScoring)
          : null
      const branch = getPrimaryBranch(student)
      const enrollment = student.enrollments.find((item) =>
        exam.courseIds.includes(item.courseId)
      )

      const releaseState: ReleaseState = result
        ? result.releasedAt
          ? "released"
          : "provisional"
        : "not_entered"

      const courseId = result?.courseId ?? enrollment?.courseId ?? null
      const courseName = courseId
        ? (getCourseById(courseId)?.name ?? enrollment?.courseName ?? null)
        : null

      return {
        key: `${exam.id}:${student.id}`,
        studentId: student.id,
        studentNo: student.studentNo,
        studentName: student.fullName,
        branchId: branch?.branchId ?? "br-colombo",
        branchName: branch?.branchName ?? "Colombo",
        courseId,
        courseName,
        result,
        countedAttempt,
        attempts,
        releaseState,
      }
    })
    .sort((left, right) => left.studentName.localeCompare(right.studentName))
}

export function getExamUsage(exam: ExamRecord, rows: ExamResultRow[]) {
  const entered = rows.filter((row) => row.result !== null)
  const released = entered.filter((row) => row.releaseState === "released")
  const percentages = entered.map((row) => row.result?.percentage ?? 0)

  return {
    candidates: rows.length,
    entered: entered.length,
    released: released.length,
    provisional: entered.length - released.length,
    notEntered: rows.length - entered.length,
    average:
      percentages.length > 0
        ? Math.round(
            percentages.reduce((total, value) => total + value, 0) /
              percentages.length
          )
        : 0,
    highest: percentages.length > 0 ? Math.round(Math.max(...percentages)) : 0,
    lowest: percentages.length > 0 ? Math.round(Math.min(...percentages)) : 0,
  }
}

export const examCourseOptions = courses
  .filter((course) => course.status !== "archived")
  .map((course) => ({ value: course.id, label: course.name }))
  .sort((left, right) => left.label.localeCompare(right.label))

export const examSourceFilterOptions = [
  { value: "all", label: "All sources" },
  ...(Object.entries(resultSourceLabels) as [ResultSource, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const examReleaseFilterOptions = [
  { value: "all", label: "All release states" },
  ...(Object.entries(releaseStateLabels) as [ReleaseState, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const examBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...Array.from(
    new Map(
      exams.flatMap((exam) =>
        exam.branchNames.map((name) => [name, name] as const)
      )
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export function getDefaultExamId() {
  return examSeeds[0]?.id ?? ""
}

export const RESULTS_MOCK_NOW = `${MOCK_TODAY}T12:00:00+05:30`

export function isExamWindowPast(exam: ExamRecord) {
  return exam.closesAt !== null && exam.closesAt <= RESULTS_MOCK_NOW
}

export function canCloseExam(exam: ExamRecord) {
  return exam.status === "published" && isExamWindowPast(exam)
}

export function canReleaseResults(exam: ExamRecord, rows: ExamResultRow[]) {
  return (
    exam.status === "closed" &&
    rows.some((row) => row.result !== null && row.releaseState !== "released")
  )
}
