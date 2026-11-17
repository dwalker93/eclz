/**
 * Local mock data for the admin Dashboard UI demo.
 *
 * The dashboard is a presentational operations overview. Its figures are
 * derived from the same local mock fixtures the other pages use (students,
 * courses, payments and invoices) so the numbers stay coherent across the
 * demo, but they are sample values only — nothing here is a live calculation
 * and nothing is persisted.
 */

import { courses, formatLkr } from "@/lib/courses-data"
import {
  getInvoiceUsage,
  paymentMethodLabels,
  type PaymentMethodType,
} from "@/lib/invoices-data"
import {
  getPaymentUsage,
  paymentDirectory,
  type PaymentRecord,
} from "@/lib/payments-data"
import { MOCK_TODAY, students } from "@/lib/students-data"
import { upcomingSessions } from "@/lib/timetable-data"

export type DashboardRange = "7d" | "30d" | "90d" | "term"

export type DashboardRangeOption = {
  value: DashboardRange
  label: string
  /** Rolling window in days, or a fixed start date when `null`. */
  days: number | null
  start: string | null
}

function shiftDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  const base = Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1)
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10)
}

const TERM_START = "2026-09-01"

export const dashboardRanges: DashboardRangeOption[] = [
  { value: "7d", label: "Last 7 days", days: 7, start: null },
  { value: "30d", label: "Last 30 days", days: 30, start: null },
  { value: "90d", label: "Last 90 days", days: 90, start: null },
  {
    value: "term",
    label: "This term (since Sep)",
    days: null,
    start: TERM_START,
  },
]

export const dashboardRangeFilterOptions = dashboardRanges.map((range) => ({
  value: range.value,
  label: range.label,
}))

export function getRangeStart(range: DashboardRange) {
  const option = dashboardRanges.find((item) => item.value === range)
  if (!option) return TERM_START
  return option.start ?? shiftDays(MOCK_TODAY, -(option.days ?? 30) + 1)
}

export function getRangeLabel(range: DashboardRange) {
  return (
    dashboardRanges.find((item) => item.value === range)?.label ??
    "Selected range"
  )
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function getDashboardKpis() {
  const activeCourses = courses.filter((course) => course.status === "active")
  const payments = getPaymentUsage()
  const invoices = getInvoiceUsage()

  return {
    activeStudents: students.filter((student) => student.status === "active")
      .length,
    totalStudents: students.length,
    activeCourses: activeCourses.length,
    activeClasses: activeCourses.filter((course) => course.kind === "class")
      .length,
    activePrograms: activeCourses.filter((course) => course.kind === "program")
      .length,
    pendingPayments: payments.pending,
    pendingAmount: payments.pendingAmount,
    overdueInvoices: invoices.overdue,
    overdueAmount: invoices.overdueAmount,
    outstandingAmount: invoices.outstanding,
  }
}

export function getDashboardSnapshot(range: DashboardRange) {
  const from = getRangeStart(range)
  const inRange = paymentDirectory.filter(
    (payment) => payment.submittedAt.slice(0, 10) >= from
  )
  const verified = inRange.filter((payment) => payment.status === "verified")
  const pending = inRange.filter(
    (payment) => payment.status === "pending_verification"
  )
  const attention = inRange.filter(
    (payment) => payment.status === "rejected" || payment.status === "voided"
  )

  return {
    from,
    to: MOCK_TODAY,
    paymentsInRange: inRange.length,
    collectedAmount: sum(verified.map((payment) => payment.amount)),
    verifiedCount: verified.length,
    pendingCount: pending.length,
    pendingAmount: sum(pending.map((payment) => payment.amount)),
    attentionCount: attention.length,
    recentPayments: inRange.slice(0, 6),
  }
}

const MONTH_ABBRS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export type CollectionsPoint = {
  /** `YYYY-MM` key, used only to line the series up. */
  key: string
  label: string
  collected: number
  payments: number
}

/** Monthly verified collections for the trailing months ending at mock today. */
export function getCollectionsTrend(months = 5): CollectionsPoint[] {
  const [year, month] = MOCK_TODAY.split("-").map(Number)
  const points: CollectionsPoint[] = []

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1 - offset, 1))
    const key = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}`
    const verified = paymentDirectory.filter(
      (payment) =>
        payment.status === "verified" && payment.paidOn.slice(0, 7) === key
    )

    points.push({
      key,
      label: MONTH_ABBRS[date.getUTCMonth()] ?? key,
      collected: sum(verified.map((payment) => payment.amount)),
      payments: verified.length,
    })
  }

  return points
}

export type UpcomingSession = (typeof upcomingSessions)[number]

export function getUpcomingSessions(limit = 5) {
  return {
    total: upcomingSessions.length,
    sessions: upcomingSessions.slice(0, limit),
  }
}

export function getPaymentMethodLabel(method: PaymentMethodType) {
  return paymentMethodLabels[method]
}

export function formatDashboardAmount(amount: number) {
  return formatLkr(amount)
}

export type { PaymentRecord, PaymentMethodType }
