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
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CircleAlertIcon,
  ImageIcon,
  InfoIcon,
  ListChecksIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { isQuestionInPublishedSnapshot } from "@/lib/exams-data"
import { lecturers } from "@/lib/lecturers-data"
import {
  questionSubjectFilterOptions,
  type QuestionRecord,
} from "@/lib/questions-data"

type QuestionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this bank question; otherwise it creates one. */
  question?: QuestionRecord | null
  onSaved: (message: string) => void
}

type OptionDraft = {
  id: string
  body: string
  isCorrect: boolean
}

type FormState = {
  lecturerId: string
  subjectName: string
  body: string
  explanation: string
  defaultMarks: string
  imageFileName: string | null
  options: OptionDraft[]
}

type FormErrors = {
  lecturerId?: string
  subjectName?: string
  body?: string
  defaultMarks?: string
  options?: string
}

const subjectChoices = questionSubjectFilterOptions
  .filter((option) => option.value !== "all")
  .map((option) => option.label)

const lecturerChoices = lecturers.map((lecturer) => ({
  value: lecturer.id,
  label: lecturer.fullName,
}))

let optionCounter = 0

function nextOptionId() {
  optionCounter += 1
  return `opt-${optionCounter}`
}

function blankOption(): OptionDraft {
  return { id: nextOptionId(), body: "", isCorrect: false }
}

function emptyForm(): FormState {
  return {
    lecturerId: "",
    subjectName: "",
    body: "",
    explanation: "",
    defaultMarks: "1",
    imageFileName: null,
    options: [blankOption(), blankOption(), blankOption(), blankOption()],
  }
}

function formFromQuestion(question: QuestionRecord): FormState {
  return {
    lecturerId: question.lecturerId,
    subjectName: question.subjectName,
    body: question.body,
    explanation: question.explanation ?? "",
    defaultMarks: String(question.defaultMarks),
    imageFileName: question.imageFileName,
    options: question.options.map((option) => ({
      id: nextOptionId(),
      body: option.body,
      isCorrect: option.isCorrect,
    })),
  }
}

function optionLabel(index: number) {
  return String.fromCharCode(65 + index)
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  onSaved,
}: QuestionFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const isEdit = Boolean(question)
  const frozen = question ? isQuestionInPublishedSnapshot(question.id) : false

  useEffect(() => {
    setForm(question ? formFromQuestion(question) : emptyForm())
    setErrors({})
    setSubmitted(false)
  }, [open, question])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function updateOption(
    optionId: string,
    patch: Partial<Pick<OptionDraft, "body" | "isCorrect">>
  ) {
    setForm((previous) => ({
      ...previous,
      options: previous.options.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option
      ),
    }))
  }

  function addOption() {
    setForm((previous) => ({
      ...previous,
      options: [...previous.options, blankOption()],
    }))
  }

  function removeOption(optionId: string) {
    setForm((previous) => ({
      ...previous,
      options:
        previous.options.length <= 2
          ? previous.options
          : previous.options.filter((option) => option.id !== optionId),
    }))
  }

  function moveOption(index: number, direction: -1 | 1) {
    setForm((previous) => {
      const target = index + direction

      if (target < 0 || target >= previous.options.length) return previous

      const options = [...previous.options]
      const [moved] = options.splice(index, 1)
      if (!moved) return previous
      options.splice(target, 0, moved)

      return { ...previous, options }
    })
  }

  const correctCount = form.options.filter((option) => option.isCorrect).length

  function validate(): FormErrors {
    const nextErrors: FormErrors = {}

    if (!form.lecturerId) {
      nextErrors.lecturerId = "Select the lecturer who owns this question."
    }

    if (!form.subjectName.trim()) {
      nextErrors.subjectName = "Select or enter a subject."
    }

    if (!form.body.trim()) {
      nextErrors.body = "The question prompt is required."
    }

    const marks = Number(form.defaultMarks)
    if (
      form.defaultMarks.trim() === "" ||
      !Number.isFinite(marks) ||
      marks <= 0
    ) {
      nextErrors.defaultMarks = "Default marks must be a positive number."
    }

    if (form.options.length < 2) {
      nextErrors.options = "A question needs at least two answer options."
    } else if (form.options.some((option) => !option.body.trim())) {
      nextErrors.options = "Every answer option needs text."
    } else if (correctCount === 0) {
      nextErrors.options = "Mark at least one option as correct."
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
    lecturerChoices.find((option) => option.value === form.lecturerId)?.label ??
    "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecksIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit bank question" : "Create question"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the bank record. Nothing is saved — this is a UI preview."
              : "Add a question and its ordered answer options. Nothing is saved."}
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
                  {isEdit ? "Question update ready" : "Question ready to save"}
                </span>
                <p className="text-sm">
                  {isEdit
                    ? "The bank record would be updated. Existing exam snapshots stay exactly as published."
                    : "The question would be added to the bank and become selectable in draft exams."}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField label="Owner lecturer" value={lecturerLabel} />
              <PreviewField
                label="Subject"
                value={form.subjectName.trim() || "—"}
              />
              <PreviewField
                label="Default marks"
                value={`${form.defaultMarks || "0"} ${
                  Number(form.defaultMarks) === 1 ? "mark" : "marks"
                }`}
              />
              <PreviewField
                label="Answer options"
                value={`${form.options.length} options · ${correctCount} correct`}
              />
              <PreviewField
                label="Image"
                value={form.imageFileName ?? "No image attached"}
              />
            </dl>

            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Question
              </span>
              <p className="text-sm">
                {form.body.trim() || "Untitled question prompt"}
              </p>
              <Separator />
              <ol className="flex flex-col gap-1.5">
                {form.options.map((option, index) => (
                  <li
                    key={option.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {optionLabel(index)}
                    </span>
                    <span className="min-w-0 flex-1">{option.body}</span>
                    {option.isCorrect ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                      >
                        <CheckIcon aria-hidden="true" />
                        Correct
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ol>
              {form.explanation.trim() ? (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Explanation
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {form.explanation.trim()}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo preview only. No question is created or changed, and the
                image is a placeholder name rather than an upload.
              </span>
            </div>

            {frozen ? (
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  This question is already part of a published exam snapshot.
                  Editing the bank record does not change that frozen snapshot.
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <form
            id="question-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="question-lecturer">Owner lecturer</Label>
                <Select
                  items={lecturerChoices}
                  value={form.lecturerId || null}
                  onValueChange={(value) => update("lecturerId", value ?? "")}
                >
                  <SelectTrigger
                    id="question-lecturer"
                    className="w-full"
                    aria-invalid={errors.lecturerId ? true : undefined}
                    aria-describedby={
                      errors.lecturerId ? "question-lecturer-error" : undefined
                    }
                  >
                    <SelectValue placeholder="Select a lecturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {lecturerChoices.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.lecturerId ? (
                  <p
                    id="question-lecturer-error"
                    className="text-xs text-destructive"
                  >
                    {errors.lecturerId}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="question-subject">Subject</Label>
                <Input
                  id="question-subject"
                  list="question-subject-choices"
                  value={form.subjectName}
                  onChange={(event) =>
                    update("subjectName", event.target.value)
                  }
                  placeholder="e.g. Mathematics"
                  aria-invalid={errors.subjectName ? true : undefined}
                  aria-describedby={
                    errors.subjectName ? "question-subject-error" : undefined
                  }
                />
                <datalist id="question-subject-choices">
                  {subjectChoices.map((subject) => (
                    <option key={subject} value={subject} />
                  ))}
                </datalist>
                {errors.subjectName ? (
                  <p
                    id="question-subject-error"
                    className="text-xs text-destructive"
                  >
                    {errors.subjectName}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-body">
                <span>
                  Question prompt
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </span>
              </Label>
              <Textarea
                id="question-body"
                value={form.body}
                onChange={(event) => update("body", event.target.value)}
                placeholder="Type the question exactly as candidates should see it."
                rows={3}
                aria-invalid={errors.body ? true : undefined}
                aria-describedby={errors.body ? "question-body-error" : undefined}
              />
              {errors.body ? (
                <p id="question-body-error" className="text-xs text-destructive">
                  {errors.body}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-image">
                Attached image
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageIcon className="size-4" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">
                    {form.imageFileName ?? "No image attached"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Diagrams for the prompt. The file name is sampled locally.
                  </span>
                </div>
                <Input
                  id="question-image"
                  type="file"
                  accept="image/*"
                  className="h-auto w-auto max-w-full border-0 bg-transparent p-0 text-xs shadow-none file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    update("imageFileName", file ? file.name : null)
                  }}
                />
                {form.imageFileName ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update("imageFileName", null)}
                  >
                    <UploadIcon data-icon="inline-start" className="rotate-180" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="question-marks">
                  <span>
                    Default marks
                    <span className="ml-0.5 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </span>
                </Label>
                <Input
                  id="question-marks"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={form.defaultMarks}
                  onChange={(event) =>
                    update("defaultMarks", event.target.value)
                  }
                  aria-invalid={errors.defaultMarks ? true : undefined}
                  aria-describedby={
                    errors.defaultMarks ? "question-marks-error" : undefined
                  }
                />
                {errors.defaultMarks ? (
                  <p
                    id="question-marks-error"
                    className="text-xs text-destructive"
                  >
                    {errors.defaultMarks}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Exams can override this mark when the question is placed.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="question-explanation">
                  Explanation
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="question-explanation"
                  value={form.explanation}
                  onChange={(event) =>
                    update("explanation", event.target.value)
                  }
                  placeholder="Shown to candidates after results are visible."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <ListChecksIcon className="size-4" aria-hidden="true" />
                  Answer options
                </Label>
                <Badge variant="outline" className="rounded-full">
                  {form.options.length} options · {correctCount} correct
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Options are ordered A, B, C… The schema allows one or more
                correct options, so use a checkbox per option.
              </p>

              <div className="flex flex-col gap-2">
                {form.options.map((option, index) => (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-start gap-2 rounded-lg border p-2 sm:flex-nowrap"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {optionLabel(index)}
                    </span>
                    <Input
                      value={option.body}
                      onChange={(event) =>
                        updateOption(option.id, { body: event.target.value })
                      }
                      placeholder={`Option ${optionLabel(index)} text`}
                      aria-label={`Option ${optionLabel(index)} text`}
                      className="min-w-40 flex-1"
                    />
                    <Label className="flex items-center gap-1.5 px-1 py-1.5 font-normal">
                      <Checkbox
                        checked={option.isCorrect}
                        onCheckedChange={(checked) =>
                          updateOption(option.id, { isCorrect: checked })
                        }
                      />
                      <span className="text-xs">Correct</span>
                    </Label>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => moveOption(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move option ${optionLabel(index)} up`}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => moveOption(index, 1)}
                        disabled={index === form.options.length - 1}
                        aria-label={`Move option ${optionLabel(index)} down`}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeOption(option.id)}
                        disabled={form.options.length <= 2}
                        aria-label={`Remove option ${optionLabel(index)}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  disabled={form.options.length >= 8}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add option
                </Button>
                <span className="text-xs text-muted-foreground">
                  Minimum 2, maximum 8 options.
                </span>
              </div>

              {errors.options ? (
                <p className="text-xs text-destructive" role="alert">
                  {errors.options}
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                The bank is shared by every exam. Publishing an exam freezes a
                snapshot of the question and options; later bank edits never
                rewrite that snapshot.
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
                      ? "Question update preview closed. Nothing was changed — this is a UI demo."
                      : "Question preview closed. Nothing was created — this is a UI demo."
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
              <Button type="submit" form="question-form">
                {isEdit ? "Save changes (demo)" : "Add question (demo)"}
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