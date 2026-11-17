"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChartNoAxesCombinedIcon,
  ClockIcon,
  GraduationCapIcon,
  InfoIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { PaymentMethodLabel } from "@/components/payments/payment-method-label"
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge"
import { SessionStatusBadge } from "@/components/timetable/session-status-badge"
import { formatLkr, formatTimeValue } from "@/lib/courses-data"
import {
  dashboardRangeFilterOptions,
  formatDashboardAmount,
  getCollectionsTrend,
  getDashboardKpis,
  getDashboardSnapshot,
  getRangeLabel,
  getUpcomingSessions,
  type DashboardRange,
} from "@/lib/dashboard-data"
import {
  MOCK_TODAY,
  formatDateTime,
  formatDisplayDate,
  getInitials,
} from "@/lib/students-data"

const collectionsChartConfig = {
  collected: {
    label: "Collected",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function DashboardOverview() {
  const [range, setRange] = useState<DashboardRange>("30d")

  const kpis = useMemo(() => getDashboardKpis(), [])
  const snapshot = useMemo(() => getDashboardSnapshot(range), [range])
  const upcoming = useMemo(() => getUpcomingSessions(5), [])
  const collections = useMemo(() => getCollectionsTrend(5), [])

  const collectedTotal = useMemo(
    () => collections.reduce((total, point) => total + point.collected, 0),
    [collections]
  )

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Institute operations overview as of{" "}
              {formatDisplayDate(MOCK_TODAY)}. Figures are sample data for this
              UI demo — they are mock values, not live totals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              items={dashboardRangeFilterOptions}
              value={range}
              onValueChange={(value) =>
                setRange((value ?? "30d") as DashboardRange)
              }
            >
              <SelectTrigger
                className="w-full sm:w-52"
                aria-label="Select reporting date range"
              >
                <CalendarRangeIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dashboardRangeFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={<GraduationCapIcon aria-hidden="true" />}
            value={kpis.activeStudents}
            label="Active students"
            hint={`${kpis.totalStudents} students on roll`}
          />
          <KpiCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={kpis.activeCourses}
            label="Active courses & classes"
            hint={`${kpis.activeClasses} classes · ${kpis.activePrograms} programs`}
          />
          <KpiCard
            icon={<ClockIcon aria-hidden="true" />}
            value={kpis.pendingPayments}
            label="Pending payment verification"
            hint={`${formatLkr(kpis.pendingAmount)} awaiting review`}
            attention={kpis.pendingPayments > 0}
          />
          <KpiCard
            icon={<TriangleAlertIcon aria-hidden="true" />}
            value={kpis.overdueInvoices}
            label="Overdue invoices"
            hint={`${formatLkr(kpis.overdueAmount)} overdue`}
            attention={kpis.overdueInvoices > 0}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="gap-0 py-0 xl:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <WalletIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Recent payments
                </CardTitle>
                <CardDescription>
                  {snapshot.paymentsInRange} submitted in{" "}
                  {getRangeLabel(range).toLowerCase()} ·{" "}
                  {formatLkr(snapshot.collectedAmount)} collected
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {snapshot.pendingCount} pending
              </Badge>
            </CardHeader>

            {snapshot.recentPayments.length === 0 ? (
              <EmptyState
                icon={<WalletIcon className="size-5" aria-hidden="true" />}
                title="No payments in this range"
                description={`No payment records were submitted between ${formatDisplayDate(
                  snapshot.from
                )} and ${formatDisplayDate(snapshot.to)}. Try a wider date range.`}
              />
            ) : (
              <RecentPaymentsTable payments={snapshot.recentPayments} />
            )}

            <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Payment verification happens on the Payments page. Verified
                payments are allocated to invoices; pending ones do not reduce a
                balance yet.
              </span>
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-4 py-4 sm:px-6">
                <CardTitle className="flex items-center gap-2">
                  <CalendarClockIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Upcoming class sessions
                </CardTitle>
                <CardDescription>
                  {upcoming.total} scheduled from{" "}
                  {formatDisplayDate(MOCK_TODAY)}
                </CardDescription>
              </CardHeader>

              {upcoming.sessions.length === 0 ? (
                <EmptyState
                  icon={
                    <CalendarClockIcon className="size-5" aria-hidden="true" />
                  }
                  title="No upcoming sessions"
                  description="Dated class sessions generated from the timetable mock will appear here."
                />
              ) : (
                <ul className="flex flex-col divide-y">
                  {upcoming.sessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {session.course.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDisplayDate(session.sessionDate)} ·{" "}
                          {formatTimeValue(session.startsAt)}–
                          {formatTimeValue(session.endsAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {session.course.branchName}
                          {session.course.lecturers.length > 0
                            ? ` · ${session.course.lecturers
                                .map((lecturer) => lecturer.fullName)
                                .join(", ")}`
                            : ""}
                        </span>
                      </div>
                      <SessionStatusBadge
                        status={session.status}
                        className="shrink-0"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <ChartNoAxesCombinedIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Collections trend
                  </CardTitle>
                  <CardDescription>
                    Verified payments · last 5 months
                  </CardDescription>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatLkr(collectedTotal)}
                </span>
              </CardHeader>
              <CardContent className="px-2 py-4 sm:px-4">
                <ChartContainer
                  config={collectionsChartConfig}
                  className="h-40 w-full"
                >
                  <AreaChart
                    accessibilityLayer
                    data={collections}
                    margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {formatDashboardAmount(Number(value))}
                            </span>
                          )}
                        />
                      }
                    />
                    <Area
                      dataKey="collected"
                      type="monotone"
                      fill="var(--color-collected)"
                      fillOpacity={0.2}
                      stroke="var(--color-collected)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="mt-2 flex items-start gap-2 px-2 text-xs text-muted-foreground">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Sample monthly totals. Charts are secondary to the payments
                    table above.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

function RecentPaymentsTable({
  payments,
}: {
  payments: ReturnType<typeof getDashboardSnapshot>["recentPayments"]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Student
          </TableHead>
          <TableHead className="text-muted-foreground">Branch</TableHead>
          <TableHead className="text-right text-muted-foreground">
            Amount
          </TableHead>
          <TableHead className="text-muted-foreground">Method</TableHead>
          <TableHead className="text-muted-foreground">
            Submitted / verified
          </TableHead>
          <TableHead className="pr-4 text-muted-foreground sm:pr-6">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="py-3 pl-4 sm:pl-6">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-muted-foreground">
                  {getInitials(payment.studentName)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {payment.studentName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {payment.studentNo}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {payment.branchName}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatLkr(payment.amount)}
            </TableCell>
            <TableCell>
              <PaymentMethodLabel method={payment.method} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              <div className="flex flex-col gap-0.5 text-xs">
                <span>Submitted {formatDateTime(payment.submittedAt)}</span>
                <span>
                  {payment.verifiedAt
                    ? `Verified ${formatDateTime(payment.verifiedAt)}`
                    : "Awaiting verification"}
                </span>
              </div>
            </TableCell>
            <TableCell className="pr-4 sm:pr-6">
              <PaymentStatusBadge status={payment.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function KpiCard({
  icon,
  value,
  label,
  hint,
  attention,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
  attention?: boolean
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        {attention ? (
          <Badge
            variant="outline"
            className="rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
          >
            Needs attention
          </Badge>
        ) : null}
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
