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
import {
  BookOpenIcon,
  LayersIcon,
  MapPinIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
} from "lucide-react"

import { CourseStatusBadge } from "@/components/courses/course-status-badge"
import { GradeStageBadge } from "@/components/grade-levels/grade-stage-badge"
import { StudentStatusBadge } from "@/components/students/student-status-badge"
import { courseKindLabels, deliveryModeLabels } from "@/lib/courses-data"
import {
  getGradeLevelCourses,
  getStudentsInGrade,
  type GradeLevelDirectoryRecord,
} from "@/lib/grade-levels-data"
import { getInitials, getPrimaryBranch } from "@/lib/students-data"

type GradeLevelDetailSheetProps = {
  gradeLevel: GradeLevelDirectoryRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GradeLevelDetailSheet({
  gradeLevel,
  open,
  onOpenChange,
}: GradeLevelDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {gradeLevel ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {gradeLevel.name}
                <GradeStageBadge stage={gradeLevel.stage} />
              </SheetTitle>
              <SheetDescription>
                Ordinal {gradeLevel.ordinal} of the promotion order ·{" "}
                {gradeLevel.studentCount}{" "}
                {gradeLevel.studentCount === 1 ? "student" : "students"} ·{" "}
                {gradeLevel.courseCount}{" "}
                {gradeLevel.courseCount === 1 ? "course" : "courses"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading icon={<LayersIcon />} title="Overview" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField label="Name" value={gradeLevel.name} />
                  <ProfileField
                    label="Stage"
                    value={<GradeStageBadge stage={gradeLevel.stage} />}
                  />
                  <ProfileField
                    label="Ordinal"
                    value={String(gradeLevel.ordinal)}
                  />
                  <ProfileField
                    label="Previous grade"
                    value={gradeLevel.previousGradeName ?? "None (first)"}
                  />
                  <ProfileField
                    label="Next grade"
                    value={gradeLevel.nextGradeName ?? "None (highest)"}
                  />
                  <ProfileField
                    label="Courses"
                    value={String(gradeLevel.courseCount)}
                  />
                </dl>
                <p className="text-xs text-muted-foreground">
                  Display order and the next grade used by promotion both come
                  from the ordinal. Counts on this page are derived from the
                  shared mock students and courses, not stored on the grade
                  level row.
                </p>
              </section>

              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Reordering grade levels changes the next-grade proposal in a
                  promotion run. This is a UI-only demo; no order is changed.
                </span>
              </div>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<UsersRoundIcon />}
                  title="Students currently in this grade"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {gradeLevel.studentCount}{" "}
                      {gradeLevel.studentCount === 1 ? "student" : "students"}
                    </span>
                  }
                />
                {(() => {
                  const currentStudents = getStudentsInGrade(gradeLevel.id)

                  if (currentStudents.length === 0) {
                    return (
                      <EmptySection
                        icon={<UsersRoundIcon />}
                        message="No students are currently in this grade"
                        hint="Students appear here when their current student_level history row points at this grade. The grade is not stored on the student profile."
                      />
                    )
                  }

                  return (
                    <div className="flex flex-col divide-y rounded-lg border">
                      {currentStudents.map((student) => {
                        const primaryBranch = getPrimaryBranch(student)

                        return (
                          <div
                            key={student.id}
                            className="flex flex-wrap items-center gap-3 p-3"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                              {getInitials(student.fullName)}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-medium">
                                {student.fullName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {student.studentNo}
                                {primaryBranch
                                  ? ` · ${primaryBranch.branchName}`
                                  : ""}
                              </span>
                            </div>
                            <StudentStatusBadge status={student.status} />
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
                <p className="text-xs text-muted-foreground">
                  Current grade context comes from the dated{" "}
                  <code>student_level</code> history (from/to dates), not a
                  grade field on the student profile.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<BookOpenIcon />}
                  title="Courses serving this grade"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {gradeLevel.courseCount}{" "}
                      {gradeLevel.courseCount === 1 ? "course" : "courses"}
                    </span>
                  }
                />
                {(() => {
                  const relatedCourses = getGradeLevelCourses(gradeLevel.id)

                  if (relatedCourses.length === 0) {
                    return (
                      <EmptySection
                        icon={<BookOpenIcon />}
                        message="No courses serve this grade yet"
                        hint="Courses appear here when their course_grade_level links include this grade."
                      />
                    )
                  }

                  return (
                    <div className="flex flex-col divide-y rounded-lg border">
                      {relatedCourses.map((course) => (
                        <div
                          key={course.id}
                          className="flex flex-col gap-1.5 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {course.name}
                            </span>
                            <CourseStatusBadge status={course.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{courseKindLabels[course.kind]}</span>
                            <span className="flex items-center gap-1">
                              <MapPinIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              {course.branchName}
                            </span>
                            <span>
                              {deliveryModeLabels[course.deliveryMode]}
                            </span>
                            {course.gradeNames.length > 1 ? (
                              <span>
                                Also:{" "}
                                {course.gradeNames
                                  .filter((name) => name !== gradeLevel.name)
                                  .join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <p className="text-xs text-muted-foreground">
                  A course can serve several grades through{" "}
                  <code>course_grade_level</code>; classes normally serve one
                  grade each.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample grade level · no changes are saved
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

function ProfileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
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
