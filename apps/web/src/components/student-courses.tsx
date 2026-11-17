"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"

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
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardXIcon,
  GraduationCapIcon,
  InfoIcon,
  LockKeyholeIcon,
  MapPinIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  CourseAccessBadge,
  CourseStatusBadge,
  DeliveryModeBadge,
} from "@/components/portal-status-badge"
import {
  formatAccessRange,
  formatDateRange,
  formatDisplayDate,
  formatLkr,
  MOCK_TODAY,
  student,
  studentCourses,
  type StudentCourse,
  type StudentCourseStatus,
} from "@/lib/student-portal-data"

type CourseTab = "active" | "completed" | "dropped"

const courseTabs: Array<{
  value: CourseTab
  label: string
  status: StudentCourseStatus
}> = [
  { value: "active", label: "Active", status: "active" },
  { value: "completed", label: "Completed", status: "completed" },
  { value: "dropped", label: "Past / Dropped", status: "dropped" },
]

const tabDescriptions: Record<CourseTab, string> = {
  active:
    "Current enrolments. Open a course for its full access, schedule and intake details.",
  completed:
    "Finished enrolments kept for your records. Teacher and access details remain read-only.",
  dropped:
    "Enrolments that are no longer active. Contact the institute office if something looks incorrect.",
}

const emptyStateCopy: Record<
  CourseTab,
  { title: string; description: string }
> = {
  active: {
    title: "No active courses",
    description:
      "When you are enrolled in a class or program it will appear here. Contact the institute office if you expected a course.",
  },
  completed: {
    title: "No completed courses",
    description:
      "Courses appear here after your enrolment is completed and closed by the institute.",
  },
  dropped: {
    title: "No past or dropped courses",
    description:
      "Past and dropped enrolments will appear here. Contact the institute office if a record is missing.",
  },
}

function getCoursesForTab(tab: CourseTab) {
  return studentCourses.filter((course) => course.status === tab)
}

function getAttendanceLabel(course: StudentCourse) {
  if (!course.attendance.enabled) {
    return "Not enabled for this course"
  }

  return course.attendance.rate === null
    ? "Enabled · rate not available"
    : `${course.attendance.rate}% · demo data`
}

function getEnrolmentLabel(course: StudentCourse) {
  if (course.status === "completed" && course.completedOn) {
    return {
      label: "Completed on",
      value: formatDisplayDate(course.completedOn),
    }
  }

  if (course.status === "dropped" && course.droppedOn) {
    return {
      label: "Dropped on",
      value: formatDisplayDate(course.droppedOn),
    }
  }

  return {
    label: "Enrolled on",
    value: formatDisplayDate(course.enrolledOn),
  }
}

export function StudentCourses() {
  const idPrefix = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeTab, setActiveTab] = useState<CourseTab>("active")
  const [selectedCourse, setSelectedCourse] = useState<StudentCourse | null>(
    null
  )

  const restrictedCourses = studentCourses.filter(
    (course) =>
      course.status === "active" && course.access.state === "restricted"
  )
  const visibleCourses = getCoursesForTab(activeTab)

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    let nextIndex: number | null = null

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % courseTabs.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + courseTabs.length) % courseTabs.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = courseTabs.length - 1
    }

    if (nextIndex === null) return

    const nextTab = courseTabs[nextIndex]

    if (!nextTab) return

    event.preventDefault()
    setActiveTab(nextTab.value)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="My Courses"
          description={`Your enrolments, teachers, access and intake details for ${formatDisplayDate(
            MOCK_TODAY
          )}. All records on this page are local sample data.`}
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

        {restrictedCourses.length > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <LockKeyholeIcon
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Some course access is restricted</p>
              <p className="text-muted-foreground">
                {restrictedCourses.map((course) => course.name).join(", ")} has
                limited access. Review your fees or contact the institute office
                to restore full access.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="Course status"
            className="flex w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1 sm:w-fit"
          >
            {courseTabs.map((tab, index) => {
              const isSelected = activeTab === tab.value
              const count = getCoursesForTab(tab.value).length

              return (
                <button
                  key={tab.value}
                  ref={(element) => {
                    tabRefs.current[index] = element
                  }}
                  type="button"
                  role="tab"
                  id={`${idPrefix}-tab-${tab.value}`}
                  aria-selected={isSelected}
                  aria-controls={`${idPrefix}-panel`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.value)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-none",
                    isSelected
                      ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id={`${idPrefix}-panel`}
            aria-labelledby={`${idPrefix}-tab-${activeTab}`}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-muted-foreground">
              {tabDescriptions[activeTab]}
            </p>

            {visibleCourses.length === 0 ? (
              <Card className="gap-0 py-0">
                <EmptyState
                  icon={<BookOpenIcon className="size-5" aria-hidden="true" />}
                  title={emptyStateCopy[activeTab].title}
                  description={emptyStateCopy[activeTab].description}
                />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => setSelectedCourse(course)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Course access is read-only in this preview. There is no
              self-service enrolment, drop or transfer action. Contact the
              institute office for changes to your enrolments or to review an
              access restriction.
            </p>
          </CardContent>
        </Card>
      </div>

      <CourseDetailsDialog
        course={selectedCourse}
        onOpenChange={(open) => {
          if (!open) setSelectedCourse(null)
        }}
      />
    </main>
  )
}

function getFooterSummary(course: StudentCourse) {
  if (course.status === "active") {
    return course.monthlyFee > 0
      ? `${formatLkr(course.monthlyFee)} / month`
      : "No monthly fee"
  }

  if (course.status === "completed" && course.completedOn) {
    return `Completed ${formatDisplayDate(course.completedOn)}`
  }

  if (course.status === "dropped" && course.droppedOn) {
    return `Dropped ${formatDisplayDate(course.droppedOn)}`
  }

  return "Access ended"
}

function CourseCard({
  course,
  onOpen,
}: {
  course: StudentCourse
  onOpen: () => void
}) {
  const enrolment = getEnrolmentLabel(course)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {course.subject.slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CourseStatusBadge status={course.status} />
              <DeliveryModeBadge mode={course.deliveryMode} />
            </div>
            <CardTitle className="leading-snug">{course.name}</CardTitle>
            <CardDescription className="text-xs">
              {course.subject} · {course.courseType} · {course.gradeLevel}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid gap-2.5">
          <CourseFact
            icon={UsersRoundIcon}
            label={course.teachers.length > 1 ? "Teachers" : "Teacher"}
            value={course.teachers.join(", ")}
          />
          <CourseFact
            icon={MapPinIcon}
            label="Branch and room"
            value={`${course.branch} · ${course.room}`}
          />
          <CourseFact
            icon={CalendarClockIcon}
            label="Schedule"
            value={course.schedule}
          />
          <CourseFact
            icon={
              course.attendance.enabled ? ClipboardCheckIcon : ClipboardXIcon
            }
            label="Attendance"
            value={getAttendanceLabel(course)}
          />
          {course.intake ? (
            <CourseFact
              icon={CalendarDaysIcon}
              label={`Intake · ${course.intake.label}`}
              value={formatDateRange(
                course.intake.startsOn,
                course.intake.endsOn
              )}
            />
          ) : null}
          <CourseFact
            icon={GraduationCapIcon}
            label={enrolment.label}
            value={enrolment.value}
          />
        </dl>

        <div
          className={cn(
            "mt-auto rounded-lg border p-2.5",
            course.access.state === "restricted"
              ? "border-amber-600/20 bg-amber-500/5"
              : "border-border bg-muted/40"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <CourseAccessBadge state={course.access.state} />
            <span className="text-[11px] text-muted-foreground">
              Access window
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {formatAccessRange(course.access.startsOn, course.access.endsOn)}
          </p>
          {course.access.state === "restricted" && course.access.note ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {course.access.note}
            </p>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="mt-auto border-t px-4 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-sm font-medium tabular-nums">
            {getFooterSummary(course)}
          </span>
          <Button variant="ghost" size="xs" onClick={onOpen}>
            View details
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

function CourseFact({
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
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-[11px] leading-tight text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm break-words">{value}</dd>
      </div>
    </div>
  )
}

function CourseDetailsDialog({
  course,
  onOpenChange,
}: {
  course: StudentCourse | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={course !== null} onOpenChange={onOpenChange}>
      {course ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <CourseStatusBadge status={course.status} />
              <DeliveryModeBadge mode={course.deliveryMode} />
              <CourseAccessBadge state={course.access.state} />
            </div>
            <DialogTitle className="text-lg">{course.name}</DialogTitle>
            <DialogDescription>
              {course.subject} · {course.courseType} · {course.gradeLevel}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 text-sm">
            <DetailRow
              icon={UserRoundIcon}
              label={course.teachers.length > 1 ? "Teachers" : "Teacher"}
              value={course.teachers.join(", ")}
            />
            <DetailRow
              icon={MapPinIcon}
              label="Branch and room"
              value={`${course.branch} · ${course.room}`}
            />
            <DetailRow
              icon={CalendarClockIcon}
              label="Schedule"
              value={course.schedule}
            />
            <DetailRow
              icon={
                course.attendance.enabled ? ClipboardCheckIcon : ClipboardXIcon
              }
              label="Attendance"
              value={getAttendanceLabel(course)}
            />
            <DetailRow
              icon={GraduationCapIcon}
              label={getEnrolmentLabel(course).label}
              value={getEnrolmentLabel(course).value}
            />
            {course.status === "active" ? (
              <DetailRow
                icon={BookOpenIcon}
                label="Monthly fee"
                value={
                  course.monthlyFee > 0
                    ? `${formatLkr(course.monthlyFee)} per month`
                    : "No monthly fee"
                }
              />
            ) : null}
            {course.intake ? (
              <DetailRow
                icon={CalendarDaysIcon}
                label={`Intake · ${course.intake.label}`}
                value={formatDateRange(
                  course.intake.startsOn,
                  course.intake.endsOn
                )}
              />
            ) : null}
          </div>

          <Separator />

          <div
            className={cn(
              "rounded-lg border p-3",
              course.access.state === "restricted"
                ? "border-amber-600/20 bg-amber-500/5"
                : "border-border bg-muted/40"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Course access</span>
              <CourseAccessBadge state={course.access.state} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {formatAccessRange(course.access.startsOn, course.access.endsOn)}
            </p>
            {course.access.note ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {course.access.note}
              </p>
            ) : null}
          </div>

          {course.dropNote ? (
            <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {course.dropNote}
            </p>
          ) : null}

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
