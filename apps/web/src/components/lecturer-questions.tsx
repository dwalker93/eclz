"use client"

import { useMemo, useState, type FormEvent } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CircleIcon,
  ImageIcon,
  InfoIcon,
  ListChecksIcon,
  LockKeyholeIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import { LecturerExamStatusBadge } from "@/components/portal-status-badge"
import {
  getLecturerCourseById,
  getLecturerQuestionSnapshotUsage,
  lecturer,
  lecturerCourses,
  lecturerModules,
  lecturerQuestions,
  type LecturerQuestion,
  type LecturerQuestionOption,
} from "@/lib/lecturer-portal-data"
import { formatDisplayDate, MOCK_TODAY } from "@/lib/student-portal-data"

type QuestionEditorState =
  { mode: "create" } | { mode: "edit"; questionId: string }

type QuestionFormValues = {
  courseId: string
  body: string
  explanation: string
  defaultMarks: number
  hasImage: boolean
  imageLabel?: string
  options: LecturerQuestionOption[]
}

type QuestionFormState = {
  courseId: string
  body: string
  explanation: string
  defaultMarks: string
  hasImage: boolean
  imageLabel: string
  options: LecturerQuestionOption[]
}

const optionLetters = "ABCDEF"

function createEmptyOptions(): LecturerQuestionOption[] {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `option-new-${index + 1}`,
    text: "",
    isCorrect: false,
  }))
}

function createQuestionFormState(
  question?: LecturerQuestion
): QuestionFormState {
  return {
    courseId: question?.courseId ?? lecturerCourses[0]?.id ?? "",
    body: question?.body ?? "",
    explanation: question?.explanation ?? "",
    defaultMarks: String(question?.defaultMarks ?? 1),
    hasImage: question?.hasImage ?? false,
    imageLabel: question?.imageLabel ?? "",
    options: (question?.options ?? createEmptyOptions()).map((option) => ({
      ...option,
    })),
  }
}

function questionOptionsEqual(
  first: LecturerQuestionOption[],
  second: LecturerQuestionOption[]
) {
  return (
    first.length === second.length &&
    first.every(
      (option, index) =>
        option.text === second[index]?.text &&
        option.isCorrect === second[index]?.isCorrect
    )
  )
}

function questionValuesEqual(
  first: LecturerQuestion,
  second: LecturerQuestion
) {
  return (
    first.courseId === second.courseId &&
    first.body === second.body &&
    first.explanation === second.explanation &&
    first.defaultMarks === second.defaultMarks &&
    first.hasImage === second.hasImage &&
    (first.imageLabel ?? "") === (second.imageLabel ?? "") &&
    questionOptionsEqual(first.options, second.options)
  )
}

function getOptionLetter(index: number) {
  return optionLetters[index] ?? String(index + 1)
}

export function LecturerQuestions() {
  const onlineExamsEnabled = lecturerModules.onlineExams
  const [questions, setQuestions] = useState<LecturerQuestion[]>(() => [
    ...lecturerQuestions,
  ])
  const [query, setQuery] = useState("")
  const [courseFilter, setCourseFilter] = useState("all")
  const [previewQuestionId, setPreviewQuestionId] = useState<string | null>(
    null
  )
  const [editor, setEditor] = useState<QuestionEditorState | null>(null)

  const counts = useMemo(
    () => ({
      total: questions.length,
      used: questions.filter((question) => question.usedInSnapshots.length > 0)
        .length,
      unused: questions.filter(
        (question) => question.usedInSnapshots.length === 0
      ).length,
      withImage: questions.filter((question) => question.hasImage).length,
    }),
    [questions]
  )

  const localChangeCount = useMemo(
    () =>
      questions.reduce((count, question) => {
        const original = lecturerQuestions.find(
          (candidate) => candidate.id === question.id
        )

        if (!original) return count + 1

        return questionValuesEqual(original, question) ? count : count + 1
      }, 0),
    [questions]
  )

  const courseOptions = useMemo(
    () =>
      lecturerCourses
        .filter(
          (course) =>
            questions.some((question) => question.courseId === course.id) ||
            course.id === courseFilter
        )
        .map((course) => ({
          value: course.id,
          label: `${course.name} · ${course.branch}`,
        })),
    [courseFilter, questions]
  )

  const filteredQuestions = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase()

    return questions
      .filter((question) => {
        if (
          normalisedQuery &&
          !question.body.toLowerCase().includes(normalisedQuery)
        ) {
          return false
        }
        if (courseFilter !== "all" && question.courseId !== courseFilter) {
          return false
        }
        return true
      })
      .sort(
        (first, second) =>
          second.updatedOn.localeCompare(first.updatedOn) ||
          first.body.localeCompare(second.body)
      )
  }, [courseFilter, query, questions])

  const courseGroups = useMemo(() => {
    const questionsByCourse = new Map<string, LecturerQuestion[]>()

    for (const question of filteredQuestions) {
      const existing = questionsByCourse.get(question.courseId)

      if (existing) {
        existing.push(question)
      } else {
        questionsByCourse.set(question.courseId, [question])
      }
    }

    return lecturerCourses
      .filter((course) => questionsByCourse.has(course.id))
      .map((course) => ({
        course,
        questions: questionsByCourse.get(course.id) ?? [],
      }))
  }, [filteredQuestions])

  const previewQuestion =
    questions.find((question) => question.id === previewQuestionId) ?? null
  const editingQuestion =
    editor?.mode === "edit"
      ? (questions.find((question) => question.id === editor.questionId) ??
        null)
      : null
  const hasFilters = query.trim() !== "" || courseFilter !== "all"

  function clearFilters() {
    setQuery("")
    setCourseFilter("all")
  }

  function resetLocalChanges() {
    setQuestions([...lecturerQuestions])
    setPreviewQuestionId(null)
    setEditor(null)
  }

  function handleSave(values: QuestionFormValues) {
    if (!editor) return

    if (editor.mode === "create") {
      const newQuestion: LecturerQuestion = {
        id: `local-question-${Date.now()}`,
        usedInSnapshots: [],
        updatedOn: MOCK_TODAY,
        ...values,
      }

      setQuestions((current) => [newQuestion, ...current])
    } else {
      setQuestions((current) =>
        current.map((question) =>
          question.id === editor.questionId
            ? { ...question, ...values }
            : question
        )
      )
    }

    setEditor(null)
  }

  if (!onlineExamsEnabled) {
    return (
      <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6">
          <PortalPageHeader
            title="Question Bank"
            description="Questions you own for online exams. This page depends on the online exams module."
            meta={
              <>
                <Badge variant="secondary" className="rounded-full">
                  Lecturer portal
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  Online exams disabled
                </Badge>
              </>
            }
          />
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<ListChecksIcon className="size-5" aria-hidden="true" />}
              title="Question bank unavailable"
              description="Online exams are disabled in this demo, so question bank items and their exam snapshots are unavailable. Paper exam information remains available on the Exams page."
            />
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Question Bank"
          description="Questions you own for online MCQ exams. Search and edit local copies, review answer options and see where a published snapshot already uses a question. Nothing is scored, published or saved."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Lecturer portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.designation}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.branch} branch
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                {questions.length} questions
              </Badge>
              <Button size="sm" onClick={() => setEditor({ mode: "create" })}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                New question
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile
            icon={ListChecksIcon}
            label="All questions"
            value={counts.total}
            tone="neutral"
          />
          <SummaryTile
            icon={LockKeyholeIcon}
            label="In snapshots"
            value={counts.used}
            tone="amber"
          />
          <SummaryTile
            icon={PencilIcon}
            label="Reusable"
            value={counts.unused}
            tone="emerald"
          />
          <SummaryTile
            icon={ImageIcon}
            label="With image"
            value={counts.withImage}
            tone="sky"
          />
        </div>

        {localChangeCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <div className="flex items-start gap-3">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">
                  {localChangeCount} local{" "}
                  {localChangeCount === 1 ? "change" : "changes"}
                </p>
                <p className="text-muted-foreground">
                  Questions and edits stay in this page only. Nothing is saved,
                  scored or added to a published snapshot.
                </p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={resetLocalChanges}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Reset local changes
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <SearchIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Find questions
                </CardTitle>
                <CardDescription>
                  Search by question text and narrow by course.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {filteredQuestions.length} of {questions.length} shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_280px] sm:p-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-search">Search question text</Label>
              <Input
                id="question-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. fraction, percentage, simplify"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-course">Course</Label>
              <Select
                items={[
                  { value: "all", label: "All my courses" },
                  ...courseOptions,
                ]}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger id="question-course" className="w-full">
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my courses</SelectItem>
                  {courseOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters ? (
              <div className="sm:col-span-2">
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {courseGroups.length === 0 ? (
          <Card className="gap-0 py-0">
            {questions.length === 0 ? (
              <EmptyState
                icon={<ListChecksIcon className="size-5" aria-hidden="true" />}
                title="No questions yet"
                description="Use New question to preview the local question editor. Nothing is published or scored."
              />
            ) : (
              <EmptyState
                icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                title="No matching questions"
                description="Try another search term or course. Clear the filters to see all of your questions."
              />
            )}
          </Card>
        ) : (
          courseGroups.map(({ course, questions: courseQuestions }) => (
            <Card key={course.id} className="gap-0 py-0">
              <CardHeader className="border-b px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {course.subject.slice(0, 1)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <CardTitle>{course.name}</CardTitle>
                      <CardDescription>
                        {course.subject} · {course.branch} ·{" "}
                        {courseQuestions.length}{" "}
                        {courseQuestions.length === 1
                          ? "question"
                          : "questions"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {course.branch}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 p-4 sm:p-6 md:grid-cols-2">
                {courseQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onPreview={() => setPreviewQuestionId(question.id)}
                    onEdit={() =>
                      setEditor({ mode: "edit", questionId: question.id })
                    }
                  />
                ))}
              </CardContent>

              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Questions are limited to your own courses. Published snapshots
                stay read-only.
              </CardFooter>
            </Card>
          ))
        )}

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This bank is limited to {lecturer.fullName}&apos;s own questions.
              Questions used in a published or closed online snapshot are shown
              read-only because snapshots are immutable. Editing, image
              placeholders, options and correctness flags are local demo values
              only — no scoring or publishing is implemented.
            </p>
          </CardContent>
        </Card>
      </div>

      {editor ? (
        <QuestionEditorDialog
          key={
            editor.mode === "edit"
              ? `edit-${editor.questionId}`
              : "create-question"
          }
          question={editingQuestion}
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
          onSave={handleSave}
        />
      ) : null}

      <QuestionDetailDialog
        question={previewQuestion}
        onOpenChange={(open) => {
          if (!open) setPreviewQuestionId(null)
        }}
      />
    </main>
  )
}

function QuestionCard({
  question,
  onPreview,
  onEdit,
}: {
  question: LecturerQuestion
  onPreview: () => void
  onEdit: () => void
}) {
  const isLocked = question.usedInSnapshots.length > 0
  const correctCount = question.options.filter(
    (option) => option.isCorrect
  ).length

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        isLocked && "border-dashed bg-muted/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="rounded-full">
          {question.options.length} options
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {question.defaultMarks}{" "}
          {question.defaultMarks === 1 ? "mark" : "marks"}
        </Badge>
        {question.hasImage ? (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
          >
            <ImageIcon aria-hidden="true" />
            Image
          </Badge>
        ) : null}
        {isLocked ? (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-border bg-muted/60 text-muted-foreground"
          >
            <LockKeyholeIcon aria-hidden="true" />
            In snapshot
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
          >
            <CheckCircle2Icon aria-hidden="true" />
            Reusable
          </Badge>
        )}
      </div>

      <p className="text-sm leading-snug font-medium">{question.body}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          {correctCount} correct {correctCount === 1 ? "option" : "options"}
        </span>
        <span>Updated {formatDisplayDate(question.updatedOn)}</span>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <Button variant="outline" size="xs" onClick={onPreview}>
          <ListChecksIcon data-icon="inline-start" aria-hidden="true" />
          {isLocked ? "View locked question" : "View"}
        </Button>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
            Read-only
          </span>
        ) : (
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>
    </div>
  )
}

function QuestionDetailDialog({
  question,
  onOpenChange,
}: {
  question: LecturerQuestion | null
  onOpenChange: (open: boolean) => void
}) {
  const course = question ? getLecturerCourseById(question.courseId) : null
  const usage = question ? getLecturerQuestionSnapshotUsage(question) : []

  return (
    <Dialog open={question !== null} onOpenChange={onOpenChange}>
      {question ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="rounded-full">
                {question.options.length} options
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {question.defaultMarks} default marks
              </Badge>
              {question.hasImage ? (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                >
                  <ImageIcon aria-hidden="true" />
                  Image
                </Badge>
              ) : null}
              {usage.length > 0 ? (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-border bg-muted/60 text-muted-foreground"
                >
                  <LockKeyholeIcon aria-hidden="true" />
                  Snapshot locked
                </Badge>
              ) : null}
            </div>
            <DialogTitle className="text-lg">Question detail</DialogTitle>
            <DialogDescription>
              {course?.name ?? "Course question"} · {course?.branch ?? "Branch"}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm leading-relaxed font-medium">{question.body}</p>

          {question.hasImage && question.imageLabel ? (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ImageIcon className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Image placeholder</p>
                <p className="text-xs text-muted-foreground">
                  {question.imageLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  No image is uploaded or opened in this demo.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Answer options</h3>
            <ol className="flex flex-col divide-y rounded-lg border">
              {question.options.map((option, index) => (
                <li
                  key={option.id}
                  className="flex items-start gap-2 p-2.5 text-sm"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {getOptionLetter(index)}
                  </span>
                  <span className="min-w-0 flex-1">{option.text}</span>
                  {option.isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2Icon
                        className="size-3.5"
                        aria-hidden="true"
                      />
                      Correct
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          {question.explanation ? (
            <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3">
              <h3 className="text-sm font-semibold">Explanation</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {question.explanation}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Updated {formatDisplayDate(question.updatedOn)}</span>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Published snapshot use</h3>
            {usage.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                This question is not used in a published or closed online exam
                snapshot. It can be edited in the local bank.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {usage.map((entry) => (
                  <li
                    key={entry.examId}
                    className="flex flex-wrap items-start justify-between gap-2 p-2.5"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {entry.examTitle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Locked {formatDisplayDate(entry.lockedOn)}
                      </span>
                    </div>
                    <LecturerExamStatusBadge status={entry.status} />
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <LockKeyholeIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Published snapshots are immutable. This demo never updates them or
              adds questions to them.
            </p>
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function QuestionEditorDialog({
  question,
  onOpenChange,
  onSave,
}: {
  question: LecturerQuestion | null
  onOpenChange: (open: boolean) => void
  onSave: (values: QuestionFormValues) => void
}) {
  const [form, setForm] = useState<QuestionFormState>(() =>
    createQuestionFormState(question ?? undefined)
  )
  const [error, setError] = useState<string | null>(null)

  const selectedCourse = getLecturerCourseById(form.courseId)

  function updateForm(patch: Partial<QuestionFormState>) {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function updateOption(
    optionId: string,
    patch: Partial<LecturerQuestionOption>
  ) {
    updateForm({
      options: form.options.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option
      ),
    })
  }

  function markCorrect(optionId: string) {
    updateForm({
      options: form.options.map((option) => ({
        ...option,
        isCorrect: option.id === optionId,
      })),
    })
  }

  function moveOption(index: number, direction: -1 | 1) {
    const target = index + direction

    if (target < 0 || target >= form.options.length) return

    const next = [...form.options]
    const [moved] = next.splice(index, 1)

    if (!moved) return

    next.splice(target, 0, moved)
    updateForm({ options: next })
  }

  function addOption() {
    if (form.options.length >= optionLetters.length) return

    updateForm({
      options: [
        ...form.options,
        {
          id: `local-option-${form.options.length}-${Date.now()}`,
          text: "",
          isCorrect: false,
        },
      ],
    })
  }

  function removeOption(optionId: string) {
    if (form.options.length <= 2) return

    updateForm({
      options: form.options.filter((option) => option.id !== optionId),
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const body = form.body.trim()
    const explanation = form.explanation.trim()
    const imageLabel = form.imageLabel.trim()
    const defaultMarks = Number.parseInt(form.defaultMarks, 10)
    const options = form.options.map((option) => ({
      ...option,
      text: option.text.trim(),
    }))
    const correctCount = options.filter((option) => option.isCorrect).length

    if (!body) {
      setError("Add the question text.")
      return
    }
    if (!form.courseId || !selectedCourse) {
      setError("Choose one of your courses for this question.")
      return
    }
    if (options.length < 2) {
      setError("Add at least two answer options.")
      return
    }
    if (options.some((option) => !option.text)) {
      setError("Every answer option needs text.")
      return
    }
    if (correctCount !== 1) {
      setError("Mark exactly one answer option as correct.")
      return
    }
    if (!Number.isFinite(defaultMarks) || defaultMarks < 1) {
      setError("Default marks must be a whole number of 1 or more.")
      return
    }
    if (form.hasImage && !imageLabel) {
      setError("Add a short description for the image placeholder.")
      return
    }

    onSave({
      courseId: form.courseId,
      body,
      explanation,
      defaultMarks,
      hasImage: form.hasImage,
      imageLabel: form.hasImage ? imageLabel : undefined,
      options,
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="rounded-full">
              {question ? "Local edit" : "New local question"}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {form.options.length} options
            </Badge>
          </div>
          <DialogTitle className="text-lg">
            {question ? "Edit question" : "New question"}
          </DialogTitle>
          <DialogDescription>
            {question
              ? "Changes update this page's local copy only. Published exam snapshots are never changed."
              : "New questions stay in the local bank. Nothing is published, scored or saved."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="question-body">Question text</Label>
            <Textarea
              id="question-body"
              value={form.body}
              onChange={(event) => updateForm({ body: event.target.value })}
              placeholder="Write the question as students would see it."
              rows={3}
              maxLength={500}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-editor-course">Course</Label>
              <Select
                items={lecturerCourses.map((course) => ({
                  value: course.id,
                  label: `${course.name} · ${course.branch}`,
                }))}
                value={form.courseId}
                onValueChange={(value) => updateForm({ courseId: value ?? "" })}
              >
                <SelectTrigger id="question-editor-course" className="w-full">
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lecturerCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} · {course.branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-marks">Default marks</Label>
              <Input
                id="question-marks"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.defaultMarks}
                onChange={(event) =>
                  updateForm({ defaultMarks: event.target.value })
                }
                required
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {selectedCourse
              ? `${selectedCourse.subject} · ${selectedCourse.branch} branch`
              : "Choose one of your courses."}
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Answer options</span>
                <span className="text-xs text-muted-foreground">
                  Mark one correct option. Order is used when adding the
                  question to an exam.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={addOption}
                disabled={form.options.length >= optionLetters.length}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Add option
              </Button>
            </div>

            <ul className="flex flex-col divide-y rounded-lg border">
              {form.options.map((option, index) => (
                <li
                  key={option.id}
                  className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {getOptionLetter(index)}
                  </span>
                  <Input
                    value={option.text}
                    onChange={(event) =>
                      updateOption(option.id, { text: event.target.value })
                    }
                    placeholder={`Option ${getOptionLetter(index)}`}
                    aria-label={`Option ${getOptionLetter(index)} text`}
                    maxLength={160}
                    required
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant={option.isCorrect ? "secondary" : "outline"}
                      size="xs"
                      onClick={() => markCorrect(option.id)}
                      aria-pressed={option.isCorrect}
                    >
                      {option.isCorrect ? (
                        <CheckCircle2Icon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                      ) : (
                        <CircleIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                      )}
                      Correct
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => moveOption(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move option ${getOptionLetter(index)} up`}
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => moveOption(index, 1)}
                      disabled={index === form.options.length - 1}
                      aria-label={`Move option ${getOptionLetter(index)} down`}
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeOption(option.id)}
                      disabled={form.options.length <= 2}
                      aria-label={`Remove option ${getOptionLetter(index)}`}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Optional image</span>
              <p className="text-xs text-muted-foreground">
                Describe a placeholder diagram. No image is uploaded.
              </p>
            </div>
            <Switch
              id="question-image"
              checked={form.hasImage}
              onCheckedChange={(checked) =>
                updateForm({ hasImage: Boolean(checked) })
              }
              aria-label="Toggle image placeholder"
            />
          </div>

          {form.hasImage ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="question-image-label">
                Image placeholder description
              </Label>
              <Input
                id="question-image-label"
                value={form.imageLabel}
                onChange={(event) =>
                  updateForm({ imageLabel: event.target.value })
                }
                placeholder="e.g. Diagram of two rays meeting at a vertex"
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                Text description only. No storage key or real image URL is
                modelled.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="question-explanation">Explanation</Label>
            <Textarea
              id="question-explanation"
              value={form.explanation}
              onChange={(event) =>
                updateForm({ explanation: event.target.value })
              }
              placeholder="Optional explanation shown after marking in a real exam."
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <LockKeyholeIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              Published snapshots are immutable. Saving updates only this local
              question-bank copy and never changes a published exam, score or
              result.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {question ? "Update local question" : "Add local question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: "neutral" | "amber" | "emerald" | "sky"
}) {
  const toneClasses = {
    neutral: "border-border bg-muted/30 text-foreground",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        toneClasses[tone]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </p>
        <Icon className="size-4 opacity-70" aria-hidden="true" />
      </div>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}
