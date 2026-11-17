/**
 * Local mock fixtures for the Fee Structures UI demo.
 *
 * Mirrors `fee_structure`, `fee_rate` and `installment_option` using the shared
 * Courses fixture. A fee structure belongs to a course and defaults onto its
 * enrollments; `fee_rate` rows are grade-specific and date-bounded, and
 * `installment_option` rows exist for one-time packages. Nothing here is
 * persisted and no invoice or balance is calculated.
 */

import {
  courses,
  formatLkr,
  getCourseIntakes,
  type CourseKind,
  type CourseRecord,
  type FeeBillingType,
  type FeeFrequency,
} from "@/lib/courses-data"
import { MOCK_TODAY } from "@/lib/students-data"

export type OverdueAction =
  "none" | "notify" | "restrict" | "notify_and_restrict"

export type FeeStructureStatus = "active" | "inactive" | "scheduled"

export type FeeRateRecord = {
  id: string
  gradeLevelId: string | null
  gradeName: string | null
  amount: number
  effectiveFrom: string
  /** Exclusive: the first day the rate no longer applies. null = open-ended. */
  effectiveTo: string | null
}

export type InstallmentOptionRecord = {
  id: string
  name: string
  installmentCount: number
  downPaymentPercent: number
  intervalDays: number
  surchargePercent: number
  isActive: boolean
}

export type FeeStructureRecord = {
  id: string
  name: string
  branchId: string
  branchName: string
  courseId: string
  courseName: string
  courseKind: CourseKind
  subjectName: string
  gradeNames: string[]
  intakeId: string | null
  intakeName: string | null
  isDefault: boolean
  billingType: FeeBillingType
  frequency: FeeFrequency | null
  accessDurationMonths: number | null
  overdueGraceDays: number | null
  overdueAction: OverdueAction
  isActive: boolean
  createdAt: string
  rates: FeeRateRecord[]
  installmentOptions: InstallmentOptionRecord[]
}

export const feeBillingTypeLabels: Record<FeeBillingType, string> = {
  recurring: "Recurring",
  one_time_package: "One-time package",
}

export const feeFrequencyLabels: Record<FeeFrequency, string> = {
  monthly: "Monthly",
  per_term: "Per term",
}

export const overdueActionLabels: Record<OverdueAction, string> = {
  none: "No automatic action",
  notify: "Notify guardians",
  restrict: "Restrict access",
  notify_and_restrict: "Notify and restrict",
}

export const overdueActionOptions: { value: OverdueAction; label: string }[] = [
  { value: "none", label: overdueActionLabels.none },
  { value: "notify", label: overdueActionLabels.notify },
  { value: "restrict", label: overdueActionLabels.restrict },
  {
    value: "notify_and_restrict",
    label: overdueActionLabels.notify_and_restrict,
  },
]

export const feeBillingTypeOptions: {
  value: FeeBillingType
  label: string
}[] = [
  { value: "recurring", label: feeBillingTypeLabels.recurring },
  { value: "one_time_package", label: feeBillingTypeLabels.one_time_package },
]

export const feeFrequencyOptions: { value: FeeFrequency; label: string }[] = [
  { value: "monthly", label: feeFrequencyLabels.monthly },
  { value: "per_term", label: feeFrequencyLabels.per_term },
]

export const feeStructureStatusLabels: Record<FeeStructureStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  scheduled: "Scheduled (future)",
}

const feeCourses = courses.filter((course) => course.fee)

function buildRates(course: CourseRecord): FeeRateRecord[] {
  const fee = course.fee
  const anchor = fee.effectiveFrom
  const gradeTargets =
    course.gradeIds.length > 0
      ? course.gradeIds.map((gradeId, index) => ({
          gradeLevelId: gradeId,
          gradeName: course.gradeNames[index] ?? course.gradeNames[0] ?? null,
        }))
      : [{ gradeLevelId: null, gradeName: null }]

  return gradeTargets.flatMap((target, gradeIndex) => {
    const rates: FeeRateRecord[] = []
    const anchorYear = Number(anchor.slice(0, 4))
    const hasPrevious = anchor <= MOCK_TODAY && anchorYear > 2024

    if (hasPrevious) {
      rates.push({
        id: `rate-${course.id}-${gradeIndex + 1}-prev`,
        gradeLevelId: target.gradeLevelId,
        gradeName: target.gradeName,
        amount: Math.round((fee.amount * 0.9) / 100) * 100,
        effectiveFrom: `${anchorYear - 1}-01-01`,
        effectiveTo: anchor,
      })
    }

    rates.push({
      id: `rate-${course.id}-${gradeIndex + 1}-current`,
      gradeLevelId: target.gradeLevelId,
      gradeName: target.gradeName,
      amount: fee.amount,
      effectiveFrom: anchor,
      effectiveTo: null,
    })

    return rates
  })
}

function buildInstallmentOptions(
  course: CourseRecord
): InstallmentOptionRecord[] {
  if (course.fee.billingType !== "one_time_package") return []

  const base: InstallmentOptionRecord[] = [
    {
      id: `inst-${course.id}-2`,
      name: "2 installments",
      installmentCount: 2,
      downPaymentPercent: 50,
      intervalDays: 30,
      surchargePercent: 2.5,
      isActive: true,
    },
    {
      id: `inst-${course.id}-3`,
      name: "3 installments",
      installmentCount: 3,
      downPaymentPercent: 34,
      intervalDays: 30,
      surchargePercent: 5,
      isActive: true,
    },
  ]

  if (course.fee.amount >= 15000) {
    base.push({
      id: `inst-${course.id}-4`,
      name: "4 installments",
      installmentCount: 4,
      downPaymentPercent: 25,
      intervalDays: 30,
      surchargePercent: 7.5,
      isActive: true,
    })
  }

  return base
}

function buildOverdueAction(course: CourseRecord): {
  overdueGraceDays: number | null
  overdueAction: OverdueAction
} {
  if (course.status === "archived") {
    return { overdueGraceDays: null, overdueAction: "none" }
  }

  if (course.fee.billingType === "one_time_package") {
    return {
      overdueGraceDays: course.fee.amount >= 15000 ? 14 : 10,
      overdueAction: "notify_and_restrict",
    }
  }

  return { overdueGraceDays: 7, overdueAction: "notify" }
}

export const feeStructureDirectory: FeeStructureRecord[] = feeCourses.map(
  (course) => {
    const intake = getCourseIntakes(course.id)[0]
    const overdue = buildOverdueAction(course)

    return {
      id: course.fee.id,
      name: course.fee.name,
      branchId: course.branchId,
      branchName: course.branchName,
      courseId: course.id,
      courseName: course.name,
      courseKind: course.kind,
      subjectName: course.subjectName,
      gradeNames: course.gradeNames,
      intakeId: intake?.id ?? null,
      intakeName: intake?.name ?? null,
      isDefault: true,
      billingType: course.fee.billingType,
      frequency: course.fee.frequency,
      accessDurationMonths: course.fee.accessDurationMonths,
      overdueGraceDays: overdue.overdueGraceDays,
      overdueAction: overdue.overdueAction,
      isActive: course.status !== "archived",
      createdAt: course.createdAt,
      rates: buildRates(course),
      installmentOptions: buildInstallmentOptions(course),
    }
  }
)

export function getFeeStructureById(feeStructureId: string) {
  return feeStructureDirectory.find(
    (structure) => structure.id === feeStructureId
  )
}

/** The rate that applies on `asOf`, falling back to the earliest future rate. */
export function getCurrentRate(
  structure: FeeStructureRecord,
  asOf: string = MOCK_TODAY
) {
  const active = structure.rates.find(
    (rate) =>
      rate.effectiveFrom <= asOf &&
      (rate.effectiveTo === null || asOf < rate.effectiveTo)
  )

  return active ?? structure.rates[0] ?? null
}

export function getEarliestEffectiveFrom(structure: FeeStructureRecord) {
  return structure.rates.reduce<string | null>((earliest, rate) => {
    if (!earliest) return rate.effectiveFrom
    return rate.effectiveFrom < earliest ? rate.effectiveFrom : earliest
  }, null)
}

export function getFeeStructureStatus(
  structure: FeeStructureRecord,
  asOf: string = MOCK_TODAY
): FeeStructureStatus {
  if (!structure.isActive) return "inactive"

  const earliest = getEarliestEffectiveFrom(structure)

  if (earliest && earliest > asOf) return "scheduled"

  return "active"
}

export function getRateSummary(
  structure: FeeStructureRecord,
  asOf: string = MOCK_TODAY
) {
  const rate = getCurrentRate(structure, asOf)

  if (!rate) return "No rate set"

  return `${formatLkr(rate.amount)} · ${rate.gradeName ?? "All grades"}`
}

export function getFeeStructureUsage() {
  return {
    total: feeStructureDirectory.length,
    recurring: feeStructureDirectory.filter(
      (structure) => structure.billingType === "recurring"
    ).length,
    packages: feeStructureDirectory.filter(
      (structure) => structure.billingType === "one_time_package"
    ).length,
    active: feeStructureDirectory.filter(
      (structure) => getFeeStructureStatus(structure) === "active"
    ).length,
    scheduled: feeStructureDirectory.filter(
      (structure) => getFeeStructureStatus(structure) === "scheduled"
    ).length,
    branches: new Set(
      feeStructureDirectory.map((structure) => structure.branchId)
    ).size,
  }
}

export const feeStructureBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...Array.from(
    new Map(
      feeStructureDirectory.map((structure) => [
        structure.branchId,
        structure.branchName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const feeStructureCourseFilterOptions = [
  { value: "all", label: "All courses" },
  ...feeCourses
    .map((course) => ({ value: course.id, label: course.name }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const feeStructureBillingFilterOptions = [
  { value: "all", label: "All billing types" },
  ...feeBillingTypeOptions,
]

export const feeStructureStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(
    Object.entries(feeStructureStatusLabels) as [FeeStructureStatus, string][]
  ).map(([value, label]) => ({ value, label })),
]

export const feeStructureCourseFormOptions = feeCourses
  .map((course) => ({
    value: course.id,
    label: course.name,
    branchName: course.branchName,
  }))
  .sort((left, right) => left.label.localeCompare(right.label))

export function getCourseFormOption(courseId: string) {
  return feeStructureCourseFormOptions.find(
    (option) => option.value === courseId
  )
}

export function getIntakeOptionsForCourse(courseId: string) {
  return getCourseIntakes(courseId).map((intake) => ({
    value: intake.id,
    label: `${intake.name} (${intake.status})`,
  }))
}
