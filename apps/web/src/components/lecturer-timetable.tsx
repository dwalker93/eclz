"use client"

import { useState } from "react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  CalendarDaysIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  InfoIcon,
  LayoutGridIcon,
  ListIcon,
  MapPinIcon,
  Repeat2Icon,
  RotateCcwIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ClassSessionStatusBadge,
  DeliveryModeBadge,
} from "@/components/portal-status-badge"
import {
  addDays,
  formatDisplayDate,
  formatShortDate,
  formatTimeRange,
  formatWeekRange,
  getDateParts,
  getWeekDates,
  getWeekStart,
  getWeekday,
  MOCK_TODAY,
  WEEKDAY_LABELS,
  type ClassSessionStatus,
} from "@/lib/student-portal-data"
import {
  getLecturerCourseById,
  getLecturerCourseClassLabel,
  lecturer,
  lecturerClassSessions,
  lecturerWeeklySlots,
  type LecturerDeliveryMode,
  type LecturerSession,
  type LecturerWeeklySlot,
} from "@/lib/lecturer-portal-data"

type TimetableView = "week" | "list"

function isOnlineDelivery(mode: LecturerDeliveryMode) {
  return mode === "Online" || mode === "Hybrid"
}

function getSessionClassLabel(courseId: string) {
  const course = getLecturerCourseById(courseId)
  return course ? getLecturerCourseClassLabel(course) : "Class"
}

export function LecturerTimetable() {
  const [view, setView] = useState<TimetableView>("week")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(MOCK_TODAY))
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ClassSessionStatus>
  >({})
  const [selectedSession, setSelectedSession] = useState<LecturerSession | null>(
    null
  )

  const currentWeekStart = getWeekStart(MOCK_TODAY)
  const isCurrentWeek = weekStart === currentWeekStart
  const weekDates = getWeekDates(weekStart)
  const weekSessions = lecturerClassSessions
    .filter((session) => weekDates.includes(session.date))
    .sort((first, second) =>
      `${first.date}${first.startsAt}`.localeCompare(
        `${second.date}${second.startsAt}`
      )
    )

  const scheduledCount = weekSessions.filter(
    (session) => statusFor(session) === "scheduled"
  ).length
  const heldCount = weekSessions.filter(
    (session) => statusFor(session) === "held"
  ).length
  const cancelledCount = weekSessions.filter(
    (session) => statusFor(session) === "cancelled"
  ).length

  function statusFor(session: LecturerSession): ClassSessionStatus {
    return statusOverrides[session.id] ?? session.status
  }

  function moveWeek(offset: number) {
    setWeekStart((current) => addDays(current, offset))
  }

  function markHeld(sessionId: string) {
    setStatusOverrides((current) => ({ ...current, [sessionId]: "held" }))
  }

  function resetStatus(sessionId: string) {
    setStatusOverrides((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Timetable & Sessions"
          description={`Your recurring weekly slots and dated class sessions for ${lecturer.fullName}. Only your own courses appear here, and every record is local sample data.`}
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Lecturer portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.designation}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.branch} branch
              </Badge>
            </>
          }
          actions={
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {weekSessions.length} dated{" "}
              {weekSessions.length === 1 ? "session" : "sessions"}
            </Badge>
          }
        />

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div
              role="group"
              aria-label="Timetable view"
              className="flex w-fit rounded-md border p-0.5"
            >
              <Button
                variant={view === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("week")}
                aria-pressed={view === "week"}
              >
                <LayoutGridIcon data-icon="inline-start" aria-hidden="true" />
                Week
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
              >
                <ListIcon data-icon="inline-start" aria-hidden="true" />
                List
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => moveWeek(-7)}
                  aria-label="Previous week"
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => moveWeek(7)}
                  aria-label="Next week"
                >
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </div>
              <span
                aria-live="polite"
                className="text-sm font-medium tabular-nums"
              >
                {formatWeekRange(weekStart)}
              </span>
              <Button
                variant={isCurrentWeek ? "secondary" : "outline"}
                size="sm"
                onClick={() => setWeekStart(currentWeekStart)}
                aria-pressed={isCurrentWeek}
              >
                Today
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
            <span>This week:</span>
            <span className="inline-flex items-center gap-1">
              <ClassSessionStatusBadge status="scheduled" />
              {scheduledCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClassSessionStatusBadge status="held" />
              {heldCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClassSessionStatusBadge status="cancelled" />
              {cancelledCount}
            </span>
          </CardFooter>
        </Card>

        {weekSessions.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<CalendarDaysIcon className="size-5" aria-hidden="true" />}
              title="No dated sessions this week"
              description="Dated class sessions have not been added for this week. Your recurring weekly slots are listed below so you can still see the usual teaching pattern."
            />
          </Card>
        ) : view === "week" ? (
          <WeekView
            weekDates={weekDates}
            weekSessions={weekSessions}
            statusFor={statusFor}
            onOpenSession={setSelectedSession}
          />
        ) : (
          <TimetableListView
            sessions={weekSessions}
            statusFor={statusFor}
            onOpenSession={setSelectedSession}
          />
        )}

        <WeeklySlotsCard />

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Dated sessions show scheduled, held or cancelled class records.
              Weekly slots are recurring timetable patterns and are not
              attendance records. Any status change, such as marking a session
              held, is a local preview only: it does not create or update a
              session, and no online meeting link is created.
            </p>
          </CardContent>
        </Card>
      </div>

      <SessionDetailsDialog
        session={selectedSession}
        status={selectedSession ? statusFor(selectedSession) : "scheduled"}
        hasOverride={
          selectedSession !== null &&
          statusOverrides[selectedSession.id] !== undefined
        }
        onMarkHeld={markHeld}
        onReset={resetStatus}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null)
        }}
      />
    </main>
  )
}

function WeekView({
  weekDates,
  weekSessions,
  statusFor,
  onOpenSession,
}: {
  weekDates: string[]
  weekSessions: LecturerSession[]
  statusFor: (session: LecturerSession) => ClassSessionStatus
  onOpenSession: (session: LecturerSession) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {weekDates.map((date) => {
        const daySessions = weekSessions.filter(
          (session) => session.date === date
        )
        const isToday = date === MOCK_TODAY
        const dateParts = getDateParts(date)

        return (
          <Card
            key={date}
            className={cn("gap-0 py-0", isToday && "ring-2 ring-primary/25")}
          >
            <CardHeader className="border-b px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {WEEKDAY_LABELS[getWeekday(date)].slice(0, 3)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {dateParts.day} {dateParts.month}
                  </p>
                </div>
                {isToday ? (
                  <Badge variant="secondary" className="rounded-full">
                    Today
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2 p-2.5">
              {daySessions.length === 0 ? (
                <p className="flex flex-1 items-center justify-center py-4 text-center text-xs text-muted-foreground">
                  No dated sessions
                </p>
              ) : (
                daySessions.map((session) => (
                  <DatedSessionItem
                    key={session.id}
                    session={session}
                    status={statusFor(session)}
                    onOpen={() => onOpenSession(session)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function TimetableListView({
  sessions,
  statusFor,
  onOpenSession,
}: {
  sessions: LecturerSession[]
  statusFor: (session: LecturerSession) => ClassSessionStatus
  onOpenSession: (session: LecturerSession) => void
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <ListIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Dated class sessions
        </CardTitle>
        <CardDescription>
          Chronological records for the selected week. Open a session for its
          details.
        </CardDescription>
      </CardHeader>
      <ul className="divide-y">
        {sessions.map((session) => {
          const dateParts = getDateParts(session.date)
          const status = statusFor(session)

          return (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onOpenSession(session)}
                className="grid w-full gap-3 px-4 py-4 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-[auto_minmax(0,1fr)] sm:px-6"
              >
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40">
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {dateParts.month}
                  </span>
                  <span className="text-lg leading-none font-semibold tabular-nums">
                    {dateParts.day}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{session.courseName}</p>
                    <ClassSessionStatusBadge status={status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(session.date)} ·{" "}
                    {formatTimeRange(session.startsAt, session.endsAt)} ·{" "}
                    {getSessionClassLabel(session.courseId)}
                  </p>
                  <p className="text-sm">{session.topic}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon className="size-3.5" aria-hidden="true" />
                      {session.branch} · {session.room}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <DeliveryModeBadge mode={session.deliveryMode} />
                    {isOnlineDelivery(session.deliveryMode) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <VideoIcon className="size-3.5" aria-hidden="true" />
                        Institute online classroom (placeholder)
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Dated sessions are read-only class records. Recurring weekly slots are
        shown separately below.
      </CardFooter>
    </Card>
  )
}

function DatedSessionItem({
  session,
  status,
  onOpen,
}: {
  session: LecturerSession
  status: ClassSessionStatus
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "rounded-lg border p-2.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
        status === "cancelled" && "border-destructive/20 bg-destructive/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <span className="text-xs font-semibold tabular-nums">
          {formatTimeRange(session.startsAt, session.endsAt)}
        </span>
        <ClassSessionStatusBadge status={status} />
      </div>
      <p className="mt-1.5 text-sm leading-snug font-medium">
        {session.courseName}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {session.topic}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3" aria-hidden="true" />
          {session.branch} · {session.room}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <DeliveryModeBadge mode={session.deliveryMode} />
      </div>
    </button>
  )
}

function WeeklySlotsCard() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="flex items-center gap-2">
            <Repeat2Icon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Weekly recurring slots
          </CardTitle>
          <CardDescription>
            Usual weekly pattern, separate from dated class sessions
          </CardDescription>
        </div>
        <Badge variant="outline" className="rounded-full">
          {lecturerWeeklySlots.length} slots
        </Badge>
      </CardHeader>

      {lecturerWeeklySlots.length === 0 ? (
        <EmptyState
          icon={<Repeat2Icon className="size-5" aria-hidden="true" />}
          title="No recurring weekly slots"
          description="Recurring class times will appear here when they are added to your assigned courses."
        />
      ) : (
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
          {lecturerWeeklySlots.map((slot) => (
            <WeeklySlotCard key={slot.id} slot={slot} />
          ))}
        </CardContent>
      )}

      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Recurring slots show the usual weekly times. Dated sessions above are
        the confirmed class records.
      </CardFooter>
    </Card>
  )
}

function WeeklySlotCard({ slot }: { slot: LecturerWeeklySlot }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-medium">
          {WEEKDAY_LABELS[slot.weekday]}
        </span>
        <Badge variant="outline" className="gap-1 rounded-full">
          <Repeat2Icon aria-hidden="true" />
          Weekly slot
        </Badge>
      </div>
      <p className="text-sm font-semibold tabular-nums">
        {formatTimeRange(slot.startsAt, slot.endsAt)}
      </p>
      <p className="text-sm leading-snug font-medium">{slot.courseName}</p>
      <p className="text-xs text-muted-foreground">
        {slot.subject} · {slot.classLabel}
      </p>
      <p className="text-xs text-muted-foreground">
        {slot.branch} · {slot.room}
      </p>
      {slot.onlineProvider ? (
        <p className="text-xs text-muted-foreground">{slot.onlineProvider}</p>
      ) : null}
      <div className="mt-1">
        <DeliveryModeBadge mode={slot.deliveryMode} />
      </div>
    </div>
  )
}

function SessionDetailsDialog({
  session,
  status,
  hasOverride,
  onMarkHeld,
  onReset,
  onOpenChange,
}: {
  session: LecturerSession | null
  status: ClassSessionStatus
  hasOverride: boolean
  onMarkHeld: (sessionId: string) => void
  onReset: (sessionId: string) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      {session ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <ClassSessionStatusBadge status={status} />
              <DeliveryModeBadge mode={session.deliveryMode} />
            </div>
            <DialogTitle className="text-lg">{session.courseName}</DialogTitle>
            <DialogDescription>
              {getSessionClassLabel(session.courseId)} · {session.subject}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 text-sm">
            <DetailRow
              icon={CalendarDaysIcon}
              label="Date"
              value={formatDisplayDate(session.date)}
            />
            <DetailRow
              icon={CalendarClockIcon}
              label="Time"
              value={formatTimeRange(session.startsAt, session.endsAt)}
            />
            <DetailRow
              icon={MapPinIcon}
              label="Branch and room"
              value={`${session.branch} · ${session.room}`}
            />
            {isOnlineDelivery(session.deliveryMode) ? (
              <DetailRow
                icon={VideoIcon}
                label="Online provider"
                value="Institute online classroom (placeholder)"
              />
            ) : null}
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Topic</span>
            <span className="text-sm">{session.topic}</span>
          </div>

          {isOnlineDelivery(session.deliveryMode) ? (
            <Button
              variant="outline"
              disabled
              title="Online meeting links are not created in this demo"
              aria-label="Open online classroom (unavailable in this demo)"
              className="w-full"
            >
              <VideoIcon data-icon="inline-start" aria-hidden="true" />
              Open online classroom (placeholder)
            </Button>
          ) : null}

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Local demo control</span>
              {hasOverride ? (
                <Badge variant="secondary" className="rounded-full">
                  Local change
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              You can preview marking this session as held. This is a local
              preview only — the session record is not updated and nothing is
              saved.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {status === "scheduled" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMarkHeld(session.id)}
                >
                  <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
                  Mark held (demo)
                </Button>
              ) : null}
              {hasOverride ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReset(session.id)}
                >
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Undo local change
                </Button>
              ) : null}
            </div>
            {status !== "scheduled" && !hasOverride ? (
              <p className="text-xs text-muted-foreground">
                This session is already{" "}
                {status === "held" ? "marked as held" : "cancelled"} in the
                sample records.
              </p>
            ) : null}
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
    </div>
  )
}
