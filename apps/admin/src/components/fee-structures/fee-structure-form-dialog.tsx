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
import { Switch } from "@workspace/ui/components/switch"
import {
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  ReceiptTextIcon,
} from "lucide-react"

import {
  formatLkr,
  getCourseById,
  type FeeBillingType,
  type FeeFrequency,
} from "@/lib/courses-data"
import {
  feeBillingTypeOptions,
  feeFrequencyLabels,
  feeFrequencyOptions,
  feeStructureCourseFormOptions,
  getCourseFormOption,
  getCurrentRate,
  getIntakeOptionsForCourse,
  overdueActionLabels,
  overdueActionOptions,
  type FeeStructureRecord,
  type OverdueAction,
} from "@/lib/fee-structures-data"
import { formatDisplayDate, MOCK_TODAY } from "@/lib/students-data"

type FeeStructureFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this structure; otherwise it creates one. */
  structure?: FeeStructureRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  name: string
  courseId: string
  intakeId: string
  billingType: FeeBillingType
  frequency: FeeFrequency
  accessDurationMonths: string
  isDefault: boolean
  isActive: boolean
  overdueGraceDays: string
  overdueAction: OverdueAction
  rateAmount: string
  rateEffectiveFrom: string
  offerInstallments: boolean
  installmentName: string
  installmentCount: string
  downPaymentPercent: string
  intervalDays: string
  surchargePercent: string
}

type FormErrors = Record<string, string>

function createEmptyForm(structure?: FeeStructureRecord | null): FormState {
  if (structure) {
    const rate = getCurrentRate(structure)
    const installment = structure.installmentOptions[0]

    return {
      name: structure.name,
      courseId: structure.courseId,
      intakeId: structure.intakeId ?? "",
      billingType: structure.billingType,
      frequency: structure.frequency ?? "monthly",
      accessDurationMonths:
        structure.accessDurationMonths === null
          ? ""
          : String(structure.accessDurationMonths),
      isDefault: structure.isDefault,
      isActive: structure.isActive,
      overdueGraceDays:
        structure.overdueGraceDays === null
          ? ""
          : String(structure.overdueGraceDays),
      overdueAction: structure.overdueAction,
      rateAmount: rate ? String(rate.amount) : "",
      rateEffectiveFrom: rate?.effectiveFrom ?? MOCK_TODAY,
      offerInstallments: structure.installmentOptions.length > 0,
      installmentName: installment?.name ?? "2 installments",
      installmentCount: String(installment?.installmentCount ?? 2),
      downPaymentPercent: String(installment?.downPaymentPercent ?? 50),
      intervalDays: String(installment?.intervalDays ?? 30),
      surchargePercent: String(installment?.surchargePercent ?? 2.5),
    }
  }

  return {
    name: "",
    courseId: "",
    intakeId: "",
    billingType: "recurring",
    frequency: "monthly",
    accessDurationMonths: "",
    isDefault: true,
    isActive: true,
    overdueGraceDays: "7",
    overdueAction: "notify",
    rateAmount: "",
    rateEffectiveFrom: MOCK_TODAY,
    offerInstallments: false,
    installmentName: "2 installments",
    installmentCount: "2",
    downPaymentPercent: "50",
    intervalDays: "30",
    surchargePercent: "2.5",
  }
}

export function FeeStructureFormDialog({
  open,
  onOpenChange,
  structure,
  onSaved,
}: FeeStructureFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(structure))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(structure)
  const isRecurring = form.billingType === "recurring"

  useEffect(() => {
    setForm(createEmptyForm(structure))
    setErrors({})
    setSubmitted(false)
  }, [open, structure])

  const selectedCourse = form.courseId
    ? getCourseById(form.courseId)
    : undefined
  const branchName =
    getCourseFormOption(form.courseId)?.branchName ??
    selectedCourse?.branchName ??
    "Not set"
  const intakeOptions = useMemo(
    () => getIntakeOptionsForCourse(form.courseId),
    [form.courseId]
  )
  const gradeLabel =
    selectedCourse && selectedCourse.gradeNames.length > 0
      ? selectedCourse.gradeNames.join(", ")
      : "All grades (ungraded)"

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => {
      const next = { ...previous, [key]: value }

      if (key === "billingType") {
        const billing = value as FeeBillingType
        next.offerInstallments = billing === "one_time_package"
        if (billing === "recurring") {
          next.accessDurationMonths = ""
          next.frequency = "monthly"
        }
      }

      if (key === "courseId") {
        next.intakeId = ""
      }

      return next
    })
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}
    const amount = Number(form.rateAmount)
    const graceDays = form.overdueGraceDays.trim()
    const accessDuration = form.accessDurationMonths.trim()

    if (!form.name.trim()) {
      nextErrors.name = "Fee structure name is required."
    }

    if (!form.courseId) {
      nextErrors.courseId = "Select the course or class this fee belongs to."
    }

    if (isRecurring && !form.frequency) {
      nextErrors.frequency = "Choose a recurring frequency."
    }

    if (
      !isRecurring &&
      accessDuration !== "" &&
      (!Number.isInteger(Number(accessDuration)) || Number(accessDuration) <= 0)
    ) {
      nextErrors.accessDurationMonths =
        "Access duration must be a whole number of months, or blank for lifetime."
    }

    if (form.rateAmount.trim() === "") {
      nextErrors.rateAmount = "A rate amount is required."
    } else if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.rateAmount = "The rate must be greater than zero."
    }

    if (!form.rateEffectiveFrom) {
      nextErrors.rateEffectiveFrom = "Choose when the rate takes effect."
    }

    if (graceDays !== "") {
      if (!Number.isInteger(Number(graceDays)) || Number(graceDays) < 0) {
        nextErrors.overdueGraceDays =
          "Grace days must be a whole number of 0 or more."
      }
    }

    if (!isRecurring && form.offerInstallments) {
      if (!form.installmentName.trim()) {
        nextErrors.installmentName = "Give the installment option a name."
      }

      const count = Number(form.installmentCount)
      if (!Number.isInteger(count) || count < 2) {
        nextErrors.installmentCount = "Use at least 2 installments."
      }

      const down = Number(form.downPaymentPercent)
      if (!Number.isFinite(down) || down < 0 || down >= 100) {
        nextErrors.downPaymentPercent =
          "Down payment must be 0 or more and under 100%."
      }

      const interval = Number(form.intervalDays)
      if (!Number.isInteger(interval) || interval <= 0) {
        nextErrors.intervalDays = "Interval must be a whole number of days."
      }

      const surcharge = Number(form.surchargePercent)
      if (!Number.isFinite(surcharge) || surcharge < 0) {
        nextErrors.surchargePercent = "Surcharge cannot be negative."
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptTextIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit fee structure" : "Add fee structure"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this course fee. This is a UI preview — no fee structure is changed."
              : "Set a fee structure on a course or class. This is a UI preview — no fee is saved."}
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
                  {isEdit ? "Fee update ready" : "Fee structure ready to add"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `“${form.name}” would be updated for ${selectedCourse?.name ?? "the course"}.`
                    : `“${form.name}” would be added to ${selectedCourse?.name ?? "the course"}.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Name" value={form.name} />
              <PreviewField
                label="Course"
                value={selectedCourse?.name ?? "Not set"}
              />
              <PreviewField label="Branch" value={branchName} />
              <PreviewField
                label="Billing"
                value={
                  isRecurring
                    ? `Recurring · ${feeFrequencyLabels[form.frequency]}`
                    : "One-time package"
                }
              />
              <PreviewField
                label="Access duration"
                value={
                  isRecurring
                    ? "Follows the enrollment"
                    : form.accessDurationMonths.trim()
                      ? `${form.accessDurationMonths} months`
                      : "Lifetime access"
                }
              />
              <PreviewField
                label="Default"
                value={
                  form.isDefault
                    ? "Defaults onto new enrollments"
                    : "Not the default"
                }
              />
              <PreviewField
                label="Current rate"
                value={`${form.rateAmount ? formatLkr(Number(form.rateAmount)) : "—"} · ${
                  isRecurring ? feeFrequencyLabels[form.frequency] : "package"
                }`}
              />
              <PreviewField
                label="Effective from"
                value={formatDisplayDate(form.rateEffectiveFrom)}
              />
              <PreviewField label="Rate grade" value={gradeLabel} />
              <PreviewField
                label="Overdue"
                value={`${form.overdueGraceDays.trim() ? `${form.overdueGraceDays} days` : "No grace"} · ${overdueActionLabels[form.overdueAction]}`}
              />
              {!isRecurring && form.offerInstallments ? (
                <PreviewField
                  label="Installment option"
                  value={`${form.installmentName || "Installment plan"} · ${form.installmentCount} × ${form.intervalDays} days · ${form.downPaymentPercent}% down · ${form.surchargePercent}% surcharge`}
                />
              ) : null}
            </dl>

            <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                The fee belongs to this course and defaults onto new
                enrollments.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Rates are grade-specific and date-bounded; a zero rate is not
                allowed.
              </li>
              <li className="flex items-start gap-1.5">
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Only one active default structure is allowed per course.
              </li>
            </ul>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No fee structure, rate or
                installment option is created or updated, and no invoice is
                generated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="fee-structure-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="fee-name">
                  <span>
                    Fee name
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="fee-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="e.g. Grade 8 mathematics monthly fee"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? "fee-name-error" : undefined}
                />
                {errors.name ? (
                  <p id="fee-name-error" className="text-xs text-destructive">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-course">
                  <span>
                    Course or class
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                {isEdit ? (
                  <Input
                    id="fee-course"
                    value={selectedCourse?.name ?? ""}
                    readOnly
                    disabled
                  />
                ) : (
                  <Select
                    items={feeStructureCourseFormOptions}
                    value={form.courseId || null}
                    onValueChange={(value) => update("courseId", value ?? "")}
                  >
                    <SelectTrigger
                      id="fee-course"
                      className="w-full"
                      aria-invalid={errors.courseId ? true : undefined}
                      aria-describedby={
                        errors.courseId ? "fee-course-error" : undefined
                      }
                    >
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {feeStructureCourseFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.courseId ? (
                  <p id="fee-course-error" className="text-xs text-destructive">
                    {errors.courseId}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Branch: {branchName} · Grades: {gradeLabel}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-intake">
                  <span>
                    Intake
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                </Label>
                <Select
                  items={intakeOptions}
                  value={form.intakeId || null}
                  onValueChange={(value) => update("intakeId", value ?? "")}
                  disabled={intakeOptions.length === 0}
                >
                  <SelectTrigger id="fee-intake" className="w-full">
                    <SelectValue placeholder="Not intake-specific" />
                  </SelectTrigger>
                  <SelectContent>
                    {intakeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only programs with intakes can scope a fee to one intake.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-billing-type">
                  <span>
                    Billing type
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Select
                  items={feeBillingTypeOptions}
                  value={form.billingType}
                  onValueChange={(value) =>
                    update(
                      "billingType",
                      (value as FeeBillingType) ?? "recurring"
                    )
                  }
                >
                  <SelectTrigger id="fee-billing-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feeBillingTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-frequency">
                  <span>
                    Frequency
                    {isRecurring ? (
                      <span
                        className="ml-0.5 text-destructive"
                        aria-hidden="true"
                      >
                        *
                      </span>
                    ) : null}
                  </span>
                </Label>
                <Select
                  items={feeFrequencyOptions}
                  value={form.frequency}
                  onValueChange={(value) =>
                    update("frequency", (value as FeeFrequency) ?? "monthly")
                  }
                  disabled={!isRecurring}
                >
                  <SelectTrigger
                    id="fee-frequency"
                    className="w-full"
                    aria-invalid={errors.frequency ? true : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feeFrequencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.frequency ? (
                  <p className="text-xs text-destructive">{errors.frequency}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isRecurring
                      ? "Recurring fees bill monthly or per term."
                      : "One-time packages have no frequency."}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-access">
                  <span>
                    Access duration
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (months)
                    </span>
                  </span>
                </Label>
                <Input
                  id="fee-access"
                  type="number"
                  min={1}
                  value={form.accessDurationMonths}
                  onChange={(event) =>
                    update("accessDurationMonths", event.target.value)
                  }
                  disabled={isRecurring}
                  placeholder="Blank = lifetime"
                  aria-invalid={errors.accessDurationMonths ? true : undefined}
                />
                {errors.accessDurationMonths ? (
                  <p className="text-xs text-destructive">
                    {errors.accessDurationMonths}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    One-time packages only.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-amount">
                  <span>
                    Current rate
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="fee-amount"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.rateAmount}
                  onChange={(event) => update("rateAmount", event.target.value)}
                  placeholder="e.g. 4500"
                  aria-invalid={errors.rateAmount ? true : undefined}
                  aria-describedby={
                    errors.rateAmount ? "fee-amount-error" : undefined
                  }
                />
                {errors.rateAmount ? (
                  <p id="fee-amount-error" className="text-xs text-destructive">
                    {errors.rateAmount}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    LKR · {gradeLabel}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-effective-from">
                  <span>
                    Effective from
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="fee-effective-from"
                  type="date"
                  value={form.rateEffectiveFrom}
                  onChange={(event) =>
                    update("rateEffectiveFrom", event.target.value)
                  }
                  aria-invalid={errors.rateEffectiveFrom ? true : undefined}
                />
                {errors.rateEffectiveFrom ? (
                  <p className="text-xs text-destructive">
                    {errors.rateEffectiveFrom}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Rates are date-bounded and never overlap.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-grace">
                  <span>
                    Overdue grace
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (days)
                    </span>
                  </span>
                </Label>
                <Input
                  id="fee-grace"
                  type="number"
                  min={0}
                  value={form.overdueGraceDays}
                  onChange={(event) =>
                    update("overdueGraceDays", event.target.value)
                  }
                  placeholder="No grace"
                  aria-invalid={errors.overdueGraceDays ? true : undefined}
                />
                {errors.overdueGraceDays ? (
                  <p className="text-xs text-destructive">
                    {errors.overdueGraceDays}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="fee-overdue-action">Overdue action</Label>
                <Select
                  items={overdueActionOptions}
                  value={form.overdueAction}
                  onValueChange={(value) =>
                    update("overdueAction", (value as OverdueAction) ?? "none")
                  }
                >
                  <SelectTrigger id="fee-overdue-action" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {overdueActionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Preview only — no reminder is sent and no access is
                  restricted.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Label
                htmlFor="fee-default-toggle"
                className="flex items-start justify-between gap-4 rounded-lg border p-3 font-normal"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Default structure</span>
                  <span className="text-xs text-muted-foreground">
                    Defaults onto new enrollments. Only one active default per
                    course is allowed.
                  </span>
                </span>
                <Switch
                  id="fee-default-toggle"
                  checked={form.isDefault}
                  onCheckedChange={(checked) => update("isDefault", checked)}
                />
              </Label>

              <Label
                htmlFor="fee-active-toggle"
                className="flex items-start justify-between gap-4 rounded-lg border p-3 font-normal"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Active</span>
                  <span className="text-xs text-muted-foreground">
                    Inactive structures stay visible but are not offered on new
                    enrollments.
                  </span>
                </span>
                <Switch
                  id="fee-active-toggle"
                  checked={form.isActive}
                  onCheckedChange={(checked) => update("isActive", checked)}
                />
              </Label>
            </div>

            {!isRecurring ? (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <Label
                  htmlFor="fee-installments-toggle"
                  className="flex items-start justify-between gap-4 font-normal"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      Offer an installment option
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Installment plans apply to one-time packages only and are
                      chosen when the invoice is issued.
                    </span>
                  </span>
                  <Switch
                    id="fee-installments-toggle"
                    checked={form.offerInstallments}
                    onCheckedChange={(checked) =>
                      update("offerInstallments", checked)
                    }
                  />
                </Label>

                {form.offerInstallments ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fee-installment-name">Option name</Label>
                      <Input
                        id="fee-installment-name"
                        value={form.installmentName}
                        onChange={(event) =>
                          update("installmentName", event.target.value)
                        }
                        aria-invalid={errors.installmentName ? true : undefined}
                      />
                      {errors.installmentName ? (
                        <p className="text-xs text-destructive">
                          {errors.installmentName}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fee-installment-count">
                        Installment count
                      </Label>
                      <Input
                        id="fee-installment-count"
                        type="number"
                        min={2}
                        value={form.installmentCount}
                        onChange={(event) =>
                          update("installmentCount", event.target.value)
                        }
                        aria-invalid={
                          errors.installmentCount ? true : undefined
                        }
                      />
                      {errors.installmentCount ? (
                        <p className="text-xs text-destructive">
                          {errors.installmentCount}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fee-down-payment">
                        Down payment percent
                      </Label>
                      <Input
                        id="fee-down-payment"
                        type="number"
                        min={0}
                        max={99}
                        step="0.01"
                        value={form.downPaymentPercent}
                        onChange={(event) =>
                          update("downPaymentPercent", event.target.value)
                        }
                        aria-invalid={
                          errors.downPaymentPercent ? true : undefined
                        }
                      />
                      {errors.downPaymentPercent ? (
                        <p className="text-xs text-destructive">
                          {errors.downPaymentPercent}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fee-interval">Interval days</Label>
                      <Input
                        id="fee-interval"
                        type="number"
                        min={1}
                        value={form.intervalDays}
                        onChange={(event) =>
                          update("intervalDays", event.target.value)
                        }
                        aria-invalid={errors.intervalDays ? true : undefined}
                      />
                      {errors.intervalDays ? (
                        <p className="text-xs text-destructive">
                          {errors.intervalDays}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fee-surcharge">Surcharge percent</Label>
                      <Input
                        id="fee-surcharge"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.surchargePercent}
                        onChange={(event) =>
                          update("surchargePercent", event.target.value)
                        }
                        aria-invalid={
                          errors.surchargePercent ? true : undefined
                        }
                      />
                      {errors.surchargePercent ? (
                        <p className="text-xs text-destructive">
                          {errors.surchargePercent}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Fees belong to a course or class. Classes are recurring;
                one-time packages may set an access duration and installment
                options. Per-student exceptions stay on the optional Fee
                Exceptions module.
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
                      ? `Fee update preview closed. “${form.name}” was not changed — this is a UI demo.`
                      : `Fee preview closed. “${form.name}” was not added — this is a UI demo.`
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
              <Button type="submit" form="fee-structure-form">
                {isEdit ? "Save structure (demo)" : "Add structure (demo)"}
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
        {value}
      </dd>
    </div>
  )
}
