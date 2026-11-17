"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  GraduationCapIcon,
  InfoIcon,
  LayersIcon,
  ReceiptTextIcon,
  UsersRoundIcon,
} from "lucide-react"

import {
  CourseStatusBadge,
  IntakeStatusBadge,
} from "@/components/courses/course-status-badge"
import {
  courseKindLabels,
  deliveryModeLabels,
  formatLkr,
  formatTimeValue,
  getCourseEnrollments,
  getCourseEnrollmentCounts,
  getCourseIntakes,
  getCourseSessions,
  getCourseTermLabel,
  getFeeSummary,
  getWeekdayName,
  learningModeLabels,
  type CourseRecord,
} from "@/lib/courses-data"
import { formatDisplayDate as formatDate, getInitials } from "@/lib/students-data"

type CourseDetailSheetProps = {
  course: CourseRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CourseDetailSheet({
  course,
  open,
  onOpenChange,
}: CourseDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-4xl"
      >
        {course ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {course.name}
                <CourseStatusBadge status={course.status} />
              </SheetTitle>
              <SheetDescription>
                {course.courseGroupName ?? courseKindLabels[course.kind]} ·{" "}
                {course.subjectName} · {course.branchName}
              </SheetDescription>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="rounded-full">
                  {courseKindLabels[course.kind]}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {learningModeLabels[course.learningMode]}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {deliveryModeLabels[course.deliveryMode]}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {course.gradeNames.length > 0
                    ? course.gradeNames.join(", ")
                    : "Not grade-bound"}
                </Badge>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading icon={<InfoIcon />} title="Overview" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField label="Branch" value={course.branchName} />
                  <ProfileField label="Subject" value={course.subjectName} />
                  <ProfileField
                    label="Course group"
                    value={course.courseGroupName ?? "—"}
                  />
                  <ProfileField
                    label="Batch label"
                    value={course.batchLabel ?? "—"}
                  />
                  <ProfileField
                    label="Term / intake"
                    value={getCourseTermLabel(course)}
                  />
                  <ProfileField
                    label="Delivery"
                    value={deliveryModeLabels[course.deliveryMode]}
                  />
                  <ProfileField
                    label="Attendance"
                    value={
                      course.attendanceEnabled
                        ? "Enabled"
                        : "Not applicable (self-paced)"
                    }
                  />
                  <ProfileField
                    label="Capacity"
                    value={
                      course.capacity === null
                        ? "No capacity limit"
                        : `${course.capacity} seats`
                    }
                  />
                  <ProfileField
                    label="Created"
                    value={formatDate(course.createdAt)}
                  />
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<UsersRoundIcon />}
                  title="Teachers and shares"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {course.lecturers.length}{" "}
                      {course.lecturers.length === 1 ? "teacher" : "teachers"} ·
                      shares total{" "}
                      {course.lecturers.reduce(
                        (total, item) => total + item.sharePercent,
                        0
                      )}
                      %
                    </span>
                  }
                />
                {course.lecturers.length > 0 ? (
                  <div className="flex flex-col divide-y rounded-lg border">
                    {course.lecturers.map((item) => (
                      <div
                        key={item.lecturerId}
                        className="flex items-center gap-3 p-3"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {getInitials(item.fullName)}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {item.fullName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.isPrimary
                              ? "Primary teacher"
                              : "Co-teacher"}
                          </span>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {item.sharePercent}% share
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<UsersRoundIcon />}
                    message="No teacher assigned yet"
                    hint="Assign at least one teacher with a revenue share before publishing the course."
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Shares apply to course revenue and should total 100% for
                  co-taught courses. This demo shows shares only.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<LayersIcon />}
                  title="Grade eligibility"
                />
                {course.gradeNames.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {course.gradeNames.map((gradeName) => (
                      <Badge
                        key={gradeName}
                        variant="outline"
                        className="rounded-full"
                      >
                        {gradeName}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      Used for promotion proposals and fee rates.
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Programs are not grade-bound, so no grade eligibility is
                    attached.
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CalendarClockIcon />}
                  title="Schedule and sessions"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {course.attendanceEnabled
                        ? "Attendance enabled"
                        : "No attendance"}
                    </Badge>
                  }
                />

                {course.slots.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <div className="flex flex-col divide-y">
                      {course.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <CalendarClockIcon
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="font-medium">
                              {getWeekdayName(slot.weekday)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatTimeValue(slot.startsAt)} –{" "}
                              {formatTimeValue(slot.endsAt)}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {slot.room
                              ? `Room ${slot.room}`
                              : course.deliveryMode === "online"
                                ? "Online"
                                : "Room not set"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Self-paced programs have no weekly schedule and no
                      attendance register. Learners work through the material
                      in their own time.
                    </span>
                  </div>
                )}

                {course.attendanceEnabled ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Sample sessions
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Weekly slots are templates, not attendance events
                      </span>
                    </div>
                    <div className="flex flex-col divide-y rounded-lg border">
                      {getCourseSessions(course).map((session) => (
                        <div
                          key={session.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">
                              {formatDate(session.sessionDate)} ·{" "}
                              {formatTimeValue(session.startsAt)} –{" "}
                              {formatTimeValue(session.endsAt)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {session.topic}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full",
                                session.status === "held"
                                  ? "text-muted-foreground"
                                  : "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                              )}
                            >
                              {session.status === "held" ? "Held" : "Scheduled"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {session.meetingProvider
                                ? `${deliveryModeLabels[session.deliveryMode]} · meeting link ready`
                                : deliveryModeLabels[session.deliveryMode]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<GraduationCapIcon />}
                  title="Enrollments"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {getCourseEnrollmentCounts(course.id).active} active ·{" "}
                      {getCourseEnrollmentCounts(course.id).completed} completed
                    </span>
                  }
                />
                {(() => {
                  const enrollments = getCourseEnrollments(course.id)

                  if (enrollments.length === 0) {
                    return (
                      <EmptySection
                        icon={<GraduationCapIcon />}
                        message="No enrollments in the sample data"
                        hint="Students appear here after they are enrolled in this course."
                      />
                    )
                  }

                  return (
                    <div className="flex flex-col divide-y rounded-lg border">
                      {enrollments.map((enrollment) => (
                        <div
                          key={enrollment.id}
                          className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">
                              {enrollment.studentName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {enrollment.studentNo} · enrolled{" "}
                              {formatDate(enrollment.enrolledOn)}
                              {enrollment.intakeName
                                ? ` · ${enrollment.intakeName}`
                                : ""}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="rounded-full capitalize"
                            >
                              {enrollment.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {enrollment.feeSummary}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <p className="text-xs text-muted-foreground">
                  Enrollments are read-only in this demo. Enrollment changes are
                  handled from the student record.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ReceiptTextIcon />}
                  title="Fee option and rates"
                  aside={
                    <Badge
                      variant="outline"
                      className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                    >
                      Default option
                    </Badge>
                  }
                />
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">
                        {course.fee.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {course.fee.billingType === "recurring"
                          ? `Recurring · ${
                              course.fee.frequency === "per_term"
                                ? "per term"
                                : "monthly"
                            }`
                          : "One-time package"}
                        {course.fee.gradeName
                          ? ` · ${course.fee.gradeName} rate`
                          : " · All grades"}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatLkr(course.fee.amount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>
                      Billing summary{" "}
                      <span className="text-foreground">
                        {getFeeSummary(course.fee)}
                      </span>
                    </span>
                    <span>
                      Effective from{" "}
                      <span className="text-foreground">
                        {formatDate(course.fee.effectiveFrom)}
                      </span>
                    </span>
                    {course.fee.accessDurationMonths !== null ? (
                      <span>
                        Access{" "}
                        <span className="text-foreground">
                          {course.fee.accessDurationMonths} months from
                          enrollment
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A class has one default fee option. Enrolling attaches it
                  automatically, and fee exceptions are managed separately.
                </p>
              </section>

              {course.kind === "program" ? (
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<CalendarRangeIcon />}
                    title="Intakes"
                    aside={
                      <span className="text-xs text-muted-foreground">
                        {learningModeLabels[course.learningMode]}
                      </span>
                    }
                  />
                  {course.learningMode === "self_paced" ? (
                    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                      <InfoIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Self-paced programs do not need an intake. Access starts
                        on enrollment and follows the package duration.
                      </span>
                    </div>
                  ) : (
                    (() => {
                      const intakes = getCourseIntakes(course.id)

                      if (intakes.length === 0) {
                        return (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                            <InfoIcon
                              className="mt-0.5 size-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              Scheduled programs need an intake before students
                              can enroll. No intake exists for this course yet.
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div className="flex flex-col divide-y rounded-lg border">
                          {intakes.map((intake) => (
                            <div
                              key={intake.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                            >
                              <div className="flex min-w-0 flex-col">
                                <span className="text-sm font-medium">
                                  {intake.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(intake.startsOn)} –{" "}
                                  {intake.endsOn
                                    ? formatDate(intake.endsOn)
                                    : "open-ended"}
                                  {intake.capacity !== null
                                    ? ` · ${intake.capacity} seats`
                                    : ""}
                                </span>
                              </div>
                              <IntakeStatusBadge status={intake.status} />
                            </div>
                          ))}
                        </div>
                      )
                    })()
                  )}
                  <p className="text-xs text-muted-foreground">
                    Intake dates are display-inclusive last days. Intakes belong
                    to one program and keep their own capacity.
                  </p>
                </section>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample course record · no changes are saved
              </span>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SectionHeading({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm" title={value}>
        {value}
      </dd>
    </div>
  )
}

function EmptySection({
  icon,
  message,
  hint,
}: {
  icon: ReactNode
  message: string
  hint: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-4">
        {icon}
      </div>
      <span className="text-sm font-medium">{message}</span>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}
