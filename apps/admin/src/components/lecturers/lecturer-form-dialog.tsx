"use client"

import { useEffect, useState } from "react"
import type { FormEvent, ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Textarea } from "@workspace/ui/components/textarea"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  Link2Icon,
  PresentationIcon,
} from "lucide-react"

import { branches } from "@/lib/students-data"
import type { LecturerRecord } from "@/lib/lecturers-data"

type LecturerFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lecturer?: LecturerRecord | null
}

type FormState = {
  fullName: string
  qualification: string
  bio: string
  branchIds: string[]
  portalEnabled: boolean
}

const emptyForm: FormState = {
  fullName: "",
  qualification: "",
  bio: "",
  branchIds: ["br-colombo"],
  portalEnabled: false,
}

function formFromLecturer(lecturer: LecturerRecord): FormState {
  return {
    fullName: lecturer.fullName,
    qualification: lecturer.qualification,
    bio: lecturer.bio,
    branchIds: lecturer.branches.map((branch) => branch.branchId),
    portalEnabled: lecturer.portalEnabled,
  }
}

export function LecturerFormDialog({
  open,
  onOpenChange,
  lecturer = null,
}: LecturerFormDialogProps) {
  const isEdit = Boolean(lecturer)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(emptyForm)
      setErrors({})
      setSubmitted(false)
      return
    }

    setForm(lecturer ? formFromLecturer(lecturer) : emptyForm)
    setErrors({})
    setSubmitted(false)
  }, [open, lecturer])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function toggleBranch(branchId: string, checked: boolean) {
    update(
      "branchIds",
      checked
        ? [...form.branchIds, branchId]
        : form.branchIds.filter((id) => id !== branchId)
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: Record<string, string> = {}
    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full name is required."
    }
    if (!form.qualification.trim()) {
      nextErrors.qualification = "Qualification is required."
    }
    if (form.branchIds.length === 0) {
      nextErrors.branchIds = "Select at least one branch."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitted(true)
  }

  const selectedBranches = branches.filter((branch) =>
    form.branchIds.includes(branch.id)
  )
  const linkedAccount = lecturer?.accountEmail ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PresentationIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit lecturer" : "Add lecturer"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the lecturer profile and branch membership. This is a UI demo — no changes are saved."
              : "Preview the lecturer profile form. This is a UI demo — no lecturer record is created."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CircleCheckIcon
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {isEdit ? "Changes preview ready" : "Lecturer preview ready"}
                </span>
                <p className="text-sm">
                  Nothing was saved. A real save would write the profile,
                  replace the branch membership rows, and keep all existing
                  course assignments untouched.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Full name" value={form.fullName.trim()} />
              <PreviewField
                label="Qualification"
                value={form.qualification.trim()}
              />
              <PreviewField
                label="Branches"
                value={
                  selectedBranches.map((branch) => branch.name).join(", ") ||
                  "None selected"
                }
              />
              <PreviewField
                label="Account access"
                value={
                  form.portalEnabled
                    ? linkedAccount
                      ? `Enabled · ${linkedAccount}`
                      : "Enabled · account link pending"
                    : "Disabled · profile kept"
                }
              />
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Biography
                </dt>
                <dd className="text-sm">
                  {form.bio.trim() || "No biography provided."}
                </dd>
              </div>
            </dl>

            {form.portalEnabled && !linkedAccount ? (
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Portal access needs a linked user account. Account creation
                  and linking happen under Users &amp; Roles; this dialog only
                  previews the request.
                </span>
              </div>
            ) : null}

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <PresentationIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {form.portalEnabled
                ? "Turning portal access off later does not delete the lecturer profile, course history or commission records."
                : "Portal access is off, but the lecturer profile, course assignments and history are kept."}
            </p>
          </div>
        ) : (
          <form
            id="lecturer-form"
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Profile</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  required
                  error={errors.fullName}
                  htmlFor="lecturer-full-name"
                >
                  <Input
                    id="lecturer-full-name"
                    value={form.fullName}
                    onChange={(event) =>
                      update("fullName", event.target.value)
                    }
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={
                      errors.fullName
                        ? "lecturer-full-name-error"
                        : undefined
                    }
                    placeholder="e.g. Anushka Wijesuriya"
                  />
                </Field>

                <Field
                  label="Qualification"
                  required
                  error={errors.qualification}
                  htmlFor="lecturer-qualification"
                >
                  <Input
                    id="lecturer-qualification"
                    value={form.qualification}
                    onChange={(event) =>
                      update("qualification", event.target.value)
                    }
                    aria-invalid={Boolean(errors.qualification)}
                    aria-describedby={
                      errors.qualification
                        ? "lecturer-qualification-error"
                        : undefined
                    }
                    placeholder="e.g. M.Sc. in Mathematics"
                  />
                </Field>
              </div>

              <Field label="Biography" htmlFor="lecturer-bio">
                <Textarea
                  id="lecturer-bio"
                  value={form.bio}
                  onChange={(event) => update("bio", event.target.value)}
                  rows={4}
                  placeholder="Short teaching background, subjects and branch responsibilities."
                />
              </Field>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Branches</p>
                <Badge variant="outline" className="rounded-full">
                  {form.branchIds.length} selected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Branch membership is stored per lecturer. Courses assigned to
                this lecturer must belong to one of these branches.
              </p>

              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                aria-describedby={
                  errors.branchIds ? "lecturer-branches-error" : undefined
                }
              >
                {branches.map((branch) => {
                  const checked = form.branchIds.includes(branch.id)

                  return (
                    <Label
                      key={branch.id}
                      className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 font-normal"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleBranch(branch.id, value)
                        }
                      />
                      {branch.name}
                    </Label>
                  )
                })}
              </div>
              {errors.branchIds ? (
                <p
                  id="lecturer-branches-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {errors.branchIds}
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Portal access</p>
                <Badge variant="outline" className="rounded-full">
                  Account access
                </Badge>
              </div>

              <Label
                htmlFor="lecturer-portal-toggle"
                className="flex w-full items-start justify-between gap-4 rounded-lg border p-3 font-normal"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    Allow portal login
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Enables the linked user account to sign in to the lecturer
                    portal. This is not a profile delete control.
                  </span>
                </span>
                <Switch
                  id="lecturer-portal-toggle"
                  checked={form.portalEnabled}
                  onCheckedChange={(checked) =>
                    update("portalEnabled", checked)
                  }
                />
              </Label>

              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Link2Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Linked account
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      linkedAccount
                        ? "rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                        : "rounded-full text-muted-foreground"
                    }
                  >
                    {linkedAccount ? "Linked" : "Not linked"}
                  </Badge>
                </div>
                <Input
                  value={linkedAccount ?? ""}
                  readOnly
                  disabled
                  placeholder="Account linking is managed under Users & Roles"
                  aria-label="Linked portal account (read only)"
                />
                <p className="text-xs text-muted-foreground">
                  Account creation, email and password are managed under Users
                  &amp; Roles. This form only shows the link state; it never
                  creates a user.
                </p>
              </div>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CircleAlertIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Disabling portal access keeps the lecturer profile, branch
                membership, course assignments and commission history.
              </p>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Back to form
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="lecturer-form">
                {isEdit ? "Save changes (demo)" : "Create lecturer (demo)"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        <span>
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      </Label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}
