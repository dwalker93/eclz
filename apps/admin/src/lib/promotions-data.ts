/**
 * Local mock fixtures for the Promotions UI demo.
 *
 * Mirrors the `promotion_run`, `promotion_item`, `student_level` and
 * `enrollment` concepts. Runs follow draft → review → confirm. Nothing here is
 * persisted and mock decisions are never applied to student records.
 */

import {
  branches,
  gradeLevels,
  getGradeAsOf,
  MOCK_TODAY,
  students,
  type StudentRecord,
} from "@/lib/students-data"

export type PromotionDecision = "move" | "stay" | "skip" | "needs_review"
export type PromotionRunStatus = "draft" | "confirmed" | "discarded"

export type PromotionItemRecord = {
  id: string
  studentId: string
  studentNo: string
  studentName: string
  fromEnrollmentId: string | null
  currentGrade: string
  currentClass: string
  currentBranch: string
  /** Next-grade class proposed by the run. null when no class matched. */
  proposedCourseName: string | null
  /** Set when a stay keeps the current grade for fee rates. */
  billingGradeName: string | null
  decision: PromotionDecision
  note: string | null
}

export type PromotionRunRecord = {
  id: string
  title: string
  status: PromotionRunStatus
  effectiveDate: string
  performedAt: string
  confirmedAt: string | null
  scopeBranch: string
  scopeGrade: string
  scopeCourseGroup: string
  note: string
  items: PromotionItemRecord[]
}

/** First day of the billing month after the mock "today". */
export function getFirstOfNextBillingMonth(asOf: string = MOCK_TODAY) {
  const [yearPart = "2026", monthPart = "01"] = asOf.split("-")
  const year = Number(yearPart)
  const month = Number(monthPart)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
}

const nextClassByCourseId: Record<string, string | null> = {
  "co-g2-maths": "Primary Mathematics — Grade 3",
  "co-g3-english": "Primary English — Grade 4",
  "co-g6-maths": "Grade 7 Mathematics — Weekday",
  "co-g7-maths": "Grade 8 Mathematics — Saturday",
  "co-g8-maths": "Grade 9 Mathematics",
  "co-g8-science": "Grade 9 Science",
  "co-g9-ict": "Grade 10 ICT",
  "co-g10-science": "Grade 11 Science — O/L",
  "co-g11-maths": "Grade 12 Mathematics — 2027",
  "co-g11-science": "Grade 12 Science — 2027",
  "co-g11-english": "A/L English Language — 2027",
  "co-g11-business": "A/L Business Studies",
  "co-g13-combined": null,
}

type DraftDecisionOverride = {
  decision: PromotionDecision
  note?: string
}

const draftDecisionOverrides: Record<string, DraftDecisionOverride> = {
  "stu-2:co-g11-maths": {
    decision: "needs_review",
    note: "No Grade 12 mathematics class is open for the Colombo branch yet. Confirm a class and fee option first.",
  },
  "stu-2:co-g11-science": {
    decision: "needs_review",
    note: "A/L science stream placement needs a confirmed class before the effective date.",
  },
  "stu-6:co-g3-english": {
    decision: "stay",
    note: "Family asked to keep the current fee. The grade advances but the enrollment billing grade stays pinned at Grade 3.",
  },
  "stu-7:co-g13-combined": {
    decision: "skip",
    note: "Highest grade reached. No next class is available for this cohort.",
  },
  "stu-12:co-g8-maths": {
    decision: "skip",
    note: "Student is not continuing next term. No class placement should be created.",
  },
}

type ItemSeed = {
  studentId: string
  studentNo: string
  studentName: string
  fromEnrollmentId: string
  courseId: string
  currentGrade: string
  currentClass: string
  currentBranch: string
}

const draftItemSeeds: ItemSeed[] = students.flatMap((student: StudentRecord) => {
  const grade = getGradeAsOf(student)

  return student.enrollments
    .filter(
      (enrollment) =>
        enrollment.kind === "class" && enrollment.status === "active"
    )
    .map((enrollment) => ({
      studentId: student.id,
      studentNo: student.studentNo,
      studentName: student.fullName,
      fromEnrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      currentGrade: grade?.gradeName ?? "No current grade",
      currentClass: enrollment.courseName,
      currentBranch: enrollment.branchName,
    }))
})

function buildDraftItems(): PromotionItemRecord[] {
  return draftItemSeeds.map((seed, index) => {
    const override = draftDecisionOverrides[`${seed.studentId}:${seed.courseId}`]
    const decision = override?.decision ?? "move"
    const proposedCourseName = nextClassByCourseId[seed.courseId] ?? null

    return {
      id: `pi-2026-12-${index + 1}`,
      studentId: seed.studentId,
      studentNo: seed.studentNo,
      studentName: seed.studentName,
      fromEnrollmentId: seed.fromEnrollmentId,
      currentGrade: seed.currentGrade,
      currentClass: seed.currentClass,
      currentBranch: seed.currentBranch,
      proposedCourseName,
      billingGradeName: decision === "stay" ? seed.currentGrade : null,
      decision,
      note:
        override?.note ??
        (decision === "move" && proposedCourseName === null
          ? "No next class matched; review before confirming."
          : null),
    }
  })
}

function historicalItem(
  input: {
    id: string
    studentId: string
    currentGrade: string
    currentClass: string
    currentBranch: string
    proposedCourseName: string | null
    decision: PromotionDecision
    note?: string
    billingGradeName?: string | null
  }
): PromotionItemRecord {
  const student = students.find((item) => item.id === input.studentId)

  return {
    id: input.id,
    studentId: input.studentId,
    studentNo: student?.studentNo ?? "—",
    studentName: student?.fullName ?? "Unknown student",
    fromEnrollmentId: null,
    currentGrade: input.currentGrade,
    currentClass: input.currentClass,
    currentBranch: input.currentBranch,
    proposedCourseName: input.proposedCourseName,
    billingGradeName: input.billingGradeName ?? null,
    decision: input.decision,
    note: input.note ?? null,
  }
}

export const promotionRuns: PromotionRunRecord[] = [
  {
    id: "pr-2026-12",
    title: "December 2026 grade advancement",
    status: "draft",
    effectiveDate: "2026-12-01",
    performedAt: "2026-11-10T09:15:00+05:30",
    confirmedAt: null,
    scopeBranch: "All branches",
    scopeGrade: "All grades",
    scopeCourseGroup: "All course groups",
    note: "Draft prepared from active class enrollments. Resolve the flagged items before confirming.",
    items: buildDraftItems(),
  },
  {
    id: "pr-2026-01",
    title: "January 2026 grade advancement",
    status: "confirmed",
    effectiveDate: "2026-01-12",
    performedAt: "2025-12-18T14:30:00+05:30",
    confirmedAt: "2026-01-08T10:05:00+05:30",
    scopeBranch: "All branches",
    scopeGrade: "All grades",
    scopeCourseGroup: "All course groups",
    note: "Confirmed and applied at the start of the 2026 academic year.",
    items: [
      historicalItem({
        id: "pi-2026-01-1",
        studentId: "stu-1",
        currentGrade: "Grade 7",
        currentClass: "Grade 7 Mathematics — Weekday",
        currentBranch: "Colombo",
        proposedCourseName: "Grade 8 Mathematics — Saturday",
        decision: "move",
      }),
      historicalItem({
        id: "pi-2026-01-2",
        studentId: "stu-8",
        currentGrade: "Grade 6",
        currentClass: "Grade 6 Mathematics — Saturday",
        currentBranch: "Jaffna",
        proposedCourseName: "Grade 7 Mathematics — Weekday",
        decision: "move",
      }),
      historicalItem({
        id: "pi-2026-01-3",
        studentId: "stu-6",
        currentGrade: "Grade 2",
        currentClass: "Primary Mathematics — Grade 2",
        currentBranch: "Negombo",
        proposedCourseName: "Primary Mathematics — Grade 3",
        decision: "move",
      }),
    ],
  },
  {
    id: "pr-2025-09",
    title: "September 2025 O/L repeat cohort",
    status: "discarded",
    effectiveDate: "2025-09-01",
    performedAt: "2025-08-20T11:40:00+05:30",
    confirmedAt: null,
    scopeBranch: "Galle",
    scopeGrade: "Grade 9",
    scopeCourseGroup: "Science",
    note: "Discarded after the grade history correction. No grade or enrollment changes were applied.",
    items: [
      historicalItem({
        id: "pi-2025-09-1",
        studentId: "stu-11",
        currentGrade: "Grade 9",
        currentClass: "Grade 9 Science",
        currentBranch: "Negombo",
        proposedCourseName: "Grade 10 Science",
        decision: "needs_review",
        note: "The cohort was already corrected manually, so this proposal was abandoned.",
      }),
      historicalItem({
        id: "pi-2025-09-2",
        studentId: "stu-5",
        currentGrade: "Grade 8",
        currentClass: "Grade 8 Science",
        currentBranch: "Galle",
        proposedCourseName: "Grade 9 Science",
        decision: "needs_review",
        note: "Duplicate of the corrected grade history entry.",
      }),
    ],
  },
]

export const promotionStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "discarded", label: "Discarded" },
]

export const promotionDecisionOptions: {
  value: PromotionDecision
  label: string
}[] = [
  { value: "move", label: "Move to next class" },
  { value: "stay", label: "Stay (pin billing)" },
  { value: "skip", label: "Skip" },
  { value: "needs_review", label: "Needs review" },
]

export function getPromotionDecisionLabel(decision: PromotionDecision) {
  return (
    promotionDecisionOptions.find((option) => option.value === decision)
      ?.label ?? decision
  )
}

export function getPromotionRunSummary(items: PromotionItemRecord[]) {
  const summary = {
    move: 0,
    stay: 0,
    skip: 0,
    needsReview: 0,
    total: items.length,
  }

  for (const item of items) {
    if (item.decision === "move") summary.move += 1
    else if (item.decision === "stay") summary.stay += 1
    else if (item.decision === "skip") summary.skip += 1
    else summary.needsReview += 1
  }

  return summary
}

export const promotionBranchOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const promotionGradeOptions = [
  { value: "all", label: "All grades" },
  ...gradeLevels.map((grade) => ({ value: grade.id, label: grade.name })),
]

/** Mock course groups; the real catalog would come from `course_group`. */
export const promotionCourseGroupOptions = [
  { value: "all", label: "All course groups" },
  { value: "mathematics", label: "Mathematics" },
  { value: "science", label: "Science" },
  { value: "english", label: "English" },
  { value: "business", label: "Business studies" },
  { value: "ict", label: "ICT" },
]
