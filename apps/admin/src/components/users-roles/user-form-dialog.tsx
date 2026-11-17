"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
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
import { Switch } from "@workspace/ui/components/switch"
import { CircleAlertIcon, InfoIcon, UserRoundIcon } from "lucide-react"

import {
  CREDENTIAL_NOTE,
  type UserRecord,
  type UserStatus,
} from "@/lib/users-roles-data"

export type UserDraft = {
  fullName: string
  email: string
  username: string
  phone: string | null
  status: UserStatus
}

type FormState = {
  fullName: string
  email: string
  username: string
  phone: string
  isActive: boolean
}

type FormErrors = {
  fullName?: string
  email?: string
  username?: string
  phone?: string
  status?: string
}

type UserFormDialogProps = {
  open: boolean
  user: UserRecord | null
  isCreating: boolean
  existingEmails: string[]
  existingUsernames: string[]
  /** True when this account is the only root admin, so it cannot be disabled. */
  isLastRootAdmin: boolean
  onOpenChange: (open: boolean) => void
  onSave: (draft: UserDraft, userId: string | null) => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[a-z0-9._-]+$/i

function createEmptyForm(user: UserRecord | null): FormState {
  return {
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    username: user?.username ?? "",
    phone: user?.phone ?? "",
    isActive: (user?.status ?? "active") === "active",
  }
}

export function UserFormDialog({
  open,
  user,
  isCreating,
  existingEmails,
  existingUsernames,
  isLastRootAdmin,
  onOpenChange,
  onSave,
}: UserFormDialogProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<FormState>(() => createEmptyForm(user))
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) return
    setForm(createEmptyForm(user))
    setErrors({})
  }, [open, user])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit() {
    const nextErrors: FormErrors = {}
    const fullName = form.fullName.trim()
    const email = form.email.trim().toLowerCase()
    const username = form.username.trim()

    const otherEmails = existingEmails.filter(
      (existing) => existing !== (user?.email ?? "").toLowerCase()
    )
    const otherUsernames = existingUsernames.filter(
      (existing) => existing !== (user?.username ?? "").toLowerCase()
    )

    if (!fullName) {
      nextErrors.fullName = "Enter the user's full name."
    }

    if (!email) {
      nextErrors.email = "Enter an email address."
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Enter a valid email address."
    } else if (otherEmails.includes(email)) {
      nextErrors.email = "This email is already in use."
    }

    if (!username) {
      nextErrors.username = "Enter a username."
    } else if (!USERNAME_PATTERN.test(username)) {
      nextErrors.username =
        "Use letters, numbers, dots, dashes or underscores only."
    } else if (otherUsernames.includes(username.toLowerCase())) {
      nextErrors.username = "This username is already in use."
    }

    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 9) {
      nextErrors.phone = "Enter a valid phone number, or leave it blank."
    }

    if (
      !form.isActive &&
      (user?.status ?? "active") === "active" &&
      isLastRootAdmin
    ) {
      nextErrors.status =
        "The only root admin cannot be disabled. Give another user the root admin role first."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSave(
      {
        fullName,
        email,
        username,
        phone: form.phone.trim() || null,
        status: form.isActive ? "active" : "disabled",
      },
      user?.id ?? null
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={nameRef}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundIcon className="size-4" aria-hidden="true" />
            {isCreating ? "Add user" : "Edit user"}
          </DialogTitle>
          <DialogDescription>
            Staff logins are managed here. Portal logins for lecturers,
            guardians and students are created on their own screens. This is a
            UI preview — nothing is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name">
              Full name
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="user-name"
              ref={nameRef}
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              placeholder="e.g. Nimali Perera"
              aria-invalid={errors.fullName ? true : undefined}
            />
            {errors.fullName ? (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-email">
              Email
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="name@eclz.lk"
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Used to sign in and to receive password reset links.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-username">
                Username
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="user-username"
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
                placeholder="nimali.p"
                aria-invalid={errors.username ? true : undefined}
              />
              {errors.username ? (
                <p className="text-xs text-destructive">{errors.username}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Must be unique across the organization.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-phone">Phone</Label>
              <Input
                id="user-phone"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+94 77 123 4567"
                inputMode="tel"
                aria-invalid={errors.phone ? true : undefined}
              />
              {errors.phone ? (
                <p className="text-xs text-destructive">{errors.phone}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Account active</span>
                <span className="text-xs text-muted-foreground">
                  A disabled account keeps its roles and profile links but
                  cannot sign in.
                </span>
              </span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => update("isActive", checked)}
                aria-label="Mark the account active"
              />
            </label>
            {errors.status ? (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <CircleAlertIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {errors.status}
              </p>
            ) : null}
          </div>

          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{CREDENTIAL_NOTE}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isCreating ? "Add user (demo)" : "Save changes (demo)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
