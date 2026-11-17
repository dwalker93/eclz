/**
 * Local mock fixtures for the Exams UI demo.
 *
 * Mirrors `exam`, `exam_course`, `exam_question`, `exam_attempt` and
 * `exam_result`. Online MCQ exams carry a window, a time limit and a question
 * snapshot plan; paper exams carry a date and a total mark. Attempt and result
 * counts are mock summaries, not computed grades. Nothing here is persisted.
 */

import { getCourseById, type CourseKind } from "@/lib/courses-data"
import { questions, type QuestionOptionRecord } from "@/lib/questions-data"
import { formatDisplayDate } from "@/lib/students-data"

export type ExamMode = "online_mcq" | "paper"
export type ExamStatus = "draft" | "published" | "closed"
export type AttemptScoring = "best" | "latest"
export type ResultsVisibility = "immediate" | "after_release" | "manual"

export const examModeLabels: Record<ExamMode, string> = {
  online_mcq: "Online MCQ",
  paper: "Paper",
}

export const examStatusLabels: Record<ExamStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
}

export const attemptScoringLabels: Record<AttemptScoring, string> = {
  best: "Best attempt",
  latest: "Latest attempt",
}

export const resultsVisibilityLabels: Record<ResultsVisibility, string> = {
  immediate: "Immediately after submit",
  after_release: "After results are released",
  manual: "Manual release only",
}

export const resultsVisibilityShortLabels: Record<ResultsVisibility, string> = {
  immediate: "Immediate",
  after_release: "After release",
  manual: "Manual",
}

export const examModeOptions: { value: ExamMode; label: string }[] = [
  { value: "online_mcq", label: examModeLabels.online_mcq },
  { value: "paper", label: examModeLabels.paper },
]

export const attemptScoringOptions: { value: AttemptScoring; label: string }[] =
  Object.entries(attemptScoringLabels).map(([value, label]) => ({
    value: value as AttemptScoring,
    label,
  }))

export const resultsVisibilityOptions: {
  value: ResultsVisibility
  label: string
}[] = Object.entries(resultsVisibilityLabels).map(([value, label]) => ({
  value: value as ResultsVisibility,
  label,
}))

export const examModeFilterOptions = [
  { value: "all", label: "All modes" },
  ...examModeOptions,
]

export type ExamQuestionRecord = {
  id: string
  questionId: string
  position: number
  marks: number
  body: string
  optionCount: number
  options: QuestionOptionRecord[]
  /** True once the exam is published and the snapshot is frozen. */
  frozen: boolean
}

export type ExamCourseRecord = {
  courseId: string
  courseName: string
  courseKind: CourseKind
  branchName: string
  candidates: number
}

export type ExamAttemptSummary = {
  inProgress: number
  submitted: number
  graded: number
  expired: number
}

export type ExamResultSummary = {
  count: number
  released: number
  releasedAt: string | null
  averagePercent: number | null
}

export type ExamRecord = {
  id: string
  title: string
  mode: ExamMode
  status: ExamStatus
  lecturerId: string
  lecturerName: string
  examDate: string | null
  maxMarks: number | null
  weight: number | null
  opensAt: string | null
  closesAt: string | null
  timeLimitMinutes: number | null
  maxAttempts: number | null
  attemptScoring: AttemptScoring
  shuffleQuestions: boolean
  resultsVisibility: ResultsVisibility
  createdAt: string
  courses: ExamCourseRecord[]
  questions: ExamQuestionRecord[]
  attempts: ExamAttemptSummary
  results: ExamResultSummary
}

type ExamSeed = {
  id: string
  title: string
  mode: ExamMode
  status: ExamStatus
  lecturerId: string
  lecturerName: string
  courseIds: string[]
  examDate?: string
  maxMarks?: number
  weight?: number
  opensAt?: string
  closesAt?: string
  timeLimitMinutes?: number
  maxAttempts?: number
  attemptScoring?: AttemptScoring
  shuffleQuestions?: boolean
  resultsVisibility?: ResultsVisibility
  createdAt: string
  questionIds?: string[]
  questionMarks?: number[]
  attempts?: Partial<ExamAttemptSummary>
  results?: Partial<ExamResultSummary>
}

const examSeeds: ExamSeed[] = [
  {
    id: "ex-1",
    title: "Grade 8 Mathematics — Term 3 MCQ",
    mode: "online_mcq",
    status: "published",
    lecturerId: "lec-1",
    lecturerName: "Anushka Wijesuriya",
    courseIds: ["co-g8-maths"],
    opensAt: "2026-11-18T08:00:00+05:30",
    closesAt: "2026-11-18T12:00:00+05:30",
    timeLimitMinutes: 45,
    maxAttempts: 2,
    attemptScoring: "best",
    shuffleQuestions: true,
    resultsVisibility: "after_release",
    createdAt: "2026-11-04",
    questionIds: ["q-1", "q-2", "q-3"],
    questionMarks: [1, 2, 2],
  },
  {
    id: "ex-2",
    title: "O/L Mathematics — Practice Paper 1",
    mode: "online_mcq",
    status: "closed",
    lecturerId: "lec-1",
    lecturerName: "Anushka Wijesuriya",
    courseIds: ["co-g11-maths", "co-g11-science"],
    opensAt: "2026-10-05T17:00:00+05:30",
    closesAt: "2026-10-05T19:00:00+05:30",
    timeLimitMinutes: 60,
    maxAttempts: 1,
    attemptScoring: "latest",
    shuffleQuestions: true,
    resultsVisibility: "immediate",
    createdAt: "2026-09-24",
    questionIds: ["q-1", "q-2", "q-3", "q-4"],
    questionMarks: [1, 2, 2, 3],
    attempts: { submitted: 12, graded: 12 },
    results: {
      count: 12,
      released: 12,
      releasedAt: "2026-10-08T09:00:00+05:30",
      averagePercent: 71,
    },
  },
  {
    id: "ex-3",
    title: "Grade 9 ICT — Unit 2 Quiz",
    mode: "online_mcq",
    status: "draft",
    lecturerId: "lec-3",
    lecturerName: "Kavindu Senanayake",
    courseIds: ["co-g9-ict"],
    opensAt: "2026-12-01T09:00:00+05:30",
    closesAt: "2026-12-01T10:00:00+05:30",
    timeLimitMinutes: 30,
    maxAttempts: 1,
    attemptScoring: "best",
    shuffleQuestions: false,
    resultsVisibility: "after_release",
    createdAt: "2026-11-10",
    questionIds: ["q-7", "q-8"],
    questionMarks: [2, 1],
  },
  {
    id: "ex-4",
    title: "A/L Combined Mathematics — Paper II",
    mode: "paper",
    status: "published",
    lecturerId: "lec-1",
    lecturerName: "Anushka Wijesuriya",
    courseIds: ["co-g13-combined"],
    examDate: "2026-11-25",
    maxMarks: 100,
    weight: 40,
    resultsVisibility: "manual",
    createdAt: "2026-11-02",
  },
  {
    id: "ex-5",
    title: "Grade 11 Science — Paper I",
    mode: "paper",
    status: "closed",
    lecturerId: "lec-2",
    lecturerName: "Nadeesha Ranasinghe",
    courseIds: ["co-g11-science", "co-g10-science"],
    examDate: "2026-10-12",
    maxMarks: 50,
    resultsVisibility: "after_release",
    createdAt: "2026-09-18",
    results: { count: 18, released: 0, releasedAt: null, averagePercent: 64 },
  },
  {
    id: "ex-6",
    title: "Grade 10 Science — Mid-term paper",
    mode: "paper",
    status: "draft",
    lecturerId: "lec-5",
    lecturerName: "Dinesh Kumarasinghe",
    courseIds: ["co-g10-science"],
    examDate: "2027-01-15",
    maxMarks: 60,
    resultsVisibility: "after_release",
    createdAt: "2026-11-09",
  },
  {
    id: "ex-7",
    title: "A/L Physics — Motion MCQ",
    mode: "online_mcq",
    status: "published",
    lecturerId: "lec-5",
    lecturerName: "Dinesh Kumarasinghe",
    courseIds: ["co-g12-physics"],
    opensAt: "2026-11-12T08:00:00+05:30",
    closesAt: "2026-11-20T20:00:00+05:30",
    timeLimitMinutes: 30,
    maxAttempts: 3,
    attemptScoring: "best",
    shuffleQuestions: true,
    resultsVisibility: "immediate",
    createdAt: "2026-11-01",
    questionIds: ["q-5", "q-9"],
    questionMarks: [1, 2],
    attempts: { inProgress: 4, submitted: 6, graded: 5 },
  },
  {
    id: "ex-8",
    title: "Grade 8 Science — Cells Quiz",
    mode: "online_mcq",
    status: "closed",
    lecturerId: "lec-2",
    lecturerName: "Nadeesha Ranasinghe",
    courseIds: ["co-g8-science"],
    opensAt: "2026-09-20T08:00:00+05:30",
    closesAt: "2026-09-20T09:00:00+05:30",
    timeLimitMinutes: 20,
    maxAttempts: 1,
    attemptScoring: "latest",
    shuffleQuestions: false,
    resultsVisibility: "manual",
    createdAt: "2026-09-10",
    questionIds: ["q-6"],
    questionMarks: [1],
    attempts: { submitted: 8, graded: 8 },
    results: { count: 8, released: 0, releasedAt: null, averagePercent: 58 },
  },
]

function buildCourses(courseIds: string[]): ExamCourseRecord[] {
  return courseIds.flatMap((courseId) => {
    const course = getCourseById(courseId)

    if (!course) return []

    return [
      {
        courseId: course.id,
        courseName: course.name,
        courseKind: course.kind,
        branchName: course.branchName,
        candidates: course.capacity ?? 0,
      },
    ]
  })
}

function buildQuestions(
  examStatus: ExamStatus,
  questionIds: string[] = [],
  questionMarks: number[] = []
): ExamQuestionRecord[] {
  return questionIds.flatMap((questionId, index) => {
    const question = questions.find((item) => item.id === questionId)

    if (!question) return []

    return [
      {
        id: `${questionId}-pos-${index + 1}`,
        questionId: question.id,
        position: index + 1,
        marks: questionMarks[index] ?? question.defaultMarks,
        body: question.body,
        optionCount: question.options.length,
        options: question.options,
        frozen: examStatus !== "draft",
      },
    ]
  })
}

const emptyAttempts: ExamAttemptSummary = {
  inProgress: 0,
  submitted: 0,
  graded: 0,
  expired: 0,
}

const emptyResults: ExamResultSummary = {
  count: 0,
  released: 0,
  releasedAt: null,
  averagePercent: null,
}

export const exams: ExamRecord[] = examSeeds
  .map((seed) => ({
    id: seed.id,
    title: seed.title,
    mode: seed.mode,
    status: seed.status,
    lecturerId: seed.lecturerId,
    lecturerName: seed.lecturerName,
    examDate: seed.examDate ?? null,
    maxMarks: seed.maxMarks ?? null,
    weight: seed.weight ?? null,
    opensAt: seed.opensAt ?? null,
    closesAt: seed.closesAt ?? null,
    timeLimitMinutes: seed.timeLimitMinutes ?? null,
    maxAttempts: seed.maxAttempts ?? null,
    attemptScoring: seed.attemptScoring ?? "best",
    shuffleQuestions: seed.shuffleQuestions ?? false,
    resultsVisibility: seed.resultsVisibility ?? "after_release",
    createdAt: seed.createdAt,
    courses: buildCourses(seed.courseIds),
    questions: buildQuestions(seed.status, seed.questionIds, seed.questionMarks),
    attempts: { ...emptyAttempts, ...seed.attempts },
    results: { ...emptyResults, ...seed.results },
  }))
  .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

export function getExamById(examId: string) {
  return exams.find((exam) => exam.id === examId)
}

export function getExamTotalMarks(exam: ExamRecord) {
  if (exam.mode === "paper") return exam.maxMarks ?? 0

  return exam.questions.reduce((total, question) => total + question.marks, 0)
}

export function getExamCandidateCount(exam: ExamRecord) {
  return exam.courses.reduce((total, course) => total + course.candidates, 0)
}

export function getExamUsageCounts() {
  return {
    total: exams.length,
    draft: exams.filter((exam) => exam.status === "draft").length,
    published: exams.filter((exam) => exam.status === "published").length,
    closed: exams.filter((exam) => exam.status === "closed").length,
    online: exams.filter((exam) => exam.mode === "online_mcq").length,
    paper: exams.filter((exam) => exam.mode === "paper").length,
    candidates: exams.reduce(
      (total, exam) => total + getExamCandidateCount(exam),
      0
    ),
  }
}

export const examCourseFilterOptions = [
  { value: "all", label: "All courses" },
  ...Array.from(
    new Map(
      exams.flatMap((exam) =>
        exam.courses.map((course) => [course.courseId, course.courseName])
      )
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const examLecturerFilterOptions = [
  { value: "all", label: "All lecturers" },
  ...Array.from(
    new Map(exams.map((exam) => [exam.lecturerId, exam.lecturerName])).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

/** Short window/schedule text for the directory table. */
export function formatExamSchedule(exam: ExamRecord) {
  if (exam.mode === "paper") {
    return exam.examDate ? formatDisplayDate(exam.examDate) : "No date set"
  }

  if (!exam.opensAt || !exam.closesAt) return "Window not set"

  return `${formatDisplayDate(exam.opensAt.slice(0, 10))} → ${formatDisplayDate(
    exam.closesAt.slice(0, 10)
  )}`
}

/** Limits text: time limit + attempts for online, marks for paper. */
export function formatExamLimits(exam: ExamRecord) {
  if (exam.mode === "paper") {
    return exam.maxMarks ? `${exam.maxMarks} marks` : "Marks not set"
  }

  const time =
    exam.timeLimitMinutes === null ? "No limit" : `${exam.timeLimitMinutes} min`
  const attempts =
    exam.maxAttempts === null
      ? "unlimited attempts"
      : `${exam.maxAttempts} ${exam.maxAttempts === 1 ? "attempt" : "attempts"}`

  return `${time} · ${attempts}`
}

export type QuestionUsageRecord = {
  examId: string
  examTitle: string
  examStatus: ExamStatus
  /** True when the exam has frozen a snapshot of this question (published or closed). */
  frozen: boolean
}

/** Exams that place this bank question, with their snapshot state. */
export function getQuestionUsage(questionId: string): QuestionUsageRecord[] {
  return exams.flatMap((exam) => {
    const placement = exam.questions.find(
      (question) => question.questionId === questionId
    )

    if (!placement) return []

    return [
      {
        examId: exam.id,
        examTitle: exam.title,
        examStatus: exam.status,
        frozen: placement.frozen,
      },
    ]
  })
}

/**
 * True when any exam already holds a frozen snapshot of this question, so the
 * bank must not edit the published snapshot in place.
 */
export function isQuestionInPublishedSnapshot(questionId: string) {
  return getQuestionUsage(questionId).some((usage) => usage.frozen)
}
