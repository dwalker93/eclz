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
import { cn } from "@workspace/ui/lib/utils"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  LayoutGridIcon,
  ListIcon,
  MapPinIcon,
  Repeat2Icon,
  UserRoundIcon,
  VideoIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ClassSessionStatusBadge,
  DeliveryModeBadge,
} from "@/components/portal-status-badge"
import {
  addDays,
  classSessions,
  formatShortDate,
  formatTimeRange,
  formatWeekRange,
  getDateParts,
  getWeekDates,
  getWeekStart,
  getWeekday,
  MOCK_TODAY,
  student,
  WEEKDAY_LABELS,
  weeklyScheduleSlots,
  type ClassSession,
  type WeeklyScheduleSlot,
} from "@/lib/student-portal-data"

type TimetableView = "week" | "list"

function getSessionsForWeek(weekStart: string) {
  const weekDates = getWeekDates(weekStart)

  return classSessions
    .filter((session) => weekDates.includes(session.date))
    .sort((first, second) =>
      `${first.date}${first.startsAt}`.localeCompare(
        `${second.date}${second.startsAt}`
      )
    )
}

function getSessionsForDay(date: string) {
  return classSessions
    .filter((session) => session.date === date)
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt))
}

function isOnlineSession(session: ClassSession) {
  return session.deliveryMode === "Online" || session.deliveryMode === "Hybrid"
}

export function StudentTimetable() {
  const [view, setView] = useState<TimetableView>("week")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(MOCK_TODAY))

  const currentWeekStart = getWeekStart(MOCK_TODAY)
  const isCurrentWeek = weekStart === currentWeekStart
  const weekDates = getWeekDates(weekStart)
  const weekSessions = getSessionsForWeek(weekStart)

  function moveWeek(offset: number) {
    setWeekStart((current) => addDays(current, offset))
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Timetable"
          description="Your dated class sessions and recurring weekly slots for the selected week. All records on this page are local sample data."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Student portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {student.grade} · {student.branch}
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
        </Card>

        {weekSessions.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<CalendarDaysIcon className="size-5" aria-hidden="true" />}
              title="No dated sessions this week"
              description="Dated class sessions have not been added for this week. Your recurring weekly slots are listed below so you can still see the usual timetable."
            />
          </Card>
        ) : view === "week" ? (
          <WeekView weekDates={weekDates} />
        ) : (
          <TimetableListView sessions={weekSessions} />
        )}

        <WeeklyScheduleCard />

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Dated sessions show scheduled, held or cancelled class records.
              Weekly slots are recurring timetable patterns and are not
              attendance records. Online meeting controls are placeholders in
              this demo and do not launch an external meeting.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function WeekView({ weekDates }: { weekDates: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {weekDates.map((date) => {
        const daySessions = getSessionsForDay(date)
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
                    compact
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

function TimetableListView({ sessions }: { sessions: ClassSession[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <ListIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Dated class sessions
        </CardTitle>
        <CardDescription>
          Chronological records for the selected week
        </CardDescription>
      </CardHeader>
      <ul className="divide-y">
        {sessions.map((session) => {
          const dateParts = getDateParts(session.date)
          const online = isOnlineSession(session)

          return (
            <li
              key={session.id}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-6"
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
                  <ClassSessionStatusBadge status={session.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatShortDate(session.date)} ·{" "}
                  {formatTimeRange(session.startsAt, session.endsAt)} ·{" "}
                  {session.subject}
                </p>
                {session.topic ? (
                  <p className="text-sm">{session.topic}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Topic not published
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3.5" aria-hidden="true" />
                    {session.branch} · {session.room}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserRoundIcon className="size-3.5" aria-hidden="true" />
                    {session.lecturer}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DeliveryModeBadge mode={session.deliveryMode} />
                  {online ? (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled
                      title="Online meeting links are not available in this demo"
                      aria-label="Join online class (unavailable in this demo)"
                    >
                      <VideoIcon data-icon="inline-start" aria-hidden="true" />
                      Join online class
                    </Button>
                  ) : null}
                </div>
                {session.note ? (
                  <p className="mt-1 rounded-lg bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground">
                    {session.note}
                  </p>
                ) : null}
              </div>
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
  compact = false,
}: {
  session: ClassSession
  compact?: boolean
}) {
  const online = isOnlineSession(session)

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        session.status === "cancelled" &&
          "border-destructive/20 bg-destructive/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <span className="text-xs font-semibold tabular-nums">
          {formatTimeRange(session.startsAt, session.endsAt)}
        </span>
        <ClassSessionStatusBadge status={session.status} />
      </div>
      <p className="mt-1.5 text-sm leading-snug font-medium">
        {session.courseName}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {session.topic ?? "Topic not published"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3" aria-hidden="true" />
          {session.branch} · {session.room}
        </span>
        {!compact ? (
          <span className="inline-flex items-center gap-1">
            <UserRoundIcon className="size-3" aria-hidden="true" />
            {session.lecturer}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <DeliveryModeBadge mode={session.deliveryMode} />
        {online ? (
          <Button
            variant="outline"
            size="xs"
            disabled
            title="Online meeting links are not available in this demo"
            aria-label="Join online class (unavailable in this demo)"
          >
            <VideoIcon data-icon="inline-start" aria-hidden="true" />
            Join online
          </Button>
        ) : null}
      </div>
      {session.note ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {session.note}
        </p>
      ) : null}
    </div>
  )
}

function WeeklyScheduleCard() {
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
          {weeklyScheduleSlots.length} slots
        </Badge>
      </CardHeader>

      {weeklyScheduleSlots.length === 0 ? (
        <EmptyState
          icon={<Repeat2Icon className="size-5" aria-hidden="true" />}
          title="No recurring weekly slots"
          description="Recurring class times will appear here when they are added to your courses."
        />
      ) : (
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
          {weeklyScheduleSlots.map((slot) => (
            <WeeklySlotCard key={slot.id} slot={slot} />
          ))}
        </CardContent>
      )}

      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Recurring slots show the usual weekly times. Dated sessions above are
        the confirmed class records and the source for attendance.
      </CardFooter>
    </Card>
  )
}

function WeeklySlotCard({ slot }: { slot: WeeklyScheduleSlot }) {
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
        {slot.subject} · {slot.lecturer}
      </p>
      <p className="text-xs text-muted-foreground">
        {slot.branch} · {slot.room}
      </p>
      <div className="mt-1">
        <DeliveryModeBadge mode={slot.deliveryMode} />
      </div>
    </div>
  )
}
