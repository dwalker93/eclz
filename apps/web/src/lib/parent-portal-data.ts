/**
 * Local demo fixtures for the parent portal UI.
 *
 * These records model one guardian and only the children linked to that
 * guardian. They are not connected to the database, services, APIs or auth.
 * No global student directory, other family's records, payment credentials or
 * auth secrets are included.
 */

import {
  MOCK_NOW,
  MOCK_TODAY,
  studentBankAccounts,
  type AttendanceStatus,
  type ClassSession,
  type CourseDeliveryMode,
  type ExamMode,
  type ExamResultState,
  type MessageParticipant,
  type NotificationChannel,
  type NotificationStatus,
  type StudentCourseStatus,
  type StudentInvoice,
  type StudentPayment,
  type StudentReceipt,
  type ThreadMessage,
  type WeeklyScheduleSlot,
} from "@/lib/student-portal-data"

export const parent = {
  fullName: "Nimal Perera",
  preferredName: "Nimal",
  initials: "NP",
  contactEmail: "nimal.perera@example.com",
  contactPhone: "+94 71 234 5678",
  address: "24/3, Temple Road, Nugegoda",
  nic: "197812345678",
  portalEnabled: true,
  memberSince: "2024-01-15",
} as const

export type ParentChildNextClass = {
  courseName: string
  subject: string
  topic: string
  date: string
  startsAt: string
  endsAt: string
  branch: string
  room: string
  deliveryMode: "Physical" | "Online" | "Hybrid"
  lecturer: string
}

export type ParentChildAttendance = {
  rate: number
  present: number
  late: number
  absent: number
  excused: number
  totalSessions: number
  lastMarkedOn: string
}

export type ParentChildAttendanceRecord = {
  id: string
  date: string
  courseName: string
  sessionTopic: string
  sessionTime: string
  status: AttendanceStatus
  attendedVia: "Physical" | "Online"
  markedVia: "Manual" | "QR"
}

function summariseParentAttendance(
  records: ParentChildAttendanceRecord[]
): ParentChildAttendance {
  const counts = records.reduce<Record<AttendanceStatus, number>>(
    (current, record) => {
      current[record.status] += 1
      return current
    },
    { present: 0, late: 0, absent: 0, excused: 0 }
  )
  const totalSessions = records.length

  return {
    ...counts,
    totalSessions,
    rate:
      totalSessions === 0
        ? 0
        : Math.round(((counts.present + counts.late) / totalSessions) * 100),
    lastMarkedOn: records[0]?.date ?? "",
  }
}

export type ParentChildExam = {
  title: string
  courseName: string
  mode: ExamMode
  date: string
  startsAt: string
  endsAt: string
  venue: string
  maxMarks: number
  resultsVisibility: string
}

export type ParentChildResult = {
  title: string
  courseName: string
  releasedOn: string
  marks: number
  maxMarks: number
  grade: string
  remarks?: string
}

export type ParentChildAssessmentResult = {
  state: ExamResultState
  marks: number | null
  maxMarks: number
  grade: string | null
  remarks: string | null
  releasedOn?: string
}

export type ParentChildAssessment = {
  id: string
  title: string
  courseName: string
  subject: string
  mode: ExamMode
  /** Exam date, or the opening date of an online window. */
  date: string
  startsAt: string
  /** Closing date of an online window. Paper exams close on `date`. */
  endDate?: string
  endsAt: string
  durationMinutes: number
  venue?: string
  maxMarks: number
  resultsVisibility: "After release" | "After moderation"
  result: ParentChildAssessmentResult
  note?: string
}

export type ParentChildBilling = {
  invoices: StudentInvoice[]
  payments: StudentPayment[]
  /** Receipts issued for this child's verified payments only. */
  receipts: StudentReceipt[]
}

export type ParentChildFees = {
  outstanding: number
  invoiceNo: string
  period: string
  dueDate: string
  status: "pending" | "partial" | "paid" | "overdue"
}

export type ParentChildNotice = {
  title: string
  publishedAt: string
  audience: string
  excerpt: string
  body: string
}

export type ParentChildCourse = {
  id: string
  name: string
  subject: string
  courseType: "Class" | "Program"
  lecturers: string[]
  branch: string
  gradeLevel: string
  status: StudentCourseStatus
  deliveryMode: CourseDeliveryMode
  schedule: string
  room: string
  enrolledOn: string
  completedOn?: string
  droppedOn?: string
  dropNote?: string
  intake?: {
    label: string
    startsOn: string
    endsOn: string
  }
}

export type ParentChildTimetable = {
  slots: WeeklyScheduleSlot[]
  sessions: ClassSession[]
}

export type ParentChild = {
  id: string
  studentNo: string
  fullName: string
  preferredName: string
  initials: string
  grade: string
  branch: string
  relationship: string
  isPrimary: boolean
  activeCourseCount: number
  courses: ParentChildCourse[]
  timetable: ParentChildTimetable
  nextClass: ParentChildNextClass | null
  attendance: ParentChildAttendance | null
  attendanceHistory: ParentChildAttendanceRecord[]
  upcomingExam: ParentChildExam | null
  latestResult: ParentChildResult | null
  assessments: ParentChildAssessment[]
  billing: ParentChildBilling | null
  fees: ParentChildFees | null
  latestNotice: ParentChildNotice | null
}

const dinukaAttendanceHistory: ParentChildAttendanceRecord[] = [
  {
    id: "parent-attendance-dinuka-01",
    date: "2026-11-14",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Linear equations review",
    sessionTime: "8:30 AM–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-02",
    date: "2026-11-14",
    courseName: "Grade 8 Science",
    sessionTopic: "Acids and bases practical",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-dinuka-03",
    date: "2026-11-08",
    courseName: "Grade 8 English Language",
    sessionTopic: "Reading comprehension",
    sessionTime: "9:00 AM–10:30 AM",
    status: "late",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-04",
    date: "2026-11-07",
    courseName: "Grade 8 Science",
    sessionTopic: "Simple circuits introduction",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-dinuka-05",
    date: "2026-10-31",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Geometry: angles and triangles",
    sessionTime: "8:30 AM–10:30 AM",
    status: "excused",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-06",
    date: "2026-10-31",
    courseName: "Grade 8 Science",
    sessionTopic: "Plant transport systems",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-dinuka-07",
    date: "2026-10-27",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Algebraic expressions",
    sessionTime: "4:30 PM–6:00 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-08",
    date: "2026-10-25",
    courseName: "Grade 8 English Language",
    sessionTopic: "Persuasive writing",
    sessionTime: "9:00 AM–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-09",
    date: "2026-10-24",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Ratio and proportion",
    sessionTime: "8:30 AM–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-10",
    date: "2026-10-24",
    courseName: "Grade 8 Science",
    sessionTopic: "Chemical reactions",
    sessionTime: "11:00 AM–1:00 PM",
    status: "absent",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-dinuka-11",
    date: "2026-10-20",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Online revision: equations",
    sessionTime: "4:30 PM–6:00 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-12",
    date: "2026-10-18",
    courseName: "Grade 8 English Language",
    sessionTopic: "Poetry analysis",
    sessionTime: "9:00 AM–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-13",
    date: "2026-10-17",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Directed numbers",
    sessionTime: "8:30 AM–10:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-dinuka-14",
    date: "2026-10-17",
    courseName: "Grade 8 Science",
    sessionTopic: "States of matter",
    sessionTime: "11:00 AM–1:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-dinuka-15",
    date: "2026-10-13",
    courseName: "Grade 8 Mathematics",
    sessionTopic: "Fractions review",
    sessionTime: "4:30 PM–6:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
]

const sachiniAttendanceHistory: ParentChildAttendanceRecord[] = [
  {
    id: "parent-attendance-sachini-01",
    date: "2026-11-14",
    courseName: "Grade 6 Mathematics",
    sessionTopic: "Multiplication and division",
    sessionTime: "8:00 AM–9:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-02",
    date: "2026-11-14",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Plant observation practical",
    sessionTime: "10:00 AM–12:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-sachini-03",
    date: "2026-11-11",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Habitats and food chains",
    sessionTime: "4:30 PM–5:15 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-sachini-04",
    date: "2026-11-10",
    courseName: "Grade 6 Mathematics",
    sessionTopic: "Number patterns",
    sessionTime: "4:00 PM–5:30 PM",
    status: "late",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-05",
    date: "2026-11-07",
    courseName: "Grade 6 Mathematics",
    sessionTopic: "Rounding and estimation",
    sessionTime: "8:00 AM–9:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-06",
    date: "2026-11-04",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Simple circuits online",
    sessionTime: "4:30 PM–5:15 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-07",
    date: "2026-10-31",
    courseName: "Grade 6 Mathematics",
    sessionTopic: "Place value and rounding",
    sessionTime: "8:00 AM–9:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-08",
    date: "2026-10-31",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Plants and water",
    sessionTime: "10:00 AM–12:00 PM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "QR",
  },
  {
    id: "parent-attendance-sachini-09",
    date: "2026-10-28",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Food chains review",
    sessionTime: "4:30 PM–5:15 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-10",
    date: "2026-10-24",
    courseName: "Grade 6 Mathematics",
    sessionTopic: "Addition and subtraction",
    sessionTime: "8:00 AM–9:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-11",
    date: "2026-10-24",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Mini project presentations",
    sessionTime: "10:00 AM–12:00 PM",
    status: "excused",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-12",
    date: "2026-10-21",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Living things and their needs",
    sessionTime: "4:30 PM–5:15 PM",
    status: "present",
    attendedVia: "Online",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-13",
    date: "2026-10-17",
    courseName: "Grade 6 Mathematics",
    sessionTopic: "Number bonds",
    sessionTime: "8:00 AM–9:30 AM",
    status: "present",
    attendedVia: "Physical",
    markedVia: "Manual",
  },
  {
    id: "parent-attendance-sachini-14",
    date: "2026-10-17",
    courseName: "Grade 6 Science Explorers Program",
    sessionTopic: "Plant observation",
    sessionTime: "10:00 AM–12:00 PM",
    status: "absent",
    attendedVia: "Physical",
    markedVia: "QR",
  },
]

/**
 * Only these two children are linked to the demo guardian. The dashboard never
 * looks up students outside this list.
 */
export const parentChildren: ParentChild[] = [
  {
    id: "parent-child-dinuka",
    studentNo: "STU-2024-0114",
    fullName: "Dinuka Perera",
    preferredName: "Dinuka",
    initials: "DP",
    grade: "Grade 8",
    branch: "Colombo",
    relationship: "Son",
    isPrimary: true,
    activeCourseCount: 3,
    courses: [
      {
        id: "parent-course-maths-8",
        name: "Grade 8 Mathematics",
        subject: "Mathematics",
        courseType: "Class",
        lecturers: ["Ms. Ishara Senanayake"],
        branch: "Colombo",
        gradeLevel: "Grade 8",
        status: "active",
        deliveryMode: "Physical",
        schedule: "Tuesdays & Saturdays",
        room: "Room 3B",
        enrolledOn: "2024-01-15",
      },
      {
        id: "parent-course-science-8",
        name: "Grade 8 Science",
        subject: "Science",
        courseType: "Class",
        lecturers: ["Mr. Ruwan Fernando"],
        branch: "Colombo",
        gradeLevel: "Grade 8",
        status: "active",
        deliveryMode: "Physical",
        schedule: "Saturdays",
        room: "Science Lab 1",
        enrolledOn: "2024-01-15",
      },
      {
        id: "parent-course-english-8",
        name: "Grade 8 English Language",
        subject: "English",
        courseType: "Class",
        lecturers: ["Ms. Ayesha de Silva"],
        branch: "Colombo",
        gradeLevel: "Grade 8",
        status: "active",
        deliveryMode: "Physical",
        schedule: "Sundays",
        room: "Room 2A",
        enrolledOn: "2024-01-15",
      },
      {
        id: "parent-course-maths-7",
        name: "Grade 7 Mathematics",
        subject: "Mathematics",
        courseType: "Class",
        lecturers: ["Ms. Ishara Senanayake"],
        branch: "Colombo",
        gradeLevel: "Grade 7",
        status: "completed",
        deliveryMode: "Physical",
        schedule: "Tuesdays & Saturdays",
        room: "Room 3B",
        enrolledOn: "2024-01-15",
        completedOn: "2025-12-15",
      },
      {
        id: "parent-course-science-program-7",
        name: "Grade 7 Science Discovery Program",
        subject: "Science",
        courseType: "Program",
        lecturers: ["Mr. Ruwan Fernando", "Ms. Nadeesha Weerasinghe"],
        branch: "Colombo",
        gradeLevel: "Grade 7",
        status: "completed",
        deliveryMode: "Hybrid",
        schedule: "Weekday workshops and one online session",
        room: "Science Lab 1",
        enrolledOn: "2025-07-05",
        completedOn: "2025-09-06",
        intake: {
          label: "2025 mid-year intake",
          startsOn: "2025-07-05",
          endsOn: "2025-08-30",
        },
      },
      {
        id: "parent-course-ict-8",
        name: "Grade 8 Computer Science",
        subject: "Computer Science",
        courseType: "Class",
        lecturers: ["Mr. Dinesh Jayasuriya"],
        branch: "Colombo",
        gradeLevel: "Grade 8",
        status: "dropped",
        deliveryMode: "Online",
        schedule: "Wednesdays",
        room: "Online classroom",
        enrolledOn: "2026-01-15",
        droppedOn: "2026-08-28",
        dropNote:
          "This enrolment was closed on 28 Aug 2026. Contact the institute office if you think this is incorrect.",
      },
    ],
    timetable: {
      slots: [
        {
          id: "parent-slot-dinuka-maths-tuesday",
          courseId: "parent-course-maths-8",
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
          id: "parent-slot-dinuka-maths-saturday",
          courseId: "parent-course-maths-8",
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
          id: "parent-slot-dinuka-science-saturday",
          courseId: "parent-course-science-8",
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
          id: "parent-slot-dinuka-english-sunday",
          courseId: "parent-course-english-8",
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
      ],
      sessions: [
        {
          id: "parent-session-dinuka-maths-2026-11-10",
          courseId: "parent-course-maths-8",
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
          id: "parent-session-dinuka-maths-2026-11-14",
          courseId: "parent-course-maths-8",
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
          id: "parent-session-dinuka-science-2026-11-14",
          courseId: "parent-course-science-8",
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
          id: "parent-session-dinuka-english-2026-11-15",
          courseId: "parent-course-english-8",
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
          id: "parent-session-dinuka-maths-2026-11-17",
          courseId: "parent-course-maths-8",
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
          id: "parent-session-dinuka-science-2026-11-18",
          courseId: "parent-course-science-8",
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
          id: "parent-session-dinuka-maths-2026-11-19",
          courseId: "parent-course-maths-8",
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
          id: "parent-session-dinuka-maths-2026-11-21",
          courseId: "parent-course-maths-8",
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
          id: "parent-session-dinuka-science-2026-11-21",
          courseId: "parent-course-science-8",
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
          id: "parent-session-dinuka-english-2026-11-22",
          courseId: "parent-course-english-8",
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
        {
          id: "parent-session-dinuka-maths-2026-11-24",
          courseId: "parent-course-maths-8",
          courseName: "Grade 8 Mathematics",
          subject: "Mathematics",
          date: "2026-11-24",
          startsAt: "16:30",
          endsAt: "18:00",
          topic: "Percentages and proportional reasoning",
          branch: "Colombo",
          room: "Room 3B",
          deliveryMode: "Physical",
          lecturer: "Ms. Ishara Senanayake",
          status: "scheduled",
        },
        {
          id: "parent-session-dinuka-maths-2026-11-28",
          courseId: "parent-course-maths-8",
          courseName: "Grade 8 Mathematics",
          subject: "Mathematics",
          date: "2026-11-28",
          startsAt: "08:30",
          endsAt: "10:30",
          topic: "Term test revision",
          branch: "Colombo",
          room: "Room 3B",
          deliveryMode: "Physical",
          lecturer: "Ms. Ishara Senanayake",
          status: "scheduled",
        },
        {
          id: "parent-session-dinuka-science-2026-11-28",
          courseId: "parent-course-science-8",
          courseName: "Grade 8 Science",
          subject: "Science",
          date: "2026-11-28",
          startsAt: "11:00",
          endsAt: "13:00",
          topic: "Electricity and circuits review",
          branch: "Colombo",
          room: "Science Lab 1",
          deliveryMode: "Physical",
          lecturer: "Mr. Ruwan Fernando",
          status: "scheduled",
        },
        {
          id: "parent-session-dinuka-english-2026-11-29",
          courseId: "parent-course-english-8",
          courseName: "Grade 8 English Language",
          subject: "English",
          date: "2026-11-29",
          startsAt: "09:00",
          endsAt: "10:30",
          topic: "Persuasive writing",
          branch: "Colombo",
          room: "Room 2A",
          deliveryMode: "Physical",
          lecturer: "Ms. Ayesha de Silva",
          status: "scheduled",
        },
      ],
    },
    nextClass: {
      courseName: "Grade 8 Mathematics",
      subject: "Mathematics",
      topic: "Fractions and decimals — revision",
      date: "2026-11-17",
      startsAt: "16:30",
      endsAt: "18:00",
      branch: "Colombo",
      room: "Room 3B",
      deliveryMode: "Physical",
      lecturer: "Ms. Ishara Senanayake",
    },
    attendance: summariseParentAttendance(dinukaAttendanceHistory),
    attendanceHistory: dinukaAttendanceHistory,
    upcomingExam: {
      title: "Grade 8 Mathematics — Term Test",
      courseName: "Grade 8 Mathematics",
      mode: "paper",
      date: "2026-11-21",
      startsAt: "13:30",
      endsAt: "15:00",
      venue: "Colombo Main Hall",
      maxMarks: 100,
      resultsVisibility: "After release",
    },
    latestResult: {
      title: "Grade 8 Mathematics — Unit Test 2",
      courseName: "Grade 8 Mathematics",
      releasedOn: "2026-11-10",
      marks: 82,
      maxMarks: 100,
      grade: "A",
      remarks:
        "Strong improvement in algebra. Revise fractions before the term test.",
    },
    assessments: [
      {
        id: "parent-assessment-dinuka-maths-unit-2",
        title: "Grade 8 Mathematics — Unit Test 2",
        courseName: "Grade 8 Mathematics",
        subject: "Mathematics",
        mode: "paper",
        date: "2026-11-05",
        startsAt: "13:30",
        endsAt: "15:00",
        durationMinutes: 90,
        venue: "Colombo Main Hall",
        maxMarks: 100,
        resultsVisibility: "After release",
        result: {
          state: "released",
          marks: 82,
          maxMarks: 100,
          grade: "A",
          remarks:
            "Strong improvement in algebra. Revise fractions before the term test.",
          releasedOn: "2026-11-10",
        },
      },
      {
        id: "parent-assessment-dinuka-science-practical-2",
        title: "Grade 8 Science — Practical Assessment 2",
        courseName: "Grade 8 Science",
        subject: "Science",
        mode: "paper",
        date: "2026-11-03",
        startsAt: "11:00",
        endsAt: "12:00",
        durationMinutes: 60,
        venue: "Science Lab 1",
        maxMarks: 30,
        resultsVisibility: "After release",
        result: {
          state: "released",
          marks: 26,
          maxMarks: 30,
          grade: "A",
          remarks:
            "Accurate circuit measurements. Record the units in every answer.",
          releasedOn: "2026-11-08",
        },
      },
      {
        id: "parent-assessment-dinuka-english-essay",
        title: "Grade 8 English Language — Literature Essay",
        courseName: "Grade 8 English Language",
        subject: "English",
        mode: "paper",
        date: "2026-11-12",
        startsAt: "09:00",
        endsAt: "10:30",
        durationMinutes: 90,
        venue: "Room 2A",
        maxMarks: 40,
        resultsVisibility: "After moderation",
        result: {
          state: "pending",
          marks: null,
          maxMarks: 40,
          grade: null,
          remarks: null,
        },
        note: "The essay is with the moderator. Marks are not released until moderation is complete.",
      },
      {
        id: "parent-assessment-dinuka-maths-term-test",
        title: "Grade 8 Mathematics — Term Test",
        courseName: "Grade 8 Mathematics",
        subject: "Mathematics",
        mode: "paper",
        date: "2026-11-21",
        startsAt: "13:30",
        endsAt: "15:00",
        durationMinutes: 90,
        venue: "Colombo Main Hall",
        maxMarks: 100,
        resultsVisibility: "After release",
        result: {
          state: "pending",
          marks: null,
          maxMarks: 100,
          grade: null,
          remarks: null,
        },
        note: "Paper exam. Arrive 15 minutes early with the student card and calculator.",
      },
      {
        id: "parent-assessment-dinuka-science-unit-3",
        title: "Grade 8 Science — Unit Test 3",
        courseName: "Grade 8 Science",
        subject: "Science",
        mode: "online_mcq",
        date: "2026-11-24",
        startsAt: "16:00",
        endDate: "2026-11-25",
        endsAt: "18:00",
        durationMinutes: 45,
        maxMarks: 25,
        resultsVisibility: "After release",
        result: {
          state: "pending",
          marks: null,
          maxMarks: 25,
          grade: null,
          remarks: null,
        },
        note: "Online MCQ window. Parents cannot start, answer or submit the exam.",
      },
    ],
    billing: {
      invoices: [
        {
          id: "parent-inv-dinuka-1048",
          invoiceNo: "INV-2026-1048",
          title: "November 2026 tuition",
          itemSummary: "Grade 8 tuition · 3 fee items",
          branch: "Colombo",
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
              id: "parent-inv-dinuka-1048-line-1",
              kind: "fee",
              description: "Grade 8 Mathematics — monthly fee",
              courseName: "Grade 8 Mathematics",
              amount: 4500,
              periodLabel: "1–30 Nov 2026",
            },
            {
              id: "parent-inv-dinuka-1048-line-2",
              kind: "fee",
              description: "Grade 8 Science — monthly fee",
              courseName: "Grade 8 Science",
              amount: 4000,
              periodLabel: "1–30 Nov 2026",
            },
            {
              id: "parent-inv-dinuka-1048-line-3",
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
          id: "parent-inv-dinuka-1055",
          invoiceNo: "INV-2026-1055",
          title: "Science practical workbook",
          itemSummary: "Workbook · content, discount and adjustment",
          branch: "Colombo",
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
              id: "parent-inv-dinuka-1055-line-1",
              kind: "content",
              description: "Science practical workbook (printed)",
              courseName: "Grade 8 Science",
              amount: 2200,
            },
            {
              id: "parent-inv-dinuka-1055-line-2",
              kind: "discount",
              description: "Book exchange credit (returned workbook)",
              amount: -200,
            },
            {
              id: "parent-inv-dinuka-1055-line-3",
              kind: "adjustment",
              description: "Delivery to home address",
              amount: 300,
            },
          ],
          installments: [],
          note: "The printed workbook is handed over at the branch after the payment is verified.",
        },
        {
          id: "parent-inv-dinuka-1020",
          invoiceNo: "INV-2026-1020",
          title: "Term fees — September to November 2026",
          itemSummary: "Grade 8 term fees · 3 installments",
          branch: "Colombo",
          issuedOn: "2026-09-01",
          dueDate: "2026-11-10",
          period: "September–November 2026",
          subtotal: 9000,
          discountTotal: 0,
          adjustmentTotal: 0,
          total: 9000,
          amountPaid: 6000,
          balance: 3000,
          status: "overdue",
          lines: [
            {
              id: "parent-inv-dinuka-1020-line-1",
              kind: "fee",
              description: "Grade 8 term fee package",
              courseName: "Grade 8",
              amount: 9000,
              periodLabel: "Sep–Nov 2026",
            },
          ],
          installments: [
            {
              id: "parent-inv-dinuka-1020-inst-1",
              seq: 1,
              dueDate: "2026-09-15",
              amount: 3000,
              amountPaid: 3000,
              status: "paid",
            },
            {
              id: "parent-inv-dinuka-1020-inst-2",
              seq: 2,
              dueDate: "2026-10-15",
              amount: 3000,
              amountPaid: 3000,
              status: "paid",
            },
            {
              id: "parent-inv-dinuka-1020-inst-3",
              seq: 3,
              dueDate: "2026-11-10",
              amount: 3000,
              amountPaid: 0,
              status: "overdue",
            },
          ],
          note: "The third installment is overdue. Contact the branch office if a payment has already been made.",
        },
        {
          id: "parent-inv-dinuka-1042",
          invoiceNo: "INV-2026-1042",
          title: "October 2026 tuition",
          itemSummary: "Grade 8 tuition · 3 fee items",
          branch: "Colombo",
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
              id: "parent-inv-dinuka-1042-line-1",
              kind: "fee",
              description: "Grade 8 Mathematics — monthly fee",
              courseName: "Grade 8 Mathematics",
              amount: 4500,
              periodLabel: "1–31 Oct 2026",
            },
            {
              id: "parent-inv-dinuka-1042-line-2",
              kind: "fee",
              description: "Grade 8 Science — monthly fee",
              courseName: "Grade 8 Science",
              amount: 4000,
              periodLabel: "1–31 Oct 2026",
            },
            {
              id: "parent-inv-dinuka-1042-line-3",
              kind: "fee",
              description: "Grade 8 English Language — monthly fee",
              courseName: "Grade 8 English Language",
              amount: 3500,
              periodLabel: "1–31 Oct 2026",
            },
          ],
          installments: [],
        },
      ],
      payments: [
        {
          id: "parent-pay-dinuka-5501",
          method: "bank_transfer",
          amount: 7500,
          paidOn: "2026-11-05",
          reference: "BR-2026-8841",
          status: "verified",
          invoiceId: "parent-inv-dinuka-1048",
          invoiceNo: "INV-2026-1048",
          note: "Verified by the finance team on 6 Nov 2026.",
        },
        {
          id: "parent-pay-dinuka-5502",
          method: "bank_transfer",
          amount: 3000,
          paidOn: "2026-10-14",
          reference: "BR-2026-8712",
          status: "verified",
          invoiceId: "parent-inv-dinuka-1020",
          invoiceNo: "INV-2026-1020",
        },
        {
          id: "parent-pay-dinuka-5503",
          method: "bank_transfer",
          amount: 3000,
          paidOn: "2026-09-14",
          reference: "BR-2026-8591",
          status: "verified",
          invoiceId: "parent-inv-dinuka-1020",
          invoiceNo: "INV-2026-1020",
        },
        {
          id: "parent-pay-dinuka-5504",
          method: "bank_transfer",
          amount: 12000,
          paidOn: "2026-10-08",
          reference: "BR-2026-8665",
          status: "verified",
          invoiceId: "parent-inv-dinuka-1042",
          invoiceNo: "INV-2026-1042",
        },
        {
          id: "parent-pay-dinuka-5505",
          method: "bank_transfer",
          amount: 2000,
          paidOn: "2026-11-15",
          reference: "BR-2026-8902",
          status: "pending_verification",
          invoiceId: "parent-inv-dinuka-1048",
          invoiceNo: "INV-2026-1048",
          note: "Waiting for the finance team to verify the transfer. The balance is unchanged until it is verified.",
        },
      ],
      receipts: [
        {
          id: "parent-rcp-dinuka-1187",
          receiptNo: "RCP-2026-1187",
          paymentId: "parent-pay-dinuka-5501",
          invoiceNo: "INV-2026-1048",
          branch: "Colombo",
          issuedOn: "2026-11-06",
          amount: 7500,
          method: "bank_transfer",
          reference: "BR-2026-8841",
          status: "issued",
          verificationCode: "ECLZ-4H7K-91QZ",
          note: "Issued for the verified November 2026 tuition payment.",
        },
        {
          id: "parent-rcp-dinuka-1093",
          receiptNo: "RCP-2026-1093",
          paymentId: "parent-pay-dinuka-5502",
          invoiceNo: "INV-2026-1020",
          branch: "Colombo",
          issuedOn: "2026-10-15",
          amount: 3000,
          method: "bank_transfer",
          reference: "BR-2026-8712",
          status: "issued",
          verificationCode: "ECLZ-8M2P-46DT",
        },
        {
          id: "parent-rcp-dinuka-1069",
          receiptNo: "RCP-2026-1069",
          paymentId: "parent-pay-dinuka-5504",
          invoiceNo: "INV-2026-1042",
          branch: "Colombo",
          issuedOn: "2026-10-09",
          amount: 12000,
          method: "bank_transfer",
          reference: "BR-2026-8665",
          status: "issued",
          verificationCode: "ECLZ-7B5H-30LM",
          replacesReceiptNo: "RCP-2026-1068",
          note: "Corrected replacement for RCP-2026-1068.",
        },
        {
          id: "parent-rcp-dinuka-1068",
          receiptNo: "RCP-2026-1068",
          paymentId: "parent-pay-dinuka-5504",
          invoiceNo: "INV-2026-1042",
          branch: "Colombo",
          issuedOn: "2026-10-09",
          amount: 12000,
          method: "bank_transfer",
          reference: "BR-2026-8665",
          status: "void",
          verificationCode: "ECLZ-6T1C-58WN",
          replacedByReceiptNo: "RCP-2026-1069",
          note: "Voided on 9 Oct 2026 because the wrong branch copy was printed. A corrected receipt was issued.",
        },
        {
          id: "parent-rcp-dinuka-0954",
          receiptNo: "RCP-2026-0954",
          paymentId: "parent-pay-dinuka-5503",
          invoiceNo: "INV-2026-1020",
          branch: "Colombo",
          issuedOn: "2026-09-15",
          amount: 3000,
          method: "bank_transfer",
          reference: "BR-2026-8591",
          status: "issued",
          verificationCode: "ECLZ-2Q9R-73VK",
        },
      ],
    },
    fees: {
      outstanding: 9800,
      invoiceNo: "INV-2026-1048",
      period: "November 2026",
      dueDate: "2026-11-30",
      status: "partial",
    },
    latestNotice: {
      title: "November term test timetable published",
      publishedAt: "2026-11-12T09:15:00+05:30",
      audience: "Grade 8 · Colombo",
      excerpt: "Mathematics is scheduled for Saturday 21 November at 1:30 PM.",
      body: "The Grade 8 term test timetable for the Colombo branch is now available. Mathematics will be held on Saturday 21 November from 1:30 PM to 3:00 PM in the Main Hall. Please arrive 15 minutes early with the student card and calculator. Contact the Academic Office if you have a timetable clash.",
    },
  },
  {
    id: "parent-child-sachini",
    studentNo: "STU-2025-0287",
    fullName: "Sachini Perera",
    preferredName: "Sachini",
    initials: "SP",
    grade: "Grade 6",
    branch: "Colombo",
    relationship: "Daughter",
    isPrimary: true,
    activeCourseCount: 2,
    courses: [
      {
        id: "parent-course-sachini-maths-6",
        name: "Grade 6 Mathematics",
        subject: "Mathematics",
        courseType: "Class",
        lecturers: ["Ms. Dilani Jayasuriya"],
        branch: "Colombo",
        gradeLevel: "Grade 6",
        status: "active",
        deliveryMode: "Physical",
        schedule: "Tuesdays & Saturdays",
        room: "Room 1A",
        enrolledOn: "2025-01-13",
      },
      {
        id: "parent-course-sachini-science-program-6",
        name: "Grade 6 Science Explorers Program",
        subject: "Science",
        courseType: "Program",
        lecturers: ["Ms. Nadeesha Weerasinghe"],
        branch: "Colombo",
        gradeLevel: "Grade 6",
        status: "active",
        deliveryMode: "Hybrid",
        schedule: "Saturdays and one online session",
        room: "Science Lab 1",
        enrolledOn: "2026-07-04",
        intake: {
          label: "2026 mid-year intake",
          startsOn: "2026-07-04",
          endsOn: "2026-08-29",
        },
      },
      {
        id: "parent-course-sachini-maths-5",
        name: "Grade 5 Mathematics",
        subject: "Mathematics",
        courseType: "Class",
        lecturers: ["Ms. Dilani Jayasuriya"],
        branch: "Colombo",
        gradeLevel: "Grade 5",
        status: "completed",
        deliveryMode: "Physical",
        schedule: "Tuesdays & Saturdays",
        room: "Room 1A",
        enrolledOn: "2025-01-13",
        completedOn: "2025-12-13",
      },
    ],
    timetable: {
      slots: [
        {
          id: "parent-slot-sachini-maths-tuesday",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          weekday: 2,
          startsAt: "16:00",
          endsAt: "17:30",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
        },
        {
          id: "parent-slot-sachini-science-online",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          weekday: 3,
          startsAt: "16:30",
          endsAt: "17:15",
          branch: "Colombo",
          room: "Online classroom",
          deliveryMode: "Online",
          lecturer: "Ms. Nadeesha Weerasinghe",
        },
        {
          id: "parent-slot-sachini-maths-saturday",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          weekday: 6,
          startsAt: "08:00",
          endsAt: "09:30",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
        },
        {
          id: "parent-slot-sachini-science-saturday",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          weekday: 6,
          startsAt: "10:00",
          endsAt: "12:00",
          branch: "Colombo",
          room: "Science Lab 1",
          deliveryMode: "Hybrid",
          lecturer: "Ms. Nadeesha Weerasinghe",
        },
      ],
      sessions: [
        {
          id: "parent-session-sachini-maths-2026-11-10",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          date: "2026-11-10",
          startsAt: "16:00",
          endsAt: "17:30",
          topic: "Number patterns",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
          status: "held",
        },
        {
          id: "parent-session-sachini-science-2026-11-11",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          date: "2026-11-11",
          startsAt: "16:30",
          endsAt: "17:15",
          topic: "Habitats and food chains",
          branch: "Colombo",
          room: "Online classroom",
          deliveryMode: "Online",
          lecturer: "Ms. Nadeesha Weerasinghe",
          status: "held",
        },
        {
          id: "parent-session-sachini-maths-2026-11-14",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          date: "2026-11-14",
          startsAt: "08:00",
          endsAt: "09:30",
          topic: "Multiplication and division",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
          status: "held",
        },
        {
          id: "parent-session-sachini-science-2026-11-14",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          date: "2026-11-14",
          startsAt: "10:00",
          endsAt: "12:00",
          topic: "Plant observation practical",
          branch: "Colombo",
          room: "Science Lab 1",
          deliveryMode: "Hybrid",
          lecturer: "Ms. Nadeesha Weerasinghe",
          status: "held",
        },
        {
          id: "parent-session-sachini-maths-2026-11-17",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          date: "2026-11-17",
          startsAt: "16:00",
          endsAt: "17:30",
          topic: "Place value and rounding",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-science-2026-11-18",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          date: "2026-11-18",
          startsAt: "16:30",
          endsAt: "17:15",
          topic: "Simple circuits",
          branch: "Colombo",
          room: "Online classroom",
          deliveryMode: "Online",
          lecturer: "Ms. Nadeesha Weerasinghe",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-maths-2026-11-21",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          date: "2026-11-21",
          startsAt: "08:00",
          endsAt: "09:30",
          topic: "Rounding and estimation",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-science-2026-11-21",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          date: "2026-11-21",
          startsAt: "10:00",
          endsAt: "12:00",
          topic: "Circuits practical",
          branch: "Colombo",
          room: "Science Lab 1",
          deliveryMode: "Hybrid",
          lecturer: "Ms. Nadeesha Weerasinghe",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-maths-2026-11-24",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          date: "2026-11-24",
          startsAt: "16:00",
          endsAt: "17:30",
          topic: "Fractions review",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-science-2026-11-25",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          date: "2026-11-25",
          startsAt: "16:30",
          endsAt: "17:15",
          topic: "Energy and motion",
          branch: "Colombo",
          room: "Online classroom",
          deliveryMode: "Online",
          lecturer: "Ms. Nadeesha Weerasinghe",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-maths-2026-11-28",
          courseId: "parent-course-sachini-maths-6",
          courseName: "Grade 6 Mathematics",
          subject: "Mathematics",
          date: "2026-11-28",
          startsAt: "08:00",
          endsAt: "09:30",
          topic: "Word problems",
          branch: "Colombo",
          room: "Room 1A",
          deliveryMode: "Physical",
          lecturer: "Ms. Dilani Jayasuriya",
          status: "scheduled",
        },
        {
          id: "parent-session-sachini-science-2026-11-28",
          courseId: "parent-course-sachini-science-program-6",
          courseName: "Grade 6 Science Explorers Program",
          subject: "Science",
          date: "2026-11-28",
          startsAt: "10:00",
          endsAt: "12:00",
          topic: "Energy practical",
          branch: "Colombo",
          room: "Science Lab 1",
          deliveryMode: "Hybrid",
          lecturer: "Ms. Nadeesha Weerasinghe",
          status: "scheduled",
        },
      ],
    },
    nextClass: {
      courseName: "Grade 6 Mathematics",
      subject: "Mathematics",
      topic: "Place value and rounding",
      date: "2026-11-17",
      startsAt: "16:00",
      endsAt: "17:30",
      branch: "Colombo",
      room: "Room 1A",
      deliveryMode: "Physical",
      lecturer: "Ms. Dilani Jayasuriya",
    },
    attendance: summariseParentAttendance(sachiniAttendanceHistory),
    attendanceHistory: sachiniAttendanceHistory,
    upcomingExam: {
      title: "Grade 6 Mathematics — Monthly Test",
      courseName: "Grade 6 Mathematics",
      mode: "paper",
      date: "2026-11-26",
      startsAt: "14:00",
      endsAt: "15:00",
      venue: "Colombo Hall 2",
      maxMarks: 50,
      resultsVisibility: "After release",
    },
    latestResult: {
      title: "Grade 6 Mathematics — Quiz 3",
      courseName: "Grade 6 Mathematics",
      releasedOn: "2026-11-07",
      marks: 44,
      maxMarks: 50,
      grade: "A",
      remarks:
        "Good grasp of fractions. Practise word problems before the test.",
    },
    assessments: [
      {
        id: "parent-assessment-sachini-maths-quiz-3",
        title: "Grade 6 Mathematics — Quiz 3",
        courseName: "Grade 6 Mathematics",
        subject: "Mathematics",
        mode: "paper",
        date: "2026-11-04",
        startsAt: "14:00",
        endsAt: "15:00",
        durationMinutes: 60,
        venue: "Room 1A",
        maxMarks: 50,
        resultsVisibility: "After release",
        result: {
          state: "released",
          marks: 44,
          maxMarks: 50,
          grade: "A",
          remarks:
            "Good grasp of fractions. Practise word problems before the test.",
          releasedOn: "2026-11-07",
        },
      },
      {
        id: "parent-assessment-sachini-science-practical",
        title: "Grade 6 Science — Practical Skills Check",
        courseName: "Grade 6 Science Explorers Program",
        subject: "Science",
        mode: "paper",
        date: "2026-10-31",
        startsAt: "10:00",
        endsAt: "11:00",
        durationMinutes: 60,
        venue: "Science Lab 1",
        maxMarks: 20,
        resultsVisibility: "After release",
        result: {
          state: "released",
          marks: 18,
          maxMarks: 20,
          grade: "A",
          remarks: "Careful observation and clear labelling throughout.",
          releasedOn: "2026-11-05",
        },
      },
      {
        id: "parent-assessment-sachini-english-reading",
        title: "Grade 6 English Language — Reading Assessment",
        courseName: "Grade 6 English Language",
        subject: "English",
        mode: "paper",
        date: "2026-11-13",
        startsAt: "11:00",
        endsAt: "12:00",
        durationMinutes: 60,
        venue: "Room 1A",
        maxMarks: 40,
        resultsVisibility: "After moderation",
        result: {
          state: "provisional",
          marks: 34,
          maxMarks: 40,
          grade: "B",
          remarks: "Comprehension is sound. Practise inference questions.",
          releasedOn: "2026-11-16",
        },
        note: "This result is provisional and may change after moderation.",
      },
      {
        id: "parent-assessment-sachini-maths-monthly",
        title: "Grade 6 Mathematics — Monthly Test",
        courseName: "Grade 6 Mathematics",
        subject: "Mathematics",
        mode: "paper",
        date: "2026-11-26",
        startsAt: "14:00",
        endsAt: "15:00",
        durationMinutes: 60,
        venue: "Colombo Hall 2",
        maxMarks: 50,
        resultsVisibility: "After release",
        result: {
          state: "pending",
          marks: null,
          maxMarks: 50,
          grade: null,
          remarks: null,
        },
        note: "Paper test. Please arrive 15 minutes early.",
      },
      {
        id: "parent-assessment-sachini-science-energy-quiz",
        title: "Grade 6 Science Explorers — Energy Quiz",
        courseName: "Grade 6 Science Explorers Program",
        subject: "Science",
        mode: "online_mcq",
        date: "2026-11-27",
        startsAt: "17:00",
        endDate: "2026-11-28",
        endsAt: "19:00",
        durationMinutes: 30,
        maxMarks: 20,
        resultsVisibility: "After release",
        result: {
          state: "pending",
          marks: null,
          maxMarks: 20,
          grade: null,
          remarks: null,
        },
        note: "Online MCQ quiz. Parents cannot start, answer or submit the exam.",
      },
    ],
    billing: {
      invoices: [
        {
          id: "parent-inv-sachini-1053",
          invoiceNo: "INV-2026-1053",
          title: "November 2026 tuition",
          itemSummary: "Grade 6 tuition · 2 fee items",
          branch: "Colombo",
          issuedOn: "2026-11-01",
          dueDate: "2026-11-30",
          period: "November 2026",
          subtotal: 8500,
          discountTotal: 0,
          adjustmentTotal: 0,
          total: 8500,
          amountPaid: 2000,
          balance: 6500,
          status: "partial",
          lines: [
            {
              id: "parent-inv-sachini-1053-line-1",
              kind: "fee",
              description: "Grade 6 Mathematics — monthly fee",
              courseName: "Grade 6 Mathematics",
              amount: 4500,
              periodLabel: "1–30 Nov 2026",
            },
            {
              id: "parent-inv-sachini-1053-line-2",
              kind: "fee",
              description: "Grade 6 Science Explorers — monthly fee",
              courseName: "Grade 6 Science Explorers Program",
              amount: 4000,
              periodLabel: "1–30 Nov 2026",
            },
          ],
          installments: [],
          note: "Payments are applied to an invoice only after the institute verifies them.",
        },
        {
          id: "parent-inv-sachini-1047",
          invoiceNo: "INV-2026-1047",
          title: "October 2026 tuition",
          itemSummary: "Grade 6 tuition · 2 fee items",
          branch: "Colombo",
          issuedOn: "2026-10-01",
          dueDate: "2026-10-10",
          period: "October 2026",
          subtotal: 8500,
          discountTotal: 0,
          adjustmentTotal: 0,
          total: 8500,
          amountPaid: 8500,
          balance: 0,
          status: "paid",
          lines: [
            {
              id: "parent-inv-sachini-1047-line-1",
              kind: "fee",
              description: "Grade 6 Mathematics — monthly fee",
              courseName: "Grade 6 Mathematics",
              amount: 4500,
              periodLabel: "1–31 Oct 2026",
            },
            {
              id: "parent-inv-sachini-1047-line-2",
              kind: "fee",
              description: "Grade 6 Science Explorers — monthly fee",
              courseName: "Grade 6 Science Explorers Program",
              amount: 4000,
              periodLabel: "1–31 Oct 2026",
            },
          ],
          installments: [],
        },
      ],
      payments: [
        {
          id: "parent-pay-sachini-5501",
          method: "bank_transfer",
          amount: 2000,
          paidOn: "2026-11-06",
          reference: "BR-2026-8850",
          status: "verified",
          invoiceId: "parent-inv-sachini-1053",
          invoiceNo: "INV-2026-1053",
          note: "Verified by the finance team on 7 Nov 2026.",
        },
        {
          id: "parent-pay-sachini-5502",
          method: "bank_transfer",
          amount: 8500,
          paidOn: "2026-10-09",
          reference: "BR-2026-8701",
          status: "verified",
          invoiceId: "parent-inv-sachini-1047",
          invoiceNo: "INV-2026-1047",
        },
      ],
      receipts: [
        {
          id: "parent-rcp-sachini-1189",
          receiptNo: "RCP-2026-1189",
          paymentId: "parent-pay-sachini-5501",
          invoiceNo: "INV-2026-1053",
          branch: "Colombo",
          issuedOn: "2026-11-07",
          amount: 2000,
          method: "bank_transfer",
          reference: "BR-2026-8850",
          status: "issued",
          verificationCode: "ECLZ-3F8N-62XP",
          note: "Issued for the verified November 2026 tuition part-payment.",
        },
        {
          id: "parent-rcp-sachini-1070",
          receiptNo: "RCP-2026-1070",
          paymentId: "parent-pay-sachini-5502",
          invoiceNo: "INV-2026-1047",
          branch: "Colombo",
          issuedOn: "2026-10-10",
          amount: 8500,
          method: "bank_transfer",
          reference: "BR-2026-8701",
          status: "issued",
          verificationCode: "ECLZ-9D4W-17RJ",
        },
      ],
    },
    fees: {
      outstanding: 6500,
      invoiceNo: "INV-2026-1053",
      period: "November 2026",
      dueDate: "2026-11-30",
      status: "partial",
    },
    latestNotice: {
      title: "Grade 6 science practical this Saturday",
      publishedAt: "2026-11-13T14:20:00+05:30",
      audience: "Grade 6 · Colombo",
      excerpt:
        "Bring your lab book, pencil and ruler for the circuits practical.",
      body: "This Saturday's Grade 6 science practical covers simple circuits. Please bring your lab book, a pencil and a ruler. Safety instructions will be given at the start. Students who missed the previous practical can collect the handout from the Science Lab.",
    },
  },
]

export function getParentChildById(childId: string) {
  return parentChildren.find((child) => child.id === childId)
}

/* --------------------------------------------------------------------------
 * Communication: notices relevant to one guardian and their linked children
 *
 * Local demo fixtures only. Notices are targeted to the guardian role, a
 * linked child's branch/grade/course, a specific child, or everyone. The
 * notice schema has no read or priority field, so neither is modelled here.
 * `childIds` says which linked children a notice concerns; it never contains
 * a student outside this guardian's record.
 * ----------------------------------------------------------------------- */

export type ParentNoticeAudience =
  "all" | "guardian" | "branch" | "grade" | "course" | "student"

export const PARENT_NOTICE_AUDIENCE_LABELS: Record<
  ParentNoticeAudience,
  string
> = {
  all: "Everyone",
  guardian: "Guardians",
  branch: "Branch",
  grade: "Grade",
  course: "Course",
  student: "One child",
}

export type ParentNotice = {
  id: string
  title: string
  author: string
  publishedAt: string
  /** Last day the notice is shown. Date-only, compared against MOCK_TODAY. */
  expiresAt?: string
  audienceType: ParentNoticeAudience
  audienceLabel: string
  courseName?: string
  /** Linked children this notice concerns. Never holds an unrelated student. */
  childIds: string[]
  excerpt: string
  body: string
}

const dinukaChildId = "parent-child-dinuka"
const sachiniChildId = "parent-child-sachini"
const bothChildren = [dinukaChildId, sachiniChildId]

export const parentNotices: ParentNotice[] = [
  {
    id: "parent-notice-fees-reminder",
    title: "November fee reminders for guardians",
    author: "Accounts Office",
    publishedAt: "2026-11-15T09:00:00+05:30",
    audienceType: "guardian",
    audienceLabel: "Guardians · Colombo",
    childIds: bothChildren,
    excerpt:
      "November tuition invoices are due on 30 November. You can review balances and prepare a payment from Invoices & Payments.",
    body: "November tuition invoices are now available and are due on 30 November 2026. You can review each child's invoice and payment history from Invoices & Payments. Bank transfers stay pending until the finance team verifies the reference and slip. If you have already paid at the branch, please keep your receipt and allow one working day for the payment to appear.",
  },
  {
    id: "parent-notice-dinuka-term-timetable",
    title: "Grade 8 term test timetable published",
    author: "Academic Office",
    publishedAt: "2026-11-12T09:15:00+05:30",
    audienceType: "grade",
    audienceLabel: "Grade 8 · Colombo",
    childIds: [dinukaChildId],
    excerpt:
      "Mathematics is scheduled for Saturday 21 November at 1:30 PM in the Main Hall.",
    body: "The Grade 8 term test timetable for the Colombo branch is now available. Mathematics will be held on Saturday 21 November from 1:30 PM to 3:00 PM in the Main Hall. Please arrive 15 minutes early with the student card and calculator. Contact the Academic Office if you have a timetable clash.",
  },
  {
    id: "parent-notice-sachini-science-practical",
    title: "Grade 6 science practical this Saturday",
    author: "Ms. Nadeesha Weerasinghe",
    publishedAt: "2026-11-13T14:20:00+05:30",
    expiresAt: "2026-11-21",
    audienceType: "grade",
    audienceLabel: "Grade 6 · Colombo",
    childIds: [sachiniChildId],
    excerpt:
      "Please bring a lab book, pencil and ruler for the circuits practical.",
    body: "This Saturday's Grade 6 science practical covers simple circuits. Please bring your lab book, a pencil and a ruler. Safety instructions will be given at the start. Students who missed the previous practical can collect the handout from the Science Lab.",
  },
  {
    id: "parent-notice-maths-revision",
    title: "Extra Mathematics revision class on 23 November",
    author: "Ms. Ishara Senanayake",
    publishedAt: "2026-11-14T13:05:00+05:30",
    expiresAt: "2026-11-23",
    audienceType: "course",
    audienceLabel: "Grade 8 Mathematics",
    courseName: "Grade 8 Mathematics",
    childIds: [dinukaChildId],
    excerpt:
      "A revision class for the term test will be held on Monday 23 November from 4:00 PM to 5:30 PM in Room 3B.",
    body: "An extra revision class for Grade 8 Mathematics will be held on Monday 23 November from 4:00 PM to 5:30 PM in Room 3B. We will work through past term test papers and common mistakes. Attendance is optional but recommended. Students should bring their exercise book, calculator and the printed revision sheet handed out this week.",
  },
  {
    id: "parent-notice-library-hours",
    title: "Library extended hours during term tests",
    author: "Library",
    publishedAt: "2026-11-13T08:30:00+05:30",
    expiresAt: "2026-11-28",
    audienceType: "branch",
    audienceLabel: "Colombo branch",
    childIds: bothChildren,
    excerpt:
      "The Colombo branch library is open until 7:00 PM on weekdays while term tests are running.",
    body: "While the November term tests are running, the Colombo branch library is open until 7:00 PM on weekdays and from 8:30 AM to 12:30 PM on Saturdays. Study desks are available on a first-come basis. Please keep drinks off the desks and return borrowed books to the trolley by the entrance.",
  },
  {
    id: "parent-notice-closure",
    title: "Institute closed on 18 November",
    author: "Administration",
    publishedAt: "2026-11-05T10:00:00+05:30",
    audienceType: "all",
    audienceLabel: "All branches",
    childIds: bothChildren,
    excerpt:
      "The Colombo branch will be closed on Wednesday 18 November for staff training.",
    body: "The Colombo branch will be closed on Wednesday 18 November for a staff training day. All weekday classes on that day are cancelled. Weekend classes will continue as scheduled. The office will reopen on Thursday 19 November at 8:30 AM.",
  },
  {
    id: "parent-notice-dinuka-pickup",
    title: "Pick-up arrangements after the term test",
    author: "Academic Office",
    publishedAt: "2026-11-10T08:00:00+05:30",
    audienceType: "student",
    audienceLabel: "Dinuka Perera · Grade 8",
    childIds: [dinukaChildId],
    excerpt:
      "Please confirm who will collect Dinuka after the Mathematics term test on 21 November.",
    body: "The Grade 8 Mathematics term test finishes at 3:00 PM on Saturday 21 November. Please confirm with the Colombo branch office who will collect Dinuka, or whether he may leave on his own. If a different guardian or relative will collect him, add their name and contact number at the office before Friday 20 November.",
  },
  {
    id: "parent-notice-sports-meet",
    title: "Annual sports meet — sign-up has closed",
    author: "Sports Office",
    publishedAt: "2026-10-20T09:00:00+05:30",
    expiresAt: "2026-11-02",
    audienceType: "grade",
    audienceLabel: "Grade 8 · Colombo",
    childIds: [dinukaChildId],
    excerpt:
      "Sign-up for the annual sports meet closed on 2 November. Thank you to everyone who entered.",
    body: "Sign-up for the annual sports meet closed on 2 November 2026. Thank you to everyone who entered. Event lists and the practice schedule will be shared through the grade notice board. Please speak to the Sports Office if you have a question about your entry.",
  },
]

export function isParentNoticeExpired(notice: ParentNotice) {
  return notice.expiresAt ? notice.expiresAt < MOCK_TODAY : false
}

/* --------------------------------------------------------------------------
 * Communication: the guardian's own message threads
 *
 * Local demo fixtures only. The guardian is a participant in every thread, and
 * no other family's conversations are modelled. A thread concerns one linked
 * child (`childId`) or the guardian generally (no child). `lastReadAt` stands
 * in for a read timestamp the schema does not provide, so unread state is
 * derived locally and never persisted. Messages composed in the UI carry
 * `local: true` and are never sent anywhere.
 * ----------------------------------------------------------------------- */

export const PARENT_MESSAGE_SENDER_ID = "guardian"

export type ParentMessageThread = {
  id: string
  subject: string
  courseName?: string
  /** Linked child this thread is about. Omitted for guardian-level threads. */
  childId?: string
  participants: MessageParticipant[]
  /** Local read timestamp used to derive unread state. */
  lastReadAt: string
  messages: ThreadMessage[]
}

const parentGuardianParticipant: MessageParticipant = {
  id: PARENT_MESSAGE_SENDER_ID,
  name: parent.fullName,
  role: "Guardian",
}

const parentContactIshara: MessageParticipant = {
  id: "parent-staff-ishara",
  name: "Ms. Ishara Senanayake",
  role: "Mathematics lecturer · Colombo",
}

const parentContactNadeesha: MessageParticipant = {
  id: "parent-staff-nadeesha",
  name: "Ms. Nadeesha Weerasinghe",
  role: "Science lecturer · Colombo",
}

const parentContactRuwan: MessageParticipant = {
  id: "parent-staff-ruwan",
  name: "Mr. Ruwan Fernando",
  role: "Science lecturer · Colombo",
}

const parentContactDilani: MessageParticipant = {
  id: "parent-staff-dilani",
  name: "Ms. Dilani Jayasuriya",
  role: "Mathematics lecturer · Colombo",
}

const parentContactAcademic: MessageParticipant = {
  id: "parent-office-academic",
  name: "Academic Office",
  role: "Colombo branch office",
}

const parentContactAccounts: MessageParticipant = {
  id: "parent-office-accounts",
  name: "Accounts Office",
  role: "Colombo branch office",
}

export const parentMessageThreads: ParentMessageThread[] = [
  {
    id: "parent-thread-dinuka-maths",
    subject: "Dinuka's extra Mathematics revision class",
    courseName: "Grade 8 Mathematics",
    childId: dinukaChildId,
    participants: [parentGuardianParticipant, parentContactIshara],
    lastReadAt: "2026-11-15T08:00:00+05:30",
    messages: [
      {
        id: "parent-thread-dinuka-maths-1",
        senderId: parentContactIshara.id,
        sentAt: "2026-11-14T17:15:00+05:30",
        body: "Good evening Mr. Perera. I have scheduled an extra Mathematics revision class for Dinuka on Monday 23 November at 4:00 PM in Room 3B. Please make sure he brings his past test papers and calculator.",
      },
      {
        id: "parent-thread-dinuka-maths-2",
        senderId: PARENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-14T18:20:00+05:30",
        body: "Thank you, Ms. Senanayake. We will make sure he attends and brings the revision sheet.",
      },
      {
        id: "parent-thread-dinuka-maths-3",
        senderId: parentContactIshara.id,
        sentAt: "2026-11-15T16:25:00+05:30",
        body: "Perfect. We will work through the questions most students found difficult in the last paper.",
      },
    ],
  },
  {
    id: "parent-thread-sachini-science",
    subject: "Sachini's science practical on Saturday",
    courseName: "Grade 6 Science Explorers Program",
    childId: sachiniChildId,
    participants: [parentGuardianParticipant, parentContactNadeesha],
    lastReadAt: "2026-11-13T20:00:00+05:30",
    messages: [
      {
        id: "parent-thread-sachini-science-1",
        senderId: parentContactNadeesha.id,
        sentAt: "2026-11-13T14:25:00+05:30",
        body: "Hello Mr. Perera. This Saturday's practical for Sachini covers simple circuits. Please send her with the lab book, a pencil and a ruler.",
      },
      {
        id: "parent-thread-sachini-science-2",
        senderId: PARENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-13T19:40:00+05:30",
        body: "Noted, thank you. She will bring everything and arrive on time.",
      },
    ],
  },
  {
    id: "parent-thread-november-fees",
    subject: "November tuition invoices for your children",
    participants: [parentGuardianParticipant, parentContactAccounts],
    lastReadAt: "2026-11-15T11:30:00+05:30",
    messages: [
      {
        id: "parent-thread-november-fees-1",
        senderId: parentContactAccounts.id,
        sentAt: "2026-11-15T09:30:00+05:30",
        body: "Dear Mr. Perera, the November tuition invoices for both children are now available and are due on 30 November. You can review them under Invoices & Payments.",
      },
      {
        id: "parent-thread-november-fees-2",
        senderId: PARENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-15T11:05:00+05:30",
        body: "Thank you. I will arrange the transfer for both invoices this week.",
      },
      {
        id: "parent-thread-november-fees-3",
        senderId: parentContactAccounts.id,
        sentAt: "2026-11-15T12:10:00+05:30",
        body: "Thank you. Bank transfers stay pending until we verify the reference and slip, so please allow one working day for the payment to appear.",
      },
    ],
  },
  {
    id: "parent-thread-dinuka-pickup",
    subject: "Pick-up after the Grade 8 term test",
    childId: dinukaChildId,
    participants: [parentGuardianParticipant, parentContactAcademic],
    lastReadAt: "2026-11-10T09:00:00+05:30",
    messages: [
      {
        id: "parent-thread-dinuka-pickup-1",
        senderId: parentContactAcademic.id,
        sentAt: "2026-11-10T08:10:00+05:30",
        body: "Good morning. The Grade 8 Mathematics term test finishes at 3:00 PM on Saturday 21 November. Could you confirm who will collect Dinuka that day?",
      },
      {
        id: "parent-thread-dinuka-pickup-2",
        senderId: PARENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-10T08:45:00+05:30",
        body: "His mother will collect him. I will pass her contact number to the office before Friday.",
      },
    ],
  },
  {
    id: "parent-thread-sachini-online",
    subject: "Grade 6 Science Explorers online session",
    courseName: "Grade 6 Science Explorers Program",
    childId: sachiniChildId,
    participants: [parentGuardianParticipant, parentContactRuwan],
    lastReadAt: "2026-11-08T00:00:00+05:30",
    messages: [
      {
        id: "parent-thread-sachini-online-1",
        senderId: parentContactRuwan.id,
        sentAt: "2026-11-07T15:30:00+05:30",
        body: "Hello. A reminder that the Science Explorers programme has one online session for Sachini this month. The joining link is a placeholder and will be shared on the day.",
      },
      {
        id: "parent-thread-sachini-online-2",
        senderId: PARENT_MESSAGE_SENDER_ID,
        sentAt: "2026-11-07T18:05:00+05:30",
        body: "Thank you for the reminder. We will check the timetable.",
      },
    ],
  },
  {
    id: "parent-thread-academic-meeting",
    subject: "Parent–teacher meeting in December",
    participants: [parentGuardianParticipant, parentContactAcademic],
    lastReadAt: "2026-11-12T10:00:00+05:30",
    messages: [
      {
        id: "parent-thread-academic-meeting-1",
        senderId: parentContactAcademic.id,
        sentAt: "2026-11-12T09:20:00+05:30",
        body: "Dear guardian, we plan to hold parent–teacher meetings in early December. Please let us know a preferred weekday evening and we will share the schedule.",
      },
    ],
  },
]

/** Staff this guardian may start a local demo thread with. */
export const parentMessageContacts: MessageParticipant[] = [
  parentContactIshara,
  parentContactNadeesha,
  parentContactRuwan,
  parentContactDilani,
  parentContactAcademic,
  parentContactAccounts,
]

export function getParentThreadLastMessage(thread: ParentMessageThread) {
  return thread.messages[thread.messages.length - 1]
}

export function getParentThreadLastMessageAt(thread: ParentMessageThread) {
  return getParentThreadLastMessage(thread)?.sentAt ?? ""
}

export function getParentThreadOtherParticipants(thread: ParentMessageThread) {
  return thread.participants.filter(
    (participant) => participant.id !== PARENT_MESSAGE_SENDER_ID
  )
}

export function getParentParticipantName(
  thread: ParentMessageThread,
  participantId: string
) {
  return (
    thread.participants.find((participant) => participant.id === participantId)
      ?.name ?? "Unknown participant"
  )
}

/**
 * Unread messages are those sent by someone other than the guardian after the
 * last-read timestamp. `readAtOverride` lets the page apply local read state.
 */
export function getParentThreadUnreadCount(
  thread: ParentMessageThread,
  readAtOverride?: string
) {
  const readAt = readAtOverride ?? thread.lastReadAt

  return thread.messages.filter(
    (message) =>
      message.senderId !== PARENT_MESSAGE_SENDER_ID && message.sentAt > readAt
  ).length
}

/* --------------------------------------------------------------------------
 * Communication: notifications for the guardian user
 *
 * Local demo fixtures only. Every row belongs to this guardian. Rows carry the
 * event, channel, delivery status, time and — where a notification is about a
 * specific child — that child (`childId`). `read` mirrors the schema's read_at
 * as local UI state; nothing is persisted. No provider error text is modelled,
 * and disabled external channels (see the portal module switches) produce no
 * rows, matching the schema.
 * ----------------------------------------------------------------------- */

export type ParentNotificationEvent =
  | "payment_submitted"
  | "payment_verified"
  | "payment_rejected"
  | "receipt_issued"
  | "installment_due"
  | "installment_overdue"
  | "attendance_marked"
  | "class_reminder"
  | "exam_published"
  | "notice"

export const PARENT_NOTIFICATION_EVENT_LABELS: Record<
  ParentNotificationEvent,
  string
> = {
  payment_submitted: "Payment submitted",
  payment_verified: "Payment verified",
  payment_rejected: "Payment not verified",
  receipt_issued: "Receipt issued",
  installment_due: "Installment due",
  installment_overdue: "Installment overdue",
  attendance_marked: "Attendance marked",
  class_reminder: "Class reminder",
  exam_published: "Exam published",
  notice: "Notice",
}

export type ParentNotification = {
  id: string
  event: ParentNotificationEvent
  channel: NotificationChannel
  status: NotificationStatus
  createdAt: string
  title: string
  body: string
  /** Linked child this notification is about, when there is one. */
  childId?: string
  read: boolean
}

export const parentNotifications: ParentNotification[] = [
  {
    id: "parent-notification-payment-verified",
    event: "payment_verified",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-15T14:20:00+05:30",
    title: "Payment verified",
    body: "Your LKR 4,000 bank transfer for Dinuka's November invoice has been verified and your balance has been updated.",
    childId: dinukaChildId,
    read: false,
  },
  {
    id: "parent-notification-attendance",
    event: "attendance_marked",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-14T11:45:00+05:30",
    title: "Attendance recorded",
    body: "Sachini was marked present for Grade 6 Mathematics on Tuesday 11 November.",
    childId: sachiniChildId,
    read: false,
  },
  {
    id: "parent-notification-exam-published",
    event: "exam_published",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-13T16:10:00+05:30",
    title: "Grade 8 term test scheduled",
    body: "The Grade 8 Mathematics term test has been added to Dinuka's exam schedule for Saturday 21 November.",
    childId: dinukaChildId,
    read: true,
  },
  {
    id: "parent-notification-installment-due",
    event: "installment_due",
    channel: "email",
    status: "sent",
    createdAt: "2026-11-12T08:00:00+05:30",
    title: "Fee reminder",
    body: "LKR 4,500 remains on Sachini's invoice INV-2026-1048, due on 30 November 2026.",
    childId: sachiniChildId,
    read: false,
  },
  {
    id: "parent-notification-receipt-issued",
    event: "receipt_issued",
    channel: "email",
    status: "sent",
    createdAt: "2026-11-11T10:30:00+05:30",
    title: "Receipt issued",
    body: "A receipt has been issued for your verified payment for Dinuka. You can view it under Receipts.",
    childId: dinukaChildId,
    read: true,
  },
  {
    id: "parent-notification-class-reminder",
    event: "class_reminder",
    channel: "push",
    status: "queued",
    createdAt: "2026-11-10T18:00:00+05:30",
    title: "Class reminder",
    body: "Grade 6 Science Explorers has a session for Sachini this Saturday at 9:00 AM.",
    childId: sachiniChildId,
    read: true,
  },
  {
    id: "parent-notification-notice",
    event: "notice",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-09T09:00:00+05:30",
    title: "New notice published",
    body: "A notice about extended library hours has been published for the Colombo branch.",
    read: true,
  },
  {
    id: "parent-notification-payment-submitted",
    event: "payment_submitted",
    channel: "in_app",
    status: "sent",
    createdAt: "2026-11-08T12:05:00+05:30",
    title: "Payment submitted",
    body: "You submitted a bank transfer of LKR 7,500 for Dinuka's November tuition. It stays pending until the finance team verifies it.",
    childId: dinukaChildId,
    read: true,
  },
  {
    id: "parent-notification-installment-overdue",
    event: "installment_overdue",
    channel: "email",
    status: "sent",
    createdAt: "2026-11-07T08:00:00+05:30",
    title: "Payment overdue",
    body: "An installment for Sachini is overdue. Please review the invoice under Invoices & Payments.",
    childId: sachiniChildId,
    read: true,
  },
  {
    id: "parent-notification-payment-rejected",
    event: "payment_rejected",
    channel: "push",
    status: "sent",
    createdAt: "2026-11-06T15:40:00+05:30",
    title: "Payment not verified",
    body: "We could not match a bank transfer reference for Sachini. Please check the reference and submit the payment again.",
    childId: sachiniChildId,
    read: true,
  },
]
