/**
 * Local mock fixtures for the Commission Rules UI demo.
 *
 * Mirrors `commission_rule`: what the institute keeps from a lecturer's fees,
 * resolved by specificity (course → subject + grade → subject → lecturer
 * default). Rates are illustrative sample numbers, and every estimate shown on
 * the page is labelled as such. Nothing here is persisted and no commission is
 * accrued, reversed or paid.
 */

import { courses, formatLkr, getCourseById, subjects } from "@/lib/courses-data"
import { lecturers } from "@/lib/lecturers-data"
import {
  commissionBasisHints,
  commissionBasisLabels,
  organization,
} from "@/lib/organization-data"
import { gradeLevels, MOCK_TODAY } from "@/lib/students-data"

export type CommissionCalcType = "percent" | "fixed_per_student_month"
export type CommissionScopeKind =
  | "course"
  | "subject_grade"
  | "subject"
  | "default"
export type CommissionRuleStatus = "active" | "scheduled" | "ended"

export const commissionCalcTypeLabels: Record<CommissionCalcType, string> = {
  percent: "Percent",
  fixed_per_student_month: "Fixed per student-month",
}

export const commissionCalcTypeShortLabels: Record<CommissionCalcType, string> =
  {
    percent: "Percent",
    fixed_per_student_month: "Fixed / student / month",
  }

export const commissionCalcTypeHints: Record<CommissionCalcType, string> = {
  percent: "The institute keeps a percentage of the commission base.",
  fixed_per_student_month:
    "A flat amount per enrolled student per month, capped at the base.",
}

export const commissionScopeLabels: Record<CommissionScopeKind, string> = {
  course: "Course",
  subject_grade: "Subject + grade",
  subject: "Subject",
  default: "Lecturer default",
}

export const commissionScopeHints: Record<CommissionScopeKind, string> = {
  course: "Applies to one course and overrides every broader rule.",
  subject_grade:
    "Applies to one subject within one grade level. Needs a subject.",
  subject: "Applies to every course that teaches one subject.",
  default: "The fallback rule for every course the lecturer teaches.",
}

/** Most specific first, matching the resolution order in the schema comment. */
export const commissionScopePrecedence: CommissionScopeKind[] = [
  "course",
  "subject_grade",
  "subject",
  "default",
]

export const commissionRuleStatusLabels: Record<
  CommissionRuleStatus,
  string
> = {
  active: "Active",
  scheduled: "Scheduled",
  ended: "Ended",
}

export const commissionCalcTypeOptions = (
  Object.entries(commissionCalcTypeLabels) as [CommissionCalcType, string][]
).map(([value, label]) => ({ value, label }))

export const commissionScopeOptions = commissionScopePrecedence.map(
  (value) => ({ value, label: commissionScopeLabels[value] })
)

export type CommissionRuleRecord = {
  id: string
  lecturerId: string
  lecturerName: string
  /** Scope: a course, or a subject with an optional grade, or neither (default). */
  courseId: string | null
  courseName: string | null
  subjectId: string | null
  subjectName: string | null
  gradeLevelId: string | null
  gradeLevelName: string | null
  calcType: CommissionCalcType
  /** Percent (0–100) or a fixed LKR amount per student per month. */
  commissionRate: number
  effectiveFrom: string
  /** Exclusive end. null = current. */
  effectiveTo: string | null
  createdAt: string
}

type CommissionRuleSeed = Omit<
  CommissionRuleRecord,
  "lecturerName" | "courseName" | "subjectName" | "gradeLevelName"
>

function lecturerName(lecturerId: string) {
  return (
    lecturers.find((lecturer) => lecturer.id === lecturerId)?.fullName ??
    "Lecturer"
  )
}

function courseName(courseId: string | null) {
  if (!courseId) return null

  return getCourseById(courseId)?.name ?? courseId
}

function subjectName(subjectId: string | null) {
  if (!subjectId) return null

  return subjects.find((subject) => subject.id === subjectId)?.name ?? subjectId
}

function gradeLevelName(gradeLevelId: string | null) {
  if (!gradeLevelId) return null

  return (
    gradeLevels.find((gradeLevel) => gradeLevel.id === gradeLevelId)?.name ??
    gradeLevelId
  )
}

const commissionRuleSeeds: CommissionRuleSeed[] = [
  {
    id: "cr-1",
    lecturerId: "lec-1",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 25,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    createdAt: "2025-12-18",
  },
  {
    id: "cr-2",
    lecturerId: "lec-1",
    subjectId: "sub-maths",
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 20,
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    createdAt: "2026-03-22",
  },
  {
    id: "cr-3",
    lecturerId: "lec-1",
    subjectId: null,
    gradeLevelId: null,
    courseId: "co-g8-maths",
    calcType: "percent",
    commissionRate: 15,
    effectiveFrom: "2026-06-01",
    effectiveTo: null,
    createdAt: "2026-05-20",
  },
  {
    id: "cr-4",
    lecturerId: "lec-2",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "fixed_per_student_month",
    commissionRate: 1500,
    effectiveFrom: "2026-02-01",
    effectiveTo: null,
    createdAt: "2026-01-24",
  },
  {
    id: "cr-5",
    lecturerId: "lec-2",
    subjectId: "sub-science",
    gradeLevelId: "gl-12",
    courseId: null,
    calcType: "percent",
    commissionRate: 18,
    effectiveFrom: "2026-05-01",
    effectiveTo: null,
    createdAt: "2026-04-16",
  },
  {
    id: "cr-6",
    lecturerId: "lec-3",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 30,
    effectiveFrom: "2025-01-01",
    effectiveTo: "2026-01-01",
    createdAt: "2024-12-10",
  },
  {
    id: "cr-7",
    lecturerId: "lec-3",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 22,
    effectiveFrom: "2026-02-01",
    effectiveTo: null,
    createdAt: "2026-01-19",
  },
  {
    id: "cr-8",
    lecturerId: "lec-4",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "fixed_per_student_month",
    commissionRate: 1200,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    createdAt: "2025-12-15",
  },
  {
    id: "cr-9",
    lecturerId: "lec-5",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 28,
    effectiveFrom: "2026-10-01",
    effectiveTo: null,
    createdAt: "2026-09-18",
  },
  {
    id: "cr-10",
    lecturerId: "lec-6",
    subjectId: null,
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 26,
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    createdAt: "2026-11-05",
  },
  // Deliberate overlapping pair so the detail sheet can show the conflict cue.
  {
    id: "cr-11",
    lecturerId: "lec-1",
    subjectId: "sub-maths",
    gradeLevelId: null,
    courseId: null,
    calcType: "percent",
    commissionRate: 22,
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    createdAt: "2026-08-20",
  },
]

export const commissionRules: CommissionRuleRecord[] = commissionRuleSeeds
  .map((seed) => ({
    ...seed,
    lecturerName: lecturerName(seed.lecturerId),
    courseName: courseName(seed.courseId),
    subjectName: subjectName(seed.subjectId),
    gradeLevelName: gradeLevelName(seed.gradeLevelId),
  }))
  .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))

export const commissionRulesModuleMock = {
  key: "commissions" as const,
  label: "Commissions module",
  hint: "Commission rules and teacher payouts are optional. They mirror the commissions switch on Organization.",
  /** Local preview state; the organization fixture currently ships it off. */
  enabled: true,
  organizationEnabled: organization.enabledModules.commissions,
}

/** The organization-level basis a rule resolves against: paid or list. */
export const commissionBasisMock = organization.discountCommissionBasis
export { commissionBasisHints, commissionBasisLabels }

export function getCommissionRuleById(ruleId: string) {
  return commissionRules.find((rule) => rule.id === ruleId)
}

export function getCommissionScope(rule: CommissionRuleRecord): {
  kind: CommissionScopeKind
  label: string
  detail: string
} {
  if (rule.courseId) {
    return {
      kind: "course",
      label: commissionScopeLabels.course,
      detail: rule.courseName ?? "Course",
    }
  }

  if (rule.subjectId && rule.gradeLevelId) {
    return {
      kind: "subject_grade",
      label: commissionScopeLabels.subject_grade,
      detail: `${rule.subjectName ?? "Subject"} · ${
        rule.gradeLevelName ?? "Grade"
      }`,
    }
  }

  if (rule.subjectId) {
    return {
      kind: "subject",
      label: commissionScopeLabels.subject,
      detail: rule.subjectName ?? "Subject",
    }
  }

  return {
    kind: "default",
    label: commissionScopeLabels.default,
    detail: "All courses",
  }
}

/** Same lecturer and same target scope, ignoring dates: the overlap key. */
export function getCommissionScopeKey(rule: CommissionRuleRecord) {
  return [
    rule.lecturerId,
    rule.courseId ?? "",
    rule.subjectId ?? "",
    rule.gradeLevelId ?? "",
  ].join("|")
}

const OPEN_END = "9999-12-31"

function rangesOverlap(
  left: CommissionRuleRecord,
  right: CommissionRuleRecord
) {
  const leftEnd = left.effectiveTo ?? OPEN_END
  const rightEnd = right.effectiveTo ?? OPEN_END

  return left.effectiveFrom < rightEnd && right.effectiveFrom < leftEnd
}

/**
 * Rules that target the same scope for the same lecturer with overlapping
 * dates. The schema blocks these with an exclusion constraint, so the UI only
 * warns about them.
 */
export function findOverlappingRules(
  rule: CommissionRuleRecord,
  rules: CommissionRuleRecord[] = commissionRules
) {
  return rules.filter(
    (other) =>
      other.id !== rule.id &&
      getCommissionScopeKey(other) === getCommissionScopeKey(rule) &&
      rangesOverlap(rule, other)
  )
}

export function getCommissionRuleStatus(
  rule: CommissionRuleRecord,
  asOf = MOCK_TODAY
): CommissionRuleStatus {
  if (rule.effectiveFrom > asOf) return "scheduled"
  if (rule.effectiveTo !== null && rule.effectiveTo <= asOf) return "ended"

  return "active"
}

export function formatCommissionRate(rule: CommissionRuleRecord) {
  if (rule.calcType === "percent") return `${rule.commissionRate}%`

  return `${formatLkr(rule.commissionRate)} / student / month`
}

export function formatCommissionRateShort(rule: CommissionRuleRecord) {
  if (rule.calcType === "percent") return `${rule.commissionRate}%`

  return `${formatLkr(rule.commissionRate)}/student`
}

export function formatCommissionPeriod(rule: CommissionRuleRecord) {
  const from = rule.effectiveFrom

  if (!rule.effectiveTo) return `${from} → current`

  return `${from} → ${rule.effectiveTo}`
}

export type CommissionEstimate = {
  base: number
  commission: number
  teacher: number
  capped: boolean
}

/**
 * Illustrative only: applies a rule to a sample base and student count so the
 * calculation type is visible. No accrual, reversal or payout is computed.
 */
export function estimateCommission(
  rule: CommissionRuleRecord,
  base: number,
  students: number
): CommissionEstimate {
  const rawCommission =
    rule.calcType === "percent"
      ? (base * rule.commissionRate) / 100
      : rule.commissionRate * students

  const capped = rawCommission > base
  const commission = capped ? base : rawCommission

  return {
    base,
    commission: Math.round(commission * 100) / 100,
    teacher: Math.round((base - commission) * 100) / 100,
    capped,
  }
}

export function getCommissionRuleUsageCounts() {
  const statuses = commissionRules.map((rule) => getCommissionRuleStatus(rule))
  const overlappingLecturers = new Set(
    commissionRules.flatMap((rule) =>
      findOverlappingRules(rule).length > 0 ? [rule.lecturerId] : []
    )
  )

  return {
    total: commissionRules.length,
    active: statuses.filter((status) => status === "active").length,
    scheduled: statuses.filter((status) => status === "scheduled").length,
    ended: statuses.filter((status) => status === "ended").length,
    percent: commissionRules.filter((rule) => rule.calcType === "percent")
      .length,
    fixed: commissionRules.filter(
      (rule) => rule.calcType === "fixed_per_student_month"
    ).length,
    overlappingLecturers: overlappingLecturers.size,
  }
}

export const commissionRuleLecturerFilterOptions = [
  { value: "all", label: "All lecturers" },
  ...Array.from(
    new Map(
      commissionRules.map((rule) => [rule.lecturerId, rule.lecturerName])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const commissionRuleScopeFilterOptions = [
  { value: "all", label: "All scopes" },
  ...commissionScopeOptions,
]

export const commissionRuleCalcTypeFilterOptions = [
  { value: "all", label: "All calculations" },
  ...commissionCalcTypeOptions,
]

export const commissionRuleStatusFilterOptions = [
  { value: "all", label: "All rules" },
  ...(
    Object.entries(commissionRuleStatusLabels) as [
      CommissionRuleStatus,
      string,
    ][]
  ).map(([value, label]) => ({ value, label })),
]

/** Reused by the form dialog for the subject and grade selects. */
export const commissionSubjectOptions = [
  ...subjects
    .map((subject) => ({ value: subject.id, label: subject.name }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const commissionGradeLevelOptions = [...gradeLevels]
  .sort((left, right) => left.ordinal - right.ordinal)
  .map((gradeLevel) => ({ value: gradeLevel.id, label: gradeLevel.name }))

export const commissionCourseOptions = [...courses]
  .map((course) => ({ value: course.id, label: course.name }))
  .sort((left, right) => left.label.localeCompare(right.label))
