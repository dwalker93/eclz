/**
 * Local mock fixtures for the Attendance UI demo.
 *
 * Mirrors `class_session` and `attendance` using the shared Courses and
 * Students fixtures. Attendance is session-first: each dated session has a
 * roster of enrolled students with a status (present, absent, late, excused),
 * attended-via, marked-via (manual or QR), and marked-at/by details. QR marks
 * are sample data only — there is no scanner. Nothing here is persisted.
 */

import {
  getCourseEnrollments,
  type CourseRecord,
  type DeliveryMode,
} from "@/lib/courses-data"
import { getGradeAsOf, MOCK_TODAY, students } from "@/lib/students-data"
import { timetableSessions } from "@/lib/timetable-data"

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "excused",
] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]
export type AttendedVia = "physical" | "online"
export type MarkedVia = "manual" | "qr"

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
}

export const attendanceStatusOptions: {
  value: AttendanceStatus
  label: string
}[] = ATTENDANCE_STATUSES.map((status) => ({
  value: status,
  label: ATTENDANCE_STATUS_LABELS[status],
}))

export const attendanceAttendedViaOptions: {
  value: AttendedVia
  label: string
}[] = [
  { value: "physical", label: "Physical" },
  { value: "online", label: "Online" },
]

/** Status filter adds an “unmarked” bucket on top of the four statuses. */
export const attendanceStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...attendanceStatusOptions,
  { value: "unmarked", label: "Not marked" },
]

export const markedViaLabels: Record<MarkedVia, string> = {
  manual: "Manual",
  qr: "QR",
}

export const attendedViaLabels: Record<AttendedVia, string> = {
  physical: "Physical",
  online: "Online",
}

export type AttendanceRosterEntry = {
  studentId: string
  studentNo: string
  studentName: string
  gradeName: string | null
  branchName: string
  enrollmentId: string
  enrolledOn: string
  /** null on a scheduled session that has not been marked yet. */
  status: AttendanceStatus | null
  attendedVia: AttendedVia | null
  markedVia: MarkedVia | null
  markedAt: string | null
  markedBy: string | null
}

export type AttendanceSessionRecord = {
  id: string
  course: CourseRecord
  sessionDate: string
  startsAt: string
  endsAt: string
  topic: string
  deliveryMode: DeliveryMode
  status: "scheduled" | "held"
  meetingProvider: "zoom" | "teams" | null
  branchId: string
  branchName: string
  gradeNames: string[]
  lecturerNames: string[]
  roster: AttendanceRosterEntry[]
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

const MARKERS = ["Nadeesha Fernando", "Kasun Jayawardena", "Ishara Weerasinghe"]

function buildRoster(
  session: Omit<AttendanceSessionRecord, "roster">
): AttendanceRosterEntry[] {
  const enrollments = getCourseEnrollments(session.course.id).filter(
    (enrollment) =>
      enrollment.status === "active" || enrollment.status === "completed"
  )

  return enrollments.map((enrollment) => {
    const student = students.find((item) => item.id === enrollment.studentId)
    const gradeName = student
      ? (getGradeAsOf(student, session.sessionDate)?.gradeName ?? null)
      : null
    const base = {
      studentId: enrollment.studentId,
      studentNo: enrollment.studentNo,
      studentName: enrollment.studentName,
      gradeName,
      branchName: session.course.branchName,
      enrollmentId: enrollment.id,
      enrolledOn: enrollment.enrolledOn,
    }

    if (session.status !== "held") {
      return {
        ...base,
        status: null,
        attendedVia: null,
        markedVia: null,
        markedAt: null,
        markedBy: null,
      }
    }

    const seed = hashString(`${session.id}:${enrollment.studentId}`)
    const bucket = seed % 100
    const status: AttendanceStatus =
      bucket < 72
        ? "present"
        : bucket < 86
          ? "absent"
          : bucket < 95
            ? "late"
            : "excused"
    const attendedVia: AttendedVia | null =
      status === "absent" || status === "excused"
        ? null
        : seed % 3 === 0
          ? "online"
          : "physical"
    const markedVia: MarkedVia = seed % 5 === 0 ? "qr" : "manual"
    const markedBy =
      markedVia === "qr" ? "QR self check-in" : MARKERS[seed % MARKERS.length]!

    return {
      ...base,
      status,
      attendedVia,
      markedVia,
      markedAt: `${session.sessionDate}T${session.startsAt}:00+05:30`,
      markedBy,
    }
  })
}

export const attendanceSessions: AttendanceSessionRecord[] = timetableSessions
  .filter((session) => session.status !== "cancelled")
  .map((session) => {
    const base = {
      id: session.id,
      course: session.course,
      sessionDate: session.sessionDate,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      topic: session.topic,
      deliveryMode: session.deliveryMode,
      status: session.status as "scheduled" | "held",
      meetingProvider: session.meetingProvider,
      branchId: session.course.branchId,
      branchName: session.course.branchName,
      gradeNames: session.course.gradeNames,
      lecturerNames: session.course.lecturers.map(
        (lecturer) => lecturer.fullName
      ),
    }

    return { ...base, roster: buildRoster(base) }
  })
  .sort(
    (left, right) =>
      left.sessionDate.localeCompare(right.sessionDate) ||
      left.startsAt.localeCompare(right.startsAt)
  )

export const attendanceCourses: CourseRecord[] = Array.from(
  new Map(
    attendanceSessions.map((session) => [session.course.id, session.course])
  ).values()
).sort((left, right) => left.name.localeCompare(right.name))

export const attendanceBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...Array.from(
    new Map(
      attendanceSessions.map((session) => [
        session.branchId,
        session.branchName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export function getAttendanceCourseOptions(branchId: string) {
  return attendanceCourses
    .filter((course) =>
      attendanceSessions.some(
        (session) =>
          session.course.id === course.id &&
          (branchId === "all" || session.branchId === branchId)
      )
    )
    .map((course) => ({ value: course.id, label: course.name }))
}

export function getAttendanceSessionsForCourse(courseId: string) {
  return attendanceSessions.filter((session) => session.course.id === courseId)
}

/** Prefer a held session with a roster so the page opens on real demo data. */
export function getDefaultAttendanceCourseId() {
  const withRoster = attendanceSessions.find(
    (session) => session.status === "held" && session.roster.length > 0
  )

  return withRoster?.course.id ?? attendanceCourses[0]?.id ?? ""
}

export function getDefaultAttendanceSessionId(courseId: string) {
  const sessions = getAttendanceSessionsForCourse(courseId)

  return (
    sessions.find((session) => session.status === "held")?.id ??
    sessions[sessions.length - 1]?.id ??
    ""
  )
}

export function rosterKey(sessionId: string, studentId: string) {
  return `${sessionId}:${studentId}`
}

export function summarizeAttendance(
  entries: { status: AttendanceStatus | null }[]
) {
  return {
    enrolled: entries.length,
    present: entries.filter((entry) => entry.status === "present").length,
    absent: entries.filter((entry) => entry.status === "absent").length,
    late: entries.filter((entry) => entry.status === "late").length,
    excused: entries.filter((entry) => entry.status === "excused").length,
    unmarked: entries.filter((entry) => entry.status === null).length,
  }
}

export const QR_ATTENDANCE_MODULE_MOCK = {
  enabled: false,
  label: "QR attendance · optional module",
  hint: "QR marks in the sample data are read-only. No scanner, messaging or save runs on this page.",
}
