"use client"

import { useEffect, useState } from "react"
import type { FormEvent, ReactNode } from "react"

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
import { Textarea } from "@workspace/ui/components/textarea"
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TrendingUpIcon,
} from "lucide-react"

import {
  getFirstOfNextBillingMonth,
  promotionBranchOptions,
  promotionCourseGroupOptions,
  promotionGradeOptions,
} from "@/lib/promotions-data"
import { formatDisplayDate } from "@/lib/students-data"

const DEFAULT_EFFECTIVE_DATE = getFirstOfNextBillingMonth()

type PromotionSetupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type FormState = {
  branchId: string
  gradeId: string
  courseGroup: string
  effectiveDate: string
  note: string
}

const emptyForm: FormState = {
  branchId: "all",
  gradeId: "all",
  courseGroup: "all",
  effectiveDate: DEFAULT_EFFECTIVE_DATE,
  note: "",
}

export function PromotionSetupDialog({
  open,
  onOpenChange,
  onCreated,
}: PromotionSetupDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(emptyForm)
      setError(null)
      setPreview(false)
    }
  }, [open])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    if (key === "effectiveDate") setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.effectiveDate) {
      setError("Effective date is required.")
      return
    }

    setPreview(true)
  }

  const branchLabel =
    promotionBranchOptions.find((option) => option.value === form.branchId)
      ?.label ?? "All branches"
  const gradeLabel =
    promotionGradeOptions.find((option) => option.value === form.gradeId)
      ?.label ?? "All grades"
  const courseGroupLabel =
    promotionCourseGroupOptions.find(
      (option) => option.value === form.courseGroup
    )?.label ?? "All course groups"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUpIcon className="size-4" aria-hidden="true" />
            Create promotion run
          </DialogTitle>
          <DialogDescription>
            Set up the cohort for a draft run, then review each student before
            confirming. This is a UI demo — nothing is saved.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300">
              <CircleCheckIcon
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Draft setup preview ready
                </span>
                <p className="text-sm">
                  Nothing was saved or generated. In the full workflow, cohort
                  items would be created as draft rows from active class
                  enrollments in this scope.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Branch" value={branchLabel} />
              <PreviewField label="Grade cohort" value={gradeLabel} />
              <PreviewField label="Course group" value={courseGroupLabel} />
              <PreviewField
                label="Effective date"
                value={formatDisplayDate(form.effectiveDate)}
              />
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Note
                </dt>
                <dd className="text-sm">
                  {form.note.trim() || "No note added."}
                </dd>
              </div>
            </dl>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Every active class enrollment in scope becomes a review item.
                Students with no active class enrollment receive one item
                without a class. Decisions and confirmation stay local to this
                demo.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="promotion-setup-form"
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Branch" htmlFor="promotion-branch">
                <Select
                  items={promotionBranchOptions}
                  value={form.branchId}
                  onValueChange={(value) =>
                    update("branchId", value ?? "all")
                  }
                >
                  <SelectTrigger id="promotion-branch" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promotionBranchOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Grade cohort"
                htmlFor="promotion-grade"
                hint="Uses the current student_level grade."
              >
                <Select
                  items={promotionGradeOptions}
                  value={form.gradeId}
                  onValueChange={(value) => update("gradeId", value ?? "all")}
                >
                  <SelectTrigger id="promotion-grade" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promotionGradeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Course group"
                htmlFor="promotion-course-group"
                hint="Limits the cohort to one subject family."
              >
                <Select
                  items={promotionCourseGroupOptions}
                  value={form.courseGroup}
                  onValueChange={(value) =>
                    update("courseGroup", value ?? "all")
                  }
                >
                  <SelectTrigger
                    id="promotion-course-group"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promotionCourseGroupOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Effective date"
                required
                error={error ?? undefined}
                htmlFor="promotion-effective-date"
                hint={`Default is the first day of the next billing month (${formatDisplayDate(DEFAULT_EFFECTIVE_DATE)}).`}
              >
                <Input
                  id="promotion-effective-date"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(event) =>
                    update("effectiveDate", event.target.value)
                  }
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    error ? "promotion-effective-date-error" : undefined
                  }
                />
              </Field>
            </div>

            <Field label="Note" htmlFor="promotion-note">
              <Textarea
                id="promotion-note"
                value={form.note}
                onChange={(event) => update("note", event.target.value)}
                rows={3}
                placeholder="Optional context for reviewers, e.g. the cohort or the reason for this run."
              />
            </Field>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <CalendarDaysIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                New grade history rows would start on the effective date. The
                first-of-next-billing-month default is a preview only; it can be
                changed before review.
              </span>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <CircleAlertIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              A draft run never changes grades, enrollments or billing. Only a
              later confirmation step would apply decisions, and that step is
              not implemented in this demo.
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {preview ? (
            <>
              <Button variant="outline" onClick={() => setPreview(false)}>
                Back to setup
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onCreated()
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
              <Button type="submit" form="promotion-setup-form">
                Preview draft (demo)
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
