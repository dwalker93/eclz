"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

import { Badge } from "@workspace/ui/components/badge"
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
import { CheckIcon, CircleAlertIcon, InfoIcon, LayersIcon } from "lucide-react"

import {
  gradeStageOptions,
  type GradeLevelDirectoryRecord,
} from "@/lib/grade-levels-data"
import { gradeLevels, stageLabel, type GradeStage } from "@/lib/students-data"

type GradeLevelFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this grade level; otherwise it creates a new one. */
  gradeLevel?: GradeLevelDirectoryRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  name: string
  stage: GradeStage
  ordinal: string
}

type FormErrors = {
  name?: string
  ordinal?: string
}

const HIGHEST_ORDINAL = gradeLevels.reduce(
  (highest, gradeLevel) => Math.max(highest, gradeLevel.ordinal),
  0
)

function createEmptyForm(
  gradeLevel?: GradeLevelDirectoryRecord | null
): FormState {
  return {
    name: gradeLevel?.name ?? "",
    stage: gradeLevel?.stage ?? "primary",
    ordinal: String(gradeLevel?.ordinal ?? HIGHEST_ORDINAL + 1),
  }
}

export function GradeLevelFormDialog({
  open,
  onOpenChange,
  gradeLevel,
  onSaved,
}: GradeLevelFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(gradeLevel))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(gradeLevel)

  useEffect(() => {
    setForm(createEmptyForm(gradeLevel))
    setErrors({})
    setSubmitted(false)
  }, [open, gradeLevel])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}
    const name = form.name.trim()
    const ordinal = Number(form.ordinal)

    if (!name) {
      nextErrors.name = "Grade level name is required."
    } else {
      const duplicate = gradeLevels.find(
        (item) =>
          item.id !== gradeLevel?.id &&
          item.name.toLowerCase() === name.toLowerCase()
      )

      if (duplicate) {
        nextErrors.name = `“${name}” already exists. Grade level names are unique.`
      }
    }

    if (form.ordinal.trim() === "") {
      nextErrors.ordinal = "Ordinal is required."
    } else if (!Number.isInteger(ordinal) || ordinal < 1) {
      nextErrors.ordinal = "Ordinal must be a whole number of 1 or more."
    } else {
      const duplicate = gradeLevels.find(
        (item) => item.id !== gradeLevel?.id && item.ordinal === ordinal
      )

      if (duplicate) {
        nextErrors.ordinal = `Ordinal ${ordinal} is already used by ${duplicate.name}. Ordinals are unique.`
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

  const trimmedName = form.name.trim()
  const ordinalNumber = Number(form.ordinal)
  const ordinalChanged =
    isEdit && gradeLevel ? gradeLevel.ordinal !== ordinalNumber : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayersIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit grade level" : "Add grade level"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the grade level name, stage or ordinal. This is a UI preview — no record is changed."
              : "Add a grade level to the ordered list. This is a UI preview — no record is saved."}
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
                  {isEdit
                    ? "Grade level update ready"
                    : "Grade level ready to add"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `“${trimmedName}” would be updated in the grade level list.`
                    : `“${trimmedName}” would be added to the grade level list.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Grade level
                </dt>
                <dd className="truncate text-sm" title={trimmedName}>
                  {trimmedName}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Stage
                </dt>
                <dd className="text-sm">{stageLabel(form.stage)}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ordinal
                </dt>
                <dd className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="rounded-full">
                    {ordinalNumber}
                  </Badge>
                  {ordinalChanged ? (
                    <span className="text-xs text-muted-foreground">
                      was {gradeLevel?.ordinal}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>

            {ordinalChanged ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Moving “{trimmedName}” to ordinal {ordinalNumber} changes the
                  order promotion uses. Next-grade proposals in a promotion run
                  follow the ordinal order, so every grade between the old and
                  new position would shift.
                </span>
              </div>
            ) : null}

            <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Name and ordinal are unique across grade levels.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                The ordinal decides display order and the next grade used by
                promotion.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Student and course counts are derived, not stored on this row.
              </li>
            </ul>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No grade level is created, updated
                or reordered.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="grade-level-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grade-level-name">
                <span>
                  Grade level name
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Input
                id="grade-level-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. Grade 8"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={
                  errors.name ? "grade-level-name-error" : undefined
                }
              />
              {errors.name ? (
                <p
                  id="grade-level-name-error"
                  className="text-xs text-destructive"
                >
                  {errors.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The display name shown in promotion and class setup.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="grade-level-stage">
                  <span>
                    Stage
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Select
                  items={gradeStageOptions}
                  value={form.stage}
                  onValueChange={(value) =>
                    update("stage", (value ?? "primary") as GradeStage)
                  }
                >
                  <SelectTrigger id="grade-level-stage" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeStageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Primary, junior, ordinary level or advanced level.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="grade-level-ordinal">
                  <span>
                    Ordinal
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="grade-level-ordinal"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.ordinal}
                  onChange={(event) => update("ordinal", event.target.value)}
                  aria-invalid={errors.ordinal ? true : undefined}
                  aria-describedby={
                    errors.ordinal ? "grade-level-ordinal-error" : undefined
                  }
                />
                {errors.ordinal ? (
                  <p
                    id="grade-level-ordinal-error"
                    className="text-xs text-destructive"
                  >
                    {errors.ordinal}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Whole number of 1 or more; unique across grade levels.
                  </p>
                )}
              </div>
            </div>

            {ordinalChanged ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Changing the ordinal reorders the list and the next-grade
                  proposal used by promotion runs. Nothing is applied in this
                  demo.
                </span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                A grade level stores only a name, stage and ordinal. Students
                hold history rows in <code>student_level</code>; the profile
                itself does not store a grade.
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
                      ? `Grade level update preview closed. “${trimmedName}” was not changed — this is a UI demo.`
                      : `Grade level preview closed. “${trimmedName}” was not added — this is a UI demo.`
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
              <Button type="submit" form="grade-level-form">
                {isEdit ? "Save changes (demo)" : "Add grade level (demo)"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
