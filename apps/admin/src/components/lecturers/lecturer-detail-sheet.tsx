import type { ReactNode } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  BookOpenIcon,
  CircleAlertIcon,
  Link2Icon,
  MapPinIcon,
  PresentationIcon,
  UserRoundIcon,
} from "lucide-react"

import { LecturerPortalBadge } from "@/components/lecturers/lecturer-portal-badge"
import {
  getAssignedCourses,
  getLastLoginLabel,
  getPrimaryBranch,
  type LecturerRecord,
} from "@/lib/lecturers-data"
import { formatDisplayDate, getInitials } from "@/lib/students-data"

type LecturerDetailSheetProps = {
  lecturer: LecturerRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (lecturer: LecturerRecord) => void
}

export function LecturerDetailSheet({
  lecturer,
  open,
  onOpenChange,
  onEdit,
}: LecturerDetailSheetProps) {
  const primaryBranch = lecturer ? getPrimaryBranch(lecturer) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl"
      >
        {lecturer ? (
          <>
            <SheetHeader className="border-b p-6 pr-14">
              <div className="flex items-start gap-3">
                <Avatar size="lg" className="mt-0.5">
                  <AvatarFallback className="text-sm">
                    {getInitials(lecturer.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <SheetTitle className="text-lg">
                    {lecturer.fullName}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{lecturer.qualification}</span>
                    <span aria-hidden="true">·</span>
                    <span>Profile created {formatDisplayDate(lecturer.createdAt)}</span>
                  </SheetDescription>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <LecturerPortalBadge lecturer={lecturer} />
                    {primaryBranch ? (
                      <Badge variant="outline" className="rounded-full">
                        <MapPinIcon data-icon="inline-start" />
                        {primaryBranch.branchName}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="rounded-full">
                      <BookOpenIcon data-icon="inline-start" />
                      {lecturer.assignments.length}{" "}
                      {lecturer.assignments.length === 1 ? "course" : "courses"}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<UserRoundIcon aria-hidden="true" />}
                  title="Profile & qualification"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ProfileField
                    label="Qualification"
                    value={lecturer.qualification}
                  />
                  <ProfileField
                    label="Profile created"
                    value={formatDisplayDate(lecturer.createdAt)}
                  />
                </dl>
                <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Biography
                  </span>
                  <p className="text-sm leading-relaxed">{lecturer.bio}</p>
                </div>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <PresentationIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  The lecturer profile is kept even when portal access is off,
                  so course assignment, commission and history remain intact.
                </p>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<MapPinIcon aria-hidden="true" />}
                  title="Branches"
                />
                <div className="flex flex-wrap gap-1.5">
                  {lecturer.branches.map((branch) => (
                    <Badge
                      key={branch.branchId}
                      variant="secondary"
                      className="rounded-full"
                    >
                      {branch.branchName}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lecturer branch membership is stored separately from the
                  profile. Assignments must belong to a branch the lecturer
                  works in.
                </p>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<BookOpenIcon aria-hidden="true" />}
                  title="Assigned courses"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {lecturer.assignments.length} total
                    </Badge>
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Co-teacher shares are per course and sum to 100%. The share is
                  visible for commission and reporting context; it is not edited
                  from this profile screen.
                </p>

                {lecturer.assignments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {getAssignedCourses(lecturer).map((course) => (
                      <div
                        key={course.courseId}
                        className="flex flex-col gap-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium">
                              {course.courseName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {course.isPrimary
                                ? "Primary lecturer"
                                : "Co-teacher"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {course.isPrimary ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full text-xs"
                              >
                                Primary
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="rounded-full">
                              {course.sharePercent}% share
                            </Badge>
                          </div>
                        </div>

                        {course.coTeachers.length > 0 ? (
                          <div className="flex flex-col gap-1 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
                            <span className="font-medium">Co-teachers</span>
                            {course.coTeachers.map((coTeacher) => (
                              <span key={coTeacher.lecturerId}>
                                {coTeacher.fullName} ·{" "}
                                {coTeacher.sharePercent}% share
                                {coTeacher.isPrimary ? " · primary" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sole lecturer on this course.
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<BookOpenIcon aria-hidden="true" />}
                    title="No course assignments yet"
                    description="The profile exists and can be assigned to a class or program when the timetable is prepared."
                  />
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<Link2Icon aria-hidden="true" />}
                  title="Portal account"
                />
                <div className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        Account access
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {lecturer.portalEnabled
                          ? "Login is enabled for the linked user."
                          : "Login is disabled. The lecturer record remains active."}
                      </span>
                    </div>
                    <LecturerPortalBadge lecturer={lecturer} />
                  </div>

                  {lecturer.portalEnabled && lecturer.userId ? (
                    <dl className="grid grid-cols-1 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                      <ProfileField
                        label="Account email"
                        value={lecturer.accountEmail ?? "—"}
                      />
                      <ProfileField
                        label="Username"
                        value={lecturer.accountUsername ?? "—"}
                      />
                      <ProfileField
                        label="Last login"
                        value={getLastLoginLabel(lecturer)}
                      />
                      <ProfileField label="User record" value="Linked user" />
                    </dl>
                  ) : (
                    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      <CircleAlertIcon
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        No account is linked. To enable portal access, first
                        link or create a user under Users & Roles. Account
                        creation is intentionally not part of this lecturer
                        dialog.
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Portal access controls login only. Disabling it does not
                  delete the lecturer profile, course history or commission
                  records.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-popover p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => onEdit(lecturer)}>
                Edit lecturer
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
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function EmptySection({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-4">
        {icon}
      </div>
      <span className="text-sm font-medium">{title}</span>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
