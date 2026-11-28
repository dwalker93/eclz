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
  CalendarDaysIcon,
  CheckCheckIcon,
  GraduationCapIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  PenLineIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import { parent, parentChildren } from "@/lib/parent-portal-data"
import { formatDisplayDate, MOCK_TODAY } from "@/lib/student-portal-data"

export function ParentProfile() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [contact, setContact] = useState<{
    email: string
    phone: string
    address: string
  }>({
    email: parent.contactEmail,
    phone: parent.contactPhone,
    address: parent.address,
  })
  const [editOpen, setEditOpen] = useState(false)

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="My Profile"
          description="Your guardian identity, contact details, portal access and the children linked to your account. Sample data only — you can try a local contact edit, but nothing is saved."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Guardian
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              <Button
                size="sm"
                onClick={() => setEditOpen(true)}
                disabled={!parent.portalEnabled}
              >
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
                {parent.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {parent.fullName}
                </h2>
                <Badge
                  variant={parent.portalEnabled ? "secondary" : "outline"}
                  className="gap-1.5 rounded-full"
                >
                  {parent.portalEnabled ? (
                    <BadgeCheckIcon aria-hidden="true" />
                  ) : null}
                  {parent.portalEnabled
                    ? "Parent portal active"
                    : "No portal access"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Preferred name: {parent.preferredName}</span>
                <span className="inline-flex items-center gap-1.5">
                  <UsersRoundIcon className="size-3.5" aria-hidden="true" />
                  {linkedChildren.length} linked{" "}
                  {linkedChildren.length === 1 ? "child" : "children"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                  With the institute since{" "}
                  {formatDisplayDate(parent.memberSince)}
                </span>
              </div>
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
                icon={UserRoundIcon}
                label="Full name"
                value={parent.fullName}
              />
              <Separator />
              <DetailRow
                icon={ShieldCheckIcon}
                label="NIC"
                value={parent.nic}
              />
              <Separator />
              <DetailRow
                icon={MapPinIcon}
                label="Address"
                value={contact.address}
              />
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Your name and NIC are managed by the institute and cannot be
              edited here.
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
              <Separator />
              <DetailRow
                icon={MapPinIcon}
                label="Address"
                value={contact.address}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
              <span className="text-xs text-muted-foreground">
                Editable in this preview only.
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setEditOpen(true)}
                disabled={!parent.portalEnabled}
              >
                <PenLineIcon data-icon="inline-start" aria-hidden="true" />
                Edit
              </Button>
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Portal access
              </CardTitle>
              <CardDescription>
                Your linked portal state and what it covers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Parent portal
                </span>
                <Badge
                  variant={parent.portalEnabled ? "secondary" : "outline"}
                  className="gap-1.5 rounded-full"
                >
                  {parent.portalEnabled ? (
                    <BadgeCheckIcon aria-hidden="true" />
                  ) : null}
                  {parent.portalEnabled ? "Active" : "Not enabled"}
                </Badge>
              </div>
              <Separator />
              <DetailRow
                icon={UsersRoundIcon}
                label="Children linked"
                value={`${linkedChildren.length} ${
                  linkedChildren.length === 1 ? "child" : "children"
                }`}
              />
              <Separator />
              <DetailRow
                icon={MailIcon}
                label="Primary contact email"
                value={contact.email}
              />
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Portal access and linked children are managed by the institute.
            </CardFooter>
          </Card>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Linked children
            </CardTitle>
            <CardDescription>
              Only students linked to your guardian record are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {parentChildren.map((child) => (
                <li
                  key={child.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                      {child.initials}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {child.fullName}
                        <Badge variant="outline" className="rounded-full">
                          {child.relationship}
                        </Badge>
                        {child.isPrimary ? (
                          <Badge variant="secondary" className="rounded-full">
                            Primary
                          </Badge>
                        ) : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          Student no. {child.studentNo}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <GraduationCapIcon
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {child.grade}
                        </span>
                        <span>{child.branch} branch</span>
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {child.activeCourseCount} active{" "}
                    {child.activeCourseCount === 1 ? "course" : "courses"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Guardian–child relationships are managed by the institute and cannot
            be changed from the portal.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page uses local sample data. Contact edits apply to this
              preview only and are never written anywhere. Your NIC, portal
              access and the linked children stay read-only, no student record
              is changed here, and no login, password or auth field is shown.
            </p>
          </CardContent>
        </Card>
      </div>

      <EditContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialEmail={contact.email}
        initialPhone={contact.phone}
        initialAddress={contact.address}
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

function EditContactDialog({
  open,
  onOpenChange,
  initialEmail,
  initialPhone,
  initialAddress,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEmail: string
  initialPhone: string
  initialAddress: string
  onSave: (next: { email: string; phone: string; address: string }) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [address, setAddress] = useState(initialAddress)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEmail(initialEmail)
    setPhone(initialPhone)
    setAddress(initialAddress)
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

    if (!address.trim()) {
      setError("Enter an address or leave the previous one in place.")
      return
    }

    onSave({
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
    })
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit contact details</DialogTitle>
          <DialogDescription>
            A local-only demo. Changes apply to this preview and are never saved
            or sent to the institute.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="parent-profile-email"
              className="text-sm font-medium"
            >
              Email
            </Label>
            <Input
              id="parent-profile-email"
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
            <Label
              htmlFor="parent-profile-phone"
              className="text-sm font-medium"
            >
              Phone
            </Label>
            <Input
              id="parent-profile-phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setSaved(false)
              }}
              placeholder="+94 77 000 0000"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="parent-profile-address"
              className="text-sm font-medium"
            >
              Address
            </Label>
            <Input
              id="parent-profile-address"
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setSaved(false)
              }}
              placeholder="Street, town"
            />
          </div>

          <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Only contact details can be changed here. Your name, NIC, portal
            access and the linked children are managed by the institute and stay
            read-only.
          </p>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {saved ? (
            <p
              role="status"
              className={cn(
                "flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"
              )}
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
