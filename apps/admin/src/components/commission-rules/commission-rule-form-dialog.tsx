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
import { Separator } from "@workspace/ui/components/separator"
import {
  ArrowDownIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  ScaleIcon,
  TriangleAlertIcon,
} from "lucide-react"

import {
  commissionCalcTypeHints,
  commissionCalcTypeLabels,
  commissionCalcTypeOptions,
  commissionCourseOptions,
  commissionGradeLevelOptions,
  commissionScopeHints,
  commissionScopeLabels,
  commissionScopeOptions,
  commissionScopePrecedence,
  commissionSubjectOptions,
  estimateCommission,
  findOverlappingRules,
  getCommissionScope,
  type CommissionCalcType,
  type CommissionRuleRecord,
  type CommissionScopeKind,
} from "@/lib/commissions-data"
import { formatLkr as formatAmount } from "@/lib/courses-data"
import { lecturers } from "@/lib/lecturers-data"
import { MOCK_TODAY } from "@/lib/students-data"

type CommissionRuleFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this rule; otherwise it creates one. */
  rule?: CommissionRuleRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  lecturerId: string
  calcType: CommissionCalcType
  rate: string
  scopeKind: CommissionScopeKind
  courseId: string
  subjectId: string
  gradeLevelId: string
  effectiveFrom: string
  effectiveTo: string
}

type FormErrors = {
  lecturerId?: string
  rate?: string
  scope?: string
  effectiveFrom?: string
  effectiveTo?: string
}

const lecturerOptions = lecturers
  .map((lecturer) => ({ value: lecturer.id, label: lecturer.fullName }))
  .sort((left, right) => left.label.localeCompare(right.label))

function emptyForm(): FormState {
  return {
    lecturerId: "",
    calcType: "percent",
    rate: "20",
    scopeKind: "default",
    courseId: "",
    subjectId: "",
    gradeLevelId: "",
    effectiveFrom: MOCK_TODAY,
    effectiveTo: "",
  }
}

function formFromRule(rule: CommissionRuleRecord): FormState {
  const scope = getCommissionScope(rule)

  return {
    lecturerId: rule.lecturerId,
    calcType: rule.calcType,
    rate: String(rule.commissionRate),
    scopeKind: scope.kind,
    courseId: rule.courseId ?? "",
    subjectId: rule.subjectId ?? "",
    gradeLevelId: rule.gradeLevelId ?? "",
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo ?? "",
  }
}

export function CommissionRuleFormDialog({
  open,
  onOpenChange,
  rule,
  onSaved,
}: CommissionRuleFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(rule)

  useEffect(() => {
    setForm(rule ? formFromRule(rule) : emptyForm())
    setErrors({})
    setSubmitted(false)
  }, [open, rule])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const rateNumber = Number(form.rate)
  const rateValid =
    form.rate.trim() !== "" && Number.isFinite(rateNumber) && rateNumber >= 0

  const draftRule: CommissionRuleRecord = {
    id: rule?.id ?? "draft",
    lecturerId: form.lecturerId,
    lecturerName:
      lecturerOptions.find((option) => option.value === form.lecturerId)?.label ??
      "Lecturer",
    courseId: form.scopeKind === "course" ? form.courseId || null : null,
    courseName:
      form.scopeKind === "course"
        ? (commissionCourseOptions.find(
            (option) => option.value === form.courseId
          )?.label ?? null)
        : null,
    subjectId:
      form.scopeKind === "subject" || form.scopeKind === "subject_grade"
        ? form.subjectId || null
        : null,
    subjectName:
      form.scopeKind === "subject" || form.scopeKind === "subject_grade"
        ? (commissionSubjectOptions.find(
            (option) => option.value === form.subjectId
          )?.label ?? null)
        : null,
    gradeLevelId:
      form.scopeKind === "subject_grade" ? form.gradeLevelId || null : null,
    gradeLevelName:
      form.scopeKind === "subject_grade"
        ? (commissionGradeLevelOptions.find(
            (option) => option.value === form.gradeLevelId
          )?.label ?? null)
        : null,
    calcType: form.calcType,
    commissionRate: Number.isFinite(rateNumber) ? rateNumber : 0,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo || null,
    createdAt: rule?.createdAt ?? MOCK_TODAY,
  }

  const overlaps =
    form.lecturerId && form.effectiveFrom
      ? findOverlappingRules(draftRule).filter((item) => item.id !== rule?.id)
      : []

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!form.lecturerId) {
      nextErrors.lecturerId = "Select the lecturer this rule applies to."
    }

    if (form.rate.trim() === "" || !Number.isFinite(rateNumber)) {
      nextErrors.rate = "Enter the commission rate."
    } else if (form.calcType === "percent" && rateNumber > 100) {
      nextErrors.rate = "A percent rate must be between 0 and 100."
    } else if (rateNumber < 0) {
      nextErrors.rate = "The rate cannot be negative."
    }

    if (form.scopeKind === "course" && !form.courseId) {
      nextErrors.scope = "A course scope needs a course selected."
    }

    if (form.scopeKind === "subject" && !form.subjectId) {
      nextErrors.scope = "A subject scope needs a subject selected."
    }

    if (form.scopeKind === "subject_grade" && !form.subjectId) {
      nextErrors.scope = "A subject + grade scope needs a subject."
    }

    if (form.scopeKind === "subject_grade" && !form.gradeLevelId) {
      nextErrors.scope = "A subject + grade scope needs a grade level."
    }

    if (!form.effectiveFrom) {
      nextErrors.effectiveFrom = "An effective-from date is required."
    }

    if (form.effectiveTo && form.effectiveFrom && form.effectiveTo <= form.effectiveFrom) {
      nextErrors.effectiveTo = "The end date must be after the start date."
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

  const scope = getCommissionScope(draftRule)
  const estimate = estimateCommission(draftRule, 25000, 12)
  const lecturerLabel =
    lecturerOptions.find((option) => option.value === form.lecturerId)?.label ??
    "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScaleIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit commission rule" : "Create commission rule"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the rule. Nothing is saved — this is a UI preview."
              : "Define what the institute keeps for a lecturer. Nothing is saved."}
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
                  {isEdit ? "Rule update ready" : "Rule ready to save"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? "The rule would be updated. Existing commission entries keep their own snapshotted rates."
                    : "The rule would be added. New accruals would resolve against it by specificity."}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Lecturer" value={lecturerLabel} />
              <PreviewField label="Scope" value={scope.label} />
              <PreviewField label="Applies to" value={scope.detail} />
              <PreviewField
                label="Calculation"
                value={commissionCalcTypeLabels[form.calcType]}
              />
              <PreviewField
                label="Rate"
                value={
                  form.calcType === "percent"
                    ? `${form.rate || "0"}%`
                    : `${formatAmount(rateValid ? rateNumber : 0)} / student / month`
                }
              />
              <PreviewField
                label="Period"
                value={
                  form.effectiveTo
                    ? `${form.effectiveFrom} → ${form.effectiveTo}`
                    : `${form.effectiveFrom} → current`
                }
              />
            </dl>

            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Illustrative estimate
              </span>
              <p className="text-xs text-muted-foreground">
                Sample of a {formatAmount(estimate.base)} base with{" "}
                {12} students. Not a real accrual.
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    Institute keeps
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatAmount(estimate.commission)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    Teacher receives
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatAmount(estimate.teacher)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Capped</span>
                  <span className="text-sm font-semibold">
                    {estimate.capped ? "Yes, limited to base" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {overlaps.length > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  This overlaps {overlaps.length}{" "}
                  {overlaps.length === 1 ? "rule" : "rules"} for the same
                  lecturer and scope with intersecting dates. The database blocks
                  this overlap with an exclusion constraint.
                </span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo preview only. No rule is created or changed and no
                commission is calculated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="commission-rule-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commission-lecturer">Lecturer</Label>
              <Select
                items={lecturerOptions}
                value={form.lecturerId || null}
                onValueChange={(value) => update("lecturerId", value ?? "")}
              >
                <SelectTrigger
                  id="commission-lecturer"
                  className="w-full"
                  aria-invalid={errors.lecturerId ? true : undefined}
                  aria-describedby={
                    errors.lecturerId ? "commission-lecturer-error" : undefined
                  }
                >
                  <SelectValue placeholder="Select a lecturer" />
                </SelectTrigger>
                <SelectContent>
                  {lecturerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lecturerId ? (
                <p
                  id="commission-lecturer-error"
                  className="text-xs text-destructive"
                >
                  {errors.lecturerId}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="commission-calc-type">Calculation type</Label>
                <Select
                  items={commissionCalcTypeOptions}
                  value={form.calcType}
                  onValueChange={(value) =>
                    update(
                      "calcType",
                      (value as CommissionCalcType) ?? "percent"
                    )
                  }
                >
                  <SelectTrigger id="commission-calc-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commissionCalcTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {commissionCalcTypeHints[form.calcType]}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="commission-rate">
                  {form.calcType === "percent"
                    ? "Commission rate (%)"
                    : "Fixed amount (LKR / student / month)"}
                </Label>
                <Input
                  id="commission-rate"
                  type="number"
                  min={0}
                  max={form.calcType === "percent" ? 100 : undefined}
                  step={form.calcType === "percent" ? 0.5 : 50}
                  value={form.rate}
                  onChange={(event) => update("rate", event.target.value)}
                  placeholder={form.calcType === "percent" ? "e.g. 25" : "e.g. 1500"}
                  aria-invalid={errors.rate ? true : undefined}
                  aria-describedby={
                    errors.rate ? "commission-rate-error" : undefined
                  }
                />
                {errors.rate ? (
                  <p
                    id="commission-rate-error"
                    className="text-xs text-destructive"
                  >
                    {errors.rate}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {form.calcType === "percent"
                      ? "A percentage of the base, between 0 and 100."
                      : "A nonnegative amount per enrolled student per month."}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commission-scope">Scope</Label>
              <Select
                items={commissionScopeOptions}
                value={form.scopeKind}
                onValueChange={(value) =>
                  update(
                    "scopeKind",
                    (value as CommissionScopeKind) ?? "default"
                  )
                }
              >
                <SelectTrigger
                  id="commission-scope"
                  className="w-full"
                  aria-invalid={errors.scope ? true : undefined}
                  aria-describedby={
                    errors.scope ? "commission-scope-error" : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commissionScopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {commissionScopeHints[form.scopeKind]}
              </p>
            </div>

            {form.scopeKind === "course" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="commission-course">Course</Label>
                <Select
                  items={commissionCourseOptions}
                  value={form.courseId || null}
                  onValueChange={(value) => update("courseId", value ?? "")}
                >
                  <SelectTrigger
                    id="commission-course"
                    className="w-full"
                    aria-invalid={errors.scope ? true : undefined}
                  >
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {commissionCourseOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {form.scopeKind === "subject" ||
            form.scopeKind === "subject_grade" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="commission-subject">Subject</Label>
                  <Select
                    items={commissionSubjectOptions}
                    value={form.subjectId || null}
                    onValueChange={(value) => update("subjectId", value ?? "")}
                  >
                    <SelectTrigger
                      id="commission-subject"
                      className="w-full"
                      aria-invalid={errors.scope ? true : undefined}
                    >
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {commissionSubjectOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.scopeKind === "subject_grade" ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="commission-grade">Grade level</Label>
                    <Select
                      items={commissionGradeLevelOptions}
                      value={form.gradeLevelId || null}
                      onValueChange={(value) =>
                        update("gradeLevelId", value ?? "")
                      }
                    >
                      <SelectTrigger
                        id="commission-grade"
                        className="w-full"
                        aria-invalid={errors.scope ? true : undefined}
                      >
                        <SelectValue placeholder="Select a grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {commissionGradeLevelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {errors.scope ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.scope}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="commission-from">
                  <span>
                    Effective from
                    <span className="ml-0.5 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="commission-from"
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(event) =>
                    update("effectiveFrom", event.target.value)
                  }
                  aria-invalid={errors.effectiveFrom ? true : undefined}
                  aria-describedby={
                    errors.effectiveFrom ? "commission-from-error" : undefined
                  }
                />
                {errors.effectiveFrom ? (
                  <p
                    id="commission-from-error"
                    className="text-xs text-destructive"
                  >
                    {errors.effectiveFrom}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="commission-to">
                  Effective to
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="commission-to"
                  type="date"
                  value={form.effectiveTo}
                  onChange={(event) =>
                    update("effectiveTo", event.target.value)
                  }
                  aria-invalid={errors.effectiveTo ? true : undefined}
                  aria-describedby={
                    errors.effectiveTo ? "commission-to-error" : undefined
                  }
                />
                {errors.effectiveTo ? (
                  <p
                    id="commission-to-error"
                    className="text-xs text-destructive"
                  >
                    {errors.effectiveTo}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Exclusive end. Leave empty for the current rule.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Specificity order
              </span>
              <ol className="flex flex-wrap items-center gap-1.5 text-xs">
                {commissionScopePrecedence.map((kind, index) => (
                  <li key={kind} className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={
                        kind === form.scopeKind
                          ? "rounded-full border-primary/30 bg-primary/10 text-primary"
                          : "rounded-full text-muted-foreground"
                      }
                    >
                      {commissionScopeLabels[kind]}
                    </Badge>
                    {index < commissionScopePrecedence.length - 1 ? (
                      <ArrowDownIcon
                        className="size-3 -rotate-90 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                The most specific rule in effect wins. A course rule beats a
                subject + grade rule, which beats a subject rule, which beats the
                lecturer default.
              </p>
            </div>

            {overlaps.length > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Overlap warning: another rule for this lecturer targets the
                  same scope with intersecting dates. Fix the scope or dates
                  before saving in a real deployment.
                </span>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <CircleAlertIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Rates are illustrative sample values. Changing a rule never
                changes past earnings, because each commission entry snapshots
                its own rate.
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
                      ? "Rule update preview closed. Nothing was changed — this is a UI demo."
                      : "Rule preview closed. Nothing was created — this is a UI demo."
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
              <Button type="submit" form="commission-rule-form">
                {isEdit ? "Save changes (demo)" : "Add rule (demo)"}
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
