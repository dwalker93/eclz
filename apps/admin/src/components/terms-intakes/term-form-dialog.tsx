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
import { Switch } from "@workspace/ui/components/switch"
import {
  CalendarRangeIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
} from "lucide-react"

import { formatDisplayDate } from "@/lib/students-data"
import {
  getCurrentTerm,
  type TermDirectoryRecord,
} from "@/lib/terms-intakes-data"

type TermFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  term?: TermDirectoryRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  name: string
  startsOn: string
  endsOn: string
  isCurrent: boolean
}

type FormErrors = {
  name?: string
  startsOn?: string
  endsOn?: string
}

function createEmptyForm(term?: TermDirectoryRecord | null): FormState {
  return {
    name: term?.name ?? "",
    startsOn: term?.startsOn ?? "",
    endsOn: term?.endsOn ?? "",
    isCurrent: term?.isCurrent ?? false,
  }
}

export function TermFormDialog({
  open,
  onOpenChange,
  term,
  onSaved,
}: TermFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(term))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(term)

  useEffect(() => {
    setForm(createEmptyForm(term))
    setErrors({})
    setSubmitted(false)
  }, [open, term])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!form.name.trim()) {
      nextErrors.name = "Term name is required."
    }

    if (!form.startsOn) {
      nextErrors.startsOn = "Start date is required."
    }

    if (!form.endsOn) {
      nextErrors.endsOn = "End date is required."
    }

    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
      nextErrors.endsOn = "End date must be on or after the start date."
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

  const currentTerm = getCurrentTerm()
  const replacingCurrent =
    form.isCurrent &&
    currentTerm !== undefined &&
    currentTerm.id !== term?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRangeIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit academic term" : "Add academic term"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the term dates and current marker. This is a UI preview — no record is changed."
              : "Create an academic year for classes. This is a UI preview — no record is saved."}
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
                  {isEdit ? "Term update ready" : "Term ready to add"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `“${form.name.trim()}” would be updated.`
                    : `“${form.name.trim()}” would be added to the academic terms.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Term name" value={form.name.trim()} />
              <PreviewField
                label="Current term"
                value={form.isCurrent ? "Yes" : "No"}
              />
              <PreviewField
                label="Starts on"
                value={formatDisplayDate(form.startsOn)}
              />
              <PreviewField
                label="Ends on (last day)"
                value={formatDisplayDate(form.endsOn)}
              />
            </dl>

            {replacingCurrent && currentTerm ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Saving would move the current marker from “
                  {currentTerm.name}” to this term. Only one term can be current
                  at a time.
                </span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Academic terms are display ranges for classes. Their end date is
                the inclusive last day, unlike access and effectivity dates
                elsewhere. Terms are separate from program intakes.
              </span>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No academic term is created or
                updated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="term-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="term-name">
                <span>
                  Term name
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Input
                id="term-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. 2027 academic year"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "term-name-error" : undefined}
              />
              {errors.name ? (
                <p id="term-name-error" className="text-xs text-destructive">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="term-starts-on">
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
                  id="term-starts-on"
                  type="date"
                  value={form.startsOn}
                  onChange={(event) =>
                    update("startsOn", event.target.value)
                  }
                  aria-invalid={errors.startsOn ? true : undefined}
                  aria-describedby={
                    errors.startsOn ? "term-starts-error" : undefined
                  }
                />
                {errors.startsOn ? (
                  <p
                    id="term-starts-error"
                    className="text-xs text-destructive"
                  >
                    {errors.startsOn}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="term-ends-on">
                  <span>
                    Ends on
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="term-ends-on"
                  type="date"
                  value={form.endsOn}
                  onChange={(event) => update("endsOn", event.target.value)}
                  aria-invalid={errors.endsOn ? true : undefined}
                  aria-describedby={
                    errors.endsOn ? "term-ends-error" : undefined
                  }
                />
                {errors.endsOn ? (
                  <p id="term-ends-error" className="text-xs text-destructive">
                    {errors.endsOn}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Inclusive last day of the term.
                  </p>
                )}
              </div>
            </div>

            <Label
              htmlFor="term-current-toggle"
              className="flex items-start justify-between gap-4 rounded-lg border p-3 font-normal"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Mark as current term
                </span>
                <span className="text-xs text-muted-foreground">
                  Only one academic term can be current. Enabling this would
                  replace the existing current marker.
                </span>
              </span>
              <Switch
                id="term-current-toggle"
                checked={form.isCurrent}
                onCheckedChange={(checked) => update("isCurrent", checked)}
              />
            </Label>

            {replacingCurrent && currentTerm ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  “{currentTerm.name}” is currently marked as the current term
                  and would be replaced.
                </span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Terms belong to classes. Programs use intakes instead, so this
                form never changes a program.
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
                      ? `Term update preview closed. “${form.name.trim()}” was not changed — this is a UI demo.`
                      : `Term preview closed. “${form.name.trim()}” was not added — this is a UI demo.`
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
              <Button type="submit" form="term-form">
                {isEdit ? "Save changes (demo)" : "Add term (demo)"}
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