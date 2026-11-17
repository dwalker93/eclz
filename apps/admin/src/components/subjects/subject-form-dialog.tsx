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
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  LibraryBigIcon,
} from "lucide-react"

import { subjects, type SubjectRecord } from "@/lib/courses-data"

type SubjectFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this subject; otherwise it creates a new one. */
  subject?: SubjectRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  code: string
  name: string
}

type FormErrors = {
  code?: string
  name?: string
}

function createEmptyForm(subject?: SubjectRecord | null): FormState {
  return {
    code: subject?.code ?? "",
    name: subject?.name ?? "",
  }
}

export function SubjectFormDialog({
  open,
  onOpenChange,
  subject,
  onSaved,
}: SubjectFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(subject))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(subject)

  useEffect(() => {
    setForm(createEmptyForm(subject))
    setErrors({})
    setSubmitted(false)
  }, [open, subject])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}
    const code = form.code.trim()
    const name = form.name.trim()

    if (!name) {
      nextErrors.name = "Subject name is required."
    }

    if (code) {
      const duplicate = subjects.find(
        (item) =>
          item.id !== subject?.id &&
          item.code !== null &&
          item.code.toLowerCase() === code.toLowerCase()
      )

      if (duplicate) {
        nextErrors.code = `Code “${code}” is already used by ${duplicate.name}. Codes are unique when set.`
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

  const trimmedCode = form.code.trim()
  const trimmedName = form.name.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LibraryBigIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit subject" : "Add subject"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the catalog entry. This is a UI preview — no record is changed."
              : "Add a subject to the catalog. This is a UI preview — no record is saved."}
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
                    ? "Subject update ready"
                    : "Subject ready to add"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `“${trimmedName}” would be updated in the subject catalog.`
                    : `“${trimmedName}” would be added to the subject catalog.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Code
                </dt>
                <dd className="text-sm">
                  {trimmedCode ? (
                    <Badge variant="outline" className="rounded-full">
                      {trimmedCode.toUpperCase()}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">No code</span>
                  )}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Subject name
                </dt>
                <dd className="truncate text-sm" title={trimmedName}>
                  {trimmedName}
                </dd>
              </div>
            </dl>

            <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Subject name is required; code is optional.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                A code, when provided, must be unique across subjects.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Course counts and teacher assignments come from courses, not
                from the subject record.
              </li>
            </ul>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No subject is created or updated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="subject-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject-name">
                <span>
                  Subject name
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Input
                id="subject-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. Mathematics"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "subject-name-error" : undefined}
              />
              {errors.name ? (
                <p
                  id="subject-name-error"
                  className="text-xs text-destructive"
                >
                  {errors.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The display name used on courses and class setup.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject-code">
                <span>
                  Code
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
              </Label>
              <Input
                id="subject-code"
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
                placeholder="e.g. MAT"
                aria-invalid={errors.code ? true : undefined}
                aria-describedby={errors.code ? "subject-code-error" : undefined}
              />
              {errors.code ? (
                <p
                  id="subject-code-error"
                  className="text-xs text-destructive"
                >
                  {errors.code}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Optional, but unique across the catalog when set.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Subjects only store a code and a name. Courses, grades and
                teachers are linked from the course record.
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
                      ? `Subject update preview closed. “${trimmedName}” was not changed — this is a UI demo.`
                      : `Subject preview closed. “${trimmedName}” was not added — this is a UI demo.`
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
              <Button type="submit" form="subject-form">
                {isEdit ? "Save changes (demo)" : "Add subject (demo)"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}