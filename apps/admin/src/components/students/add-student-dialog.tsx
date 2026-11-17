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
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  QrCodeIcon,
  UserRoundPlusIcon,
} from "lucide-react"

import {
  branches,
  calculateAge,
  formatDisplayDate,
  gradeLevels,
  GUARDIAN_REQUIRED_BELOW_AGE,
  isGuardianRequired,
} from "@/lib/students-data"

type AddStudentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  fullName: string
  dateOfBirth: string
  gender: string
  email: string
  phone: string
  schoolName: string
  nic: string
  branchId: string
  gradeLevelId: string
  guardianName: string
  guardianRelationship: string
  guardianPhone: string
  guardianAddress: string
  guardianPrimary: boolean
}

const emptyForm: FormState = {
  fullName: "",
  dateOfBirth: "",
  gender: "not-specified",
  email: "",
  phone: "",
  schoolName: "",
  nic: "",
  branchId: "br-colombo",
  gradeLevelId: "none",
  guardianName: "",
  guardianRelationship: "Mother",
  guardianPhone: "",
  guardianAddress: "",
  guardianPrimary: true,
}

const branchItems = branches.map((branch) => ({
  value: branch.id,
  label: branch.name,
}))

const gradeItems = [
  { value: "none", label: "No grade (adult / program only)" },
  ...gradeLevels.map((grade) => ({ value: grade.id, label: grade.name })),
]

const genderItems = [
  { value: "not-specified", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
]

export function AddStudentDialog({
  open,
  onOpenChange,
}: AddStudentDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const guardianRequired =
    form.dateOfBirth.length > 0 && isGuardianRequired(form.dateOfBirth)

  useEffect(() => {
    if (!open) {
      setForm(emptyForm)
      setErrors({})
      setSubmitted(false)
    }
  }, [open])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: Record<string, string> = {}
    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full name is required."
    }
    if (!form.dateOfBirth) {
      nextErrors.dateOfBirth = "Date of birth is required."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitted(true)
  }

  const selectedBranch = branches.find((branch) => branch.id === form.branchId)
  const selectedGrade =
    form.gradeLevelId === "none"
      ? null
      : gradeLevels.find((grade) => grade.id === form.gradeLevelId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlusIcon className="size-4" aria-hidden="true" />
            Add student
          </DialogTitle>
          <DialogDescription>
            Preview the registration form. Name and date of birth are required.
            This is a UI demo — no student record is saved.
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
                  Registration preview ready
                </span>
                <p className="text-sm">
                  Nothing was saved. In the full application the student number
                  and QR token would be generated on the server after a
                  successful registration.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Full name" value={form.fullName.trim()} />
              <PreviewField
                label="Date of birth"
                value={`${formatDisplayDate(form.dateOfBirth)} · age ${calculateAge(
                  form.dateOfBirth
                )}`}
              />
              <PreviewField
                label="Branch"
                value={selectedBranch?.name ?? "Not selected"}
              />
              <PreviewField
                label="Grade"
                value={selectedGrade?.name ?? "No grade — adult / program only"}
              />
              <PreviewField
                label="Contact"
                value={
                  [form.phone, form.email].filter(Boolean).join(" · ") ||
                  "Not provided"
                }
              />
              <PreviewField
                label="Guardian"
                value={
                  form.guardianName.trim()
                    ? `${form.guardianName.trim()} (${form.guardianRelationship}${form.guardianPrimary ? ", primary" : ""})`
                    : "Not provided"
                }
              />
            </dl>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Guardian requirement preview:{" "}
                {guardianRequired
                  ? `this student is below age ${GUARDIAN_REQUIRED_BELOW_AGE}, so a guardian with name, phone and address is required in the real form.`
                  : `this student is age ${GUARDIAN_REQUIRED_BELOW_AGE} or older, so guardian details are optional.`}
              </span>
            </div>
          </div>
        ) : (
          <form
            id="add-student-form"
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Student details</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  required
                  error={errors.fullName}
                  htmlFor="student-full-name"
                >
                  <Input
                    id="student-full-name"
                    value={form.fullName}
                    onChange={(event) => update("fullName", event.target.value)}
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={
                      errors.fullName ? "student-full-name-error" : undefined
                    }
                    placeholder="e.g. Dinuka Perera"
                  />
                </Field>

                <Field
                  label="Date of birth"
                  required
                  error={errors.dateOfBirth}
                  htmlFor="student-dob"
                >
                  <Input
                    id="student-dob"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) =>
                      update("dateOfBirth", event.target.value)
                    }
                    aria-invalid={Boolean(errors.dateOfBirth)}
                    aria-describedby={
                      errors.dateOfBirth ? "student-dob-error" : undefined
                    }
                  />
                </Field>

                <Field label="Gender" htmlFor="student-gender">
                  <Select
                    items={genderItems}
                    value={form.gender}
                    onValueChange={(value) =>
                      update("gender", value ?? "not-specified")
                    }
                  >
                    <SelectTrigger id="student-gender" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genderItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="School" htmlFor="student-school">
                  <Input
                    id="student-school"
                    value={form.schoolName}
                    onChange={(event) =>
                      update("schoolName", event.target.value)
                    }
                    placeholder="School name"
                  />
                </Field>

                <Field label="Contact email" htmlFor="student-email">
                  <Input
                    id="student-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="name@example.com"
                  />
                </Field>

                <Field label="Contact phone" htmlFor="student-phone">
                  <Input
                    id="student-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="+94 77 123 4567"
                  />
                </Field>

                <Field label="NIC" htmlFor="student-nic">
                  <Input
                    id="student-nic"
                    value={form.nic}
                    onChange={(event) => update("nic", event.target.value)}
                    placeholder="Optional for school students"
                  />
                </Field>

                <Field
                  label="Primary branch"
                  htmlFor="student-branch"
                  hint="Branch membership is stored per student."
                >
                  <Select
                    items={branchItems}
                    value={form.branchId}
                    onValueChange={(value) => update("branchId", value ?? "")}
                  >
                    <SelectTrigger id="student-branch" className="w-full">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Grade"
                  htmlFor="student-grade"
                  hint="Required only for classes with grade-based fees."
                >
                  <Select
                    items={gradeItems}
                    value={form.gradeLevelId}
                    onValueChange={(value) =>
                      update("gradeLevelId", value ?? "none")
                    }
                  >
                    <SelectTrigger id="student-grade" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Guardian details</p>
                {form.dateOfBirth ? (
                  <Badge
                    variant="outline"
                    className={
                      guardianRequired
                        ? "rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "rounded-full text-muted-foreground"
                    }
                  >
                    {guardianRequired
                      ? `Required below age ${GUARDIAN_REQUIRED_BELOW_AGE}`
                      : `Optional at age ${calculateAge(form.dateOfBirth)}`}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Guardian requirement depends on the organization setting
                (currently below age {GUARDIAN_REQUIRED_BELOW_AGE} at
                registration). A guardian login is separate and needs the parent
                portal module.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Guardian name" htmlFor="guardian-name">
                  <Input
                    id="guardian-name"
                    value={form.guardianName}
                    onChange={(event) =>
                      update("guardianName", event.target.value)
                    }
                    placeholder="Full name"
                  />
                </Field>

                <Field label="Relationship" htmlFor="guardian-relationship">
                  <Select
                    items={[
                      { value: "Mother", label: "Mother" },
                      { value: "Father", label: "Father" },
                      { value: "Guardian", label: "Guardian" },
                      { value: "Other", label: "Other" },
                    ]}
                    value={form.guardianRelationship}
                    onValueChange={(value) =>
                      update("guardianRelationship", value ?? "Mother")
                    }
                  >
                    <SelectTrigger
                      id="guardian-relationship"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mother">Mother</SelectItem>
                      <SelectItem value="Father">Father</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Guardian phone" htmlFor="guardian-phone">
                  <Input
                    id="guardian-phone"
                    type="tel"
                    value={form.guardianPhone}
                    onChange={(event) =>
                      update("guardianPhone", event.target.value)
                    }
                    placeholder="+94 71 234 5678"
                  />
                </Field>

                <Field label="Guardian address" htmlFor="guardian-address">
                  <Input
                    id="guardian-address"
                    value={form.guardianAddress}
                    onChange={(event) =>
                      update("guardianAddress", event.target.value)
                    }
                    placeholder="House, street, city"
                  />
                </Field>
              </div>

              <Label className="mt-1 w-fit font-normal">
                <Checkbox
                  checked={form.guardianPrimary}
                  onCheckedChange={(checked) =>
                    update("guardianPrimary", checked)
                  }
                />
                Set as the primary guardian
              </Label>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <QrCodeIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  Student card QR
                  <Badge variant="outline" className="rounded-full">
                    Placeholder
                  </Badge>
                </span>
                <p className="text-sm text-muted-foreground">
                  The QR token is generated when the student is created and
                  printed on the student card. The token itself is never
                  displayed in the admin UI.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
              Dates use the Asia/Colombo timezone. Age is derived from date of
              birth for display only.
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
              <Button type="submit" form="add-student-form">
                Create student (demo)
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
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="justify-between">
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
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
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
