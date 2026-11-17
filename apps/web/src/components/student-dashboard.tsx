"use client"

import Link from "next/link"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
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
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileCheck2Icon,
  GraduationCapIcon,
  InfoIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  UserRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  AttendanceStatusBadge,
  ExamModeBadge,
  FeeStatusBadge,
  NotificationChannelBadge,
  NotificationDeliveryBadge,
} from "@/components/portal-status-badge"
import {
  activeCourses,
  attendanceSummary,
  feeSnapshot,
  formatDateTime,
  formatDisplayDate,
  formatLkr,
  formatShortDate,
  formatTimeRange,
  getDateParts,
  MOCK_TODAY,
  nextClass,
  recentAttendance,
  recentNotices,
  recentNotifications,
  student,
  upcomingExam,
  type Notice,
  type StudentNotification,
} from "@/lib/student-portal-data"

const notificationEventIcons: Record<StudentNotification["event"], LucideIcon> =
  {
    payment_verified: BadgeCheckIcon,
    attendance_marked: ClipboardCheckIcon,
    exam_published: FileCheck2Icon,
    installment_due: WalletCardsIcon,
    notice: MegaphoneIcon,
  }

export function StudentDashboard() {
  const [classDialogOpen, setClassDialogOpen] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [readNoticeIds, setReadNoticeIds] = useState(
    () => new Set(["notice-3"])
  )
  const [notifications, setNotifications] = useState(recentNotifications)
  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "unread"
  >("all")

  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read
  ).length
  const unreadNoticeCount = recentNotices.filter(
    (notice) => !readNoticeIds.has(notice.id)
  ).length
  const visibleNotifications =
    notificationFilter === "unread"
      ? notifications.filter((notification) => !notification.read)
      : notifications

  function openNotice(notice: Notice) {
    setSelectedNotice(notice)
    setReadNoticeIds((current) => {
      const next = new Set(current)
      next.add(notice.id)
      return next
    })
  }

  function toggleNotification(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: !notification.read }
          : notification
      )
    )
  }

  function markAllNotificationsRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Dashboard"
          description={`Your learning, schedule, attendance and fees at a glance for ${formatDisplayDate(
            MOCK_TODAY
          )}. All figures are local sample data, not live totals.`}
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
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        <WelcomeSummary />

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="gap-0 py-0 xl:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-0.5">
                <CardDescription>Next class</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClockIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {nextClass.courseName}
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
              >
                <CalendarClockIcon aria-hidden="true" />
                Scheduled
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
              <ClassDateTile date={nextClass.date} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="font-medium">
                  {formatShortDate(nextClass.date)} ·{" "}
                  {formatTimeRange(nextClass.startsAt, nextClass.endsAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {nextClass.topic}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinIcon className="size-3.5" aria-hidden="true" />
                    {nextClass.branch} · {nextClass.room}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UserRoundIcon className="size-3.5" aria-hidden="true" />
                    {nextClass.lecturer}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCapIcon
                      className="size-3.5"
                      aria-hidden="true"
                    />
                    {nextClass.deliveryMode} class
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClassDialogOpen(true)}
              >
                Class details
              </Button>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <WalletCardsIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Fees snapshot
                  </CardTitle>
                  <CardDescription>
                    {feeSnapshot.period} · {feeSnapshot.invoiceNo}
                  </CardDescription>
                </div>
                <FeeStatusBadge status={feeSnapshot.status} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <div>
                <p className="text-xs text-muted-foreground">
                  Outstanding balance
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatLkr(feeSnapshot.outstanding)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Next due {formatDisplayDate(feeSnapshot.dueDate)}
                </p>
              </div>
              <Separator />
              <dl className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Invoice total</dt>
                  <dd className="font-medium tabular-nums">
                    {formatLkr(feeSnapshot.total)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Paid so far</dt>
                  <dd className="font-medium tabular-nums">
                    {formatLkr(feeSnapshot.paid)}
                  </dd>
                </div>
              </dl>
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                <p className="font-medium">Last payment verified</p>
                <p className="mt-1 text-muted-foreground">
                  {formatLkr(feeSnapshot.lastPayment.amount)} on{" "}
                  {formatDisplayDate(feeSnapshot.lastPayment.paidOn)} ·{" "}
                  {feeSnapshot.lastPayment.method}
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              <InfoIcon
                className="mr-1.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Local snapshot only. No payment is processed from this page.
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="gap-0 py-0 xl:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCapIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Active courses
                </CardTitle>
                <CardDescription>
                  Current enrolments for {student.grade}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="outline" className="rounded-full">
                  {activeCourses.length} active
                </Badge>
                <Link
                  href="/portal/student/courses"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
                >
                  View all
                  <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
                </Link>
              </div>
            </CardHeader>
            <ul className="divide-y">
              {activeCourses.map((course) => (
                <li
                  key={course.id}
                  className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {course.subject.slice(0, 1)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate font-medium">{course.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {course.subject} · {course.teachers[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course.schedule} · {course.branch} · {course.room}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                    <span className="text-sm font-medium tabular-nums">
                      {formatLkr(course.monthlyFee)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        / month
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {course.attendance.enabled &&
                      course.attendance.rate !== null
                        ? `${course.attendance.rate}% attendance`
                        : "Attendance not tracked"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {activeCourses.length === 0 ? (
              <EmptyState
                icon={
                  <GraduationCapIcon className="size-5" aria-hidden="true" />
                }
                title="No active courses"
                description="When you are enrolled in a class or program, it will appear here. Contact the institute office if you expected a course."
              />
            ) : null}
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Open My Courses for class details, teachers, access ranges and
              intake information.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck2Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Upcoming exam
                  </CardTitle>
                  <CardDescription>{upcomingExam.courseName}</CardDescription>
                </div>
                <ExamModeBadge />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <div>
                <p className="font-medium">{upcomingExam.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatShortDate(upcomingExam.date)} ·{" "}
                  {formatTimeRange(upcomingExam.startsAt, upcomingExam.endsAt)}
                </p>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5" aria-hidden="true" />
                  {upcomingExam.venue}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="size-3.5" aria-hidden="true" />
                  {upcomingExam.durationMinutes} minutes · Maximum{" "}
                  {upcomingExam.maxMarks} marks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                  Results visible {upcomingExam.resultsVisibility.toLowerCase()}
                </span>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                {upcomingExam.note}
              </div>
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Check the exam schedule for full instructions before the test.
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="gap-0 py-0 xl:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheckIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Recent attendance
                </CardTitle>
                <CardDescription>
                  Latest marked sessions and this term&apos;s summary
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="outline" className="rounded-full">
                  {attendanceSummary.rate}% this term
                </Badge>
                <Link
                  href="/portal/student/attendance"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
                >
                  View all
                  <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <Progress value={attendanceSummary.rate} className="gap-2">
                <ProgressLabel className="text-xs text-muted-foreground">
                  Demo attendance rate
                </ProgressLabel>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {attendanceSummary.rate}%
                </span>
              </Progress>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <AttendanceSummaryItem
                  label="Present"
                  value={attendanceSummary.present}
                  tone="emerald"
                />
                <AttendanceSummaryItem
                  label="Late"
                  value={attendanceSummary.late}
                  tone="amber"
                />
                <AttendanceSummaryItem
                  label="Absent"
                  value={attendanceSummary.absent}
                  tone="red"
                />
                <AttendanceSummaryItem
                  label="Excused"
                  value={attendanceSummary.excused}
                  tone="sky"
                />
              </div>
            </CardContent>
            <ul className="divide-y border-t">
              {recentAttendance.map((record) => (
                <li
                  key={record.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 sm:px-6"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium">
                      {record.courseName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(record.date)} · {record.sessionTime} ·{" "}
                      {record.attendedVia}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <AttendanceStatusBadge status={record.status} />
                    <span className="text-[11px] text-muted-foreground">
                      {record.markedVia} marking
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {recentAttendance.length === 0 ? (
              <EmptyState
                icon={
                  <ClipboardCheckIcon className="size-5" aria-hidden="true" />
                }
                title="No attendance records yet"
                description="Marked sessions will appear here after class. Contact the institute if a recent class is missing."
              />
            ) : null}
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Attendance is read-only here. The percentage is illustrative demo
              data.
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <MegaphoneIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Recent notices
                  </CardTitle>
                  <CardDescription>
                    Updates for your grade and branch
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {unreadNoticeCount} new
                </Badge>
              </CardHeader>
              <ul className="divide-y">
                {recentNotices.map((notice) => {
                  const isUnread = !readNoticeIds.has(notice.id)

                  return (
                    <li key={notice.id}>
                      <button
                        type="button"
                        onClick={() => openNotice(notice)}
                        className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                            {isUnread ? (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-primary"
                                aria-label="Unread notice"
                              />
                            ) : null}
                            <span className="line-clamp-2">{notice.title}</span>
                          </span>
                          <ChevronRightIcon
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {notice.excerpt}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDisplayDate(notice.publishedAt)} ·{" "}
                          {notice.audience}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {recentNotices.length === 0 ? (
                <EmptyState
                  icon={<MegaphoneIcon className="size-5" aria-hidden="true" />}
                  title="No recent notices"
                  description="New notices for your branch, grade or courses will appear here. Contact the institute office for urgent updates."
                />
              ) : null}
              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Notice read state is local to this preview.
              </CardFooter>
            </Card>

            <Card id="recent-notifications" className="scroll-mt-24 gap-0 py-0">
              <CardHeader className="border-b px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="flex items-center gap-2">
                      <BellIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Recent notifications
                    </CardTitle>
                    <CardDescription>
                      Enrollment, fees and exam updates
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {unreadNotificationCount} unread
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex rounded-md border p-0.5"
                    role="group"
                    aria-label="Filter notifications"
                  >
                    <Button
                      variant={
                        notificationFilter === "all" ? "secondary" : "ghost"
                      }
                      size="xs"
                      onClick={() => setNotificationFilter("all")}
                      aria-pressed={notificationFilter === "all"}
                    >
                      All
                    </Button>
                    <Button
                      variant={
                        notificationFilter === "unread" ? "secondary" : "ghost"
                      }
                      size="xs"
                      onClick={() => setNotificationFilter("unread")}
                      aria-pressed={notificationFilter === "unread"}
                    >
                      Unread
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={markAllNotificationsRead}
                    disabled={unreadNotificationCount === 0}
                  >
                    Mark all read
                  </Button>
                </div>
              </CardHeader>

              {visibleNotifications.length === 0 ? (
                <EmptyState
                  icon={<BellIcon className="size-5" aria-hidden="true" />}
                  title="No unread notifications"
                  description="You are caught up. Switch to All to review earlier updates."
                />
              ) : (
                <ul className="divide-y">
                  {visibleNotifications.map((notification) => {
                    const Icon = notificationEventIcons[notification.event]

                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => toggleNotification(notification.id)}
                          aria-pressed={!notification.read}
                          className="flex w-full gap-3 px-4 py-3.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                              notification.read
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "text-sm",
                                  notification.read
                                    ? "font-medium"
                                    : "font-semibold"
                                )}
                              >
                                {notification.title}
                              </span>
                              {!notification.read ? (
                                <span
                                  className="size-1.5 rounded-full bg-primary"
                                  aria-label="Unread notification"
                                />
                              ) : null}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {notification.body}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <NotificationChannelBadge
                                channel={notification.channel}
                              />
                              <NotificationDeliveryBadge
                                status={notification.status}
                              />
                              <span>
                                {formatDateTime(notification.createdAt)}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                In-app notifications are always available. Email, SMS and push
                depend on institute settings. Nothing is sent from this demo.
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      <ClassDetailsDialog
        open={classDialogOpen}
        onOpenChange={setClassDialogOpen}
      />

      <Dialog
        open={selectedNotice !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedNotice(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                <MegaphoneIcon aria-hidden="true" />
                Notice
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedNotice
                  ? formatDisplayDate(selectedNotice.publishedAt)
                  : ""}
              </span>
            </div>
            <DialogTitle className="text-lg">
              {selectedNotice?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedNotice
                ? `${selectedNotice.author} · ${selectedNotice.audience}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {selectedNotice?.body}
          </p>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </main>
  )
}

function WelcomeSummary() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="grid gap-0 p-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Avatar size="lg" className="size-11">
              <AvatarFallback>{student.initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  Welcome back, {student.preferredName}
                </h2>
                <Badge variant="secondary" className="rounded-full">
                  Active student
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {student.grade} · Student no. {student.studentNo} ·{" "}
                {student.branch} branch
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            You have {activeCourses.length} active courses. Your next class is{" "}
            {formatShortDate(nextClass.date)} at{" "}
            {formatTimeRange(nextClass.startsAt, nextClass.endsAt)}, and{" "}
            {formatLkr(feeSnapshot.outstanding)} is due on{" "}
            {formatDisplayDate(feeSnapshot.dueDate)}.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x border-t sm:border-t-0 sm:border-l">
          <SummaryStat
            label="Active courses"
            value={String(activeCourses.length)}
          />
          <SummaryStat
            label="Attendance"
            value={`${attendanceSummary.rate}%`}
          />
          <SummaryStat
            label="Outstanding"
            value={formatLkr(feeSnapshot.outstanding)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2 py-4 text-center">
      <span className="text-sm font-semibold tabular-nums sm:text-base">
        {value}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
        {label}
      </span>
    </div>
  )
}

function ClassDateTile({ date }: { date: string }) {
  const dateParts = getDateParts(date)

  return (
    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {dateParts.month}
      </span>
      <span className="text-xl leading-none font-semibold tabular-nums">
        {dateParts.day}
      </span>
    </div>
  )
}

function AttendanceSummaryItem({
  label,
  value,
  tone,
}: {
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
    <div className={cn("rounded-lg border p-2.5", toneClasses[tone])}>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function ClassDetailsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{nextClass.courseName}</DialogTitle>
          <DialogDescription>Next scheduled class</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <DetailRow
            icon={CalendarDaysIcon}
            label="Date and time"
            value={`${formatShortDate(nextClass.date)} · ${formatTimeRange(
              nextClass.startsAt,
              nextClass.endsAt
            )}`}
          />
          <DetailRow
            icon={ClipboardCheckIcon}
            label="Topic"
            value={nextClass.topic}
          />
          <DetailRow
            icon={MapPinIcon}
            label="Location"
            value={`${nextClass.branch} · ${nextClass.room}`}
          />
          <DetailRow
            icon={UserRoundIcon}
            label="Lecturer"
            value={nextClass.lecturer}
          />
          <DetailRow
            icon={MessagesSquareIcon}
            label="Delivery"
            value={`${nextClass.deliveryMode} class`}
          />
          <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            {nextClass.notes}
          </p>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
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
