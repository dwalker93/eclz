"use client"

import { useEffect, useState } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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
  AlertTriangleIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  LayoutGridIcon,
  ListIcon,
  MapPinIcon,
  Repeat2Icon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  VideoIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ClassSessionStatusBadge,
  DeliveryModeBadge,
} from "@/components/portal-status-badge"
import { type ParentChild } from "@/lib/parent-portal-data"
import {
  addDays,
  formatShortDate,
  formatTimeRange,
  formatWeekRange,
  getDateParts,
  getWeekDates,
  getWeekStart,
  getWeekday,
  MOCK_TODAY,
  WEEKDAY_LABELS,
  type ClassSession,
  type WeeklyScheduleSlot,
} from "@/lib/student-portal-data"

type TimetableView = "week" | "list"

type SessionEntry = {
  session: ClassSession
  child: ParentChild
}

type SlotEntry = {
  slot: WeeklyScheduleSlot
  child: ParentChild
}

function timesOverlap(
  first: { startsAt: string; endsAt: string },
  second: { startsAt: string; endsAt: string }
) {
  return first.startsAt < second.endsAt && second.startsAt < first.endsAt
}

function isOnlineSession(session: ClassSession) {
  return session.deliveryMode === "Online" || session.deliveryMode === "Hybrid"
}

function getSessionOverlaps(entry: SessionEntry, entries: SessionEntry[]) {
  return entries.filter(
    (other) =>
      other.session.id !== entry.session.id &&
      other.session.date === entry.session.date &&
      timesOverlap(entry.session, other.session)
  )
}

function getSlotOverlaps(entry: SlotEntry, entries: SlotEntry[]) {
  return entries.filter(
    (other) =>
      other.slot.id !== entry.slot.id &&
      other.slot.weekday === entry.slot.weekday &&
      timesOverlap(entry.slot, other.slot)
  )
}

function getOverlapLabel(courseNames: string[], otherChildren: ParentChild[]) {
  if (otherChildren.length > 0) {
    return `Overlaps with ${otherChildren
      .map((item) => item.preferredName)
      .join(" and ")}`
  }

  return `Overlaps with ${courseNames.join(", ")}`
}

export function ParentTimetable() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [compareAll, setCompareAll] = useState(false)
  const [view, setView] = useState<TimetableView>("week")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(MOCK_TODAY))

  // The header child selector stays authoritative: switching children leaves
  // the page-local comparison view and shows only the newly selected child.
  useEffect(() => {
    setCompareAll(false)
  }, [selectedChild?.id])

  const activeChild = compareAll ? null : selectedChild
  const visibleChildren = activeChild ? [activeChild] : linkedChildren

  const currentWeekStart = getWeekStart(MOCK_TODAY)
  const isCurrentWeek = weekStart === currentWeekStart
  const weekDates = getWeekDates(weekStart)

  const weekEntries: SessionEntry[] = visibleChildren
    .flatMap((child) =>
      child.timetable.sessions
        .filter((session) => weekDates.includes(session.date))
        .map((session) => ({ session, child }))
    )
    .sort((first, second) =>
      `${first.session.date}${first.session.startsAt}`.localeCompare(
        `${second.session.date}${second.session.startsAt}`
      )
    )

  const weekSlots: SlotEntry[] = visibleChildren
    .flatMap((child) => child.timetable.slots.map((slot) => ({ slot, child })))
    .sort(
      (first, second) =>
        first.slot.weekday - second.slot.weekday ||
        first.slot.startsAt.localeCompare(second.slot.startsAt)
    )

  function moveWeek(offset: number) {
    setWeekStart((current) => addDays(current, offset))
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Timetable"
          description="Recurring weekly slots and dated class sessions. This parent view is read-only, and online meeting links remain placeholders."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {activeChild
                  ? `Viewing ${activeChild.preferredName}`
                  : "Comparing all children"}
              </Badge>
            </>
          }
          actions={
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {weekEntries.length} dated{" "}
              {weekEntries.length === 1 ? "session" : "sessions"}
            </Badge>
          }
        />

        {linkedChildren.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there is no timetable to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : (
          <>
            <Card className="gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {activeChild ? (
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback>{activeChild.initials}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UsersRoundIcon className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {compareAll ? "Comparing" : "Viewing child"}
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {activeChild
                        ? activeChild.fullName
                        : "All linked children"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activeChild
                        ? `${activeChild.studentNo} · ${activeChild.grade} · ${activeChild.branch} branch`
                        : "Sessions from every linked child. Each event names its child, and overlapping times are marked."}
                    </p>
                  </div>
                </div>
                <Button
                  variant={compareAll ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCompareAll((current) => !current)}
                  aria-pressed={compareAll}
                  className="w-full sm:w-auto"
                >
                  <UsersRoundIcon data-icon="inline-start" aria-hidden="true" />
                  Compare all children
                </Button>
              </CardContent>
              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Comparison only changes this timetable view. The child chosen in
                the header stays active on every other parent page.
              </CardFooter>
            </Card>

            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-semibold tracking-tight">
                  {activeChild
                    ? `${activeChild.fullName}'s timetable`
                    : "All linked children"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeChild
                    ? `${activeChild.studentNo} · ${activeChild.grade} · ${activeChild.branch} branch`
                    : "Sessions from every linked child. Each event names the child, and overlapping times are marked."}
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5 rounded-full">
                <ShieldCheckIcon aria-hidden="true" />
                Read-only
              </Badge>
            </div>

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
                    <LayoutGridIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
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

            {weekEntries.length === 0 ? (
              <Card className="gap-0 py-0">
                <EmptyState
                  icon={
                    <CalendarDaysIcon className="size-5" aria-hidden="true" />
                  }
                  title="No dated sessions this week"
                  description="Dated class sessions have not been added for this week. The recurring weekly slots below still show the usual timetable."
                />
              </Card>
            ) : view === "week" ? (
              <WeekView
                weekDates={weekDates}
                entries={weekEntries}
                showChild={!activeChild}
              />
            ) : (
              <TimetableListView
                entries={weekEntries}
                showChild={!activeChild}
              />
            )}

            <WeeklyScheduleCard slots={weekSlots} showChild={!activeChild} />

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Dated sessions show scheduled, held or cancelled class
                  records. Weekly slots are recurring timetable patterns and are
                  not attendance records. Online meeting controls are
                  placeholders in this demo and do not launch an external
                  meeting. Nothing on this page can be booked, cancelled or
                  rescheduled.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

function WeekView({
  weekDates,
  entries,
  showChild,
}: {
  weekDates: string[]
  entries: SessionEntry[]
  showChild: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {weekDates.map((date) => {
        const dayEntries = entries.filter(
          (entry) => entry.session.date === date
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
              {dayEntries.length === 0 ? (
                <p className="flex flex-1 items-center justify-center py-4 text-center text-xs text-muted-foreground">
                  No dated sessions
                </p>
              ) : (
                dayEntries.map((entry) => (
                  <DatedSessionItem
                    key={entry.session.id}
                    entry={entry}
                    entries={entries}
                    showChild={showChild}
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

function TimetableListView({
  entries,
  showChild,
}: {
  entries: SessionEntry[]
  showChild: boolean
}) {
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
        {entries.map((entry) => {
          const { session, child } = entry
          const dateParts = getDateParts(session.date)
          const overlaps = getSessionOverlaps(entry, entries)
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
                  {showChild ? (
                    <Badge variant="secondary" className="rounded-full">
                      {child.fullName}
                    </Badge>
                  ) : null}
                  {overlaps.length > 0 ? <OverlapBadge /> : null}
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
                  {showChild ? (
                    <span className="inline-flex items-center gap-1">
                      <UsersRoundIcon className="size-3.5" aria-hidden="true" />
                      {child.grade} · {child.branch}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3.5" aria-hidden="true" />
                    {session.branch} · {session.room}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserRoundIcon className="size-3.5" aria-hidden="true" />
                    {session.lecturer}
                  </span>
                </div>
                {overlaps.length > 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {getOverlapLabel(
                      Array.from(
                        new Set(overlaps.map((item) => item.session.courseName))
                      ),
                      Array.from(
                        new Map(
                          overlaps
                            .filter((item) => item.child.id !== child.id)
                            .map((item) => [item.child.id, item.child])
                        ).values()
                      )
                    )}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DeliveryModeBadge mode={session.deliveryMode} />
                  {online ? <OnlineMeetingPlaceholder /> : null}
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
  entry,
  entries,
  showChild,
  compact = false,
}: {
  entry: SessionEntry
  entries: SessionEntry[]
  showChild: boolean
  compact?: boolean
}) {
  const { session, child } = entry
  const overlaps = getSessionOverlaps(entry, entries)
  const online = isOnlineSession(session)

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        session.status === "cancelled" &&
          "border-destructive/20 bg-destructive/5",
        overlaps.length > 0 &&
          session.status !== "cancelled" &&
          "border-amber-600/30 bg-amber-500/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <span className="text-xs font-semibold tabular-nums">
          {formatTimeRange(session.startsAt, session.endsAt)}
        </span>
        <ClassSessionStatusBadge status={session.status} />
      </div>
      {showChild || overlaps.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {showChild ? (
            <Badge variant="secondary" className="rounded-full">
              {child.fullName}
            </Badge>
          ) : null}
          {overlaps.length > 0 ? <OverlapBadge /> : null}
        </div>
      ) : null}
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
        {online ? <OnlineMeetingPlaceholder /> : null}
      </div>
      {overlaps.length > 0 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
          {getOverlapLabel(
            Array.from(
              new Set(overlaps.map((item) => item.session.courseName))
            ),
            Array.from(
              new Map(
                overlaps
                  .filter((item) => item.child.id !== child.id)
                  .map((item) => [item.child.id, item.child])
              ).values()
            )
          )}
        </p>
      ) : null}
      {session.note ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {session.note}
        </p>
      ) : null}
    </div>
  )
}

function WeeklyScheduleCard({
  slots,
  showChild,
}: {
  slots: SlotEntry[]
  showChild: boolean
}) {
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
          {slots.length} slots
        </Badge>
      </CardHeader>

      {slots.length === 0 ? (
        <EmptyState
          icon={<Repeat2Icon className="size-5" aria-hidden="true" />}
          title="No recurring weekly slots"
          description="Recurring class times will appear here when they are added to a linked child's courses."
        />
      ) : (
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
          {slots.map((entry) => (
            <WeeklySlotCard
              key={entry.slot.id}
              entry={entry}
              slots={slots}
              showChild={showChild}
            />
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

function WeeklySlotCard({
  entry,
  slots,
  showChild,
}: {
  entry: SlotEntry
  slots: SlotEntry[]
  showChild: boolean
}) {
  const { slot, child } = entry
  const overlaps = getSlotOverlaps(entry, slots)

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-dashed p-3",
        overlaps.length > 0 && "border-amber-600/40 bg-amber-500/5"
      )}
    >
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
      {showChild ? (
        <p className="text-[11px] font-medium text-muted-foreground">
          {child.fullName}
        </p>
      ) : null}
      <p className="text-sm leading-snug font-medium">{slot.courseName}</p>
      <p className="text-xs text-muted-foreground">
        {slot.subject} · {slot.lecturer}
      </p>
      <p className="text-xs text-muted-foreground">
        {slot.branch} · {slot.room}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <DeliveryModeBadge mode={slot.deliveryMode} />
        {overlaps.length > 0 ? <OverlapBadge /> : null}
      </div>
      {overlaps.length > 0 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
          {getOverlapLabel(
            Array.from(new Set(overlaps.map((item) => item.slot.courseName))),
            Array.from(
              new Map(
                overlaps
                  .filter((item) => item.child.id !== child.id)
                  .map((item) => [item.child.id, item.child])
              ).values()
            )
          )}
        </p>
      ) : null}
    </div>
  )
}

function OverlapBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 rounded-full border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-400"
    >
      <AlertTriangleIcon aria-hidden="true" />
      Overlap
    </Badge>
  )
}

function OnlineMeetingPlaceholder() {
  return (
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
  )
}
