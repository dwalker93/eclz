/**
 * Local mock fixtures for the shared Question Bank.
 *
 * Mirrors `question` and `question_option` records owned by a lecturer. Exams
 * reference these questions through `exam_question` and freeze a snapshot at
 * publish. Nothing here is persisted.
 */

import { lecturers } from "@/lib/lecturers-data"

export type QuestionOptionRecord = {
  /** Stable option key used by attempt answers inside the snapshot. */
  key: string
  body: string
  isCorrect: boolean
}

export type QuestionRecord = {
  id: string
  lecturerId: string
  lecturerName: string
  subjectName: string
  body: string
  imageFileName: string | null
  explanation: string | null
  defaultMarks: number
  createdAt: string
  options: QuestionOptionRecord[]
}

function lecturerName(lecturerId: string) {
  return lecturers.find((lecturer) => lecturer.id === lecturerId)?.fullName ?? "Lecturer"
}

type QuestionSeed = Omit<QuestionRecord, "lecturerName">

const questionSeeds: QuestionSeed[] = [
  {
    id: "q-1",
    lecturerId: "lec-1",
    subjectName: "Mathematics",
    body: "What is the value of 7 × 8 − 6 ÷ 2?",
    imageFileName: null,
    explanation: "Multiplication and division come before subtraction: 56 − 3 = 53.",
    defaultMarks: 1,
    createdAt: "2026-06-02",
    options: [
      { key: "A", body: "53", isCorrect: true },
      { key: "B", body: "50", isCorrect: false },
      { key: "C", body: "47", isCorrect: false },
      { key: "D", body: "44", isCorrect: false },
    ],
  },
  {
    id: "q-2",
    lecturerId: "lec-1",
    subjectName: "Mathematics",
    body: "Simplify 3(x + 4) − 2x.",
    imageFileName: null,
    explanation: "Expand to 3x + 12 − 2x, then collect like terms to get x + 12.",
    defaultMarks: 2,
    createdAt: "2026-06-02",
    options: [
      { key: "A", body: "x + 12", isCorrect: true },
      { key: "B", body: "x + 4", isCorrect: false },
      { key: "C", body: "5x + 12", isCorrect: false },
      { key: "D", body: "x − 12", isCorrect: false },
    ],
  },
  {
    id: "q-3",
    lecturerId: "lec-1",
    subjectName: "Mathematics",
    body: "The gradient of the straight line 2y = 6x + 4 is:",
    imageFileName: null,
    explanation: "Rearrange to y = 3x + 2, so the gradient is 3.",
    defaultMarks: 2,
    createdAt: "2026-07-11",
    options: [
      { key: "A", body: "2", isCorrect: false },
      { key: "B", body: "3", isCorrect: true },
      { key: "C", body: "6", isCorrect: false },
      { key: "D", body: "4", isCorrect: false },
    ],
  },
  {
    id: "q-4",
    lecturerId: "lec-1",
    subjectName: "Mathematics",
    body: "∫ 2x dx equals:",
    imageFileName: null,
    explanation: "Raise the power by one and divide: x² + C.",
    defaultMarks: 3,
    createdAt: "2026-08-19",
    options: [
      { key: "A", body: "x² + C", isCorrect: true },
      { key: "B", body: "2x² + C", isCorrect: false },
      { key: "C", body: "x²⁄2 + C", isCorrect: false },
      { key: "D", body: "2 + C", isCorrect: false },
    ],
  },
  {
    id: "q-5",
    lecturerId: "lec-2",
    subjectName: "Physics",
    body: "The SI unit of force is the:",
    imageFileName: null,
    explanation: "Force is measured in newtons (N).",
    defaultMarks: 1,
    createdAt: "2026-05-14",
    options: [
      { key: "A", body: "joule", isCorrect: false },
      { key: "B", body: "newton", isCorrect: true },
      { key: "C", body: "pascal", isCorrect: false },
      { key: "D", body: "watt", isCorrect: false },
    ],
  },
  {
    id: "q-6",
    lecturerId: "lec-2",
    subjectName: "Science",
    body: "Which gas do plants absorb from the air during photosynthesis?",
    imageFileName: "leaf-cross-section.png",
    explanation: "Plants take in carbon dioxide and release oxygen.",
    defaultMarks: 1,
    createdAt: "2026-05-14",
    options: [
      { key: "A", body: "Oxygen", isCorrect: false },
      { key: "B", body: "Nitrogen", isCorrect: false },
      { key: "C", body: "Carbon dioxide", isCorrect: true },
      { key: "D", body: "Hydrogen", isCorrect: false },
    ],
  },
  {
    id: "q-7",
    lecturerId: "lec-3",
    subjectName: "ICT",
    body: "Which layer of the OSI model routes packets between networks?",
    imageFileName: null,
    explanation: "The network layer handles logical addressing and routing.",
    defaultMarks: 2,
    createdAt: "2026-04-22",
    options: [
      { key: "A", body: "Transport", isCorrect: false },
      { key: "B", body: "Network", isCorrect: true },
      { key: "C", body: "Data link", isCorrect: false },
      { key: "D", body: "Session", isCorrect: false },
    ],
  },
  {
    id: "q-8",
    lecturerId: "lec-3",
    subjectName: "ICT",
    body: "In a spreadsheet, which function returns the average of a range?",
    imageFileName: null,
    explanation: "AVERAGE returns the arithmetic mean of a range.",
    defaultMarks: 1,
    createdAt: "2026-04-22",
    options: [
      { key: "A", body: "SUM", isCorrect: false },
      { key: "B", body: "COUNT", isCorrect: false },
      { key: "C", body: "AVERAGE", isCorrect: true },
      { key: "D", body: "MAX", isCorrect: false },
    ],
  },
  {
    id: "q-9",
    lecturerId: "lec-5",
    subjectName: "Physics",
    body: "A body moving with constant velocity has:",
    imageFileName: null,
    explanation: "Constant velocity means no change in speed or direction, so acceleration is zero.",
    defaultMarks: 2,
    createdAt: "2026-09-01",
    options: [
      { key: "A", body: "zero acceleration", isCorrect: true },
      { key: "B", body: "increasing acceleration", isCorrect: false },
      { key: "C", body: "constant non-zero acceleration", isCorrect: false },
      { key: "D", body: "decreasing speed", isCorrect: false },
    ],
  },
  {
    id: "q-10",
    lecturerId: "lec-6",
    subjectName: "English",
    body: "Choose the correct word: She has ______ her homework.",
    imageFileName: null,
    explanation: "The present perfect uses the past participle “done”.",
    defaultMarks: 1,
    createdAt: "2026-03-30",
    options: [
      { key: "A", body: "did", isCorrect: false },
      { key: "B", body: "done", isCorrect: true },
      { key: "C", body: "do", isCorrect: false },
      { key: "D", body: "doing", isCorrect: false },
    ],
  },
]

export const questions: QuestionRecord[] = questionSeeds.map((seed) => ({
  ...seed,
  lecturerName: lecturerName(seed.lecturerId),
}))

export function getQuestionById(questionId: string) {
  return questions.find((question) => question.id === questionId)
}

export const questionSubjectFilterOptions = [
  { value: "all", label: "All subjects" },
  ...Array.from(new Set(questions.map((question) => question.subjectName)))
    .sort((left, right) => left.localeCompare(right))
    .map((subject) => ({ value: subject, label: subject })),
]

export const questionLecturerFilterOptions = [
  { value: "all", label: "All lecturers" },
  ...Array.from(
    new Map(
      questions.map((question) => [
        question.lecturerId,
        question.lecturerName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]
