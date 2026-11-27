"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

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
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import {
  BellIcon,
  BellRingIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PenLineIcon,
  PhoneIcon,
  SmartphoneIcon,
  SunIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { PortalPageHeader } from "@/components/portal-page-header"
import type { PortalRole } from "@/components/portal-shell"
import { lecturer } from "@/lib/lecturer-portal-data"
import { parent, parentChildren } from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  MOCK_TODAY,
  NOTIFICATION_CHANNEL_LABELS,
  portalModules,
  student,
  type NotificationChannel,
} from "@/lib/student-portal-data"

type ThemeValue = "light" | "dark" | "system"

type AccountIdentity = {
  fullName: string
  initials: string
  roleLabel: string
  /** Secondary identity line, e.g. "STU-2024-0114 · Grade 8". */
  meta: string
  email: string
  phone: string
  /** Only guardians have an address in the fixtures. */
  address: string | null
}

const accountByRole: Record<PortalRole, AccountIdentity> = {
  student: {
    fullName: student.fullName,
    initials: student.initials,
    roleLabel: "Student portal",
    meta: `${student.studentNo} · ${student.grade}`,
    email: student.contactEmail,
    phone: student.contactPhone,
    address: null,
  },
  lecturer: {
    fullName: lecturer.fullName,
    initials: lecturer.initials,
    roleLabel: "Lecturer portal",
    meta: `${lecturer.lecturerNo} · ${lecturer.designation}`,
    email: lecturer.contactEmail,
    phone: lecturer.contactPhone,
    address: null,
  },
  parent: {
    fullName: parent.fullName,
    initials: parent.initials,
    roleLabel: "Parent portal",
    meta: `Guardian · ${parentChildren.length} linked ${
      parentChildren.length === 1 ? "child" : "children"
    }`,
    email: parent.contactEmail,
    phone: parent.contactPhone,
    address: parent.address,
  },
}

const themeOptions: { value: ThemeValue; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
]

const channelIcons: Record<NotificationChannel, LucideIcon> = {
  in_app: BellIcon,
  email: MailIcon,
  sms: SmartphoneIcon,
  push: BellRingIcon,
}

const channelOrder: NotificationChannel[] = ["in_app", "email", "sms", "push"]

const channelAvailability: Record<NotificationChannel, boolean> = {
  in_app: true,
  email: portalModules.email,
  sms: portalModules.sms,
  push: portalModules.webPush,
}

const channelHints: Record<NotificationChannel, string> = {
  in_app:
    "Always on. New notifications appear in your portal notification list.",
  email:
    "Service and fee updates are emailed to your contact address when email is enabled.",
  sms: "Short updates are texted to your contact number when SMS is enabled.",
  push: "Browser push alerts arrive when the institute enables web push.",
}

export function AccountSettings({ role }: { role: PortalRole }) {
  const identity = accountByRole[role]

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [channels, setChannels] = useState<
    Record<NotificationChannel, boolean>
  >(() => ({
    in_app: true,
    email: portalModules.email,
    sms: portalModules.sms,
    push: portalModules.webPush,
  }))
  const [contact, setContact] = useState<{
    email: string
    phone: string
    address: string
  }>({
    email: identity.email,
    phone: identity.phone,
    address: identity.address ?? "",
  })
  const [editOpen, setEditOpen] = useState(false)

  const hasAddress = identity.address !== null

  // next-themes resolves the active theme on the client only, so wait for mount
  // before marking the selected theme to avoid a hydration mismatch.
  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedTheme = mounted ? theme : undefined

  const enabledChannelCount = channelOrder.filter(
    (channel) => channels[channel]
  ).length

  function toggleChannel(channel: NotificationChannel, next: boolean) {
    setChannels((current) => ({ ...current, [channel]: next }))
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Account settings"
          description="Appearance, notification channels and contact details for your account. Everything here is local to this preview — nothing is saved and no password or sign-in data is shown."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                {identity.roleLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Signed in as {identity.fullName}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Local demo only
              </Badge>
            </>
          }
          actions={
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
            <Avatar size="lg" className="size-16">
              <AvatarFallback className="text-lg">
                {identity.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {identity.fullName}
                </h2>
                <Badge variant="outline" className="gap-1.5 rounded-full">
                  <UserRoundIcon aria-hidden="true" />
                  {identity.roleLabel}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{identity.meta}</p>
              <p className="text-xs text-muted-foreground">
                {contact.email} · {contact.phone}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <PaletteIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Appearance
              </CardTitle>
              <CardDescription>
                Choose how the portal looks on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <div
                role="group"
                aria-label="Theme"
                className="grid grid-cols-3 gap-2"
              >
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const active = selectedTheme === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "border-primary bg-primary/5 text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {mounted
                  ? `Currently using the ${selectedTheme ?? "system"} theme.`
                  : "The theme is applied by the header switcher."}
              </p>
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Applies to this browser and is remembered locally. It is not saved
              to your account.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <BellIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Notification channels
              </CardTitle>
              <CardDescription>
                {enabledChannelCount} of {channelOrder.length} channels switched
                on.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {channelOrder.map((channel) => {
                  const Icon = channelIcons[channel]
                  const available = channelAvailability[channel]
                  const locked = channel === "in_app"

                  return (
                    <li
                      key={channel}
                      className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <Icon
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {NOTIFICATION_CHANNEL_LABELS[channel]}
                            {locked ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full"
                              >
                                Always on
                              </Badge>
                            ) : available ? (
                              <Badge variant="outline" className="rounded-full">
                                Available
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                Module off
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {channelHints[channel]}
                          </span>
                        </div>
                      </div>
                      <Switch
                        checked={channels[channel]}
                        onCheckedChange={(checked) =>
                          toggleChannel(channel, checked)
                        }
                        disabled={locked || !available}
                        aria-label={`${
                          NOTIFICATION_CHANNEL_LABELS[channel]
                        } notifications`}
                      />
                    </li>
                  )
                })}
              </ul>
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              External channels depend on the institute&apos;s enabled settings
              — email, SMS and push only appear when switched on. These toggles
              are local to the preview and nothing is sent.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0 lg:col-span-2 xl:col-span-1">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <MailIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Contact details
              </CardTitle>
              <CardDescription>
                Used by the branch for class and account updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
              <DetailRow icon={MailIcon} label="Email" value={contact.email} />
              <Separator />
              <DetailRow icon={PhoneIcon} label="Phone" value={contact.phone} />
              {hasAddress ? (
                <>
                  <Separator />
                  <DetailRow
                    icon={MapPinIcon}
                    label="Address"
                    value={contact.address}
                  />
                </>
              ) : null}
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
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page uses local sample data only. Theme, channel and contact
              changes apply to this preview and are never written anywhere. No
              sign-in, password or authentication field is shown, and none of
              these controls affect other roles or other people&apos;s accounts.
            </p>
          </CardContent>
        </Card>
      </div>

      <EditContactDialog
        key={role}
        open={editOpen}
        onOpenChange={setEditOpen}
        showAddress={hasAddress}
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
  showAddress,
  initialEmail,
  initialPhone,
  initialAddress,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  showAddress: boolean
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
      setError("Enter an email address or keep the previous one in place.")
      return
    }

    if (!phone.trim()) {
      setError("Enter a phone number or keep the previous one in place.")
      return
    }

    if (showAddress && !address.trim()) {
      setError("Enter an address or keep the previous one in place.")
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
              htmlFor="account-settings-email"
              className="text-sm font-medium"
            >
              Email
            </Label>
            <Input
              id="account-settings-email"
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
              htmlFor="account-settings-phone"
              className="text-sm font-medium"
            >
              Phone
            </Label>
            <Input
              id="account-settings-phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setSaved(false)
              }}
              placeholder="+94 77 000 0000"
            />
          </div>
          {showAddress ? (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="account-settings-address"
                className="text-sm font-medium"
              >
                Address
              </Label>
              <Input
                id="account-settings-address"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value)
                  setSaved(false)
                }}
                placeholder="Street, town"
              />
            </div>
          ) : null}

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
