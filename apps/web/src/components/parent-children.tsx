"use client"

import { useState } from "react"

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
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  AwardIcon,
  BadgeCheckIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  InfoIcon,
  MapPinIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  parent,
  parentChildren,
  type ParentChild,
} from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  formatLkr,
  formatShortDate,
  formatTimeRange,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

const childPageLinks: Array<{
  title: string
  icon: LucideIcon
}> = [
  { title: "Courses", icon: BookOpenIcon },
  { title: "Timetable", icon: CalendarClockIcon },
  { title: "Attendance", icon: ClipboardCheckIcon },
  { title: "Exams & Results", icon: AwardIcon },
  { title: "Invoices & Payments", icon: WalletCardsIcon },
  { title: "Notices", icon: MegaphoneIcon },
]

export function ParentChildren() {
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
          title="My Children"
          description="Only students linked to your guardian record. Select a child for a safe summary; private profile fields and QR tokens are never shown."
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

        {parentChildren.length === 0 ? (
          <div className="flex flex-col gap-4">
            <Card className="gap-0 py-0">
              <EmptyState
                icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
                title="No linked children"
                description="No student is linked to this guardian record. Contact the branch office or institute help desk and ask them to link your child to your guardian profile."
              />
            </Card>
            <Card className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Guardian links are managed by the institute. This page never
                  searches a student directory and cannot create or edit a
                  guardian link.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
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
                      Select a child to view their safe summary.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {parentChildren.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {parentChildren.map((child) => (
                    <li key={child.id}>
                      <ChildListItem
                        child={child}
                        selected={child.id === selectedChild?.id}
                        onSelect={() => setSelectedChildId(child.id)}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Only students linked to {parent.fullName} are listed. No global
                student directory is used.
              </CardFooter>
            </Card>

            {selectedChild ? <ChildDetail child={selectedChild} /> : null}
          </div>
        )}
      </div>
    </main>
  )
}

function ChildListItem({
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
      aria-label={`View details for ${child.fullName}`}
      className={cn(
        "flex w-full flex-col gap-2.5 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6",
        selected ? "bg-primary/5" : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar>
            <AvatarFallback>{child.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{child.fullName}</span>
              {selected ? (
                <CheckCircle2Icon
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">
              {child.studentNo}
            </span>
            <span className="text-xs text-muted-foreground">
              {child.grade} · {child.branch} branch
            </span>
          </div>
        </div>
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

function ChildDetail({ child }: { child: ParentChild }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Avatar size="lg" className="size-14">
              <AvatarFallback className="text-base">
                {child.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {child.fullName}
                </h2>
                <Badge variant="outline" className="rounded-full">
                  {child.relationship}
                </Badge>
                {child.isPrimary ? (
                  <Badge variant="secondary" className="gap-1.5 rounded-full">
                    <BadgeCheckIcon aria-hidden="true" />
                    Primary guardian
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="tabular-nums">{child.studentNo}</span>
                <span>{child.grade}</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5" aria-hidden="true" />
                  {child.branch} branch
                </span>
                <span>
                  {child.activeCourseCount} active{" "}
                  {child.activeCourseCount === 1 ? "course" : "courses"}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="w-fit rounded-full">
              Safe summary
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat
              label="Attendance"
              value={
                child.attendance ? `${child.attendance.rate}%` : "Not tracked"
              }
              hint="This term"
            />
            <SummaryStat
              label="Next class"
              value={
                child.nextClass
                  ? formatShortDate(child.nextClass.date)
                  : "Not scheduled"
              }
              hint={
                child.nextClass
                  ? formatTimeRange(
                      child.nextClass.startsAt,
                      child.nextClass.endsAt
                    )
                  : "No upcoming class"
              }
            />
            <SummaryStat
              label="Outstanding"
              value={child.fees ? formatLkr(child.fees.outstanding) : "None"}
              hint={
                child.fees
                  ? `Due ${formatDisplayDate(child.fees.dueDate)}`
                  : "No unpaid invoice"
              }
            />
            <SummaryStat
              label="Latest result"
              value={
                child.latestResult
                  ? `${child.latestResult.marks}/${child.latestResult.maxMarks}`
                  : "Not released"
              }
              hint={
                child.latestResult
                  ? `Grade ${child.latestResult.grade}`
                  : "No released result"
              }
            />
          </div>
        </CardContent>
        <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
          This safe summary excludes the student&apos;s full private profile,
          contact details, date of birth and QR token.
        </CardFooter>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <NextClassSummary child={child} />
        <LatestResultSummary child={child} />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <BookOpenIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {child.preferredName}&apos;s pages
              </CardTitle>
              <CardDescription>
                Child-specific pages will keep this child selected.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              Planned shortcuts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-4 sm:p-6">
          {childPageLinks.map((page) => {
            const Icon = page.icon

            return (
              <Button
                key={page.title}
                variant="outline"
                size="sm"
                disabled
                title={`${page.title} for ${child.fullName} is planned for a later step.`}
              >
                <Icon data-icon="inline-start" aria-hidden="true" />
                {page.title}
                <Badge variant="outline" className="ml-1 rounded-full">
                  Soon
                </Badge>
              </Button>
            )
          })}
        </CardContent>
        <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
          These shortcuts are placeholders until the child-specific pages are
          added. No student-only exam, payment or profile action is available
          here.
        </CardFooter>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="flex items-start gap-3 p-4 sm:p-6">
          <ShieldCheckIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Student number, grade, branch, relationship, active course count,
            attendance rate, next class, fees and released results are safe
            summary fields. Guardian links and student records are managed by
            the institute and cannot be changed from the parent portal.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function NextClassSummary({ child }: { child: ParentChild }) {
  const nextClass = child.nextClass

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Next class
        </CardTitle>
        <CardDescription>
          {nextClass
            ? `${formatShortDate(nextClass.date)} · ${child.preferredName}`
            : `No upcoming class for ${child.preferredName}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        {nextClass ? (
          <>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">{nextClass.courseName}</p>
              <p className="text-xs text-muted-foreground">{nextClass.topic}</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
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
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No upcoming class is recorded for this child.
          </p>
        )}
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Read-only timetable summary. No booking or rescheduling is available.
      </CardFooter>
    </Card>
  )
}

function LatestResultSummary({ child }: { child: ParentChild }) {
  const result = child.latestResult

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <FileCheck2Icon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Latest released result
        </CardTitle>
        <CardDescription>
          {result
            ? `${result.courseName} · ${child.preferredName}`
            : `No released result for ${child.preferredName}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        {result ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold">{result.title}</p>
              <Badge variant="outline" className="rounded-full">
                Released {formatDisplayDate(result.releasedOn)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold tabular-nums">
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
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No released result is available for this child.
          </p>
        )}
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Only released results are shown. No marks can be edited from the parent
        portal.
      </CardFooter>
    </Card>
  )
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/20 p-2.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
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
