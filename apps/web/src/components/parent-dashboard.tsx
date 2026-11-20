"use client"

import Link from "next/link"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  InfoIcon,
  MapPinIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ExamModeBadge,
  ExamResultStateBadge,
  FeeStatusBadge,
} from "@/components/portal-status-badge"
import {
  parent,
  parentChildren,
  type ParentChild,
  type ParentChildAttendance,
} from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  formatLkr,
  formatShortDate,
  formatTimeRange,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

const attendanceTones: Record<
  keyof Pick<ParentChildAttendance, "present" | "late" | "absent" | "excused">,
  { label: string; className: string }
> = {
  present: {
    label: "Present",
    className:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  late: {
    label: "Late",
    className:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  absent: {
    label: "Absent",
    className:
      "border-destructive/15 bg-destructive/5 text-destructive dark:border-destructive/25",
  },
  excused: {
    label: "Excused",
    className:
      "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
}

export function ParentDashboard() {
  const [selectedChildId, setSelectedChildId] = useState(
    parentChildren[0]?.id ?? ""
  )

  const selectedChild =
    parentChildren.find((child) => child.id === selectedChildId) ??
    parentChildren[0] ??
    null

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Parent Dashboard"
          description="A read-only summary for the children linked to your guardian record. Switch children to update every summary card below."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {parentChildren.length} linked{" "}
                {parentChildren.length === 1 ? "child" : "children"}
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

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-3">
              <Avatar size="lg" className="size-12">
                <AvatarFallback>{parent.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="text-lg font-semibold tracking-tight">
                  Welcome, {parent.preferredName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Only your linked children and their records are shown. All
                  figures are local sample data.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <UsersRoundIcon aria-hidden="true" />
                {parentChildren.length} linked{" "}
                {parentChildren.length === 1 ? "child" : "children"}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Guardian view
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <UsersRoundIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Linked children
                </CardTitle>
                <CardDescription>
                  Select a child to update every summary card below.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="outline" className="rounded-full">
                  {parentChildren.length} linked
                </Badge>
                <Link
                  href="/portal/parent/children"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
                >
                  View children
                  <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {parentChildren.length === 0 ? (
              <EmptyState
                icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
                title="No linked children"
                description="No student is linked to this guardian record. Contact the branch office if a child is missing from your account."
              />
            ) : (
              <div
                role="group"
                aria-label="Select a linked child"
                className="grid gap-3 sm:grid-cols-2"
              >
                {parentChildren.map((child) => (
                  <ChildCard
                    key={child.id}
                    child={child}
                    selected={child.id === selectedChild?.id}
                    onSelect={() => setSelectedChildId(child.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Children are shown only through your guardian links. No student
            directory or other family&apos;s records are used.
          </CardFooter>
        </Card>

        {selectedChild ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2
                  aria-live="polite"
                  className="text-lg font-semibold tracking-tight"
                >
                  Summary for {selectedChild.fullName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedChild.studentNo} · {selectedChild.grade} ·{" "}
                  {selectedChild.branch} branch · {selectedChild.relationship}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="gap-1.5 rounded-full"
                aria-label={`Selected child: ${selectedChild.fullName}`}
              >
                <BadgeCheckIcon aria-hidden="true" />
                Viewing {selectedChild.preferredName}
              </Badge>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <NextClassCard child={selectedChild} />
              <AttendanceCard child={selectedChild} />
              <ExamResultCard child={selectedChild} />
              <FeesCard child={selectedChild} />
              <LatestNoticeCard child={selectedChild} />
            </div>

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This dashboard uses local sample data. Only children linked to{" "}
                  {parent.fullName} through the guardian record are shown, and
                  switching children updates every card above. Nothing is saved,
                  sent, paid, submitted or graded, and no student-only exam
                  actions are available.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  )
}

function ChildCard({
  child,
  selected,
  onSelect,
}: {
  child: ParentChild
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`View summary for ${child.fullName}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-4",
        selected
          ? "border-primary/40 bg-primary/5"
          : "bg-card hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar>
            <AvatarFallback>{child.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="truncate">{child.fullName}</span>
              {selected ? (
                <Badge variant="secondary" className="rounded-full">
                  Viewing
                </Badge>
              ) : null}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {child.studentNo} · {child.grade} · {child.branch}
            </span>
          </div>
        </div>
        {selected ? (
          <CheckCircle2Icon
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
        ) : (
          <span
            className="mt-1 size-3.5 shrink-0 rounded-full border"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="rounded-full">
          {child.relationship}
        </Badge>
        {child.isPrimary ? (
          <Badge variant="outline" className="rounded-full">
            Primary guardian
          </Badge>
        ) : null}
        <Badge variant="outline" className="rounded-full">
          {child.activeCourseCount} active{" "}
          {child.activeCourseCount === 1 ? "course" : "courses"}
        </Badge>
      </div>
    </button>
  )
}

function NextClassCard({ child }: { child: ParentChild }) {
  const nextClass = child.nextClass

  return (
    <Card className="gap-0 py-0 xl:col-span-2">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <CalendarClockIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Next class
            </CardTitle>
            <CardDescription>
              {nextClass
                ? `${formatShortDate(nextClass.date)} · ${child.preferredName}'s next scheduled session`
                : `No upcoming class recorded for ${child.preferredName}`}
            </CardDescription>
          </div>
          {nextClass ? (
            <Badge variant="outline" className="rounded-full">
              {nextClass.deliveryMode}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {nextClass ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">{nextClass.courseName}</p>
              <p className="text-sm text-muted-foreground">{nextClass.topic}</p>
            </div>
            <div className="grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
              <InfoLine
                icon={CalendarDaysIcon}
                value={`${formatShortDate(nextClass.date)} · ${formatTimeRange(
                  nextClass.startsAt,
                  nextClass.endsAt
                )}`}
              />
              <InfoLine
                icon={MapPinIcon}
                value={`${nextClass.room} · ${nextClass.branch}`}
              />
              <InfoLine icon={UserRoundIcon} value={nextClass.lecturer} />
              <InfoLine icon={BookOpenIcon} value={nextClass.subject} />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<CalendarClockIcon className="size-5" aria-hidden="true" />}
            title="No upcoming class"
            description="When the next session is scheduled for this child, it will appear here."
          />
        )}
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        The parent view is read-only. Classes cannot be booked, cancelled or
        rescheduled here.
      </CardFooter>
    </Card>
  )
}

function AttendanceCard({ child }: { child: ParentChild }) {
  const attendance = child.attendance

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheckIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Attendance
            </CardTitle>
            <CardDescription>
              This term&apos;s snapshot for {child.preferredName}
            </CardDescription>
          </div>
          {attendance ? (
            <Badge variant="outline" className="rounded-full">
              {attendance.rate}% this term
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
        {attendance ? (
          <>
            <Progress value={attendance.rate} className="gap-2">
              <ProgressLabel className="text-xs text-muted-foreground">
                Attendance rate
              </ProgressLabel>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {attendance.rate}%
              </span>
            </Progress>
            <div className="grid grid-cols-2 gap-2">
              {(["present", "late", "absent", "excused"] as const).map(
                (key) => (
                  <div
                    key={key}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg border p-2.5",
                      attendanceTones[key].className
                    )}
                  >
                    <span className="text-base font-semibold tabular-nums">
                      {attendance[key]}
                    </span>
                    <span className="text-[11px]">
                      {attendanceTones[key].label}
                    </span>
                  </div>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {attendance.totalSessions} marked sessions · last marked{" "}
              {formatDisplayDate(attendance.lastMarkedOn)}
            </p>
          </>
        ) : (
          <EmptyState
            icon={<ClipboardCheckIcon className="size-5" aria-hidden="true" />}
            title="No attendance records"
            description="Attendance marked for this child will appear here."
          />
        )}
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Read-only summary. No staff marking controls are available in the parent
        portal.
      </CardFooter>
    </Card>
  )
}

function ExamResultCard({ child }: { child: ParentChild }) {
  const exam = child.upcomingExam
  const result = child.latestResult

  return (
    <Card className="gap-0 py-0 xl:col-span-2">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <FileCheck2Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Exam &amp; result
            </CardTitle>
            <CardDescription>
              The next exam and latest released result for {child.preferredName}
            </CardDescription>
          </div>
          {exam ? <ExamModeBadge mode={exam.mode} /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
        {exam ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold">{exam.title}</p>
              <Badge variant="outline" className="rounded-full">
                {exam.courseName}
              </Badge>
            </div>
            <div className="grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
              <InfoLine
                icon={CalendarDaysIcon}
                value={`${formatShortDate(exam.date)} · ${formatTimeRange(
                  exam.startsAt,
                  exam.endsAt
                )}`}
              />
              <InfoLine icon={MapPinIcon} value={exam.venue} />
              <InfoLine
                icon={ReceiptTextIcon}
                value={`Maximum ${exam.maxMarks} marks`}
              />
              <InfoLine
                icon={BadgeCheckIcon}
                value={`Results visible ${exam.resultsVisibility.toLowerCase()}`}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<FileCheck2Icon className="size-5" aria-hidden="true" />}
            title="No upcoming exam"
            description="The next exam scheduled for this child will appear here."
          />
        )}

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Latest released result
          </p>
          {result ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium">{result.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.courseName} · released{" "}
                    {formatDisplayDate(result.releasedOn)}
                  </p>
                </div>
                <ExamResultStateBadge state="released" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold tabular-nums">
                  {result.marks}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / {result.maxMarks}
                  </span>
                </p>
                <Badge variant="outline" className="rounded-full">
                  Grade {result.grade}
                </Badge>
              </div>
              {result.remarks ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {result.remarks}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No result has been released for this child yet.
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Parent view only. There is no exam start, answer, submit or attempt
        action, and only released results are shown.
      </CardFooter>
    </Card>
  )
}

function FeesCard({ child }: { child: ParentChild }) {
  const fees = child.fees

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <WalletCardsIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Outstanding invoices
            </CardTitle>
            <CardDescription>
              Fees for {child.preferredName} only
            </CardDescription>
          </div>
          {fees ? <FeeStatusBadge status={fees.status} /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        {fees ? (
          <>
            <div className="flex flex-col gap-0.5">
              <p className="text-2xl font-semibold tabular-nums">
                {formatLkr(fees.outstanding)}
              </p>
              <p className="text-xs text-muted-foreground">
                Outstanding for {fees.period}
              </p>
            </div>
            <Separator />
            <div className="flex flex-col gap-2 text-sm">
              <StatusLine label="Invoice" value={fees.invoiceNo} />
              <StatusLine label="Due" value={formatDisplayDate(fees.dueDate)} />
              <StatusLine
                label="Balance"
                value={`${formatLkr(fees.outstanding)} unpaid`}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<WalletCardsIcon className="size-5" aria-hidden="true" />}
            title="No outstanding fees"
            description="No unpaid invoice is recorded for this child in the preview."
          />
        )}
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Payment and receipt pages are planned. No payment can be made from this
        dashboard, and sibling balances are never combined.
      </CardFooter>
    </Card>
  )
}

function LatestNoticeCard({ child }: { child: ParentChild }) {
  const notice = child.latestNotice

  return (
    <Card id="latest-notice" className="scroll-mt-24 gap-0 py-0 xl:col-span-3">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <MegaphoneIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Latest notice
            </CardTitle>
            <CardDescription>
              The most recent notice relevant to {child.preferredName}
            </CardDescription>
          </div>
          {notice ? (
            <Badge variant="outline" className="rounded-full">
              {notice.audience}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {notice ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold">{notice.title}</p>
              <span className="text-xs text-muted-foreground">
                {formatDisplayDate(notice.publishedAt)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {notice.excerpt}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {notice.body}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={<MegaphoneIcon className="size-5" aria-hidden="true" />}
            title="No notices"
            description="Notices for this child's grade, branch or courses will appear here."
          />
        )}
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Notices are read-only. Only notices relevant to this child&apos;s grade,
        branch or courses are shown.
      </CardFooter>
    </Card>
  )
}

function InfoLine({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <span className="flex items-start gap-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="break-words">{value}</span>
    </span>
  )
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}
