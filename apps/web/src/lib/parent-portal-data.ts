/**
 * Local demo fixtures for the parent portal UI.
 *
 * These records model one guardian and only the children linked to that
 * guardian. They are not connected to the database, services, APIs or auth.
 * No global student directory, other family's records, payment credentials or
 * auth secrets are included.
 */

import type { ExamMode } from "@/lib/student-portal-data"

export const parent = {
  fullName: "Nimal Perera",
  preferredName: "Nimal",
  initials: "NP",
  contactEmail: "nimal.perera@example.com",
  contactPhone: "+94 71 234 5678",
  portalEnabled: true,
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
  nextClass: ParentChildNextClass | null
  attendance: ParentChildAttendance | null
  upcomingExam: ParentChildExam | null
  latestResult: ParentChildResult | null
  fees: ParentChildFees | null
  latestNotice: ParentChildNotice | null
}

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
    nextClass: {
      courseName: "Grade 8 Mathematics",
      subject: "Mathematics",
      topic: "Fractions and decimals — revision",
      date: "2026-11-21",
      startsAt: "16:30",
      endsAt: "18:00",
      branch: "Colombo",
      room: "Room 3B",
      deliveryMode: "Physical",
      lecturer: "Ms. Ishara Senanayake",
    },
    attendance: {
      rate: 92,
      present: 21,
      late: 2,
      absent: 1,
      excused: 1,
      totalSessions: 25,
      lastMarkedOn: "2026-11-19",
    },
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
    fees: {
      outstanding: 4500,
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
    nextClass: {
      courseName: "Grade 6 Mathematics",
      subject: "Mathematics",
      topic: "Place value and rounding",
      date: "2026-11-23",
      startsAt: "16:00",
      endsAt: "17:30",
      branch: "Colombo",
      room: "Room 1A",
      deliveryMode: "Physical",
      lecturer: "Ms. Dilani Jayasuriya",
    },
    attendance: {
      rate: 88,
      present: 22,
      late: 1,
      absent: 2,
      excused: 1,
      totalSessions: 26,
      lastMarkedOn: "2026-11-18",
    },
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
