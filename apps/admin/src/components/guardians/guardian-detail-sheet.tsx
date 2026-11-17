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
  CircleAlertIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  Link2Icon,
  PhoneIcon,
} from "lucide-react"

import { GuardianPortalBadge } from "@/components/guardians/guardian-portal-badge"
import {
  getLinkedStudents,
  getPrimaryLink,
  type GuardianRecord,
} from "@/lib/guardians-data"
import {
  formatDisplayDate,
  formatDateTime,
  getInitials,
} from "@/lib/students-data"

type GuardianDetailSheetProps = {
  guardian: GuardianRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (guardian: GuardianRecord) => void
}

export function GuardianDetailSheet({
  guardian,
  open,
  onOpenChange,
  onEdit,
}: GuardianDetailSheetProps) {
  const linkedStudents = guardian ? getLinkedStudents(guardian) : []
  const primaryLink = guardian ? getPrimaryLink(guardian) : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl"
      >
        {guardian ? (
          <>
            <SheetHeader className="border-b p-6 pr-14">
              <div className="flex items-start gap-3">
                <Avatar size="lg" className="mt-0.5">
                  <AvatarFallback className="text-sm">
                    {getInitials(guardian.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <SheetTitle className="text-lg">
                    {guardian.fullName}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      Guardian since {formatDisplayDate(guardian.createdAt)}
                    </span>
                    {guardian.phone ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{guardian.phone}</span>
                      </>
                    ) : null}
                  </SheetDescription>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <GuardianPortalBadge guardian={guardian} />
                    <Badge variant="outline" className="rounded-full">
                      <GraduationCapIcon data-icon="inline-start" />
                      {linkedStudents.length}{" "}
                      {linkedStudents.length === 1 ? "student" : "students"}
                    </Badge>
                    {primaryLink?.isPrimary ? (
                      <Badge variant="secondary" className="rounded-full">
                        Primary guardian
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<PhoneIcon aria-hidden="true" />}
                  title="Contact & identity"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ProfileField
                    label="Phone"
                    value={guardian.phone ?? "No phone recorded"}
                  />
                  <ProfileField
                    label="Email"
                    value={guardian.email ?? "No email recorded"}
                  />
                  <ProfileField
                    label="NIC"
                    value={guardian.nic ?? "No NIC recorded"}
                  />
                  <ProfileField
                    label="Guardian since"
                    value={formatDisplayDate(guardian.createdAt)}
                  />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Address
                    </dt>
                    <dd className="text-sm">
                      {guardian.address ?? "No address recorded"}
                    </dd>
                  </div>
                </dl>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <HeartHandshakeIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  A guardian profile can exist without a login or a linked
                  student. Neither is required for the record to be kept.
                </p>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<GraduationCapIcon aria-hidden="true" />}
                  title="Linked students"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {linkedStudents.length} linked
                    </Badge>
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Each link carries its own relationship and primary flag. A
                  student can have only one primary guardian, but one guardian
                  may be linked to several students.
                </p>

                {linkedStudents.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {linkedStudents.map((student) => (
                      <div
                        key={student.studentId}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {student.fullName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {student.studentNo} ·{" "}
                            {student.gradeName ?? "No current grade"} ·{" "}
                            {student.branchName ?? "No branch"}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="rounded-full">
                              {student.relationship}
                            </Badge>
                            {student.isPrimary ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-primary/30 bg-primary/5 text-primary"
                              >
                                Primary
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                Additional guardian
                              </Badge>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    icon={<HeartHandshakeIcon aria-hidden="true" />}
                    title="Not linked to a student yet"
                    description="The guardian profile is kept standalone. Link a student from the edit dialog once the relationship is confirmed."
                  />
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<Link2Icon aria-hidden="true" />}
                  title="Parent portal account"
                />
                <div className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        Account access
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {guardian.portalEnabled
                          ? "Login is enabled for the linked user."
                          : "Login is disabled. The guardian record and student links remain active."}
                      </span>
                    </div>
                    <GuardianPortalBadge guardian={guardian} />
                  </div>

                  {guardian.portalEnabled && guardian.userId ? (
                    <dl className="grid grid-cols-1 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                      <ProfileField
                        label="Account email"
                        value={guardian.accountEmail ?? "—"}
                      />
                      <ProfileField label="User record" value="Linked user" />
                      <ProfileField
                        label="Last login"
                        value={
                          guardian.lastLoginAt
                            ? formatDateTime(guardian.lastLoginAt)
                            : "No login recorded"
                        }
                      />
                      <ProfileField
                        label="Parent portal module"
                        value="Required for login"
                      />
                    </dl>
                  ) : (
                    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      <CircleAlertIcon
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        No parent portal account is linked. Login also needs the
                        parent portal module and a user created under Users &amp;
                        Roles. Account creation is intentionally not part of
                        this guardian dialog.
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Portal access controls parent login only. Disabling it does
                  not delete the guardian profile, contact details or student
                  relationships.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-popover p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => onEdit(guardian)}>Edit guardian</Button>
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
