"use client"

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react"

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
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FilterIcon,
  GraduationCapIcon,
  InfoIcon,
  LockKeyholeIcon,
  MapPinIcon,
  RotateCcwIcon,
  SearchXIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ClassSessionStatusBadge,
  DeliveryModeBadge,
  ExamModeBadge,
  ExamResultStateBadge,
  LecturerContentStatusBadge,
  LecturerCourseKindBadge,
  LecturerCourseStatusBadge,
  LecturerExamStatusBadge,
  MaterialAccessBadge,
  MaterialKindBadge,
} from "@/components/portal-status-badge"
import {
  formatDateRange,
  formatDisplayDate,
  formatLkr,
  formatShortDate,
  formatTimeRange,
  MOCK_TODAY,
} from "@/lib/student-portal-data"
import {
  getLecturerCourseAttendance,
  getLecturerCourseContent,
  getLecturerCourseExams,
  getLecturerCourseSessions,
  getLecturerCourseTermLabel,
  lecturer,
  lecturerCourses,
  type LecturerCourse,
} from "@/lib/lecturer-portal-data"

type CourseKindFilter = "all" | "Class" | "Program"
type CourseStatusFilter = "all" | "active" | "completed"

const ALL = "all"

function uniqueValues(values: string[]) {
  return Array.from(new Set(values))
}

export function LecturerCourses() {
  const [branchFilter, setBranchFilter] = useState(ALL)
  const [kindFilter, setKindFilter] = useState<CourseKindFilter>(ALL)
  const [termFilter, setTermFilter] = useState(ALL)
  const [gradeFilter, setGradeFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>(ALL)
  const [selectedCourse, setSelectedCourse] = useState<LecturerCourse | null>(
    null
  )

  const branchOptions = useMemo(
    () => [
      { value: ALL, label: "All branches" },
      ...uniqueValues(lecturerCourses.map((course) => course.branch)).map(
        (branch) => ({ value: branch, label: branch })
      ),
    ],
    []
  )

  const termOptions = useMemo(
    () => [
      { value: ALL, label: "All terms & intakes" },
      ...uniqueValues(
        lecturerCourses.map((course) => getLecturerCourseTermLabel(course))
      ).map((term) => ({ value: term, label: term })),
    ],
    []
  )

  const gradeOptions = useMemo(
    () => [
      { value: ALL, label: "All grades" },
      ...uniqueValues(
        lecturerCourses.flatMap((course) => course.gradeLevels)
      ).map((grade) => ({ value: grade, label: grade })),
    ],
    []
  )

  const hasFilters =
    branchFilter !== ALL ||
    kindFilter !== ALL ||
    termFilter !== ALL ||
    gradeFilter !== ALL ||
    statusFilter !== ALL

  const filteredCourses = lecturerCourses.filter((course) => {
    if (branchFilter !== ALL && course.branch !== branchFilter) return false
    if (kindFilter !== ALL && course.kind !== kindFilter) return false
    if (
      termFilter !== ALL &&
      getLecturerCourseTermLabel(course) !== termFilter
    ) {
      return false
    }
    if (gradeFilter !== ALL && !course.gradeLevels.includes(gradeFilter)) {
      return false
    }
    if (statusFilter !== ALL && course.status !== statusFilter) return false
    return true
  })

  function clearFilters() {
    setBranchFilter(ALL)
    setKindFilter(ALL)
    setTermFilter(ALL)
    setGradeFilter(ALL)
    setStatusFilter(ALL)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="My Courses"
          description={`Courses assigned to you for ${formatDisplayDate(
            MOCK_TODAY
          )}. Only your own teaching assignments appear here, and every record is local sample data.`}
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={BookOpenIcon}
            label="Assigned courses"
            value={String(lecturerCourses.length)}
            hint="All statuses"
          />
          <StatTile
            icon={CircleCheckIcon}
            label="Active"
            value={String(
              lecturerCourses.filter((course) => course.status === "active")
                .length
            )}
            hint="Currently running"
          />
          <StatTile
            icon={GraduationCapIcon}
            label="Programmes"
            value={String(
              lecturerCourses.filter((course) => course.kind === "Program")
                .length
            )}
            hint="Intake based"
          />
          <StatTile
            icon={UsersRoundIcon}
            label="Co-taught"
            value={String(
              lecturerCourses.filter((course) => course.coTeachers.length > 0)
                .length
            )}
            hint="Shared with a co-teacher"
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:p-4">
          <LockKeyholeIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">
            These are the courses assigned to you through your teaching
            schedule. Courses you do not teach are not listed, and this preview
            is read-only — there is no enrolment, fee or course administration
            action here.
          </p>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <FilterIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Filter courses
            </CardTitle>
            <CardDescription>
              Filter by branch, class or programme, term or intake, grade, and
              status.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end sm:p-6">
            <FilterField label="Branch" htmlFor="lecturer-course-branch">
              <Select
                items={branchOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? ALL)}
              >
                <SelectTrigger
                  id="lecturer-course-branch"
                  className="w-full"
                  aria-label="Filter by branch"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Class or programme" htmlFor="lecturer-course-kind">
              <Select
                items={[
                  { value: ALL, label: "All types" },
                  { value: "Class", label: "Class" },
                  { value: "Program", label: "Programme" },
                ]}
                value={kindFilter}
                onValueChange={(value) =>
                  setKindFilter((value ?? ALL) as CourseKindFilter)
                }
              >
                <SelectTrigger
                  id="lecturer-course-kind"
                  className="w-full"
                  aria-label="Filter by class or programme"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  <SelectItem value="Class">Class</SelectItem>
                  <SelectItem value="Program">Programme</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Term or intake" htmlFor="lecturer-course-term">
              <Select
                items={termOptions}
                value={termFilter}
                onValueChange={(value) => setTermFilter(value ?? ALL)}
              >
                <SelectTrigger
                  id="lecturer-course-term"
                  className="w-full"
                  aria-label="Filter by term or intake"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {termOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Grade" htmlFor="lecturer-course-grade">
              <Select
                items={gradeOptions}
                value={gradeFilter}
                onValueChange={(value) => setGradeFilter(value ?? ALL)}
              >
                <SelectTrigger
                  id="lecturer-course-grade"
                  className="w-full"
                  aria-label="Filter by grade"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Status" htmlFor="lecturer-course-status">
              <Select
                items={[
                  { value: ALL, label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                ]}
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter((value ?? ALL) as CourseStatusFilter)
                }
              >
                <SelectTrigger
                  id="lecturer-course-status"
                  className="w-full"
                  aria-label="Filter by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full xl:w-auto"
            >
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Clear
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? `${filteredCourses.length} of ${lecturerCourses.length} courses match your filters`
              : `${lecturerCourses.length} assigned courses`}
          </p>
          {hasFilters ? (
            <Badge variant="outline" className="rounded-full">
              Filtered
            </Badge>
          ) : null}
        </div>

        {filteredCourses.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<SearchXIcon className="size-5" aria-hidden="true" />}
              title="No courses match your filters"
              description="Try a different branch, type, term or intake, grade, or status. Only courses assigned to you can appear here."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onOpen={() => setSelectedCourse(course)}
              />
            ))}
          </div>
        )}

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Course records, enrolment counts, capacity, co-teachers, share
              percentages and attendance figures are local sample data. This
              preview is read-only and does not create enrolments, fees, or
              course administration settings.
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

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
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
        <Icon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function CourseCard({
  course,
  onOpen,
}: {
  course: LecturerCourse
  onOpen: () => void
}) {
  const fillPercent = Math.round(
    (course.enrolledCount / course.capacity) * 100
  )

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {course.subject.slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <LecturerCourseKindBadge kind={course.kind} />
              <LecturerCourseStatusBadge status={course.status} />
              <DeliveryModeBadge mode={course.deliveryMode} />
            </div>
            <CardTitle className="leading-snug">{course.name}</CardTitle>
            <CardDescription className="text-xs">
              {course.subject} · {course.branch} ·{" "}
              {course.gradeLevels.join(", ")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid gap-2.5">
          <CourseFact
            icon={CalendarDaysIcon}
            label={course.intake ? "Intake" : "Term"}
            value={
              course.intake
                ? `${course.intake.label} · ${formatDateRange(
                    course.intake.startsOn,
                    course.intake.endsOn
                  )}`
                : course.term
            }
          />
          <CourseFact
            icon={CalendarClockIcon}
            label="Schedule"
            value={`${course.scheduleSummary} · ${course.room}`}
          />
          <CourseFact
            icon={course.coTeachers.length > 0 ? UsersRoundIcon : UserRoundIcon}
            label={course.coTeachers.length > 0 ? "Co-teachers" : "Teacher"}
            value={
              course.coTeachers.length > 0
                ? course.coTeachers.join(", ")
                : "Sole teacher"
            }
          />
          <CourseFact
            icon={ClipboardCheckIcon}
            label="Attendance rate"
            value={
              course.attendanceRate !== null
                ? `${course.attendanceRate}% · demo data`
                : "Not tracked"
            }
          />
        </dl>

        <div className="mt-auto flex flex-col gap-1.5">
          <Progress value={fillPercent} className="gap-2">
            <ProgressLabel className="text-xs text-muted-foreground">
              Enrolled {course.enrolledCount} of {course.capacity} ·{" "}
              {fillPercent}%
            </ProgressLabel>
          </Progress>
          <span className="text-[11px] text-muted-foreground">
            Your teaching share: {course.sharePercent}%
          </span>
        </div>
      </CardContent>

      <CardFooter className="mt-auto border-t px-4 py-3">
        <div className="flex w-full items-center justify-between gap-2">
          <Badge variant="outline" className="rounded-full">
            {getLecturerCourseTermLabel(course)}
          </Badge>
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

type CourseDetailTab = "overview" | "schedule" | "content" | "exams" | "attendance"

const detailTabs: Array<{ value: CourseDetailTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "schedule", label: "Schedule" },
  { value: "content", label: "Content" },
  { value: "exams", label: "Exams" },
  { value: "attendance", label: "Attendance" },
]

function CourseDetailsDialog({
  course,
  onOpenChange,
}: {
  course: LecturerCourse | null
  onOpenChange: (open: boolean) => void
}) {
  const idPrefix = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeTab, setActiveTab] = useState<CourseDetailTab>("overview")

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    let nextIndex: number | null = null

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % detailTabs.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + detailTabs.length) % detailTabs.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = detailTabs.length - 1
    }

    if (nextIndex === null) return

    const nextTab = detailTabs[nextIndex]
    if (!nextTab) return

    event.preventDefault()
    setActiveTab(nextTab.value)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <Dialog
      open={course !== null}
      onOpenChange={(open) => {
        if (!open) setActiveTab("overview")
        onOpenChange(open)
      }}
    >
      {course ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <LecturerCourseKindBadge kind={course.kind} />
              <LecturerCourseStatusBadge status={course.status} />
              <DeliveryModeBadge mode={course.deliveryMode} />
            </div>
            <DialogTitle className="text-lg">{course.name}</DialogTitle>
            <DialogDescription>
              {course.subject} · {course.branch} ·{" "}
              {course.gradeLevels.join(", ")} ·{" "}
              {getLecturerCourseTermLabel(course)}
            </DialogDescription>
          </DialogHeader>

          <div
            role="tablist"
            aria-label="Course detail sections"
            className="flex w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
          >
            {detailTabs.map((tab, index) => {
              const isSelected = activeTab === tab.value

              return (
                <button
                  key={tab.value}
                  ref={(element) => {
                    tabRefs.current[index] = element
                  }}
                  type="button"
                  role="tab"
                  id={`${idPrefix}-${tab.value}-tab`}
                  aria-selected={isSelected}
                  aria-controls={`${idPrefix}-panel`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.value)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isSelected
                      ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id={`${idPrefix}-panel`}
            aria-labelledby={`${idPrefix}-${activeTab}-tab`}
            className="flex flex-col gap-4"
          >
            {activeTab === "overview" ? (
              <OverviewPanel course={course} />
            ) : null}
            {activeTab === "schedule" ? (
              <SchedulePanel courseId={course.id} />
            ) : null}
            {activeTab === "content" ? (
              <ContentPanel courseId={course.id} />
            ) : null}
            {activeTab === "exams" ? <ExamsPanel courseId={course.id} /> : null}
            {activeTab === "attendance" ? (
              <AttendancePanel courseId={course.id} />
            ) : null}
          </div>

          <p className="rounded-lg border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            This course is one of your assignments, shown read-only. There are
            no enrolment, fee or course administration controls, and nothing on
            this page is saved or published.
          </p>

          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function OverviewPanel({ course }: { course: LecturerCourse }) {
  const fillPercent = Math.round(
    (course.enrolledCount / course.capacity) * 100
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow
          icon={MapPinIcon}
          label="Branch and room"
          value={`${course.branch} · ${course.room}`}
        />
        <DetailRow
          icon={course.intake ? CalendarDaysIcon : CalendarClockIcon}
          label={course.intake ? "Intake window" : "Term"}
          value={
            course.intake
              ? `${course.intake.label} · ${formatDateRange(
                  course.intake.startsOn,
                  course.intake.endsOn
                )}`
              : course.term
          }
        />
        <DetailRow
          icon={CalendarClockIcon}
          label="Schedule"
          value={course.scheduleSummary}
        />
        <DetailRow
          icon={course.coTeachers.length > 0 ? UsersRoundIcon : UserRoundIcon}
          label={course.coTeachers.length > 0 ? "Co-teachers" : "Teacher"}
          value={
            course.coTeachers.length > 0
              ? course.coTeachers.join(", ")
              : "Sole teacher"
          }
        />
        <DetailRow
          icon={ClipboardCheckIcon}
          label="Attendance rate"
          value={
            course.attendanceRate !== null
              ? `${course.attendanceRate}% · demo data`
              : "Not tracked"
          }
        />
        <DetailRow
          icon={BookOpenIcon}
          label="Your teaching share"
          value={`${course.sharePercent}%`}
        />
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border p-3">
        <Progress value={fillPercent} className="gap-2">
          <ProgressLabel className="text-xs text-muted-foreground">
            Enrolled {course.enrolledCount} of {course.capacity}
          </ProgressLabel>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {fillPercent}%
          </span>
        </Progress>
        <p className="text-[11px] text-muted-foreground">
          Enrolment counts and capacity are sample data, not live figures.
        </p>
      </div>
    </div>
  )
}

function SchedulePanel({ courseId }: { courseId: string }) {
  const sessions = useMemo(
    () => getLecturerCourseSessions(courseId),
    [courseId]
  )

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClockIcon className="size-5" aria-hidden="true" />}
        title="No sessions yet"
        description="Dated class sessions for this course will appear here once scheduled."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Dated sessions for this course, newest first.
      </p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-col gap-1.5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-medium">
                {formatShortDate(session.date)} ·{" "}
                {formatTimeRange(session.startsAt, session.endsAt)}
              </span>
              <ClassSessionStatusBadge status={session.status} />
            </div>
            <span className="text-xs text-muted-foreground">
              {session.topic}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <DeliveryModeBadge mode={session.deliveryMode} />
              <span className="text-[11px] text-muted-foreground">
                {session.branch} · {session.room}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContentPanel({ courseId }: { courseId: string }) {
  const items = useMemo(() => getLecturerCourseContent(courseId), [courseId])

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BookOpenIcon className="size-5" aria-hidden="true" />}
        title="No assigned content"
        description="Content items placed on this course will appear here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Content items assigned to this course. Publishing and uploads are not
        implemented in this preview.
      </p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1.5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              <LecturerContentStatusBadge status={item.status} />
            </div>
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <MaterialKindBadge kind={item.kind} />
              <MaterialAccessBadge accessType={item.accessType} />
              {item.accessType === "paid" && item.price !== undefined ? (
                <span className="text-xs font-medium tabular-nums">
                  {formatLkr(item.price)}
                </span>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {item.section} · listed {formatDisplayDate(item.listedOn)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExamsPanel({ courseId }: { courseId: string }) {
  const exams = useMemo(() => getLecturerCourseExams(courseId), [courseId])

  if (exams.length === 0) {
    return (
      <EmptyState
        icon={<CircleXIcon className="size-5" aria-hidden="true" />}
        title="No exams for this course"
        description="Exams you own for this course will appear here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Exams owned by you for this course. Publishing, grading and result
        release are not implemented in this preview.
      </p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {exams.map((exam) => (
          <li key={exam.id} className="flex flex-col gap-1.5 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-medium">{exam.title}</span>
              <LecturerExamStatusBadge status={exam.status} />
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDisplayDate(exam.date)} · {exam.durationMinutes} min ·{" "}
              {exam.maxMarks} marks · {exam.enrolledCount} enrolled
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <ExamModeBadge mode={exam.mode} />
              <ExamResultStateBadge state={exam.resultsState} />
              {exam.mode === "online_mcq" ? (
                <span className="text-[11px] text-muted-foreground">
                  {exam.attemptsSubmitted}/{exam.enrolledCount} attempts
                  submitted
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AttendancePanel({ courseId }: { courseId: string }) {
  const attendance = useMemo(
    () => getLecturerCourseAttendance(courseId),
    [courseId]
  )

  if (!attendance) {
    return (
      <EmptyState
        icon={<ClipboardCheckIcon className="size-5" aria-hidden="true" />}
        title="No attendance summary"
        description="Attendance for this course is not tracked in this preview."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Progress value={attendance.rate} className="gap-2">
        <ProgressLabel className="text-xs text-muted-foreground">
          Demo attendance rate
        </ProgressLabel>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {attendance.rate}%
        </span>
      </Progress>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AttendanceTile
          icon={CircleCheckIcon}
          label="Present"
          value={attendance.present}
          tone="emerald"
        />
        <AttendanceTile
          icon={ClockIcon}
          label="Late"
          value={attendance.late}
          tone="amber"
        />
        <AttendanceTile
          icon={CircleXIcon}
          label="Absent"
          value={attendance.absent}
          tone="red"
        />
        <AttendanceTile
          icon={ShieldCheckIcon}
          label="Excused"
          value={attendance.excused}
          tone="sky"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Counts cover {attendance.marked} marked student sessions across{" "}
        {attendance.sessionsTracked} sessions. Figures are sample data, not live
        calculations.
      </p>
    </div>
  )
}

const attendanceToneClasses: Record<string, string> = {
  emerald:
    "border-emerald-600/20 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  amber:
    "border-amber-600/20 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  red: "border-destructive/20 bg-destructive/5 text-destructive dark:border-destructive/30",
  sky: "border-sky-600/20 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
}

function AttendanceTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: keyof typeof attendanceToneClasses
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border p-3", attendanceToneClasses[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      </div>
      <p className="text-xs font-medium">{label}</p>
    </div>
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
        <span className="text-sm">{value}</span>
      </div>
    </div>
  )
}
