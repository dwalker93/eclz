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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Switch } from "@workspace/ui/components/switch"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  HeartHandshakeIcon,
  Link2Icon,
} from "lucide-react"

import {
  guardianRelationshipOptions,
  guardianStudentOptions,
  type GuardianRecord,
  type GuardianStudentLink,
} from "@/lib/guardians-data"

type GuardianFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  guardian?: GuardianRecord | null
}

type FormState = {
  fullName: string
  phone: string
  email: string
  address: string
  nic: string
  portalEnabled: boolean
  links: GuardianStudentLink[]
}

const emptyForm: FormState = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  nic: "",
  portalEnabled: false,
  links: [],
}

const relationshipItems = guardianRelationshipOptions.map((relationship) => ({
  value: relationship,
  label: relationship,
}))

function formFromGuardian(guardian: GuardianRecord): FormState {
  return {
    fullName: guardian.fullName,
    phone: guardian.phone ?? "",
    email: guardian.email ?? "",
    address: guardian.address ?? "",
    nic: guardian.nic ?? "",
    portalEnabled: guardian.portalEnabled,
    links: guardian.links.map((link) => ({ ...link })),
  }
}

export function GuardianFormDialog({
  open,
  onOpenChange,
  guardian = null,
}: GuardianFormDialogProps) {
  const isEdit = Boolean(guardian)
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

    setForm(guardian ? formFromGuardian(guardian) : emptyForm)
    setErrors({})
    setSubmitted(false)
  }, [open, guardian])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function toggleStudent(studentId: string, checked: boolean) {
    update(
      "links",
      checked
        ? [
            ...form.links,
            { studentId, relationship: "Guardian", isPrimary: false },
          ]
        : form.links.filter((link) => link.studentId !== studentId)
    )
  }

  function updateLink(
    studentId: string,
    patch: Partial<GuardianStudentLink>
  ) {
    update(
      "links",
      form.links.map((link) =>
        link.studentId === studentId ? { ...link, ...patch } : link
      )
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: Record<string, string> = {}
    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full name is required."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitted(true)
  }

  const linkedOptions = form.links.flatMap((link) => {
    const option = guardianStudentOptions.find(
      (student) => student.studentId === link.studentId
    )

    return option
      ? [
          {
            ...option,
            relationship: link.relationship,
            isPrimary: link.isPrimary,
          },
        ]
      : []
  })

  const linkedAccount =
    guardian?.portalEnabled && guardian.userId
      ? guardian.accountEmail
      : null
  const contactSummary = [form.phone.trim(), form.email.trim()]
    .filter(Boolean)
    .join(" · ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartHandshakeIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit guardian" : "Add guardian"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update contact details, student links and parent portal access. This is a UI demo — no changes are saved."
              : "Preview the guardian form. This is a UI demo — no guardian record is created."}
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
                  {isEdit ? "Changes preview ready" : "Guardian preview ready"}
                </span>
                <p className="text-sm">
                  Nothing was saved. A real save would update the guardian
                  profile and replace the student links with the relationships
                  and primary flags shown here.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Full name" value={form.fullName.trim()} />
              <PreviewField
                label="Contact"
                value={contactSummary || "No phone or email provided"}
              />
              <PreviewField
                label="NIC"
                value={form.nic.trim() || "Not provided"}
              />
              <PreviewField
                label="Account access"
                value={
                  form.portalEnabled
                    ? linkedAccount
                      ? `Enabled · ${linkedAccount}`
                      : "Enabled · account link pending"
                    : "Disabled · guardian kept"
                }
              />
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Address
                </dt>
                <dd className="text-sm">
                  {form.address.trim() || "No address provided"}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Linked students
                </dt>
                <dd className="text-sm">
                  {linkedOptions.length > 0
                    ? linkedOptions
                        .map(
                          (option) =>
                            `${option.fullName} (${option.relationship}${
                              option.isPrimary ? ", primary" : ""
                            })`
                        )
                        .join(" · ")
                    : "No students linked — the guardian is kept standalone."}
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
                  Parent portal login needs a linked user account and the parent
                  portal module. Account creation and linking happen under
                  Users &amp; Roles; this dialog only previews the request.
                </span>
              </div>
            ) : null}

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <HeartHandshakeIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {form.portalEnabled
                ? "Turning portal access off later does not delete the guardian profile or student links."
                : "Portal access is off, but the guardian profile and student links are kept."}
            </p>
          </div>
        ) : (
          <form
            id="guardian-form"
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Contact details</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Full name"
                    required
                    error={errors.fullName}
                    htmlFor="guardian-full-name"
                  >
                    <Input
                      id="guardian-full-name"
                      value={form.fullName}
                      onChange={(event) =>
                        update("fullName", event.target.value)
                      }
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={
                        errors.fullName
                          ? "guardian-full-name-error"
                          : undefined
                      }
                      placeholder="e.g. Nimal Perera"
                    />
                  </Field>
                </div>

                <Field label="Phone" htmlFor="guardian-phone">
                  <Input
                    id="guardian-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="+94 71 234 5678"
                  />
                </Field>

                <Field label="Email" htmlFor="guardian-email">
                  <Input
                    id="guardian-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="name@example.com"
                  />
                </Field>

                <Field label="NIC" htmlFor="guardian-nic">
                  <Input
                    id="guardian-nic"
                    value={form.nic}
                    onChange={(event) => update("nic", event.target.value)}
                    placeholder="e.g. 721234567V"
                  />
                </Field>

                <Field label="Address" htmlFor="guardian-address">
                  <Input
                    id="guardian-address"
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder="House, street, city"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Linked students</p>
                <Badge variant="outline" className="rounded-full">
                  {form.links.length} linked
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                A guardian can be linked to several students. Each link stores
                its own relationship and primary flag; a student may have only
                one primary guardian.
              </p>

              <div className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-lg border">
                {guardianStudentOptions.map((student) => {
                  const link = form.links.find(
                    (item) => item.studentId === student.studentId
                  )

                  return (
                    <div key={student.studentId}>
                      <Label className="flex w-full items-center gap-2 px-3 py-2 font-normal">
                        <Checkbox
                          checked={Boolean(link)}
                          onCheckedChange={(checked) =>
                            toggleStudent(student.studentId, checked)
                          }
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-medium">
                            {student.fullName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {student.studentNo} ·{" "}
                            {student.gradeName ?? "No current grade"} ·{" "}
                            {student.branchName ?? "No branch"}
                          </span>
                        </span>
                      </Label>

                      {link ? (
                        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-3 py-2 pl-9">
                          <span className="text-xs text-muted-foreground">
                            Relationship
                          </span>
                          <Select
                            items={relationshipItems}
                            value={link.relationship}
                            onValueChange={(value) =>
                              updateLink(student.studentId, {
                                relationship: value ?? "Guardian",
                              })
                            }
                          >
                            <SelectTrigger
                              className="w-36"
                              aria-label={`Relationship to ${student.fullName}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {relationshipItems.map((item) => (
                                <SelectItem
                                  key={item.value}
                                  value={item.value}
                                >
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Label className="w-fit font-normal">
                            <Checkbox
                              checked={link.isPrimary}
                              onCheckedChange={(checked) =>
                                updateLink(student.studentId, {
                                  isPrimary: checked,
                                })
                              }
                            />
                            Primary guardian
                          </Label>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Parent portal access</p>
                <Badge variant="outline" className="rounded-full">
                  Account access
                </Badge>
              </div>

              <Label
                htmlFor="guardian-portal-toggle"
                className="flex w-full items-start justify-between gap-4 rounded-lg border p-3 font-normal"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    Allow parent portal login
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Requires a linked user account and the parent portal module.
                    This is not a guardian delete control.
                  </span>
                </span>
                <Switch
                  id="guardian-portal-toggle"
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
                Disabling portal access keeps the guardian profile, contact
                details, addresses and all student relationships.
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
              <Button type="submit" form="guardian-form">
                {isEdit ? "Save changes (demo)" : "Create guardian (demo)"}
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
