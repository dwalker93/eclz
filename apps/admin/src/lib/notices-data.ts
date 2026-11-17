/**
 * Local mock fixtures for the Notices UI demo.
 *
 * Mirrors `notice` and `notice_target`. Notice state (draft, scheduled,
 * published, expired) is derived for display from the publish and expiry
 * timestamps. Nothing here is persisted and no notice is sent to anyone.
 */

import { courses } from "@/lib/courses-data"
import { guardians } from "@/lib/guardians-data"
import { lecturers } from "@/lib/lecturers-data"
import {
  branches,
  formatDateTime,
  getGradeAsOf,
  gradeLevels,
  MOCK_TODAY,
  students,
} from "@/lib/students-data"

export type NoticeTargetType = "all" | "role" | "course" | "grade" | "student"
export type NoticeState = "draft" | "scheduled" | "published" | "expired"

export type NoticeAuthor = {
  id: string
  fullName: string
  role: string
}

export type NoticeRole = {
  id: string
  name: string
}

export type NoticeTarget = {
  id: string
  targetType: NoticeTargetType
  targetId: string | null
}

export type NoticeRecord = {
  id: string
  title: string
  body: string
  authorId: string
  branchId: string | null
  /** null = local draft. */
  publishedAt: string | null
  expiresAt: string | null
  createdAt: string
  targets: NoticeTarget[]
}

export const noticeAuthors: NoticeAuthor[] = [
  {
    id: "usr-admin-1",
    fullName: "Dilani Jayawardena",
    role: "Administrator",
  },
  {
    id: "usr-admin-2",
    fullName: "Ruwan Weerasinghe",
    role: "Branch manager",
  },
  {
    id: "usr-admin-3",
    fullName: "Priya Selvarajah",
    role: "Academic coordinator",
  },
  {
    id: "usr-admin-4",
    fullName: "Mohamed Nazeer",
    role: "Finance officer",
  },
]

export const noticeRoles: NoticeRole[] = [
  { id: "role-student", name: "Student" },
  { id: "role-guardian", name: "Guardian" },
  { id: "role-lecturer", name: "Lecturer" },
  { id: "role-staff", name: "Staff" },
]

export const noticeStateLabels: Record<NoticeState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  expired: "Expired",
}

const rolePluralLabels: Record<string, string> = {
  "role-student": "Students",
  "role-guardian": "Guardians",
  "role-lecturer": "Lecturers",
  "role-staff": "Staff",
}

export const noticeStateDescriptions: Record<NoticeState, string> = {
  draft: "Not published yet",
  scheduled: "Publishes in the future",
  published: "Visible to its audience",
  expired: "Past its expiry date",
}

function allTarget(id: string): NoticeTarget {
  return { id, targetType: "all", targetId: null }
}

function roleTarget(id: string, roleId: string): NoticeTarget {
  return { id, targetType: "role", targetId: roleId }
}

function courseTarget(id: string, courseId: string): NoticeTarget {
  return { id, targetType: "course", targetId: courseId }
}

function gradeTarget(id: string, gradeId: string): NoticeTarget {
  return { id, targetType: "grade", targetId: gradeId }
}

function studentTarget(id: string, studentId: string): NoticeTarget {
  return { id, targetType: "student", targetId: studentId }
}

export const notices: NoticeRecord[] = [
  {
    id: "ntc-2026-12-fees",
    title: "December 2026 term fees due",
    body: "December term fees are due by 15 December 2026.\n\nPlease settle payments at the branch office or through the online transfer option. Students with an outstanding balance after the grace period will have portal access restricted until the payment is verified.\n\nIf you have already paid, no action is needed — receipts are visible in the guardian portal.",
    authorId: "usr-admin-1",
    branchId: null,
    publishedAt: "2026-11-10T09:00:00+05:30",
    expiresAt: "2026-12-15T23:59:00+05:30",
    createdAt: "2026-11-09T16:20:00+05:30",
    targets: [allTarget("nt-1")],
  },
  {
    id: "ntc-2026-ol-revision",
    title: "Colombo O/L revision workshops",
    body: "Extra O/L revision workshops start on Saturday 21 November at the Colombo branch.\n\nMathematics and Science sessions run from 2:00 pm to 4:30 pm. Seats are limited to current Grade 11 students, and attendance is recorded as a normal class session.\n\nSpeak to the front desk if you need to switch a weekday class to attend.",
    authorId: "usr-admin-3",
    branchId: "br-colombo",
    publishedAt: "2026-11-12T14:30:00+05:30",
    expiresAt: "2026-12-05T23:59:00+05:30",
    createdAt: "2026-11-12T10:10:00+05:30",
    targets: [
      gradeTarget("nt-2a", "gl-11"),
      courseTarget("nt-2b", "co-g11-maths"),
    ],
  },
  {
    id: "ntc-kandy-timetable",
    title: "Kandy branch timetable change",
    body: "From 16 November, the Grade 6 and Grade 7 mathematics classes move to the main hall while the annex is being repainted.\n\nStart and end times are unchanged. Please arrive through the side entrance and keep bags outside the hall.\n\nThe change is expected to last two weeks.",
    authorId: "usr-admin-2",
    branchId: "br-kandy",
    publishedAt: "2026-11-08T08:00:00+05:30",
    expiresAt: null,
    createdAt: "2026-11-07T17:45:00+05:30",
    targets: [
      courseTarget("nt-3a", "co-g6-maths"),
      courseTarget("nt-3b", "co-g7-maths"),
    ],
  },
  {
    id: "ntc-al-maths-practical",
    title: "A/L Combined Mathematics practical rescheduled",
    body: "The A/L Combined Mathematics practical planned for Monday 16 November has moved to Thursday 19 November at 8:00 am in the Colombo laboratory.\n\nBring your lab notebook and calculator. Students who cannot attend should contact the academic office before Wednesday.",
    authorId: "usr-admin-3",
    branchId: "br-colombo",
    publishedAt: "2026-11-16T08:00:00+05:30",
    expiresAt: "2026-11-20T18:00:00+05:30",
    createdAt: "2026-11-13T15:30:00+05:30",
    targets: [
      gradeTarget("nt-4a", "gl-13"),
      courseTarget("nt-4b", "co-g13-combined"),
    ],
  },
  {
    id: "ntc-2027-intake",
    title: "January 2027 intake now open",
    body: "Applications for the February 2027 Digital Marketing Foundations intake are open until 20 January 2027.\n\nThe programme runs part-time over four months with online sessions and two on-campus workshops. Existing students can apply through the student portal.",
    authorId: "usr-admin-1",
    branchId: null,
    publishedAt: "2026-11-05T10:00:00+05:30",
    expiresAt: "2027-01-31T23:59:00+05:30",
    createdAt: "2026-11-04T11:05:00+05:30",
    targets: [
      roleTarget("nt-5a", "role-student"),
      courseTarget("nt-5b", "co-digital-marketing"),
    ],
  },
  {
    id: "ntc-galle-lab-maintenance",
    title: "Galle ICT lab maintenance",
    body: "The Galle ICT lab will be closed for maintenance on 8–10 November 2026. Grade 9 ICT sessions are moved to the study room and will run as theory classes.\n\nNormal lab access resumes on 11 November.",
    authorId: "usr-admin-2",
    branchId: "br-galle",
    publishedAt: "2026-10-20T07:30:00+05:30",
    expiresAt: "2026-11-10T18:00:00+05:30",
    createdAt: "2026-10-19T16:40:00+05:30",
    targets: [courseTarget("nt-6a", "co-g9-ict")],
  },
  {
    id: "ntc-guardian-portal",
    title: "Guardian portal walkthrough",
    body: "A short walkthrough for guardians on using the portal to view attendance, fee summaries and receipts.\n\nSessions run at 5:00 pm on the first Saturday of each month at the Colombo branch. Bring the phone number linked to your guardian account.",
    authorId: "usr-admin-1",
    branchId: null,
    publishedAt: null,
    expiresAt: null,
    createdAt: "2026-11-13T09:10:00+05:30",
    targets: [roleTarget("nt-7a", "role-guardian")],
  },
  {
    id: "ntc-sports-day",
    title: "Sports day — parents welcome",
    body: "The annual sports day will be held on 5 December 2026 at the Colombo grounds. Parents and guardians are welcome from 8:00 am.\n\nStudents should arrive by 7:15 am in their house colours. A detailed schedule will follow.",
    authorId: "usr-admin-2",
    branchId: "br-colombo",
    publishedAt: null,
    expiresAt: null,
    createdAt: "2026-11-12T13:25:00+05:30",
    targets: [roleTarget("nt-8a", "role-guardian")],
  },
  {
    id: "ntc-scholarships",
    title: "Scholarship applications close soon",
    body: "Scholarship applications for the 2027 academic year close on 12 November 2026 at 5:00 pm.\n\nApplications received after the deadline will be considered in the next cycle. Contact the office if you need help with the form.",
    authorId: "usr-admin-4",
    branchId: null,
    publishedAt: "2026-11-01T09:00:00+05:30",
    expiresAt: "2026-11-12T17:00:00+05:30",
    createdAt: "2026-10-30T14:00:00+05:30",
    targets: [allTarget("nt-9a")],
  },
  {
    id: "ntc-lecturer-meeting",
    title: "Lecturer monthly meeting",
    body: "The November lecturer meeting is on Friday 20 November at 4:00 pm in the Colombo staff room. Online attendance is available for Kandy, Galle, Negombo and Jaffna teachers.\n\nAgenda: term wrap-up, January timetables and exam marking rosters.",
    authorId: "usr-admin-1",
    branchId: null,
    publishedAt: "2026-11-20T09:00:00+05:30",
    expiresAt: null,
    createdAt: "2026-11-14T10:30:00+05:30",
    targets: [roleTarget("nt-10a", "role-lecturer")],
  },
  {
    id: "ntc-grade8-lab-safety",
    title: "Grade 8 science lab safety",
    body: "Grade 8 science students must bring closed shoes for the practical on Saturday. Lab coats are provided at the branch.\n\nStudents without closed shoes will observe the session from the classroom.",
    authorId: "usr-admin-3",
    branchId: "br-colombo",
    publishedAt: "2026-11-09T11:15:00+05:30",
    expiresAt: null,
    createdAt: "2026-11-08T16:00:00+05:30",
    targets: [
      courseTarget("nt-11a", "co-g8-science"),
      studentTarget("nt-11b", "stu-1"),
    ],
  },
  {
    id: "ntc-online-transfer",
    title: "New online transfer payment option",
    body: "Guardians and students can now pay fees by online transfer and upload the receipt from the portal.\n\nPayments stay pending until the finance team verifies them. Keep the bank reference number handy when uploading proof.",
    authorId: "usr-admin-4",
    branchId: null,
    publishedAt: "2026-11-11T12:00:00+05:30",
    expiresAt: null,
    createdAt: "2026-11-10T15:20:00+05:30",
    targets: [
      roleTarget("nt-12a", "role-guardian"),
      roleTarget("nt-12b", "role-student"),
    ],
  },
]

export function getNoticeAuthor(notice: NoticeRecord) {
  return (
    noticeAuthors.find((author) => author.id === notice.authorId) ?? {
      id: notice.authorId,
      fullName: "Unknown author",
      role: "Staff",
    }
  )
}

export function getNoticeState(notice: NoticeRecord): NoticeState {
  if (!notice.publishedAt) return "draft"

  const publishDate = notice.publishedAt.slice(0, 10)
  if (publishDate > MOCK_TODAY) return "scheduled"

  if (notice.expiresAt) {
    const expiryDate = notice.expiresAt.slice(0, 10)
    if (expiryDate <= MOCK_TODAY) return "expired"
  }

  return "published"
}

export function getNoticeBranchLabel(notice: NoticeRecord) {
  if (!notice.branchId) return "All branches"

  return (
    branches.find((branch) => branch.id === notice.branchId)?.name ??
    "Unknown branch"
  )
}

export const noticeTargetTypeLabels: Record<NoticeTargetType, string> = {
  all: "Everyone",
  role: "Role",
  course: "Course",
  grade: "Grade",
  student: "Student",
}

export function getNoticeTargetLabel(target: NoticeTarget) {
  if (target.targetType === "all") return "Everyone"

  if (target.targetType === "role") {
    return rolePluralLabels[target.targetId ?? ""] ?? "Unknown role"
  }

  if (target.targetType === "course") {
    return (
      courses.find((course) => course.id === target.targetId)?.name ??
      "Unknown course"
    )
  }

  if (target.targetType === "grade") {
    return (
      gradeLevels.find((grade) => grade.id === target.targetId)?.name ??
      "Unknown grade"
    )
  }

  const student = students.find((item) => item.id === target.targetId)

  return student
    ? `${student.fullName} (${student.studentNo})`
    : "Unknown student"
}

export function getNoticeTargetValueLabel(target: NoticeTarget) {
  if (target.targetType === "all") {
    return "All active students and guardians"
  }

  return getNoticeTargetLabel(target)
}

export function getNoticeAudienceLabels(notice: NoticeRecord) {
  return notice.targets.map(getNoticeTargetLabel)
}

export function getNoticeAudienceSummary(notice: NoticeRecord) {
  const labels = getNoticeAudienceLabels(notice)

  if (labels.length === 0) return "No targets"
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return labels.join(" · ")

  return `${labels[0]} · ${labels[1]} +${labels.length - 2} more`
}

export function countNoticeTargetRecipients(target: NoticeTarget) {
  if (target.targetType === "all") {
    return (
      students.filter((student) => student.status === "active").length +
      guardians.length
    )
  }

  if (target.targetType === "role") {
    if (target.targetId === "role-student") {
      return students.filter((student) => student.status === "active").length
    }
    if (target.targetId === "role-guardian") return guardians.length
    if (target.targetId === "role-lecturer") return lecturers.length
    if (target.targetId === "role-staff") return noticeAuthors.length

    return 0
  }

  if (target.targetType === "course") {
    return new Set(
      students
        .filter((student) =>
          student.enrollments.some(
            (enrollment) =>
              enrollment.courseId === target.targetId &&
              enrollment.status === "active"
          )
        )
        .map((student) => student.id)
    ).size
  }

  if (target.targetType === "grade") {
    return students.filter(
      (student) => getGradeAsOf(student)?.gradeLevelId === target.targetId
    ).length
  }

  return target.targetId ? 1 : 0
}

/**
 * Approximate audience size for the demo. Targets are summed without
 * de-duplicating people who match more than one target.
 */
export function estimateNoticeRecipients(notice: NoticeRecord) {
  return notice.targets.reduce(
    (total, target) => total + countNoticeTargetRecipients(target),
    0
  )
}

export function describeRecipientCount(count: number) {
  return `≈ ${count} ${count === 1 ? "recipient" : "recipients"}`
}

export function formatNoticeTimestamp(value: string | null | undefined) {
  return formatDateTime(value)
}

export const noticeStateFilterOptions = [
  { value: "all", label: "All states" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "expired", label: "Expired" },
]

export const noticeBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const noticeAudienceFilterOptions = [
  { value: "any", label: "All audiences" },
  { value: "all", label: "Everyone" },
  { value: "role", label: "Roles" },
  { value: "course", label: "Courses" },
  { value: "grade", label: "Grades" },
  { value: "student", label: "Students" },
]

export const noticeTargetTypeOptions = [
  { value: "all", label: "Everyone" },
  { value: "role", label: "Role" },
  { value: "course", label: "Course" },
  { value: "grade", label: "Grade" },
  { value: "student", label: "Student" },
]

export const noticeBranchFormOptions = branches.map((branch) => ({
  value: branch.id,
  label: branch.name,
}))

export const noticeRoleOptions = noticeRoles.map((role) => ({
  value: role.id,
  label: role.name,
}))

export const noticeCourseOptions = courses.map((course) => ({
  value: course.id,
  label: course.name,
}))

export const noticeGradeOptions = gradeLevels.map((grade) => ({
  value: grade.id,
  label: grade.name,
}))

export const noticeStudentOptions = students.map((student) => ({
  value: student.id,
  label: `${student.fullName} · ${student.studentNo}`,
}))

export const noticeAuthorOptions = noticeAuthors.map((author) => ({
  value: author.id,
  label: `${author.fullName} · ${author.role}`,
}))
