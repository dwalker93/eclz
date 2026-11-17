"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Textarea } from "@workspace/ui/components/textarea"
import {
  CalendarRangeIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  PercentIcon,
  RepeatIcon,
} from "lucide-react"

import { formatLkr } from "@/lib/courses-data"
import {
  discountTypeLabels,
  discountTypeOptions,
  enrollmentFormOptions,
  feeExceptionKindLabels,
  feeExceptionKindOptions,
  getAlternateOptionById,
  getAlternateOptionsForCourse,
  getEnrollmentFormOption,
  type DiscountType,
  type FeeExceptionKind,
  type FeeExceptionRecord,
} from "@/lib/fee-exceptions-data"
import { MOCK_TODAY, formatDisplayDate } from "@/lib/students-data"

type FeeExceptionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this exception; otherwise it creates one. */
  exception?: FeeExceptionRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  enrollmentId: string
  kind: FeeExceptionKind
  alternateFeeStructureId: string
  discountType: DiscountType
  discountValue: string
  effectiveFrom: string
  effectiveTo: string
  reason: string
}

type FormErrors = {
  enrollmentId?: string
  alternateFeeStructureId?: string
  discountValue?: string
  effectiveFrom?: string
  effectiveTo?: string
  reason?: string
}

function createEmptyForm(exception?: FeeExceptionRecord | null): FormState {
  if (exception) {
    return {
      enrollmentId: exception.enrollmentId,
      kind: exception.kind,
      alternateFeeStructureId: exception.alternateFeeStructureId ?? "",
      discountType: exception.discountType ?? "percent",
      discountValue:
        exception.discountValue === null
          ? ""
          : String(exception.discountValue),
      effectiveFrom: exception.effectiveFrom,
      effectiveTo: exception.effectiveTo ?? "",
      reason: exception.reason,
    }
  }

  return {
    enrollmentId: "",
    kind: "discount",
    alternateFeeStructureId: "",
    discountType: "percent",
    discountValue: "",
    effectiveFrom: MOCK_TODAY,
    effectiveTo: "",
    reason: "",
  }
}

function previewAmount(
  kind: FeeExceptionKind,
  discountType: DiscountType,
  discountValue: string,
  alternateFeeStructureId: string,
  originalFeeAmount: number
) {
  if (kind === "alternate_option") {
    const option = getAlternateOptionById(alternateFeeStructureId)

    return option?.amount ?? originalFeeAmount
  }

  const value = Number(discountValue)

  if (!Number.isFinite(value) || value < 0) return originalFeeAmount

  if (discountType === "percent") {
    return Math.max(0, Math.round(originalFeeAmount - (originalFeeAmount * value) / 100))
  }

  return Math.max(0, originalFeeAmount - value)
}

export function FeeExceptionFormDialog({
  open,
  onOpenChange,
  exception,
  onSaved,
}: FeeExceptionFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(exception))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(exception)

  useEffect(() => {
    setForm(createEmptyForm(exception))
    setErrors({})
    setSubmitted(false)
  }, [open, exception])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const enrollment = getEnrollmentFormOption(form.enrollmentId)
  const originalFeeAmount = enrollment?.originalFeeAmount ?? 0
  const alternateOptions = enrollment
    ? getAlternateOptionsForCourse(enrollment.courseId)
    : []
  const selectedAlternate = getAlternateOptionById(form.alternateFeeStructureId)
  const resultingAmount = previewAmount(
    form.kind,
    form.discountType,
    form.discountValue,
    form.alternateFeeStructureId,
    originalFeeAmount
  )
  const discountPercent =
    originalFeeAmount > 0
      ? Math.round(((originalFeeAmount - resultingAmount) / originalFeeAmount) * 100)
      : 0

  const enrollmentOptions = useMemo(
    () => enrollmentFormOptions.map(({ value, label }) => ({ value, label })),
    []
  )

  function handleEnrollmentChange(value: string | null) {
    const nextId = value ?? ""
    const nextEnrollment = getEnrollmentFormOption(nextId)
    const options = nextEnrollment
      ? getAlternateOptionsForCourse(nextEnrollment.courseId)
      : []

    setForm((previous) => ({
      ...previous,
      enrollmentId: nextId,
      alternateFeeStructureId: options[0]?.id ?? "",
    }))
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!form.enrollmentId) {
      nextErrors.enrollmentId = "Select the enrollment this exception attaches to."
    }

    if (form.kind === "alternate_option") {
      if (alternateOptions.length === 0) {
        nextErrors.alternateFeeStructureId =
          "This course has no alternate fee structure yet. Add one on Fee Structures first."
      } else if (!form.alternateFeeStructureId) {
        nextErrors.alternateFeeStructureId = "Choose an alternate fee option."
      }
    }

    if (form.kind === "discount") {
      const value = Number(form.discountValue)

      if (form.discountValue.trim() === "" || !Number.isFinite(value)) {
        nextErrors.discountValue = "Enter a discount value."
      } else if (value < 0) {
        nextErrors.discountValue = "The discount cannot be negative."
      } else if (form.discountType === "percent" && value > 100) {
        nextErrors.discountValue = "A percentage discount cannot exceed 100%."
      }
    }

    if (!form.effectiveFrom) {
      nextErrors.effectiveFrom = "A start date is required."
    }

    if (form.effectiveTo && form.effectiveFrom && form.effectiveTo <= form.effectiveFrom) {
      nextErrors.effectiveTo =
        "The end date must be after the start date (the end date is exclusive)."
    }

    if (!form.reason.trim()) {
      nextErrors.reason = "A reason is required for every exception."
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

  const rangeLabel = form.effectiveFrom
    ? `${formatDisplayDate(form.effectiveFrom)} → ${
        form.effectiveTo ? formatDisplayDate(form.effectiveTo) : "open-ended"
      }`
    : "Not set"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PercentIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit fee exception" : "Add fee exception"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the exception preview. Nothing is saved — this is a UI demo."
              : "Attach a discount or an alternate fee option to an enrollment. Nothing is saved."}
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
                  {isEdit ? "Exception update ready" : "Exception ready to add"}
                </span>
                <p className="text-sm">
                  {enrollment
                    ? `${enrollment.studentName} · ${enrollment.courseName} would ${
                        isEdit ? "be updated" : "receive"
                      } this exception in the demo preview.`
                    : "The exception preview is ready."}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField
                label="Student"
                value={
                  enrollment
                    ? `${enrollment.studentName} · ${enrollment.studentNo}`
                    : "—"
                }
              />
              <PreviewField
                label="Enrollment / course"
                value={enrollment?.courseName ?? "—"}
              />
              <PreviewField
                label="Kind"
                value={feeExceptionKindLabels[form.kind]}
              />
              <PreviewField
                label="Exception"
                value={
                  form.kind === "alternate_option"
                    ? selectedAlternate?.name ?? "Alternate fee option"
                    : form.discountType === "percent"
                      ? `${form.discountValue}% off`
                      : `${formatLkr(Number(form.discountValue) || 0)} off`
                }
              />
              <PreviewField
                label="Original fee"
                value={formatLkr(originalFeeAmount)}
              />
              <PreviewField
                label="Resulting amount (illustrative)"
                value={formatLkr(resultingAmount)}
              />
              <PreviewField label="Effectivity" value={rangeLabel} />
              <PreviewField label="Reason" value={form.reason.trim() || "—"} />
            </dl>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo preview only. No exception is created or changed, and no
                invoice or balance is recalculated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="fee-exception-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fex-enrollment">
                <span>
                  Enrollment
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Select
                items={enrollmentOptions}
                value={form.enrollmentId || null}
                onValueChange={handleEnrollmentChange}
                disabled={isEdit}
              >
                <SelectTrigger
                  id="fex-enrollment"
                  className="w-full"
                  aria-invalid={errors.enrollmentId ? true : undefined}
                  aria-describedby={
                    errors.enrollmentId ? "fex-enrollment-error" : undefined
                  }
                >
                  <SelectValue placeholder="Select a student enrollment" />
                </SelectTrigger>
                <SelectContent>
                  {enrollmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.enrollmentId ? (
                <p id="fex-enrollment-error" className="text-xs text-destructive">
                  {errors.enrollmentId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Exceptions attach to an enrollment. An alternate option must
                  belong to the same course.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fex-kind">Kind</Label>
              <Select
                items={feeExceptionKindOptions}
                value={form.kind}
                onValueChange={(value) =>
                  update("kind", (value as FeeExceptionKind) ?? "discount")
                }
              >
                <SelectTrigger id="fex-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feeExceptionKindOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.kind === "alternate_option" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fex-alternate">Alternate fee option</Label>
                <Select
                  items={alternateOptions.map((option) => ({
                    value: option.id,
                    label: option.name,
                  }))}
                  value={form.alternateFeeStructureId || null}
                  onValueChange={(value) =>
                    update("alternateFeeStructureId", value ?? "")
                  }
                  disabled={alternateOptions.length === 0}
                >
                  <SelectTrigger
                    id="fex-alternate"
                    className="w-full"
                    aria-invalid={
                      errors.alternateFeeStructureId ? true : undefined
                    }
                    aria-describedby={
                      errors.alternateFeeStructureId
                        ? "fex-alternate-error"
                        : undefined
                    }
                  >
                    <SelectValue
                      placeholder={
                        alternateOptions.length === 0
                          ? "No alternate structures for this course"
                          : "Select an alternate fee option"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {alternateOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.alternateFeeStructureId ? (
                  <p id="fex-alternate-error" className="text-xs text-destructive">
                    {errors.alternateFeeStructureId}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {selectedAlternate
                      ? `Alternate fee: ${formatLkr(selectedAlternate.amount)} for the same course.`
                      : "Only fee structures for the selected course are offered."}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fex-discount-type">Discount type</Label>
                  <Select
                    items={discountTypeOptions}
                    value={form.discountType}
                    onValueChange={(value) =>
                      update("discountType", (value as DiscountType) ?? "percent")
                    }
                  >
                    <SelectTrigger id="fex-discount-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {discountTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fex-discount-value">
                    <span>
                      {form.discountType === "percent"
                        ? "Percentage off"
                        : "Amount off (LKR)"}
                      <span
                        className="ml-0.5 text-destructive"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    </span>
                  </Label>
                  <Input
                    id="fex-discount-value"
                    type="number"
                    min={0}
                    max={form.discountType === "percent" ? 100 : undefined}
                    step={form.discountType === "percent" ? 1 : 50}
                    value={form.discountValue}
                    onChange={(event) =>
                      update("discountValue", event.target.value)
                    }
                    placeholder={form.discountType === "percent" ? "15" : "500"}
                    aria-invalid={errors.discountValue ? true : undefined}
                    aria-describedby={
                      errors.discountValue
                        ? "fex-discount-value-error"
                        : undefined
                    }
                  />
                  {errors.discountValue ? (
                    <p
                      id="fex-discount-value-error"
                      className="text-xs text-destructive"
                    >
                      {errors.discountValue}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {form.discountType === "percent"
                        ? "0–100%. 100% creates a free place."
                        : `${discountTypeLabels.fixed} is capped so the fee never goes below zero.`}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fex-effective-from">
                  <span>
                    Effective from
                    <span className="ml-0.5 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="fex-effective-from"
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(event) =>
                    update("effectiveFrom", event.target.value)
                  }
                  aria-invalid={errors.effectiveFrom ? true : undefined}
                  aria-describedby={
                    errors.effectiveFrom ? "fex-effective-from-error" : undefined
                  }
                />
                {errors.effectiveFrom ? (
                  <p
                    id="fex-effective-from-error"
                    className="text-xs text-destructive"
                  >
                    {errors.effectiveFrom}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fex-effective-to">
                  <span>
                    Effective to
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional, exclusive)
                    </span>
                  </span>
                </Label>
                <Input
                  id="fex-effective-to"
                  type="date"
                  value={form.effectiveTo}
                  onChange={(event) =>
                    update("effectiveTo", event.target.value)
                  }
                  aria-invalid={errors.effectiveTo ? true : undefined}
                  aria-describedby={
                    errors.effectiveTo ? "fex-effective-to-error" : undefined
                  }
                />
                {errors.effectiveTo ? (
                  <p
                    id="fex-effective-to-error"
                    className="text-xs text-destructive"
                  >
                    {errors.effectiveTo}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Leave empty for an open-ended exception.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fex-reason">
                <span>
                  Reason
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Textarea
                id="fex-reason"
                value={form.reason}
                onChange={(event) => update("reason", event.target.value)}
                placeholder="e.g. Sibling concession approved for two terms"
                aria-invalid={errors.reason ? true : undefined}
                aria-describedby={errors.reason ? "fex-reason-error" : undefined}
              />
              {errors.reason ? (
                <p id="fex-reason-error" className="text-xs text-destructive">
                  {errors.reason}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A reason is required and stays on the audit trail.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarRangeIcon className="size-4" aria-hidden="true" />
                Illustrative effect
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Original fee
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatLkr(originalFeeAmount)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Resulting amount
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatLkr(resultingAmount)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {discountPercent > 0
                    ? `${discountPercent}% lower`
                    : "No reduction"}
                </Badge>
                <span className="text-xs text-muted-foreground">{rangeLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Local preview only. The real invoice is recalculated by the
                billing service, not on this page.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className="flex flex-col gap-1">
                <span className="flex items-start gap-1.5">
                  <RepeatIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Exceptions attach to a single enrollment. An alternate fee
                  option must belong to the same course.
                </span>
                <span>
                  Existing active exceptions keep applying even if the module is
                  switched off; only the admin screen is hidden.
                </span>
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
                      ? "Fee exception update preview closed. Nothing was changed — this is a UI demo."
                      : "Fee exception preview closed. Nothing was added — this is a UI demo."
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
              <Button type="submit" form="fee-exception-form">
                {isEdit ? "Save changes (demo)" : "Add exception (demo)"}
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
      <dd className="text-sm" title={value}>
        {value}
      </dd>
    </div>
  )
}
