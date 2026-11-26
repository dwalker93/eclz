"use client"

import { useEffect, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FilterIcon,
  InfoIcon,
  MapPinIcon,
  MonitorIcon,
  QrCodeIcon,
  RotateCcwIcon,
  SearchXIcon,
  ShieldCheckIcon,
  UserRoundCheckIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import { AttendanceStatusBadge } from "@/components/portal-status-badge"
import { type ParentChildAttendanceRecord } from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  formatShortDate,
  getDateParts,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

function summariseAttendance(records: ParentChildAttendanceRecord[]) {
  const counts = records.reduce<
    Record<ParentChildAttendanceRecord["status"], number>
  >(
    (current, record) => {
      current[record.status] += 1
      return current
    },
    { present: 0, late: 0, absent: 0, excused: 0 }
  )
  const totalSessions = records.length

  return {
    ...counts,
    totalSessions,
    rate:
      totalSessions === 0
        ? 0
        : Math.round(((counts.present + counts.late) / totalSessions) * 100),
    physical: records.filter((record) => record.attendedVia === "Physical")
      .length,
    online: records.filter((record) => record.attendedVia === "Online").length,
    manual: records.filter((record) => record.markedVia === "Manual").length,
    qr: records.filter((record) => record.markedVia === "QR").length,
  }
}

export function ParentAttendance() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [courseFilter, setCourseFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const records = selectedChild?.attendanceHistory ?? []

  // The header selector changes the child without remounting this page, so
  // course and date filters must reset when the child changes.
  useEffect(() => {
    setCourseFilter("all")
    setFromDate("")
    setToDate("")
  }, [selectedChild?.id])

  const courseOptions = [
    { value: "all", label: "All courses" },
    ...Array.from(new Set(records.map((record) => record.courseName)))
      .sort((first, second) => first.localeCompare(second))
      .map((courseName) => ({ value: courseName, label: courseName })),
  ]

  const hasFilters = courseFilter !== "all" || fromDate !== "" || toDate !== ""
  const invalidDateRange = fromDate !== "" && toDate !== "" && fromDate > toDate

  const filteredRecords = records.filter((record) => {
    if (courseFilter !== "all" && record.courseName !== courseFilter) {
      return false
    }
    if (fromDate !== "" && record.date < fromDate) {
      return false
    }
    if (toDate !== "" && record.date > toDate) {
      return false
    }
    return true
  })

  const summary = summariseAttendance(filteredRecords)
  const earliestRecord = records[records.length - 1]
  const latestRecord = records[0]

  function clearFilters() {
    setCourseFilter("all")
    setFromDate("")
    setToDate("")
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Attendance"
          description="Attendance history and summary for the child selected in the header. Course and date filters update the summary and records together. This parent view is read-only."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
              </Badge>
              {selectedChild ? (
                <Badge variant="outline" className="rounded-full">
                  Viewing {selectedChild.preferredName}
                </Badge>
              ) : null}
            </>
          }
          actions={
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        {linkedChildren.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there is no attendance to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : (
          <>
            {selectedChild ? (
              records.length === 0 ? (
                <Card className="gap-0 py-0">
                  <EmptyState
                    icon={
                      <ClipboardCheckIcon
                        className="size-5"
                        aria-hidden="true"
                      />
                    }
                    title="No attendance records"
                    description={`No attendance is recorded for ${selectedChild.preferredName}. Contact the branch office if you expected a marked session to appear here.`}
                  />
                </Card>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <h2
                        aria-live="polite"
                        className="text-lg font-semibold tracking-tight"
                      >
                        Attendance for {selectedChild.fullName}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedChild.studentNo} · {selectedChild.grade} ·{" "}
                        {selectedChild.branch} branch
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1.5 rounded-full">
                      <ShieldCheckIcon aria-hidden="true" />
                      Read-only
                    </Badge>
                  </div>

                  <Card className="gap-0 py-0">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-0.5">
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardCheckIcon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          Attendance summary
                        </CardTitle>
                        <CardDescription>
                          {hasFilters
                            ? `Filtered view · ${summary.totalSessions} of ${records.length} sessions`
                            : earliestRecord && latestRecord
                              ? `All marked sessions · ${formatDisplayDate(
                                  earliestRecord.date
                                )} – ${formatDisplayDate(latestRecord.date)}`
                              : "No marked sessions"}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {summary.totalSessions} sessions
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
                      <Progress value={summary.rate} className="gap-2">
                        <ProgressLabel className="text-xs text-muted-foreground">
                          Attendance rate
                        </ProgressLabel>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {summary.rate}%
                        </span>
                      </Progress>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <SummaryTile
                          icon={CircleCheckIcon}
                          label="Present"
                          value={summary.present}
                          tone="emerald"
                        />
                        <SummaryTile
                          icon={ClockIcon}
                          label="Late"
                          value={summary.late}
                          tone="amber"
                        />
                        <SummaryTile
                          icon={CircleXIcon}
                          label="Absent"
                          value={summary.absent}
                          tone="red"
                        />
                        <SummaryTile
                          icon={ShieldCheckIcon}
                          label="Excused"
                          value={summary.excused}
                          tone="sky"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <BreakdownStat
                          icon={MapPinIcon}
                          label="Attended physically"
                          value={summary.physical}
                        />
                        <BreakdownStat
                          icon={MonitorIcon}
                          label="Attended online"
                          value={summary.online}
                        />
                        <BreakdownStat
                          icon={UserRoundCheckIcon}
                          label="Manual marking"
                          value={summary.manual}
                        />
                        <BreakdownStat
                          icon={QrCodeIcon}
                          label="QR marking"
                          value={summary.qr}
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                      The rate counts present and late sessions against the
                      filtered records. Physical and online attendance, and
                      manual or QR marking, are shown separately.
                    </CardFooter>
                  </Card>

                  <Card className="gap-0 py-0">
                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                      <CardTitle className="flex items-center gap-2">
                        <FilterIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Filter history
                      </CardTitle>
                      <CardDescription>
                        Filter by course or date. The summary and history update
                        together.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="parent-attendance-course-filter"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Course
                        </label>
                        <Select
                          items={courseOptions}
                          value={courseFilter}
                          onValueChange={(value) =>
                            setCourseFilter(value ?? "all")
                          }
                        >
                          <SelectTrigger
                            id="parent-attendance-course-filter"
                            className="w-full"
                            aria-label="Filter by course"
                          >
                            <BookOpenIcon
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {courseOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="parent-attendance-from-date"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          From date
                        </label>
                        <Input
                          id="parent-attendance-from-date"
                          type="date"
                          value={fromDate}
                          max={toDate || undefined}
                          onChange={(event) => setFromDate(event.target.value)}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="parent-attendance-to-date"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          To date
                        </label>
                        <Input
                          id="parent-attendance-to-date"
                          type="date"
                          value={toDate}
                          min={fromDate || undefined}
                          onChange={(event) => setToDate(event.target.value)}
                        />
                      </div>

                      <Button
                        variant="outline"
                        onClick={clearFilters}
                        disabled={!hasFilters}
                        className="w-full lg:w-auto"
                      >
                        <RotateCcwIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Clear
                      </Button>
                    </CardContent>
                    {invalidDateRange ? (
                      <CardFooter className="border-t px-4 py-3 text-xs text-destructive sm:px-6">
                        The from date must be on or before the to date.
                      </CardFooter>
                    ) : null}
                  </Card>

                  <Card className="gap-0 py-0">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-0.5">
                        <CardTitle className="flex items-center gap-2">
                          <CalendarDaysIcon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          Attendance history
                        </CardTitle>
                        <CardDescription>
                          {selectedChild.preferredName}&apos;s records, newest
                          first · {filteredRecords.length} of {records.length}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {filteredRecords.length} shown
                      </Badge>
                    </CardHeader>

                    {filteredRecords.length === 0 ? (
                      <EmptyState
                        icon={
                          <SearchXIcon className="size-5" aria-hidden="true" />
                        }
                        title="No attendance records match"
                        description="Try another course or date range. Clear the filters to see all of this child's records."
                      />
                    ) : (
                      <ul className="divide-y">
                        {filteredRecords.map((record) => (
                          <AttendanceRow key={record.id} record={record} />
                        ))}
                      </ul>
                    )}

                    <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                      Attendance is read-only here. Contact the Academic Office
                      if a record looks incorrect.
                    </CardFooter>
                  </Card>

                  <Card className="gap-0 py-0">
                    <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                      <InfoIcon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        These records belong only to {selectedChild.fullName}.
                        Marking mode shows whether the institute recorded the
                        session manually or by QR; parents cannot mark, edit or
                        remove attendance. No other student in the session is
                        shown.
                      </p>
                    </CardContent>
                  </Card>
                </>
              )
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: "emerald" | "amber" | "red" | "sky"
}) {
  const toneClasses = {
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    red: "border-destructive/15 bg-destructive/5 text-destructive",
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        toneClasses[tone]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </p>
        <Icon className="size-4 opacity-70" aria-hidden="true" />
      </div>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}

function BreakdownStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
      <Icon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}

function AttendanceRow({ record }: { record: ParentChildAttendanceRecord }) {
  const dateParts = getDateParts(record.date)
  const online = record.attendedVia === "Online"

  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:px-6">
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {dateParts.month}
        </span>
        <span className="text-lg leading-none font-semibold tabular-nums">
          {dateParts.day}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{record.courseName}</p>
        <p className="text-sm text-muted-foreground">{record.sessionTopic}</p>
        <p className="text-xs text-muted-foreground">
          {formatShortDate(record.date)} · {record.sessionTime}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "gap-1 rounded-full",
              online
                ? "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                : "border-border bg-muted/60 text-muted-foreground"
            )}
          >
            {online ? (
              <MonitorIcon aria-hidden="true" />
            ) : (
              <MapPinIcon aria-hidden="true" />
            )}
            {record.attendedVia}
          </Badge>
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-border bg-muted/60 text-muted-foreground"
          >
            {record.markedVia === "QR" ? (
              <QrCodeIcon aria-hidden="true" />
            ) : (
              <UserRoundCheckIcon aria-hidden="true" />
            )}
            {record.markedVia} marking
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <AttendanceStatusBadge status={record.status} />
      </div>
    </li>
  )
}
