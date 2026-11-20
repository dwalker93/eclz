"use client"

import Link from "next/link"
import { useMemo, useState, type FormEvent } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
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
import { cn } from "@workspace/ui/lib/utils"
import {
  CalendarDaysIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  FileCheck2Icon,
  InfoIcon,
  ListChecksIcon,
  LockKeyholeIcon,
  MapPinIcon,
  MonitorIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchXIcon,
  TimerIcon,
  TrophyIcon,
  UsersIcon,
  BookOpenIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ExamModeBadge,
  ExamResultStateBadge,
  LecturerExamStatusBadge,
} from "@/components/portal-status-badge"
import {
  getLecturerCourseById,
  isLecturerExamSnapshotLocked,
  LECTURER_EXAM_RESULTS_VISIBILITY_LABELS,
  lecturer,
  lecturerCourses,
  lecturerExams,
  lecturerModules,
  type LecturerExam,
  type LecturerExamResultsVisibility,
  type LecturerExamStatus,
} from "@/lib/lecturer-portal-data"
import {
  EXAM_MODE_LABELS,
  formatDisplayDate,
  formatTimeRange,
  MOCK_TODAY,
  type ExamMode,
} from "@/lib/student-portal-data"

type ExamStatusFilter = "all" | LecturerExamStatus
type ExamModeFilter = "all" | ExamMode
type ExamEditorState = { mode: "create" } | { mode: "edit"; examId: string }

type ExamFormValues = {
  title: string
  courseId: string
  mode: ExamMode
  date: string
  startsAt: string
  endsAt: string
  durationMinutes: number
  maxAttempts: number
  questionCount: number
  maxMarks: number
  passMarks: number
  resultsVisibility: LecturerExamResultsVisibility
  venue: string
}

type ExamFormState = {
  title: string
  courseId: string
  mode: ExamMode
  date: string
  startsAt: string
  endsAt: string
  durationMinutes: string
  maxAttempts: string
  questionCount: string
  maxMarks: string
  passMarks: string
  resultsVisibility: LecturerExamResultsVisibility
  venue: string
}

const statusFilters: Array<{ value: ExamStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
]

const modeOptions: Array<{ value: ExamMode; label: string }> = [
  { value: "online_mcq", label: EXAM_MODE_LABELS.online_mcq },
  { value: "paper", label: EXAM_MODE_LABELS.paper },
]

const resultsVisibilityOptions = (
  Object.keys(
    LECTURER_EXAM_RESULTS_VISIBILITY_LABELS
  ) as LecturerExamResultsVisibility[]
).map((value) => ({
  value,
  label: LECTURER_EXAM_RESULTS_VISIBILITY_LABELS[value],
}))

const statusOrder: Record<LecturerExamStatus, number> = {
  published: 0,
  scheduled: 1,
  draft: 2,
  closed: 3,
}

function isExamEditable(exam: LecturerExam) {
  return exam.status === "draft" || exam.status === "scheduled"
}

function examValuesEqual(first: LecturerExam, second: LecturerExam) {
  return (
    first.title === second.title &&
    first.courseId === second.courseId &&
    first.mode === second.mode &&
    first.date === second.date &&
    first.startsAt === second.startsAt &&
    first.endsAt === second.endsAt &&
    first.durationMinutes === second.durationMinutes &&
    first.maxAttempts === second.maxAttempts &&
    first.questionCount === second.questionCount &&
    first.maxMarks === second.maxMarks &&
    first.passMarks === second.passMarks &&
    first.resultsVisibility === second.resultsVisibility &&
    (first.venue ?? "") === (second.venue ?? "")
  )
}

function createExamFormState(
  exam?: LecturerExam,
  onlineExamsEnabled = true
): ExamFormState {
  return {
    title: exam?.title ?? "",
    courseId: exam?.courseId ?? lecturerCourses[0]?.id ?? "",
    mode: exam?.mode ?? (onlineExamsEnabled ? "online_mcq" : "paper"),
    date: exam?.date ?? MOCK_TODAY,
    startsAt: exam?.startsAt ?? "15:00",
    endsAt: exam?.endsAt ?? "15:30",
    durationMinutes: String(exam?.durationMinutes ?? 30),
    maxAttempts: String(exam?.maxAttempts ?? 1),
    questionCount: String(exam?.questionCount ?? 10),
    maxMarks: String(exam?.maxMarks ?? 20),
    passMarks: String(exam?.passMarks ?? 8),
    resultsVisibility: exam?.resultsVisibility ?? "after_close",
    venue: exam?.venue ?? "",
  }
}

export function LecturerExams() {
  const onlineExamsEnabled = lecturerModules.onlineExams
  const [exams, setExams] = useState<LecturerExam[]>(() => [...lecturerExams])
  const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>("all")
  const [modeFilter, setModeFilter] = useState<ExamModeFilter>("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [previewExamId, setPreviewExamId] = useState<string | null>(null)
  const [editor, setEditor] = useState<ExamEditorState | null>(null)

  const counts = useMemo(
    () => ({
      total: exams.length,
      draft: exams.filter((exam) => exam.status === "draft").length,
      upcoming: exams.filter(
        (exam) => exam.status === "scheduled" || exam.status === "published"
      ).length,
      closed: exams.filter((exam) => exam.status === "closed").length,
    }),
    [exams]
  )

  const localChangeCount = useMemo(
    () =>
      exams.reduce((count, exam) => {
        const original = lecturerExams.find(
          (candidate) => candidate.id === exam.id
        )

        if (!original) return count + 1

        return examValuesEqual(original, exam) ? count : count + 1
      }, 0),
    [exams]
  )

  const courseOptions = useMemo(
    () =>
      lecturerCourses
        .filter(
          (course) =>
            exams.some((exam) => exam.courseId === course.id) ||
            course.id === courseFilter
        )
        .map((course) => ({
          value: course.id,
          label: `${course.name} · ${course.branch}`,
        })),
    [courseFilter, exams]
  )

  const filteredExams = useMemo(
    () =>
      exams
        .filter((exam) => {
          if (statusFilter !== "all" && exam.status !== statusFilter) {
            return false
          }
          if (modeFilter !== "all" && exam.mode !== modeFilter) {
            return false
          }
          if (courseFilter !== "all" && exam.courseId !== courseFilter) {
            return false
          }
          return true
        })
        .sort(
          (first, second) =>
            statusOrder[first.status] - statusOrder[second.status] ||
            first.date.localeCompare(second.date) ||
            first.title.localeCompare(second.title)
        ),
    [courseFilter, exams, modeFilter, statusFilter]
  )

  const previewExam = exams.find((exam) => exam.id === previewExamId) ?? null
  const editingExam =
    editor?.mode === "edit"
      ? (exams.find((exam) => exam.id === editor.examId) ?? null)
      : null
  const hasFilters =
    statusFilter !== "all" || modeFilter !== "all" || courseFilter !== "all"

  function clearFilters() {
    setStatusFilter("all")
    setModeFilter("all")
    setCourseFilter("all")
  }

  function resetLocalChanges() {
    setExams([...lecturerExams])
    setPreviewExamId(null)
    setEditor(null)
  }

  function handleSave(values: ExamFormValues) {
    if (!editor) return

    const course = getLecturerCourseById(values.courseId)
    const courseName = course?.name ?? "Course"

    if (editor.mode === "create") {
      const newExam: LecturerExam = {
        id: `local-exam-${Date.now()}`,
        courseName,
        status: "draft",
        resultsState: "pending",
        enrolledCount: course?.enrolledCount ?? 0,
        attemptsSubmitted: 0,
        attemptsInProgress: 0,
        ...values,
      }

      setExams((current) => [newExam, ...current])
    } else {
      setExams((current) =>
        current.map((exam) =>
          exam.id === editor.examId
            ? {
                ...exam,
                ...values,
                courseName,
                enrolledCount: course?.enrolledCount ?? exam.enrolledCount,
              }
            : exam
        )
      )
    }

    setEditor(null)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Exams"
          description="Exams you own for your own courses, with schedules, attempt settings, result visibility and question-snapshot state. Drafts and edits stay local — nothing is published, graded or released."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Lecturer portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.designation}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 rounded-full",
                  onlineExamsEnabled
                    ? "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                    : "border-border bg-muted/60 text-muted-foreground"
                )}
              >
                <MonitorIcon aria-hidden="true" />
                Online exams {onlineExamsEnabled ? "enabled" : "disabled"}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                {exams.length} exams
              </Badge>
              {onlineExamsEnabled ? (
                <Link
                  href="/portal/lecturer/questions"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                >
                  <ListChecksIcon data-icon="inline-start" aria-hidden="true" />
                  Question bank
                </Link>
              ) : null}
              <Button size="sm" onClick={() => setEditor({ mode: "create" })}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                New exam draft
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile
            icon={FileCheck2Icon}
            label="All exams"
            value={counts.total}
            tone="neutral"
          />
          <SummaryTile
            icon={PencilIcon}
            label="Drafts"
            value={counts.draft}
            tone="amber"
          />
          <SummaryTile
            icon={CalendarClockIcon}
            label="Upcoming"
            value={counts.upcoming}
            tone="sky"
          />
          <SummaryTile
            icon={TrophyIcon}
            label="Closed"
            value={counts.closed}
            tone="neutral"
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
                  Drafts, edits and resets stay in this page only. Nothing is
                  published, graded or saved.
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
                  <ListChecksIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Filter exams
                </CardTitle>
                <CardDescription>
                  Narrow exams by status, mode or course.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {filteredExams.length} of {exams.length} shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div
              role="group"
              aria-label="Filter by exam status"
              className="flex w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1 sm:w-fit"
            >
              {statusFilters.map((filter) => {
                const isSelected = statusFilter === filter.value
                const count =
                  filter.value === "all"
                    ? counts.total
                    : exams.filter((exam) => exam.status === filter.value)
                        .length

                return (
                  <Button
                    key={filter.value}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    aria-pressed={isSelected}
                    className="gap-1.5"
                  >
                    {filter.label}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </Button>
                )
              })}
            </div>

            <div
              role="group"
              aria-label="Filter by exam mode"
              className="flex w-fit flex-wrap gap-1 rounded-lg border p-1"
            >
              <Button
                variant={modeFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setModeFilter("all")}
                aria-pressed={modeFilter === "all"}
              >
                All modes
              </Button>
              {modeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={modeFilter === option.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setModeFilter(option.value)}
                  aria-pressed={modeFilter === option.value}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="flex max-w-sm flex-col gap-1.5">
              <label
                htmlFor="lecturer-exams-course"
                className="text-xs font-medium text-muted-foreground"
              >
                Course
              </label>
              <Select
                items={[
                  { value: "all", label: "All my courses" },
                  ...courseOptions,
                ]}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger id="lecturer-exams-course" className="w-full">
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
              <div>
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {filteredExams.length === 0 ? (
          <Card className="gap-0 py-0">
            {exams.length === 0 ? (
              <EmptyState
                icon={<FileCheck2Icon className="size-5" aria-hidden="true" />}
                title="No exams yet"
                description="Use New exam draft to preview the local exam editor. Nothing is published or graded."
              />
            ) : (
              <EmptyState
                icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                title="No matching exams"
                description="Try another status, mode or course. Clear the filters to see all of your exams."
              />
            )}
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onlineExamsEnabled={onlineExamsEnabled}
                onPreview={() => setPreviewExamId(exam.id)}
                onEdit={() => setEditor({ mode: "edit", examId: exam.id })}
              />
            ))}
          </div>
        )}

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page is limited to {lecturer.fullName}&apos;s own exams.
              Published online question snapshots are immutable. Creating,
              editing, publishing, grading and result release are not connected
              in this demo, and paper exams do not create scripts or marks.
            </p>
          </CardContent>
        </Card>
      </div>

      {editor ? (
        <ExamEditorDialog
          key={editor.mode === "edit" ? `edit-${editor.examId}` : "create-exam"}
          exam={editingExam}
          onlineExamsEnabled={onlineExamsEnabled}
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
          onSave={handleSave}
        />
      ) : null}

      <ExamDetailDialog
        exam={previewExam}
        onlineExamsEnabled={onlineExamsEnabled}
        onOpenChange={(open) => {
          if (!open) setPreviewExamId(null)
        }}
      />
    </main>
  )
}

function ExamCard({
  exam,
  onlineExamsEnabled,
  onPreview,
  onEdit,
}: {
  exam: LecturerExam
  onlineExamsEnabled: boolean
  onPreview: () => void
  onEdit: () => void
}) {
  const course = getLecturerCourseById(exam.courseId)
  const locked = isLecturerExamSnapshotLocked(exam)
  const editable =
    isExamEditable(exam) && (exam.mode === "paper" || onlineExamsEnabled)
  const notStarted = Math.max(
    exam.enrolledCount - exam.attemptsSubmitted - exam.attemptsInProgress,
    0
  )
  const onlineUnavailable = exam.mode === "online_mcq" && !onlineExamsEnabled

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <ExamModeBadge mode={exam.mode} />
              <LecturerExamStatusBadge status={exam.status} />
              <ExamResultStateBadge state={exam.resultsState} />
              {locked ? (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-border bg-muted/60 text-muted-foreground"
                >
                  <LockKeyholeIcon aria-hidden="true" />
                  Snapshot locked
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-base">{exam.title}</CardTitle>
            <CardDescription>
              {course?.name ?? exam.courseName} · {course?.branch ?? "Branch"}
            </CardDescription>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {exam.maxMarks} marks
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
            {formatDisplayDate(exam.date)} ·{" "}
            {formatTimeRange(exam.startsAt, exam.endsAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TimerIcon className="size-3.5" aria-hidden="true" />
            {exam.durationMinutes} min per attempt
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecksIcon className="size-3.5" aria-hidden="true" />
            {exam.questionCount} questions · pass {exam.passMarks}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="size-3.5" aria-hidden="true" />
            {exam.enrolledCount} enrolled
          </span>
          {exam.venue ? (
            <span className="inline-flex items-center gap-1.5 sm:col-span-2">
              <MapPinIcon className="size-3.5" aria-hidden="true" />
              {exam.venue}
            </span>
          ) : null}
        </div>

        {exam.mode === "online_mcq" ? (
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
            <p className="font-medium">Attempts</p>
            <p className="text-muted-foreground">
              {exam.attemptsSubmitted} submitted · {exam.attemptsInProgress} in
              progress · {notStarted} not started · {exam.maxAttempts}{" "}
              {exam.maxAttempts === 1 ? "attempt" : "attempts"} allowed
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
            <p className="font-medium">Paper exam</p>
            <p className="text-muted-foreground">
              One sitting · venue and schedule only. Scripts and marks are not
              modelled here.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            Results:{" "}
            {LECTURER_EXAM_RESULTS_VISIBILITY_LABELS[exam.resultsVisibility]}
          </span>
          {exam.resultsReleasedOn ? (
            <span>Released {formatDisplayDate(exam.resultsReleasedOn)}</span>
          ) : null}
        </div>

        {onlineUnavailable ? (
          <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            Online exam features are disabled in this demo. Paper information
            remains available.
          </p>
        ) : null}

        {locked ? (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <LockKeyholeIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            The published online question snapshot is locked. Local edits cannot
            change it.
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
        <Button variant="outline" size="xs" onClick={onPreview}>
          <ChevronRightIcon data-icon="inline-start" aria-hidden="true" />
          View details
        </Button>
        {editable ? (
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            Edit draft
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Read-only summary
          </span>
        )}
      </CardFooter>
    </Card>
  )
}

function ExamDetailDialog({
  exam,
  onlineExamsEnabled,
  onOpenChange,
}: {
  exam: LecturerExam | null
  onlineExamsEnabled: boolean
  onOpenChange: (open: boolean) => void
}) {
  const course = exam ? getLecturerCourseById(exam.courseId) : null
  const locked = exam ? isLecturerExamSnapshotLocked(exam) : false
  const notStarted = exam
    ? Math.max(
        exam.enrolledCount - exam.attemptsSubmitted - exam.attemptsInProgress,
        0
      )
    : 0
  const onlineUnavailable = exam?.mode === "online_mcq" && !onlineExamsEnabled

  return (
    <Dialog open={exam !== null} onOpenChange={onOpenChange}>
      {exam ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <ExamModeBadge mode={exam.mode} />
              <LecturerExamStatusBadge status={exam.status} />
              <ExamResultStateBadge state={exam.resultsState} />
              {locked ? (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-border bg-muted/60 text-muted-foreground"
                >
                  <LockKeyholeIcon aria-hidden="true" />
                  Snapshot locked
                </Badge>
              ) : null}
            </div>
            <DialogTitle className="text-lg">{exam.title}</DialogTitle>
            <DialogDescription>
              {course?.name ?? exam.courseName} · {course?.branch ?? "Branch"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 text-sm">
            <DetailRow
              icon={CalendarDaysIcon}
              label="Schedule"
              value={`${formatDisplayDate(exam.date)} · ${formatTimeRange(
                exam.startsAt,
                exam.endsAt
              )}`}
            />
            <DetailRow
              icon={TimerIcon}
              label="Time per attempt"
              value={`${exam.durationMinutes} minutes`}
            />
            <DetailRow
              icon={ListChecksIcon}
              label="Questions and marks"
              value={`${exam.questionCount} questions · ${exam.maxMarks} marks · pass ${exam.passMarks}`}
            />
            {exam.venue ? (
              <DetailRow icon={MapPinIcon} label="Venue" value={exam.venue} />
            ) : null}
            <DetailRow
              icon={ClockIcon}
              label="Results visibility"
              value={
                LECTURER_EXAM_RESULTS_VISIBILITY_LABELS[exam.resultsVisibility]
              }
            />
            {exam.resultsReleasedOn ? (
              <DetailRow
                icon={CheckCircle2Icon}
                label="Results released"
                value={formatDisplayDate(exam.resultsReleasedOn)}
              />
            ) : null}
          </div>

          <Separator />

          {exam.mode === "online_mcq" ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Attempts</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatBox label="Enrolled" value={exam.enrolledCount} />
                <StatBox label="Submitted" value={exam.attemptsSubmitted} />
                <StatBox label="In progress" value={exam.attemptsInProgress} />
                <StatBox label="Not started" value={notStarted} />
              </div>
              <p className="text-xs text-muted-foreground">
                {exam.maxAttempts}{" "}
                {exam.maxAttempts === 1 ? "attempt" : "attempts"} allowed per
                student. Attempt data is sample information only.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Paper exam</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatBox label="Enrolled" value={exam.enrolledCount} />
                <StatBox label="Questions" value={exam.questionCount} />
              </div>
              <p className="text-xs text-muted-foreground">
                Paper exams remain information-only. No scripts, scans or marks
                are created in this demo.
              </p>
            </div>
          )}

          {onlineUnavailable ? (
            <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              Online exam features are disabled in this demo. Scheduling and
              paper information remain available.
            </p>
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            {locked ? (
              <LockKeyholeIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <p>
              {locked
                ? "This published online snapshot is immutable. Editing the question bank cannot change this exam."
                : exam.mode === "online_mcq"
                  ? "The question snapshot will lock when this online exam is published. Nothing is published from this demo."
                  : "Paper details are read-only in this demo. No marks or grades are recorded."}
            </p>
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function ExamEditorDialog({
  exam,
  onlineExamsEnabled,
  onOpenChange,
  onSave,
}: {
  exam: LecturerExam | null
  onlineExamsEnabled: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: ExamFormValues) => void
}) {
  const [form, setForm] = useState<ExamFormState>(() =>
    createExamFormState(exam ?? undefined, onlineExamsEnabled)
  )
  const [error, setError] = useState<string | null>(null)

  const selectedCourse = getLecturerCourseById(form.courseId)
  const modeChoices = onlineExamsEnabled
    ? modeOptions
    : modeOptions.filter((option) => option.value !== "online_mcq")

  function updateForm(patch: Partial<ExamFormState>) {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = form.title.trim()
    const durationMinutes = Number.parseInt(form.durationMinutes, 10)
    const maxAttempts =
      form.mode === "online_mcq" ? Number.parseInt(form.maxAttempts, 10) : 1
    const questionCount = Number.parseInt(form.questionCount, 10)
    const maxMarks = Number.parseInt(form.maxMarks, 10)
    const passMarks = Number.parseInt(form.passMarks, 10)

    if (!title) {
      setError("Add a title for this exam.")
      return
    }
    if (!form.courseId || !selectedCourse) {
      setError("Choose one of your courses for this exam.")
      return
    }
    if (form.mode === "online_mcq" && !onlineExamsEnabled) {
      setError("Online exams are disabled in this demo.")
      return
    }
    if (!form.date || !form.startsAt || !form.endsAt) {
      setError("Add the exam date and its start and end times.")
      return
    }
    if (form.startsAt >= form.endsAt) {
      setError("The exam end time must be later than its start time.")
      return
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      setError("Time per attempt must be at least 1 minute.")
      return
    }
    if (
      form.mode === "online_mcq" &&
      (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 5)
    ) {
      setError("Attempts allowed must be between 1 and 5.")
      return
    }
    if (!Number.isFinite(questionCount) || questionCount < 1) {
      setError("Add at least one question to the exam.")
      return
    }
    if (!Number.isFinite(maxMarks) || maxMarks < 1) {
      setError("Maximum marks must be greater than zero.")
      return
    }
    if (!Number.isFinite(passMarks) || passMarks < 1 || passMarks > maxMarks) {
      setError("Pass marks must be between 1 and the maximum marks.")
      return
    }

    onSave({
      title,
      courseId: form.courseId,
      mode: form.mode,
      date: form.date,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      durationMinutes,
      maxAttempts,
      questionCount,
      maxMarks,
      passMarks,
      resultsVisibility: form.resultsVisibility,
      venue:
        form.venue.trim() ||
        (form.mode === "online_mcq"
          ? "Online exam window"
          : `${selectedCourse.branch} · venue to confirm`),
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="rounded-full">
              {exam ? "Local edit" : "New local draft"}
            </Badge>
            {exam ? (
              <LecturerExamStatusBadge status={exam.status} />
            ) : (
              <LecturerExamStatusBadge status="draft" />
            )}
          </div>
          <DialogTitle className="text-lg">
            {exam ? "Edit exam draft" : "New exam draft"}
          </DialogTitle>
          <DialogDescription>
            {exam
              ? "Changes update this page's local copy only. Nothing is re-published, graded or saved."
              : "New exams stay as local drafts. Nothing is published, graded or saved."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-title">Title</Label>
            <Input
              id="exam-title"
              value={form.title}
              onChange={(event) => updateForm({ title: event.target.value })}
              placeholder="e.g. Grade 8 fractions quiz"
              maxLength={120}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-course">Course</Label>
            <Select
              items={lecturerCourses.map((course) => ({
                value: course.id,
                label: `${course.name} · ${course.branch}`,
              }))}
              value={form.courseId}
              onValueChange={(value) => updateForm({ courseId: value ?? "" })}
            >
              <SelectTrigger id="exam-course" className="w-full">
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
            <p className="text-xs text-muted-foreground">
              {selectedCourse
                ? `${selectedCourse.subject} · ${selectedCourse.branch} branch · ${selectedCourse.enrolledCount} enrolled`
                : "Choose one of your courses."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-mode">Mode</Label>
            <Select
              items={modeChoices}
              value={form.mode}
              onValueChange={(value) =>
                updateForm({ mode: (value as ExamMode) ?? "paper" })
              }
            >
              <SelectTrigger id="exam-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modeChoices.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.mode === "online_mcq"
                ? "Online MCQ exams can use the question bank. Snapshots lock when published."
                : "Paper exams keep schedule and venue information only. No online attempts or snapshots."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-date">Date</Label>
              <Input
                id="exam-date"
                type="date"
                value={form.date}
                onChange={(event) => updateForm({ date: event.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-start">Starts</Label>
              <Input
                id="exam-start"
                type="time"
                value={form.startsAt}
                onChange={(event) =>
                  updateForm({ startsAt: event.target.value })
                }
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-end">Ends</Label>
              <Input
                id="exam-end"
                type="time"
                value={form.endsAt}
                onChange={(event) => updateForm({ endsAt: event.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-duration">Minutes per attempt</Label>
              <Input
                id="exam-duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                step={1}
                value={form.durationMinutes}
                onChange={(event) =>
                  updateForm({ durationMinutes: event.target.value })
                }
                required
              />
            </div>
            {form.mode === "online_mcq" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exam-attempts">Attempts allowed</Label>
                <Input
                  id="exam-attempts"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  step={1}
                  value={form.maxAttempts}
                  onChange={(event) =>
                    updateForm({ maxAttempts: event.target.value })
                  }
                  required
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Attempts allowed</Label>
                <div className="flex h-8 items-center rounded-md border bg-muted/40 px-2.5 text-sm text-muted-foreground">
                  One paper sitting
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-questions">Questions</Label>
              <Input
                id="exam-questions"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.questionCount}
                onChange={(event) =>
                  updateForm({ questionCount: event.target.value })
                }
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-max-marks">Max marks</Label>
              <Input
                id="exam-max-marks"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.maxMarks}
                onChange={(event) =>
                  updateForm({ maxMarks: event.target.value })
                }
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-pass-marks">Pass marks</Label>
              <Input
                id="exam-pass-marks"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.passMarks}
                onChange={(event) =>
                  updateForm({ passMarks: event.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-results-visibility">Results visibility</Label>
            <Select
              items={resultsVisibilityOptions}
              value={form.resultsVisibility}
              onValueChange={(value) =>
                updateForm({
                  resultsVisibility:
                    (value as LecturerExamResultsVisibility) ?? "after_close",
                })
              }
            >
              <SelectTrigger id="exam-results-visibility" className="w-full">
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
            <p className="text-xs text-muted-foreground">
              Visibility is a local setting only. No results are released from
              this demo.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-venue">
              {form.mode === "online_mcq" ? "Online window note" : "Venue"}
            </Label>
            <Input
              id="exam-venue"
              value={form.venue}
              onChange={(event) => updateForm({ venue: event.target.value })}
              placeholder={
                form.mode === "online_mcq"
                  ? "Online exam window"
                  : "e.g. Room 3B, Colombo"
              }
              maxLength={120}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <LockKeyholeIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              Published online question snapshots are immutable. Saving here
              updates only the local draft summary and never changes a published
              snapshot, grade or result.
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
              {exam ? "Update local draft" : "Add local draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/30 p-2">
      <span className="text-lg leading-none font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
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
  tone: "neutral" | "amber" | "sky"
}) {
  const toneClasses = {
    neutral: "border-border bg-muted/30 text-foreground",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
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
