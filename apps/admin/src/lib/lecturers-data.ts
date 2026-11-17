/**
 * Local mock fixtures for the Lecturers UI demo.
 *
 * Mirrors the `lecturer`, `lecturer_branch`, `user` and `course_lecturer` concepts.
 * Portal access is shown as account access only; the lecturer profile is always kept.
 * Nothing here is persisted.
 */

import {
  branches,
  courseOptions,
  formatDateTime,
} from "@/lib/students-data"

export type LecturerBranchLink = {
  branchId: string
  branchName: string
}

export type LecturerCourseAssignment = {
  courseId: string
  isPrimary: boolean
  /** Share of the course revenue. Shares for one course sum to 100. */
  sharePercent: number
}

export type LecturerRecord = {
  id: string
  userId: string | null
  fullName: string
  qualification: string
  bio: string
  portalEnabled: boolean
  createdAt: string
  accountEmail: string | null
  accountUsername: string | null
  lastLoginAt: string | null
  branches: LecturerBranchLink[]
  assignments: LecturerCourseAssignment[]
}

function branchLink(branchId: string): LecturerBranchLink {
  const branch = branches.find((item) => item.id === branchId)!

  return { branchId: branch.id, branchName: branch.name }
}

function assignment(
  courseId: string,
  sharePercent: number,
  isPrimary = false
): LecturerCourseAssignment {
  return { courseId, sharePercent, isPrimary }
}

export const lecturers: LecturerRecord[] = [
  {
    id: "lec-1",
    userId: "usr-1",
    fullName: "Anushka Wijesuriya",
    qualification: "M.Sc. in Mathematics",
    bio: "Teaches Grade 8–13 mathematics with a focus on O/L and A/L exam technique. Coordinates the mathematics course group at the Colombo branch.",
    portalEnabled: true,
    createdAt: "2022-01-10",
    accountEmail: "anushka.w@example.com",
    accountUsername: "anushka.w",
    lastLoginAt: "2026-11-12T18:40:00+05:30",
    branches: [branchLink("br-colombo"), branchLink("br-kandy")],
    assignments: [
      assignment("co-g8-maths", 100, true),
      assignment("co-g11-maths", 70, true),
      assignment("co-g13-combined", 100, true),
      assignment("co-g9-maths", 60, true),
    ],
  },
  {
    id: "lec-2",
    userId: "usr-2",
    fullName: "Nadeesha Ranasinghe",
    qualification: "B.Sc. (Hons) in Physics",
    bio: "Physics lecturer for junior secondary and O/L classes. Co-teaches Grade 11 mathematics and supports practical science sessions.",
    portalEnabled: true,
    createdAt: "2022-01-10",
    accountEmail: "nadeesha.r@example.com",
    accountUsername: "nadeesha.r",
    lastLoginAt: "2026-11-13T07:15:00+05:30",
    branches: [branchLink("br-colombo"), branchLink("br-galle")],
    assignments: [
      assignment("co-g8-science", 60, true),
      assignment("co-g11-maths", 30),
      assignment("co-g11-science", 60, true),
      assignment("co-g10-science", 50, true),
    ],
  },
  {
    id: "lec-3",
    userId: "usr-3",
    fullName: "Kavindu Senanayake",
    qualification: "B.Sc. in Information Technology",
    bio: "ICT lecturer for Grade 9 and the adult ICT certificate. Manages the computer lab schedule at the Negombo branch.",
    portalEnabled: true,
    createdAt: "2023-02-06",
    accountEmail: "kavindu.s@example.com",
    accountUsername: "kavindu.s",
    lastLoginAt: "2026-11-12T09:20:00+05:30",
    branches: [branchLink("br-colombo"), branchLink("br-negombo")],
    assignments: [
      assignment("co-g8-science", 40),
      assignment("co-g9-ict", 100, true),
      assignment("co-adult-ict", 100, true),
    ],
  },
  {
    id: "lec-4",
    userId: "usr-4",
    fullName: "Fathima Rizwan",
    qualification: "B.Ed. in Primary Education",
    bio: "Primary and junior mathematics teacher. Leads early-grade numeracy support and the weekend Grade 6 class in Kandy.",
    portalEnabled: true,
    createdAt: "2021-05-18",
    accountEmail: "fathima.r@example.com",
    accountUsername: "fathima.r",
    lastLoginAt: "2026-11-11T16:05:00+05:30",
    branches: [branchLink("br-kandy"), branchLink("br-colombo")],
    assignments: [
      assignment("co-g7-maths", 100, true),
      assignment("co-g6-maths", 100, true),
      assignment("co-g9-maths", 40),
      assignment("co-g2-maths", 100, true),
    ],
  },
  {
    id: "lec-5",
    userId: "usr-5",
    fullName: "Dinesh Kumarasinghe",
    qualification: "M.Sc. in Physics",
    bio: "A/L physics lecturer with laboratory supervision duties. Works across the Galle and Colombo branches.",
    portalEnabled: true,
    createdAt: "2023-08-14",
    accountEmail: "dinesh.k@example.com",
    accountUsername: "dinesh.k",
    lastLoginAt: "2026-11-10T08:30:00+05:30",
    branches: [branchLink("br-galle"), branchLink("br-colombo")],
    assignments: [
      assignment("co-g11-science", 40),
      assignment("co-g12-physics", 100, true),
      assignment("co-g10-science", 50),
    ],
  },
  {
    id: "lec-6",
    userId: "usr-6",
    fullName: "Shalini Mendis",
    qualification: "B.A. (Hons) in English",
    bio: "English language lecturer for O/L and primary classes. Coordinates the primary reading programme in Negombo.",
    portalEnabled: true,
    createdAt: "2022-06-01",
    accountEmail: "shalini.m@example.com",
    accountUsername: "shalini.m",
    lastLoginAt: "2026-11-12T20:10:00+05:30",
    branches: [branchLink("br-negombo"), branchLink("br-colombo")],
    assignments: [
      assignment("co-g11-english", 100, true),
      assignment("co-g3-english", 60, true),
    ],
  },
  {
    id: "lec-7",
    userId: "usr-7",
    fullName: "Ruwan Pathirana",
    qualification: "MBA, B.Com",
    bio: "Business studies lecturer for O/L and A/L groups. Also supports career guidance sessions for senior students.",
    portalEnabled: true,
    createdAt: "2024-01-15",
    accountEmail: "ruwan.p@example.com",
    accountUsername: "ruwan.p",
    lastLoginAt: "2026-11-09T18:45:00+05:30",
    branches: [branchLink("br-colombo")],
    assignments: [
      assignment("co-g13-business", 70, true),
      assignment("co-g11-business", 100, true),
    ],
  },
  {
    id: "lec-8",
    userId: null,
    fullName: "Hasitha Ekanayake",
    qualification: "B.A. in English and Linguistics",
    bio: "Newly joined lecturer based in Negombo. Branch onboarding and course allocation are still in progress.",
    portalEnabled: false,
    createdAt: "2026-10-20",
    accountEmail: null,
    accountUsername: null,
    lastLoginAt: null,
    branches: [branchLink("br-negombo")],
    assignments: [],
  },
  {
    id: "lec-9",
    userId: "usr-9",
    fullName: "Priyanka Jayawardena",
    qualification: "Diploma in Early Childhood Education",
    bio: "Primary English teacher at the Negombo branch, with weekend sessions for the Jaffna primary group.",
    portalEnabled: true,
    createdAt: "2024-06-03",
    accountEmail: "priyanka.j@example.com",
    accountUsername: "priyanka.j",
    lastLoginAt: "2026-11-13T08:00:00+05:30",
    branches: [branchLink("br-negombo"), branchLink("br-jaffna")],
    assignments: [assignment("co-g3-english", 40)],
  },
  {
    id: "lec-10",
    userId: null,
    fullName: "Malinda Abeysekera",
    qualification: "Ph.D. in Management",
    bio: "Visiting lecturer for the A/L business studies group. Keeps an external academic profile and does not use the lecturer portal.",
    portalEnabled: false,
    createdAt: "2023-09-11",
    accountEmail: null,
    accountUsername: null,
    lastLoginAt: null,
    branches: [branchLink("br-colombo")],
    assignments: [assignment("co-g13-business", 30)],
  },
]

export type AssignedCourse = LecturerCourseAssignment & {
  courseName: string
  coTeachers: {
    lecturerId: string
    fullName: string
    sharePercent: number
    isPrimary: boolean
  }[]
}

export function getAssignedCourses(lecturer: LecturerRecord): AssignedCourse[] {
  return lecturer.assignments.map((item) => {
    const course = courseOptions.find((entry) => entry.id === item.courseId)
    const coTeachers = lecturers
      .filter((other) => other.id !== lecturer.id)
      .flatMap((other) =>
        other.assignments
          .filter((entry) => entry.courseId === item.courseId)
          .map((entry) => ({
            lecturerId: other.id,
            fullName: other.fullName,
            sharePercent: entry.sharePercent,
            isPrimary: entry.isPrimary,
          }))
      )

    return {
      ...item,
      courseName: course?.name ?? "Unassigned course",
      coTeachers,
    }
  })
}

export function getPrimaryBranch(lecturer: LecturerRecord) {
  return lecturer.branches[0]
}

export function getLastLoginLabel(lecturer: LecturerRecord) {
  if (!lecturer.portalEnabled) return "Portal access is off"
  if (!lecturer.lastLoginAt) return "No login recorded"

  return formatDateTime(lecturer.lastLoginAt)
}

export const lecturerBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.name, label: branch.name })),
]

export const lecturerPortalFilterOptions = [
  { value: "all", label: "All portal states" },
  { value: "enabled", label: "Portal enabled" },
  { value: "disabled", label: "Portal disabled" },
]
