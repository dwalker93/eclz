"use client"

import { useEffect, useState } from "react"
import type { FormEvent, ReactNode } from "react"

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
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  CheckIcon,
  CircleAlertIcon,
  GraduationCapIcon,
  InfoIcon,
  LayersIcon,
  ReceiptTextIcon,
  UsersRoundIcon,
} from "lucide-react"

import {
  courseBranchFormOptions,
  courseDeliveryFormOptions,
  courseKindLabels,
  courseLearningModeFormOptions,
  courseLecturerFormOptions,
  courseStatusFormOptions,
  courseSubjectFormOptions,
  courseTermFormOptions,
  formatLkr,
  formatTimeValue,
  getWeekdayName,
  learningModeLabels,
  weekdayOptions,
  type CourseKind,
  type DeliveryMode,
  type FeeFrequency,
  type LearningMode,
} from "@/lib/courses-data"
import { gradeLevels } from "@/lib/students-data"

type CourseCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKind: CourseKind
  onCreated: (message: string) => void
}

type FormState = {
  kind: CourseKind
  name: string
  branchId: string
  subjectId: string
  groupName: string
  batchLabel: string
  termId: string
  grades: string[]
  deliveryMode: DeliveryMode
  capacity: string
  status: "draft" | "active"
  learningMode: LearningMode
  lecturerId: string
  sharePercent: string
  feeName: string
  frequency: FeeFrequency
  amount: string
  accessDurationMonths: string
  weekday: string
  startsAt: string
  endsAt: string
  room: string
  intakeName: string
  intakeStartsOn: string
  intakeEndsOn: string
  intakeCapacity: string
}

function createEmptyForm(kind: CourseKind): FormState {
  return {
    kind,
    name: "",
    branchId: "br-colombo",
    subjectId: "sub-maths",
    groupName: "",
    batchLabel: kind === "class" ? "2027 batch" : "",
    termId: "term-2026",
    grades: kind === "class" ? ["gl-6"] : [],
    deliveryMode: kind === "class" ? "physical" : "online",
    capacity: "",
    status: "draft",
    learningMode: "scheduled",
    lecturerId: "lec-1",
    sharePercent: "100",
    feeName: "",
    frequency: "monthly",
    amount: "",
    accessDurationMonths: "6",
    weekday: "6",
    startsAt: "08:00",
    endsAt: "10:00",
    room: "",
    intakeName: "",
    intakeStartsOn: "",
    intakeEndsOn: "",
    intakeCapacity: "",
  }
}

function labelFor(
  options: { value: string; label: string }[],
  value: string,
  fallback: string
) {
  return options.find((option) => option.value === value)?.label ?? fallback
}

function toMinutes(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":")
  return Number(hoursPart) * 60 + Number(minutesPart)
}

export function CourseCreateDialog({
  open,
  onOpenChange,
  initialKind,
  onCreated,
}: CourseCreateDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    createEmptyForm(initialKind)
  )
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    setForm(createEmptyForm(initialKind))
    setErrors([])
    setPreview(false)
  }, [open, initialKind])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function switchKind(kind: CourseKind) {
    setForm((previous) => ({
      ...createEmptyForm(kind),
      branchId: previous.branchId,
      subjectId: previous.subjectId,
      deliveryMode: previous.deliveryMode,
      lecturerId: previous.lecturerId,
      amount: previous.amount,
      status: previous.status,
    }))
    setErrors([])
    setPreview(false)
  }

  function toggleGrade(gradeId: string) {
    setForm((previous) => ({
      ...previous,
      grades: previous.grades.includes(gradeId)
        ? previous.grades.filter((item) => item !== gradeId)
        : [...previous.grades, gradeId],
    }))
  }

  const branchLabel = labelFor(
    courseBranchFormOptions,
    form.branchId,
    "Branch"
  )
  const subjectLabel = labelFor(
    courseSubjectFormOptions,
    form.subjectId,
    "Subject"
  )
  const termLabel = labelFor(courseTermFormOptions, form.termId, "Term")
  const lecturerLabel = labelFor(
    courseLecturerFormOptions,
    form.lecturerId,
    "Lecturer"
  )
  const weekdayLabel = getWeekdayName(Number(form.weekday))
  const selectedGrades = gradeLevels.filter((grade) =>
    form.grades.includes(grade.id)
  )
  const isClass = form.kind === "class"
  const isSelfPaced = form.kind === "program" && form.learningMode === "self_paced"
  const scheduleRequired = !isSelfPaced
  const amount = Number(form.amount)
  const capacity = form.capacity.trim() === "" ? null : Number(form.capacity)
  const groupName =
    form.groupName.trim() || `${branchLabel} ${subjectLabel} — ${termLabel}`
  const feeName =
    form.feeName.trim() !== ""
      ? form.feeName
      : isClass
        ? `${subjectLabel} monthly fee`
        : `${subjectLabel} programme package`
  const accessDurationMonths =
    form.accessDurationMonths.trim() === ""
      ? null
      : Number(form.accessDurationMonths)

  function validate() {
    const nextErrors: string[] = []

    if (!isClass && !form.name.trim()) {
      nextErrors.push("Program name is required.")
    }

    if (isClass && form.grades.length === 0) {
      nextErrors.push("Select at least one grade for the class group.")
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.push("Fee amount must be greater than zero.")
    }

    if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) {
      nextErrors.push("Capacity must be a positive number when set.")
    }

    if (scheduleRequired) {
      if (!form.startsAt || !form.endsAt) {
        nextErrors.push("Weekly schedule start and end times are required.")
      } else if (toMinutes(form.endsAt) <= toMinutes(form.startsAt)) {
        nextErrors.push("Schedule end time must be after the start time.")
      }
    }

    if (form.kind === "program" && form.learningMode === "scheduled") {
      if (!form.intakeName.trim()) {
        nextErrors.push("Scheduled programs need an intake name.")
      }
      if (!form.intakeStartsOn) {
        nextErrors.push("Intake start date is required.")
      }
      if (
        form.intakeStartsOn &&
        form.intakeEndsOn &&
        form.intakeEndsOn < form.intakeStartsOn
      ) {
        nextErrors.push("Intake end date must be on or after the start date.")
      }
    }

    if (form.kind === "program" && form.learningMode === "scheduled") {
      const intakeCapacity =
        form.intakeCapacity.trim() === "" ? null : Number(form.intakeCapacity)

      if (
        intakeCapacity !== null &&
        (!Number.isFinite(intakeCapacity) || intakeCapacity <= 0)
      ) {
        nextErrors.push("Intake capacity must be a positive number when set.")
      }
    }

    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors([])
    setPreview(true)
  }

  function generatedClassName(gradeName: string) {
    return `${gradeName} ${subjectLabel} — ${weekdayLabel}`
  }

  const feeSummary = isClass
    ? `${formatLkr(amount || 0)} / ${
        form.frequency === "per_term" ? "term" : "month"
      }`
    : `${formatLkr(amount || 0)} one-time package${
        accessDurationMonths
          ? ` · ${accessDurationMonths} months access`
          : " · lifetime access"
      }`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenIcon className="size-4" aria-hidden="true" />
            {preview
              ? "Setup preview"
              : isClass
                ? "Create class"
                : "Create program"}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? "Review what would be created. Nothing is saved by this UI demo."
              : "Guided setup for a course group or program. This is a UI preview — no records are written."}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CheckIcon
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {isClass
                    ? `${selectedGrades.length} ${
                        selectedGrades.length === 1 ? "class" : "classes"
                      } would be created`
                    : "Program setup preview ready"}
                </span>
                <p className="text-sm">
                  {isClass
                    ? "One class record per selected grade, all linked to the same course group. Each keeps its own fee, schedule, capacity and teacher assignment."
                    : "In the full workflow this program would be created with its default fee option and intake rules."}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Kind" value={courseKindLabels[form.kind]} />
              <PreviewField label="Branch" value={branchLabel} />
              <PreviewField label="Subject" value={subjectLabel} />
              {isClass ? (
                <>
                  <PreviewField label="Course group" value={groupName} />
                  <PreviewField
                    label="Batch label"
                    value={form.batchLabel.trim() || "—"}
                  />
                  <PreviewField label="Term" value={termLabel} />
                </>
              ) : (
                <>
                  <PreviewField
                    label="Program name"
                    value={form.name.trim() || "—"}
                  />
                  <PreviewField
                    label="Learning mode"
                    value={learningModeLabels[form.learningMode]}
                  />
                  <PreviewField
                    label="Delivery"
                    value={labelFor(
                      courseDeliveryFormOptions,
                      form.deliveryMode,
                      form.deliveryMode
                    )}
                  />
                </>
              )}
              <PreviewField
                label={isClass ? "Grades" : "Intake"}
                value={
                  isClass
                    ? selectedGrades.map((grade) => grade.name).join(", ")
                    : form.learningMode === "self_paced"
                      ? "Not required (self-paced)"
                      : form.intakeName.trim() || "—"
                }
              />
              <PreviewField
                label="Default fee"
                value={feeSummary}
              />
              <PreviewField
                label="Teacher"
                value={`${lecturerLabel} · ${form.sharePercent || "0"}% share`}
              />
              <PreviewField
                label={isClass ? "Schedule" : "Weekly schedule"}
                value={
                  isSelfPaced
                    ? "None (self-paced)"
                    : `${weekdayLabel} ${formatTimeValue(form.startsAt)} – ${formatTimeValue(form.endsAt)}`
                }
              />
              <PreviewField
                label="Capacity"
                value={capacity === null ? "No limit" : `${capacity} seats`}
              />
            </dl>

            {isClass ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Class records to create
                </span>
                <div className="flex flex-col divide-y rounded-lg border">
                  {selectedGrades.map((grade) => (
                    <div
                      key={grade.id}
                      className="flex flex-col gap-1.5 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {generatedClassName(grade.name)}
                        </span>
                        <Badge variant="outline" className="rounded-full">
                          {feeSummary}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {labelFor(
                            courseDeliveryFormOptions,
                            form.deliveryMode,
                            form.deliveryMode
                          )}{" "}
                          · Scheduled
                        </span>
                        <span>
                          {weekdayLabel} {formatTimeValue(form.startsAt)} –{" "}
                          {formatTimeValue(form.endsAt)}
                        </span>
                        <span>
                          {capacity === null
                            ? "No capacity limit"
                            : `${capacity} seats`}
                        </span>
                        <span>
                          {lecturerLabel} · {form.sharePercent || "0"}% share
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {groupName} · {termLabel}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Each selected grade becomes a separate class record. These
                  shared defaults are copied to every record and can be adjusted
                  per class afterward.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
              <span className="text-sm font-semibold">Rule hints</span>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <CheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  Classes are always scheduled and keep an attendance register.
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  Self-paced programs have no attendance and no weekly
                  schedule.
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  Scheduled programs need an intake before a student can
                  enroll.
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  Enrolling attaches the default fee option automatically.
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This is a demo preview only. No course, class, intake, schedule
                or fee record is created.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="course-create-form"
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["class", "program"] as CourseKind[]).map((kind) => {
                const isActive = form.kind === kind

                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => switchKind(kind)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActive
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                      {kind === "class" ? (
                        <GraduationCapIcon aria-hidden="true" />
                      ) : (
                        <LayersIcon aria-hidden="true" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {courseKindLabels[kind]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {kind === "class"
                          ? "One class record per selected grade, grouped by course group."
                          : "A single program record; scheduled or self-paced."}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {errors.length > 0 ? (
              <div
                role="alert"
                className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {errors.map((error) => (
                  <span key={error}>{error}</span>
                ))}
              </div>
            ) : null}

            <section className="flex flex-col gap-3">
              <FormSectionHeading icon={<BookOpenIcon />} title="1. Basics" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Branch" htmlFor="course-branch">
                  <Select
                    items={courseBranchFormOptions}
                    value={form.branchId}
                    onValueChange={(value) =>
                      update("branchId", value ?? "br-colombo")
                    }
                  >
                    <SelectTrigger id="course-branch" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courseBranchFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Subject" htmlFor="course-subject">
                  <Select
                    items={courseSubjectFormOptions}
                    value={form.subjectId}
                    onValueChange={(value) =>
                      update("subjectId", value ?? "sub-maths")
                    }
                  >
                    <SelectTrigger id="course-subject" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courseSubjectFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {isClass ? (
                  <>
                    <Field
                      label="Course group name"
                      htmlFor="course-group-name"
                      hint="Classes created together share one course group."
                    >
                      <Input
                        id="course-group-name"
                        value={form.groupName}
                        onChange={(event) =>
                          update("groupName", event.target.value)
                        }
                        placeholder={groupName}
                      />
                    </Field>

                    <Field label="Batch label" htmlFor="course-batch">
                      <Input
                        id="course-batch"
                        value={form.batchLabel}
                        onChange={(event) =>
                          update("batchLabel", event.target.value)
                        }
                        placeholder="e.g. 2027 batch"
                      />
                    </Field>

                    <Field
                      label="Academic term"
                      htmlFor="course-term"
                      hint="Terms apply to classes, not programs."
                    >
                      <Select
                        items={courseTermFormOptions}
                        value={form.termId}
                        onValueChange={(value) =>
                          update("termId", value ?? "term-2026")
                        }
                      >
                        <SelectTrigger id="course-term" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {courseTermFormOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field
                      label="Program name"
                      htmlFor="course-name"
                      required
                    >
                      <Input
                        id="course-name"
                        value={form.name}
                        onChange={(event) =>
                          update("name", event.target.value)
                        }
                        placeholder="e.g. Digital Marketing Foundations"
                      />
                    </Field>

                    <Field
                      label="Learning mode"
                      htmlFor="course-learning-mode"
                      hint="Scheduled programs need an intake."
                    >
                      <Select
                        items={courseLearningModeFormOptions}
                        value={form.learningMode}
                        onValueChange={(value) =>
                          update(
                            "learningMode",
                            (value ?? "scheduled") as LearningMode
                          )
                        }
                      >
                        <SelectTrigger
                          id="course-learning-mode"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {courseLearningModeFormOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}

                <Field label="Delivery mode" htmlFor="course-delivery">
                  <Select
                    items={courseDeliveryFormOptions}
                    value={form.deliveryMode}
                    onValueChange={(value) =>
                      update(
                        "deliveryMode",
                        (value ?? "physical") as DeliveryMode
                      )
                    }
                  >
                    <SelectTrigger id="course-delivery" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courseDeliveryFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Capacity"
                  htmlFor="course-capacity"
                  hint="Leave blank for no capacity limit."
                >
                  <Input
                    id="course-capacity"
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(event) =>
                      update("capacity", event.target.value)
                    }
                    placeholder="e.g. 30"
                  />
                </Field>

                <Field label="Status" htmlFor="course-status">
                  <Select
                    items={courseStatusFormOptions}
                    value={form.status}
                    onValueChange={(value) =>
                      update(
                        "status",
                        (value ?? "draft") as FormState["status"]
                      )
                    }
                  >
                    <SelectTrigger id="course-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courseStatusFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            {isClass ? (
              <section className="flex flex-col gap-3">
                <FormSectionHeading
                  icon={<LayersIcon />}
                  title="2. Grades in this course group"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {selectedGrades.length} selected
                    </span>
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {gradeLevels.map((grade) => {
                    const isSelected = form.grades.includes(grade.id)

                    return (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => toggleGrade(grade.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          isSelected
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {isSelected ? (
                          <CheckIcon className="size-3" aria-hidden="true" />
                        ) : null}
                        {grade.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Several grades can live under one course group. Each selected
                  grade becomes a separate class record with its own fee,
                  schedule, capacity, delivery mode and teacher assignment.
                </p>
              </section>
            ) : null}

            {scheduleRequired ? (
              <section className="flex flex-col gap-3">
                <FormSectionHeading
                  icon={<CalendarClockIcon />}
                  title={isClass ? "3. Weekly schedule" : "2. Weekly schedule"}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field label="Day" htmlFor="course-weekday">
                    <Select
                      items={weekdayOptions}
                      value={form.weekday}
                      onValueChange={(value) =>
                        update("weekday", value ?? "6")
                      }
                    >
                      <SelectTrigger id="course-weekday" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdayOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Starts" htmlFor="course-starts-at">
                    <Input
                      id="course-starts-at"
                      type="time"
                      value={form.startsAt}
                      onChange={(event) =>
                        update("startsAt", event.target.value)
                      }
                    />
                  </Field>

                  <Field label="Ends" htmlFor="course-ends-at">
                    <Input
                      id="course-ends-at"
                      type="time"
                      value={form.endsAt}
                      onChange={(event) => update("endsAt", event.target.value)}
                    />
                  </Field>

                  <Field label="Room" htmlFor="course-room">
                    <Input
                      id="course-room"
                      value={form.room}
                      onChange={(event) => update("room", event.target.value)}
                      placeholder="Optional"
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            <section className="flex flex-col gap-3">
              <FormSectionHeading
                icon={<ReceiptTextIcon />}
                title={isClass ? "4. Default fee" : "3. Default fee"}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Fee name"
                  htmlFor="course-fee-name"
                  hint="Shown on the class and attached on enrollment."
                >
                  <Input
                    id="course-fee-name"
                    value={form.feeName}
                    onChange={(event) =>
                      update("feeName", event.target.value)
                    }
                    placeholder={feeName}
                  />
                </Field>

                <Field label="Amount (LKR)" htmlFor="course-amount" required>
                  <Input
                    id="course-amount"
                    type="number"
                    min={1}
                    value={form.amount}
                    onChange={(event) => update("amount", event.target.value)}
                    placeholder="e.g. 4500"
                  />
                </Field>

                {isClass ? (
                  <Field
                    label="Billing frequency"
                    htmlFor="course-frequency"
                    hint="Classes use a recurring fee."
                  >
                    <Select
                      items={[
                        { value: "monthly", label: "Monthly" },
                        { value: "per_term", label: "Per term" },
                      ]}
                      value={form.frequency}
                      onValueChange={(value) =>
                        update(
                          "frequency",
                          (value ?? "monthly") as FeeFrequency
                        )
                      }
                    >
                      <SelectTrigger id="course-frequency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="per_term">Per term</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label>Billing type</Label>
                      <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                        One-time package
                      </div>
                    </div>
                    <Field
                      label="Access duration (months)"
                      htmlFor="course-access-months"
                      hint="Leave blank for lifetime access."
                    >
                      <Input
                        id="course-access-months"
                        type="number"
                        min={1}
                        value={form.accessDurationMonths}
                        onChange={(event) =>
                          update("accessDurationMonths", event.target.value)
                        }
                        placeholder="e.g. 6"
                      />
                    </Field>
                  </>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <FormSectionHeading
                icon={<UsersRoundIcon />}
                title={isClass ? "5. Teacher and share" : "4. Teacher and share"}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Primary teacher" htmlFor="course-lecturer">
                  <Select
                    items={courseLecturerFormOptions}
                    value={form.lecturerId}
                    onValueChange={(value) =>
                      update("lecturerId", value ?? "lec-1")
                    }
                  >
                    <SelectTrigger id="course-lecturer" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courseLecturerFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Revenue share (%)"
                  htmlFor="course-share"
                  hint="Shares for co-taught courses should total 100%."
                >
                  <Input
                    id="course-share"
                    type="number"
                    min={0}
                    max={100}
                    value={form.sharePercent}
                    onChange={(event) =>
                      update("sharePercent", event.target.value)
                    }
                  />
                </Field>
              </div>
            </section>

            {form.kind === "program" && form.learningMode === "scheduled" ? (
              <section className="flex flex-col gap-3">
                <FormSectionHeading
                  icon={<CalendarRangeIcon />}
                  title="5. Intake"
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Intake name"
                    htmlFor="course-intake-name"
                    required
                  >
                    <Input
                      id="course-intake-name"
                      value={form.intakeName}
                      onChange={(event) =>
                        update("intakeName", event.target.value)
                      }
                      placeholder="e.g. February 2027 intake"
                    />
                  </Field>

                  <Field label="Intake capacity" htmlFor="course-intake-capacity">
                    <Input
                      id="course-intake-capacity"
                      type="number"
                      min={1}
                      value={form.intakeCapacity}
                      onChange={(event) =>
                        update("intakeCapacity", event.target.value)
                      }
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Starts on" htmlFor="course-intake-start" required>
                    <Input
                      id="course-intake-start"
                      type="date"
                      value={form.intakeStartsOn}
                      onChange={(event) =>
                        update("intakeStartsOn", event.target.value)
                      }
                    />
                  </Field>

                  <Field
                    label="Ends on"
                    htmlFor="course-intake-end"
                    hint="Display-inclusive last day."
                  >
                    <Input
                      id="course-intake-end"
                      type="date"
                      value={form.intakeEndsOn}
                      onChange={(event) =>
                        update("intakeEndsOn", event.target.value)
                      }
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isSelfPaced
                  ? "Self-paced programs have no attendance, no weekly schedule and no intake."
                  : form.kind === "program"
                    ? "Scheduled programs keep attendance and require an intake before enrollment."
                    : "Classes are scheduled and attendance is always enabled."}
              </span>
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
                  const count = isClass ? selectedGrades.length : 1

                  onOpenChange(false)
                  onCreated(
                    isClass
                      ? `Preview closed. ${count} ${
                          count === 1 ? "class" : "classes"
                        } were not created — this is a UI demo.`
                      : "Program setup preview closed. No program, intake or fee record was saved."
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
              <Button type="submit" form="course-create-form">
                Preview setup (demo)
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
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function FormSectionHeading({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
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
