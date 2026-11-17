/**
 * Local mock fixtures for the Fee Exceptions UI demo.
 *
 * Mirrors `fee_exception` rows attached to an enrollment and a course. An
 * exception either points at an alternate `fee_structure` for the same course
 * (`alternate_option`) or carries a `percent` / `fixed` discount. Every record
 * keeps the original course fee alongside the exception so the page can show an
 * illustrative resulting amount; nothing here is persisted and no invoice is
 * recalculated.
 */

import { getCourseById, type CourseKind } from "@/lib/courses-data"
import {
  MOCK_TODAY,
  students,
  type StudentEnrollment,
  type StudentRecord,
} from "@/lib/students-data"

export type FeeExceptionKind = "alternate_option" | "discount"
export type DiscountType = "percent" | "fixed"
export type FeeExceptionStatus = "active" | "scheduled" | "ended"

/**
 * Fee exceptions ship as an optional module. The admin shell keeps the row in
 * the mock organization modules; this flag is a local preview so the page can
 * demonstrate both the enabled and the disabled state.
 */
export const FEE_EXCEPTIONS_MODULE_MOCK = {
  enabled: true,
  label: "Fee exceptions · optional module",
  hint: "Exceptions always attach to an enrollment. Switching the module off keeps existing active exceptions applying — it only hides this screen.",
}

export const feeExceptionKindLabels: Record<FeeExceptionKind, string> = {
  alternate_option: "Alternate fee option",
  discount: "Discount",
}

export const discountTypeLabels: Record<DiscountType, string> = {
  percent: "Percentage",
  fixed: "Fixed amount",
}

export const feeExceptionStatusLabels: Record<FeeExceptionStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  ended: "Ended",
}

export const feeExceptionKindOptions: {
  value: FeeExceptionKind
  label: string
}[] = [
  { value: "discount", label: feeExceptionKindLabels.discount },
  {
    value: "alternate_option",
    label: feeExceptionKindLabels.alternate_option,
  },
]

export const discountTypeOptions: { value: DiscountType; label: string }[] = [
  { value: "percent", label: discountTypeLabels.percent },
  { value: "fixed", label: discountTypeLabels.fixed },
]

export const feeExceptionStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(
    Object.entries(feeExceptionStatusLabels) as [FeeExceptionStatus, string][]
  ).map(([value, label]) => ({ value, label })),
]

/** Another `fee_structure` row for the same course, offered as an exception. */
export type AlternateFeeOption = {
  id: string
  courseId: string
  name: string
  amount: number
}

const alternateFeeOptions: AlternateFeeOption[] = [
  {
    id: "fs-g8-maths-termly",
    courseId: "co-g8-maths",
    name: "Grade 8 Mathematics — termly prepaid",
    amount: 40000,
  },
  {
    id: "fs-g8-maths-sibling",
    courseId: "co-g8-maths",
    name: "Grade 8 Mathematics — sibling rate",
    amount: 3800,
  },
  {
    id: "fs-g6-maths-termly",
    courseId: "co-g6-maths",
    name: "Grade 6 Mathematics — termly prepaid",
    amount: 36000,
  },
  {
    id: "fs-g13-combined-scholar",
    courseId: "co-g13-combined",
    name: "A/L Combined Mathematics — scholarship rate",
    amount: 5000,
  },
]

export function getAlternateOptionsForCourse(courseId: string) {
  return alternateFeeOptions.filter((option) => option.courseId === courseId)
}

export function getAlternateOptionById(optionId: string) {
  return alternateFeeOptions.find((option) => option.id === optionId)
}

type EnrollmentLookup = {
  student: StudentRecord
  enrollment: StudentEnrollment
}

const enrollmentIndex = new Map<string, EnrollmentLookup>()

for (const student of students) {
  for (const enrollment of student.enrollments) {
    enrollmentIndex.set(enrollment.id, { student, enrollment })
  }
}

export function getEnrollmentLookup(enrollmentId: string) {
  return enrollmentIndex.get(enrollmentId)
}

export type FeeExceptionRecord = {
  id: string
  studentId: string
  studentName: string
  studentNo: string
  enrollmentId: string
  courseId: string
  courseName: string
  courseKind: CourseKind
  branchName: string
  kind: FeeExceptionKind
  originalFeeAmount: number
  alternateFeeStructureId: string | null
  alternateFeeStructureName: string | null
  alternateFeeAmount: number | null
  discountType: DiscountType | null
  discountValue: number | null
  effectiveFrom: string
  /** Exclusive end: the first day the exception no longer applies. null = open. */
  effectiveTo: string | null
  reason: string
  createdByLabel: string
  createdAt: string
  endedByLabel: string | null
  endedAt: string | null
  status: FeeExceptionStatus
  /** Illustrative only — the page never recalculates an invoice. */
  resultingAmount: number
}

type FeeExceptionSeed = {
  id: string
  enrollmentId: string
  kind: FeeExceptionKind
  alternateFeeStructureId?: string
  discountType?: DiscountType
  discountValue?: number
  effectiveFrom: string
  effectiveTo?: string | null
  reason: string
  createdByLabel: string
  createdAt: string
  endedByLabel?: string | null
  endedAt?: string | null
}

const feeExceptionSeeds: FeeExceptionSeed[] = [
  {
    id: "fex-1",
    enrollmentId: "en-1a",
    kind: "alternate_option",
    alternateFeeStructureId: "fs-g8-maths-termly",
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    reason: "Guardian prepaid both terms; approved by the principal.",
    createdByLabel: "Kavindu Jayasuriya",
    createdAt: "2026-08-28",
  },
  {
    id: "fex-2",
    enrollmentId: "en-1b",
    kind: "discount",
    discountType: "percent",
    discountValue: 15,
    effectiveFrom: "2026-01-12",
    effectiveTo: null,
    reason: "Sibling concession — 15% while two siblings attend.",
    createdByLabel: "Nadeesha Fernando",
    createdAt: "2026-01-10",
  },
  {
    id: "fex-3",
    enrollmentId: "en-2a",
    kind: "discount",
    discountType: "fixed",
    discountValue: 500,
    effectiveFrom: "2026-02-01",
    effectiveTo: "2026-12-01",
    reason: "Correction for a double-charged materials fee.",
    createdByLabel: "Kavindu Jayasuriya",
    createdAt: "2026-01-30",
  },
  {
    id: "fex-4",
    enrollmentId: "en-3a",
    kind: "alternate_option",
    alternateFeeStructureId: "fs-g6-maths-termly",
    effectiveFrom: "2025-02-01",
    effectiveTo: "2026-01-12",
    reason: "Termly prepaid option used during the 2025 school year.",
    createdByLabel: "Dilani Wickramasinghe",
    createdAt: "2025-01-28",
    endedByLabel: "Dilani Wickramasinghe",
    endedAt: "2026-01-12",
  },
  {
    id: "fex-5",
    enrollmentId: "en-5a",
    kind: "discount",
    discountType: "percent",
    discountValue: 100,
    effectiveFrom: "2026-03-01",
    effectiveTo: null,
    reason: "Full scholarship place — ICT talent programme.",
    createdByLabel: "Ruwan Perera",
    createdAt: "2026-02-25",
  },
  {
    id: "fex-6",
    enrollmentId: "en-6a",
    kind: "discount",
    discountType: "percent",
    discountValue: 50,
    effectiveFrom: "2026-05-01",
    effectiveTo: null,
    reason: "Hardship concession approved for the year.",
    createdByLabel: "Nadeesha Fernando",
    createdAt: "2026-04-27",
  },
  {
    id: "fex-7",
    enrollmentId: "en-7a",
    kind: "alternate_option",
    alternateFeeStructureId: "fs-g13-combined-scholar",
    effectiveFrom: "2026-06-01",
    effectiveTo: null,
    reason: "Scholarship fee structure for an A/L merit student.",
    createdByLabel: "Kavindu Jayasuriya",
    createdAt: "2026-05-29",
  },
  {
    id: "fex-8",
    enrollmentId: "en-10a",
    kind: "discount",
    discountType: "percent",
    discountValue: 20,
    effectiveFrom: "2026-12-01",
    effectiveTo: null,
    reason: "Early-bird concession for the next intake.",
    createdByLabel: "Ruwan Perera",
    createdAt: "2026-11-05",
  },
  {
    id: "fex-9",
    enrollmentId: "en-11a",
    kind: "discount",
    discountType: "fixed",
    discountValue: 1000,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-06-30",
    reason: "One-term concession while a lab was being refurbished.",
    createdByLabel: "Nadeesha Fernando",
    createdAt: "2025-12-28",
    endedByLabel: "Nadeesha Fernando",
    endedAt: "2026-06-30",
  },
  {
    id: "fex-10",
    enrollmentId: "en-8a",
    kind: "discount",
    discountType: "percent",
    discountValue: 25,
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    reason: "Approved transfer concession starting next year.",
    createdByLabel: "Aravinth Raj",
    createdAt: "2026-11-08",
  },
]

function resolveStatus(
  effectiveFrom: string,
  effectiveTo: string | null,
  endedAt: string | null
): FeeExceptionStatus {
  if (endedAt !== null || (effectiveTo !== null && effectiveTo <= MOCK_TODAY)) {
    return "ended"
  }

  if (effectiveFrom > MOCK_TODAY) return "scheduled"

  return "active"
}

function computeResultingAmount(
  originalFeeAmount: number,
  seed: FeeExceptionSeed
): number {
  if (seed.kind === "alternate_option") {
    const option = seed.alternateFeeStructureId
      ? getAlternateOptionById(seed.alternateFeeStructureId)
      : undefined

    return option?.amount ?? originalFeeAmount
  }

  const value = seed.discountValue ?? 0

  if (seed.discountType === "percent") {
    return Math.max(
      0,
      Math.round(originalFeeAmount - (originalFeeAmount * value) / 100)
    )
  }

  return Math.max(0, originalFeeAmount - value)
}

export const feeExceptions: FeeExceptionRecord[] = feeExceptionSeeds
  .map((seed) => {
    const lookup = enrollmentIndex.get(seed.enrollmentId)

    if (!lookup) return null

    const { student, enrollment } = lookup
    const course = getCourseById(enrollment.courseId)
    const originalFeeAmount = course?.fee.amount ?? 0
    const option = seed.alternateFeeStructureId
      ? getAlternateOptionById(seed.alternateFeeStructureId)
      : undefined

    const record: FeeExceptionRecord = {
      id: seed.id,
      studentId: student.id,
      studentName: student.fullName,
      studentNo: student.studentNo,
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      courseName: enrollment.courseName,
      courseKind: enrollment.kind,
      branchName: enrollment.branchName,
      kind: seed.kind,
      originalFeeAmount,
      alternateFeeStructureId: option?.id ?? null,
      alternateFeeStructureName: option?.name ?? null,
      alternateFeeAmount: option?.amount ?? null,
      discountType: seed.discountType ?? null,
      discountValue: seed.discountValue ?? null,
      effectiveFrom: seed.effectiveFrom,
      effectiveTo: seed.effectiveTo ?? null,
      reason: seed.reason,
      createdByLabel: seed.createdByLabel,
      createdAt: seed.createdAt,
      endedByLabel: seed.endedByLabel ?? null,
      endedAt: seed.endedAt ?? null,
      status: resolveStatus(
        seed.effectiveFrom,
        seed.effectiveTo ?? null,
        seed.endedAt ?? null
      ),
      resultingAmount: computeResultingAmount(originalFeeAmount, seed),
    }

    return record
  })
  .filter((record): record is FeeExceptionRecord => record !== null)
  .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))

export function getFeeExceptionById(exceptionId: string) {
  return feeExceptions.find((exception) => exception.id === exceptionId)
}

export function getFeeExceptionUsageCounts() {
  return {
    total: feeExceptions.length,
    active: feeExceptions.filter((exception) => exception.status === "active")
      .length,
    scheduled: feeExceptions.filter(
      (exception) => exception.status === "scheduled"
    ).length,
    ended: feeExceptions.filter((exception) => exception.status === "ended")
      .length,
    discounts: feeExceptions.filter((exception) => exception.kind === "discount")
      .length,
    alternates: feeExceptions.filter(
      (exception) => exception.kind === "alternate_option"
    ).length,
  }
}

export type EnrollmentOption = {
  value: string
  label: string
  studentId: string
  studentName: string
  studentNo: string
  courseId: string
  courseName: string
  courseKind: CourseKind
  branchName: string
  originalFeeAmount: number
}

/** Enrollments that a new exception can attach to, newest first. */
export const enrollmentFormOptions: EnrollmentOption[] = students
  .flatMap((student) =>
    student.enrollments.map((enrollment) => {
      const course = getCourseById(enrollment.courseId)

      return {
        value: enrollment.id,
        label: `${student.fullName} · ${enrollment.courseName}`,
        studentId: student.id,
        studentName: student.fullName,
        studentNo: student.studentNo,
        courseId: enrollment.courseId,
        courseName: enrollment.courseName,
        courseKind: enrollment.kind,
        branchName: enrollment.branchName,
        originalFeeAmount: course?.fee.amount ?? 0,
      }
    })
  )
  .sort((left, right) => left.label.localeCompare(right.label))

export function getEnrollmentFormOption(enrollmentId: string) {
  return enrollmentFormOptions.find((option) => option.value === enrollmentId)
}

export const feeExceptionCourseFilterOptions = [
  { value: "all", label: "All courses" },
  ...Array.from(
    new Map(
      feeExceptions.map((exception) => [
        exception.courseId,
        exception.courseName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const feeExceptionKindFilterOptions = [
  { value: "all", label: "All kinds" },
  ...feeExceptionKindOptions,
]

/** Column text for the "amount / type" cell. */
export function formatExceptionEffect(exception: FeeExceptionRecord) {
  if (exception.kind === "alternate_option") {
    return exception.alternateFeeStructureName ?? "Alternate fee structure"
  }

  if (exception.discountType === "percent") {
    const value = exception.discountValue ?? 0

    return value >= 100 ? "100% · free place" : `${value}% off`
  }

  return `${formatDiscountAmount(exception.discountValue ?? 0)} off`
}

function formatDiscountAmount(value: number) {
  return `LKR ${value.toLocaleString("en-LK")}`
}
