"use client"

import { useState } from "react"

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
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckCheckIcon,
  GraduationCapIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  PenLineIcon,
  PhoneIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import { StudentStatusBadge } from "@/components/portal-status-badge"
import {
  calculateStudentAge,
  formatDisplayDate,
  GRADE_REASON_LABELS,
  MOCK_TODAY,
  student,
  studentProfile,
  type StudentGuardian,
} from "@/lib/student-portal-data"

export function StudentProfile() {
  const [contact, setContact] = useState<{ email: string; phone: string }>({
    email: student.contactEmail,
    phone: student.contactPhone,
  })
  const [editOpen, setEditOpen] = useState(false)

  const age = calculateStudentAge(studentProfile.dateOfBirth)
  const currentGrade = studentProfile.gradeHistory.find(
    (grade) => grade.toDate === null
  )

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="My Profile"
          description="Your identity, contact details, branches, linked guardians and grade history. Sample data only — you can try a local contact edit, but nothing is saved."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Student portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {student.grade} · {student.branch}
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
                Edit contact details
              </Button>
            </div>
          }
        />

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
            <Avatar size="lg" className="size-16">
              <AvatarFallback className="text-lg">
                {student.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {student.fullName}
                </h2>
                <StudentStatusBadge status={studentProfile.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Preferred name: {student.preferredName}</span>
                <span className="tabular-nums">
                  Student no. {student.studentNo}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCapIcon className="size-3.5" aria-hidden="true" />
                  {currentGrade?.gradeName ?? student.grade}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2Icon className="size-3.5" aria-hidden="true" />
                  {student.branch} branch
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:max-w-56">
              <QrCodeIcon className="size-4 shrink-0" aria-hidden="true" />
              <span>
                QR attendance card issued on{" "}
                {formatDisplayDate(studentProfile.qrCardIssuedOn)}. The card
                token is never shown in the portal.
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <UserRoundIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Personal details
              </CardTitle>
              <CardDescription>As recorded by the institute.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <DetailRow
                icon={CalendarDaysIcon}
                label="Date of birth"
                value={`${formatDisplayDate(studentProfile.dateOfBirth)} · ${age} years`}
              />
              <Separator />
              <DetailRow
                icon={UserRoundIcon}
                label="Gender"
                value={studentProfile.gender ?? "Not provided"}
              />
              <Separator />
              <DetailRow
                icon={GraduationCapIcon}
                label="School"
                value={studentProfile.schoolName ?? "Not provided"}
              />
              <Separator />
              <DetailRow
                icon={ShieldCheckIcon}
                label="NIC"
                value={studentProfile.nic ?? "Not provided"}
              />
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Student number, status and grade history cannot be edited here.
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
                Used by the branch for class and fee updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <DetailRow icon={MailIcon} label="Email" value={contact.email} />
              <Separator />
              <DetailRow icon={PhoneIcon} label="Phone" value={contact.phone} />
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

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <Building2Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Branch memberships
              </CardTitle>
              <CardDescription>
                Branches you belong to and when you joined.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {studentProfile.branches.map((branch) => (
                  <li
                    key={branch.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {branch.branchName}
                        {branch.isPrimary ? (
                          <Badge variant="outline" className="rounded-full">
                            Primary
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatDisplayDate(branch.joinedOn)}
                      </span>
                    </div>
                    <Building2Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Guardians
            </CardTitle>
            <CardDescription>
              Only guardians linked to your record are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {studentProfile.guardians.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="size-5" aria-hidden="true" />}
                title="No linked guardians"
                description="No guardian is linked to this student record. Contact the branch office if this is unexpected."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {studentProfile.guardians.map((guardian) => (
                  <GuardianCard key={guardian.id} guardian={guardian} />
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Guardian links and relationships are managed by the institute and
            cannot be edited here.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <GraduationCapIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Grade history
            </CardTitle>
            <CardDescription>
              The grades you have been in and their date ranges.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {studentProfile.gradeHistory
                .slice()
                .reverse()
                .map((grade) => {
                  const isCurrent = grade.toDate === null

                  return (
                    <li
                      key={grade.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-6"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                            isCurrent
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <GraduationCapIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {grade.gradeName}
                            <Badge variant="outline" className="rounded-full">
                              {grade.stage}
                            </Badge>
                            {isCurrent ? (
                              <Badge variant="secondary" className="rounded-full">
                                Current
                              </Badge>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDisplayDate(grade.fromDate)} –{" "}
                            {grade.toDate
                              ? formatDisplayDate(grade.toDate)
                              : "Present"}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {GRADE_REASON_LABELS[grade.reason]}
                      </Badge>
                    </li>
                  )
                })}
            </ul>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page uses local sample data. Contact edits apply to this
              preview only and are never written anywhere. The student number,
              status, grade history, guardian links and QR token stay read-only,
              and no login, password or preference field is invented.
            </p>
          </CardContent>
        </Card>
      </div>

      <EditContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialEmail={contact.email}
        initialPhone={contact.phone}
        onSave={(next) => setContact(next)}
      />
    </main>
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

function GuardianCard({ guardian }: { guardian: StudentGuardian }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {guardian.fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">{guardian.fullName}</span>
            <span className="text-xs text-muted-foreground">
              {guardian.relationship}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {guardian.isPrimary ? (
            <Badge variant="outline" className="rounded-full">
              Primary
            </Badge>
          ) : null}
          <Badge
            variant={guardian.portalEnabled ? "secondary" : "outline"}
            className="gap-1.5 rounded-full"
          >
            {guardian.portalEnabled ? (
              <BadgeCheckIcon aria-hidden="true" />
            ) : null}
            {guardian.portalEnabled ? "Parent portal" : "No portal access"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-2">
          <PhoneIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {guardian.phone}
        </span>
        <span className="flex items-center gap-2">
          <MailIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {guardian.email ?? "Not provided"}
        </span>
        <span className="flex items-start gap-2">
          <MapPinIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="break-words">{guardian.address}</span>
        </span>
      </div>
    </div>
  )
}

function EditContactDialog({
  open,
  onOpenChange,
  initialEmail,
  initialPhone,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEmail: string
  initialPhone: string
  onSave: (next: { email: string; phone: string }) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEmail(initialEmail)
    setPhone(initialPhone)
    setSaved(false)
    setError(null)
  }

  function submit() {
    if (!email.trim()) {
      setError("Enter an email address or leave the previous one in place.")
      return
    }

    if (!phone.trim()) {
      setError("Enter a phone number or leave the previous one in place.")
      return
    }

    onSave({ email: email.trim(), phone: phone.trim() })
    setError(null)
    setSaved(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit contact details</DialogTitle>
          <DialogDescription>
            A local-only demo. Changes apply to this preview and are never saved
            or sent to the institute.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setSaved(false)
              }}
              placeholder="name@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-phone" className="text-sm font-medium">
              Phone
            </Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setSaved(false)
              }}
              placeholder="+94 77 000 0000"
            />
          </div>

          <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Student number, status, grade history, guardian links and the QR
            token cannot be changed from the portal.
          </p>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {saved ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"
            >
              <CheckCheckIcon className="size-4" aria-hidden="true" />
              Applied locally for this preview.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit}>Apply to preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
