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
  CalendarDaysIcon,
  CircleAlertIcon,
  HeartHandshakeIcon,
  Link2Icon,
  MapPinIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react"

import { StudentStatusBadge } from "@/components/students/student-status-badge"
import {
  calculateAge,
  formatDisplayDate,
  getActiveEnrollmentCount,
  getGradeAsOf,
  getInitials,
  getPrimaryBranch,
  GUARDIAN_REQUIRED_BELOW_AGE,
  hasEffectiveAccess,
  isGuardianRequired,
  stageLabel,
  type StudentEnrollment,
  type StudentRecord,
} from "@/lib/students-data"

type StudentDetailSheetProps = {
  student: StudentRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentDetailSheet({
  student,
  open,
  onOpenChange,
}: StudentDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl"
      >
        {student ? (
          <>
            <SheetHeader className="border-b p-6 pr-14">
              <div className="flex items-start gap-3">
                <Avatar size="lg" className="mt-0.5">
                  <AvatarFallback className="text-sm">
                    {getInitials(student.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <SheetTitle className="text-lg">
                    {student.fullName}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{student.studentNo}</span>
                    <span aria-hidden="true">·</span>
                    <span>Created {formatDisplayDate(student.createdAt)}</span>
                  </SheetDescription>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StudentStatusBadge status={student.status} />
                    <Badge variant="outline" className="rounded-full">
                      <MapPinIcon data-icon="inline-start" />
                      {getPrimaryBranch(student)?.branchName ?? "No branch"}
                    </Badge>
                    {student.portalLinked ? (
                      <Badge
                        variant="outline"
                        className="rounded-full text-muted-foreground"
                      >
                        <Link2Icon data-icon="inline-start" />
                        Portal linked
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<UserRoundIcon aria-hidden="true" />}
                  title="Profile & contact"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ProfileField
                    label="Date of birth"
                    value={`${formatDisplayDate(student.dateOfBirth)} (age ${calculateAge(
                      student.dateOfBirth
                    )})`}
                  />
                  <ProfileField
                    label="Gender"
                    value={student.gender ?? "Not recorded"}
                  />
                  <ProfileField
                    label="School"
                    value={student.schoolName ?? "Not recorded"}
                  />
                  <ProfileField
                    label="NIC"
                    value={student.nic ?? "Not recorded"}
                  />
                  <ProfileField
                    label="Email"
                    value={student.contactEmail ?? "No email recorded"}
                  />
                  <ProfileField
                    label="Phone"
                    value={student.contactPhone ?? "No phone recorded"}
                  />
                </dl>

                <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Link2Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Portal account
                    </span>
                    {student.portalLinked ? (
                      <Badge
                        variant="outline"
                        className="gap-1.5 rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        <ShieldCheckIcon aria-hidden="true" />
                        Linked user
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full">
                        No login linked
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {student.portalLinked
                      ? `Portal entry uses the linked user ${student.portalEmail ?? "account"}.`
                      : "The student can be invited to the portal later. The student record exists without a login."}
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <QrCodeIcon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Student card</span>
                      <Badge variant="outline" className="rounded-full">
                        {student.qrCardIssued
                          ? "QR card issued"
                          : "QR card not issued"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The QR token is generated server-side and is never shown
                      in the admin UI.
                    </p>
                  </div>
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<MapPinIcon aria-hidden="true" />}
                  title="Branches"
                />
                <div className="divide-y rounded-lg border">
                  {student.branches.map((item) => (
                    <div
                      key={item.branchId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {item.branchName}
                        </span>
                        {item.isPrimary ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full text-xs"
                          >
                            Primary
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Joined {formatDisplayDate(item.joinedOn)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<HeartHandshakeIcon aria-hidden="true" />}
                  title="Guardians"
                />
                <p className="text-sm text-muted-foreground">
                  At least one guardian with name, phone and address is required
                  when a student is below age {GUARDIAN_REQUIRED_BELOW_AGE} at
                  registration. Guardians do not need a portal login.
                </p>

                {student.guardians.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {student.guardians.map((guardian) => (
                      <div
                        key={guardian.id}
                        className="flex flex-col gap-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {guardian.fullName}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {guardian.relationship}
                            </span>
                            {guardian.isPrimary ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full text-xs"
                              >
                                Primary
                              </Badge>
                            ) : null}
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {guardian.portalEnabled
                              ? "Parent portal on"
                              : "No parent portal"}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span>{guardian.phone}</span>
                          {guardian.email ? (
                            <span>{guardian.email}</span>
                          ) : null}
                          <span>{guardian.address}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<HeartHandshakeIcon aria-hidden="true" />}
                    title="No guardians linked"
                    description={
                      isGuardianRequired(student.dateOfBirth)
                        ? "A guardian is required for this student's age at registration."
                        : "Optional for students aged 16 or older at registration. The student record remains valid without a guardian."
                    }
                  />
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CalendarDaysIcon aria-hidden="true" />}
                  title="Grade history"
                  aside={
                    getGradeAsOf(student) ? (
                      <Badge variant="outline" className="rounded-full">
                        Current: {getGradeAsOf(student)?.gradeName}
                      </Badge>
                    ) : null
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Grade on a date is read from this history, not stored on the
                  student profile. Ranges are start-inclusive and end-exclusive.
                </p>

                {student.grades.length > 0 ? (
                  <div className="divide-y rounded-lg border">
                    {student.grades.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {item.gradeName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {stageLabel(item.stage)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">
                            {item.reason}
                          </span>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{formatDisplayDate(item.fromDate)}</div>
                          <div>
                            {item.toDate
                              ? `until ${formatDisplayDate(item.toDate)}`
                              : "Current"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<CalendarDaysIcon aria-hidden="true" />}
                    title="No grade on record"
                    description="Adults can enrol in programs without a grade. A grade is required only for class enrolments with grade-based fees."
                  />
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<UsersRoundIcon aria-hidden="true" />}
                  title="Enrollments & access"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {getActiveEnrollmentCount(student)} active
                    </Badge>
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Access end dates are exclusive — they mark the first day
                  without access. Billing restrictions are a separate overlay on
                  the enrolment.
                </p>

                {student.enrollments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {student.enrollments.map((item) => (
                      <EnrollmentCard key={item.id} enrollment={item} />
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<UsersRoundIcon aria-hidden="true" />}
                    title="No enrollments"
                    description="This student is not enrolled in any class or program yet."
                  />
                )}
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-popover p-4">
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
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function EnrollmentCard({ enrollment }: { enrollment: StudentEnrollment }) {
  const accessIsEffective = hasEffectiveAccess(enrollment)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{enrollment.courseName}</span>
          <span className="text-xs text-muted-foreground">
            {enrollment.kind === "class" ? "Class" : "Program"} ·{" "}
            {enrollment.branchName}
            {enrollment.intakeName ? ` · ${enrollment.intakeName}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="rounded-full capitalize">
            {enrollment.status}
          </Badge>
          <Badge
            variant="outline"
            className={
              accessIsEffective
                ? "rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "rounded-full text-muted-foreground"
            }
          >
            {enrollment.accessStatus === "restricted"
              ? "Restricted"
              : accessIsEffective
                ? "Access active"
                : "No access"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span>
          Enrolled{" "}
          <span className="text-foreground">
            {formatDisplayDate(enrollment.enrolledOn)}
          </span>
        </span>
        <span>
          Fee <span className="text-foreground">{enrollment.feeSummary}</span>
        </span>
        <span>
          Access from{" "}
          <span className="text-foreground">
            {formatDisplayDate(enrollment.accessStartsOn)}
          </span>
        </span>
        <span>
          Access ends{" "}
          <span className="text-foreground">
            {enrollment.accessEndsOn
              ? formatDisplayDate(enrollment.accessEndsOn)
              : "Ongoing / lifetime"}
          </span>
        </span>
      </div>

      {enrollment.endReason ? (
        <span className="text-xs text-muted-foreground capitalize">
          Ended: {enrollment.endReason.replaceAll("_", " ")}
        </span>
      ) : null}

      {enrollment.accessStatus === "restricted" ? (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
          <CircleAlertIcon
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            Access restricted by the overdue billing overlay. The enrolment and
            its invoices remain on record.
          </span>
        </div>
      ) : null}
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
