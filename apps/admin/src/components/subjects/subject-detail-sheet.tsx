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
  LibraryBigIcon,
  MapPinIcon,
  PresentationIcon,
  UsersRoundIcon,
} from "lucide-react"

import { CourseStatusBadge } from "@/components/courses/course-status-badge"
import {
  courseKindLabels,
  deliveryModeLabels,
  getCourseTermLabel,
} from "@/lib/courses-data"
import {
  getSubjectCourses,
  getSubjectLecturers,
  type SubjectDirectoryRecord,
} from "@/lib/subjects-data"
import { getInitials } from "@/lib/students-data"

type SubjectDetailSheetProps = {
  subject: SubjectDirectoryRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubjectDetailSheet({
  subject,
  open,
  onOpenChange,
}: SubjectDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {subject ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {subject.name}
                {subject.code ? (
                  <Badge variant="outline" className="rounded-full">
                    {subject.code}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="rounded-full text-muted-foreground"
                  >
                    No code
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                {subject.courseCount}{" "}
                {subject.courseCount === 1 ? "course" : "courses"} ·{" "}
                {subject.lecturerCount}{" "}
                {subject.lecturerCount === 1 ? "teacher" : "teachers"}
                {subject.branchNames.length > 0
                  ? ` · ${subject.branchNames.join(", ")}`
                  : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading icon={<LibraryBigIcon />} title="Overview" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField
                    label="Code"
                    value={subject.code ?? "No code set"}
                  />
                  <ProfileField
                    label="Courses"
                    value={String(subject.courseCount)}
                  />
                  <ProfileField
                    label="Teachers"
                    value={String(subject.lecturerCount)}
                  />
                  <ProfileField
                    label="Classes"
                    value={String(subject.classCount)}
                  />
                  <ProfileField
                    label="Programs"
                    value={String(subject.programCount)}
                  />
                  <ProfileField
                    label="Branches"
                    value={
                      subject.branchNames.length > 0
                        ? subject.branchNames.join(", ")
                        : "No branches yet"
                    }
                  />
                </dl>
                <p className="text-xs text-muted-foreground">
                  A subject stores only its code and name. Course, teacher and
                  branch figures are derived from the courses that reference it.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<BookOpenIcon />}
                  title="Related courses"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {subject.courseCount}{" "}
                      {subject.courseCount === 1 ? "course" : "courses"}
                    </span>
                  }
                />
                {(() => {
                  const related = getSubjectCourses(subject.id)

                  if (related.length === 0) {
                    return (
                      <EmptySection
                        icon={<BookOpenIcon />}
                        message="No courses use this subject yet"
                        hint="Courses appear here once a class or program is created with this subject."
                      />
                    )
                  }

                  return (
                    <div className="flex flex-col divide-y rounded-lg border">
                      {related.map((course) => (
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
                            <span>{deliveryModeLabels[course.deliveryMode]}</span>
                            <span>{getCourseTermLabel(course)}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {course.lecturers.length > 0 ? (
                              course.lecturers.map((lecturer) => (
                                <span key={lecturer.lecturerId}>
                                  {lecturer.fullName} · {lecturer.sharePercent}%
                                  {lecturer.isPrimary ? " (primary)" : ""}
                                </span>
                              ))
                            ) : (
                              <span>No teacher assigned</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<PresentationIcon />}
                  title="Assigned lecturers"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {subject.lecturerCount}{" "}
                      {subject.lecturerCount === 1 ? "teacher" : "teachers"}
                    </span>
                  }
                />
                {(() => {
                  const assigned = getSubjectLecturers(subject.id)

                  if (assigned.length === 0) {
                    return (
                      <EmptySection
                        icon={<UsersRoundIcon />}
                        message="No teachers assigned"
                        hint="Teachers are assigned per course, so they appear here when a course using this subject has a teacher."
                      />
                    )
                  }

                  return (
                    <div className="flex flex-col divide-y rounded-lg border">
                      {assigned.map((lecturer) => (
                        <div
                          key={lecturer.lecturerId}
                          className="flex items-center gap-3 p-3"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {getInitials(lecturer.fullName)}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">
                              {lecturer.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {lecturer.courseCount}{" "}
                              {lecturer.courseCount === 1 ? "course" : "courses"}{" "}
                              in this subject
                            </span>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {lecturer.primaryCount > 0
                              ? `Primary on ${lecturer.primaryCount}`
                              : "Co-teacher"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <p className="text-xs text-muted-foreground">
                  Teacher assignments and revenue shares belong to each course
                  record, not to the subject.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample subject record · no changes are saved
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