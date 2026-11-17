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
  CalendarClockIcon,
  CalendarDaysIcon,
  ClockIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  LayoutGridIcon,
  ListIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { SessionStatusBadge } from "@/components/timetable/session-status-badge"
import { SlotDetailSheet } from "@/components/timetable/slot-detail-sheet"
import { SlotFormDialog } from "@/components/timetable/slot-form-dialog"
import {
  courseKindLabels,
  deliveryModeLabels,
  formatTimeValue,
  type CourseRecord,
} from "@/lib/courses-data"
import { formatDisplayDate, MOCK_TODAY } from "@/lib/students-data"
import {
  getTimetableUsage,
  timetableBranchFilterOptions,
  timetableCourseFilterOptions,
  timetableDeliveryFilterOptions,
  timetableGradeFilterOptions,
  timetableLecturerFilterOptions,
  timetableSessions,
  timetableSlots,
  timetableWeekdays,
  type TimetableSessionRecord,
  type TimetableSlotRecord,
} from "@/lib/timetable-data"

type TimetableView = "week" | "list"
type SessionTab = "upcoming" | "past"

export function TimetableDirectory() {
  const [view, setView] = useState<TimetableView>("week")
  const [sessionTab, setSessionTab] = useState<SessionTab>("upcoming")
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [deliveryFilter, setDeliveryFilter] = useState("all")
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlotRecord | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<TimetableSlotRecord | null>(
    null
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Timetable refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    branchFilter !== "all" ||
    courseFilter !== "all" ||
    gradeFilter !== "all" ||
    lecturerFilter !== "all" ||
    deliveryFilter !== "all"

  const courseMatchesFilters = useMemo(() => {
    return (course: CourseRecord) => {
      if (branchFilter !== "all" && course.branchId !== branchFilter) {
        return false
      }
      if (courseFilter !== "all" && course.id !== courseFilter) {
        return false
      }
      if (gradeFilter !== "all" && !course.gradeIds.includes(gradeFilter)) {
        return false
      }
      if (
        lecturerFilter !== "all" &&
        !course.lecturers.some(
          (lecturer) => lecturer.lecturerId === lecturerFilter
        )
      ) {
        return false
      }
      if (deliveryFilter !== "all" && course.deliveryMode !== deliveryFilter) {
        return false
      }
      return true
    }
  }, [branchFilter, courseFilter, gradeFilter, lecturerFilter, deliveryFilter])

  const filteredSlots = useMemo(() => {
    return timetableSlots.filter((slot) => {
      if (!courseMatchesFilters(slot.course)) return false

      if (query.length === 0) return true

      return [
        slot.course.name,
        slot.subjectName,
        slot.branchName,
        slot.room ?? "",
        slot.lecturerNames.join(" "),
        slot.gradeNames.join(" "),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [courseMatchesFilters, query])

  const filteredSessions = useMemo(() => {
    return timetableSessions.filter((session) => {
      if (!courseMatchesFilters(session.course)) return false

      if (query.length === 0) return true

      return [
        session.course.name,
        session.course.subjectName,
        session.topic,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [courseMatchesFilters, query])

  const sessionsForTab = useMemo(() => {
    if (sessionTab === "upcoming") {
      return filteredSessions
        .filter((session) => session.sessionDate >= MOCK_TODAY)
        .sort(
          (left, right) =>
            left.sessionDate.localeCompare(right.sessionDate) ||
            left.startsAt.localeCompare(right.startsAt)
        )
    }

    return filteredSessions
      .filter((session) => session.sessionDate < MOCK_TODAY)
      .sort(
        (left, right) =>
          right.sessionDate.localeCompare(left.sessionDate) ||
          left.startsAt.localeCompare(right.startsAt)
      )
  }, [filteredSessions, sessionTab])

  const usage = getTimetableUsage()

  function clearFilters() {
    setSearch("")
    setBranchFilter("all")
    setCourseFilter("all")
    setGradeFilter("all")
    setLecturerFilter("all")
    setDeliveryFilter("all")
  }

  function openSlot(slot: TimetableSlotRecord) {
    setSelectedSlot(slot)
    setDetailOpen(true)
  }

  function openCreate() {
    setEditingSlot(null)
    setFormOpen(true)
  }

  function openEdit(slot: TimetableSlotRecord) {
    setSelectedSlot(null)
    setDetailOpen(false)
    setEditingSlot(slot)
    setFormOpen(true)
  }

  async function copyCourseName(course: CourseRecord) {
    try {
      await navigator.clipboard.writeText(course.name)
      setNotice(`${course.name} copied to the clipboard.`)
    } catch {
      setNotice(`Course: ${course.name}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Weekly class schedule from recurring <code>schedule_slot</code>{" "}
              templates, with a separate view of dated{" "}
              <code>class_session</code> records. Weekly slots are templates;
              they are never attendance events. All records on this page are
              sample data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              Add slot
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<CalendarClockIcon aria-hidden="true" />}
            value={usage.slots}
            label="Weekly slots"
            hint="Recurring templates"
          />
          <SummaryCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={usage.courses}
            label="Scheduled courses"
            hint="Classes and programs with slots"
          />
          <SummaryCard
            icon={<Building2Icon aria-hidden="true" />}
            value={usage.branches}
            label="Branches"
            hint="Branches with scheduled classes"
          />
          <SummaryCard
            icon={<CalendarDaysIcon aria-hidden="true" />}
            value={usage.upcomingSessions}
            label="Upcoming sessions"
            hint={`${usage.cancelledSessions} of all sessions cancelled`}
          />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Filters</span>
                <span className="text-xs text-muted-foreground">
                  Apply to both the weekly schedule and the session list.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Reset
              </Button>
            </div>

            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by course, subject, teacher, grade or room"
                aria-label="Search the timetable"
                className="pl-8"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Select
                items={timetableBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timetableBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={timetableCourseFilterOptions}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by course">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timetableCourseFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={timetableGradeFilterOptions}
                value={gradeFilter}
                onValueChange={(value) => setGradeFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timetableGradeFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={timetableLecturerFilterOptions}
                value={lecturerFilter}
                onValueChange={(value) => setLecturerFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by teacher"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timetableLecturerFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={timetableDeliveryFilterOptions}
                value={deliveryFilter}
                onValueChange={(value) => setDeliveryFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by delivery mode"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timetableDeliveryFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>Weekly schedule</CardTitle>
              <CardDescription>
                {filteredSlots.length}{" "}
                {filteredSlots.length === 1 ? "slot" : "slots"} match the
                current filters, ordered by day and start time.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Timetable view"
                className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
              >
                <Button
                  role="tab"
                  aria-selected={view === "week"}
                  variant={view === "week" ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setView("week")}
                >
                  <LayoutGridIcon data-icon="inline-start" />
                  Week
                </Button>
                <Button
                  role="tab"
                  aria-selected={view === "list"}
                  variant={view === "list" ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setView("list")}
                >
                  <ListIcon data-icon="inline-start" />
                  List
                </Button>
              </div>
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

          {isRefreshing ? (
            <TimetableSkeleton view={view} />
          ) : filteredSlots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarClockIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  No weekly slots match these filters
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Self-paced programs have no weekly schedule. Try a different
                  branch, course, grade, teacher or delivery filter.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : view === "week" ? (
            <WeekGrid slots={filteredSlots} onOpen={openSlot} />
          ) : (
            <SlotListTable
              slots={filteredSlots}
              onOpen={openSlot}
              onEdit={openEdit}
              onCopy={copyCourseName}
            />
          )}
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>Class sessions</CardTitle>
              <CardDescription>
                Dated sessions with topic, mode and link status. Filters above
                also apply here.
              </CardDescription>
            </div>
            <div
              role="tablist"
              aria-label="Session period"
              className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
            >
              <Button
                role="tab"
                aria-selected={sessionTab === "upcoming"}
                variant={sessionTab === "upcoming" ? "outline" : "ghost"}
                size="sm"
                onClick={() => setSessionTab("upcoming")}
              >
                Upcoming
              </Button>
              <Button
                role="tab"
                aria-selected={sessionTab === "past"}
                variant={sessionTab === "past" ? "outline" : "ghost"}
                size="sm"
                onClick={() => setSessionTab("past")}
              >
                Past
              </Button>
            </div>
          </CardHeader>

          {isRefreshing ? (
            <SessionSkeleton />
          ) : sessionsForTab.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarDaysIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {sessionTab === "upcoming"
                    ? "No upcoming sessions"
                    : "No past sessions"}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Sessions come from <code>class_session</code>. Weekly slots
                  are recurring templates, not attendance events.
                </p>
              </div>
            </div>
          ) : (
            <SessionTable
              sessions={sessionsForTab}
              onView={(session) =>
                setNotice(
                  `“${session.topic}” on ${formatDisplayDate(session.sessionDate)} is a read-only sample session. Attendance is managed on the Attendance page.`
                )
              }
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Weekly slots show when a class normally meets; sessions are the
              actual dated occurrences. Meeting-link status and statuses are
              sample data. No attendance, messaging or saving happens here.
            </span>
          </div>
        </Card>
      </div>

      <SlotDetailSheet
        slot={selectedSlot}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />

      <SlotFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        slot={editingSlot}
        onSaved={(message) => setNotice(message)}
      />
    </main>
  )
}

function WeekGrid({
  slots,
  onOpen,
}: {
  slots: TimetableSlotRecord[]
  onOpen: (slot: TimetableSlotRecord) => void
}) {
  return (
    <div className="overflow-x-auto p-4 sm:p-6">
      <div className="grid min-w-[1000px] grid-cols-7 gap-2">
        {timetableWeekdays.map((day) => {
          const daySlots = slots.filter((slot) => slot.weekday === day.value)

          return (
            <div key={day.value} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                <span className="text-xs font-semibold">{day.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {daySlots.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {daySlots.length > 0 ? (
                  daySlots.map((slot) => (
                    <SlotCard key={slot.id} slot={slot} onOpen={onOpen} />
                  ))
                ) : (
                  <div className="flex min-h-20 items-center justify-center rounded-md border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">
                    No slots
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlotCard({
  slot,
  onOpen,
}: {
  slot: TimetableSlotRecord
  onOpen: (slot: TimetableSlotRecord) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(slot)}
      className="flex flex-col gap-1.5 rounded-md border bg-card p-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums">
        <ClockIcon className="size-3.5" aria-hidden="true" />
        {formatTimeValue(slot.startsAt)} – {formatTimeValue(slot.endsAt)}
      </span>
      <span className="line-clamp-2 text-sm font-medium">
        {slot.course.name}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {courseKindLabels[slot.course.kind]} · {slot.subjectName}
        {slot.lecturerNames.length > 0 ? ` · ${slot.lecturerNames[0]}` : ""}
      </span>
      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
        <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {slot.branchName}
        {slot.room ? ` · ${slot.room}` : ""}
      </span>
      <Badge variant="outline" className="w-fit rounded-full text-xs">
        {deliveryModeLabels[slot.deliveryMode]}
      </Badge>
    </button>
  )
}

function SlotListTable({
  slots,
  onOpen,
  onEdit,
  onCopy,
}: {
  slots: TimetableSlotRecord[]
  onOpen: (slot: TimetableSlotRecord) => void
  onEdit: (slot: TimetableSlotRecord) => void
  onCopy: (course: CourseRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Day
          </TableHead>
          <TableHead className="text-muted-foreground">Time</TableHead>
          <TableHead className="text-muted-foreground">Course</TableHead>
          <TableHead className="text-muted-foreground">Subject</TableHead>
          <TableHead className="text-muted-foreground">Teacher</TableHead>
          <TableHead className="text-muted-foreground">Branch</TableHead>
          <TableHead className="text-muted-foreground">Room</TableHead>
          <TableHead className="text-muted-foreground">Delivery</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slots.map((slot) => (
          <TableRow key={slot.id}>
            <TableCell className="py-3 pl-4 font-medium sm:pl-6">
              {slot.weekdayName}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatTimeValue(slot.startsAt)} – {formatTimeValue(slot.endsAt)}
            </TableCell>
            <TableCell>
              <button
                type="button"
                onClick={() => onOpen(slot)}
                className="w-fit max-w-[220px] truncate text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {slot.course.name}
              </button>
              <div className="text-xs text-muted-foreground">
                {courseKindLabels[slot.course.kind]}
                {slot.gradeNames.length > 0
                  ? ` · ${slot.gradeNames.join(", ")}`
                  : ""}
              </div>
            </TableCell>
            <TableCell>{slot.subjectName}</TableCell>
            <TableCell>
              {slot.lecturerNames.length > 0
                ? slot.lecturerNames.join(", ")
                : "—"}
            </TableCell>
            <TableCell>{slot.branchName}</TableCell>
            <TableCell className="text-muted-foreground">
              {slot.room ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="rounded-full">
                {deliveryModeLabels[slot.deliveryMode]}
              </Badge>
            </TableCell>
            <TableCell className="pr-4 text-right sm:pr-6">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${slot.course.name} on ${slot.weekdayName}`}
                    />
                  }
                >
                  <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {slot.weekdayName} · {formatTimeValue(slot.startsAt)}
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onOpen(slot)}>
                      <EyeIcon aria-hidden="true" />
                      View slot details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(slot)}>
                      <PencilIcon aria-hidden="true" />
                      Edit slot (demo)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCopy(slot.course)}>
                      <CopyIcon aria-hidden="true" />
                      Copy course name
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SessionTable({
  sessions,
  onView,
}: {
  sessions: TimetableSessionRecord[]
  onView: (session: TimetableSessionRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Date
          </TableHead>
          <TableHead className="text-muted-foreground">Time</TableHead>
          <TableHead className="text-muted-foreground">Course</TableHead>
          <TableHead className="text-muted-foreground">Topic</TableHead>
          <TableHead className="text-muted-foreground">Mode and link</TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="py-3 pl-4 font-medium sm:pl-6">
              {formatDisplayDate(session.sessionDate)}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatTimeValue(session.startsAt)} –{" "}
              {formatTimeValue(session.endsAt)}
            </TableCell>
            <TableCell>
              <div className="max-w-[220px] truncate">
                {session.course.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {session.course.subjectName} · {session.course.branchName}
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-[260px] truncate" title={session.topic}>
                {session.topic}
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {sessionLinkLabel(session)}
            </TableCell>
            <TableCell>
              <SessionStatusBadge status={session.status} />
            </TableCell>
            <TableCell className="pr-4 text-right sm:pr-6">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onView(session)}
                aria-label={`View session on ${formatDisplayDate(
                  session.sessionDate
                )}`}
              >
                <EyeIcon className="size-4" aria-hidden="true" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function sessionLinkLabel(session: TimetableSessionRecord) {
  const mode = deliveryModeLabels[session.deliveryMode]

  if (session.status === "cancelled") {
    return `${mode} · link withdrawn`
  }

  if (session.meetingProvider === "zoom") {
    return `${mode} · Zoom link ready`
  }

  if (session.meetingProvider === "teams") {
    return `${mode} · Teams link ready`
  }

  return `${mode} · no meeting link`
}

function TimetableSkeleton({ view }: { view: TimetableView }) {
  if (view === "week") {
    return (
      <div className="overflow-x-auto p-4 sm:p-6">
        <div className="grid min-w-[1000px] grid-cols-7 gap-2">
          {timetableWeekdays.map((day) => (
            <div key={day.value} className="flex flex-col gap-2">
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <SlotListSkeleton />
}

function SlotListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function SessionSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-5 w-24 rounded-full" />
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
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
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
