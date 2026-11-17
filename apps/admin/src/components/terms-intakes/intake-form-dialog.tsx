"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  CalendarRangeIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
} from "lucide-react"

import type { IntakeStatus } from "@/lib/courses-data"
import { formatDisplayDate } from "@/lib/students-data"
import {
  intakeStatusFormOptions,
  intakeStatusFilterOptions,
  programOptions,
  type IntakeDirectoryRecord,
} from "@/lib/terms-intakes-data"

type IntakeFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  intake?: IntakeDirectoryRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  courseId: string
  name: string
  startsOn: string
  endsOn: string
  capacity: string
  status: IntakeStatus
}

type FormErrors = {
  courseId?: string
  name?: string
  startsOn?: string
  endsOn?: string
  capacity?: string
}

function createEmptyForm(intake?: IntakeDirectoryRecord | null): FormState {
  return {
    courseId: intake?.courseId ?? programOptions[0]?.value ?? "",
    name: intake?.name ?? "",
    startsOn: intake?.startsOn ?? "",
    endsOn: intake?.endsOn ?? "",
    capacity:
      intake?.capacity !== null && intake?.capacity !== undefined
        ? String(intake.capacity)
        : "",
    status: intake?.status ?? "open",
  }
}

function statusLabel(status: IntakeStatus) {
  return (
    intakeStatusFilterOptions.find((option) => option.value === status)?.label ??
    status
  )
}

export function IntakeFormDialog({
  open,
  onOpenChange,
  intake,
  onSaved,
}: IntakeFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(intake))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(intake)

  useEffect(() => {
    setForm(createEmptyForm(intake))
    setErrors({})
    setSubmitted(false)
  }, [open, intake])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!form.courseId) {
      nextErrors.courseId = "Select the program this intake belongs to."
    }

    if (!form.name.trim()) {
      nextErrors.name = "Intake name is required."
    }

    if (!form.startsOn) {
      nextErrors.startsOn = "Start date is required."
    }

    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
      nextErrors.endsOn = "End date must be on or after the start date."
    }

    if (form.capacity.trim() !== "") {
      const capacity = Number(form.capacity)

      if (!Number.isFinite(capacity) || capacity <= 0) {
        nextErrors.capacity = "Capacity must be a positive number when set."
      }
    }

    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validate()

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitted(true)
  }

  const programLabel =
    programOptions.find((option) => option.value === form.courseId)?.label ??
    "No program selected"
  const capacity =
    form.capacity.trim() === "" ? null : Number(form.capacity)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRangeIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit program intake" : "Add program intake"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this intake window, capacity and status. This is a UI preview — no record is changed."
              : "Create an intake for a scheduled program. This is a UI preview — no record is saved."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CheckIcon
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {isEdit ? "Intake update ready" : "Intake ready to add"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `“${form.name.trim()}” would be updated.`
                    : `“${form.name.trim()}” would be added under ${programLabel}.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Program" value={programLabel} />
              <PreviewField label="Intake name" value={form.name.trim()} />
              <PreviewField
                label="Starts on"
                value={formatDisplayDate(form.startsOn)}
              />
              <PreviewField
                label="Ends on (last day)"
                value={
                  form.endsOn ? formatDisplayDate(form.endsOn) : "Open-ended"
                }
              />
              <PreviewField
                label="Capacity"
                value={
                  capacity === null ? "No capacity limit" : `${capacity} seats`
                }
              />
              <PreviewField
                label="Status"
                value={statusLabel(form.status)}
              />
            </dl>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Intakes belong to scheduled programs and are independent of
                academic terms. Their end date is the display-inclusive last
                day. Self-paced programs do not use intakes.
              </span>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No intake is created or updated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="intake-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-program">
                <span>
                  Program
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Select
                items={programOptions}
                value={form.courseId}
                onValueChange={(value) =>
                  update("courseId", value ?? programOptions[0]?.value ?? "")
                }
              >
                <SelectTrigger id="intake-program" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {programOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.courseId ? (
                <p className="text-xs text-destructive">{errors.courseId}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only scheduled programs accept enrollments through an intake.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-name">
                <span>
                  Intake name
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Input
                id="intake-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. June 2027 intake"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "intake-name-error" : undefined}
              />
              {errors.name ? (
                <p id="intake-name-error" className="text-xs text-destructive">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="intake-starts-on">
                  <span>
                    Starts on
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="intake-starts-on"
                  type="date"
                  value={form.startsOn}
                  onChange={(event) =>
                    update("startsOn", event.target.value)
                  }
                  aria-invalid={errors.startsOn ? true : undefined}
                  aria-describedby={
                    errors.startsOn ? "intake-starts-error" : undefined
                  }
                />
                {errors.startsOn ? (
                  <p
                    id="intake-starts-error"
                    className="text-xs text-destructive"
                  >
                    {errors.startsOn}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="intake-ends-on">
                  <span>
                    Ends on
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                </Label>
                <Input
                  id="intake-ends-on"
                  type="date"
                  value={form.endsOn}
                  onChange={(event) => update("endsOn", event.target.value)}
                  aria-invalid={errors.endsOn ? true : undefined}
                  aria-describedby={
                    errors.endsOn ? "intake-ends-error" : undefined
                  }
                />
                {errors.endsOn ? (
                  <p id="intake-ends-error" className="text-xs text-destructive">
                    {errors.endsOn}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Inclusive last day. Leave blank for open-ended.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="intake-capacity">
                  <span>
                    Capacity
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                </Label>
                <Input
                  id="intake-capacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(event) =>
                    update("capacity", event.target.value)
                  }
                  placeholder="e.g. 40"
                  aria-invalid={errors.capacity ? true : undefined}
                  aria-describedby={
                    errors.capacity ? "intake-capacity-error" : undefined
                  }
                />
                {errors.capacity ? (
                  <p
                    id="intake-capacity-error"
                    className="text-xs text-destructive"
                  >
                    {errors.capacity}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Leave blank for no capacity limit.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="intake-status">Status</Label>
                <Select
                  items={intakeStatusFormOptions}
                  value={form.status}
                  onValueChange={(value) =>
                    update("status", (value ?? "open") as IntakeStatus)
                  }
                >
                  <SelectTrigger id="intake-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intakeStatusFormOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Open accepts enrollments, running is in progress, and closed
                stops new enrollments. An intake belongs to exactly one
                scheduled program.
              </span>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Back to form
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onSaved(
                    isEdit
                      ? `Intake update preview closed. “${form.name.trim()}” was not changed — this is a UI demo.`
                      : `Intake preview closed. “${form.name.trim()}” was not added — this is a UI demo.`
                  )
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="intake-form">
                {isEdit ? "Save changes (demo)" : "Add intake (demo)"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm" title={value}>
        {value || "—"}
      </dd>
    </div>
  )
}