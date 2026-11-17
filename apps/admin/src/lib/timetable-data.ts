/**
 * Local mock fixtures for the Timetable UI demo.
 *
 * Mirrors `schedule_slot` (weekday, start/end, room) as recurring weekly
 * templates, and `class_session` as dated sessions. Weekly slots are not
 * attendance events and the timetable never marks attendance. All records come
 * from the shared Courses mock data and nothing here is persisted.
 */

import {
  courses,
  getCourseSessions,
  getWeekdayName,
  weekdayOptions,
  type CourseRecord,
  type CourseSessionRecord,
  type DeliveryMode,
} from "@/lib/courses-data"
import { branches, gradeLevels, MOCK_TODAY } from "@/lib/students-data"

export type TimetableSlotRecord = {
  id: string
  course: CourseRecord
  weekday: number
  weekdayName: string
  startsAt: string
  endsAt: string
  room: string | null
  subjectName: string
  branchName: string
  gradeNames: string[]
  lecturerNames: string[]
  deliveryMode: DeliveryMode
}

export type TimetableSessionRecord = {
  id: string
  course: CourseRecord
  sessionDate: string
  startsAt: string
  endsAt: string
  topic: string
  deliveryMode: DeliveryMode
  status: CourseSessionRecord["status"]
  meetingProvider: CourseSessionRecord["meetingProvider"]
}

const slottedCourses = courses.filter((course) => course.slots.length > 0)

export const timetableSlots: TimetableSlotRecord[] = slottedCourses
  .flatMap((course) =>
    course.slots.map((slot) => ({
      id: slot.id,
      course,
      weekday: slot.weekday,
      weekdayName: getWeekdayName(slot.weekday),
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      room: slot.room,
      subjectName: course.subjectName,
      branchName: course.branchName,
      gradeNames: course.gradeNames,
      lecturerNames: course.lecturers.map((lecturer) => lecturer.fullName),
      deliveryMode: course.deliveryMode,
    }))
  )
  .sort(
    (left, right) =>
      left.weekday - right.weekday ||
      left.startsAt.localeCompare(right.startsAt)
  )

const attendanceCourses = courses.filter(
  (course) => course.attendanceEnabled && course.slots.length > 0
)

/**
 * Dated sessions generated around mock today. A few upcoming sessions are
 * marked cancelled so the demo can show the scheduled / held / cancelled
 * states without inventing attendance records.
 */
export const timetableSessions: TimetableSessionRecord[] =
  attendanceCourses.flatMap((course, courseIndex) => {
    const cancelledIndex = courseIndex % 5 === 3 ? 1 : -1

    return getCourseSessions(course).map((session, sessionIndex) => ({
      ...session,
      status:
        sessionIndex === cancelledIndex
          ? ("cancelled" as const)
          : session.status,
      course,
    }))
  })

export const upcomingSessions = timetableSessions
  .filter((session) => session.sessionDate >= MOCK_TODAY)
  .sort(
    (left, right) =>
      left.sessionDate.localeCompare(right.sessionDate) ||
      left.startsAt.localeCompare(right.startsAt)
  )

export const pastSessions = timetableSessions
  .filter((session) => session.sessionDate < MOCK_TODAY)
  .sort(
    (left, right) =>
      right.sessionDate.localeCompare(left.sessionDate) ||
      right.startsAt.localeCompare(left.startsAt)
  )

export const timetableWeekdays = weekdayOptions.map((option) => ({
  value: Number(option.value),
  label: option.label,
}))

export const timetableBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const timetableCourseFilterOptions = [
  { value: "all", label: "All courses" },
  ...slottedCourses
    .map((course) => ({ value: course.id, label: course.name }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const timetableGradeFilterOptions = [
  { value: "all", label: "All grades" },
  ...[...gradeLevels]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((gradeLevel) => ({ value: gradeLevel.id, label: gradeLevel.name })),
]

const lecturerOptions = new Map<string, string>()
slottedCourses.forEach((course) => {
  course.lecturers.forEach((lecturer) => {
    lecturerOptions.set(lecturer.lecturerId, lecturer.fullName)
  })
})

export const timetableLecturerFilterOptions = [
  { value: "all", label: "All teachers" },
  ...Array.from(lecturerOptions.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const timetableDeliveryFilterOptions = [
  { value: "all", label: "All delivery modes" },
  { value: "physical", label: "Physical" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
]

/** Classes and scheduled programs can have recurring slots; self-paced cannot. */
export const timetableCourseFormOptions = courses
  .filter((course) => course.learningMode !== "self_paced")
  .map((course) => ({ value: course.id, label: course.name }))
  .sort((left, right) => left.label.localeCompare(right.label))

export function getTimetableUsage() {
  return {
    slots: timetableSlots.length,
    courses: new Set(timetableSlots.map((slot) => slot.course.id)).size,
    branches: new Set(timetableSlots.map((slot) => slot.course.branchId)).size,
    upcomingSessions: upcomingSessions.length,
    cancelledSessions: timetableSessions.filter(
      (session) => session.status === "cancelled"
    ).length,
  }
}

export function getTimetableSlotsForWeekday(weekday: number) {
  return timetableSlots.filter((slot) => slot.weekday === weekday)
}
