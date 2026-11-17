"use client"

import { useState } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
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
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BanIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClockIcon,
  FileCheck2Icon,
  HandCoinsIcon,
  InfoIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  PresentationIcon,
  TriangleAlertIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ClassSessionStatusBadge,
  ExamModeBadge,
  ExamResultStateBadge,
  LecturerExamStatusBadge,
  LecturerPayoutStatusBadge,
} from "@/components/portal-status-badge"
import {
  getLecturerCourseTermLabel,
  getLecturerDaysUntil,
  getLecturerThreadLastMessage,
  getLecturerThreadLastMessageAt,
  getLecturerThreadOtherParticipants,
  getLecturerThreadUnreadCount,
  LECTURER_MESSAGE_SENDER_ID,
  lecturer,
  lecturerAttendanceAttention,
  lecturerAttendanceSummary,
  lecturerCourses,
  lecturerEarnings,
  lecturerMessageThreads,
  lecturerModules,
  lecturerNextSession,
  lecturerNotices,
  lecturerResultsPending,
  lecturerStats,
  lecturerUpcomingExams,
  lecturerUpcomingSessions,
  type LecturerNotice,
} from "@/lib/lecturer-portal-data"
import {
  formatDisplayDate,
  formatLkr,
  formatShortDate,
  formatTimeRange,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

export function LecturerDashboard() {
  const [commissionsEnabled, setCommissionsEnabled] = useState<boolean>(
    lecturerModules.commissions
  )
  const [readNoticeIds, setReadNoticeIds] = useState(
    () => new Set<string>([lecturerNotices[1]?.id ?? ""])
  )
  const [selectedNotice, setSelectedNotice] = useState<LecturerNotice | null>(
    null
  )

  const unreadNoticeCount = lecturerNotices.filter(
    (notice) => !readNoticeIds.has(notice.id)
  ).length

  function openNotice(notice: LecturerNotice) {
    setSelectedNotice(notice)
    setReadNoticeIds((current) => {
      const next = new Set(current)
      next.add(notice.id)
      return next
    })
  }

  const upcomingAfterNext = lecturerUpcomingSessions.slice(1, 4)

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Lecturer Dashboard"
          description="Your teaching overview: next session, assigned courses, attendance to follow up, exams and results, and recent notices and messages. Sample data only — nothing here is saved or sent."
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
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
            <Avatar size="lg" className="size-16">
              <AvatarFallback className="text-lg">
                {lecturer.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  Welcome, {lecturer.preferredName}
                </h2>
                <Badge
                  variant={lecturer.portalEnabled ? "secondary" : "outline"}
                  className="gap-1.5 rounded-full"
                >
                  {lecturer.portalEnabled ? (
                    <BadgeCheckIcon aria-hidden="true" />
                  ) : null}
                  {lecturer.portalEnabled
                    ? "Lecturer portal enabled"
                    : "Portal not enabled"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {lecturer.fullName} · {lecturer.lecturerNo}
              </p>
              <p className="text-sm text-muted-foreground">
                {lecturer.qualification}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModuleStateBadge
                label="Commissions"
                enabled={lecturerModules.commissions}
              />
              <ModuleStateBadge
                label="Online exams"
                enabled={lecturerModules.onlineExams}
              />
              <ModuleStateBadge
                label="Parent portal"
                enabled={lecturerModules.parentPortal}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Module and portal states above are local demo flags. No module check
            or authorization is connected.
          </CardFooter>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={PresentationIcon}
            label="Courses taught"
            value={String(lecturerStats.coursesTaught)}
            hint="Active assignments"
          />
          <StatTile
            icon={UsersIcon}
            label="Students taught"
            value={String(lecturerStats.studentsTaught)}
            hint="Across your courses"
          />
          <StatTile
            icon={CalendarClockIcon}
            label="Sessions this week"
            value={String(lecturerStats.sessionsThisWeek)}
            hint={`${lecturerAttendanceSummary.awaitingMarking} awaiting mark`}
          />
          <StatTile
            icon={FileCheck2Icon}
            label="Results awaiting release"
            value={String(lecturerStats.resultsPending)}
            hint="Provisional or pending"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClockIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Next teaching session
                  </CardTitle>
                  <CardDescription>
                    Your soonest scheduled class across your assigned courses.
                  </CardDescription>
                </div>
                <ClassSessionStatusBadge status={lecturerNextSession.status} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">
                  {lecturerNextSession.courseName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lecturerNextSession.topic}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryField
                  icon={CalendarDaysIcon}
                  label="Date"
                  value={formatShortDate(lecturerNextSession.date)}
                />
                <SummaryField
                  icon={ClockIcon}
                  label="Time"
                  value={formatTimeRange(
                    lecturerNextSession.startsAt,
                    lecturerNextSession.endsAt
                  )}
                />
                <SummaryField
                  icon={MapPinIcon}
                  label="Room"
                  value={`${lecturerNextSession.branch} · ${lecturerNextSession.room}`}
                />
                <SummaryField
                  icon={VideoIcon}
                  label="Mode"
                  value={lecturerNextSession.deliveryMode}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                In {getLecturerDaysUntil(lecturerNextSession.date)}{" "}
                {getLecturerDaysUntil(lecturerNextSession.date) === 1
                  ? "day"
                  : "days"}{" "}
                · sample timing.
              </p>
            </CardContent>
            {upcomingAfterNext.length > 0 ? (
              <CardFooter className="flex flex-col items-stretch gap-2 border-t px-4 py-4 sm:px-6">
                <p className="text-xs font-medium text-muted-foreground">
                  Next up
                </p>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {upcomingAfterNext.map((session) => (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {session.courseName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {session.topic}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatShortDate(session.date)} ·{" "}
                        {formatTimeRange(session.startsAt, session.endsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardFooter>
            ) : null}
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <TriangleAlertIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Attendance needing attention
              </CardTitle>
              <CardDescription>
                Students below the {lecturerAttendanceSummary.targetRate}%
                target in your courses.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3">
                <SummaryField
                  icon={ClockIcon}
                  label="Awaiting marking"
                  value={`${lecturerAttendanceSummary.awaitingMarking} session`}
                />
                <SummaryField
                  icon={TriangleAlertIcon}
                  label="Courses below target"
                  value={String(lecturerAttendanceSummary.coursesBelowTarget)}
                />
              </div>
              {lecturerAttendanceAttention.length === 0 ? (
                <EmptyState
                  icon={
                    <CheckCircle2Icon className="size-5" aria-hidden="true" />
                  }
                  title="No attendance follow-ups"
                  description="Every student in your courses is at or above the attendance target."
                />
              ) : (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {lecturerAttendanceAttention.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1 p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {entry.studentName}
                        </span>
                        <span
                          className={cn(
                            "text-sm font-medium tabular-nums",
                            entry.attendanceRate < 70
                              ? "text-destructive"
                              : "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {entry.attendanceRate}%
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entry.courseName} · {entry.studentNo}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.sessionsMissed} sessions missed · last seen{" "}
                        {formatDisplayDate(entry.lastSeenOn)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Only students in courses assigned to you are listed.
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Courses taught
              </CardTitle>
              <CardDescription>
                Courses assigned to you through your teaching schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              {lecturerCourses
                .filter((course) => course.status === "active")
                .map((course) => {
                  const fillPercent = Math.round(
                    (course.enrolledCount / course.capacity) * 100
                  )

                  return (
                    <div
                      key={course.id}
                      className="flex flex-col gap-3 rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {course.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {course.subject} · {course.branch} ·{" "}
                            {course.gradeLevels.join(", ")}
                          </span>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {getLecturerCourseTermLabel(course)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          {course.deliveryMode}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {course.scheduleSummary}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          Your share {course.sharePercent}%
                        </Badge>
                      </div>
                      <Progress value={fillPercent} className="gap-2">
                        <ProgressLabel className="text-xs text-muted-foreground">
                          Enrolled {course.enrolledCount} of {course.capacity} ·{" "}
                          {fillPercent}%
                        </ProgressLabel>
                      </Progress>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Attendance{" "}
                          {course.attendanceRate !== null
                            ? `${course.attendanceRate}%`
                            : "not tracked"}
                        </span>
                        <span>
                          {course.coTeachers.length > 0
                            ? `Co-teachers: ${course.coTeachers.join(", ")}`
                            : "Sole teacher"}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <FileCheck2Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Exams &amp; results
              </CardTitle>
              <CardDescription>
                Exams you own and results still to release.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Upcoming exams
                </p>
                {lecturerUpcomingExams.length === 0 ? (
                  <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                    No upcoming exams are scheduled.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {lecturerUpcomingExams.map((exam) => (
                      <li
                        key={exam.id}
                        className="flex flex-wrap items-start justify-between gap-2 p-2.5"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium">
                            {exam.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {exam.courseName} ·{" "}
                            {formatDisplayDate(exam.date)} ·{" "}
                            {exam.durationMinutes} min · {exam.maxMarks} marks
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <ExamModeBadge mode={exam.mode} />
                            {exam.mode === "online_mcq" ? (
                              <span className="text-xs text-muted-foreground">
                                {exam.attemptsSubmitted}/{exam.enrolledCount}{" "}
                                attempts
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <LecturerExamStatusBadge status={exam.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Results awaiting release
                </p>
                {lecturerResultsPending.length === 0 ? (
                  <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                    All results for your exams are released.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {lecturerResultsPending.map((exam) => (
                      <li
                        key={exam.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {exam.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {exam.courseName} ·{" "}
                            {formatDisplayDate(exam.date)}
                          </span>
                        </div>
                        <ExamResultStateBadge state={exam.resultsState} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="recent-notices" className="scroll-mt-24 gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <MegaphoneIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Recent notices
                  </CardTitle>
                  <CardDescription>
                    Announcements for you, your branch and your courses.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {unreadNoticeCount} unread
                </Badge>
              </div>
            </CardHeader>
            <ul className="divide-y">
              {lecturerNotices.map((notice) => {
                const isUnread = !readNoticeIds.has(notice.id)

                return (
                  <li key={notice.id}>
                    <button
                      type="button"
                      onClick={() => openNotice(notice)}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6"
                    >
                      <span className="flex items-start gap-2 text-sm font-medium">
                        {isUnread ? (
                          <span
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                            aria-label="Unread notice"
                          />
                        ) : null}
                        <span className="line-clamp-2">{notice.title}</span>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {notice.excerpt}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {notice.author} ·{" "}
                        {formatDisplayDate(notice.publishedAt)} ·{" "}
                        {notice.audienceLabel}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Notice read state is local to this preview.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <MessagesSquareIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Recent messages
              </CardTitle>
              <CardDescription>
                Conversations you are part of.
              </CardDescription>
            </CardHeader>
            <ul className="divide-y">
              {lecturerMessageThreads.map((thread) => {
                const unread = getLecturerThreadUnreadCount(thread)
                const lastMessage = getLecturerThreadLastMessage(thread)
                const otherParticipants = getLecturerThreadOtherParticipants(
                  thread
                )
                  .map((participant) => participant.name)
                  .join(", ")

                return (
                  <li
                    key={thread.id}
                    className="flex flex-col gap-1 px-4 py-3 sm:px-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        {unread > 0 ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-primary"
                            aria-label="Unread conversation"
                          />
                        ) : null}
                        <span className="line-clamp-1">{thread.subject}</span>
                      </span>
                      {unread > 0 ? (
                        <Badge variant="secondary" className="rounded-full">
                          {unread} unread
                        </Badge>
                      ) : null}
                    </div>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {otherParticipants}
                      {thread.courseName ? ` · ${thread.courseName}` : ""}
                    </span>
                    {lastMessage ? (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {lastMessage.senderId === LECTURER_MESSAGE_SENDER_ID
                          ? "You: "
                          : ""}
                        {lastMessage.body}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">
                      {formatDisplayDate(getLecturerThreadLastMessageAt(thread))}
                    </span>
                  </li>
                )
              })}
            </ul>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Only conversations you are part of are shown. Opening the Messages
              page is planned for a later step.
            </CardFooter>
          </Card>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <HandCoinsIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  My earnings
                </CardTitle>
                <CardDescription>
                  Your own commission and payout summary. No other lecturer's
                  earnings are shown.
                </CardDescription>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={commissionsEnabled}
                  onCheckedChange={(checked) =>
                    setCommissionsEnabled(Boolean(checked))
                  }
                  aria-label="Toggle commissions module demo state"
                />
                Commissions module (demo)
              </label>
            </div>
          </CardHeader>
          {commissionsEnabled ? (
            <>
              <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <SummaryField
                    icon={CircleDollarSignIcon}
                    label="Net payable"
                    value={formatLkr(lecturerEarnings.netPayable)}
                  />
                  <SummaryField
                    icon={ClockIcon}
                    label="Accrued (not settled)"
                    value={formatLkr(lecturerEarnings.accrued)}
                  />
                  <SummaryField
                    icon={BadgeCheckIcon}
                    label="Settled this term"
                    value={formatLkr(lecturerEarnings.settledThisTerm)}
                  />
                  <SummaryField
                    icon={HandCoinsIcon}
                    label="Payout state"
                    value={lecturerEarnings.period}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {lecturerEarnings.period} breakdown
                  </p>
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {lecturerEarnings.breakdown.map((row) => (
                      <li
                        key={row.courseId}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {row.courseName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Base {formatLkr(row.grossBase)} · commission{" "}
                            {formatLkr(row.commissionAmount)}
                          </span>
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {formatLkr(row.netPayable)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <LecturerPayoutStatusBadge
                    status={lecturerEarnings.payoutStatus}
                  />
                  <span className="text-muted-foreground">
                    {lecturerEarnings.payoutStatus === "paid"
                      ? "Paid"
                      : lecturerEarnings.payoutStatus === "approved"
                        ? "Approved, awaiting payment"
                        : "Draft payout for the current period"}
                  </span>
                  {lecturerEarnings.lastPaidOn ? (
                    <span className="text-xs text-muted-foreground">
                      Last payout {formatLkr(lecturerEarnings.lastPaidAmount ?? 0)}{" "}
                      on {formatDisplayDate(lecturerEarnings.lastPaidOn)}
                    </span>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Commission entries are snapshots and reversal lines can be
                negative. Amounts are demo figures only; no commission is
                calculated and no payout is created.
              </CardFooter>
            </>
          ) : (
            <CardContent className="p-4 sm:p-6">
              <EmptyState
                icon={<BanIcon className="size-5" aria-hidden="true" />}
                title="Commissions are disabled"
                description="When the commissions module is off for this institute, the lecturer's earnings and payout summary are not available."
              />
            </CardContent>
          )}
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This dashboard uses local sample data and component state. It
              shows only courses assigned to {lecturer.fullName}, their sessions,
              attendance, exams, results, notices, messages and this lecturer's
              own earnings. Nothing is saved, sent, published, graded or paid,
              and no institute-wide or other lecturers' private data is shown.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={selectedNotice !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedNotice(null)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          {selectedNotice ? (
            <>
              <DialogHeader>
                <Badge variant="outline" className="w-fit rounded-full">
                  {selectedNotice.audienceLabel}
                </Badge>
                <DialogTitle className="text-lg">
                  {selectedNotice.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedNotice.author} · published{" "}
                  {formatDisplayDate(selectedNotice.publishedAt)}
                </DialogDescription>
              </DialogHeader>
              {selectedNotice.courseName ? (
                <p className="text-xs text-muted-foreground">
                  Course: {selectedNotice.courseName}
                </p>
              ) : null}
              <Separator />
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {selectedNotice.body}
              </p>
              <p className="rounded-lg border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                Notices are read-only in this preview. No lecturer
                notice-authoring permission is assumed, and nothing is sent or
                published.
              </p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function ModuleStateBadge({
  label,
  enabled,
}: {
  label: string
  enabled: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full",
        enabled
          ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
          : "text-muted-foreground"
      )}
    >
      {enabled ? (
        <CheckCircle2Icon aria-hidden="true" />
      ) : (
        <BanIcon aria-hidden="true" />
      )}
      {label}
    </Badge>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function SummaryField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  )
}
