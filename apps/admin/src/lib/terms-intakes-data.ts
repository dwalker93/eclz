/**
 * Local mock fixtures for the Terms & Intakes UI demo.
 *
 * Academic terms and program intakes are distinct concepts. Terms come from the
 * shared `academic_term` fixture and intakes from `intake`. Term usage counts
 * are derived from mock courses; intake enrollment counts are clearly-labelled
 * sample display values because the mock student subset has no program intake
 * enrollments. Nothing here is persisted.
 */

import {
  academicTerms,
  courses,
  programIntakes,
  type AcademicTermRecord,
  type IntakeRecord,
  type IntakeStatus,
} from "@/lib/courses-data"

export type TermDirectoryRecord = AcademicTermRecord & {
  courseCount: number
}

export type IntakeDirectoryRecord = IntakeRecord & {
  programName: string
  programBranchName: string
  enrolledCount: number
}

export const termDirectory: TermDirectoryRecord[] = academicTerms.map(
  (term) => ({
    ...term,
    courseCount: courses.filter((course) => course.termId === term.id).length,
  })
)

/**
 * Sample display counts for the demo. Real enrollment counts would come from
 * `enrollment` rows; the mock student subset does not include program intakes.
 */
const sampleIntakeEnrollment: Record<string, number> = {
  "intake-dm-2026-10": 28,
  "intake-dm-2027-02": 9,
  "intake-dm-2026-06": 33,
  "intake-ict-2024-03": 25,
}

export const intakeDirectory: IntakeDirectoryRecord[] = programIntakes
  .map((intakeRecord) => {
    const program = courses.find((course) => course.id === intakeRecord.courseId)

    return {
      ...intakeRecord,
      programName: program?.name ?? "Unknown program",
      programBranchName: program?.branchName ?? "—",
      enrolledCount: sampleIntakeEnrollment[intakeRecord.id] ?? 0,
    }
  })
  .sort((left, right) => right.startsOn.localeCompare(left.startsOn))

export const programOptions = courses
  .filter((course) => course.kind === "program")
  .map((course) => ({
    value: course.id,
    label: course.name,
  }))

export const intakeProgramFilterOptions = [
  { value: "all", label: "All programs" },
  ...programOptions,
]

export const intakeStatusFilterOptions: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "running", label: "Running" },
  { value: "closed", label: "Closed" },
]

export const intakeStatusFormOptions: {
  value: IntakeStatus
  label: string
}[] = [
  { value: "open", label: "Open" },
  { value: "running", label: "Running" },
  { value: "closed", label: "Closed" },
]

export function getIntakeUsageCounts() {
  return {
    total: intakeDirectory.length,
    open: intakeDirectory.filter((intakeRecord) => intakeRecord.status === "open")
      .length,
    running: intakeDirectory.filter(
      (intakeRecord) => intakeRecord.status === "running"
    ).length,
    closed: intakeDirectory.filter(
      (intakeRecord) => intakeRecord.status === "closed"
    ).length,
  }
}

export function getCurrentTerm() {
  return termDirectory.find((term) => term.isCurrent)
}