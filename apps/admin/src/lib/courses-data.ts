/**
 * Local mock fixtures for the Courses & Classes UI demo.
 *
 * Mirrors `course`, `course_group`, `course_grade_level`, `course_lecturer`,
 * `academic_term`, `intake`, `schedule_slot`, `class_session` and the default
 * `fee_structure` attached to a course. Enrollments are derived from the
 * Students mock data so counts stay consistent across pages. Nothing here is
 * persisted.
 */

import { lecturers } from "@/lib/lecturers-data"
import {
  branches,
  gradeLevels,
  MOCK_TODAY,
  students,
  type StudentEnrollment,
} from "@/lib/students-data"

export type CourseKind = "class" | "program"
export type LearningMode = "scheduled" | "self_paced"
export type DeliveryMode = "physical" | "online" | "hybrid"
export type CourseStatus = "draft" | "active" | "closed" | "archived"
export type IntakeStatus = "open" | "running" | "closed"
export type FeeBillingType = "recurring" | "one_time_package"
export type FeeFrequency = "monthly" | "per_term"

export type SubjectRecord = {
  id: string
  code: string | null
  name: string
}

export type AcademicTermRecord = {
  id: string
  name: string
  startsOn: string
  endsOn: string
  isCurrent: boolean
}

export type CourseGroupRecord = {
  id: string
  name: string
  branchId: string
  subjectId: string
  batchLabel: string | null
  createdAt: string
}

export type IntakeRecord = {
  id: string
  courseId: string
  name: string
  startsOn: string
  endsOn: string | null
  capacity: number | null
  status: IntakeStatus
}

export type CourseLecturerRecord = {
  lecturerId: string
  fullName: string
  isPrimary: boolean
  sharePercent: number
}

export type ScheduleSlotRecord = {
  id: string
  weekday: number
  startsAt: string
  endsAt: string
  room: string | null
}

export type CourseFeeRecord = {
  id: string
  name: string
  billingType: FeeBillingType
  frequency: FeeFrequency | null
  amount: number
  /** Grade the rate applies to. Programs usually have one ungraded rate. */
  gradeName: string | null
  effectiveFrom: string
  accessDurationMonths: number | null
}

export type CourseRecord = {
  id: string
  name: string
  kind: CourseKind
  learningMode: LearningMode
  deliveryMode: DeliveryMode
  attendanceEnabled: boolean
  branchId: string
  branchName: string
  subjectId: string
  subjectName: string
  courseGroupId: string | null
  courseGroupName: string | null
  batchLabel: string | null
  termId: string | null
  termName: string | null
  gradeIds: string[]
  gradeNames: string[]
  lecturers: CourseLecturerRecord[]
  capacity: number | null
  status: CourseStatus
  createdAt: string
  fee: CourseFeeRecord
  slots: ScheduleSlotRecord[]
}

export type CourseEnrollmentRecord = {
  id: string
  studentId: string
  studentName: string
  studentNo: string
  status: StudentEnrollment["status"]
  intakeName: string | null
  enrolledOn: string
  feeSummary: string
}

export type CourseSessionRecord = {
  id: string
  sessionDate: string
  startsAt: string
  endsAt: string
  topic: string
  deliveryMode: DeliveryMode
  status: "scheduled" | "held" | "cancelled"
  meetingProvider: "zoom" | "teams" | null
}

export const subjects: SubjectRecord[] = [
  { id: "sub-maths", code: "MAT", name: "Mathematics" },
  { id: "sub-science", code: "SCI", name: "Science" },
  { id: "sub-physics", code: "PHY", name: "Physics" },
  { id: "sub-english", code: "ENG", name: "English" },
  { id: "sub-ict", code: "ICT", name: "ICT" },
  { id: "sub-business", code: "BUS", name: "Business studies" },
  { id: "sub-chemistry", code: "CHE", name: "Chemistry" },
  { id: "sub-biology", code: "BIO", name: "Biology" },
  { id: "sub-accounting", code: "ACC", name: "Accounting" },
  { id: "sub-economics", code: "ECO", name: "Economics" },
  { id: "sub-geography", code: "GEO", name: "Geography" },
  { id: "sub-sinhala", code: null, name: "Sinhala" },
]

export const academicTerms: AcademicTermRecord[] = [
  {
    id: "term-2025",
    name: "2025 academic year",
    startsOn: "2025-01-01",
    endsOn: "2025-12-31",
    isCurrent: false,
  },
  {
    id: "term-2026",
    name: "2026 academic year",
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
    isCurrent: true,
  },
  {
    id: "term-2027",
    name: "2027 academic year",
    startsOn: "2027-01-01",
    endsOn: "2027-12-31",
    isCurrent: false,
  },
]

export const courseGroups: CourseGroupRecord[] = [
  {
    id: "cg-kandy-maths-2026",
    name: "Kandy Mathematics — 2026",
    branchId: "br-kandy",
    subjectId: "sub-maths",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-col-maths-2026",
    name: "Colombo Mathematics — 2026",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-col-maths-ol-2026",
    name: "Colombo O/L Mathematics — 2026",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    batchLabel: "O/L 2026",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-col-maths-al-2026",
    name: "Colombo A/L Mathematics — 2026",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    batchLabel: "A/L 2026",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-col-science-2026",
    name: "Colombo Science — 2026",
    branchId: "br-colombo",
    subjectId: "sub-science",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-negombo-science-2026",
    name: "Negombo Science — 2026",
    branchId: "br-negombo",
    subjectId: "sub-science",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-galle-maths-2026",
    name: "Galle Primary Mathematics — 2026",
    branchId: "br-galle",
    subjectId: "sub-maths",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-galle-ict-2026",
    name: "Galle ICT — 2026",
    branchId: "br-galle",
    subjectId: "sub-ict",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-negombo-primary-2026",
    name: "Negombo Primary — 2026",
    branchId: "br-negombo",
    subjectId: "sub-english",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-negombo-maths-2027",
    name: "Negombo Mathematics — 2027",
    branchId: "br-negombo",
    subjectId: "sub-maths",
    batchLabel: "2027 batch",
    createdAt: "2026-11-09",
  },
  {
    id: "cg-col-english-2026",
    name: "Colombo English — 2026",
    branchId: "br-colombo",
    subjectId: "sub-english",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-col-business-2026",
    name: "Colombo Business — 2026",
    branchId: "br-colombo",
    subjectId: "sub-business",
    batchLabel: "2026 batch",
    createdAt: "2026-01-05",
  },
  {
    id: "cg-kandy-business-2025",
    name: "Kandy Business — 2025",
    branchId: "br-kandy",
    subjectId: "sub-business",
    batchLabel: "2025 batch",
    createdAt: "2025-01-06",
  },
  {
    id: "cg-col-physics-2025",
    name: "Colombo Physics — 2025",
    branchId: "br-colombo",
    subjectId: "sub-physics",
    batchLabel: "2025 batch",
    createdAt: "2025-01-06",
  },
]

export const programIntakes: IntakeRecord[] = [
  {
    id: "intake-dm-2026-10",
    courseId: "co-digital-marketing",
    name: "October 2026 intake",
    startsOn: "2026-10-05",
    endsOn: "2027-01-30",
    capacity: 40,
    status: "running",
  },
  {
    id: "intake-dm-2027-02",
    courseId: "co-digital-marketing",
    name: "February 2027 intake",
    startsOn: "2027-02-01",
    endsOn: "2027-05-31",
    capacity: 40,
    status: "open",
  },
  {
    id: "intake-dm-2026-06",
    courseId: "co-digital-marketing",
    name: "June 2026 intake",
    startsOn: "2026-06-01",
    endsOn: "2026-09-30",
    capacity: 40,
    status: "closed",
  },
  {
    id: "intake-ict-2024-03",
    courseId: "co-ict-beginners",
    name: "March 2024 intake",
    startsOn: "2024-03-04",
    endsOn: "2024-08-30",
    capacity: 25,
    status: "closed",
  },
]

type LecturerSeed = {
  lecturerId: string
  sharePercent: number
  isPrimary: boolean
}

type SlotSeed = {
  weekday: number
  startsAt: string
  endsAt: string
  room?: string
}

type FeeSeed = {
  name: string
  billingType: FeeBillingType
  frequency?: FeeFrequency
  amount: number
  effectiveFrom: string
  accessDurationMonths?: number
}

type CourseSeed = {
  id: string
  name: string
  kind: CourseKind
  learningMode?: LearningMode
  deliveryMode: DeliveryMode
  branchId: string
  subjectId: string
  courseGroupId: string | null
  termId: string | null
  gradeIds?: string[]
  lecturers: LecturerSeed[]
  capacity: number | null
  status: CourseStatus
  createdAt: string
  fee: FeeSeed
  slots?: SlotSeed[]
}

function lecturer(
  lecturerId: string,
  sharePercent: number,
  isPrimary = false
): LecturerSeed {
  return { lecturerId, sharePercent, isPrimary }
}

function slot(
  weekday: number,
  startsAt: string,
  endsAt: string,
  room?: string
): SlotSeed {
  return { weekday, startsAt, endsAt, room }
}

const courseSeeds: CourseSeed[] = [
  {
    id: "co-g2-maths",
    name: "Primary Mathematics — Grade 2",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-galle",
    subjectId: "sub-maths",
    courseGroupId: "cg-galle-maths-2026",
    termId: "term-2026",
    gradeIds: ["gl-2"],
    lecturers: [lecturer("lec-4", 100, true)],
    capacity: 20,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 2 mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 3500,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(6, "08:00", "10:00", "G-01")],
  },
  {
    id: "co-g3-english",
    name: "Primary English — Grade 3",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-negombo",
    subjectId: "sub-english",
    courseGroupId: "cg-negombo-primary-2026",
    termId: "term-2026",
    gradeIds: ["gl-3"],
    lecturers: [
      lecturer("lec-6", 60, true),
      lecturer("lec-9", 40),
    ],
    capacity: 24,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 3 English monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 3800,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(6, "10:30", "12:30", "N-03")],
  },
  {
    id: "co-g4-maths",
    name: "Grade 4 Mathematics — Saturday",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-negombo",
    subjectId: "sub-maths",
    courseGroupId: "cg-negombo-maths-2027",
    termId: "term-2027",
    gradeIds: ["gl-4"],
    lecturers: [lecturer("lec-4", 100, true)],
    capacity: 25,
    status: "draft",
    createdAt: "2026-11-09",
    fee: {
      name: "Grade 4 mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 3800,
      effectiveFrom: "2027-01-01",
    },
    slots: [slot(6, "09:00", "11:00", "N-01")],
  },
  {
    id: "co-g6-maths",
    name: "Grade 6 Mathematics — Saturday",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-kandy",
    subjectId: "sub-maths",
    courseGroupId: "cg-kandy-maths-2026",
    termId: "term-2026",
    gradeIds: ["gl-6"],
    lecturers: [lecturer("lec-4", 100, true)],
    capacity: 28,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 6 mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 4000,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(6, "08:00", "10:00", "K-02")],
  },
  {
    id: "co-g7-maths",
    name: "Grade 7 Mathematics — Weekday",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-kandy",
    subjectId: "sub-maths",
    courseGroupId: "cg-kandy-maths-2026",
    termId: "term-2026",
    gradeIds: ["gl-7"],
    lecturers: [lecturer("lec-4", 100, true)],
    capacity: 30,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 7 mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 4000,
      effectiveFrom: "2026-01-01",
    },
    slots: [
      slot(2, "16:00", "18:00", "K-01"),
      slot(4, "16:00", "18:00", "K-01"),
    ],
  },
  {
    id: "co-g8-maths",
    name: "Grade 8 Mathematics — Saturday",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    courseGroupId: "cg-col-maths-2026",
    termId: "term-2026",
    gradeIds: ["gl-8"],
    lecturers: [lecturer("lec-1", 100, true)],
    capacity: 30,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 8 mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 4500,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(6, "08:30", "10:30", "C-201")],
  },
  {
    id: "co-g8-science",
    name: "Grade 8 Science — Saturday",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-science",
    courseGroupId: "cg-col-science-2026",
    termId: "term-2026",
    gradeIds: ["gl-8"],
    lecturers: [
      lecturer("lec-2", 60, true),
      lecturer("lec-3", 40),
    ],
    capacity: 26,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 8 science monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 4000,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(6, "11:00", "13:00", "C-204")],
  },
  {
    id: "co-g9-ict",
    name: "Grade 9 ICT",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-galle",
    subjectId: "sub-ict",
    courseGroupId: "cg-galle-ict-2026",
    termId: "term-2026",
    gradeIds: ["gl-9"],
    lecturers: [lecturer("lec-3", 100, true)],
    capacity: 22,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 9 ICT monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 4200,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(7, "09:00", "11:00", "G-LAB")],
  },
  {
    id: "co-g9-maths",
    name: "Grade 9 Mathematics",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-kandy",
    subjectId: "sub-maths",
    courseGroupId: "cg-kandy-maths-2026",
    termId: "term-2026",
    gradeIds: ["gl-9"],
    lecturers: [
      lecturer("lec-1", 60, true),
      lecturer("lec-4", 40),
    ],
    capacity: 28,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 9 mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 4300,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(3, "16:00", "18:00", "K-03")],
  },
  {
    id: "co-g10-science",
    name: "Grade 10 Science",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-negombo",
    subjectId: "sub-science",
    courseGroupId: "cg-negombo-science-2026",
    termId: "term-2026",
    gradeIds: ["gl-10"],
    lecturers: [
      lecturer("lec-5", 50, true),
      lecturer("lec-2", 50),
    ],
    capacity: 30,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "Grade 10 science monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 5000,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(7, "08:30", "11:00", "N-05")],
  },
  {
    id: "co-g11-maths",
    name: "Grade 11 Mathematics — O/L",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    courseGroupId: "cg-col-maths-ol-2026",
    termId: "term-2026",
    gradeIds: ["gl-11"],
    lecturers: [
      lecturer("lec-1", 70, true),
      lecturer("lec-2", 30),
    ],
    capacity: 32,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "O/L mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 6000,
      effectiveFrom: "2026-01-01",
    },
    slots: [
      slot(1, "16:30", "18:30", "C-301"),
      slot(4, "16:30", "18:30", "C-301"),
    ],
  },
  {
    id: "co-g11-science",
    name: "Grade 11 Science — O/L",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-science",
    courseGroupId: "cg-col-science-2026",
    termId: "term-2026",
    gradeIds: ["gl-11"],
    lecturers: [
      lecturer("lec-2", 60, true),
      lecturer("lec-5", 40),
    ],
    capacity: 30,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "O/L science monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 6000,
      effectiveFrom: "2026-01-01",
    },
    slots: [
      slot(2, "16:30", "18:30", "C-302"),
      slot(5, "16:30", "18:30", "C-302"),
    ],
  },
  {
    id: "co-g11-english",
    name: "O/L English Language",
    kind: "class",
    deliveryMode: "hybrid",
    branchId: "br-colombo",
    subjectId: "sub-english",
    courseGroupId: "cg-col-english-2026",
    termId: "term-2026",
    gradeIds: ["gl-11"],
    lecturers: [lecturer("lec-6", 100, true)],
    capacity: 25,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "O/L English monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 5000,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(3, "15:30", "17:30", "C-105")],
  },
  {
    id: "co-g11-business",
    name: "O/L Business Studies",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-business",
    courseGroupId: "cg-col-business-2026",
    termId: "term-2026",
    gradeIds: ["gl-11"],
    lecturers: [lecturer("lec-7", 100, true)],
    capacity: 25,
    status: "active",
    createdAt: "2026-09-01",
    fee: {
      name: "O/L business studies monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 5000,
      effectiveFrom: "2026-09-01",
    },
    slots: [slot(4, "15:30", "17:30", "C-110")],
  },
  {
    id: "co-g12-physics",
    name: "A/L Physics",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-physics",
    courseGroupId: "cg-col-physics-2025",
    termId: "term-2026",
    gradeIds: ["gl-12"],
    lecturers: [lecturer("lec-5", 100, true)],
    capacity: 24,
    status: "closed",
    createdAt: "2024-01-05",
    fee: {
      name: "A/L physics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 7000,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(1, "08:00", "10:30", "C-402")],
  },
  {
    id: "co-g13-combined",
    name: "A/L Combined Mathematics",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    courseGroupId: "cg-col-maths-al-2026",
    termId: "term-2026",
    gradeIds: ["gl-13"],
    lecturers: [lecturer("lec-1", 100, true)],
    capacity: 20,
    status: "active",
    createdAt: "2026-01-05",
    fee: {
      name: "A/L combined mathematics monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 7500,
      effectiveFrom: "2026-01-01",
    },
    slots: [
      slot(2, "07:30", "10:00", "C-401"),
      slot(4, "07:30", "10:00", "C-401"),
    ],
  },
  {
    id: "co-g13-business",
    name: "A/L Business Studies",
    kind: "class",
    deliveryMode: "physical",
    branchId: "br-kandy",
    subjectId: "sub-business",
    courseGroupId: "cg-kandy-business-2025",
    termId: "term-2026",
    gradeIds: ["gl-13"],
    lecturers: [
      lecturer("lec-7", 70, true),
      lecturer("lec-10", 30),
    ],
    capacity: 20,
    status: "closed",
    createdAt: "2023-01-05",
    fee: {
      name: "A/L business studies monthly fee",
      billingType: "recurring",
      frequency: "monthly",
      amount: 6500,
      effectiveFrom: "2026-01-01",
    },
    slots: [slot(3, "08:00", "10:30", "K-201")],
  },
  {
    id: "co-adult-ict",
    name: "Adult ICT Certificate",
    kind: "program",
    learningMode: "self_paced",
    deliveryMode: "online",
    branchId: "br-colombo",
    subjectId: "sub-ict",
    courseGroupId: null,
    termId: null,
    gradeIds: [],
    lecturers: [lecturer("lec-3", 100, true)],
    capacity: null,
    status: "active",
    createdAt: "2026-07-20",
    fee: {
      name: "Adult ICT certificate — full access",
      billingType: "one_time_package",
      amount: 18000,
      effectiveFrom: "2026-08-01",
      accessDurationMonths: 12,
    },
  },
  {
    id: "co-digital-marketing",
    name: "Digital Marketing Foundations",
    kind: "program",
    learningMode: "scheduled",
    deliveryMode: "hybrid",
    branchId: "br-colombo",
    subjectId: "sub-business",
    courseGroupId: null,
    termId: null,
    gradeIds: [],
    lecturers: [lecturer("lec-7", 100, true)],
    capacity: 40,
    status: "active",
    createdAt: "2026-09-15",
    fee: {
      name: "Digital marketing programme package",
      billingType: "one_time_package",
      amount: 12000,
      effectiveFrom: "2026-10-01",
      accessDurationMonths: 4,
    },
    slots: [slot(2, "19:00", "21:00")],
  },
  {
    id: "co-ict-beginners",
    name: "ICT for Beginners",
    kind: "program",
    learningMode: "scheduled",
    deliveryMode: "physical",
    branchId: "br-galle",
    subjectId: "sub-ict",
    courseGroupId: null,
    termId: null,
    gradeIds: [],
    lecturers: [lecturer("lec-3", 100, true)],
    capacity: 25,
    status: "archived",
    createdAt: "2024-02-10",
    fee: {
      name: "ICT for beginners programme package",
      billingType: "one_time_package",
      amount: 9500,
      effectiveFrom: "2024-03-01",
      accessDurationMonths: 3,
    },
    slots: [slot(6, "14:00", "16:00", "G-LAB")],
  },
]

function buildCourse(seed: CourseSeed): CourseRecord {
  const branch = branches.find((item) => item.id === seed.branchId)!
  const subject = subjects.find((item) => item.id === seed.subjectId)!
  const group = seed.courseGroupId
    ? courseGroups.find((item) => item.id === seed.courseGroupId)
    : null
  const term = seed.termId
    ? academicTerms.find((item) => item.id === seed.termId)
    : null
  const gradeNames = (seed.gradeIds ?? [])
    .map(
      (gradeId) => gradeLevels.find((grade) => grade.id === gradeId)?.name
    )
    .filter((name): name is string => Boolean(name))
  const learningMode = seed.learningMode ?? "scheduled"

  return {
    id: seed.id,
    name: seed.name,
    kind: seed.kind,
    learningMode,
    deliveryMode: seed.deliveryMode,
    attendanceEnabled: learningMode === "scheduled",
    branchId: branch.id,
    branchName: branch.name,
    subjectId: subject.id,
    subjectName: subject.name,
    courseGroupId: group?.id ?? null,
    courseGroupName: group?.name ?? null,
    batchLabel: group?.batchLabel ?? null,
    termId: term?.id ?? null,
    termName: term?.name ?? null,
    gradeIds: seed.gradeIds ?? [],
    gradeNames,
    lecturers: seed.lecturers.map((item) => {
      const lecturerRecord = lecturers.find(
        (record) => record.id === item.lecturerId
      )

      return {
        lecturerId: item.lecturerId,
        fullName: lecturerRecord?.fullName ?? "Unknown lecturer",
        isPrimary: item.isPrimary,
        sharePercent: item.sharePercent,
      }
    }),
    capacity: seed.capacity,
    status: seed.status,
    createdAt: seed.createdAt,
    fee: {
      id: `fee-${seed.id}`,
      name: seed.fee.name,
      billingType: seed.fee.billingType,
      frequency: seed.fee.frequency ?? null,
      amount: seed.fee.amount,
      gradeName: gradeNames[0] ?? null,
      effectiveFrom: seed.fee.effectiveFrom,
      accessDurationMonths: seed.fee.accessDurationMonths ?? null,
    },
    slots: (seed.slots ?? []).map((item, index) => ({
      id: `slot-${seed.id}-${index + 1}`,
      weekday: item.weekday,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      room: item.room ?? null,
    })),
  }
}

export const courses: CourseRecord[] = courseSeeds.map(buildCourse)

export function getCourseById(courseId: string) {
  return courses.find((course) => course.id === courseId)
}

export function getCourseEnrollments(
  courseId: string
): CourseEnrollmentRecord[] {
  return students.flatMap((student) =>
    student.enrollments
      .filter((enrollment) => enrollment.courseId === courseId)
      .map((enrollment) => ({
        id: enrollment.id,
        studentId: student.id,
        studentName: student.fullName,
        studentNo: student.studentNo,
        status: enrollment.status,
        intakeName: enrollment.intakeName,
        enrolledOn: enrollment.enrolledOn,
        feeSummary: enrollment.feeSummary,
      }))
  )
}

export function getCourseEnrollmentCounts(courseId: string) {
  const enrollments = getCourseEnrollments(courseId)

  return {
    active: enrollments.filter((item) => item.status === "active").length,
    completed: enrollments.filter((item) => item.status === "completed").length,
    dropped: enrollments.filter((item) => item.status === "dropped").length,
    total: enrollments.length,
  }
}

export function getCourseIntakes(courseId: string) {
  return programIntakes.filter((intake) => intake.courseId === courseId)
}

export function getPrimaryLecturer(course: CourseRecord) {
  return (
    course.lecturers.find((item) => item.isPrimary) ?? course.lecturers[0]
  )
}

export function getCourseTermLabel(course: CourseRecord) {
  if (course.kind === "class") return course.termName ?? "No term"

  const intakes = getCourseIntakes(course.id)
  if (course.learningMode === "self_paced") return "No intake required"
  if (intakes.length === 0) return "Intake required"

  const open = intakes.find((intake) => intake.status === "open")
  if (open) return open.name

  return `${intakes.length} ${intakes.length === 1 ? "intake" : "intakes"}`
}

const weekdayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

export const weekdayOptions = weekdayNames.map((name, index) => ({
  value: String(index + 1),
  label: name,
}))

export function getWeekdayName(weekday: number) {
  return weekdayNames[weekday - 1] ?? "Unknown day"
}

export const deliveryModeLabels: Record<DeliveryMode, string> = {
  physical: "Physical",
  online: "Online",
  hybrid: "Hybrid",
}

export const learningModeLabels: Record<LearningMode, string> = {
  scheduled: "Scheduled",
  self_paced: "Self-paced",
}

export const courseStatusLabels: Record<CourseStatus, string> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  archived: "Archived",
}

export const intakeStatusLabels: Record<IntakeStatus, string> = {
  open: "Open",
  running: "Running",
  closed: "Closed",
}

export const courseKindLabels: Record<CourseKind, string> = {
  class: "Class",
  program: "Program",
}

export function formatLkr(amount: number) {
  return `LKR ${new Intl.NumberFormat("en-GB").format(amount)}`
}

export function getFeeSummary(fee: CourseFeeRecord) {
  if (fee.billingType === "one_time_package") {
    const access =
      fee.accessDurationMonths === null
        ? "lifetime access"
        : `${fee.accessDurationMonths} months access`

    return `${formatLkr(fee.amount)} one-time package · ${access}`
  }

  return `${formatLkr(fee.amount)} / ${
    fee.frequency === "per_term" ? "term" : "month"
  }`
}

export function formatTimeValue(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":")
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart)
  const date = new Date(Date.UTC(2026, 0, 1, hours, minutes))

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)

  return value.toISOString().slice(0, 10)
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()

  return day === 0 ? 7 : day
}

/**
 * Sample sessions for the detail sheet. Weekly slots are recurring templates,
 * not attendance events, so these are generated separately around mock today.
 */
export function getCourseSessions(course: CourseRecord): CourseSessionRecord[] {
  if (course.slots.length === 0) return []

  const firstSlot = course.slots[0]!
  const daysSinceSlot =
    (isoWeekday(MOCK_TODAY) - firstSlot.weekday + 7) % 7 || 7
  const previousDate = addDays(MOCK_TODAY, -daysSinceSlot)
  const topics = [
    `${course.subjectName} — recap and worked examples`,
    `${course.subjectName} — past-paper practice`,
    `${course.subjectName} — unit review and Q&A`,
  ]
  const meetingProvider =
    course.deliveryMode === "physical" ? null : "zoom"

  return [0, 7, 14].map((offset, index) => ({
    id: `session-${course.id}-${index + 1}`,
    sessionDate: addDays(previousDate, offset),
    startsAt: firstSlot.startsAt,
    endsAt: firstSlot.endsAt,
    topic: topics[index]!,
    deliveryMode: course.deliveryMode,
    status: index === 0 ? "held" : "scheduled",
    meetingProvider: meetingProvider as "zoom" | "teams" | null,
  }))
}

export const courseKindTabs: { value: CourseKind; label: string }[] = [
  { value: "class", label: "Classes" },
  { value: "program", label: "Programs" },
]

export const courseBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const courseSubjectFilterOptions = [
  { value: "all", label: "All subjects" },
  ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
]

export const courseGradeFilterOptions = [
  { value: "all", label: "All grades" },
  ...gradeLevels.map((grade) => ({ value: grade.id, label: grade.name })),
]

export const courseTermFilterOptions = [
  { value: "all", label: "All terms" },
  ...academicTerms.map((term) => ({ value: term.id, label: term.name })),
]

export const courseLecturerFilterOptions = [
  { value: "all", label: "All lecturers" },
  ...lecturers.map((lecturerRecord) => ({
    value: lecturerRecord.id,
    label: lecturerRecord.fullName,
  })),
]

export const courseDeliveryFilterOptions = [
  { value: "all", label: "All delivery modes" },
  { value: "physical", label: "Physical" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
]

export const courseStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
]

export const courseDeliveryFormOptions = [
  { value: "physical", label: "Physical" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
]

export const courseStatusFormOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
]

export const courseLearningModeFormOptions = [
  { value: "scheduled", label: "Scheduled" },
  { value: "self_paced", label: "Self-paced" },
]

export const courseSubjectFormOptions = subjects.map((subject) => ({
  value: subject.id,
  label: subject.name,
}))

export const courseTermFormOptions = academicTerms.map((term) => ({
  value: term.id,
  label: term.name,
}))

export const courseBranchFormOptions = branches.map((branch) => ({
  value: branch.id,
  label: branch.name,
}))

export const courseLecturerFormOptions = lecturers.map((lecturerRecord) => ({
  value: lecturerRecord.id,
  label: lecturerRecord.fullName,
}))
