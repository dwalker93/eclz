"use client"

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
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  InfoIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  CourseStatusBadge,
  DeliveryModeBadge,
} from "@/components/portal-status-badge"
import {
  type ParentChild,
  type ParentChildCourse,
} from "@/lib/parent-portal-data"
import {
  formatDateRange,
  formatDisplayDate,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

const courseGroups: Array<{
  status: ParentChildCourse["status"]
  title: string
  description: string
}> = [
  {
    status: "active",
    title: "Active enrolments",
    description: "Courses this child is currently attending.",
  },
  {
    status: "completed",
    title: "Completed courses",
    description: "Enrolments this child has finished.",
  },
  {
    status: "dropped",
    title: "Dropped enrolments",
    description: "Enrolments the institute has closed.",
  },
]

export function ParentCourses() {
  const { children: linkedChildren, selectedChild } = useParentChild()

  const courses = selectedChild?.courses ?? []
  const activeCourseCount = courses.filter(
    (course) => course.status === "active"
  ).length

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Courses"
          description="Courses and enrolments for the child selected in the header. This parent view is read-only and never exposes lecturer controls or enrolment changes."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
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

        {linkedChildren.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no courses to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : (
          <>
            {selectedChild ? (
              <>
                <ChildContext
                  child={selectedChild}
                  activeCourseCount={activeCourseCount}
                />

                {courses.length === 0 ? (
                  <Card className="gap-0 py-0">
                    <EmptyState
                      icon={
                        <BookOpenIcon className="size-5" aria-hidden="true" />
                      }
                      title="No enrolments recorded"
                      description={`No course enrolment is recorded for ${selectedChild.preferredName}. Contact the branch office if you expected a course to appear here.`}
                    />
                  </Card>
                ) : (
                  courseGroups.map((group) => {
                    const groupCourses = courses.filter(
                      (course) => course.status === group.status
                    )

                    if (groupCourses.length === 0) return null

                    return (
                      <section
                        key={group.status}
                        aria-labelledby={`parent-courses-${group.status}`}
                        className="flex flex-col gap-3"
                      >
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <h2
                              id={`parent-courses-${group.status}`}
                              className="text-lg font-semibold tracking-tight"
                            >
                              {group.title}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {group.description}
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {groupCourses.length}{" "}
                            {groupCourses.length === 1 ? "course" : "courses"}
                          </Badge>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {groupCourses.map((course) => (
                            <ParentCourseCard
                              key={course.id}
                              course={course}
                              child={selectedChild}
                            />
                          ))}
                        </div>
                      </section>
                    )
                  })
                )}

                <Card className="gap-0 py-0">
                  <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Course enrolment, lecturer assignments and intake dates
                      are managed by the institute. This parent page uses local
                      sample data and is read-only: there are no lecturer-only
                      controls, no enrolment changes and no student-only
                      actions.
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

function ChildContext({
  child,
  activeCourseCount,
}: {
  child: ParentChild
  activeCourseCount: number
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="size-12">
            <AvatarFallback>{child.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                {child.fullName}
              </h2>
              <Badge variant="outline" className="rounded-full">
                {child.relationship}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {child.studentNo} · {child.grade} · {child.branch} branch
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            {activeCourseCount} active{" "}
            {activeCourseCount === 1 ? "course" : "courses"}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 rounded-full">
            <ShieldCheckIcon aria-hidden="true" />
            Read-only
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
        Showing only {child.preferredName}&apos;s enrolments. Sibling courses
        are never combined on this page.
      </CardFooter>
    </Card>
  )
}

function ParentCourseCard({
  course,
  child,
}: {
  course: ParentChildCourse
  child: ParentChild
}) {
  const closure = getClosureSummary(course)

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
            label={course.lecturers.length > 1 ? "Lecturers" : "Lecturer"}
            value={course.lecturers.join(", ")}
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
            icon={CalendarDaysIcon}
            label="Enrolled"
            value={formatDisplayDate(course.enrolledOn)}
          />
          {course.intake ? (
            <CourseFact
              icon={BookOpenIcon}
              label={`Intake · ${course.intake.label}`}
              value={formatDateRange(
                course.intake.startsOn,
                course.intake.endsOn
              )}
            />
          ) : null}
        </dl>

        {closure ? (
          <div
            className={cn(
              "mt-auto rounded-lg border p-2.5",
              course.status === "dropped"
                ? "border-destructive/20 bg-destructive/5"
                : "border-border bg-muted/40"
            )}
          >
            <p className="text-xs font-medium">{closure.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {closure.value}
            </p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
          Read-only parent view for {child.preferredName}
        </span>
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
        <dd className="text-sm wrap-break-word">{value}</dd>
      </div>
    </div>
  )
}

function getClosureSummary(course: ParentChildCourse) {
  if (course.status === "completed") {
    return {
      label: "Completed",
      value: course.completedOn
        ? `Completed on ${formatDisplayDate(course.completedOn)}.`
        : "This enrolment has been completed.",
    }
  }

  if (course.status === "dropped") {
    return {
      label: "Enrolment closed",
      value:
        course.dropNote ??
        (course.droppedOn
          ? `Dropped on ${formatDisplayDate(course.droppedOn)}.`
          : "This enrolment was closed by the institute."),
    }
  }

  return null
}
