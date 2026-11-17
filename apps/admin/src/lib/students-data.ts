/**
 * Local mock fixtures for the Students UI demo.
 *
 * These records mirror the shape of `student`, `student_branch`, `student_guardian`,
 * `student_level` and `enrollment` so the page can show realistic education data.
 * Nothing here is persisted, and no QR token value is included.
 */

export const MOCK_TODAY = "2026-11-13"

/** Mirrors `organization.guardian_required_below_age` in the mock settings. */
export const GUARDIAN_REQUIRED_BELOW_AGE = 16

export type StudentStatus = "active" | "alumni" | "suspended"
export type GradeStage =
  "primary" | "junior" | "ordinary_level" | "advanced_level"
export type EnrollmentStatus = "active" | "dropped" | "completed"
export type AccessStatus = "active" | "restricted"
export type LevelReason = "admission" | "promotion" | "correction"

export type StudentBranchLink = {
  branchId: string
  branchName: string
  isPrimary: boolean
  joinedOn: string
}

export type StudentGuardianLink = {
  id: string
  fullName: string
  relationship: string
  phone: string
  email: string | null
  address: string
  isPrimary: boolean
  portalEnabled: boolean
}

export type StudentGradeRecord = {
  id: string
  gradeLevelId: string
  gradeName: string
  stage: GradeStage
  fromDate: string
  /** Exclusive: the first day the student was no longer in this grade. */
  toDate: string | null
  reason: LevelReason
}

export type StudentEnrollment = {
  id: string
  courseId: string
  courseName: string
  kind: "class" | "program"
  branchName: string
  intakeName: string | null
  enrolledOn: string
  status: EnrollmentStatus
  endReason: "dropped" | "promoted" | "course_ended" | "transferred" | null
  accessStatus: AccessStatus
  accessStartsOn: string
  /** Exclusive: the first day without access. null means ongoing / lifetime. */
  accessEndsOn: string | null
  feeSummary: string
}

export type StudentRecord = {
  id: string
  studentNo: string
  fullName: string
  dateOfBirth: string
  gender: "Male" | "Female" | null
  schoolName: string | null
  nic: string | null
  contactEmail: string | null
  contactPhone: string | null
  status: StudentStatus
  createdAt: string
  qrCardIssued: boolean
  portalLinked: boolean
  portalEmail: string | null
  branches: StudentBranchLink[]
  guardians: StudentGuardianLink[]
  grades: StudentGradeRecord[]
  enrollments: StudentEnrollment[]
}

export const branches = [
  { id: "br-colombo", name: "Colombo" },
  { id: "br-kandy", name: "Kandy" },
  { id: "br-galle", name: "Galle" },
  { id: "br-negombo", name: "Negombo" },
  { id: "br-jaffna", name: "Jaffna" },
] as const

export const gradeLevels: {
  id: string
  name: string
  stage: GradeStage
  ordinal: number
}[] = [
  { id: "gl-1", name: "Grade 1", stage: "primary", ordinal: 1 },
  { id: "gl-2", name: "Grade 2", stage: "primary", ordinal: 2 },
  { id: "gl-3", name: "Grade 3", stage: "primary", ordinal: 3 },
  { id: "gl-4", name: "Grade 4", stage: "primary", ordinal: 4 },
  { id: "gl-5", name: "Grade 5", stage: "primary", ordinal: 5 },
  { id: "gl-6", name: "Grade 6", stage: "junior", ordinal: 6 },
  { id: "gl-7", name: "Grade 7", stage: "junior", ordinal: 7 },
  { id: "gl-8", name: "Grade 8", stage: "junior", ordinal: 8 },
  { id: "gl-9", name: "Grade 9", stage: "junior", ordinal: 9 },
  { id: "gl-10", name: "Grade 10", stage: "ordinary_level", ordinal: 10 },
  { id: "gl-11", name: "Grade 11", stage: "ordinary_level", ordinal: 11 },
  { id: "gl-12", name: "Grade 12", stage: "advanced_level", ordinal: 12 },
  { id: "gl-13", name: "Grade 13", stage: "advanced_level", ordinal: 13 },
]

export const courseOptions = [
  { id: "co-g8-maths", name: "Grade 8 Mathematics — Saturday" },
  { id: "co-g8-science", name: "Grade 8 Science — Saturday" },
  { id: "co-g7-maths", name: "Grade 7 Mathematics — Weekday" },
  { id: "co-g6-maths", name: "Grade 6 Mathematics — Saturday" },
  { id: "co-g11-maths", name: "Grade 11 Mathematics — O/L" },
  { id: "co-g11-science", name: "Grade 11 Science — O/L" },
  { id: "co-g11-english", name: "O/L English Language" },
  { id: "co-g13-combined", name: "A/L Combined Mathematics" },
  { id: "co-g12-physics", name: "A/L Physics" },
  { id: "co-g9-ict", name: "Grade 9 ICT" },
  { id: "co-g3-english", name: "Primary English — Grade 3" },
  { id: "co-g13-business", name: "A/L Business Studies" },
  { id: "co-g10-science", name: "Grade 10 Science" },
  { id: "co-g9-maths", name: "Grade 9 Mathematics" },
  { id: "co-g11-business", name: "O/L Business Studies" },
  { id: "co-g2-maths", name: "Primary Mathematics — Grade 2" },
  { id: "co-adult-ict", name: "Adult ICT Certificate" },
] as const

const stageLabels: Record<GradeStage, string> = {
  primary: "Primary",
  junior: "Junior",
  ordinary_level: "Ordinary level",
  advanced_level: "Advanced level",
}

export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Active",
  alumni: "Alumni",
  suspended: "Suspended",
}

export function stageLabel(stage: GradeStage) {
  return stageLabels[stage]
}

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(new Date(`${value}T12:00:00+05:30`))
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  }).format(new Date(value))
}

export function calculateAge(
  dateOfBirth: string,
  asOf: string = MOCK_TODAY
): number {
  const birth = new Date(`${dateOfBirth}T12:00:00+05:30`)
  const reference = new Date(`${asOf}T12:00:00+05:30`)

  let age = reference.getFullYear() - birth.getFullYear()
  const hasHadBirthday =
    reference.getMonth() > birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() &&
      reference.getDate() >= birth.getDate())

  if (!hasHadBirthday) age -= 1

  return Math.max(age, 0)
}

export function isGuardianRequired(dateOfBirth: string) {
  return calculateAge(dateOfBirth) < GUARDIAN_REQUIRED_BELOW_AGE
}

export function getGradeAsOf(
  student: StudentRecord,
  asOf: string = MOCK_TODAY
): StudentGradeRecord | undefined {
  return student.grades.find(
    (grade) =>
      grade.fromDate <= asOf && (grade.toDate === null || asOf < grade.toDate)
  )
}

export function getPrimaryBranch(student: StudentRecord) {
  return (
    student.branches.find((branch) => branch.isPrimary) ?? student.branches[0]
  )
}

export function getActiveEnrollmentCount(student: StudentRecord) {
  return student.enrollments.filter(
    (enrollment) => enrollment.status === "active"
  ).length
}

export function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * Effective access mirrors the visible part of the C8 rule:
 * active or completed status, inside the access date window, and not restricted.
 * Used only for display in this UI demo.
 */
export function hasEffectiveAccess(
  enrollment: StudentEnrollment,
  asOf: string = MOCK_TODAY
) {
  return (
    (enrollment.status === "active" || enrollment.status === "completed") &&
    enrollment.accessStartsOn <= asOf &&
    (enrollment.accessEndsOn === null || asOf < enrollment.accessEndsOn) &&
    enrollment.accessStatus === "active"
  )
}

function branch(
  branchId: string,
  branchName: string,
  joinedOn: string,
  isPrimary = false
): StudentBranchLink {
  return { branchId, branchName, joinedOn, isPrimary }
}

function grade(
  id: string,
  gradeLevelId: string,
  fromDate: string,
  toDate: string | null,
  reason: LevelReason = "promotion"
): StudentGradeRecord {
  const level = gradeLevels.find((item) => item.id === gradeLevelId)!

  return {
    id,
    gradeLevelId,
    gradeName: level.name,
    stage: level.stage,
    fromDate,
    toDate,
    reason,
  }
}

function enrollment(
  input: Omit<StudentEnrollment, "endReason"> & {
    endReason?: StudentEnrollment["endReason"]
  }
): StudentEnrollment {
  return { endReason: null, ...input }
}

export const students: StudentRecord[] = [
  {
    id: "stu-1",
    studentNo: "STU-2024-0114",
    fullName: "Dinuka Perera",
    dateOfBirth: "2012-04-18",
    gender: "Male",
    schoolName: "Royal College, Colombo",
    nic: null,
    contactEmail: "dinuka.perera@example.com",
    contactPhone: "+94 77 123 4567",
    status: "active",
    createdAt: "2024-01-15",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "dinuka.p@example.com",
    branches: [
      branch("br-colombo", "Colombo", "2024-01-15", true),
      branch("br-kandy", "Kandy", "2025-06-02"),
    ],
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
    ],
    grades: [
      grade("sl-1a", "gl-6", "2024-01-15", "2025-01-13", "admission"),
      grade("sl-1b", "gl-7", "2025-01-13", "2026-01-12"),
      grade("sl-1c", "gl-8", "2026-01-12", null),
    ],
    enrollments: [
      enrollment({
        id: "en-1a",
        courseId: "co-g8-maths",
        courseName: "Grade 8 Mathematics — Saturday",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 4,500 / month",
      }),
      enrollment({
        id: "en-1b",
        courseId: "co-g8-science",
        courseName: "Grade 8 Science — Saturday",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 4,000 / month",
      }),
      enrollment({
        id: "en-1c",
        courseId: "co-g7-maths",
        courseName: "Grade 7 Mathematics — Weekday",
        kind: "class",
        branchName: "Kandy",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "completed",
        endReason: "promoted",
        accessStatus: "active",
        accessStartsOn: "2025-01-13",
        accessEndsOn: "2026-01-12",
        feeSummary: "LKR 4,000 / month",
      }),
    ],
  },
  {
    id: "stu-2",
    studentNo: "STU-2023-0087",
    fullName: "Anjali Fernando",
    dateOfBirth: "2010-09-02",
    gender: "Female",
    schoolName: "Visakha Vidyalaya, Colombo",
    nic: null,
    contactEmail: "anjali.fernando@example.com",
    contactPhone: "+94 77 456 7890",
    status: "active",
    createdAt: "2023-01-09",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "anjali.f@example.com",
    branches: [branch("br-colombo", "Colombo", "2023-01-09", true)],
    guardians: [
      {
        id: "gu-3",
        fullName: "Sunethra Fernando",
        relationship: "Mother",
        phone: "+94 71 567 8901",
        email: "sunethra.fernando@example.com",
        address: "18, Lake Drive, Colombo 05",
        isPrimary: true,
        portalEnabled: true,
      },
    ],
    grades: [
      grade("sl-2a", "gl-9", "2023-01-09", "2024-01-08", "admission"),
      grade("sl-2b", "gl-10", "2024-01-08", "2025-01-13"),
      grade("sl-2c", "gl-11", "2025-01-13", null),
    ],
    enrollments: [
      enrollment({
        id: "en-2a",
        courseId: "co-g11-maths",
        courseName: "Grade 11 Mathematics — O/L",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2025-01-13",
        accessEndsOn: null,
        feeSummary: "LKR 5,000 / month",
      }),
      enrollment({
        id: "en-2b",
        courseId: "co-g11-science",
        courseName: "Grade 11 Science — O/L",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2025-01-13",
        accessEndsOn: null,
        feeSummary: "LKR 5,500 / month",
      }),
      enrollment({
        id: "en-2c",
        courseId: "co-g11-english",
        courseName: "O/L English Language",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 3,500 / month",
      }),
    ],
  },
  {
    id: "stu-3",
    studentNo: "STU-2025-0201",
    fullName: "Kavindu Jayasinghe",
    dateOfBirth: "2015-02-11",
    gender: "Male",
    schoolName: "Gateway College, Kandy",
    nic: null,
    contactEmail: "kavindu.j@example.com",
    contactPhone: "+94 70 678 9012",
    status: "active",
    createdAt: "2025-01-13",
    qrCardIssued: true,
    portalLinked: false,
    portalEmail: null,
    branches: [branch("br-kandy", "Kandy", "2025-01-13", true)],
    guardians: [
      {
        id: "gu-4",
        fullName: "Chaminda Jayasinghe",
        relationship: "Father",
        phone: "+94 77 789 0123",
        email: "chaminda.j@example.com",
        address: "112, Peradeniya Road, Kandy",
        isPrimary: true,
        portalEnabled: true,
      },
      {
        id: "gu-5",
        fullName: "Iresha Jayasinghe",
        relationship: "Mother",
        phone: "+94 76 890 1234",
        email: null,
        address: "112, Peradeniya Road, Kandy",
        isPrimary: false,
        portalEnabled: false,
      },
    ],
    grades: [
      grade("sl-3a", "gl-5", "2025-01-13", "2026-01-12", "admission"),
      grade("sl-3b", "gl-6", "2026-01-12", null),
    ],
    enrollments: [
      enrollment({
        id: "en-3a",
        courseId: "co-g6-maths",
        courseName: "Grade 6 Mathematics — Saturday",
        kind: "class",
        branchName: "Kandy",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 4,000 / month",
      }),
    ],
  },
  {
    id: "stu-4",
    studentNo: "STU-2022-0064",
    fullName: "Nethmi Silva",
    dateOfBirth: "2008-06-30",
    gender: "Female",
    schoolName: "Ladies' College, Colombo",
    nic: "200814502345",
    contactEmail: "nethmi.silva@example.com",
    contactPhone: "+94 75 901 2345",
    status: "alumni",
    createdAt: "2022-01-10",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "nethmi.s@example.com",
    branches: [branch("br-colombo", "Colombo", "2022-01-10", true)],
    guardians: [],
    grades: [
      grade("sl-4a", "gl-11", "2022-01-10", "2023-01-09", "admission"),
      grade("sl-4b", "gl-12", "2023-01-09", "2024-01-08"),
      grade("sl-4c", "gl-13", "2024-01-08", "2025-12-31"),
    ],
    enrollments: [
      enrollment({
        id: "en-4a",
        courseId: "co-g13-combined",
        courseName: "A/L Combined Mathematics",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2024-01-08",
        status: "completed",
        endReason: "course_ended",
        accessStatus: "active",
        accessStartsOn: "2024-01-08",
        accessEndsOn: "2025-12-31",
        feeSummary: "LKR 7,500 / month",
      }),
      enrollment({
        id: "en-4b",
        courseId: "co-g12-physics",
        courseName: "A/L Physics",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2024-01-08",
        status: "completed",
        endReason: "course_ended",
        accessStatus: "active",
        accessStartsOn: "2024-01-08",
        accessEndsOn: "2025-12-31",
        feeSummary: "LKR 7,000 / month",
      }),
    ],
  },
  {
    id: "stu-5",
    studentNo: "STU-2024-0142",
    fullName: "Tharindu Bandara",
    dateOfBirth: "2011-12-05",
    gender: "Male",
    schoolName: "Mahinda College, Galle",
    nic: null,
    contactEmail: "tharindu.b@example.com",
    contactPhone: "+94 71 012 3456",
    status: "suspended",
    createdAt: "2024-02-05",
    qrCardIssued: true,
    portalLinked: false,
    portalEmail: null,
    branches: [branch("br-galle", "Galle", "2024-02-05", true)],
    guardians: [
      {
        id: "gu-6",
        fullName: "Deepika Bandara",
        relationship: "Mother",
        phone: "+94 77 123 8901",
        email: "deepika.bandara@example.com",
        address: "56, Wackwella Road, Galle",
        isPrimary: true,
        portalEnabled: false,
      },
    ],
    grades: [
      grade("sl-5a", "gl-8", "2024-02-05", "2025-01-13", "admission"),
      grade("sl-5b", "gl-9", "2025-01-13", null),
    ],
    enrollments: [
      enrollment({
        id: "en-5a",
        courseId: "co-g9-ict",
        courseName: "Grade 9 ICT",
        kind: "class",
        branchName: "Galle",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "active",
        accessStatus: "restricted",
        accessStartsOn: "2025-01-13",
        accessEndsOn: null,
        feeSummary: "LKR 3,800 / month",
      }),
    ],
  },
  {
    id: "stu-6",
    studentNo: "STU-2026-0238",
    fullName: "Senuri Wickramasinghe",
    dateOfBirth: "2018-03-22",
    gender: "Female",
    schoolName: "St. Joseph's College, Negombo",
    nic: null,
    contactEmail: null,
    contactPhone: "+94 76 234 9012",
    status: "active",
    createdAt: "2026-11-02",
    qrCardIssued: false,
    portalLinked: false,
    portalEmail: null,
    branches: [branch("br-negombo", "Negombo", "2026-11-02", true)],
    guardians: [
      {
        id: "gu-7",
        fullName: "Ruwan Wickramasinghe",
        relationship: "Father",
        phone: "+94 77 345 0123",
        email: "ruwan.w@example.com",
        address: "9, Cemetery Road, Negombo",
        isPrimary: true,
        portalEnabled: false,
      },
    ],
    grades: [grade("sl-6a", "gl-3", "2026-11-02", null, "admission")],
    enrollments: [
      enrollment({
        id: "en-6a",
        courseId: "co-g3-english",
        courseName: "Primary English — Grade 3",
        kind: "class",
        branchName: "Negombo",
        intakeName: null,
        enrolledOn: "2026-11-02",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-11-02",
        accessEndsOn: null,
        feeSummary: "LKR 3,000 / month",
      }),
    ],
  },
  {
    id: "stu-7",
    studentNo: "STU-2023-0119",
    fullName: "Ishara Gunawardena",
    dateOfBirth: "2009-01-19",
    gender: "Male",
    schoolName: "Ananda College, Colombo",
    nic: null,
    contactEmail: "ishara.g@example.com",
    contactPhone: "+94 70 456 1234",
    status: "active",
    createdAt: "2023-01-09",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "ishara.g@example.com",
    branches: [branch("br-colombo", "Colombo", "2023-01-09", true)],
    guardians: [],
    grades: [
      grade("sl-7a", "gl-11", "2023-01-09", "2024-01-08", "admission"),
      grade("sl-7b", "gl-12", "2024-01-08", "2025-01-13"),
      grade("sl-7c", "gl-13", "2025-01-13", null),
    ],
    enrollments: [
      enrollment({
        id: "en-7a",
        courseId: "co-g13-combined",
        courseName: "A/L Combined Mathematics",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2025-01-13",
        accessEndsOn: null,
        feeSummary: "LKR 7,500 / month",
      }),
      enrollment({
        id: "en-7b",
        courseId: "co-g12-physics",
        courseName: "A/L Physics",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2024-01-08",
        status: "completed",
        endReason: "promoted",
        accessStatus: "active",
        accessStartsOn: "2024-01-08",
        accessEndsOn: "2025-01-13",
        feeSummary: "LKR 7,000 / month",
      }),
    ],
  },
  {
    id: "stu-8",
    studentNo: "STU-2025-0176",
    fullName: "Sachini Rajapaksa",
    dateOfBirth: "2013-07-14",
    gender: "Female",
    schoolName: "Jaffna Hindu College",
    nic: null,
    contactEmail: "sachini.r@example.com",
    contactPhone: "+94 77 567 2345",
    status: "active",
    createdAt: "2025-03-04",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "sachini.r@example.com",
    branches: [branch("br-jaffna", "Jaffna", "2025-03-04", true)],
    guardians: [
      {
        id: "gu-8",
        fullName: "Malini Rajapaksa",
        relationship: "Mother",
        phone: "+94 71 678 3456",
        email: "malini.r@example.com",
        address: "31, Hospital Road, Jaffna",
        isPrimary: true,
        portalEnabled: true,
      },
    ],
    grades: [
      grade("sl-8a", "gl-6", "2025-03-04", "2026-01-12", "admission"),
      grade("sl-8b", "gl-7", "2026-01-12", null),
    ],
    enrollments: [
      enrollment({
        id: "en-8a",
        courseId: "co-g7-maths",
        courseName: "Grade 7 Mathematics — Weekday",
        kind: "class",
        branchName: "Jaffna",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 3,800 / month",
      }),
    ],
  },
  {
    id: "stu-9",
    studentNo: "STU-2022-0045",
    fullName: "Pasindu Herath",
    dateOfBirth: "2007-10-08",
    gender: "Male",
    schoolName: "Dharmaraja College, Kandy",
    nic: "200728102345",
    contactEmail: "pasindu.h@example.com",
    contactPhone: "+94 75 789 4567",
    status: "alumni",
    createdAt: "2022-01-10",
    qrCardIssued: true,
    portalLinked: false,
    portalEmail: null,
    branches: [branch("br-kandy", "Kandy", "2022-01-10", true)],
    guardians: [],
    grades: [
      grade("sl-9a", "gl-12", "2022-01-10", "2023-01-09", "admission"),
      grade("sl-9b", "gl-13", "2023-01-09", "2024-12-31"),
    ],
    enrollments: [
      enrollment({
        id: "en-9a",
        courseId: "co-g13-business",
        courseName: "A/L Business Studies",
        kind: "class",
        branchName: "Kandy",
        intakeName: null,
        enrolledOn: "2023-01-09",
        status: "completed",
        endReason: "course_ended",
        accessStatus: "active",
        accessStartsOn: "2023-01-09",
        accessEndsOn: "2024-12-31",
        feeSummary: "LKR 6,500 / month",
      }),
    ],
  },
  {
    id: "stu-10",
    studentNo: "STU-2026-0241",
    fullName: "Methum Liyanage",
    dateOfBirth: "2019-05-16",
    gender: "Male",
    schoolName: "Galle International School",
    nic: null,
    contactEmail: null,
    contactPhone: "+94 70 890 5678",
    status: "active",
    createdAt: "2026-11-09",
    qrCardIssued: true,
    portalLinked: false,
    portalEmail: null,
    branches: [branch("br-galle", "Galle", "2026-11-09", true)],
    guardians: [
      {
        id: "gu-9",
        fullName: "Nuwan Liyanage",
        relationship: "Father",
        phone: "+94 77 901 6789",
        email: "nuwan.liyanage@example.com",
        address: "77, Lighthouse Street, Galle",
        isPrimary: true,
        portalEnabled: true,
      },
    ],
    grades: [
      grade("sl-10a", "gl-1", "2025-01-13", "2026-01-12", "admission"),
      grade("sl-10b", "gl-2", "2026-01-12", null),
    ],
    enrollments: [
      enrollment({
        id: "en-10a",
        courseId: "co-g2-maths",
        courseName: "Primary Mathematics — Grade 2",
        kind: "class",
        branchName: "Galle",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 2,800 / month",
      }),
    ],
  },
  {
    id: "stu-11",
    studentNo: "STU-2024-0158",
    fullName: "Hasini Weerasinghe",
    dateOfBirth: "2010-11-28",
    gender: "Female",
    schoolName: "Ave Maria Convent, Negombo",
    nic: null,
    contactEmail: "hasini.w@example.com",
    contactPhone: "+94 76 012 7890",
    status: "active",
    createdAt: "2024-01-15",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "hasini.w@example.com",
    branches: [branch("br-negombo", "Negombo", "2024-01-15", true)],
    guardians: [
      {
        id: "gu-10",
        fullName: "Aruni Weerasinghe",
        relationship: "Mother",
        phone: "+94 71 123 4568",
        email: "aruni.w@example.com",
        address: "42, Main Street, Negombo",
        isPrimary: true,
        portalEnabled: true,
      },
    ],
    grades: [
      grade("sl-11a", "gl-8", "2024-01-15", "2025-01-13", "admission"),
      grade("sl-11b", "gl-9", "2025-01-13", "2026-01-12"),
      grade("sl-11c", "gl-10", "2026-01-12", null),
    ],
    enrollments: [
      enrollment({
        id: "en-11a",
        courseId: "co-g10-science",
        courseName: "Grade 10 Science",
        kind: "class",
        branchName: "Negombo",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 4,800 / month",
      }),
      enrollment({
        id: "en-11b",
        courseId: "co-g9-ict",
        courseName: "Grade 9 ICT",
        kind: "class",
        branchName: "Negombo",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "completed",
        endReason: "promoted",
        accessStatus: "active",
        accessStartsOn: "2025-01-13",
        accessEndsOn: "2026-01-12",
        feeSummary: "LKR 3,800 / month",
      }),
    ],
  },
  {
    id: "stu-12",
    studentNo: "STU-2025-0199",
    fullName: "Janith Dissanayake",
    dateOfBirth: "2012-08-03",
    gender: "Male",
    schoolName: "Nalanda College, Colombo",
    nic: null,
    contactEmail: "janith.d@example.com",
    contactPhone: "+94 77 234 5670",
    status: "active",
    createdAt: "2025-01-13",
    qrCardIssued: true,
    portalLinked: false,
    portalEmail: null,
    branches: [branch("br-colombo", "Colombo", "2025-01-13", true)],
    guardians: [
      {
        id: "gu-11",
        fullName: "Saman Dissanayake",
        relationship: "Father",
        phone: "+94 70 345 6781",
        email: "saman.d@example.com",
        address: "128, High Level Road, Maharagama",
        isPrimary: true,
        portalEnabled: false,
      },
    ],
    grades: [
      grade("sl-12a", "gl-7", "2025-01-13", "2026-01-12", "admission"),
      grade("sl-12b", "gl-8", "2026-01-12", null),
    ],
    enrollments: [
      enrollment({
        id: "en-12a",
        courseId: "co-g8-maths",
        courseName: "Grade 8 Mathematics — Saturday",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2026-01-12",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-01-12",
        accessEndsOn: null,
        feeSummary: "LKR 4,500 / month",
      }),
    ],
  },
  {
    id: "stu-13",
    studentNo: "STU-2023-0105",
    fullName: "Ruwanthi de Silva",
    dateOfBirth: "2009-04-25",
    gender: "Female",
    schoolName: "Musaeus College, Colombo",
    nic: null,
    contactEmail: "ruwanthi.desilva@example.com",
    contactPhone: "+94 75 456 7892",
    status: "suspended",
    createdAt: "2023-02-06",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "ruwanthi.d@example.com",
    branches: [branch("br-colombo", "Colombo", "2023-02-06", true)],
    guardians: [],
    grades: [
      grade("sl-13a", "gl-9", "2023-02-06", "2024-01-08", "admission"),
      grade("sl-13b", "gl-10", "2024-01-08", "2025-01-13"),
      grade("sl-13c", "gl-11", "2025-01-13", null),
    ],
    enrollments: [
      enrollment({
        id: "en-13a",
        courseId: "co-g11-business",
        courseName: "O/L Business Studies",
        kind: "class",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2025-01-13",
        status: "active",
        accessStatus: "restricted",
        accessStartsOn: "2025-01-13",
        accessEndsOn: null,
        feeSummary: "LKR 4,200 / month",
      }),
    ],
  },
  {
    id: "stu-14",
    studentNo: "STU-2026-0244",
    fullName: "Adeesha Karunaratne",
    dateOfBirth: "1998-02-14",
    gender: "Male",
    schoolName: null,
    nic: "199804501234",
    contactEmail: "adeesha.k@example.com",
    contactPhone: "+94 71 567 8903",
    status: "active",
    createdAt: "2026-08-18",
    qrCardIssued: true,
    portalLinked: true,
    portalEmail: "adeesha.k@example.com",
    branches: [branch("br-colombo", "Colombo", "2026-08-18", true)],
    guardians: [],
    grades: [],
    enrollments: [
      enrollment({
        id: "en-14a",
        courseId: "co-adult-ict",
        courseName: "Adult ICT Certificate",
        kind: "program",
        branchName: "Colombo",
        intakeName: null,
        enrolledOn: "2026-08-18",
        status: "active",
        accessStatus: "active",
        accessStartsOn: "2026-08-18",
        accessEndsOn: "2027-08-18",
        feeSummary: "LKR 18,000 one-time package",
      }),
    ],
  },
]

export const branchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.name, label: branch.name })),
]

export const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "alumni", label: "Alumni" },
  { value: "suspended", label: "Suspended" },
]

export const gradeFilterOptions = [
  { value: "all", label: "All grades" },
  ...gradeLevels.map((grade) => ({ value: grade.name, label: grade.name })),
  { value: "no-grade", label: "No grade" },
]

export const courseFilterOptions = [
  { value: "all", label: "All courses" },
  ...courseOptions.map((course) => ({
    value: course.id,
    label: course.name,
  })),
]
