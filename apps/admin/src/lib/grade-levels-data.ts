/**
 * Local mock fixtures for the Grade Levels UI demo.
 *
 * Mirrors `grade_level` (name, stage, ordinal) and derives the student and
 * course counts from the shared Students and Courses mock fixtures. A student's
 * current grade comes from the `student_level` history with date ranges, not a
 * field on the student profile. Nothing here is persisted.
 */

import { courses, type CourseRecord } from "@/lib/courses-data"
import {
  MOCK_TODAY,
  getGradeAsOf,
  gradeLevels,
  stageLabel,
  students,
  type GradeStage,
  type StudentRecord,
} from "@/lib/students-data"

export type GradeLevelDirectoryRecord = {
  id: string
  name: string
  stage: GradeStage
  ordinal: number
  /** Students whose current `student_level` row points at this grade. */
  studentCount: number
  activeStudentCount: number
  courseCount: number
  classCount: number
  programCount: number
  previousGradeName: string | null
  nextGradeName: string | null
}

const orderedGradeLevels = [...gradeLevels].sort(
  (left, right) => left.ordinal - right.ordinal
)

export const gradeLevelDirectory: GradeLevelDirectoryRecord[] =
  orderedGradeLevels.map((gradeLevel, index) => {
    const relatedCourses = courses.filter((course) =>
      course.gradeIds.includes(gradeLevel.id)
    )
    const currentStudents = students.filter(
      (student) => getGradeAsOf(student)?.gradeLevelId === gradeLevel.id
    )

    return {
      ...gradeLevel,
      studentCount: currentStudents.length,
      activeStudentCount: currentStudents.filter(
        (student) => student.status === "active"
      ).length,
      courseCount: relatedCourses.length,
      classCount: relatedCourses.filter((course) => course.kind === "class")
        .length,
      programCount: relatedCourses.filter((course) => course.kind === "program")
        .length,
      previousGradeName: orderedGradeLevels[index - 1]?.name ?? null,
      nextGradeName: orderedGradeLevels[index + 1]?.name ?? null,
    }
  })

export function getGradeLevelById(gradeLevelId: string) {
  return gradeLevelDirectory.find(
    (gradeLevel) => gradeLevel.id === gradeLevelId
  )
}

export function getGradeLevelCourses(gradeLevelId: string): CourseRecord[] {
  return courses.filter((course) => course.gradeIds.includes(gradeLevelId))
}

/**
 * Students whose current grade on the given date is this grade. Uses the same
 * `from_date <= asOf` / `to_date` rule as the rest of the demo, so the grade is
 * never read from the student profile directly.
 */
export function getStudentsInGrade(
  gradeLevelId: string,
  asOf: string = MOCK_TODAY
): StudentRecord[] {
  return students.filter(
    (student) => getGradeAsOf(student, asOf)?.gradeLevelId === gradeLevelId
  )
}

export function getGradeLevelUsage() {
  return {
    total: gradeLevelDirectory.length,
    placedStudents: gradeLevelDirectory.reduce(
      (total, gradeLevel) => total + gradeLevel.studentCount,
      0
    ),
    activePlacedStudents: gradeLevelDirectory.reduce(
      (total, gradeLevel) => total + gradeLevel.activeStudentCount,
      0
    ),
    coursePlacements: gradeLevelDirectory.reduce(
      (total, gradeLevel) => total + gradeLevel.courseCount,
      0
    ),
    stages: new Set(gradeLevelDirectory.map((gradeLevel) => gradeLevel.stage))
      .size,
    highestGrade:
      gradeLevelDirectory[gradeLevelDirectory.length - 1]?.name ?? "—",
  }
}

export const gradeStageOptions: { value: GradeStage; label: string }[] = [
  { value: "primary", label: stageLabel("primary") },
  { value: "junior", label: stageLabel("junior") },
  { value: "ordinary_level", label: stageLabel("ordinary_level") },
  { value: "advanced_level", label: stageLabel("advanced_level") },
]

export const gradeLevelStageFilterOptions: {
  value: string
  label: string
}[] = [{ value: "all", label: "All stages" }, ...gradeStageOptions]
