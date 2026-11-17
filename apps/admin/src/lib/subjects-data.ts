/**
 * Local mock fixtures for the Subjects UI demo.
 *
 * The catalog is the shared `subject` fixture used by the courses page, with
 * course counts and lecturer assignments derived from the mock courses. Subject
 * has only `code` (optional, unique) and `name`, so no other fields are shown.
 * Nothing here is persisted.
 */

import {
  courses,
  subjects,
  type CourseRecord,
  type SubjectRecord,
} from "@/lib/courses-data"

export type SubjectDirectoryRecord = SubjectRecord & {
  courseCount: number
  classCount: number
  programCount: number
  lecturerCount: number
  branchNames: string[]
}

export type SubjectLecturerRecord = {
  lecturerId: string
  fullName: string
  courseCount: number
  primaryCount: number
}

export const subjectDirectory: SubjectDirectoryRecord[] = subjects
  .map((subject) => {
    const related = courses.filter(
      (course) => course.subjectId === subject.id
    )
    const lecturerIds = new Set(
      related.flatMap((course) =>
        course.lecturers.map((lecturer) => lecturer.lecturerId)
      )
    )

    return {
      ...subject,
      courseCount: related.length,
      classCount: related.filter((course) => course.kind === "class").length,
      programCount: related.filter((course) => course.kind === "program")
        .length,
      lecturerCount: lecturerIds.size,
      branchNames: Array.from(
        new Set(related.map((course) => course.branchName))
      ).sort((left, right) => left.localeCompare(right)),
    }
  })
  .sort((left, right) => left.name.localeCompare(right.name))

export function getSubjectById(subjectId: string) {
  return subjects.find((subject) => subject.id === subjectId)
}

export function getSubjectCourses(subjectId: string): CourseRecord[] {
  return courses.filter((course) => course.subjectId === subjectId)
}

export function getSubjectLecturers(
  subjectId: string
): SubjectLecturerRecord[] {
  const related = getSubjectCourses(subjectId)
  const lecturerMap = new Map<string, SubjectLecturerRecord>()

  related.forEach((course) => {
    course.lecturers.forEach((lecturer) => {
      const existing = lecturerMap.get(lecturer.lecturerId)

      if (existing) {
        existing.courseCount += 1
        if (lecturer.isPrimary) existing.primaryCount += 1
        return
      }

      lecturerMap.set(lecturer.lecturerId, {
        lecturerId: lecturer.lecturerId,
        fullName: lecturer.fullName,
        courseCount: 1,
        primaryCount: lecturer.isPrimary ? 1 : 0,
      })
    })
  })

  return Array.from(lecturerMap.values()).sort((left, right) =>
    left.fullName.localeCompare(right.fullName)
  )
}

export function getSubjectUsageCounts() {
  return {
    total: subjectDirectory.length,
    withCourses: subjectDirectory.filter((subject) => subject.courseCount > 0)
      .length,
    withoutCourses: subjectDirectory.filter(
      (subject) => subject.courseCount === 0
    ).length,
    courseLinks: subjectDirectory.reduce(
      (total, subject) => total + subject.courseCount,
      0
    ),
  }
}

export const subjectCoverageFilterOptions = [
  { value: "all", label: "All subjects" },
  { value: "with-courses", label: "With courses" },
  { value: "without-courses", label: "No courses" },
]