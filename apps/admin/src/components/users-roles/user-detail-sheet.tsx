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
  Building2Icon,
  CircleAlertIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  KeyRoundIcon,
  Link2Icon,
  MailIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  CREDENTIAL_NOTE,
  MASKED_CREDENTIAL,
  getBranchName,
  getRoleById,
  getRoleNamesForUser,
  isLastRootAdmin,
  isRootAdmin,
  profileKindLabels,
  userStatusLabels,
  type LinkedProfile,
  type RoleRecord,
  type StaffRoleAssignment,
  type UserRecord,
} from "@/lib/users-roles-data"
import {
  formatDateTime,
  formatDisplayDate,
  getInitials,
} from "@/lib/students-data"

type UserDetailSheetProps = {
  user: UserRecord | null
  roles: RoleRecord[]
  assignments: StaffRoleAssignment[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (user: UserRecord) => void
  onNotice: (message: string) => void
}

export function UserDetailSheet({
  user,
  roles,
  assignments,
  open,
  onOpenChange,
  onEdit,
  onNotice,
}: UserDetailSheetProps) {
  const userAssignments = user
    ? assignments.filter((assignment) => assignment.userId === user.id)
    : []
  const roleNames = user ? getRoleNamesForUser(user.id, roles, assignments) : []
  const lastRootAdmin = user ? isLastRootAdmin(user.id, assignments) : false
  const rootAdmin = user ? isRootAdmin(user.id, assignments) : false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl"
      >
        {user ? (
          <>
            <SheetHeader className="border-b p-6 pr-14">
              <div className="flex items-start gap-3">
                <Avatar size="lg" className="mt-0.5">
                  <AvatarFallback className="text-sm">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <SheetTitle className="text-lg">{user.fullName}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{user.email}</span>
                    <span aria-hidden="true">·</span>
                    <span>@{user.username}</span>
                  </SheetDescription>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <UserStatusBadge status={user.status} />
                    <Badge variant="outline" className="rounded-full">
                      {user.isStaff ? (
                        <ShieldCheckIcon data-icon="inline-start" />
                      ) : (
                        <UserRoundIcon data-icon="inline-start" />
                      )}
                      {user.isStaff ? "Staff login" : "Portal login"}
                    </Badge>
                    {rootAdmin ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/20 bg-primary/10 text-primary"
                      >
                        <ShieldCheckIcon data-icon="inline-start" />
                        Root admin
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              {lastRootAdmin ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-400/30 dark:text-amber-300">
                  <CircleAlertIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    This is the only root admin. Disabling the account or
                    removing the root admin role would leave the deployment
                    without one. The demo blocks both actions.
                  </span>
                </div>
              ) : null}

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<UserRoundIcon aria-hidden="true" />}
                  title="Account"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ProfileField label="Email" value={user.email} />
                  <ProfileField label="Username" value={user.username} />
                  <ProfileField
                    label="Phone"
                    value={user.phone ?? "No phone recorded"}
                  />
                  <ProfileField
                    label="Created"
                    value={formatDisplayDate(user.createdAt)}
                  />
                  <ProfileField
                    label="Status"
                    value={userStatusLabels[user.status]}
                  />
                  <ProfileField
                    label="Last login"
                    value={
                      user.lastLoginAt
                        ? formatDateTime(user.lastLoginAt)
                        : "No login recorded"
                    }
                  />
                </dl>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<KeyRoundIcon aria-hidden="true" />}
                  title="Credentials"
                  aside={
                    user.mfaEnabled ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                      >
                        <ShieldCheckIcon data-icon="inline-start" />
                        MFA on
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full">
                        MFA off
                      </Badge>
                    )
                  }
                />
                <div className="flex flex-col gap-3 rounded-lg border p-3">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ProfileField
                      label="Password"
                      value={`${MASKED_CREDENTIAL} (hidden)`}
                    />
                    <ProfileField
                      label="Password changed"
                      value={
                        user.passwordChangedAt
                          ? formatDisplayDate(user.passwordChangedAt)
                          : "Never recorded"
                      }
                    />
                  </dl>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={!user.email}
                    onClick={() =>
                      onNotice(
                        `A reset link would be sent to ${user.email}. Local demo only — no email was sent.`
                      )
                    }
                  >
                    <MailIcon data-icon="inline-start" />
                    Send reset link (demo)
                  </Button>
                </div>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <KeyRoundIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {CREDENTIAL_NOTE}
                </p>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<Link2Icon aria-hidden="true" />}
                  title="Linked profiles"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {user.profiles.length} linked
                    </Badge>
                  }
                />
                {user.profiles.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {user.profiles.map((profile) => (
                      <ProfileRow
                        key={`${profile.kind}-${profile.id}`}
                        profile={profile}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    No lecturer, student or guardian profile is linked. Profile
                    records are managed on their own screens.
                  </p>
                )}
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ShieldCheckIcon aria-hidden="true" />}
                  title="Roles & branches"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {roleNames.length}{" "}
                      {roleNames.length === 1 ? "role" : "roles"}
                    </Badge>
                  }
                />
                {userAssignments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {userAssignments.map((assignment) => {
                      const role = getRoleById(assignment.roleId, roles)

                      return (
                        <div
                          key={assignment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium">
                              {role?.name ?? "Unknown role"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {role?.description ?? "No description"}
                            </span>
                          </div>
                          <BranchBadge branchId={assignment.branchId} />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    No staff role is assigned. Portal logins are not staff
                    roles; grant access from the Assignments tab if needed.
                  </p>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-popover p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => onEdit(user)}>Edit user</Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function UserStatusBadge({ status }: { status: UserRecord["status"] }) {
  if (status === "active") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
      >
        <ShieldCheckIcon aria-hidden="true" />
        Active
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="rounded-full border-border bg-muted text-muted-foreground"
    >
      <CircleAlertIcon aria-hidden="true" />
      Disabled
    </Badge>
  )
}

export function ProfileKindBadge({ kind }: { kind: LinkedProfile["kind"] }) {
  const Icon =
    kind === "lecturer"
      ? GraduationCapIcon
      : kind === "guardian"
        ? HeartHandshakeIcon
        : UserRoundIcon

  return (
    <Badge variant="secondary" className="rounded-full">
      <Icon data-icon="inline-start" />
      {profileKindLabels[kind]}
    </Badge>
  )
}

function ProfileRow({ profile }: { profile: LinkedProfile }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{profile.label}</span>
        <span className="text-xs text-muted-foreground">{profile.hint}</span>
      </div>
      <ProfileKindBadge kind={profile.kind} />
    </div>
  )
}

export function BranchBadge({ branchId }: { branchId: string | null }) {
  const allBranches = branchId === null

  return (
    <Badge
      variant="outline"
      className={
        allBranches
          ? "rounded-full border-primary/20 bg-primary/10 text-primary"
          : "rounded-full"
      }
    >
      <Building2Icon data-icon="inline-start" />
      {getBranchName(branchId)}
    </Badge>
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
      <dd className="text-sm break-words">{value}</dd>
    </div>
  )
}
