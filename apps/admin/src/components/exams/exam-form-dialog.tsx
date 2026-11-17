"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

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
import { Switch } from "@workspace/ui/components/switch"
import {
  CheckIcon,
  CircleAlertIcon,
  ClipboardListIcon,
  InfoIcon,
  ListChecksIcon,
  SnowflakeIcon,
} from "lucide-react"

import { courses } from "@/lib/courses-data"
import {
  attemptScoringLabels,
  attemptScoringOptions,
  examModeLabels,
  examModeOptions,
  resultsVisibilityLabels,
  resultsVisibilityOptions,
  type AttemptScoring,
  type ExamMode,
  type ExamRecord,
  type ResultsVisibility,
} from "@/lib/exams-data"
import { lecturers } from "@/lib/lecturers-data"
import { questions } from "@/lib/questions-data"
import { MOCK_TODAY, formatDisplayDate } from "@/lib/students-data"

type ExamFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this draft exam; otherwise it creates one. */
  exam?: ExamRecord | null
  onSaved: (message: string) => void
}

type QuestionSelection = {
  questionId: string
  marks: string
}

type FormState = {
  title: string
  mode: ExamMode
  lecturerId: string
  courseIds: string[]
  weight: string
  opensAt: string
  closesAt: string
  timeLimitMinutes: string
  maxAttempts: string
  attemptScoring: AttemptScoring
  shuffleQuestions: boolean
  resultsVisibility: ResultsVisibility
  examDate: string
  maxMarks: string
  questions: QuestionSelection[]
}

type FormErrors = {
  title?: string
  lecturerId?: string
  courseIds?: string
  weight?: string
  opensAt?: string
  closesAt?: string
  timeLimitMinutes?: string
  maxAttempts?: string
  examDate?: string
  maxMarks?: string
}

const courseOptions = courses
  .map((course) => ({
    value: course.id,
    label: course.name,
    branchName: course.branchName,
  }))
  .sort((left, right) => left.label.localeCompare(right.label))

const lecturerOptions = lecturers.map((lecturer) => ({
  value: lecturer.id,
  label: lecturer.fullName,
}))

function createEmptyForm(exam?: ExamRecord | null): FormState {
  if (exam) {
    return {
      title: exam.title,
      mode: exam.mode,
      lecturerId: exam.lecturerId,
      courseIds: exam.courses.map((course) => course.courseId),
      weight: exam.weight === null ? "" : String(exam.weight),
      opensAt: exam.opensAt ? exam.opensAt.slice(0, 16) : "",
      closesAt: exam.closesAt ? exam.closesAt.slice(0, 16) : "",
      timeLimitMinutes:
        exam.timeLimitMinutes === null ? "" : String(exam.timeLimitMinutes),
      maxAttempts: exam.maxAttempts === null ? "" : String(exam.maxAttempts),
      attemptScoring: exam.attemptScoring,
      shuffleQuestions: exam.shuffleQuestions,
      resultsVisibility: exam.resultsVisibility,
      examDate: exam.examDate ?? "",
      maxMarks: exam.maxMarks === null ? "" : String(exam.maxMarks),
      questions: exam.questions.map((question) => ({
        questionId: question.questionId,
        marks: String(question.marks),
      })),
    }
  }

  return {
    title: "",
    mode: "online_mcq",
    lecturerId: "",
    courseIds: [],
    weight: "",
    opensAt: "",
    closesAt: "",
    timeLimitMinutes: "45",
    maxAttempts: "1",
    attemptScoring: "best",
    shuffleQuestions: false,
    resultsVisibility: "after_release",
    examDate: MOCK_TODAY,
    maxMarks: "",
    questions: [],
  }
}

export function ExamFormDialog({
  open,
  onOpenChange,
  exam,
  onSaved,
}: ExamFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => createEmptyForm(exam))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(exam)

  useEffect(() => {
    setForm(createEmptyForm(exam))
    setErrors({})
    setSubmitted(false)
  }, [open, exam])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function toggleCourse(courseId: string, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      courseIds: checked
        ? [...previous.courseIds, courseId]
        : previous.courseIds.filter((id) => id !== courseId),
    }))
  }

  function toggleQuestion(questionId: string, checked: boolean) {
    setForm((previous) => {
      if (checked) {
        const question = questions.find((item) => item.id === questionId)

        return {
          ...previous,
          questions: [
            ...previous.questions,
            {
              questionId,
              marks: String(question?.defaultMarks ?? 1),
            },
          ],
        }
      }

      return {
        ...previous,
        questions: previous.questions.filter(
          (item) => item.questionId !== questionId
        ),
      }
    })
  }

  function updateQuestionMarks(questionId: string, marks: string) {
    setForm((previous) => ({
      ...previous,
      questions: previous.questions.map((item) =>
        item.questionId === questionId ? { ...item, marks } : item
      ),
    }))
  }

  const totalMarks =
    form.mode === "paper"
      ? Number(form.maxMarks) || 0
      : form.questions.reduce((total, item) => total + (Number(item.marks) || 0), 0)

  const selectedCourses = form.courseIds.length
  const selectedQuestions = form.questions.length

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!form.title.trim()) {
      nextErrors.title = "A title is required."
    }

    if (!form.lecturerId) {
      nextErrors.lecturerId = "Select the lecturer who owns this exam."
    }

    if (form.courseIds.length === 0) {
      nextErrors.courseIds = "Attach at least one course."
    }

    if (form.weight.trim() !== "") {
      const weight = Number(form.weight)
      if (!Number.isFinite(weight) || weight <= 0) {
        nextErrors.weight = "Weight must be a positive number when set."
      }
    }

    if (form.mode === "online_mcq") {
      if (!form.opensAt) {
        nextErrors.opensAt = "A window open time is required for online exams."
      }

      if (!form.closesAt) {
        nextErrors.closesAt = "A window close time is required for online exams."
      }

      if (form.opensAt && form.closesAt && form.closesAt <= form.opensAt) {
        nextErrors.closesAt = "The close time must be after the open time."
      }

      if (form.timeLimitMinutes.trim() !== "") {
        const limit = Number(form.timeLimitMinutes)
        if (!Number.isFinite(limit) || limit <= 0) {
          nextErrors.timeLimitMinutes =
            "The time limit must be a positive number of minutes."
        }
      }

      const attempts = Number(form.maxAttempts)
      if (
        form.maxAttempts.trim() === "" ||
        !Number.isInteger(attempts) ||
        attempts < 1
      ) {
        nextErrors.maxAttempts =
          "Online exams need an attempt limit of at least one."
      }
    } else {
      if (!form.examDate) {
        nextErrors.examDate = "A paper exam needs a date."
      }

      const marks = Number(form.maxMarks)
      if (form.maxMarks.trim() === "" || !Number.isFinite(marks) || marks <= 0) {
        nextErrors.maxMarks = "Enter the paper total (a positive mark)."
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

  const lecturerLabel =
    lecturerOptions.find((option) => option.value === form.lecturerId)?.label ??
    "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardListIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit draft exam" : "Create exam"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the draft. Nothing is saved — this is a UI preview."
              : "Set up an exam and attach it to courses. Nothing is saved."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {isEdit ? "Exam update ready" : "Exam ready to save"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? `“${form.title.trim()}” would be updated as a draft.`
                    : `“${form.title.trim()}” would be created as a draft.`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Title" value={form.title.trim() || "—"} />
              <PreviewField
                label="Mode"
                value={examModeLabels[form.mode]}
              />
              <PreviewField label="Owner lecturer" value={lecturerLabel} />
              <PreviewField
                label="Attached courses"
                value={
                  selectedCourses === 0
                    ? "—"
                    : `${selectedCourses} ${
                        selectedCourses === 1 ? "course" : "courses"
                      }`
                }
              />
              {form.mode === "online_mcq" ? (
                <>
                  <PreviewField
                    label="Window"
                    value={
                      form.opensAt && form.closesAt
                        ? `${form.opensAt.replace("T", " ")} → ${form.closesAt.replace("T", " ")}`
                        : "Not set"
                    }
                  />
                  <PreviewField
                    label="Limits"
                    value={`${
                      form.timeLimitMinutes || "No"
                    } min · ${form.maxAttempts || "—"} attempts`}
                  />
                  <PreviewField
                    label="Attempt scoring"
                    value={attemptScoringLabels[form.attemptScoring]}
                  />
                  <PreviewField
                    label="Questions"
                    value={`${selectedQuestions} · ${totalMarks} marks`}
                  />
                </>
              ) : (
                <>
                  <PreviewField
                    label="Exam date"
                    value={
                      form.examDate
                        ? formatDisplayDate(form.examDate)
                        : "Not set"
                    }
                  />
                  <PreviewField label="Paper total" value={`${totalMarks} marks`} />
                </>
              )}
              <PreviewField
                label="Results visibility"
                value={resultsVisibilityLabels[form.resultsVisibility]}
              />
              <PreviewField
                label="Weight"
                value={form.weight ? `${form.weight}%` : "Not weighted"}
              />
            </dl>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo preview only. No exam is created or changed, and publishing
                is a separate confirmed step.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="exam-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-title">
                <span>
                  Title
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Input
                id="exam-title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="e.g. Grade 8 Mathematics — Term 3 MCQ"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "exam-title-error" : undefined}
              />
              {errors.title ? (
                <p id="exam-title-error" className="text-xs text-destructive">
                  {errors.title}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exam-mode">Mode</Label>
                <Select
                  items={examModeOptions}
                  value={form.mode}
                  onValueChange={(value) =>
                    update("mode", (value as ExamMode) ?? "online_mcq")
                  }
                >
                  <SelectTrigger id="exam-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {examModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.mode === "online_mcq"
                    ? "Online exams need a window and an attempt limit."
                    : "Paper exams need a date and a total mark."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exam-lecturer">Owner lecturer</Label>
                <Select
                  items={lecturerOptions}
                  value={form.lecturerId || null}
                  onValueChange={(value) => update("lecturerId", value ?? "")}
                >
                  <SelectTrigger
                    id="exam-lecturer"
                    className="w-full"
                    aria-invalid={errors.lecturerId ? true : undefined}
                    aria-describedby={
                      errors.lecturerId ? "exam-lecturer-error" : undefined
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
                  <p id="exam-lecturer-error" className="text-xs text-destructive">
                    {errors.lecturerId}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                <span>
                  Attached courses
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <div
                className="flex max-h-52 flex-col gap-1.5 overflow-y-auto rounded-lg border p-2"
                role="group"
                aria-label="Attached courses"
              >
                {courseOptions.map((course) => {
                  const checked = form.courseIds.includes(course.value)

                  return (
                    <Label
                      key={course.value}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-normal hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleCourse(course.value, value)
                        }
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{course.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {course.branchName}
                        </span>
                      </span>
                    </Label>
                  )
                })}
              </div>
              {errors.courseIds ? (
                <p id="exam-courses-error" className="text-xs text-destructive">
                  {errors.courseIds}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selectedCourses} attached. An exam can cover one or many
                  courses.
                </p>
              )}
            </div>

            {form.mode === "online_mcq" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exam-opens">Opens at</Label>
                  <Input
                    id="exam-opens"
                    type="datetime-local"
                    value={form.opensAt}
                    onChange={(event) => update("opensAt", event.target.value)}
                    aria-invalid={errors.opensAt ? true : undefined}
                    aria-describedby={
                      errors.opensAt ? "exam-opens-error" : undefined
                    }
                  />
                  {errors.opensAt ? (
                    <p id="exam-opens-error" className="text-xs text-destructive">
                      {errors.opensAt}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exam-closes">Closes at</Label>
                  <Input
                    id="exam-closes"
                    type="datetime-local"
                    value={form.closesAt}
                    onChange={(event) => update("closesAt", event.target.value)}
                    aria-invalid={errors.closesAt ? true : undefined}
                    aria-describedby={
                      errors.closesAt ? "exam-closes-error" : undefined
                    }
                  />
                  {errors.closesAt ? (
                    <p
                      id="exam-closes-error"
                      className="text-xs text-destructive"
                    >
                      {errors.closesAt}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exam-time-limit">
                    Time limit (minutes)
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="exam-time-limit"
                    type="number"
                    min={1}
                    value={form.timeLimitMinutes}
                    onChange={(event) =>
                      update("timeLimitMinutes", event.target.value)
                    }
                    placeholder="e.g. 45"
                    aria-invalid={errors.timeLimitMinutes ? true : undefined}
                    aria-describedby={
                      errors.timeLimitMinutes
                        ? "exam-time-limit-error"
                        : undefined
                    }
                  />
                  {errors.timeLimitMinutes ? (
                    <p
                      id="exam-time-limit-error"
                      className="text-xs text-destructive"
                    >
                      {errors.timeLimitMinutes}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Leave empty for no limit inside the window.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exam-max-attempts">Attempt limit</Label>
                  <Input
                    id="exam-max-attempts"
                    type="number"
                    min={1}
                    value={form.maxAttempts}
                    onChange={(event) =>
                      update("maxAttempts", event.target.value)
                    }
                    placeholder="e.g. 2"
                    aria-invalid={errors.maxAttempts ? true : undefined}
                    aria-describedby={
                      errors.maxAttempts ? "exam-max-attempts-error" : undefined
                    }
                  />
                  {errors.maxAttempts ? (
                    <p
                      id="exam-max-attempts-error"
                      className="text-xs text-destructive"
                    >
                      {errors.maxAttempts}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exam-date">Exam date</Label>
                  <Input
                    id="exam-date"
                    type="date"
                    value={form.examDate}
                    onChange={(event) => update("examDate", event.target.value)}
                    aria-invalid={errors.examDate ? true : undefined}
                    aria-describedby={
                      errors.examDate ? "exam-date-error" : undefined
                    }
                  />
                  {errors.examDate ? (
                    <p id="exam-date-error" className="text-xs text-destructive">
                      {errors.examDate}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exam-max-marks">Paper total (marks)</Label>
                  <Input
                    id="exam-max-marks"
                    type="number"
                    min={1}
                    value={form.maxMarks}
                    onChange={(event) => update("maxMarks", event.target.value)}
                    placeholder="e.g. 100"
                    aria-invalid={errors.maxMarks ? true : undefined}
                    aria-describedby={
                      errors.maxMarks ? "exam-max-marks-error" : undefined
                    }
                  />
                  {errors.maxMarks ? (
                    <p
                      id="exam-max-marks-error"
                      className="text-xs text-destructive"
                    >
                      {errors.maxMarks}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exam-visibility">Results visibility</Label>
                <Select
                  items={resultsVisibilityOptions}
                  value={form.resultsVisibility}
                  onValueChange={(value) =>
                    update(
                      "resultsVisibility",
                      (value as ResultsVisibility) ?? "after_release"
                    )
                  }
                >
                  <SelectTrigger id="exam-visibility" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resultsVisibilityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exam-weight">
                  Weight in overall mark (%)
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="exam-weight"
                  type="number"
                  min={1}
                  value={form.weight}
                  onChange={(event) => update("weight", event.target.value)}
                  placeholder="e.g. 40"
                  aria-invalid={errors.weight ? true : undefined}
                  aria-describedby={
                    errors.weight ? "exam-weight-error" : undefined
                  }
                />
                {errors.weight ? (
                  <p id="exam-weight-error" className="text-xs text-destructive">
                    {errors.weight}
                  </p>
                ) : null}
              </div>
            </div>

            {form.mode === "online_mcq" ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="exam-scoring">Attempt scoring</Label>
                    <Select
                      items={attemptScoringOptions}
                      value={form.attemptScoring}
                      onValueChange={(value) =>
                        update(
                          "attemptScoring",
                          (value as AttemptScoring) ?? "best"
                        )
                      }
                    >
                      <SelectTrigger id="exam-scoring" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {attemptScoringOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Label
                    htmlFor="exam-shuffle"
                    className="flex items-start justify-between gap-4 rounded-lg border p-3 font-normal"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        Shuffle questions
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Each candidate sees the questions in a different order.
                      </span>
                    </span>
                    <Switch
                      id="exam-shuffle"
                      checked={form.shuffleQuestions}
                      onCheckedChange={(checked) =>
                        update("shuffleQuestions", checked)
                      }
                    />
                  </Label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ListChecksIcon className="size-4" aria-hidden="true" />
                      Question selection
                    </span>
                    <Badge variant="outline" className="rounded-full">
                      {selectedQuestions} selected · {totalMarks} marks
                    </Badge>
                  </Label>
                  <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-lg border p-2">
                    {questions.map((question) => {
                      const selected = form.questions.find(
                        (item) => item.questionId === question.id
                      )

                      return (
                        <div
                          key={question.id}
                          className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                        >
                          <Label className="flex flex-1 items-start gap-2 font-normal">
                            <Checkbox
                              className="mt-0.5"
                              checked={Boolean(selected)}
                              onCheckedChange={(value) =>
                                toggleQuestion(question.id, value)
                              }
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-sm">{question.body}</span>
                              <span className="text-xs text-muted-foreground">
                                {question.subjectName} · {question.lecturerName}
                                {question.imageFileName ? " · image" : ""}
                              </span>
                            </span>
                          </Label>
                          {selected ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                value={selected.marks}
                                onChange={(event) =>
                                  updateQuestionMarks(
                                    question.id,
                                    event.target.value
                                  )
                                }
                                aria-label={`Marks for question: ${question.body}`}
                                className="h-8 w-16"
                              />
                              <span className="text-xs text-muted-foreground">
                                marks
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Questions come from the Question Bank. A snapshot is frozen
                    when the exam is published.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <SnowflakeIcon className="size-4" aria-hidden="true" />
                  Paper results entry
                </div>
                <p className="text-sm text-muted-foreground">
                  Paper exams enter marks manually for each candidate. Result
                  entry happens on the Results page after the exam is closed, not
                  during setup.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Draft exams can be edited freely. Publishing freezes question and
                option snapshots, after which questions cannot be edited in
                place. Result release only appears once the exam is closed.
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
                      ? "Exam update preview closed. Nothing was changed — this is a UI demo."
                      : "Exam preview closed. Nothing was created — this is a UI demo."
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
              <Button type="submit" form="exam-form">
                {isEdit ? "Save changes (demo)" : "Create draft (demo)"}
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
