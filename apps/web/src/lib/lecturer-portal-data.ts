/**
 * Local demo fixtures for the lecturer portal UI.
 *
 * These records are intentionally self-contained and follow the public portal
 * guide. They are not connected to the database, services, APIs or auth, and
 * they model only one lecturer's own assigned courses, sessions, attendance,
 * exams, results, communication and optional earnings. No other lecturer's or
 * institute-wide private data is included, and no payout secrets, bank account
 * numbers or provider payloads are modelled here.
 */

import {
  MOCK_TODAY,
  type ClassSessionStatus,
  type ExamMode,
  type ExamResultState,
  type MaterialAccessType,
  type MaterialKind,
  type Weekday,
} from "@/lib/student-portal-data"

export type LecturerCourseKind = "Class" | "Program"
export type LecturerCourseStatus = "active" | "completed"
export type LecturerDeliveryMode = "Physical" | "Online" | "Hybrid"

export const lecturer = {
  fullName: "Ms. Ishara Senanayake",
  preferredName: "Ishara",
  lecturerNo: "LEC-2022-0031",
  initials: "IS",
  designation: "Mathematics lecturer",
  qualification: "B.Sc. (Hons) Mathematics, University of Colombo",
  bio: "Teaches Grade 7 to Grade 11 Mathematics at the Colombo and Kandy branches.",
  branch: "Colombo",
  joinedOn: "2022-05-09",
  contactEmail: "ishara.senanayake@example.com",
  contactPhone: "+94 77 555 1122",
  portalEnabled: true,
} as const

/**
 * Demo module/availability states for the lecturer portal. These are local
 * presentation flags only; no module check, authorization or backend behavior
 * is implemented.
 */
export const lecturerModules = {
  lecturerPortal: true,
  commissions: true,
  onlineExams: true,
  parentPortal: true,
} as const

export type LecturerCourseIntake = {
  label: string
  startsOn: string
  endsOn: string
}

export type LecturerCourse = {
  id: string
  name: string
  subject: string
  kind: LecturerCourseKind
  branch: string
  gradeLevels: string[]
  deliveryMode: LecturerDeliveryMode
  /** Term label for classes, e.g. "2026 Term 3". */
  term: string
  /** Intake window for programs, when the course runs as a scheduled intake. */
  intake?: LecturerCourseIntake
  scheduleSummary: string
  room: string
  enrolledCount: number
  capacity: number
  status: LecturerCourseStatus
  /** This lecturer's share of the teaching load for the course. */
  sharePercent: number
  coTeachers: string[]
  attendanceRate: number | null
}

export const LECTURER_COURSE_KIND_LABELS: Record<LecturerCourseKind, string> = {
  Class: "Class",
  Program: "Programme",
}

export const LECTURER_COURSE_STATUS_LABELS: Record<
  LecturerCourseStatus,
  string
> = {
  active: "Active",
  completed: "Completed",
}

/** Term for classes, or the intake label for programs. */
export function getLecturerCourseTermLabel(course: LecturerCourse) {
  return course.intake ? course.intake.label : course.term
}

export const lecturerCourses: LecturerCourse[] = [
  {
    id: "course-maths-8",
    name: "Grade 8 Mathematics",
    subject: "Mathematics",
    kind: "Class",
    branch: "Colombo",
    gradeLevels: ["Grade 8"],
    deliveryMode: "Physical",
    term: "2026 Term 3",
    scheduleSummary: "Tuesdays & Saturdays",
    room: "Room 3B",
    enrolledCount: 24,
    capacity: 30,
    status: "active",
    sharePercent: 100,
    coTeachers: [],
    attendanceRate: 92,
  },
  {
    id: "course-maths-7",
    name: "Grade 7 Mathematics",
    subject: "Mathematics",
    kind: "Class",
    branch: "Kandy",
    gradeLevels: ["Grade 7"],
    deliveryMode: "Physical",
    term: "2026 Term 3",
    scheduleSummary: "Mondays & Thursdays",
    room: "Kandy Room 1A",
    enrolledCount: 18,
    capacity: 24,
    status: "active",
    sharePercent: 60,
    coTeachers: ["Mr. Suresh Bandara"],
    attendanceRate: 88,
  },
  {
    id: "course-maths-11",
    name: "O/L Mathematics (Grade 11)",
    subject: "Mathematics",
    kind: "Class",
    branch: "Colombo",
    gradeLevels: ["Grade 11"],
    deliveryMode: "Hybrid",
    term: "2026 Term 3",
    scheduleSummary: "Saturdays & selected weekdays",
    room: "Main Hall",
    enrolledCount: 30,
    capacity: 32,
    status: "active",
    sharePercent: 100,
    coTeachers: [],
    attendanceRate: 95,
  },
  {
    id: "course-maths-revision",
    name: "O/L Mathematics Revision Programme",
    subject: "Mathematics",
    kind: "Program",
    branch: "Colombo",
    gradeLevels: ["Grade 10", "Grade 11"],
    deliveryMode: "Hybrid",
    term: "2026",
    intake: {
      label: "2026 Intake B",
      startsOn: "2026-10-01",
      endsOn: "2027-03-31",
    },
    scheduleSummary: "Sundays",
    room: "Main Hall",
    enrolledCount: 22,
    capacity: 25,
    status: "active",
    sharePercent: 50,
    coTeachers: ["Mr. Suresh Bandara"],
    attendanceRate: 87,
  },
  {
    id: "course-maths-10",
    name: "Grade 10 Mathematics",
    subject: "Mathematics",
    kind: "Class",
    branch: "Kandy",
    gradeLevels: ["Grade 10"],
    deliveryMode: "Physical",
    term: "2025 Term 4",
    scheduleSummary: "Mondays & Fridays",
    room: "Kandy Room 2B",
    enrolledCount: 20,
    capacity: 24,
    status: "completed",
    sharePercent: 100,
    coTeachers: [],
    attendanceRate: 86,
  },
]

export type LecturerSession = {
  id: string
  courseId: string
  courseName: string
  subject: string
  date: string
  startsAt: string
  endsAt: string
  topic: string
  branch: string
  room: string
  deliveryMode: LecturerDeliveryMode
  status: ClassSessionStatus
}

export const lecturerNextSession: LecturerSession = {
  id: "session-maths-2026-11-17",
  courseId: "course-maths-8",
  courseName: "Grade 8 Mathematics",
  subject: "Mathematics",
  date: "2026-11-17",
  startsAt: "16:30",
  endsAt: "18:00",
  topic: "Fractions and decimals — revision",
  branch: "Colombo",
  room: "Room 3B",
  deliveryMode: "Physical",
  status: "scheduled",
}

/**
 * All dated class sessions for this lecturer's assigned courses, most recent
 * first. Includes past (held) and upcoming (scheduled) sessions so each course
 * detail can show its own schedule.
 */
export const lecturerClassSessions: LecturerSession[] = [
  {
    id: "session-maths-2026-11-23",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-23",
    startsAt: "16:00",
    endsAt: "17:30",
    topic: "Extra revision class for the term test",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    status: "scheduled",
  },
  {
    id: "session-maths-revision-2026-11-22",
    courseId: "course-maths-revision",
    courseName: "O/L Mathematics Revision Programme",
    subject: "Mathematics",
    date: "2026-11-22",
    startsAt: "09:00",
    endsAt: "11:00",
    topic: "Sets and probability — past paper practice",
    branch: "Colombo",
    room: "Main Hall",
    deliveryMode: "Hybrid",
    status: "scheduled",
  },
  {
    id: "session-maths-2026-11-21",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-21",
    startsAt: "08:30",
    endsAt: "10:30",
    topic: "Algebra: simplifying expressions",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    status: "scheduled",
  },
  {
    id: "session-maths11-2026-11-21",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    subject: "Mathematics",
    date: "2026-11-21",
    startsAt: "13:00",
    endsAt: "15:00",
    topic: "Mock paper 2 — structured questions",
    branch: "Colombo",
    room: "Main Hall",
    deliveryMode: "Physical",
    status: "scheduled",
  },
  {
    id: "session-maths-2026-11-19",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-19",
    startsAt: "17:00",
    endsAt: "17:45",
    topic: "Online doubt clinic: fractions and decimals",
    branch: "Colombo",
    room: "Online classroom",
    deliveryMode: "Online",
    status: "scheduled",
  },
  {
    id: "session-maths7-2026-11-19",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    subject: "Mathematics",
    date: "2026-11-19",
    startsAt: "15:00",
    endsAt: "16:30",
    topic: "Percentage and simple interest",
    branch: "Kandy",
    room: "Kandy Room 1A",
    deliveryMode: "Physical",
    status: "scheduled",
  },
  lecturerNextSession,
  {
    id: "session-maths-revision-2026-11-15",
    courseId: "course-maths-revision",
    courseName: "O/L Mathematics Revision Programme",
    subject: "Mathematics",
    date: "2026-11-15",
    startsAt: "09:00",
    endsAt: "11:00",
    topic: "Quadratic equations — revision",
    branch: "Colombo",
    room: "Main Hall",
    deliveryMode: "Hybrid",
    status: "held",
  },
  {
    id: "session-maths-2026-11-14",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-14",
    startsAt: "08:30",
    endsAt: "10:30",
    topic: "Linear equations review",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    status: "held",
  },
  {
    id: "session-maths11-2026-11-14",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    subject: "Mathematics",
    date: "2026-11-14",
    startsAt: "13:00",
    endsAt: "15:00",
    topic: "Mock paper 1 — full paper under timed conditions",
    branch: "Colombo",
    room: "Main Hall",
    deliveryMode: "Physical",
    status: "held",
  },
  {
    id: "session-maths7-2026-11-12",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    subject: "Mathematics",
    date: "2026-11-12",
    startsAt: "15:00",
    endsAt: "16:30",
    topic: "Ratio and proportion",
    branch: "Kandy",
    room: "Kandy Room 1A",
    deliveryMode: "Physical",
    status: "held",
  },
  {
    id: "session-maths-2026-11-10",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-10",
    startsAt: "16:30",
    endsAt: "18:00",
    topic: "Fractions: equivalent fractions",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    status: "held",
  },
  {
    id: "session-maths7-2026-11-09",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    subject: "Mathematics",
    date: "2026-11-09",
    startsAt: "15:00",
    endsAt: "16:30",
    topic: "Fractions: addition and subtraction",
    branch: "Kandy",
    room: "Kandy Room 1A",
    deliveryMode: "Physical",
    status: "held",
  },
  {
    id: "session-maths-2026-11-03",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-03",
    startsAt: "16:30",
    endsAt: "18:00",
    topic: "Decimals: place value and rounding",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    status: "held",
  },
  {
    id: "session-maths10-2025-11-10",
    courseId: "course-maths-10",
    courseName: "Grade 10 Mathematics",
    subject: "Mathematics",
    date: "2025-11-10",
    startsAt: "15:00",
    endsAt: "17:00",
    topic: "Trigonometry revision",
    branch: "Kandy",
    room: "Kandy Room 2B",
    deliveryMode: "Physical",
    status: "held",
  },
]

/** This lecturer's soonest scheduled sessions, with the next session first. */
export const lecturerUpcomingSessions: LecturerSession[] = lecturerClassSessions
  .filter((session) => session.status === "scheduled" && session.date >= MOCK_TODAY)
  .sort((first, second) =>
    `${first.date}${first.startsAt}`.localeCompare(
      `${second.date}${second.startsAt}`
    )
  )

export function getLecturerCourseSessions(courseId: string) {
  return lecturerClassSessions
    .filter((session) => session.courseId === courseId)
    .sort((first, second) =>
      `${second.date}${second.startsAt}`.localeCompare(
        `${first.date}${first.startsAt}`
      )
    )
}

/** Class or intake label for a course, e.g. "Grade 8" or "2026 Intake B". */
export function getLecturerCourseClassLabel(course: LecturerCourse) {
  return course.intake ? course.intake.label : course.gradeLevels.join(", ")
}

export type LecturerWeeklySlot = {
  id: string
  courseId: string
  courseName: string
  subject: string
  /** Class or intake label, e.g. "Grade 8" or "2026 Intake B". */
  classLabel: string
  /** 1 = Monday ... 7 = Sunday. */
  weekday: Weekday
  startsAt: string
  endsAt: string
  branch: string
  room: string
  deliveryMode: LecturerDeliveryMode
  /** Placeholder online provider label for online or hybrid delivery. */
  onlineProvider?: string
}

export const lecturerWeeklySlots: LecturerWeeklySlot[] = [
  {
    id: "slot-maths-7-mon",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    subject: "Mathematics",
    classLabel: "Grade 7",
    weekday: 1,
    startsAt: "15:00",
    endsAt: "16:30",
    branch: "Kandy",
    room: "Kandy Room 1A",
    deliveryMode: "Physical",
  },
  {
    id: "slot-maths-8-tue",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    classLabel: "Grade 8",
    weekday: 2,
    startsAt: "16:30",
    endsAt: "18:00",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
  },
  {
    id: "slot-maths-7-thu",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    subject: "Mathematics",
    classLabel: "Grade 7",
    weekday: 4,
    startsAt: "15:00",
    endsAt: "16:30",
    branch: "Kandy",
    room: "Kandy Room 1A",
    deliveryMode: "Physical",
  },
  {
    id: "slot-maths-8-sat",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    classLabel: "Grade 8",
    weekday: 6,
    startsAt: "08:30",
    endsAt: "10:30",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
  },
  {
    id: "slot-maths-11-sat",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    subject: "Mathematics",
    classLabel: "Grade 11",
    weekday: 6,
    startsAt: "13:00",
    endsAt: "15:00",
    branch: "Colombo",
    room: "Main Hall",
    deliveryMode: "Physical",
  },
  {
    id: "slot-maths-revision-sun",
    courseId: "course-maths-revision",
    courseName: "O/L Mathematics Revision Programme",
    subject: "Mathematics",
    classLabel: "2026 Intake B",
    weekday: 7,
    startsAt: "09:00",
    endsAt: "11:00",
    branch: "Colombo",
    room: "Main Hall",
    deliveryMode: "Hybrid",
    onlineProvider: "Institute online classroom",
  },
]

export type LecturerAttendanceAttention = {
  id: string
  studentName: string
  studentNo: string
  courseId: string
  courseName: string
  attendanceRate: number
  sessionsMissed: number
  lastSeenOn: string
}

export const lecturerAttendanceAttention: LecturerAttendanceAttention[] = [
  {
    id: "att-1",
    studentName: "Kavindu Jayasuriya",
    studentNo: "STU-2024-0198",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    attendanceRate: 66,
    sessionsMissed: 8,
    lastSeenOn: "2026-11-07",
  },
  {
    id: "att-2",
    studentName: "Nethmi Alwis",
    studentNo: "STU-2024-0151",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    attendanceRate: 72,
    sessionsMissed: 6,
    lastSeenOn: "2026-11-10",
  },
  {
    id: "att-3",
    studentName: "Tharindu Silva",
    studentNo: "STU-2023-0207",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    attendanceRate: 75,
    sessionsMissed: 5,
    lastSeenOn: "2026-11-12",
  },
]

export const lecturerAttendanceSummary = {
  targetRate: 80,
  sessionsThisWeek: 6,
  awaitingMarking: 1,
  coursesBelowTarget: 1,
  studentsNeedingAttention: lecturerAttendanceAttention.length,
}

export type LecturerExamStatus = "draft" | "scheduled" | "published" | "closed"

export const LECTURER_EXAM_STATUS_LABELS: Record<LecturerExamStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  closed: "Closed",
}

export type LecturerExam = {
  id: string
  title: string
  courseId: string
  courseName: string
  mode: ExamMode
  date: string
  startsAt: string
  durationMinutes: number
  maxMarks: number
  status: LecturerExamStatus
  resultsState: ExamResultState
  enrolledCount: number
  attemptsSubmitted: number
  resultsReleasedOn?: string
}

export const lecturerExams: LecturerExam[] = [
  {
    id: "exam-maths-8-quiz",
    title: "Fractions and decimals — class quiz",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    mode: "online_mcq",
    date: "2026-11-20",
    startsAt: "16:00",
    durationMinutes: 30,
    maxMarks: 25,
    status: "published",
    resultsState: "pending",
    enrolledCount: 24,
    attemptsSubmitted: 12,
  },
  {
    id: "exam-maths-8-term",
    title: "Grade 8 term test — Mathematics",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    mode: "paper",
    date: "2026-11-21",
    startsAt: "13:30",
    durationMinutes: 90,
    maxMarks: 100,
    status: "scheduled",
    resultsState: "pending",
    enrolledCount: 24,
    attemptsSubmitted: 0,
  },
  {
    id: "exam-maths-11-mock",
    title: "O/L Mathematics mock paper 1",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    mode: "paper",
    date: "2026-11-14",
    startsAt: "13:00",
    durationMinutes: 120,
    maxMarks: 100,
    status: "closed",
    resultsState: "provisional",
    enrolledCount: 30,
    attemptsSubmitted: 0,
  },
  {
    id: "exam-maths-7-quiz",
    title: "Grade 7 monthly quiz — percentages",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    mode: "online_mcq",
    date: "2026-11-10",
    startsAt: "15:00",
    durationMinutes: 25,
    maxMarks: 20,
    status: "closed",
    resultsState: "released",
    enrolledCount: 18,
    attemptsSubmitted: 17,
    resultsReleasedOn: "2026-11-13",
  },
]

export const lecturerUpcomingExams = lecturerExams
  .filter((exam) => exam.status === "scheduled" || exam.status === "published")
  .sort((a, b) => a.date.localeCompare(b.date))

export const lecturerResultsPending = lecturerExams.filter(
  (exam) => exam.resultsState === "pending" || exam.resultsState === "provisional"
)

export function getLecturerCourseExams(courseId: string) {
  return lecturerExams
    .filter((exam) => exam.courseId === courseId)
    .sort((first, second) => first.date.localeCompare(second.date))
}

export type LecturerContentStatus = "published" | "draft"

export const LECTURER_CONTENT_STATUS_LABELS: Record<
  LecturerContentStatus,
  string
> = {
  published: "Published",
  draft: "Draft",
}

export type LecturerContentItem = {
  id: string
  courseId: string
  title: string
  description: string
  /** Recording, file or physical book. */
  kind: MaterialKind
  /** Course-only, free for registered students, or paid. */
  accessType: MaterialAccessType
  /** Only set when accessType is "paid". */
  price?: number
  section: string
  status: LecturerContentStatus
  listedOn: string
}

export const lecturerContentItems: LecturerContentItem[] = [
  {
    id: "content-maths-8-recording-1",
    courseId: "course-maths-8",
    title: "Fractions and decimals — revision recording",
    description:
      "Recorded walkthrough of comparing fractions, decimal placement and shortcut methods used in class.",
    kind: "recording",
    accessType: "course_only",
    section: "Fractions and decimals",
    status: "published",
    listedOn: "2026-11-15",
  },
  {
    id: "content-maths-8-file-1",
    courseId: "course-maths-8",
    title: "Decimals practice worksheet",
    description:
      "Printable worksheet with 20 practice items and answers for self-checking.",
    kind: "file",
    accessType: "registered",
    section: "Fractions and decimals",
    status: "published",
    listedOn: "2026-11-12",
  },
  {
    id: "content-maths-8-book-1",
    courseId: "course-maths-8",
    title: "Grade 8 Mathematics workbook — Chapter 4",
    description:
      "Workbook chapter covering fractions, decimals and percentages with graded exercises.",
    kind: "book",
    accessType: "paid",
    price: 1200,
    section: "Fractions and decimals",
    status: "published",
    listedOn: "2026-11-08",
  },
  {
    id: "content-maths-8-file-2",
    courseId: "course-maths-8",
    title: "Algebra: simplifying expressions — class notes",
    description: "Summary notes and worked examples for the next Saturday class.",
    kind: "file",
    accessType: "course_only",
    section: "Algebra",
    status: "draft",
    listedOn: "2026-11-16",
  },
  {
    id: "content-maths-7-file-1",
    courseId: "course-maths-7",
    title: "Percentages practice set",
    description: "Twenty percentage and simple-interest practice items.",
    kind: "file",
    accessType: "registered",
    section: "Percentage and simple interest",
    status: "published",
    listedOn: "2026-11-11",
  },
  {
    id: "content-maths-7-recording-1",
    courseId: "course-maths-7",
    title: "Ratio and proportion — class recording",
    description: "Short recording on writing and simplifying ratios.",
    kind: "recording",
    accessType: "course_only",
    section: "Ratio and proportion",
    status: "published",
    listedOn: "2026-11-12",
  },
  {
    id: "content-maths-11-file-1",
    courseId: "course-maths-11",
    title: "Mock paper 1 — worked solutions",
    description:
      "Step-by-step solutions for the structured questions in mock paper 1.",
    kind: "file",
    accessType: "course_only",
    section: "Mock papers",
    status: "published",
    listedOn: "2026-11-15",
  },
  {
    id: "content-maths-11-file-2",
    courseId: "course-maths-11",
    title: "Mock paper 2 — marking scheme",
    description: "Marks breakdown for the upcoming mock paper 2.",
    kind: "file",
    accessType: "course_only",
    section: "Mock papers",
    status: "draft",
    listedOn: "2026-11-16",
  },
  {
    id: "content-maths-revision-file-1",
    courseId: "course-maths-revision",
    title: "Sets and probability — revision notes",
    description: "Notes and past-paper questions for the Sunday revision class.",
    kind: "file",
    accessType: "registered",
    section: "Revision",
    status: "published",
    listedOn: "2026-11-14",
  },
  {
    id: "content-maths-10-file-1",
    courseId: "course-maths-10",
    title: "Trigonometry revision notes",
    description: "Final revision notes shared before the course closed.",
    kind: "file",
    accessType: "course_only",
    section: "Trigonometry",
    status: "published",
    listedOn: "2025-11-09",
  },
]

export function getLecturerCourseContent(courseId: string) {
  return lecturerContentItems.filter((item) => item.courseId === courseId)
}

export type LecturerCourseAttendanceSummary = {
  courseId: string
  present: number
  late: number
  absent: number
  excused: number
  sessionsTracked: number
}

export const lecturerCourseAttendance: LecturerCourseAttendanceSummary[] = [
  {
    courseId: "course-maths-8",
    present: 212,
    late: 8,
    absent: 16,
    excused: 4,
    sessionsTracked: 10,
  },
  {
    courseId: "course-maths-7",
    present: 126,
    late: 6,
    absent: 14,
    excused: 4,
    sessionsTracked: 9,
  },
  {
    courseId: "course-maths-11",
    present: 184,
    late: 6,
    absent: 8,
    excused: 2,
    sessionsTracked: 8,
  },
  {
    courseId: "course-maths-revision",
    present: 84,
    late: 3,
    absent: 10,
    excused: 3,
    sessionsTracked: 5,
  },
  {
    courseId: "course-maths-10",
    present: 160,
    late: 4,
    absent: 22,
    excused: 4,
    sessionsTracked: 10,
  },
]

export function getLecturerCourseAttendance(courseId: string) {
  const summary = lecturerCourseAttendance.find(
    (entry) => entry.courseId === courseId
  )

  if (!summary) return null

  const marked =
    summary.present + summary.late + summary.absent + summary.excused

  return {
    ...summary,
    marked,
    rate:
      marked === 0 ? 0 : Math.round(((summary.present + summary.late) / marked) * 100),
  }
}

export type LecturerNoticeAudience = "all" | "branch" | "course"

export type LecturerNotice = {
  id: string
  title: string
  author: string
  publishedAt: string
  audienceType: LecturerNoticeAudience
  audienceLabel: string
  courseName?: string
  excerpt: string
  body: string
}

export const lecturerNotices: LecturerNotice[] = [
  {
    id: "lecturer-notice-1",
    title: "Term test papers due to the Academic Office by 25 November",
    author: "Academic Office",
    publishedAt: "2026-11-15T09:30:00+05:30",
    audienceType: "branch",
    audienceLabel: "Colombo lecturers",
    excerpt:
      "Print and hand in Grade 8 term test papers for moderation by Wednesday 25 November.",
    body: "Grade 8 term test papers must be printed and handed to the Academic Office for moderation by Wednesday 25 November. Include the marking scheme and the question breakdown. The moderation panel will return comments by Thursday 26 November. Contact the Academic Office if you need a later slot.",
  },
  {
    id: "lecturer-notice-2",
    title: "Staff training day — Colombo branch closed on 18 November",
    author: "Administration",
    publishedAt: "2026-11-05T10:00:00+05:30",
    audienceType: "all",
    audienceLabel: "All staff",
    excerpt:
      "The Colombo branch is closed on Wednesday 18 November. Weekday classes move to the following Saturday.",
    body: "The Colombo branch is closed on Wednesday 18 November for a staff training day. Weekday classes scheduled on that day should be moved to the following Saturday, and the timetable updated before Monday. Kandy branch classes continue as normal. The office reopens on Thursday 19 November at 8:30 AM.",
  },
  {
    id: "lecturer-notice-3",
    title: "Grade 8 Mathematics revision class added on 23 November",
    author: "Ms. Ishara Senanayake",
    publishedAt: "2026-11-14T13:05:00+05:30",
    audienceType: "course",
    audienceLabel: "Grade 8 Mathematics",
    courseName: "Grade 8 Mathematics",
    excerpt:
      "An extra revision class before the term test, published to your Grade 8 Mathematics students.",
    body: "An extra revision class for Grade 8 Mathematics will be held on Monday 23 November from 4:00 PM to 5:30 PM in Room 3B. We will work through past term test papers. This notice was published to the Grade 8 Mathematics students.",
  },
]

export const LECTURER_MESSAGE_SENDER_ID = "lecturer"

export type LecturerMessageParticipant = {
  id: string
  name: string
  role: string
}

export type LecturerThreadMessage = {
  id: string
  senderId: string
  sentAt: string
  body: string
}

export type LecturerMessageThread = {
  id: string
  subject: string
  courseName?: string
  participants: LecturerMessageParticipant[]
  lastReadAt: string
  messages: LecturerThreadMessage[]
}

const participantLecturer: LecturerMessageParticipant = {
  id: LECTURER_MESSAGE_SENDER_ID,
  name: lecturer.fullName,
  role: "Mathematics lecturer",
}

export const lecturerMessageThreads: LecturerMessageThread[] = [
  {
    id: "lecturer-thread-1",
    subject: "Term test paper moderation",
    participants: [
      participantLecturer,
      {
        id: "office-academic",
        name: "Academic Office",
        role: "Colombo branch office",
      },
    ],
    lastReadAt: "2026-11-15T09:00:00+05:30",
    messages: [
      {
        id: "lecturer-thread-1-m1",
        senderId: "office-academic",
        sentAt: "2026-11-15T11:40:00+05:30",
        body: "Could you send the Grade 8 term test marking scheme along with the paper for moderation?",
      },
    ],
  },
  {
    id: "lecturer-thread-2",
    subject: "Kavindu's attendance in Grade 8 Mathematics",
    courseName: "Grade 8 Mathematics",
    participants: [
      participantLecturer,
      {
        id: "guardian-jayasuriya",
        name: "Mr. S. Jayasuriya",
        role: "Guardian of Kavindu Jayasuriya",
      },
    ],
    lastReadAt: "2026-11-13T18:00:00+05:30",
    messages: [
      {
        id: "lecturer-thread-2-m1",
        senderId: "guardian-jayasuriya",
        sentAt: "2026-11-14T08:15:00+05:30",
        body: "Good morning. Kavindu has missed a few Tuesday classes. Could we talk before the term test?",
      },
      {
        id: "lecturer-thread-2-m2",
        senderId: LECTURER_MESSAGE_SENDER_ID,
        sentAt: "2026-11-14T09:30:00+05:30",
        body: "Of course. I am free on Saturday after 11:00 AM at the Colombo branch. We can look at the missed topics then.",
      },
    ],
  },
  {
    id: "lecturer-thread-3",
    subject: "Saturday room clash on 21 November",
    participants: [
      participantLecturer,
      {
        id: "lecturer-ruwan",
        name: "Mr. Ruwan Fernando",
        role: "Science lecturer",
      },
    ],
    lastReadAt: "2026-11-12T20:00:00+05:30",
    messages: [
      {
        id: "lecturer-thread-3-m1",
        senderId: "lecturer-ruwan",
        sentAt: "2026-11-12T14:20:00+05:30",
        body: "The Main Hall is needed for the Grade 8 term test in the afternoon. I will keep the Science Lab free from 11:00 AM for the practical.",
      },
      {
        id: "lecturer-thread-3-m2",
        senderId: LECTURER_MESSAGE_SENDER_ID,
        sentAt: "2026-11-12T15:05:00+05:30",
        body: "Thank you. My morning class is in Room 3B, so there is no clash from my side.",
      },
    ],
  },
  {
    id: "lecturer-thread-4",
    subject: "October payout confirmation",
    participants: [
      participantLecturer,
      {
        id: "office-accounts",
        name: "Accounts Office",
        role: "Colombo branch office",
      },
    ],
    lastReadAt: "2026-11-06T12:00:00+05:30",
    messages: [
      {
        id: "lecturer-thread-4-m1",
        senderId: "office-accounts",
        sentAt: "2026-11-05T09:10:00+05:30",
        body: "Your October teaching payout has been marked as paid. The payout reference is on the earnings page.",
      },
    ],
  },
]

export function getLecturerThreadLastMessage(thread: LecturerMessageThread) {
  return thread.messages[thread.messages.length - 1]
}

export function getLecturerThreadLastMessageAt(thread: LecturerMessageThread) {
  return getLecturerThreadLastMessage(thread)?.sentAt ?? ""
}

export function getLecturerThreadOtherParticipants(
  thread: LecturerMessageThread
) {
  return thread.participants.filter(
    (participant) => participant.id !== LECTURER_MESSAGE_SENDER_ID
  )
}

export function getLecturerThreadUnreadCount(
  thread: LecturerMessageThread,
  readAtOverride?: string
) {
  const readAt = readAtOverride ?? thread.lastReadAt

  return thread.messages.filter(
    (message) =>
      message.senderId !== LECTURER_MESSAGE_SENDER_ID && message.sentAt > readAt
  ).length
}

export type LecturerPayoutStatus = "draft" | "approved" | "paid"

export const LECTURER_PAYOUT_STATUS_LABELS: Record<
  LecturerPayoutStatus,
  string
> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
}

export type LecturerEarningsBreakdown = {
  courseId: string
  courseName: string
  grossBase: number
  commissionAmount: number
  netPayable: number
}

export type LecturerEarningsSummary = {
  period: string
  /** Fees attributable to this lecturer's courses for the period. */
  grossBase: number
  /** The institute's commission cut. */
  commissionAmount: number
  /** What this lecturer earns after commission (gross base - commission). */
  netPayable: number
  accrued: number
  settledThisTerm: number
  payoutStatus: LecturerPayoutStatus
  payoutReference: string | null
  lastPaidOn: string | null
  lastPaidAmount: number | null
  breakdown: LecturerEarningsBreakdown[]
}

export const lecturerEarnings: LecturerEarningsSummary = {
  period: "November 2026",
  grossBase: 361800,
  commissionAmount: 108540,
  netPayable: 253260,
  accrued: 253260,
  settledThisTerm: 198300,
  payoutStatus: "draft",
  payoutReference: null,
  lastPaidOn: "2026-11-05",
  lastPaidAmount: 198300,
  breakdown: [
    {
      courseId: "course-maths-8",
      courseName: "Grade 8 Mathematics",
      grossBase: 108000,
      commissionAmount: 32400,
      netPayable: 75600,
    },
    {
      courseId: "course-maths-7",
      courseName: "Grade 7 Mathematics",
      grossBase: 64800,
      commissionAmount: 19440,
      netPayable: 45360,
    },
    {
      courseId: "course-maths-11",
      courseName: "O/L Mathematics (Grade 11)",
      grossBase: 135000,
      commissionAmount: 40500,
      netPayable: 94500,
    },
    {
      courseId: "course-maths-revision",
      courseName: "O/L Mathematics Revision Programme",
      grossBase: 54000,
      commissionAmount: 16200,
      netPayable: 37800,
    },
  ],
}

export function getLecturerCourseById(courseId: string) {
  return lecturerCourses.find((course) => course.id === courseId)
}

export const lecturerStats = {
  coursesTaught: lecturerCourses.filter((course) => course.status === "active")
    .length,
  studentsTaught: lecturerCourses
    .filter((course) => course.status === "active")
    .reduce((total, course) => total + course.enrolledCount, 0),
  sessionsThisWeek: lecturerAttendanceSummary.sessionsThisWeek,
  upcomingExams: lecturerUpcomingExams.length,
  resultsPending: lecturerResultsPending.length,
  programmesTaught: lecturerCourses.filter(
    (course) => course.status === "active" && course.kind === "Program"
  ).length,
  coTaughtCourses: lecturerCourses.filter(
    (course) => course.coTeachers.length > 0
  ).length,
}

export function getLecturerDaysUntil(date: string) {
  const target = new Date(`${date}T12:00:00+05:30`).getTime()
  const today = new Date(`${MOCK_TODAY}T12:00:00+05:30`).getTime()

  return Math.round((target - today) / (24 * 60 * 60 * 1000))
}
