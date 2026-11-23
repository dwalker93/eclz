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
  type AttendanceStatus,
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
  qrAttendance: true,
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
  .filter(
    (session) => session.status === "scheduled" && session.date >= MOCK_TODAY
  )
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

const lecturerAttendanceCourseIds = new Set(
  lecturerAttendanceAttention.map((entry) => entry.courseId)
)

export const lecturerAttendanceSummary = {
  targetRate: 80,
  sessionsThisWeek: 6,
  awaitingMarking: 1,
  /** Courses with at least one student below the attendance target. */
  coursesWithFollowUps: lecturerAttendanceCourseIds.size,
  studentsNeedingAttention: lecturerAttendanceAttention.length,
}

export type LecturerAttendanceMode = "Physical" | "Online"

export type LecturerAttendanceStudent = {
  id: string
  courseId: string
  studentNo: string
  fullName: string
  /** This student's attendance rate across the course so far. */
  termAttendanceRate: number
  /** Sample status for the latest held session of the course. */
  lastStatus: AttendanceStatus
  lastAttendedVia: LecturerAttendanceMode
  lastMarkedVia: "Manual" | "QR"
}

type LecturerAttendanceOverride = Partial<
  Pick<
    LecturerAttendanceStudent,
    | "studentNo"
    | "termAttendanceRate"
    | "lastStatus"
    | "lastAttendedVia"
    | "lastMarkedVia"
  >
>

const lecturerAttendancePattern: ReadonlyArray<{
  status: AttendanceStatus
  attendedVia: LecturerAttendanceMode
  markedVia: "Manual" | "QR"
}> = [
  { status: "present", attendedVia: "Physical", markedVia: "Manual" },
  { status: "present", attendedVia: "Physical", markedVia: "QR" },
  { status: "present", attendedVia: "Online", markedVia: "Manual" },
  { status: "present", attendedVia: "Physical", markedVia: "Manual" },
  { status: "late", attendedVia: "Physical", markedVia: "QR" },
  { status: "present", attendedVia: "Physical", markedVia: "Manual" },
  { status: "absent", attendedVia: "Physical", markedVia: "QR" },
  { status: "present", attendedVia: "Online", markedVia: "Manual" },
  { status: "present", attendedVia: "Physical", markedVia: "Manual" },
  { status: "excused", attendedVia: "Physical", markedVia: "Manual" },
  { status: "present", attendedVia: "Physical", markedVia: "QR" },
  { status: "present", attendedVia: "Physical", markedVia: "Manual" },
]

const lecturerAttendanceRatePattern = [
  96, 91, 88, 94, 90, 86, 98, 84, 92, 89, 93, 95, 87, 82, 90, 94, 88, 96, 85,
  92, 89, 94, 90, 87,
]

function createLecturerAttendanceRoster(
  courseId: string,
  names: string[],
  firstStudentNumber: number,
  overrides: Record<string, LecturerAttendanceOverride> = {}
): LecturerAttendanceStudent[] {
  return names.map((fullName, index) => {
    const override = overrides[fullName] ?? {}
    const pattern =
      lecturerAttendancePattern[index % lecturerAttendancePattern.length]!

    return {
      id: `${courseId}-student-${index + 1}`,
      courseId,
      fullName,
      studentNo:
        override.studentNo ??
        `STU-2024-${String(firstStudentNumber + index).padStart(4, "0")}`,
      termAttendanceRate:
        override.termAttendanceRate ??
        lecturerAttendanceRatePattern[
          index % lecturerAttendanceRatePattern.length
        ]!,
      lastStatus: override.lastStatus ?? pattern.status,
      lastAttendedVia: override.lastAttendedVia ?? pattern.attendedVia,
      lastMarkedVia: override.lastMarkedVia ?? pattern.markedVia,
    }
  })
}

const grade8MathematicsNames = [
  "Dinuka Perera",
  "Kavindu Jayasuriya",
  "Nethmi Alwis",
  "Shenali Fernando",
  "Ayesha de Silva",
  "Ravi Kumar",
  "Hasini Jayawardena",
  "Methul Weerasinghe",
  "Sanuli Rathnayake",
  "Yusuf Ahamed",
  "Tharushi Herath",
  "Isuru Gunasekara",
  "Anjali Perera",
  "Dilan Wickramasinghe",
  "Nadeesha Karunaratne",
  "Pasindu Rajapaksa",
  "Shalini Dissanayake",
  "Imran Rizwan",
  "Dewmini Ekanayake",
  "Sachin Wijesuriya",
  "Ruwanthi Abeysekara",
  "Thenuka Liyanage",
  "Malsha Peiris",
  "Arjun Selvarajah",
]

const grade7MathematicsNames = [
  "Tharindu Silva",
  "Janith Bandara",
  "Senuri Gamage",
  "Kavithma Herath",
  "Ashan Mendis",
  "Piumi Ranasinghe",
  "Dulanjana Silva",
  "Nethra Jayalath",
  "Rivindu Perera",
  "Thishani de Alwis",
  "Lahiru Weerakoon",
  "Anuki Fernando",
  "Meehindu Seneviratne",
  "Sathmi Rajakaruna",
  "Yohan Perera",
  "Hiruni Kariyawasam",
  "Devan Abeysinghe",
  "Oneli Wickramaratne",
]

const grade11MathematicsNames = [
  "Akeel Ahamed",
  "Shanika Alwis",
  "Dulaj Bandara",
  "Tharushi de Silva",
  "Kanishka Fernando",
  "Amaya Gamage",
  "Sahan Gunasekara",
  "Ishini Herath",
  "Lakmal Jayasundara",
  "Anushka Karunaratne",
  "Methmi Kularatne",
  "Rusiru Liyanage",
  "Poojani Mendis",
  "Akash Nazeer",
  "Tharushi Peiris",
  "Nipun Rajapaksa",
  "Sachini Ranatunga",
  "Dinesh Ratnayake",
  "Amandi Rodrigo",
  "Kavith Senanayake",
  "Nadeera Silva",
  "Dasun Thilakarathne",
  "Shalini Weerasinghe",
  "Praveen Wickramasinghe",
  "Hasala Wijesinghe",
  "Ruvini Abeysekara",
  "Tharindu Alahakoon",
  "Minuri Bogoda",
  "Sanjula Dharmasena",
  "Yasasi Ekanayake",
]

const revisionProgrammeNames = [
  "Ishan Abeyrathne",
  "Nethmi Bandara",
  "Chamath Dassanayake",
  "Hiruni Ekanayake",
  "Ravindu Fonseka",
  "Thilini Gunawardena",
  "Dilan Hettiarachchi",
  "Anjalee Jayasinghe",
  "Kasun Kalubowila",
  "Sachini Liyanage",
  "Mahesh Madushanka",
  "Nadeesha Nawaratne",
  "Oshadha Pathirana",
  "Piumi Rajapakshe",
  "Nuwan Samaraweera",
  "Ishara Senadheera",
  "Tharushi Thilakaratne",
  "Viraj Udawatte",
  "Sanduni Walpola",
  "Yasith Weeraratne",
  "Chathuni Wickrama",
  "Janith Yapa",
]

/**
 * Local attendance rosters for the lecturer's own active courses. Names,
 * attendance rates and last-marked states are sample data only. Students below
 * the 80% target match the dashboard follow-up list.
 */
export const lecturerAttendanceRosters: Record<
  string,
  LecturerAttendanceStudent[]
> = {
  "course-maths-8": createLecturerAttendanceRoster(
    "course-maths-8",
    grade8MathematicsNames,
    301,
    {
      "Dinuka Perera": {
        studentNo: "STU-2024-0114",
        termAttendanceRate: 94,
        lastStatus: "present",
        lastAttendedVia: "Physical",
        lastMarkedVia: "Manual",
      },
      "Kavindu Jayasuriya": {
        studentNo: "STU-2024-0198",
        termAttendanceRate: 66,
        lastStatus: "absent",
        lastAttendedVia: "Physical",
        lastMarkedVia: "Manual",
      },
      "Nethmi Alwis": {
        studentNo: "STU-2024-0151",
        termAttendanceRate: 72,
        lastStatus: "absent",
        lastAttendedVia: "Physical",
        lastMarkedVia: "QR",
      },
    }
  ),
  "course-maths-7": createLecturerAttendanceRoster(
    "course-maths-7",
    grade7MathematicsNames,
    401,
    {
      "Tharindu Silva": {
        studentNo: "STU-2023-0207",
        termAttendanceRate: 75,
        lastStatus: "absent",
        lastAttendedVia: "Physical",
        lastMarkedVia: "Manual",
      },
    }
  ),
  "course-maths-11": createLecturerAttendanceRoster(
    "course-maths-11",
    grade11MathematicsNames,
    501
  ),
  "course-maths-revision": createLecturerAttendanceRoster(
    "course-maths-revision",
    revisionProgrammeNames,
    601
  ),
}

export function getLecturerAttendanceRoster(courseId: string) {
  return lecturerAttendanceRosters[courseId] ?? []
}

/**
 * The latest held session and the next scheduled session for one of the
 * lecturer's courses. These are the attendance-review options for this demo.
 */
export function getLecturerAttendanceSessions(courseId: string) {
  const courseSessions = lecturerClassSessions.filter(
    (session) => session.courseId === courseId
  )
  const latestHeld = courseSessions
    .filter((session) => session.status === "held")
    .sort((first, second) =>
      `${second.date}${second.startsAt}`.localeCompare(
        `${first.date}${first.startsAt}`
      )
    )[0]
  const nextScheduled = courseSessions
    .filter(
      (session) => session.status === "scheduled" && session.date >= MOCK_TODAY
    )
    .sort((first, second) =>
      `${first.date}${first.startsAt}`.localeCompare(
        `${second.date}${second.startsAt}`
      )
    )[0]

  return [latestHeld, nextScheduled].filter(
    (session): session is LecturerSession => Boolean(session)
  )
}

export type LecturerExamStatus = "draft" | "scheduled" | "published" | "closed"

export const LECTURER_EXAM_STATUS_LABELS: Record<LecturerExamStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  closed: "Closed",
}

export type LecturerExamResultsVisibility =
  "immediate" | "after_close" | "manual"

export const LECTURER_EXAM_RESULTS_VISIBILITY_LABELS: Record<
  LecturerExamResultsVisibility,
  string
> = {
  immediate: "Immediately after submission",
  after_close: "After the exam closes",
  manual: "Manual release by you",
}

export type LecturerExam = {
  id: string
  title: string
  courseId: string
  courseName: string
  mode: ExamMode
  date: string
  startsAt: string
  /** Closing time of the paper or online exam window. */
  endsAt: string
  /** Time allowed per attempt. */
  durationMinutes: number
  maxAttempts: number
  questionCount: number
  maxMarks: number
  passMarks: number
  resultsVisibility: LecturerExamResultsVisibility
  /** Venue for paper exams or the online window note. */
  venue?: string
  status: LecturerExamStatus
  resultsState: ExamResultState
  enrolledCount: number
  attemptsSubmitted: number
  attemptsInProgress: number
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
    endsAt: "16:45",
    durationMinutes: 30,
    maxAttempts: 2,
    questionCount: 10,
    maxMarks: 25,
    passMarks: 10,
    resultsVisibility: "after_close",
    venue: "Online · opens 16:00, closes 16:45",
    status: "published",
    resultsState: "pending",
    enrolledCount: 24,
    attemptsSubmitted: 12,
    attemptsInProgress: 4,
  },
  {
    id: "exam-maths-8-term",
    title: "Grade 8 term test — Mathematics",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    mode: "paper",
    date: "2026-11-21",
    startsAt: "13:30",
    endsAt: "15:00",
    durationMinutes: 90,
    maxAttempts: 1,
    questionCount: 12,
    maxMarks: 100,
    passMarks: 40,
    resultsVisibility: "manual",
    venue: "Room 3B",
    status: "scheduled",
    resultsState: "pending",
    enrolledCount: 24,
    attemptsSubmitted: 0,
    attemptsInProgress: 0,
  },
  {
    id: "exam-maths-11-mock",
    title: "O/L Mathematics mock paper 1",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    mode: "paper",
    date: "2026-11-14",
    startsAt: "13:00",
    endsAt: "15:00",
    durationMinutes: 120,
    maxAttempts: 1,
    questionCount: 10,
    maxMarks: 100,
    passMarks: 40,
    resultsVisibility: "manual",
    venue: "Main Hall",
    status: "closed",
    resultsState: "provisional",
    enrolledCount: 30,
    attemptsSubmitted: 0,
    attemptsInProgress: 0,
  },
  {
    id: "exam-maths-7-quiz",
    title: "Grade 7 monthly quiz — percentages",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    mode: "online_mcq",
    date: "2026-11-10",
    startsAt: "15:00",
    endsAt: "15:45",
    durationMinutes: 25,
    maxAttempts: 2,
    questionCount: 10,
    maxMarks: 20,
    passMarks: 8,
    resultsVisibility: "after_close",
    venue: "Online · closed 15:45",
    status: "closed",
    resultsState: "released",
    enrolledCount: 18,
    attemptsSubmitted: 17,
    attemptsInProgress: 0,
    resultsReleasedOn: "2026-11-13",
  },
  {
    id: "exam-maths-7-algebra-check",
    title: "Grade 7 algebra readiness check",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    mode: "online_mcq",
    date: "2026-11-27",
    startsAt: "15:00",
    endsAt: "15:30",
    durationMinutes: 20,
    maxAttempts: 1,
    questionCount: 8,
    maxMarks: 15,
    passMarks: 6,
    resultsVisibility: "immediate",
    venue: "Online · 30 minute window",
    status: "draft",
    resultsState: "pending",
    enrolledCount: 18,
    attemptsSubmitted: 0,
    attemptsInProgress: 0,
  },
  {
    id: "exam-maths-11-diagnostic",
    title: "Grade 11 algebra diagnostic",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    mode: "online_mcq",
    date: "2026-11-12",
    startsAt: "17:00",
    endsAt: "17:30",
    durationMinutes: 20,
    maxAttempts: 1,
    questionCount: 10,
    maxMarks: 20,
    passMarks: 8,
    resultsVisibility: "after_close",
    venue: "Online · closed 17:30",
    status: "closed",
    resultsState: "provisional",
    enrolledCount: 30,
    attemptsSubmitted: 28,
    attemptsInProgress: 0,
  },
  {
    id: "exam-maths-7-term",
    title: "Grade 7 term test — Mathematics",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    mode: "paper",
    date: "2026-10-30",
    startsAt: "14:00",
    endsAt: "15:30",
    durationMinutes: 90,
    maxAttempts: 1,
    questionCount: 10,
    maxMarks: 50,
    passMarks: 20,
    resultsVisibility: "manual",
    venue: "Kandy Room 1A",
    status: "closed",
    resultsState: "released",
    enrolledCount: 18,
    attemptsSubmitted: 0,
    attemptsInProgress: 0,
    resultsReleasedOn: "2026-11-05",
  },
]

export const lecturerUpcomingExams = lecturerExams
  .filter((exam) => exam.status === "scheduled" || exam.status === "published")
  .sort((a, b) => a.date.localeCompare(b.date))

export const lecturerResultsPending = lecturerExams.filter(
  (exam) =>
    exam.status !== "draft" &&
    (exam.resultsState === "pending" || exam.resultsState === "provisional")
)

export function getLecturerCourseExams(courseId: string) {
  return lecturerExams
    .filter((exam) => exam.courseId === courseId)
    .sort((first, second) => first.date.localeCompare(second.date))
}

export function getLecturerExamById(examId: string) {
  return lecturerExams.find((exam) => exam.id === examId)
}

/**
 * Online question snapshots stop being editable once the exam is published.
 * Paper exams keep their paper question count as information only.
 */
export function isLecturerExamSnapshotLocked(exam: LecturerExam) {
  return (
    exam.mode === "online_mcq" &&
    (exam.status === "published" || exam.status === "closed")
  )
}

export type LecturerResultAttemptStatus =
  "submitted" | "in_progress" | "not_started"

export const LECTURER_RESULT_ATTEMPT_LABELS: Record<
  LecturerResultAttemptStatus,
  string
> = {
  submitted: "Submitted",
  in_progress: "In progress",
  not_started: "Not started",
}

export type LecturerResultRecord = {
  id: string
  examId: string
  courseId: string
  studentNo: string
  studentName: string
  /** Online attempt status; null for paper exams. */
  attemptStatus: LecturerResultAttemptStatus | null
  /** Null for online students without a submitted attempt or unentered paper marks. */
  score: number | null
  maxMarks: number
  grade: string | null
  remarks: string | null
  state: ExamResultState
  submittedAt?: string
  releasedOn?: string
  /** Local demo audit note for a released-result edit. Never persisted. */
  lastEditReason?: string
}

const resultPercentagePattern = [
  88, 72, 96, 64, 80, 52, 100, 76, 60, 84, 68, 92, 56, 44, 78, 90, 62, 82, 74,
  58, 86, 70, 94, 66, 50, 88, 72, 98, 60, 80,
]

const resultGradePattern = [
  "A",
  "B",
  "A",
  "C",
  "B",
  "S",
  "A",
  "B",
  "C",
  "B",
  "B",
  "A",
  "C",
  "S",
  "B",
  "A",
  "C",
  "B",
]

const resultRemarkPattern = [
  "Strong work on the structured questions.",
  "Review fractions before the next test.",
  "Clear working shown throughout.",
  "Several steps were incomplete.",
  "Good improvement from the previous quiz.",
  "Needs more practice with word problems.",
  "Excellent accuracy across all sections.",
  "Check the units in the final answers.",
]

function getSampleResultScore(index: number, maxMarks: number) {
  const percentage =
    resultPercentagePattern[index % resultPercentagePattern.length] ?? 70

  return Math.round((percentage / 100) * maxMarks)
}

type LecturerResultSeed = {
  submittedCount?: number
  inProgressCount?: number
  enteredCount?: number
  state: ExamResultState
  submittedOn?: string
  releasedOn?: string
}

function createLecturerResultRecords(
  examId: string,
  seed: LecturerResultSeed
): LecturerResultRecord[] {
  const exam = getLecturerExamById(examId)

  if (!exam) return []

  const roster = getLecturerAttendanceRoster(exam.courseId)

  return roster.map((student, index) => {
    const base = {
      id: `result-${exam.id}-${student.id}`,
      examId: exam.id,
      courseId: exam.courseId,
      studentNo: student.studentNo,
      studentName: student.fullName,
      maxMarks: exam.maxMarks,
    }

    if (exam.mode === "paper") {
      const entered = index < (seed.enteredCount ?? 0)
      const score = entered ? getSampleResultScore(index, exam.maxMarks) : null

      return {
        ...base,
        attemptStatus: null,
        score,
        grade: entered
          ? (resultGradePattern[index % resultGradePattern.length] ?? null)
          : null,
        remarks: entered
          ? (resultRemarkPattern[index % resultRemarkPattern.length] ?? null)
          : null,
        state: entered ? seed.state : "pending",
        releasedOn: entered ? seed.releasedOn : undefined,
      }
    }

    const submittedCount = seed.submittedCount ?? 0
    const submitted = index < submittedCount
    const inProgress =
      !submitted && index < submittedCount + (seed.inProgressCount ?? 0)
    const score = submitted ? getSampleResultScore(index, exam.maxMarks) : null

    return {
      ...base,
      attemptStatus: submitted
        ? "submitted"
        : inProgress
          ? "in_progress"
          : "not_started",
      score,
      grade: submitted
        ? (resultGradePattern[index % resultGradePattern.length] ?? null)
        : null,
      remarks: submitted
        ? (resultRemarkPattern[index % resultRemarkPattern.length] ?? null)
        : null,
      state: submitted ? seed.state : "pending",
      submittedAt: submitted ? seed.submittedOn : undefined,
      releasedOn: submitted ? seed.releasedOn : undefined,
    }
  })
}

/**
 * Result rows are limited to this lecturer's examined courses. Online rows are
 * attempt-derived sample results; paper rows are local manual-entry samples.
 */
export const lecturerResults: LecturerResultRecord[] = [
  ...createLecturerResultRecords("exam-maths-7-quiz", {
    submittedCount: 17,
    state: "released",
    submittedOn: "2026-11-10T15:08",
    releasedOn: "2026-11-13",
  }),
  ...createLecturerResultRecords("exam-maths-11-diagnostic", {
    submittedCount: 28,
    state: "provisional",
    submittedOn: "2026-11-12T17:06",
  }),
  ...createLecturerResultRecords("exam-maths-11-mock", {
    enteredCount: 18,
    state: "provisional",
  }),
  ...createLecturerResultRecords("exam-maths-7-term", {
    enteredCount: 18,
    state: "released",
    releasedOn: "2026-11-05",
  }),
]

export function getLecturerResultsByExam(examId: string) {
  return lecturerResults.filter((result) => result.examId === examId)
}

export function getLecturerResultById(resultId: string) {
  return lecturerResults.find((result) => result.id === resultId)
}

export type LecturerContentStatus = "published" | "draft" | "archived"

export const LECTURER_CONTENT_STATUS_LABELS: Record<
  LecturerContentStatus,
  string
> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
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
  /** Order of this section within the course placement. */
  sectionOrder: number
  status: LecturerContentStatus
  listedOn: string
  /**
   * Kind-specific source placeholder shown in the demo, such as a fake link
   * label, file name or book reference. Never a real URL or storage key.
   */
  sourceLabel: string
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
    sectionOrder: 1,
    status: "published",
    listedOn: "2026-11-15",
    sourceLabel: "Class recording · 18 min",
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
    sectionOrder: 1,
    status: "published",
    listedOn: "2026-11-12",
    sourceLabel: "PDF worksheet · 2 pages",
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
    sectionOrder: 1,
    status: "published",
    listedOn: "2026-11-08",
    sourceLabel: "Workbook chapter · Colombo library desk",
  },
  {
    id: "content-maths-8-file-2",
    courseId: "course-maths-8",
    title: "Algebra: simplifying expressions — class notes",
    description:
      "Summary notes and worked examples for the next Saturday class.",
    kind: "file",
    accessType: "course_only",
    section: "Algebra",
    sectionOrder: 2,
    status: "draft",
    listedOn: "2026-11-16",
    sourceLabel: "PDF class notes · draft",
  },
  {
    id: "content-maths-8-file-3",
    courseId: "course-maths-8",
    title: "Decimals diagnostic quiz (2025)",
    description:
      "Short diagnostic quiz used at the start of the previous term. Retained for reference only.",
    kind: "file",
    accessType: "course_only",
    section: "Fractions and decimals",
    sectionOrder: 1,
    status: "archived",
    listedOn: "2025-11-20",
    sourceLabel: "PDF quiz · archived",
  },
  {
    id: "content-maths-7-file-1",
    courseId: "course-maths-7",
    title: "Percentages practice set",
    description: "Twenty percentage and simple-interest practice items.",
    kind: "file",
    accessType: "registered",
    section: "Percentage and simple interest",
    sectionOrder: 1,
    status: "published",
    listedOn: "2026-11-11",
    sourceLabel: "PDF practice set · 3 pages",
  },
  {
    id: "content-maths-7-recording-1",
    courseId: "course-maths-7",
    title: "Ratio and proportion — class recording",
    description: "Short recording on writing and simplifying ratios.",
    kind: "recording",
    accessType: "course_only",
    section: "Ratio and proportion",
    sectionOrder: 2,
    status: "published",
    listedOn: "2026-11-12",
    sourceLabel: "Class recording · 12 min",
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
    sectionOrder: 2,
    status: "published",
    listedOn: "2026-11-15",
    sourceLabel: "PDF solutions · 8 pages",
  },
  {
    id: "content-maths-11-file-2",
    courseId: "course-maths-11",
    title: "Mock paper 2 — marking scheme",
    description: "Marks breakdown for the upcoming mock paper 2.",
    kind: "file",
    accessType: "course_only",
    section: "Mock papers",
    sectionOrder: 2,
    status: "draft",
    listedOn: "2026-11-16",
    sourceLabel: "PDF marking scheme · draft",
  },
  {
    id: "content-maths-11-recording-1",
    courseId: "course-maths-11",
    title: "Algebra basics — pre-test recording",
    description:
      "Recording from the start of the term covering substitution and factorising.",
    kind: "recording",
    accessType: "course_only",
    section: "Algebra basics",
    sectionOrder: 1,
    status: "archived",
    listedOn: "2026-05-12",
    sourceLabel: "Class recording · 14 min",
  },
  {
    id: "content-maths-revision-file-1",
    courseId: "course-maths-revision",
    title: "Sets and probability — revision notes",
    description:
      "Notes and past-paper questions for the Sunday revision class.",
    kind: "file",
    accessType: "registered",
    section: "Revision",
    sectionOrder: 1,
    status: "published",
    listedOn: "2026-11-14",
    sourceLabel: "PDF revision notes · 6 pages",
  },
  {
    id: "content-maths-10-file-1",
    courseId: "course-maths-10",
    title: "Trigonometry revision notes",
    description: "Final revision notes shared before the course closed.",
    kind: "file",
    accessType: "course_only",
    section: "Trigonometry",
    sectionOrder: 1,
    status: "published",
    listedOn: "2025-11-09",
    sourceLabel: "PDF revision notes · 4 pages",
  },
]

export function getLecturerCourseContent(courseId: string) {
  return lecturerContentItems
    .filter((item) => item.courseId === courseId)
    .sort(
      (first, second) =>
        first.sectionOrder - second.sectionOrder ||
        second.listedOn.localeCompare(first.listedOn) ||
        first.title.localeCompare(second.title)
    )
}

export type LecturerQuestionOption = {
  id: string
  text: string
  isCorrect: boolean
}

export type LecturerQuestionSnapshotUsage = {
  examId: string
  examTitle: string
  status: "published" | "closed"
  /** Date the published snapshot was locked for editing. */
  lockedOn: string
}

export type LecturerQuestion = {
  id: string
  courseId: string
  body: string
  explanation: string
  /** Positive default marks when the question is added to an exam. */
  defaultMarks: number
  hasImage: boolean
  /** Description of the optional image placeholder, never a storage key. */
  imageLabel?: string
  options: LecturerQuestionOption[]
  /** Published or closed online exam snapshots that include this question. */
  usedInSnapshots: LecturerQuestionSnapshotUsage[]
  updatedOn: string
}

export const lecturerQuestions: LecturerQuestion[] = [
  {
    id: "question-maths-8-fractions-1",
    courseId: "course-maths-8",
    body: "Which fraction is equal to 0.75?",
    explanation: "0.75 = 75/100 = 3/4.",
    defaultMarks: 2,
    hasImage: false,
    options: [
      { id: "option-fractions-1-a", text: "3/4", isCorrect: true },
      { id: "option-fractions-1-b", text: "4/3", isCorrect: false },
      { id: "option-fractions-1-c", text: "7/5", isCorrect: false },
      { id: "option-fractions-1-d", text: "3/5", isCorrect: false },
    ],
    usedInSnapshots: [
      {
        examId: "exam-maths-8-quiz",
        examTitle: "Fractions and decimals — class quiz",
        status: "published",
        lockedOn: "2026-11-15",
      },
    ],
    updatedOn: "2026-11-15",
  },
  {
    id: "question-maths-8-fractions-2",
    courseId: "course-maths-8",
    body: "Which decimal is the largest?",
    explanation: "Compare the tenths and hundredths places: 0.605 is largest.",
    defaultMarks: 2,
    hasImage: false,
    options: [
      { id: "option-fractions-2-a", text: "0.6", isCorrect: false },
      { id: "option-fractions-2-b", text: "0.58", isCorrect: false },
      { id: "option-fractions-2-c", text: "0.605", isCorrect: true },
      { id: "option-fractions-2-d", text: "0.56", isCorrect: false },
    ],
    usedInSnapshots: [],
    updatedOn: "2026-11-14",
  },
  {
    id: "question-maths-7-percentages-1",
    courseId: "course-maths-7",
    body: "What is 15% of 240?",
    explanation: "10% of 240 is 24 and 5% is 12, so 15% is 36.",
    defaultMarks: 2,
    hasImage: false,
    options: [
      { id: "option-percentages-1-a", text: "24", isCorrect: false },
      { id: "option-percentages-1-b", text: "36", isCorrect: true },
      { id: "option-percentages-1-c", text: "32", isCorrect: false },
      { id: "option-percentages-1-d", text: "40", isCorrect: false },
    ],
    usedInSnapshots: [
      {
        examId: "exam-maths-7-quiz",
        examTitle: "Grade 7 monthly quiz — percentages",
        status: "closed",
        lockedOn: "2026-11-08",
      },
    ],
    updatedOn: "2026-11-08",
  },
  {
    id: "question-maths-7-ratio-1",
    courseId: "course-maths-7",
    body: "Simplify the ratio 18:24.",
    explanation: "Divide both parts by 6 to get 3:4.",
    defaultMarks: 2,
    hasImage: false,
    options: [
      { id: "option-ratio-1-a", text: "2:3", isCorrect: false },
      { id: "option-ratio-1-b", text: "3:4", isCorrect: true },
      { id: "option-ratio-1-c", text: "9:12", isCorrect: false },
      { id: "option-ratio-1-d", text: "4:3", isCorrect: false },
    ],
    usedInSnapshots: [],
    updatedOn: "2026-11-14",
  },
  {
    id: "question-maths-11-algebra-1",
    courseId: "course-maths-11",
    body: "Solve 2x + 5 = 17.",
    explanation: "Subtract 5 from both sides, then divide by 2: x = 6.",
    defaultMarks: 3,
    hasImage: false,
    options: [
      { id: "option-algebra-1-a", text: "x = 11", isCorrect: false },
      { id: "option-algebra-1-b", text: "x = 6", isCorrect: true },
      { id: "option-algebra-1-c", text: "x = 7", isCorrect: false },
      { id: "option-algebra-1-d", text: "x = 4", isCorrect: false },
    ],
    usedInSnapshots: [],
    updatedOn: "2026-11-16",
  },
  {
    id: "question-maths-11-functions-1",
    courseId: "course-maths-11",
    body: "If f(x) = 2x + 3, what is f(4)?",
    explanation: "Substitute x = 4: f(4) = 2 × 4 + 3 = 11.",
    defaultMarks: 2,
    hasImage: false,
    options: [
      { id: "option-functions-1-a", text: "8", isCorrect: false },
      { id: "option-functions-1-b", text: "11", isCorrect: true },
      { id: "option-functions-1-c", text: "14", isCorrect: false },
      { id: "option-functions-1-d", text: "7", isCorrect: false },
    ],
    usedInSnapshots: [],
    updatedOn: "2026-11-13",
  },
  {
    id: "question-maths-7-geometry-1",
    courseId: "course-maths-7",
    body: "Identify the type of angle shown in the diagram.",
    explanation:
      "The angle is larger than a right angle but smaller than a straight angle, so it is obtuse.",
    defaultMarks: 2,
    hasImage: true,
    imageLabel:
      "Diagram placeholder: two rays meeting at a vertex, wider than a right angle.",
    options: [
      { id: "option-geometry-1-a", text: "Acute", isCorrect: false },
      { id: "option-geometry-1-b", text: "Right", isCorrect: false },
      { id: "option-geometry-1-c", text: "Obtuse", isCorrect: true },
      { id: "option-geometry-1-d", text: "Reflex", isCorrect: false },
    ],
    usedInSnapshots: [],
    updatedOn: "2026-11-12",
  },
]

export function getLecturerCourseQuestions(courseId: string) {
  return lecturerQuestions.filter((question) => question.courseId === courseId)
}

export function getLecturerQuestionSnapshotUsage(question: LecturerQuestion) {
  return question.usedInSnapshots
    .map((usage) => ({
      ...usage,
      exam: getLecturerExamById(usage.examId),
    }))
    .sort((first, second) => second.lockedOn.localeCompare(first.lockedOn))
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
      marked === 0
        ? 0
        : Math.round(((summary.present + summary.late) / marked) * 100),
  }
}

export type LecturerNoticeAudience = "all" | "branch" | "course"

export const LECTURER_NOTICE_AUDIENCE_LABELS: Record<
  LecturerNoticeAudience,
  string
> = {
  all: "All staff",
  branch: "Branch",
  course: "Course",
}

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
    author: "Academic Office",
    publishedAt: "2026-11-14T13:05:00+05:30",
    audienceType: "course",
    audienceLabel: "Grade 8 Mathematics",
    courseName: "Grade 8 Mathematics",
    excerpt:
      "An extra revision class before the term test, published to your Grade 8 Mathematics students.",
    body: "An extra revision class for Grade 8 Mathematics will be held on Monday 23 November from 4:00 PM to 5:30 PM in Room 3B. We will work through past term test papers. This notice was published to the Grade 8 Mathematics students.",
  },
]

/** Matches the dashboard's initial local read set so both views agree. */
export const initialReadLecturerNoticeIds = ["lecturer-notice-2"] as const

/**
 * Audience filter values use "any" for the unfiltered view so the "all staff"
 * audience remains a distinct, selectable option.
 */
export const lecturerNoticeAudienceFilterOptions = [
  { value: "any", label: "All audiences" },
  ...(
    Object.entries(LECTURER_NOTICE_AUDIENCE_LABELS) as [
      LecturerNoticeAudience,
      string,
    ][]
  ).map(([value, label]) => ({ value, label })),
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
  /** Composed locally in this demo. Never sent and never delivered. */
  local?: boolean
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

export function getLecturerParticipantName(
  thread: LecturerMessageThread,
  participantId: string
) {
  return (
    thread.participants.find((participant) => participant.id === participantId)
      ?.name ?? "Unknown participant"
  )
}

/**
 * Curated compose contacts for this lecturer. Branch offices, a fellow lecturer
 * and guardians already linked to this lecturer's courses. No student directory
 * or cross-student browsing is modelled.
 */
export const lecturerMessageContacts: LecturerMessageParticipant[] = [
  {
    id: "office-academic",
    name: "Academic Office",
    role: "Colombo branch office",
  },
  {
    id: "office-accounts",
    name: "Accounts Office",
    role: "Colombo branch office",
  },
  {
    id: "lecturer-ruwan",
    name: "Mr. Ruwan Fernando",
    role: "Science lecturer",
  },
  {
    id: "guardian-jayasuriya",
    name: "Mr. S. Jayasuriya",
    role: "Guardian of Kavindu Jayasuriya",
  },
  {
    id: "guardian-alwis",
    name: "Mrs. N. Alwis",
    role: "Guardian of Nethmi Alwis",
  },
]

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
  settledThisTerm: 398150,
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

export type LecturerCommissionEntryType = "accrual" | "reversal"
export type LecturerCommissionEntryStatus = "accrued" | "settled" | "void"
export type LecturerCommissionBasis = "paid" | "list"
export type LecturerCommissionCalcType = "percent" | "fixed_per_student_month"

export const LECTURER_COMMISSION_ENTRY_TYPE_LABELS: Record<
  LecturerCommissionEntryType,
  string
> = {
  accrual: "Accrual",
  reversal: "Reversal",
}

export const LECTURER_COMMISSION_ENTRY_STATUS_LABELS: Record<
  LecturerCommissionEntryStatus,
  string
> = {
  accrued: "Accrued",
  settled: "Settled",
  void: "Void",
}

export const LECTURER_COMMISSION_BASIS_LABELS: Record<
  LecturerCommissionBasis,
  string
> = {
  paid: "Paid fees",
  list: "List price",
}

export const LECTURER_COMMISSION_CALC_LABELS: Record<
  LecturerCommissionCalcType,
  string
> = {
  percent: "Percentage of base",
  fixed_per_student_month: "Fixed per student per month",
}

/**
 * Commission entries are snapshots of the rule, rate, share and basis at the
 * time they were recorded. Reversal entries are the exact negatives of the
 * entry they reverse, so their amounts can be zero or negative. Only this
 * lecturer's entries are included.
 */
export type LecturerCommissionEntry = {
  id: string
  courseId: string
  courseName: string
  period: string
  entryType: LecturerCommissionEntryType
  status: LecturerCommissionEntryStatus
  baseAmount: number
  commissionAmount: number
  teacherAmount: number
  basisApplied: LecturerCommissionBasis
  calcTypeApplied: LecturerCommissionCalcType
  rateApplied: number
  sharePercentApplied: number
  recordedOn: string
  payoutId?: string
  payoutReference?: string
  reversesEntryId?: string
  note?: string
}

export const lecturerCommissionEntries: LecturerCommissionEntry[] = [
  {
    id: "commission-entry-2026-11-8",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    period: "November 2026",
    entryType: "accrual",
    status: "accrued",
    baseAmount: 108000,
    commissionAmount: 32400,
    teacherAmount: 75600,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 100,
    recordedOn: "2026-11-12",
    note: "Accrued from cleared November tuition payments.",
  },
  {
    id: "commission-entry-2026-11-7",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    period: "November 2026",
    entryType: "accrual",
    status: "accrued",
    baseAmount: 64800,
    commissionAmount: 19440,
    teacherAmount: 45360,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 60,
    recordedOn: "2026-11-12",
    note: "Co-taught course share applied.",
  },
  {
    id: "commission-entry-2026-11-11",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    period: "November 2026",
    entryType: "accrual",
    status: "accrued",
    baseAmount: 135000,
    commissionAmount: 40500,
    teacherAmount: 94500,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 100,
    recordedOn: "2026-11-14",
    note: "Accrued from cleared November tuition payments.",
  },
  {
    id: "commission-entry-2026-11-revision",
    courseId: "course-maths-revision",
    courseName: "O/L Mathematics Revision Programme",
    period: "November 2026",
    entryType: "accrual",
    status: "accrued",
    baseAmount: 54000,
    commissionAmount: 16200,
    teacherAmount: 37800,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 50,
    recordedOn: "2026-11-15",
    note: "Co-taught programme share applied.",
  },
  {
    id: "commission-entry-2026-11-c1",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    period: "November 2026 correction",
    entryType: "accrual",
    status: "settled",
    baseAmount: 17714,
    commissionAmount: 5314,
    teacherAmount: 12400,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 60,
    recordedOn: "2026-11-15",
    payoutId: "payout-2026-11-correction",
    note: "Late payment allocation included in the approved correction payout.",
  },
  {
    id: "commission-entry-2026-10-8",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    period: "October 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 72000,
    commissionAmount: 21600,
    teacherAmount: 50400,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 100,
    recordedOn: "2026-10-28",
    payoutId: "payout-2026-10",
    payoutReference: "PAY-2026-10-031",
  },
  {
    id: "commission-entry-2026-10-7",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    period: "October 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 54000,
    commissionAmount: 16200,
    teacherAmount: 37800,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 60,
    recordedOn: "2026-10-28",
    payoutId: "payout-2026-10",
    payoutReference: "PAY-2026-10-031",
  },
  {
    id: "commission-entry-2026-10-11",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    period: "October 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 110000,
    commissionAmount: 33000,
    teacherAmount: 77000,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 100,
    recordedOn: "2026-10-30",
    payoutId: "payout-2026-10",
    payoutReference: "PAY-2026-10-031",
  },
  {
    id: "commission-entry-2026-10-revision",
    courseId: "course-maths-revision",
    courseName: "O/L Mathematics Revision Programme",
    period: "October 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 47286,
    commissionAmount: 14186,
    teacherAmount: 33100,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 50,
    recordedOn: "2026-10-31",
    payoutId: "payout-2026-10",
    payoutReference: "PAY-2026-10-031",
  },
  {
    id: "commission-entry-2026-09-8",
    courseId: "course-maths-8",
    courseName: "Grade 8 Mathematics",
    period: "September 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 68000,
    commissionAmount: 20400,
    teacherAmount: 47600,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 100,
    recordedOn: "2026-09-29",
    payoutId: "payout-2026-09",
    payoutReference: "PAY-2026-09-027",
  },
  {
    id: "commission-entry-2026-09-7",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    period: "September 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 50000,
    commissionAmount: 15000,
    teacherAmount: 35000,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 60,
    recordedOn: "2026-09-29",
    payoutId: "payout-2026-09",
    payoutReference: "PAY-2026-09-027",
  },
  {
    id: "commission-entry-2026-09-11",
    courseId: "course-maths-11",
    courseName: "O/L Mathematics (Grade 11)",
    period: "September 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 104786,
    commissionAmount: 31436,
    teacherAmount: 73350,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 100,
    recordedOn: "2026-09-30",
    payoutId: "payout-2026-09",
    payoutReference: "PAY-2026-09-027",
  },
  {
    id: "commission-entry-2026-09-revision",
    courseId: "course-maths-revision",
    courseName: "O/L Mathematics Revision Programme",
    period: "September 2026",
    entryType: "accrual",
    status: "settled",
    baseAmount: 45000,
    commissionAmount: 13500,
    teacherAmount: 31500,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 50,
    recordedOn: "2026-09-30",
    payoutId: "payout-2026-09",
    payoutReference: "PAY-2026-09-027",
  },
  {
    id: "commission-entry-2026-10-duplicate",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    period: "October 2026",
    entryType: "accrual",
    status: "void",
    baseAmount: 10000,
    commissionAmount: 3000,
    teacherAmount: 7000,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 60,
    recordedOn: "2026-10-22",
    note: "Duplicate allocation voided by the Accounts Office.",
  },
  {
    id: "commission-entry-2026-10-duplicate-reversal",
    courseId: "course-maths-7",
    courseName: "Grade 7 Mathematics",
    period: "October 2026",
    entryType: "reversal",
    status: "void",
    baseAmount: -10000,
    commissionAmount: -3000,
    teacherAmount: -7000,
    basisApplied: "paid",
    calcTypeApplied: "percent",
    rateApplied: 30,
    sharePercentApplied: 60,
    recordedOn: "2026-10-22",
    reversesEntryId: "commission-entry-2026-10-duplicate",
    note: "Exact reversal of the duplicate allocation entry.",
  },
]

export type LecturerPayoutProof = {
  /** Generic file label only; storage keys and file contents are not modelled. */
  fileName: string
  maskedReference: string
  uploadedOn: string
}

/**
 * Payout history for this lecturer only. Draft and approved payouts are local
 * sample records; paid payouts keep their period, reference and masked proof
 * details. No payout action is implemented.
 */
export type LecturerPayout = {
  id: string
  period: string
  periodStart: string
  periodEnd: string
  status: LecturerPayoutStatus
  grossCollected: number
  commissionTotal: number
  netPayable: number
  entryCount: number
  approvedOn?: string
  paidOn?: string
  paymentReference?: string
  proof?: LecturerPayoutProof
  note?: string
}

export const lecturerPayouts: LecturerPayout[] = [
  {
    id: "payout-2026-11",
    period: "November 2026",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    status: "draft",
    grossCollected: 361800,
    commissionTotal: 108540,
    netPayable: 253260,
    entryCount: 4,
    note: "Draft payout for the current period. It is not submitted, approved or paid.",
  },
  {
    id: "payout-2026-11-correction",
    period: "November 2026 correction",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    status: "approved",
    grossCollected: 17714,
    commissionTotal: 5314,
    netPayable: 12400,
    entryCount: 1,
    approvedOn: "2026-11-16",
    note: "Approved correction payout awaiting bank confirmation. No payment is made from this demo.",
  },
  {
    id: "payout-2026-10",
    period: "October 2026",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    status: "paid",
    grossCollected: 283286,
    commissionTotal: 84986,
    netPayable: 198300,
    entryCount: 4,
    paidOn: "2026-11-05",
    paymentReference: "PAY-2026-10-031",
    proof: {
      fileName: "payout-proof.pdf",
      maskedReference: "BR-••••-4821",
      uploadedOn: "2026-11-05",
    },
  },
  {
    id: "payout-2026-09",
    period: "September 2026",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    status: "paid",
    grossCollected: 267786,
    commissionTotal: 80336,
    netPayable: 187450,
    entryCount: 4,
    paidOn: "2026-10-05",
    paymentReference: "PAY-2026-09-027",
    proof: {
      fileName: "payout-proof.pdf",
      maskedReference: "BR-••••-3190",
      uploadedOn: "2026-10-05",
    },
  },
]

export function getLecturerCommissionEntryById(entryId: string) {
  return lecturerCommissionEntries.find((entry) => entry.id === entryId)
}

export function getLecturerPayoutById(payoutId: string) {
  return lecturerPayouts.find((payout) => payout.id === payoutId)
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
