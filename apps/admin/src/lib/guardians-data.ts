/**
 * Local mock fixtures for the Guardians UI demo.
 *
 * Mirrors the `guardian`, `student_guardian`, `student` and optional `user`
 * concepts. A guardian can exist without a linked student or a portal login.
 * Nothing here is persisted.
 */

import {
  getGradeAsOf,
  getPrimaryBranch,
  students,
  type StudentStatus,
} from "@/lib/students-data"

export type GuardianStudentLink = {
  studentId: string
  relationship: string
  isPrimary: boolean
}

export type GuardianRecord = {
  id: string
  userId: string | null
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  nic: string | null
  /** Parent portal needs the parent_portal module as well as a linked user. */
  portalEnabled: boolean
  createdAt: string
  accountEmail: string | null
  lastLoginAt: string | null
  links: GuardianStudentLink[]
}

function link(
  studentId: string,
  relationship: string,
  isPrimary = false
): GuardianStudentLink {
  return { studentId, relationship, isPrimary }
}

const guardiansSeed: GuardianRecord[] = [
  {
    id: "gu-1",
    userId: "usr-gu-1",
    fullName: "Nimal Perera",
    phone: "+94 71 234 5678",
    email: "nimal.perera@example.com",
    address: "24/3, Temple Road, Nugegoda",
    nic: "721234567V",
    portalEnabled: true,
    createdAt: "2024-01-15",
    accountEmail: "nimal.perera@example.com",
    lastLoginAt: "2026-11-12T20:15:00+05:30",
    links: [link("stu-1", "Father", true)],
  },
  {
    id: "gu-2",
    userId: null,
    fullName: "Sandya Perera",
    phone: "+94 76 345 6789",
    email: "sandya.perera@example.com",
    address: "24/3, Temple Road, Nugegoda",
    nic: "748765432V",
    portalEnabled: false,
    createdAt: "2024-01-15",
    accountEmail: null,
    lastLoginAt: null,
    links: [link("stu-1", "Mother")],
  },
  {
    id: "gu-3",
    userId: "usr-gu-3",
    fullName: "Sunethra Fernando",
    phone: "+94 71 567 8901",
    email: "sunethra.fernando@example.com",
    address: "18, Lake Drive, Colombo 05",
    nic: "695678901V",
    portalEnabled: true,
    createdAt: "2023-01-09",
    accountEmail: "sunethra.fernando@example.com",
    lastLoginAt: "2026-11-13T07:40:00+05:30",
    links: [link("stu-2", "Mother", true)],
  },
  {
    id: "gu-4",
    userId: "usr-gu-4",
    fullName: "Chaminda Jayasinghe",
    phone: "+94 77 789 0123",
    email: "chaminda.j@example.com",
    address: "112, Peradeniya Road, Kandy",
    nic: "701122334V",
    portalEnabled: true,
    createdAt: "2025-01-13",
    accountEmail: "chaminda.j@example.com",
    lastLoginAt: "2026-11-11T18:05:00+05:30",
    links: [link("stu-3", "Father", true)],
  },
  {
    id: "gu-5",
    userId: null,
    fullName: "Iresha Jayasinghe",
    phone: "+94 76 890 1234",
    email: null,
    address: "112, Peradeniya Road, Kandy",
    nic: "758899001V",
    portalEnabled: false,
    createdAt: "2025-01-13",
    accountEmail: null,
    lastLoginAt: null,
    links: [link("stu-3", "Mother")],
  },
  {
    id: "gu-6",
    userId: null,
    fullName: "Deepika Bandara",
    phone: "+94 77 123 8901",
    email: "deepika.bandara@example.com",
    address: "56, Wackwella Road, Galle",
    nic: "735566778V",
    portalEnabled: false,
    createdAt: "2024-02-05",
    accountEmail: null,
    lastLoginAt: null,
    links: [link("stu-5", "Mother", true)],
  },
  {
    id: "gu-7",
    userId: null,
    fullName: "Ruwan Wickramasinghe",
    phone: "+94 77 345 0123",
    email: "ruwan.w@example.com",
    address: "9, Cemetery Road, Negombo",
    nic: "681199887V",
    portalEnabled: false,
    createdAt: "2026-11-02",
    accountEmail: null,
    lastLoginAt: null,
    links: [link("stu-6", "Father", true)],
  },
  {
    id: "gu-8",
    userId: "usr-gu-8",
    fullName: "Malini Rajapaksa",
    phone: "+94 71 678 3456",
    email: "malini.r@example.com",
    address: "31, Hospital Road, Jaffna",
    nic: "719900112V",
    portalEnabled: true,
    createdAt: "2025-03-04",
    accountEmail: "malini.r@example.com",
    lastLoginAt: "2026-11-10T09:25:00+05:30",
    links: [link("stu-8", "Mother", true)],
  },
  {
    id: "gu-9",
    userId: "usr-gu-9",
    fullName: "Nuwan Liyanage",
    phone: "+94 77 901 6789",
    email: "nuwan.liyanage@example.com",
    address: "77, Lighthouse Street, Galle",
    nic: "702233445V",
    portalEnabled: true,
    createdAt: "2026-11-09",
    accountEmail: "nuwan.liyanage@example.com",
    lastLoginAt: "2026-11-13T06:50:00+05:30",
    links: [link("stu-10", "Father", true)],
  },
  {
    id: "gu-10",
    userId: "usr-gu-10",
    fullName: "Aruni Weerasinghe",
    phone: "+94 71 123 4568",
    email: "aruni.w@example.com",
    address: "42, Main Street, Negombo",
    nic: "745566778V",
    portalEnabled: true,
    createdAt: "2024-01-15",
    accountEmail: "aruni.w@example.com",
    lastLoginAt: "2026-11-12T17:35:00+05:30",
    links: [link("stu-11", "Mother", true)],
  },
  {
    id: "gu-11",
    userId: null,
    fullName: "Saman Dissanayake",
    phone: "+94 70 345 6781",
    email: "saman.d@example.com",
    address: "128, High Level Road, Maharagama",
    nic: "691122334V",
    portalEnabled: false,
    createdAt: "2025-01-13",
    accountEmail: null,
    lastLoginAt: null,
    links: [link("stu-12", "Father", true)],
  },
  {
    id: "gu-12",
    userId: "usr-gu-12",
    fullName: "Sarath Silva",
    phone: "+94 71 890 1234",
    email: "sarath.silva@example.com",
    address: "15, Flower Road, Colombo 07",
    nic: "701234567V",
    portalEnabled: true,
    createdAt: "2022-01-10",
    accountEmail: "sarath.silva@example.com",
    lastLoginAt: "2026-11-09T21:10:00+05:30",
    links: [
      link("stu-4", "Father", true),
      link("stu-13", "Father", true),
    ],
  },
  {
    id: "gu-13",
    userId: null,
    fullName: "Kumari Senanayake",
    phone: "+94 76 456 7890",
    email: "kumari.s@example.com",
    address: "5, Station Road, Kurunegala",
    nic: "725678901V",
    portalEnabled: false,
    createdAt: "2026-09-14",
    accountEmail: null,
    lastLoginAt: null,
    links: [],
  },
  {
    id: "gu-14",
    userId: null,
    fullName: "Ahamed Rizwan",
    phone: "+94 77 567 8901",
    email: null,
    address: "62, Mosque Lane, Kandy",
    nic: null,
    portalEnabled: false,
    createdAt: "2026-11-02",
    accountEmail: null,
    lastLoginAt: null,
    links: [],
  },
]

export const guardians: GuardianRecord[] = guardiansSeed

export type LinkedStudent = {
  studentId: string
  studentNo: string
  fullName: string
  relationship: string
  isPrimary: boolean
  gradeName: string | null
  branchName: string | null
  status: StudentStatus
}

export function getLinkedStudents(guardian: GuardianRecord): LinkedStudent[] {
  return guardian.links.flatMap((guardianLink) => {
    const student = students.find((item) => item.id === guardianLink.studentId)
    if (!student) return []

    const grade = getGradeAsOf(student)

    return [
      {
        studentId: student.id,
        studentNo: student.studentNo,
        fullName: student.fullName,
        relationship: guardianLink.relationship,
        isPrimary: guardianLink.isPrimary,
        gradeName: grade?.gradeName ?? null,
        branchName: getPrimaryBranch(student)?.branchName ?? null,
        status: student.status,
      },
    ]
  })
}

export function getPrimaryLink(guardian: GuardianRecord) {
  return guardian.links.find((item) => item.isPrimary) ?? guardian.links[0]
}

export function getRelationshipSummary(guardian: GuardianRecord) {
  const relationships = [
    ...new Set(guardian.links.map((item) => item.relationship)),
  ]

  return {
    relationships,
    label:
      relationships.length > 0 ? relationships.join(", ") : "No relationship",
    primaryCount: guardian.links.filter((item) => item.isPrimary).length,
  }
}

export const guardianPortalFilterOptions = [
  { value: "all", label: "All portal states" },
  { value: "enabled", label: "Portal enabled" },
  { value: "disabled", label: "Portal off" },
]

export const guardianLinkFilterOptions = [
  { value: "all", label: "All guardians" },
  { value: "linked", label: "Linked to a student" },
  { value: "unlinked", label: "Not linked" },
]

export const guardianRelationshipOptions = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Other",
]

export type GuardianStudentOption = {
  studentId: string
  studentNo: string
  fullName: string
  gradeName: string | null
  branchName: string | null
}

export const guardianStudentOptions: GuardianStudentOption[] = students.map(
  (student) => ({
    studentId: student.id,
    studentNo: student.studentNo,
    fullName: student.fullName,
    gradeName: getGradeAsOf(student)?.gradeName ?? null,
    branchName: getPrimaryBranch(student)?.branchName ?? null,
  })
)
