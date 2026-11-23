"use client"

import { useMemo, useState, type FormEvent } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  GraduationCapIcon,
  InfoIcon,
  LockKeyholeIcon,
  MailIcon,
  PenLineIcon,
  PhoneIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  lecturer,
  lecturerCourses,
  lecturerModules,
} from "@/lib/lecturer-portal-data"
import { formatDisplayDate, MOCK_TODAY } from "@/lib/student-portal-data"

type ProfileValues = {
  fullName: string
  preferredName: string
  bio: string
  email: string
  phone: string
}

function getProfileValues(): ProfileValues {
  return {
    fullName: lecturer.fullName,
    preferredName: lecturer.preferredName,
    bio: lecturer.bio,
    email: lecturer.contactEmail,
    phone: lecturer.contactPhone,
  }
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter((letter) => letter && /[a-z]/i.test(letter))
    .slice(-2)
    .join("")
    .toUpperCase()

  return initials || lecturer.initials
}

const teachingBranches = Array.from(
  new Set(lecturerCourses.map((course) => course.branch))
).map((branch) => {
  const courses = lecturerCourses.filter((course) => course.branch === branch)

  return {
    name: branch,
    isPrimary: branch === lecturer.branch,
    courses,
    activeCount: courses.filter((course) => course.status === "active").length,
  }
})

export function LecturerProfile() {
  const [profile, setProfile] = useState<ProfileValues>(getProfileValues)
  const [editOpen, setEditOpen] = useState(false)

  const portalAvailable =
    lecturer.portalEnabled && lecturerModules.lecturerPortal
  const localChangeCount = useMemo(() => {
    const initial = getProfileValues()

    return [
      profile.fullName !== initial.fullName,
      profile.preferredName !== initial.preferredName,
      profile.bio !== initial.bio,
      profile.email !== initial.email,
      profile.phone !== initial.phone,
    ].filter(Boolean).length
  }, [profile])

  function resetLocalChanges() {
    setProfile(getProfileValues())
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="My Profile"
          description="Your identity, qualification, bio, teaching branches, contact details and portal account state. Local edits are a preview and are never saved."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Lecturer portal
              </Badge>
              <Badge variant="outline" className="rounded-full tabular-nums">
                {lecturer.lecturerNo}
              </Badge>
              <Badge
                variant={portalAvailable ? "secondary" : "outline"}
                className="gap-1.5 rounded-full"
              >
                {portalAvailable ? <BadgeCheckIcon aria-hidden="true" /> : null}
                {portalAvailable ? "Portal enabled" : "Portal unavailable"}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <PenLineIcon data-icon="inline-start" aria-hidden="true" />
                Edit profile
              </Button>
            </div>
          }
        />

        {!portalAvailable ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="text-muted-foreground">
              Lecturer portal access is not enabled in this demo context. This
              profile is shown as a preview only, and no account action is
              available.
            </p>
          </div>
        ) : null}

        {localChangeCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <div className="flex items-start gap-3">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">
                  {localChangeCount} local{" "}
                  {localChangeCount === 1 ? "change" : "changes"}
                </p>
                <p className="text-muted-foreground">
                  Name, bio and contact edits stay in this page only. Nothing is
                  saved or sent to the institute.
                </p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={resetLocalChanges}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Reset local changes
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
            <Avatar size="lg" className="size-16">
              <AvatarFallback className="text-lg">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {profile.fullName}
                </h2>
                <Badge
                  variant={portalAvailable ? "secondary" : "outline"}
                  className="gap-1.5 rounded-full"
                >
                  {portalAvailable ? (
                    <BadgeCheckIcon aria-hidden="true" />
                  ) : null}
                  {portalAvailable ? "Portal enabled" : "Portal unavailable"}
                </Badge>
                {localChangeCount > 0 ? (
                  <Badge variant="outline" className="rounded-full">
                    Local preview
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Preferred name: {profile.preferredName}</span>
                <span>{lecturer.designation}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2Icon className="size-3.5" aria-hidden="true" />
                  {lecturer.branch} branch
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                  Joined {formatDisplayDate(lecturer.joinedOn)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:max-w-56">
              <ShieldCheckIcon className="size-4 shrink-0" aria-hidden="true" />
              <span>
                This is your own lecturer profile. No other lecturer&apos;s
                records or login secrets are shown.
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <UserRoundIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                About you
              </CardTitle>
              <CardDescription>
                Your qualification, designation and profile summary.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <DetailRow
                icon={GraduationCapIcon}
                label="Qualification"
                value={lecturer.qualification}
              />
              <Separator />
              <DetailRow
                icon={UserRoundIcon}
                label="Designation"
                value={lecturer.designation}
              />
              <Separator />
              <div className="flex items-start gap-3">
                <BookOpenIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Bio</span>
                  <p className="text-sm leading-relaxed break-words">
                    {profile.bio || "No bio recorded."}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Qualification, designation and role are managed by the institute.
              Only name, bio and contact details are editable in this preview.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <MailIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Contact details
              </CardTitle>
              <CardDescription>
                Used by the branch for teaching and portal updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <DetailRow icon={MailIcon} label="Email" value={profile.email} />
              <Separator />
              <DetailRow icon={PhoneIcon} label="Phone" value={profile.phone} />
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
              <span className="text-xs text-muted-foreground">
                Editable in this preview only.
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setEditOpen(true)}
              >
                <PenLineIcon data-icon="inline-start" aria-hidden="true" />
                Edit
              </Button>
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <Building2Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Teaching branches
              </CardTitle>
              <CardDescription>
                Branches linked to the courses assigned to you.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {teachingBranches.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState
                    icon={
                      <Building2Icon className="size-5" aria-hidden="true" />
                    }
                    title="No teaching branches"
                    description="Teaching branches appear from your assigned courses. Contact the Academic Office if a branch is missing."
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {teachingBranches.map((branch) => (
                    <li
                      key={branch.name}
                      className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-6"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {branch.name}
                          {branch.isPrimary ? (
                            <Badge variant="outline" className="rounded-full">
                              Primary
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {branch.courses.length} assigned{" "}
                          {branch.courses.length === 1 ? "course" : "courses"} ·{" "}
                          {branch.activeCount} active
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {branch.courses
                            .map((course) => course.name)
                            .join(", ")}
                        </span>
                      </div>
                      <Building2Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Branches come from your assigned courses. Course assignments are
              managed by the Academic Office and cannot be changed here.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Portal &amp; account
              </CardTitle>
              <CardDescription>
                Your own portal access and account state.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <StatusRow
                label="Portal access"
                value={portalAvailable ? "Enabled" : "Unavailable"}
                tone={portalAvailable ? "positive" : "muted"}
              />
              <Separator />
              <StatusRow
                label="Portal account"
                value={lecturer.portalEnabled ? "Linked" : "Not linked"}
                tone={lecturer.portalEnabled ? "positive" : "muted"}
              />
              <Separator />
              <StatusRow label="Role" value="Lecturer" tone="muted" />
              <Separator />
              <StatusRow
                label="Lecturer number"
                value={lecturer.lecturerNo}
                tone="muted"
              />
              <Separator />
              <StatusRow
                label="Joined"
                value={formatDisplayDate(lecturer.joinedOn)}
                tone="muted"
              />
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Portal access, account linking and role are managed by the
              institute. No password, token or authentication secret is shown.
            </CardFooter>
          </Card>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <LockKeyholeIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              You can preview changes to your name, bio, email and phone, but
              course assignments, commission rules, portal access and your role
              stay read-only. Nothing on this page is saved, sent or applied to
              your account.
            </p>
          </CardContent>
        </Card>
      </div>

      {editOpen ? (
        <EditProfileDialog
          initialValues={profile}
          onOpenChange={setEditOpen}
          onApply={(next) => {
            setProfile(next)
            setEditOpen(false)
          }}
        />
      ) : null}
    </main>
  )
}

function EditProfileDialog({
  initialValues,
  onOpenChange,
  onApply,
}: {
  initialValues: ProfileValues
  onOpenChange: (open: boolean) => void
  onApply: (next: ProfileValues) => void
}) {
  const [values, setValues] = useState(initialValues)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof ProfileValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.fullName.trim()) {
      setError("Enter your full name.")
      return
    }

    if (!values.preferredName.trim()) {
      setError("Enter the name you prefer to be called.")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError("Enter a valid email address.")
      return
    }

    if (!values.phone.trim()) {
      setError("Enter a contact phone number.")
      return
    }

    onApply({
      fullName: values.fullName.trim(),
      preferredName: values.preferredName.trim(),
      bio: values.bio.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit profile</DialogTitle>
          <DialogDescription>
            A local-only preview. Name, bio and contact changes are applied to
            this page only and are never saved or sent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lecturer-profile-full-name">Full name</Label>
              <Input
                id="lecturer-profile-full-name"
                value={values.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lecturer-profile-preferred-name">
                Preferred name
              </Label>
              <Input
                id="lecturer-profile-preferred-name"
                value={values.preferredName}
                onChange={(event) =>
                  update("preferredName", event.target.value)
                }
                autoComplete="given-name"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lecturer-profile-bio">Bio</Label>
            <Textarea
              id="lecturer-profile-bio"
              value={values.bio}
              onChange={(event) => update("bio", event.target.value)}
              placeholder="A short description of what and where you teach."
              rows={3}
              maxLength={240}
            />
            <p className="text-xs text-muted-foreground">
              {values.bio.length}/240 characters. Visible on your own profile
              only.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lecturer-profile-email">Email</Label>
              <Input
                id="lecturer-profile-email"
                type="email"
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
                placeholder="name@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lecturer-profile-phone">Phone</Label>
              <Input
                id="lecturer-profile-phone"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                autoComplete="tel"
                placeholder="+94 77 000 0000"
              />
            </div>
          </div>

          <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Course assignments, commission rules, portal access and your role
            cannot be changed from this dialog. No password, token or
            authentication secret is shown.
          </p>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Apply to preview</Button>
          </DialogFooter>
        </form>
      </DialogContent>
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
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium break-words">{value}</span>
      </div>
    </div>
  )
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "positive" | "muted"
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {value}
      </span>
    </div>
  )
}
