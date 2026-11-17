/**
 * Local demo fixtures for the student portal UI.
 *
 * These records are intentionally self-contained and follow the public portal
 * guide. They are not connected to the database, services, APIs or auth. No QR
 * tokens, user IDs, passwords or provider secrets are modelled here.
 */

export const MOCK_TODAY = "2026-11-16"
export const MOCK_NOW = "2026-11-16T10:00:00+05:30"
export const MOCK_TIMEZONE = "Asia/Colombo"
export const MOCK_CURRENCY = "LKR"

export type AttendanceStatus = "present" | "late" | "absent" | "excused"
export type NotificationChannel = "in_app" | "email" | "sms" | "push"
export type NotificationStatus = "queued" | "sent" | "failed"

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
}

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> =
  {
    in_app: "In-app",
    email: "Email",
    sms: "SMS",
    push: "Push",
  }

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  failed: "Failed",
}

export const student = {
  fullName: "Dinuka Perera",
  preferredName: "Dinuka",
  studentNo: "STU-2024-0114",
  grade: "Grade 8",
  stage: "Junior",
  branch: "Colombo",
  joinedOn: "2024-01-15",
  contactEmail: "dinuka.perera@example.com",
  contactPhone: "+94 77 123 4567",
  initials: "DP",
} as const

export type StudentCourseStatus = "active" | "completed" | "dropped"
export type CourseAccessState = "full" | "restricted" | "ended"
export type CourseDeliveryMode = "Physical" | "Online" | "Hybrid"
export type CourseType = "Class" | "Program"

export const COURSE_STATUS_LABELS: Record<StudentCourseStatus, string> = {
  active: "Active",
  completed: "Completed",
  dropped: "Dropped",
}

export const COURSE_ACCESS_LABELS: Record<CourseAccessState, string> = {
  full: "Full access",
  restricted: "Restricted access",
  ended: "Access ended",
}

export type StudentCourse = {
  id: string
  name: string
  subject: string
  courseType: CourseType
  teachers: string[]
  branch: string
  deliveryMode: CourseDeliveryMode
  gradeLevel: string
  status: StudentCourseStatus
  attendance: {
    enabled: boolean
    rate: number | null
  }
  schedule: string
  room: string
  monthlyFee: number
  enrolledOn: string
  access: {
    state: CourseAccessState
    startsOn: string
    /** Exclusive end date. Display the last included day with formatAccessRange. */
    endsOn: string
    note?: string
  }
  intake?: {
    label: string
    startsOn: string
    endsOn: string
  }
  completedOn?: string
  droppedOn?: string
  dropNote?: string
}

export const studentCourses: StudentCourse[] = [
  {
    id: "course-maths-8",
    name: "Grade 8 Mathematics",
    subject: "Mathematics",
    courseType: "Class",
    teachers: ["Ms. Ishara Senanayake"],
    branch: "Colombo",
    deliveryMode: "Physical",
    gradeLevel: "Grade 8",
    status: "active",
    attendance: { enabled: true, rate: 96 },
    schedule: "Tuesdays & Saturdays",
    room: "Room 3B",
    monthlyFee: 4500,
    enrolledOn: "2024-01-15",
    access: {
      state: "full",
      startsOn: "2024-01-15",
      endsOn: "2027-01-16",
    },
  },
  {
    id: "course-science-8",
    name: "Grade 8 Science",
    subject: "Science",
    courseType: "Class",
    teachers: ["Mr. Ruwan Fernando"],
    branch: "Colombo",
    deliveryMode: "Physical",
    gradeLevel: "Grade 8",
    status: "active",
    attendance: { enabled: true, rate: 88 },
    schedule: "Saturdays",
    room: "Science Lab 1",
    monthlyFee: 4000,
    enrolledOn: "2024-01-15",
    access: {
      state: "full",
      startsOn: "2024-01-15",
      endsOn: "2027-01-16",
    },
  },
  {
    id: "course-english-8",
    name: "Grade 8 English Language",
    subject: "English",
    courseType: "Class",
    teachers: ["Ms. Ayesha de Silva"],
    branch: "Colombo",
    deliveryMode: "Physical",
    gradeLevel: "Grade 8",
    status: "active",
    attendance: { enabled: true, rate: 92 },
    schedule: "Sundays",
    room: "Room 2A",
    monthlyFee: 3500,
    enrolledOn: "2024-01-15",
    access: {
      state: "restricted",
      startsOn: "2024-01-15",
      endsOn: "2026-11-30",
      note: "Some lessons and course materials are unavailable. Review your fees or contact the institute office to restore full access.",
    },
  },
  {
    id: "course-maths-7",
    name: "Grade 7 Mathematics",
    subject: "Mathematics",
    courseType: "Class",
    teachers: ["Ms. Ishara Senanayake"],
    branch: "Colombo",
    deliveryMode: "Physical",
    gradeLevel: "Grade 7",
    status: "completed",
    attendance: { enabled: true, rate: 94 },
    schedule: "Tuesdays & Saturdays",
    room: "Room 3B",
    monthlyFee: 4200,
    enrolledOn: "2024-01-15",
    completedOn: "2025-12-15",
    access: {
      state: "ended",
      startsOn: "2024-01-15",
      endsOn: "2025-12-16",
    },
  },
  {
    id: "course-science-program-7",
    name: "Grade 7 Science Discovery Program",
    subject: "Science",
    courseType: "Program",
    teachers: ["Mr. Ruwan Fernando", "Ms. Nadeesha Weerasinghe"],
    branch: "Colombo",
    deliveryMode: "Hybrid",
    gradeLevel: "Grade 7",
    status: "completed",
    attendance: { enabled: true, rate: 100 },
    schedule: "Weekday workshops and one online session",
    room: "Science Lab 1",
    monthlyFee: 0,
    enrolledOn: "2025-07-05",
    completedOn: "2025-09-06",
    intake: {
      label: "2025 mid-year intake",
      startsOn: "2025-07-05",
      endsOn: "2025-08-30",
    },
    access: {
      state: "ended",
      startsOn: "2025-07-05",
      endsOn: "2025-09-07",
    },
  },
  {
    id: "course-ict-8",
    name: "Grade 8 Computer Science",
    subject: "Computer Science",
    courseType: "Class",
    teachers: ["Mr. Dinesh Jayasuriya"],
    branch: "Colombo",
    deliveryMode: "Online",
    gradeLevel: "Grade 8",
    status: "dropped",
    attendance: { enabled: false, rate: null },
    schedule: "Wednesdays",
    room: "Online classroom",
    monthlyFee: 3800,
    enrolledOn: "2026-01-15",
    droppedOn: "2026-08-28",
    dropNote:
      "This enrolment was closed on 28 Aug 2026. Contact the institute office if you think this is incorrect.",
    access: {
      state: "ended",
      startsOn: "2026-01-15",
      endsOn: "2026-08-29",
    },
  },
]

export const activeCourses = studentCourses.filter(
  (course) => course.status === "active"
)

export const nextClass = {
  courseId: "course-maths-8",
  courseName: "Grade 8 Mathematics",
  subject: "Mathematics",
  topic: "Fractions and decimals — revision",
  date: "2026-11-17",
  startsAt: "16:30",
  endsAt: "18:00",
  branch: "Colombo",
  room: "Room 3B",
  deliveryMode: "Physical" as const,
  lecturer: "Ms. Ishara Senanayake",
  notes:
    "Bring your exercise book and the practice sheet handed out last Saturday.",
}

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
}

export type WeeklyScheduleSlot = {
  id: string
  courseId: string
  courseName: string
  subject: string
  weekday: Weekday
  startsAt: string
  endsAt: string
  branch: string
  room: string
  deliveryMode: CourseDeliveryMode
  lecturer: string
}

export const weeklyScheduleSlots: WeeklyScheduleSlot[] = [
  {
    id: "slot-maths-tuesday",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    weekday: 2,
    startsAt: "16:30",
    endsAt: "18:00",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    lecturer: "Ms. Ishara Senanayake",
  },
  {
    id: "slot-maths-saturday",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    weekday: 6,
    startsAt: "08:30",
    endsAt: "10:30",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    lecturer: "Ms. Ishara Senanayake",
  },
  {
    id: "slot-science-saturday",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    weekday: 6,
    startsAt: "11:00",
    endsAt: "13:00",
    branch: "Colombo",
    room: "Science Lab 1",
    deliveryMode: "Physical",
    lecturer: "Mr. Ruwan Fernando",
  },
  {
    id: "slot-english-sunday",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    weekday: 7,
    startsAt: "09:00",
    endsAt: "10:30",
    branch: "Colombo",
    room: "Room 2A",
    deliveryMode: "Physical",
    lecturer: "Ms. Ayesha de Silva",
  },
]

export type ClassSessionStatus = "scheduled" | "held" | "cancelled"

export const CLASS_SESSION_STATUS_LABELS: Record<ClassSessionStatus, string> = {
  scheduled: "Scheduled",
  held: "Held",
  cancelled: "Cancelled",
}

export type ClassSession = {
  id: string
  courseId: string
  courseName: string
  subject: string
  date: string
  startsAt: string
  endsAt: string
  topic: string | null
  branch: string
  room: string
  deliveryMode: CourseDeliveryMode
  lecturer: string
  status: ClassSessionStatus
  note?: string
}

export const classSessions: ClassSession[] = [
  {
    id: "session-maths-2026-11-10",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    date: "2026-11-10",
    startsAt: "16:30",
    endsAt: "18:00",
    topic: "Ratio and proportion",
    branch: "Colombo",
    room: "Room 3B",
    deliveryMode: "Physical",
    lecturer: "Ms. Ishara Senanayake",
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
    lecturer: "Ms. Ishara Senanayake",
    status: "held",
  },
  {
    id: "session-science-2026-11-14",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    date: "2026-11-14",
    startsAt: "11:00",
    endsAt: "13:00",
    topic: "Acids and bases practical",
    branch: "Colombo",
    room: "Science Lab 1",
    deliveryMode: "Physical",
    lecturer: "Mr. Ruwan Fernando",
    status: "held",
  },
  {
    id: "session-english-2026-11-15",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    date: "2026-11-15",
    startsAt: "09:00",
    endsAt: "10:30",
    topic: "Reading comprehension",
    branch: "Colombo",
    room: "Room 2A",
    deliveryMode: "Physical",
    lecturer: "Ms. Ayesha de Silva",
    status: "held",
  },
  {
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
    lecturer: "Ms. Ishara Senanayake",
    status: "scheduled",
  },
  {
    id: "session-science-2026-11-18",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    date: "2026-11-18",
    startsAt: "15:00",
    endsAt: "16:30",
    topic: "Revision clinic",
    branch: "Colombo",
    room: "Science Lab 1",
    deliveryMode: "Physical",
    lecturer: "Mr. Ruwan Fernando",
    status: "cancelled",
    note: "Cancelled because the Colombo branch is closed on 18 November for staff training.",
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
    lecturer: "Ms. Ishara Senanayake",
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
    lecturer: "Ms. Ishara Senanayake",
    status: "scheduled",
  },
  {
    id: "session-science-2026-11-21",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    date: "2026-11-21",
    startsAt: "11:00",
    endsAt: "13:00",
    topic: "Simple circuits practical",
    branch: "Colombo",
    room: "Science Lab 1",
    deliveryMode: "Physical",
    lecturer: "Mr. Ruwan Fernando",
    status: "scheduled",
  },
  {
    id: "session-english-2026-11-22",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    date: "2026-11-22",
    startsAt: "09:00",
    endsAt: "10:30",
    topic: "Descriptive writing workshop",
    branch: "Colombo",
    room: "Room 2A",
    deliveryMode: "Physical",
    lecturer: "Ms. Ayesha de Silva",
    status: "scheduled",
  },
]

export type MaterialKind = "recording" | "file" | "book"
export type MaterialAccessType = "course_only" | "registered" | "paid"
export type MaterialEntitlement = "available" | "locked" | "purchased"

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  recording: "Recording",
  file: "File",
  book: "Physical book",
}

export const MATERIAL_ACCESS_LABELS: Record<MaterialAccessType, string> = {
  course_only: "Course only",
  registered: "Free for registered students",
  paid: "Paid",
}

export const MATERIAL_ENTITLEMENT_LABELS: Record<MaterialEntitlement, string> =
  {
    available: "Available",
    locked: "Locked",
    purchased: "Purchased",
  }

export type LearningMaterial = {
  id: string
  courseId: string
  courseName: string
  subject: string
  section: string
  kind: MaterialKind
  title: string
  description: string
  lecturer: string
  accessType: MaterialAccessType
  price: number | null
  entitlement: MaterialEntitlement
  publishedOn: string
  duration?: string
  fileType?: string
  pages?: number
}

export const learningMaterials: LearningMaterial[] = [
  {
    id: "material-maths-linear-equations-recording",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    section: "Week 4 · Fractions and decimals",
    kind: "recording",
    title: "Linear equations review — class recording",
    description:
      "Full recording of the Saturday revision class with worked examples and exam-style questions.",
    lecturer: "Ms. Ishara Senanayake",
    accessType: "course_only",
    price: null,
    entitlement: "available",
    publishedOn: "2026-11-14",
    duration: "1h 42m",
  },
  {
    id: "material-maths-fractions-practice",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    section: "Week 4 · Fractions and decimals",
    kind: "file",
    title: "Fractions and decimals practice sheet",
    description:
      "Practice questions for the Tuesday revision class, with space for your working.",
    lecturer: "Ms. Ishara Senanayake",
    accessType: "course_only",
    price: null,
    entitlement: "available",
    publishedOn: "2026-11-15",
    fileType: "PDF",
  },
  {
    id: "material-maths-formula-booklet",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    section: "Reference and revision",
    kind: "file",
    title: "Grade 8 Mathematics formula booklet",
    description:
      "Core formulas and definitions for the topics covered this term.",
    lecturer: "Ms. Ishara Senanayake",
    accessType: "registered",
    price: null,
    entitlement: "available",
    publishedOn: "2026-09-28",
    fileType: "PDF",
  },
  {
    id: "material-maths-workbook",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    section: "Reference and revision",
    kind: "book",
    title: "Mathematics revision workbook",
    description:
      "Printed workbook with graded exercises and a worked-answer section.",
    lecturer: "Ms. Ishara Senanayake",
    accessType: "paid",
    price: 1850,
    entitlement: "purchased",
    publishedOn: "2026-09-20",
    pages: 148,
  },
  {
    id: "material-maths-term-test-pack",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    section: "Reference and revision",
    kind: "file",
    title: "Term test preparation pack",
    description:
      "Three timed practice papers with answer schemes and topic checklists.",
    lecturer: "Ms. Ishara Senanayake",
    accessType: "paid",
    price: 950,
    entitlement: "locked",
    publishedOn: "2026-11-12",
    fileType: "PDF",
  },
  {
    id: "material-science-acids-recording",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    section: "Practical guides",
    kind: "recording",
    title: "Acids and bases practical — lab recording",
    description:
      "Recorded demonstration of the indicator tests and the practical write-up.",
    lecturer: "Mr. Ruwan Fernando",
    accessType: "course_only",
    price: null,
    entitlement: "available",
    publishedOn: "2026-11-14",
    duration: "52m",
  },
  {
    id: "material-science-circuits-guide",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    section: "Practical guides",
    kind: "file",
    title: "Simple circuits practical guide",
    description:
      "Equipment list, circuit diagrams and safety steps for Saturday's practical.",
    lecturer: "Mr. Ruwan Fernando",
    accessType: "course_only",
    price: null,
    entitlement: "available",
    publishedOn: "2026-11-09",
    fileType: "PDF",
  },
  {
    id: "material-science-lab-safety",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    section: "Course resources",
    kind: "file",
    title: "Grade 8 Science lab safety notes",
    description:
      "Branch lab rules and the safety checklist used during practical sessions.",
    lecturer: "Mr. Ruwan Fernando",
    accessType: "registered",
    price: null,
    entitlement: "available",
    publishedOn: "2026-09-22",
    fileType: "PDF",
  },
  {
    id: "material-science-workbook",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    section: "Course resources",
    kind: "book",
    title: "Science practical workbook",
    description:
      "Printed practical workbook with observation tables and revision questions.",
    lecturer: "Mr. Ruwan Fernando",
    accessType: "paid",
    price: 2200,
    entitlement: "locked",
    publishedOn: "2026-09-25",
    pages: 96,
  },
  {
    id: "material-science-matter-slides",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    section: "Revision",
    kind: "file",
    title: "States of matter revision slides",
    description:
      "Slide deck from the October revision session with key definitions and diagrams.",
    lecturer: "Mr. Ruwan Fernando",
    accessType: "course_only",
    price: null,
    entitlement: "available",
    publishedOn: "2026-10-17",
    fileType: "PDF",
  },
  {
    id: "material-english-descriptive-recording",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    section: "Week 4 · Descriptive writing",
    kind: "recording",
    title: "Descriptive writing workshop recording",
    description:
      "Workshop recording covering sensory detail, paragraph structure and editing.",
    lecturer: "Ms. Ayesha de Silva",
    accessType: "course_only",
    price: null,
    entitlement: "available",
    publishedOn: "2026-11-15",
    duration: "1h 12m",
  },
  {
    id: "material-english-writing-checklist",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    section: "Week 4 · Descriptive writing",
    kind: "file",
    title: "Descriptive writing checklist",
    description:
      "A one-page checklist to review your draft before the next class.",
    lecturer: "Ms. Ayesha de Silva",
    accessType: "registered",
    price: null,
    entitlement: "available",
    publishedOn: "2026-11-15",
    fileType: "PDF",
  },
  {
    id: "material-english-reading-answers",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    section: "Reading and grammar",
    kind: "file",
    title: "Reading comprehension answer guide",
    description:
      "Model answers and marking notes for the reading comprehension practice set.",
    lecturer: "Ms. Ayesha de Silva",
    accessType: "paid",
    price: 750,
    entitlement: "locked",
    publishedOn: "2026-11-08",
    fileType: "PDF",
  },
  {
    id: "material-english-grammar-workbook",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    section: "Reading and grammar",
    kind: "book",
    title: "English grammar workbook",
    description:
      "Printed grammar workbook with practice exercises and a progress tracker.",
    lecturer: "Ms. Ayesha de Silva",
    accessType: "paid",
    price: 1650,
    entitlement: "purchased",
    publishedOn: "2026-09-18",
    pages: 132,
  },
]

export const feeSnapshot = {
  invoiceNo: "INV-2026-1048",
  period: "November 2026",
  status: "partial" as const,
  issuedOn: "2026-11-01",
  dueDate: "2026-11-30",
  total: 12000,
  paid: 7500,
  outstanding: 4500,
  lastPayment: {
    amount: 7500,
    paidOn: "2026-11-08",
    method: "Bank transfer",
    reference: "BR-482913",
    status: "Verified" as const,
  },
}

export const upcomingExam = {
  title: "Grade 8 Mathematics — Term Test",
  courseName: "Grade 8 Mathematics",
  mode: "Paper" as const,
  date: "2026-11-21",
  startsAt: "13:30",
  endsAt: "15:00",
  venue: "Colombo Main Hall",
  maxMarks: 100,
  durationMinutes: 90,
  resultsVisibility: "After release",
  note: "No online start action is needed for this paper exam.",
}

export type ExamMode = "online_mcq" | "paper"
export type ExamResultState = "pending" | "provisional" | "released"
export type ExamAvailability =
  | "available"
  | "upcoming"
  | "in_progress"
  | "past"
  | "results"

export const EXAM_MODE_LABELS: Record<ExamMode, string> = {
  online_mcq: "Online MCQ",
  paper: "Paper",
}

export const EXAM_RESULT_STATE_LABELS: Record<ExamResultState, string> = {
  pending: "Results pending",
  provisional: "Provisional",
  released: "Released",
}

export const EXAM_AVAILABILITY_LABELS: Record<ExamAvailability, string> = {
  available: "Available now",
  upcoming: "Upcoming",
  in_progress: "In progress",
  past: "Past",
  results: "Results",
}

export type ExamQuestion = {
  id: string
  prompt: string
  options: string[]
}

export type ExamResult = {
  state: ExamResultState
  marks: number | null
  maxMarks: number
  grade: string | null
  remarks: string | null
  releasedOn?: string
}

export type StudentExam = {
  id: string
  title: string
  courseId: string
  courseName: string
  subject: string
  mode: ExamMode
  /** Opening date for online windows; exam date for paper papers. */
  date: string
  startsAt: string
  /** Closing date for online windows. Paper papers close on `date`. */
  endDate?: string
  endsAt: string
  durationMinutes: number
  maxAttempts: number
  usedAttempts: number
  venue?: string
  /** Set when a previous online attempt has been started but not submitted. */
  attemptInProgress?: boolean
  availabilityNote?: string
  instructions: string[]
  questions?: ExamQuestion[]
  result?: ExamResult
}

const scienceMatterQuestions: ExamQuestion[] = [
  {
    id: "question-science-1",
    prompt:
      "Which change of state describes a solid turning directly into a gas?",
    options: ["Sublimation", "Evaporation", "Condensation", "Melting"],
  },
  {
    id: "question-science-2",
    prompt: "Which mixture can be separated using a magnet?",
    options: [
      "Salt dissolved in water",
      "Iron filings mixed with sand",
      "Oil mixed with water",
      "Sugar mixed with sand",
    ],
  },
  {
    id: "question-science-3",
    prompt: "What is the pH of a neutral solution at room temperature?",
    options: ["0", "7", "10", "14"],
  },
  {
    id: "question-science-4",
    prompt:
      "Which piece of equipment measures the volume of a liquid most accurately?",
    options: [
      "Beaker",
      "Measuring cylinder",
      "Test tube",
      "Evaporating dish",
    ],
  },
]

const mathsFractionsQuestions: ExamQuestion[] = [
  {
    id: "question-maths-1",
    prompt: "Which fraction is equivalent to 0.75?",
    options: ["3/4", "7/5", "3/5", "4/7"],
  },
  {
    id: "question-maths-2",
    prompt: "What is 2.4 × 10?",
    options: ["0.24", "2.4", "24", "240"],
  },
  {
    id: "question-maths-3",
    prompt: "Which decimal is the largest?",
    options: ["0.089", "0.8", "0.79", "0.805"],
  },
  {
    id: "question-maths-4",
    prompt: "What is 5/8 written as a decimal?",
    options: ["0.58", "0.625", "0.85", "0.8"],
  },
]

export const studentExams: StudentExam[] = [
  {
    id: "exam-science-matter-mcq",
    title: "Unit 3 — Matter and mixtures MCQ",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    mode: "online_mcq",
    date: "2026-11-14",
    startsAt: "08:00",
    endDate: "2026-11-20",
    endsAt: "20:00",
    durationMinutes: 30,
    maxAttempts: 2,
    usedAttempts: 0,
    availabilityNote:
      "The paper is open now. You may attempt it twice; only the latest attempt would count in a live system.",
    instructions: [
      "This is a local demo. Answers are not sent, saved or scored.",
      "The paper has 4 single-answer questions.",
      "You may move between questions before submitting.",
      "The demo shows a timer but does not enforce a time limit.",
    ],
    questions: scienceMatterQuestions,
  },
  {
    id: "exam-maths-fractions-mcq",
    title: "Fractions and decimals check",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    mode: "online_mcq",
    date: "2026-11-16",
    startsAt: "08:00",
    endDate: "2026-11-18",
    endsAt: "18:00",
    durationMinutes: 25,
    maxAttempts: 2,
    usedAttempts: 1,
    attemptInProgress: true,
    availabilityNote:
      "An attempt is already in progress. This preview restarts at question 1 and does not restore saved answers.",
    instructions: [
      "This is a local demo. Answers are not sent, saved or scored.",
      "The paper has 4 single-answer questions.",
      "You may move between questions before submitting.",
      "The demo shows a timer but does not enforce a time limit.",
    ],
    questions: mathsFractionsQuestions,
  },
  {
    id: "exam-english-midterm-paper",
    title: "English Language — Mid-term paper",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    mode: "paper",
    date: "2026-11-19",
    startsAt: "09:00",
    endsAt: "11:00",
    durationMinutes: 120,
    maxAttempts: 1,
    usedAttempts: 0,
    venue: "Colombo Main Hall",
    availabilityNote:
      "Bring your student ID. No online start action is available for paper exams.",
    instructions: [
      "Arrive at the venue 15 minutes before the start time.",
      "Bring your student ID and your own pens and pencils.",
      "The paper is invigilated and has no online attempt.",
    ],
  },
  {
    id: "exam-maths-term-test",
    title: upcomingExam.title,
    courseId: "course-maths-8",
    courseName: upcomingExam.courseName,
    subject: "Mathematics",
    mode: "paper",
    date: upcomingExam.date,
    startsAt: upcomingExam.startsAt,
    endsAt: upcomingExam.endsAt,
    durationMinutes: upcomingExam.durationMinutes,
    maxAttempts: 1,
    usedAttempts: 0,
    venue: upcomingExam.venue,
    availabilityNote: upcomingExam.note,
    instructions: [
      "Arrive at the venue 15 minutes before the start time.",
      "Bring your student ID and a calculator approved by the lecturer.",
      "The paper is invigilated and has no online attempt.",
    ],
  },
  {
    id: "exam-science-practical-quiz",
    title: "Practical methods quiz",
    courseId: "course-science-8",
    courseName: "Grade 8 Science",
    subject: "Science",
    mode: "online_mcq",
    date: "2026-10-30",
    startsAt: "09:00",
    endsAt: "09:20",
    durationMinutes: 20,
    maxAttempts: 1,
    usedAttempts: 1,
    availabilityNote: "The paper window has closed.",
    instructions: [
      "The paper window has closed.",
      "Answers and correct responses are not shown in the portal.",
    ],
    result: {
      state: "released",
      marks: 18,
      maxMarks: 20,
      grade: "A",
      remarks:
        "Strong practical write-up. Revise the units for extension questions.",
      releasedOn: "2026-11-04",
    },
  },
  {
    id: "exam-maths-unit2-paper",
    title: "Unit 2 — Fractions and decimals paper",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    subject: "Mathematics",
    mode: "paper",
    date: "2026-10-10",
    startsAt: "10:00",
    endsAt: "12:00",
    durationMinutes: 120,
    maxAttempts: 1,
    usedAttempts: 1,
    venue: "Colombo Main Hall",
    availabilityNote: "The paper has been collected.",
    instructions: [
      "The paper has been collected.",
      "Correct answers are not shown in the portal.",
    ],
    result: {
      state: "provisional",
      marks: 72,
      maxMarks: 100,
      grade: "B",
      remarks:
        "Section C is awaiting moderation. Marks and grade may change before release.",
      releasedOn: "2026-10-20",
    },
  },
  {
    id: "exam-english-reading-paper",
    title: "Reading comprehension paper",
    courseId: "course-english-8",
    courseName: "Grade 8 English Language",
    subject: "English",
    mode: "paper",
    date: "2026-11-06",
    startsAt: "09:00",
    endsAt: "10:30",
    durationMinutes: 90,
    maxAttempts: 1,
    usedAttempts: 1,
    venue: "Room 2A",
    availabilityNote: "The paper has been collected. Results will appear after release.",
    instructions: [
      "The paper has been collected.",
      "Results are released by the Academic Office; no online action is needed.",
    ],
    result: {
      state: "pending",
      marks: null,
      maxMarks: 100,
      grade: null,
      remarks: null,
    },
  },
]

/**
 * Availability is derived from the mock clock. Results take precedence, then a
 * started attempt, then the exam window. No live clock is used.
 */
export function getExamAvailability(exam: StudentExam): ExamAvailability {
  if (exam.result && exam.result.state !== "pending") {
    return "results"
  }

  if (exam.attemptInProgress) {
    return "in_progress"
  }

  const opensAt = new Date(`${exam.date}T${exam.startsAt}:00+05:30`)
  const closesAt = new Date(
    `${exam.endDate ?? exam.date}T${exam.endsAt}:00+05:30`
  )
  const now = new Date(MOCK_NOW)

  if (now < opensAt) return "upcoming"
  if (now > closesAt) return "past"
  return "available"
}

export type AttendanceRecord = {
  id: string
  date: string
  courseName: string
  sessionTopic?: string
  sessionTime: string
  status: AttendanceStatus
  attendedVia: "Physical" | "Online"
  markedVia: "Manual" | "QR"
}

export const attendanceRecords: AttendanceRecord[] = [
  {
    id: "attendance-1",
    date: "2026-11-14",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Linear equations review",
    sessionTime: "8:30–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-2",
    date: "2026-11-14",
    courseName: "Grade 8 Science",
    sessionTopic: "Acids and bases practical",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-3",
    date: "2026-11-08",
    courseName: "Grade 8 English Language",
    sessionTopic: "Reading comprehension",
    sessionTime: "9:00–10:30 AM",
    status: "late",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-4",
    date: "2026-11-07",
    courseName: "Grade 8 Science",
    sessionTopic: "Simple circuits introduction",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-5",
    date: "2026-10-31",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Geometry: angles and triangles",
    sessionTime: "8:30–10:30 AM",
    status: "excused",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-6",
    date: "2026-10-31",
    courseName: "Grade 8 Science",
    sessionTopic: "Plant transport systems",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-7",
    date: "2026-10-27",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Algebraic expressions",
    sessionTime: "4:30–6:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-8",
    date: "2026-10-25",
    courseName: "Grade 8 English Language",
    sessionTopic: "Persuasive writing",
    sessionTime: "9:00–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-9",
    date: "2026-10-24",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Ratio and proportion",
    sessionTime: "8:30–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-10",
    date: "2026-10-24",
    courseName: "Grade 8 Science",
    sessionTopic: "Chemical reactions",
    sessionTime: "11:00 AM–1:00 PM",
    status: "absent",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-11",
    date: "2026-10-20",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Online revision: equations",
    sessionTime: "4:30–6:00 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "Manual",
  },
  {
    id: "attendance-12",
    date: "2026-10-18",
    courseName: "Grade 8 English Language",
    sessionTopic: "Poetry analysis",
    sessionTime: "9:00–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-13",
    date: "2026-10-17",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Directed numbers",
    sessionTime: "8:30–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-14",
    date: "2026-10-17",
    courseName: "Grade 8 Science",
    sessionTopic: "States of matter",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-15",
    date: "2026-10-13",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Fractions review",
    sessionTime: "4:30–6:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-16",
    date: "2026-10-11",
    courseName: "Grade 8 English Language",
    sessionTopic: "Grammar and punctuation",
    sessionTime: "9:00–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-17",
    date: "2026-10-10",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Decimals and percentages",
    sessionTime: "8:30–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-18",
    date: "2026-10-10",
    courseName: "Grade 8 Science",
    sessionTopic: "Mixtures and solutions",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-19",
    date: "2026-10-06",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Number patterns",
    sessionTime: "4:30–6:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-20",
    date: "2026-10-04",
    courseName: "Grade 8 English Language",
    sessionTopic: "Summary writing",
    sessionTime: "9:00–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-21",
    date: "2026-10-03",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Coordinates and graphs",
    sessionTime: "8:30–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-22",
    date: "2026-10-03",
    courseName: "Grade 8 Science",
    sessionTopic: "Forces and motion",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "attendance-23",
    date: "2026-09-29",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Integers review",
    sessionTime: "4:30–6:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-24",
    date: "2026-09-27",
    courseName: "Grade 8 English Language",
    sessionTopic: "Vocabulary building",
    sessionTime: "9:00–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "attendance-25",
    date: "2026-09-26",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Whole numbers and place value",
    sessionTime: "8:30–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
]

const attendanceStatusCounts = attendanceRecords.reduce<
  Record<AttendanceStatus, number>
>(
  (counts, record) => {
    counts[record.status] += 1
    return counts
  },
  { present: 0, late: 0, absent: 0, excused: 0 }
)

export const attendanceSummary = {
  ...attendanceStatusCounts,
  totalSessions: attendanceRecords.length,
  rate:
    attendanceRecords.length === 0
      ? 0
      : Math.round(
          ((attendanceStatusCounts.present + attendanceStatusCounts.late) /
            attendanceRecords.length) *
            100
        ),
}

export const recentAttendance = attendanceRecords.slice(0, 5)

export type Notice = {
  id: string
  title: string
  author: string
  publishedAt: string
  audience: string
  excerpt: string
  body: string
}

export const recentNotices: Notice[] = [
  {
    id: "notice-1",
    title: "November term test timetable published",
    author: "Academic Office",
    publishedAt: "2026-11-12T09:15:00+05:30",
    audience: "Grade 8 · Colombo",
    excerpt:
      "The Grade 8 term test timetable is now available. Mathematics is scheduled for Saturday 21 November.",
    body: "The Grade 8 term test timetable for the Colombo branch is now available. Mathematics will be held on Saturday 21 November from 1:30 PM to 3:00 PM in the Main Hall. Please arrive 15 minutes early with your student card and calculator. Contact the Academic Office if you have a timetable clash.",
  },
  {
    id: "notice-2",
    title: "Science practical: bring your lab book",
    author: "Mr. Ruwan Fernando",
    publishedAt: "2026-11-09T15:40:00+05:30",
    audience: "Grade 8 Science",
    excerpt:
      "This Saturday's practical covers simple circuits. Bring your lab book and a pencil.",
    body: "This Saturday's Science practical will cover simple circuits. Bring your lab book, a pencil and a ruler. Safety instructions will be given at the start of the session. Students who missed the previous practical can collect the handout from the Science Lab.",
  },
  {
    id: "notice-3",
    title: "Institute closed on 18 November",
    author: "Administration",
    publishedAt: "2026-11-05T10:00:00+05:30",
    audience: "All students",
    excerpt:
      "The Colombo branch will be closed on Wednesday 18 November for staff training.",
    body: "The Colombo branch will be closed on Wednesday 18 November for a staff training day. All weekday classes on that day are cancelled. Weekend classes will continue as scheduled. The office will reopen on Thursday 19 November at 8:30 AM.",
  },
]

export type StudentNotification = {
  id: string
  event:
    | "payment_verified"
    | "attendance_marked"
    | "exam_published"
    | "installment_due"
    | "notice"
  channel: NotificationChannel
  status: NotificationStatus
  createdAt: string
  title: string
  body: string
  read: boolean
}

export const recentNotifications: StudentNotification[] = [
  {
    id: "notification-1",
    event: "payment_verified",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-08T14:20:00+05:30",
    title: "Payment verified",
    body: "Your LKR 7,500 bank transfer for November tuition has been verified.",
    read: false,
  },
  {
    id: "notification-2",
    event: "attendance_marked",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-07T11:45:00+05:30",
    title: "Attendance recorded",
    body: "You were marked present for Grade 8 Science on Saturday 7 November.",
    read: false,
  },
  {
    id: "notification-3",
    event: "exam_published",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-06T16:10:00+05:30",
    title: "Term test scheduled",
    body: "The Grade 8 Mathematics term test has been added to your exam schedule.",
    read: true,
  },
  {
    id: "notification-4",
    event: "installment_due",
    channel: "email",
    status: "sent",
    createdAt: "2026-11-03T08:00:00+05:30",
    title: "Fee reminder",
    body: "LKR 4,500 remains on invoice INV-2026-1048, due on 30 November 2026.",
    read: true,
  },
]

export const portalModules = {
  onlineExams: true,
  contentStore: true,
  qrAttendance: true,
  gateway: false,
  email: true,
  sms: false,
  webPush: true,
} as const

function toDate(value: string) {
  return value.length === 10
    ? new Date(`${value}T12:00:00+05:30`)
    : new Date(value)
}

export function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: MOCK_TIMEZONE,
  }).format(toDate(value))
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: MOCK_TIMEZONE,
  }).format(toDate(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MOCK_TIMEZONE,
  }).format(toDate(value))
}

export function formatDateRange(startsOn: string, endsOn: string) {
  return `${formatDisplayDate(startsOn)} – ${formatDisplayDate(endsOn)}`
}

/**
 * Access end dates are exclusive. Show the last included calendar day so a
 * record ending at 2026-11-30 displays as "29 Nov 2026".
 */
export function formatAccessRange(startsOn: string, endsOn: string) {
  const lastIncludedDay = new Date(
    toDate(endsOn).getTime() - 24 * 60 * 60 * 1000
  )

  return `${formatDisplayDate(startsOn)} – ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: MOCK_TIMEZONE,
  }).format(lastIncludedDay)}`
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getWeekday(value: string): Weekday {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay()
  return (day === 0 ? 7 : day) as Weekday
}

export function getWeekStart(value: string) {
  return addDays(value, 1 - getWeekday(value))
}

export function getWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function formatWeekRange(weekStart: string) {
  const weekEnd = addDays(weekStart, 6)
  const startParts = getDateParts(weekStart)
  const endParts = getDateParts(weekEnd)

  if (weekStart.slice(0, 7) === weekEnd.slice(0, 7)) {
    return `${startParts.day} – ${endParts.day} ${endParts.month} ${weekEnd.slice(
      0,
      4
    )}`
  }

  return `${formatDisplayDate(weekStart)} – ${formatDisplayDate(weekEnd)}`
}

export function getDateParts(value: string) {
  const date = toDate(value)

  return {
    day: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      timeZone: MOCK_TIMEZONE,
    }).format(date),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: MOCK_TIMEZONE,
    }).format(date),
  }
}

export function formatTime(value: string) {
  const [hourPart, minutePart] = value.split(":")
  const hours = Number(hourPart)
  const minutes = Number(minutePart)
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 || 12

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`
}

export function formatLkr(amount: number) {
  return `${MOCK_CURRENCY} ${amount.toLocaleString("en-LK", {
    maximumFractionDigits: 0,
  })}`
}

/* --------------------------------------------------------------------------
 * Fees: invoices, installments and payment history for one student
 *
 * Local demo fixtures only. They are not connected to the database, services,
 * APIs or payment providers. Totals are pre-summed so the header, lines,
 * installments and payments stay coherent across the list and detail views.
 * No bank account numbers, card data or provider secrets are modelled here.
 * ----------------------------------------------------------------------- */

export type InvoiceStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled"

export type InvoiceLineKind = "fee" | "content" | "discount" | "adjustment"

export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue"

/**
 * Payment methods that can exist on a record. Cash is recorded at the front
 * desk by staff; it is never offered as a student-submitted method.
 */
export type PaymentMethod = "bank_transfer" | "cash" | "gateway"

export type PaymentVerificationStatus =
  | "pending_verification"
  | "verified"
  | "rejected"

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "Pending",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
  cancelled: "Cancelled",
}

export const INVOICE_LINE_KIND_LABELS: Record<InvoiceLineKind, string> = {
  fee: "Fee",
  content: "Content",
  discount: "Discount",
  adjustment: "Adjustment",
}

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending: "Pending",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash (front desk)",
  gateway: "Payment gateway",
}

export const PAYMENT_VERIFICATION_LABELS: Record<
  PaymentVerificationStatus,
  string
> = {
  pending_verification: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
}

export type InvoiceLine = {
  id: string
  kind: InvoiceLineKind
  description: string
  courseName?: string
  /** Signed: fees and content are positive, discounts are negative. */
  amount: number
  periodLabel?: string
}

export type InvoiceInstallment = {
  id: string
  seq: number
  dueDate: string
  amount: number
  amountPaid: number
  status: InstallmentStatus
}

export type StudentInvoice = {
  id: string
  invoiceNo: string
  title: string
  itemSummary: string
  branch: string
  issuedOn: string
  dueDate: string
  period?: string
  subtotal: number
  discountTotal: number
  adjustmentTotal: number
  total: number
  amountPaid: number
  balance: number
  status: InvoiceStatus
  lines: InvoiceLine[]
  installments: InvoiceInstallment[]
  note?: string
}

export type StudentPayment = {
  id: string
  method: PaymentMethod
  amount: number
  paidOn: string
  reference: string
  status: PaymentVerificationStatus
  invoiceId: string
  invoiceNo: string
  note?: string
}

/** A single branch bank destination. Only the last four digits are shown. */
export const studentBankAccounts = [
  {
    id: "ba-colombo",
    bankName: "Commercial Bank of Ceylon",
    branchName: "Colombo 03",
    accountName: "Eclz Institute (Pvt) Ltd",
    maskedNumber: "•••• 4567",
  },
] as const

export const studentInvoices: StudentInvoice[] = [
  {
    id: "inv-1048",
    invoiceNo: "INV-2026-1048",
    title: "November 2026 tuition",
    itemSummary: "Grade 8 tuition · 3 fee items",
    branch: student.branch,
    issuedOn: "2026-11-01",
    dueDate: "2026-11-30",
    period: "November 2026",
    subtotal: 12000,
    discountTotal: 0,
    adjustmentTotal: 0,
    total: 12000,
    amountPaid: 7500,
    balance: 4500,
    status: "partial",
    lines: [
      {
        id: "inv-1048-line-1",
        kind: "fee",
        description: "Grade 8 Mathematics — monthly fee",
        courseName: "Grade 8 Mathematics",
        amount: 4500,
        periodLabel: "1–30 Nov 2026",
      },
      {
        id: "inv-1048-line-2",
        kind: "fee",
        description: "Grade 8 Science — monthly fee",
        courseName: "Grade 8 Science",
        amount: 4000,
        periodLabel: "1–30 Nov 2026",
      },
      {
        id: "inv-1048-line-3",
        kind: "fee",
        description: "Grade 8 English Language — monthly fee",
        courseName: "Grade 8 English Language",
        amount: 3500,
        periodLabel: "1–30 Nov 2026",
      },
    ],
    installments: [],
    note: "Payments are applied to an invoice only after the institute verifies them.",
  },
  {
    id: "inv-1053",
    invoiceNo: "INV-2026-1053",
    title: "Science practical workbook",
    itemSummary: "Workbook · content, discount and adjustment",
    branch: student.branch,
    issuedOn: "2026-11-12",
    dueDate: "2026-12-05",
    subtotal: 2200,
    discountTotal: 200,
    adjustmentTotal: 300,
    total: 2300,
    amountPaid: 0,
    balance: 2300,
    status: "pending",
    lines: [
      {
        id: "inv-1053-line-1",
        kind: "content",
        description: "Science practical workbook (printed)",
        courseName: "Grade 8 Science",
        amount: 2200,
      },
      {
        id: "inv-1053-line-2",
        kind: "discount",
        description: "Book exchange credit (returned workbook)",
        amount: -200,
      },
      {
        id: "inv-1053-line-3",
        kind: "adjustment",
        description: "Delivery to home address",
        amount: 300,
      },
    ],
    installments: [],
    note: "The printed workbook is handed over at the branch after the payment is verified.",
  },
  {
    id: "inv-1051",
    invoiceNo: "INV-2026-1051",
    title: "Grade 8 Computer Science — November fee",
    itemSummary: "1 fee item · cancelled",
    branch: student.branch,
    issuedOn: "2026-11-01",
    dueDate: "2026-11-30",
    subtotal: 3800,
    discountTotal: 0,
    adjustmentTotal: 0,
    total: 3800,
    amountPaid: 0,
    balance: 0,
    status: "cancelled",
    lines: [
      {
        id: "inv-1051-line-1",
        kind: "fee",
        description: "Grade 8 Computer Science — monthly fee",
        courseName: "Grade 8 Computer Science",
        amount: 3800,
        periodLabel: "1–30 Nov 2026",
      },
    ],
    installments: [],
    note: "Cancelled on 2 Nov 2026 — issued for an enrolment that was already closed. No payment is due.",
  },
  {
    id: "inv-1042",
    invoiceNo: "INV-2026-1042",
    title: "October 2026 tuition",
    itemSummary: "Grade 8 tuition · 3 fee items",
    branch: student.branch,
    issuedOn: "2026-10-01",
    dueDate: "2026-10-10",
    period: "October 2026",
    subtotal: 12000,
    discountTotal: 0,
    adjustmentTotal: 0,
    total: 12000,
    amountPaid: 12000,
    balance: 0,
    status: "paid",
    lines: [
      {
        id: "inv-1042-line-1",
        kind: "fee",
        description: "Grade 8 Mathematics — monthly fee",
        courseName: "Grade 8 Mathematics",
        amount: 4500,
        periodLabel: "1–31 Oct 2026",
      },
      {
        id: "inv-1042-line-2",
        kind: "fee",
        description: "Grade 8 Science — monthly fee",
        courseName: "Grade 8 Science",
        amount: 4000,
        periodLabel: "1–31 Oct 2026",
      },
      {
        id: "inv-1042-line-3",
        kind: "fee",
        description: "Grade 8 English Language — monthly fee",
        courseName: "Grade 8 English Language",
        amount: 3500,
        periodLabel: "1–31 Oct 2026",
      },
    ],
    installments: [],
  },
  {
    id: "inv-1018",
    invoiceNo: "INV-2026-1018",
    title: "Term fees — September 2026",
    itemSummary: "Grade 8 term fees · 3 installments",
    branch: student.branch,
    issuedOn: "2026-09-01",
    dueDate: "2026-11-10",
    period: "September–November 2026",
    subtotal: 12000,
    discountTotal: 0,
    adjustmentTotal: 0,
    total: 12000,
    amountPaid: 9000,
    balance: 3000,
    status: "overdue",
    lines: [
      {
        id: "inv-1018-line-1",
        kind: "fee",
        description: "Grade 8 term fees (3 installments)",
        courseName: "Grade 8",
        amount: 12000,
        periodLabel: "Sep–Nov 2026",
      },
    ],
    installments: [
      {
        id: "inv-1018-inst-1",
        seq: 1,
        dueDate: "2026-09-10",
        amount: 4000,
        amountPaid: 4000,
        status: "paid",
      },
      {
        id: "inv-1018-inst-2",
        seq: 2,
        dueDate: "2026-10-10",
        amount: 4000,
        amountPaid: 4000,
        status: "paid",
      },
      {
        id: "inv-1018-inst-3",
        seq: 3,
        dueDate: "2026-11-10",
        amount: 4000,
        amountPaid: 1000,
        status: "overdue",
      },
    ],
    note: "The final installment is past its due date. Contact the institute office to arrange the remainder.",
  },
  {
    id: "inv-1009",
    invoiceNo: "INV-2026-1009",
    title: "Grade 7 Mathematics — final term fee",
    itemSummary: "1 fee item · waived",
    branch: student.branch,
    issuedOn: "2026-08-01",
    dueDate: "2026-08-25",
    subtotal: 4200,
    discountTotal: 0,
    adjustmentTotal: 0,
    total: 4200,
    amountPaid: 0,
    balance: 0,
    status: "waived",
    lines: [
      {
        id: "inv-1009-line-1",
        kind: "fee",
        description: "Grade 7 Mathematics — final term fee",
        courseName: "Grade 7 Mathematics",
        amount: 4200,
      },
    ],
    installments: [],
    note: "Waived on 20 Aug 2026 by the institute office. No payment is due for this invoice.",
  },
  {
    id: "inv-1002",
    invoiceNo: "INV-2026-1002",
    title: "Grade 8 Study Pack 2026 — package fee",
    itemSummary: "Package fee · 3 installments",
    branch: student.branch,
    issuedOn: "2026-01-10",
    dueDate: "2026-03-10",
    period: "January–March 2026",
    subtotal: 15000,
    discountTotal: 0,
    adjustmentTotal: 0,
    total: 15000,
    amountPaid: 15000,
    balance: 0,
    status: "paid",
    lines: [
      {
        id: "inv-1002-line-1",
        kind: "fee",
        description: "Grade 8 Study Pack 2026 — package fee",
        courseName: "Grade 8",
        amount: 15000,
        periodLabel: "Jan–Mar 2026",
      },
    ],
    installments: [
      {
        id: "inv-1002-inst-1",
        seq: 1,
        dueDate: "2026-01-10",
        amount: 5000,
        amountPaid: 5000,
        status: "paid",
      },
      {
        id: "inv-1002-inst-2",
        seq: 2,
        dueDate: "2026-02-10",
        amount: 5000,
        amountPaid: 5000,
        status: "paid",
      },
      {
        id: "inv-1002-inst-3",
        seq: 3,
        dueDate: "2026-03-10",
        amount: 5000,
        amountPaid: 5000,
        status: "paid",
      },
    ],
  },
]

export const studentPayments: StudentPayment[] = [
  {
    id: "pay-5102",
    method: "bank_transfer",
    amount: 4000,
    paidOn: "2026-11-14",
    reference: "BR-5102",
    status: "pending_verification",
    invoiceId: "inv-1048",
    invoiceNo: "INV-2026-1048",
    note: "Waiting for the finance team to verify the transfer. Your balance is unchanged until it is verified.",
  },
  {
    id: "pay-4998",
    method: "bank_transfer",
    amount: 3000,
    paidOn: "2026-11-10",
    reference: "BR-4998",
    status: "rejected",
    invoiceId: "inv-1018",
    invoiceNo: "INV-2026-1018",
    note: "The reference was not found on the branch bank statement. Nothing was added to your balance.",
  },
  {
    id: "pay-482913",
    method: "bank_transfer",
    amount: 7500,
    paidOn: "2026-11-08",
    reference: "BR-482913",
    status: "verified",
    invoiceId: "inv-1048",
    invoiceNo: "INV-2026-1048",
  },
  {
    id: "pay-0912",
    method: "cash",
    amount: 1000,
    paidOn: "2026-11-02",
    reference: "CASH-0912",
    status: "verified",
    invoiceId: "inv-1018",
    invoiceNo: "INV-2026-1018",
    note: "Recorded at the Colombo front desk.",
  },
  {
    id: "pay-4520",
    method: "bank_transfer",
    amount: 4000,
    paidOn: "2026-10-07",
    reference: "BR-4520",
    status: "verified",
    invoiceId: "inv-1018",
    invoiceNo: "INV-2026-1018",
  },
  {
    id: "pay-4711",
    method: "bank_transfer",
    amount: 12000,
    paidOn: "2026-10-06",
    reference: "BR-4711",
    status: "verified",
    invoiceId: "inv-1042",
    invoiceNo: "INV-2026-1042",
  },
  {
    id: "pay-4310",
    method: "bank_transfer",
    amount: 4000,
    paidOn: "2026-09-08",
    reference: "BR-4310",
    status: "verified",
    invoiceId: "inv-1018",
    invoiceNo: "INV-2026-1018",
  },
  {
    id: "pay-2101",
    method: "bank_transfer",
    amount: 5000,
    paidOn: "2026-03-09",
    reference: "BR-2101",
    status: "verified",
    invoiceId: "inv-1002",
    invoiceNo: "INV-2026-1002",
  },
  {
    id: "pay-1944",
    method: "bank_transfer",
    amount: 5000,
    paidOn: "2026-02-11",
    reference: "BR-1944",
    status: "verified",
    invoiceId: "inv-1002",
    invoiceNo: "INV-2026-1002",
  },
  {
    id: "pay-1802",
    method: "bank_transfer",
    amount: 5000,
    paidOn: "2026-01-12",
    reference: "BR-1802",
    status: "verified",
    invoiceId: "inv-1002",
    invoiceNo: "INV-2026-1002",
  },
]

export function isInvoiceOpen(invoice: StudentInvoice) {
  return (
    invoice.status === "pending" ||
    invoice.status === "partial" ||
    invoice.status === "overdue"
  )
}

export const openStudentInvoices = studentInvoices.filter(isInvoiceOpen)

export function getStudentInvoiceById(invoiceId: string) {
  return studentInvoices.find((invoice) => invoice.id === invoiceId)
}

export function getInvoicePayments(invoiceId: string) {
  return studentPayments.filter((payment) => payment.invoiceId === invoiceId)
}

const upcomingDueDates = openStudentInvoices
  .map((invoice) => invoice.dueDate)
  .filter((dueDate) => dueDate >= MOCK_TODAY)
  .sort()

export const billingSummary = {
  outstanding: openStudentInvoices.reduce(
    (total, invoice) => total + invoice.balance,
    0
  ),
  openCount: openStudentInvoices.length,
  overdueAmount: studentInvoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((total, invoice) => total + invoice.balance, 0),
  overdueCount: studentInvoices.filter(
    (invoice) => invoice.status === "overdue"
  ).length,
  nextDueDate: upcomingDueDates[0] ?? null,
  pendingVerificationAmount: studentPayments
    .filter((payment) => payment.status === "pending_verification")
    .reduce((total, payment) => total + payment.amount, 0),
  pendingVerificationCount: studentPayments.filter(
    (payment) => payment.status === "pending_verification"
  ).length,
}

export const invoiceStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(
    Object.entries(INVOICE_STATUS_LABELS) as [InvoiceStatus, string][]
  ).map(([value, label]) => ({ value, label })),
]

export const paymentStatusFilterOptions = [
  { value: "all", label: "All payments" },
  ...(
    Object.entries(PAYMENT_VERIFICATION_LABELS) as [
      PaymentVerificationStatus,
      string,
    ][]
  ).map(([value, label]) => ({ value, label })),
]

/* --------------------------------------------------------------------------
 * Communication: notices for one student
 *
 * Local demo fixtures only. The notice schema has no read or priority field,
 * so unread state is local presentation state and no priority is modelled.
 * Notices are targeted to everyone, the student's branch, grade, a course or
 * the student directly. `recentNotices` above stays untouched for the
 * dashboard; `studentNotices` repeats its first three entries with the richer
 * audience detail this page needs.
 * ----------------------------------------------------------------------- */

export type NoticeAudienceType =
  | "all"
  | "branch"
  | "grade"
  | "course"
  | "student"

export const NOTICE_AUDIENCE_LABELS: Record<NoticeAudienceType, string> = {
  all: "Everyone",
  branch: "Branch",
  grade: "Grade",
  course: "Course",
  student: "Just for you",
}

export type StudentNotice = {
  id: string
  title: string
  author: string
  publishedAt: string
  /** Last day the notice is shown. Date-only, compared against MOCK_TODAY. */
  expiresAt?: string
  audienceType: NoticeAudienceType
  audienceLabel: string
  courseName?: string
  excerpt: string
  body: string
}

export const studentNotices: StudentNotice[] = [
  {
    id: "notice-6",
    title: "Your payment reference BR-5102 is pending verification",
    author: "Accounts Office",
    publishedAt: "2026-11-15T11:20:00+05:30",
    audienceType: "student",
    audienceLabel: "Dinuka Perera",
    excerpt:
      "We have received your bank transfer reference for INV-2026-1048. It stays pending until the finance team verifies it.",
    body: "We received the bank transfer reference BR-5102 for invoice INV-2026-1048 (LKR 4,000) on 14 November 2026. The payment is pending verification and your invoice balance will not change until the finance team confirms it against the branch bank statement. If you did not make this transfer, contact the Accounts Office at the Colombo branch. Please keep your bank slip until the payment is verified.",
  },
  {
    id: "notice-4",
    title: "Extra Mathematics revision class on 23 November",
    author: "Ms. Ishara Senanayake",
    publishedAt: "2026-11-14T13:05:00+05:30",
    expiresAt: "2026-11-23",
    audienceType: "course",
    audienceLabel: "Grade 8 Mathematics",
    courseName: "Grade 8 Mathematics",
    excerpt:
      "A revision class for the term test will be held on Monday 23 November from 4:00 PM to 5:30 PM in Room 3B.",
    body: "An extra revision class for Grade 8 Mathematics will be held on Monday 23 November from 4:00 PM to 5:30 PM in Room 3B. We will work through past term test papers and common mistakes. Attendance is optional but recommended. Bring your exercise book, calculator and the printed revision sheet handed out this week.",
  },
  {
    id: "notice-5",
    title: "Library extended hours during term tests",
    author: "Library",
    publishedAt: "2026-11-13T08:30:00+05:30",
    expiresAt: "2026-11-28",
    audienceType: "branch",
    audienceLabel: "Colombo branch",
    excerpt:
      "The Colombo branch library is open until 7:00 PM on weekdays while term tests are running.",
    body: "While the November term tests are running, the Colombo branch library is open until 7:00 PM on weekdays and from 8:30 AM to 12:30 PM on Saturdays. Study desks are available on a first-come basis. Please keep drinks off the desks and return borrowed books to the trolley by the entrance.",
  },
  {
    id: "notice-1",
    title: "November term test timetable published",
    author: "Academic Office",
    publishedAt: "2026-11-12T09:15:00+05:30",
    audienceType: "grade",
    audienceLabel: "Grade 8 · Colombo",
    excerpt:
      "The Grade 8 term test timetable is now available. Mathematics is scheduled for Saturday 21 November.",
    body: "The Grade 8 term test timetable for the Colombo branch is now available. Mathematics will be held on Saturday 21 November from 1:30 PM to 3:00 PM in the Main Hall. Please arrive 15 minutes early with your student card and calculator. Contact the Academic Office if you have a timetable clash.",
  },
  {
    id: "notice-2",
    title: "Science practical: bring your lab book",
    author: "Mr. Ruwan Fernando",
    publishedAt: "2026-11-09T15:40:00+05:30",
    audienceType: "course",
    audienceLabel: "Grade 8 Science",
    courseName: "Grade 8 Science",
    excerpt:
      "This Saturday's practical covers simple circuits. Bring your lab book and a pencil.",
    body: "This Saturday's Science practical will cover simple circuits. Bring your lab book, a pencil and a ruler. Safety instructions will be given at the start of the session. Students who missed the previous practical can collect the handout from the Science Lab.",
  },
  {
    id: "notice-3",
    title: "Institute closed on 18 November",
    author: "Administration",
    publishedAt: "2026-11-05T10:00:00+05:30",
    audienceType: "all",
    audienceLabel: "All students",
    excerpt:
      "The Colombo branch will be closed on Wednesday 18 November for staff training.",
    body: "The Colombo branch will be closed on Wednesday 18 November for a staff training day. All weekday classes on that day are cancelled. Weekend classes will continue as scheduled. The office will reopen on Thursday 19 November at 8:30 AM.",
  },
  {
    id: "notice-7",
    title: "Annual sports meet — sign-up has closed",
    author: "Sports Office",
    publishedAt: "2026-10-20T09:00:00+05:30",
    expiresAt: "2026-11-02",
    audienceType: "grade",
    audienceLabel: "Grade 8 · Colombo",
    excerpt:
      "Sign-up for the annual sports meet closed on 2 November. Thank you to everyone who entered.",
    body: "Sign-up for the annual sports meet closed on 2 November 2026. Thank you to everyone who entered. Event lists and the practice schedule will be shared through the grade notice board. Please speak to the Sports Office if you have a question about your entry.",
  },
]

/** Matches the dashboard's initial local read set so both views agree. */
export const initialReadNoticeIds = ["notice-3"] as const

export function isNoticeExpired(notice: StudentNotice) {
  return notice.expiresAt ? notice.expiresAt < MOCK_TODAY : false
}

export const noticeAudienceFilterOptions = [
  { value: "all", label: "All audiences" },
  ...(
    Object.entries(NOTICE_AUDIENCE_LABELS) as [NoticeAudienceType, string][]
  ).map(([value, label]) => ({ value, label })),
]

/* --------------------------------------------------------------------------
 * Communication: message threads for one student
 *
 * Local demo fixtures only. `lastReadAt` stands in for a read timestamp that
 * the schema does not currently provide, so unread state is derived locally
 * and never persisted. Messages composed in the UI carry `local: true` and are
 * never sent anywhere. Only this student's own conversations are modelled.
 * ----------------------------------------------------------------------- */

export const STUDENT_MESSAGE_SENDER_ID = "student"

export type MessageParticipant = {
  id: string
  name: string
  role: string
}

export type ThreadMessage = {
  id: string
  senderId: string
  sentAt: string
  body: string
  /** Composed locally in this demo. Never sent and never delivered. */
  local?: boolean
}

export type StudentMessageThread = {
  id: string
  subject: string
  courseName?: string
  participants: MessageParticipant[]
  /** Local read timestamp used to derive unread state. */
  lastReadAt: string
  messages: ThreadMessage[]
}

const participantStudent: MessageParticipant = {
  id: STUDENT_MESSAGE_SENDER_ID,
  name: student.fullName,
  role: "Student",
}

const participantIshara: MessageParticipant = {
  id: "staff-ishara",
  name: "Ms. Ishara Senanayake",
  role: "Mathematics lecturer",
}

const participantRuwan: MessageParticipant = {
  id: "staff-ruwan",
  name: "Mr. Ruwan Fernando",
  role: "Science lecturer",
}

const participantAyesha: MessageParticipant = {
  id: "staff-ayesha",
  name: "Ms. Ayesha de Silva",
  role: "English lecturer",
}

const participantAcademicOffice: MessageParticipant = {
  id: "office-academic",
  name: "Academic Office",
  role: "Colombo branch office",
}

const participantAccounts: MessageParticipant = {
  id: "office-accounts",
  name: "Accounts Office",
  role: "Colombo branch office",
}

export const studentMessageThreads: StudentMessageThread[] = [
  {
    id: "thread-maths",
    subject: "Grade 8 Mathematics — extra revision class",
    courseName: "Grade 8 Mathematics",
    participants: [participantStudent, participantIshara],
    lastReadAt: "2026-11-15T08:00:00+05:30",
    messages: [
      {
        id: "thread-maths-1",
        senderId: participantIshara.id,
        sentAt: "2026-11-14T17:10:00+05:30",
        body: "Hello Dinuka, I have added an extra revision class on Monday 23 November at 4:00 PM for the term test. Please bring your past papers.",
      },
      {
        id: "thread-maths-2",
        senderId: STUDENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-14T18:02:00+05:30",
        body: "Thank you, Ms. Senanayake. I will be there with my exercise book and calculator.",
      },
      {
        id: "thread-maths-3",
        senderId: participantIshara.id,
        sentAt: "2026-11-15T16:20:00+05:30",
        body: "Good. We will start with question 4 from the second paper, which most students found difficult.",
      },
    ],
  },
  {
    id: "thread-billing",
    subject: "November tuition payment — INV-2026-1048",
    participants: [participantStudent, participantAccounts],
    lastReadAt: "2026-11-15T12:00:00+05:30",
    messages: [
      {
        id: "thread-billing-1",
        senderId: participantAccounts.id,
        sentAt: "2026-11-14T10:45:00+05:30",
        body: "We have received your bank transfer reference BR-5102 for LKR 4,000 against INV-2026-1048. It is pending verification and your balance stays unchanged until we confirm it.",
      },
      {
        id: "thread-billing-2",
        senderId: STUDENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-14T11:20:00+05:30",
        body: "Thank you for confirming. Should I send a photo of the bank slip to the office?",
      },
      {
        id: "thread-billing-3",
        senderId: participantAccounts.id,
        sentAt: "2026-11-14T12:05:00+05:30",
        body: "You can hand the slip to the front desk at the Colombo branch when you next visit. There is nothing more to do until then.",
      },
    ],
  },
  {
    id: "thread-english",
    subject: "English essay feedback",
    courseName: "Grade 8 English Language",
    participants: [participantStudent, participantAyesha],
    lastReadAt: "2026-11-11T09:00:00+05:30",
    messages: [
      {
        id: "thread-english-1",
        senderId: participantAyesha.id,
        sentAt: "2026-11-10T14:00:00+05:30",
        body: "Hi Dinuka, your descriptive essay was much stronger this time. Watch your paragraph openings and you will move up a grade.",
      },
      {
        id: "thread-english-2",
        senderId: STUDENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-10T19:40:00+05:30",
        body: "Thank you, Ms. de Silva. I will rewrite the second paragraph and bring it to the next class.",
      },
      {
        id: "thread-english-3",
        senderId: participantAyesha.id,
        sentAt: "2026-11-11T08:10:00+05:30",
        body: "That sounds good. Bring the rewrite on Saturday and we will look at it together.",
      },
    ],
  },
  {
    id: "thread-science",
    subject: "Science practical lab book",
    courseName: "Grade 8 Science",
    participants: [participantStudent, participantRuwan],
    lastReadAt: "2026-11-12T20:00:00+05:30",
    messages: [
      {
        id: "thread-science-1",
        senderId: participantRuwan.id,
        sentAt: "2026-11-09T16:05:00+05:30",
        body: "Please remember to bring your lab book to the next practical. We are covering simple circuits and you will record your own readings.",
      },
      {
        id: "thread-science-2",
        senderId: STUDENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-09T18:30:00+05:30",
        body: "Noted, Sir. I will bring the lab book and a pencil.",
      },
      {
        id: "thread-science-3",
        senderId: participantRuwan.id,
        sentAt: "2026-11-10T09:15:00+05:30",
        body: "Good. Safety instructions will be given at the start of the session, so please arrive on time.",
      },
    ],
  },
  {
    id: "thread-closure",
    subject: "Class rescheduled — 18 November closure",
    participants: [participantStudent, participantAcademicOffice],
    lastReadAt: "2026-11-06T00:00:00+05:30",
    messages: [
      {
        id: "thread-closure-1",
        senderId: participantAcademicOffice.id,
        sentAt: "2026-11-05T10:05:00+05:30",
        body: "The branch is closed on Wednesday 18 November for staff training. Your weekday classes that day will move to the following Saturday. Weekend classes are unchanged.",
      },
      {
        id: "thread-closure-2",
        senderId: STUDENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-05T20:15:00+05:30",
        body: "Understood, thank you for letting me know.",
      },
    ],
  },
]

/** Contacts this student may start a local demo thread with. */
export const studentMessageContacts: MessageParticipant[] = [
  participantIshara,
  participantRuwan,
  participantAyesha,
  participantAcademicOffice,
  participantAccounts,
]

export function getThreadLastMessage(thread: StudentMessageThread) {
  return thread.messages[thread.messages.length - 1]
}

export function getThreadLastMessageAt(thread: StudentMessageThread) {
  return getThreadLastMessage(thread)?.sentAt ?? ""
}

export function getThreadOtherParticipants(thread: StudentMessageThread) {
  return thread.participants.filter(
    (participant) => participant.id !== STUDENT_MESSAGE_SENDER_ID
  )
}

export function getParticipantName(
  thread: StudentMessageThread,
  participantId: string
) {
  return (
    thread.participants.find((participant) => participant.id === participantId)
      ?.name ?? "Unknown participant"
  )
}

/**
 * Unread messages are those sent by someone other than the student after the
 * last-read timestamp. `readAtOverride` lets the page apply local read state.
 */
export function getThreadUnreadCount(
  thread: StudentMessageThread,
  readAtOverride?: string
) {
  const readAt = readAtOverride ?? thread.lastReadAt

  return thread.messages.filter(
    (message) =>
      message.senderId !== STUDENT_MESSAGE_SENDER_ID && message.sentAt > readAt
  ).length
}

export function isThreadUnread(
  thread: StudentMessageThread,
  readAtOverride?: string
) {
  return getThreadUnreadCount(thread, readAtOverride) > 0
}

/* --------------------------------------------------------------------------
 * Profile: the student's own identity, contacts, branches and grade history
 *
 * Local demo fixtures only. They stay coherent with the admin student record
 * for STU-2024-0114. No QR token value, password or login field is modelled,
 * and only guardians linked to this student are listed.
 * ----------------------------------------------------------------------- */

export type StudentAccountStatus = "active" | "alumni" | "suspended"

export const STUDENT_STATUS_LABELS: Record<StudentAccountStatus, string> = {
  active: "Active",
  alumni: "Alumni",
  suspended: "Suspended",
}

export type StudentGradeStage =
  | "Primary"
  | "Junior"
  | "Ordinary level"
  | "Advanced level"

export type StudentBranchMembership = {
  id: string
  branchName: string
  isPrimary: boolean
  joinedOn: string
}

export type StudentGuardian = {
  id: string
  fullName: string
  relationship: string
  phone: string
  email: string | null
  address: string
  isPrimary: boolean
  portalEnabled: boolean
}

export type StudentGradeHistoryEntry = {
  id: string
  gradeName: string
  stage: StudentGradeStage
  fromDate: string
  /** Exclusive: the first day the student was no longer in this grade. */
  toDate: string | null
  reason: "admission" | "promotion" | "correction"
}

export const GRADE_REASON_LABELS: Record<
  StudentGradeHistoryEntry["reason"],
  string
> = {
  admission: "Admission",
  promotion: "Promotion",
  correction: "Correction",
}

export const studentProfile = {
  status: "active" as StudentAccountStatus,
  dateOfBirth: "2012-04-18",
  gender: "Male" as "Male" | "Female" | null,
  schoolName: "Royal College, Colombo",
  nic: null as string | null,
  qrCardIssued: true,
  qrCardIssuedOn: "2024-01-22",
  branches: [
    {
      id: "sb-colombo",
      branchName: "Colombo",
      isPrimary: true,
      joinedOn: "2024-01-15",
    },
    {
      id: "sb-kandy",
      branchName: "Kandy",
      isPrimary: false,
      joinedOn: "2025-06-02",
    },
  ] satisfies StudentBranchMembership[],
  guardians: [
    {
      id: "gu-1",
      fullName: "Nimal Perera",
      relationship: "Father",
      phone: "+94 71 234 5678",
      email: "nimal.perera@example.com",
      address: "24/3, Temple Road, Nugegoda",
      isPrimary: true,
      portalEnabled: true,
    },
    {
      id: "gu-2",
      fullName: "Sandya Perera",
      relationship: "Mother",
      phone: "+94 76 345 6789",
      email: "sandya.perera@example.com",
      address: "24/3, Temple Road, Nugegoda",
      isPrimary: false,
      portalEnabled: false,
    },
  ] satisfies StudentGuardian[],
  gradeHistory: [
    {
      id: "sl-1a",
      gradeName: "Grade 6",
      stage: "Junior",
      fromDate: "2024-01-15",
      toDate: "2025-01-13",
      reason: "admission",
    },
    {
      id: "sl-1b",
      gradeName: "Grade 7",
      stage: "Junior",
      fromDate: "2025-01-13",
      toDate: "2026-01-12",
      reason: "promotion",
    },
    {
      id: "sl-1c",
      gradeName: "Grade 8",
      stage: "Junior",
      fromDate: "2026-01-12",
      toDate: null,
      reason: "promotion",
    },
  ] satisfies StudentGradeHistoryEntry[],
} as const

export function calculateStudentAge(
  dateOfBirth: string,
  asOf: string = MOCK_TODAY
) {
  const birth = toDate(dateOfBirth)
  const reference = toDate(asOf)

  let age = reference.getFullYear() - birth.getFullYear()
  const hasHadBirthday =
    reference.getMonth() > birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() &&
      reference.getDate() >= birth.getDate())

  if (!hasHadBirthday) age -= 1

  return Math.max(age, 0)
}
