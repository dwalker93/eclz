"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
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
  Building2Icon,
  CalendarDaysIcon,
  CheckCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  InfoIcon,
  ListFilterIcon,
  MapPinIcon,
  PresentationIcon,
  QrCodeIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserRoundCheckIcon,
  WifiIcon,
  XIcon,
} from "lucide-react"

import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge"
import {
  MarkAttendanceDialog,
  type AttendanceMarkDraft,
} from "@/components/attendance/mark-attendance-dialog"
import { SessionStatusBadge } from "@/components/timetable/session-status-badge"
import { formatTimeValue } from "@/lib/courses-data"
import {
  attendanceBranchFilterOptions,
  attendanceSessions,
  attendanceStatusFilterOptions,
  attendanceStatusOptions,
  attendedViaLabels,
  getAttendanceCourseOptions,
  getAttendanceSessionsForCourse,
  getDefaultAttendanceCourseId,
  getDefaultAttendanceSessionId,
  markedViaLabels,
  rosterKey,
  summarizeAttendance,
  QR_ATTENDANCE_MODULE_MOCK,
  type AttendanceRosterEntry,
  type AttendanceSessionRecord,
  type AttendanceStatus,
  type AttendedVia,
  type MarkedVia,
} from "@/lib/attendance-data"
import { formatDateTime, formatDisplayDate } from "@/lib/students-data"

/** Local-only edit applied to a roster row. Never persisted. */
type AttendanceOverride = {
  status: AttendanceStatus | null
  attendedVia: AttendedVia | null
  markedVia: MarkedVia | null
  markedAt: string | null
  markedBy: string | null
}

const DEMO_MARKER = "Demo admin"

export function AttendanceDirectory() {
  const [branchFilter, setBranchFilter] = useState("all")
  const [courseId, setCourseId] = useState(() => getDefaultAttendanceCourseId())
  const [sessionId, setSessionId] = useState(() =>
    getDefaultAttendanceSessionId(getDefaultAttendanceCourseId())
  )
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [overrides, setOverrides] = useState<
    Record<string, AttendanceOverride>
  >({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Attendance roster refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const courseOptions = useMemo(
    () => getAttendanceCourseOptions(branchFilter),
    [branchFilter]
  )

  const sessionOptions = useMemo(
    () => getAttendanceSessionsForCourse(courseId),
    [courseId]
  )

  const selectedSession = useMemo(
    () =>
      sessionOptions.find((session) => session.id === sessionId) ??
      sessionOptions[0] ??
      null,
    [sessionOptions, sessionId]
  )

  const resolvedEntries = useMemo(() => {
    if (!selectedSession) return []

    return selectedSession.roster.map((entry) => {
      const override = overrides[rosterKey(selectedSession.id, entry.studentId)]

      return override ? { ...entry, ...override } : entry
    })
  }, [selectedSession, overrides])

  const query = search.trim().toLowerCase()
  const hasActiveFilters = search.length > 0 || statusFilter !== "all"
  const hasRoster = resolvedEntries.length > 0

  const filteredEntries = useMemo(() => {
    return resolvedEntries.filter((entry) => {
      if (statusFilter === "unmarked" && entry.status !== null) return false

      if (
        statusFilter !== "all" &&
        statusFilter !== "unmarked" &&
        entry.status !== statusFilter
      ) {
        return false
      }

      if (query.length === 0) return true

      return [entry.studentName, entry.studentNo, entry.gradeName ?? ""].some(
        (value) => value.toLowerCase().includes(query)
      )
    })
  }, [resolvedEntries, query, statusFilter])

  const summary = useMemo(
    () => summarizeAttendance(resolvedEntries),
    [resolvedEntries]
  )
  const markedCount = summary.enrolled - summary.unmarked
  const presentRate =
    markedCount === 0
      ? null
      : Math.round(((summary.present + summary.late) / markedCount) * 100)

  function handleBranchChange(value: string) {
    setBranchFilter(value)

    const options = getAttendanceCourseOptions(value)

    if (!options.some((option) => option.value === courseId)) {
      const nextCourseId = options[0]?.value ?? ""
      setCourseId(nextCourseId)
      setSessionId(getDefaultAttendanceSessionId(nextCourseId))
    }
  }

  function handleCourseChange(value: string) {
    setCourseId(value)
    setSessionId(getDefaultAttendanceSessionId(value))
  }

  function buildOverride(
    session: AttendanceSessionRecord,
    status: AttendanceStatus,
    attendedVia?: AttendedVia | null,
    existing?: AttendanceOverride
  ): AttendanceOverride {
    const via =
      status === "absent" || status === "excused"
        ? null
        : (attendedVia ?? existing?.attendedVia ?? "physical")

    return {
      status,
      attendedVia: via,
      markedVia: "manual",
      markedAt: `${session.sessionDate}T${session.startsAt}:00+05:30`,
      markedBy: DEMO_MARKER,
    }
  }

  function setEntryStatus(
    session: AttendanceSessionRecord,
    entry: AttendanceRosterEntry,
    status: AttendanceStatus,
    attendedVia?: AttendedVia | null
  ) {
    const key = rosterKey(session.id, entry.studentId)
    setOverrides((previous) => ({
      ...previous,
      [key]: buildOverride(session, status, attendedVia, previous[key]),
    }))
  }

  function setEntryAttendedVia(
    session: AttendanceSessionRecord,
    entry: AttendanceRosterEntry,
    attendedVia: AttendedVia
  ) {
    const key = rosterKey(session.id, entry.studentId)
    const existing = overrides[key]

    if (!entry.status && !existing?.status) return

    setOverrides((previous) => ({
      ...previous,
      [key]: {
        status: entry.status ?? existing!.status!,
        attendedVia,
        markedVia: existing?.markedVia ?? "manual",
        markedAt:
          existing?.markedAt ??
          `${session.sessionDate}T${session.startsAt}:00+05:30`,
        markedBy: existing?.markedBy ?? DEMO_MARKER,
      },
    }))
  }

  function clearEntry(
    session: AttendanceSessionRecord,
    entry: AttendanceRosterEntry
  ) {
    setOverrides((previous) => {
      const next = { ...previous }
      delete next[rosterKey(session.id, entry.studentId)]
      return next
    })
  }

  function bulkSetStatus(status: AttendanceStatus) {
    if (!selectedSession) return

    const next: Record<string, AttendanceOverride> = { ...overrides }

    selectedSession.roster.forEach((entry) => {
      const key = rosterKey(selectedSession.id, entry.studentId)
      next[key] = buildOverride(selectedSession, status, null, next[key])
    })

    setOverrides(next)
    setNotice(
      `Marked ${selectedSession.roster.length} ${
        selectedSession.roster.length === 1 ? "student" : "students"
      } as ${status} for this session. Local demo only — nothing was saved.`
    )
  }

  function clearAllMarks() {
    if (!selectedSession) return

    setOverrides((previous) => {
      const next = { ...previous }
      selectedSession.roster.forEach((entry) => {
        delete next[rosterKey(selectedSession.id, entry.studentId)]
      })
      return next
    })
    setNotice(
      "Cleared local marks for this session. The sample data is shown again."
    )
  }

  function handleDialogApply(marks: Record<string, AttendanceMarkDraft>) {
    if (!selectedSession) return

    setOverrides((previous) => {
      const next = { ...previous }

      Object.entries(marks).forEach(([studentId, mark]) => {
        const key = rosterKey(selectedSession.id, studentId)

        if (!mark.status) {
          delete next[key]
          return
        }

        next[key] = buildOverride(
          selectedSession,
          mark.status,
          mark.attendedVia,
          previous[key]
        )
      })

      return next
    })

    const applied = Object.values(marks).filter((mark) => mark.status).length
    setNotice(
      `Applied attendance for ${applied} ${
        applied === 1 ? "student" : "students"
      } in this session. Local demo only — nothing was saved.`
    )
  }

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
  }

  const courseName =
    attendanceSessions.find((session) => session.course.id === courseId)?.course
      .name ?? ""

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Attendance
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Session-first register built from <code>class_session</code> and{" "}
              <code>attendance</code>. Pick a branch, course and dated session,
              then review or demo-mark enrolled students. Nothing on this page
              is saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <QrCodeIcon aria-hidden="true" />
              {QR_ATTENDANCE_MODULE_MOCK.label}
            </Badge>
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={!selectedSession || !hasRoster}
            >
              <UserRoundCheckIcon data-icon="inline-start" />
              Mark attendance
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Session</span>
              <span className="text-xs text-muted-foreground">
                Attendance is recorded per dated session, not per weekly slot.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Select
                items={attendanceBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => handleBranchChange(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <Building2Icon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attendanceBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseOptions}
                value={courseId}
                onValueChange={(value) => handleCourseChange(value ?? "")}
              >
                <SelectTrigger className="w-full" aria-label="Select course">
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={sessionOptions.map((session) => ({
                  value: session.id,
                  label: sessionLabel(session),
                }))}
                value={selectedSession?.id ?? null}
                onValueChange={(value) => setSessionId(value ?? "")}
              >
                <SelectTrigger className="w-full" aria-label="Select session">
                  <CalendarDaysIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessionOptions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {sessionLabel(session)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {selectedSession ? (
          <SessionSummary session={selectedSession} courseName={courseName} />
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard
            icon={<UsersRoundIcon aria-hidden="true" />}
            value={summary.enrolled}
            label="Enrolled"
            hint="Active and completed enrollments"
          />
          <SummaryCard
            icon={<CheckCheckIcon aria-hidden="true" />}
            value={summary.present}
            label="Present"
            hint="Marked present"
            tone="present"
          />
          <SummaryCard
            icon={<CircleXIcon aria-hidden="true" />}
            value={summary.absent}
            label="Absent"
            hint="Marked absent"
            tone="absent"
          />
          <SummaryCard
            icon={<ClockIcon aria-hidden="true" />}
            value={summary.late}
            label="Late"
            hint="Marked late"
            tone="late"
          />
          <SummaryCard
            icon={<ShieldCheckIcon aria-hidden="true" />}
            value={summary.excused}
            label="Excused"
            hint="Excused with notice"
            tone="excused"
          />
          <SummaryCard
            icon={<CircleDashedIcon aria-hidden="true" />}
            value={summary.unmarked}
            label="Not marked"
            hint={
              presentRate === null
                ? "No marks recorded yet"
                : `${presentRate}% present or late`
            }
          />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheckIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Roster
              </CardTitle>
              <CardDescription>
                {filteredEntries.length} of {summary.enrolled}{" "}
                {summary.enrolled === 1 ? "student" : "students"} shown
                {selectedSession
                  ? ` · ${selectedSession.topic}`
                  : " · no session selected"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!selectedSession || !hasRoster}
                    />
                  }
                >
                  <ListFilterIcon data-icon="inline-start" />
                  Bulk status
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Set all students</DropdownMenuLabel>
                    {attendanceStatusOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => bulkSetStatus(option.value)}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearAllMarks}>
                      <RotateCcwIcon aria-hidden="true" />
                      Clear local marks
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRefreshing(true)}
                disabled={isRefreshing}
              >
                <RefreshCwIcon
                  data-icon="inline-start"
                  className={isRefreshing ? "animate-spin" : undefined}
                />
                {isRefreshing ? "Refreshing" : "Refresh"}
              </Button>
            </div>
          </CardHeader>

          <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <div className="relative flex-1">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by student name, number or grade"
                aria-label="Search the roster"
                className="pl-8"
              />
            </div>
            <Select
              items={attendanceStatusFilterOptions}
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "all")}
            >
              <SelectTrigger
                className="w-full sm:w-48"
                aria-label="Filter by attendance status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {attendanceStatusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Reset
            </Button>
          </div>

          {isRefreshing ? (
            <RosterSkeleton />
          ) : !selectedSession ? (
            <EmptyState
              icon={<CalendarDaysIcon className="size-5" aria-hidden="true" />}
              title="No session selected"
              description="Choose a branch, course and dated session to open its attendance register."
            />
          ) : !hasRoster ? (
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No enrolled students"
              description="This session's roster is built from active and completed enrollments on the course."
            />
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="size-5" aria-hidden="true" />}
              title="No students match these filters"
              description="Try a different name, number, grade or attendance status."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <RosterTable
              session={selectedSession}
              entries={filteredEntries}
              resolved={resolvedEntries}
              onSetStatus={(entry, status) =>
                setEntryStatus(selectedSession, entry, status)
              }
              onSetAttendedVia={(entry, via) =>
                setEntryAttendedVia(selectedSession, entry, via)
              }
              onClear={(entry) => clearEntry(selectedSession, entry)}
            />
          )}

          <div className="flex flex-wrap items-start justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <span className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Attendance belongs to a dated session. Manual and QR marks are
              labelled per row; this demo never scans a code, messages anyone,
              or saves a record.
            </span>
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <QrCodeIcon aria-hidden="true" />
              QR module: {QR_ATTENDANCE_MODULE_MOCK.enabled ? "on" : "off"}
            </Badge>
          </div>
        </Card>
      </div>

      <MarkAttendanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={selectedSession}
        entries={resolvedEntries}
        onApply={handleDialogApply}
      />
    </main>
  )
}

const attendanceStatusFilterOptionsForSelect = [
  { value: "all", label: "All statuses" },
  ...attendanceStatusOptions,
  { value: "unmarked", label: "Not marked" },
]

function sessionLabel(session: AttendanceSessionRecord) {
  const status = session.status === "held" ? "held" : "scheduled"

  return `${formatDisplayDate(session.sessionDate)} · ${formatTimeValue(
    session.startsAt
  )} · ${status}`
}

function SessionSummary({
  session,
  courseName,
}: {
  session: AttendanceSessionRecord
  courseName: string
}) {
  const linkLabel = (() => {
    if (session.deliveryMode === "physical") return "On site"
    if (session.meetingProvider === "zoom") return "Zoom link ready"
    if (session.meetingProvider === "teams") return "Teams link ready"
    return "No meeting link"
  })()

  return (
    <Card className="gap-0 py-4">
      <div className="flex flex-col gap-4 px-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{session.topic}</span>
              <SessionStatusBadge status={session.status} />
            </div>
            <span className="text-xs text-muted-foreground">{courseName}</span>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Date"
            value={formatDisplayDate(session.sessionDate)}
            icon={<CalendarDaysIcon aria-hidden="true" />}
          />
          <Field
            label="Time"
            value={`${formatTimeValue(session.startsAt)} – ${formatTimeValue(
              session.endsAt
            )}`}
            icon={<ClockIcon aria-hidden="true" />}
          />
          <Field
            label="Branch"
            value={session.branchName}
            icon={<Building2Icon aria-hidden="true" />}
          />
          <Field
            label="Delivery"
            value={`${
              session.deliveryMode === "physical"
                ? "Physical"
                : session.deliveryMode === "online"
                  ? "Online"
                  : "Hybrid"
            } · ${linkLabel}`}
            icon={
              session.deliveryMode === "online" ? (
                <WifiIcon aria-hidden="true" />
              ) : (
                <MapPinIcon aria-hidden="true" />
              )
            }
          />
          <Field
            label="Grades"
            value={
              session.gradeNames.length > 0
                ? session.gradeNames.join(", ")
                : "No grade link"
            }
            icon={<BookOpenIcon aria-hidden="true" />}
          />
          <Field
            label="Teachers"
            value={
              session.lecturerNames.length > 0
                ? session.lecturerNames.join(", ")
                : "No teacher assigned"
            }
            icon={<PresentationIcon aria-hidden="true" />}
          />
          <Field
            label="Enrolled"
            value={`${session.roster.length} ${
              session.roster.length === 1 ? "student" : "students"
            }`}
            icon={<UsersRoundIcon aria-hidden="true" />}
          />
          <Field
            label="Attendance"
            value={
              session.status === "held"
                ? "Held session — register open"
                : "Scheduled — not marked yet"
            }
            icon={<ClipboardCheckIcon aria-hidden="true" />}
          />
        </dl>

        {session.status === "scheduled" ? (
          <div className="flex items-start gap-2 rounded-md border border-sky-600/20 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-800 dark:text-sky-300">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              This session is scheduled, not held. Rows start unmarked and any
              mark you add here is a local preview only.
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function RosterTable({
  session,
  entries,
  resolved,
  onSetStatus,
  onSetAttendedVia,
  onClear,
}: {
  session: AttendanceSessionRecord
  entries: AttendanceRosterEntry[]
  resolved: AttendanceRosterEntry[]
  onSetStatus: (entry: AttendanceRosterEntry, status: AttendanceStatus) => void
  onSetAttendedVia: (entry: AttendanceRosterEntry, via: AttendedVia) => void
  onClear: (entry: AttendanceRosterEntry) => void
}) {
  const byId = new Map(resolved.map((entry) => [entry.studentId, entry]))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Student
          </TableHead>
          <TableHead className="text-muted-foreground">Grade</TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="text-muted-foreground">Attended via</TableHead>
          <TableHead className="text-muted-foreground">Marked via</TableHead>
          <TableHead className="text-muted-foreground">
            Marked at / by
          </TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((row) => {
          const entry = byId.get(row.studentId) ?? row
          const viaDisabled =
            entry.status === null ||
            entry.status === "absent" ||
            entry.status === "excused"

          return (
            <TableRow key={entry.studentId}>
              <TableCell className="py-3 pl-4 sm:pl-6">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{entry.studentName}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.studentNo}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.gradeName ?? "—"}
              </TableCell>
              <TableCell>
                <AttendanceStatusBadge status={entry.status} />
              </TableCell>
              <TableCell>
                {entry.attendedVia ? (
                  <AttendedViaBadge via={entry.attendedVia} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {entry.markedVia ? (
                  <MarkedViaBadge via={entry.markedVia} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {entry.markedAt ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm tabular-nums">
                      {formatDateTime(entry.markedAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.markedBy ?? "—"}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not marked</span>
                )}
              </TableCell>
              <TableCell className="pr-4 text-right sm:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Attendance actions for ${entry.studentName}`}
                      />
                    }
                  >
                    <EllipsisVerticalIcon
                      className="size-4"
                      aria-hidden="true"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        Set status for {entry.studentName}
                      </DropdownMenuLabel>
                      {attendanceStatusOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => onSetStatus(entry, option.value)}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Attended via</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={viaDisabled}
                        onClick={() => onSetAttendedVia(entry, "physical")}
                      >
                        <MapPinIcon aria-hidden="true" />
                        Physical
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={viaDisabled}
                        onClick={() => onSetAttendedVia(entry, "online")}
                      >
                        <WifiIcon aria-hidden="true" />
                        Online
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onClear(entry)}>
                        <RotateCcwIcon aria-hidden="true" />
                        Reset to sample data
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function AttendedViaBadge({ via }: { via: AttendedVia }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {via === "online" ? (
        <WifiIcon
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <MapPinIcon
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      {attendedViaLabels[via]}
    </span>
  )
}

function MarkedViaBadge({ via }: { via: MarkedVia }) {
  if (via === "qr") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 rounded-full border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400"
      >
        <QrCodeIcon aria-hidden="true" />
        {markedViaLabels.qr} self check-in
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 rounded-full">
      <UserRoundCheckIcon aria-hidden="true" />
      {markedViaLabels.manual}
    </Badge>
  )
}

function Field({
  label,
  value,
  icon,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {icon ? (
          <span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>
        ) : null}
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function RosterSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
  tone?: AttendanceStatus
}) {
  const toneClass =
    tone === "present"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "absent"
        ? "bg-destructive/10 text-destructive"
        : tone === "late"
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : tone === "excused"
            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
            : "bg-primary/10 text-primary"

  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-sm [&>svg]:size-4 ${toneClass}`}
        >
          {icon}
        </div>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
