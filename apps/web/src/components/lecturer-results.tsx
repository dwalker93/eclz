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
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  AwardIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  LockKeyholeIcon,
  MonitorIcon,
  PencilIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  ShieldAlertIcon,
  TrophyIcon,
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
  getLecturerExamById,
  LECTURER_EXAM_RESULTS_VISIBILITY_LABELS,
  LECTURER_RESULT_ATTEMPT_LABELS,
  lecturer,
  lecturerExams,
  lecturerModules,
  lecturerResults,
  type LecturerExam,
  type LecturerResultAttemptStatus,
  type LecturerResultRecord,
} from "@/lib/lecturer-portal-data"
import { formatDisplayDate, formatShortDate } from "@/lib/student-portal-data"

type ResultRowFilter =
  "all" | LecturerResultAttemptStatus | "entered" | "not_entered"

type PaperEntryValues = {
  score: number
  grade: string | null
  remarks: string | null
  reason?: string
}

const onlineRowFilters: Array<{ value: ResultRowFilter; label: string }> = [
  { value: "all", label: "All students" },
  { value: "submitted", label: "Submitted" },
  { value: "in_progress", label: "In progress" },
  { value: "not_started", label: "Not started" },
]

const paperRowFilters: Array<{ value: ResultRowFilter; label: string }> = [
  { value: "all", label: "All students" },
  { value: "entered", label: "Marks entered" },
  { value: "not_entered", label: "Not entered" },
]

const gradeOptions = [
  { value: "none", label: "Not set" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "S", label: "S" },
  { value: "F", label: "F" },
]

const resultExamIds = new Set(lecturerResults.map((result) => result.examId))
const resultExams = lecturerExams
  .filter((exam) => resultExamIds.has(exam.id))
  .filter((exam) => lecturerModules.onlineExams || exam.mode === "paper")
  .sort((first, second) => second.date.localeCompare(first.date))

function getExamForResult(result: LecturerResultRecord) {
  return getLecturerExamById(result.examId)
}

function resultValuesEqual(
  first: LecturerResultRecord,
  second: LecturerResultRecord
) {
  return (
    first.score === second.score &&
    first.grade === second.grade &&
    first.remarks === second.remarks &&
    first.state === second.state &&
    first.releasedOn === second.releasedOn &&
    (first.lastEditReason ?? "") === (second.lastEditReason ?? "")
  )
}

function rowMatchesFilter(
  result: LecturerResultRecord,
  filter: ResultRowFilter
) {
  if (filter === "all") return true
  if (filter === "entered") return result.score !== null
  if (filter === "not_entered") return result.score === null
  return result.attemptStatus === filter
}

export function LecturerResults() {
  const [results, setResults] = useState<LecturerResultRecord[]>(() => [
    ...lecturerResults,
  ])
  const [selectedExamId, setSelectedExamId] = useState(
    () => resultExams[0]?.id ?? ""
  )
  const [query, setQuery] = useState("")
  const [rowFilter, setRowFilter] = useState<ResultRowFilter>("all")
  const [previewResultId, setPreviewResultId] = useState<string | null>(null)

  const selectedExam =
    lecturerExams.find((exam) => exam.id === selectedExamId) ??
    resultExams[0] ??
    null
  const selectedCourse = selectedExam
    ? getLecturerCourseById(selectedExam.courseId)
    : null
  const examResults = useMemo(
    () =>
      results.filter(
        (result) => result.examId === (selectedExam?.id ?? selectedExamId)
      ),
    [results, selectedExam?.id, selectedExamId]
  )

  const filteredResults = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase()

    return examResults.filter((result) => {
      if (!rowMatchesFilter(result, rowFilter)) return false
      if (!normalisedQuery) return true

      return (
        result.studentName.toLowerCase().includes(normalisedQuery) ||
        result.studentNo.toLowerCase().includes(normalisedQuery)
      )
    })
  }, [examResults, query, rowFilter])

  const localChangeCount = useMemo(
    () =>
      results.reduce((count, result) => {
        const original = lecturerResults.find(
          (candidate) => candidate.id === result.id
        )

        if (!original) return count + 1

        return resultValuesEqual(original, result) ? count : count + 1
      }, 0),
    [results]
  )

  const summary = useMemo(() => {
    const visibleResults = results.filter(
      (result) =>
        lecturerModules.onlineExams ||
        getExamForResult(result)?.mode === "paper"
    )
    const paperPending = visibleResults.filter((result) => {
      const exam = getExamForResult(result)
      return exam?.mode === "paper" && result.score === null
    }).length

    return {
      total: visibleResults.length,
      provisional: visibleResults.filter(
        (result) => result.state === "provisional"
      ).length,
      released: visibleResults.filter((result) => result.state === "released")
        .length,
      paperPending,
    }
  }, [results])

  const examCounts = useMemo(() => {
    if (selectedExam?.mode === "paper") {
      const entered = examResults.filter(
        (result) => result.score !== null
      ).length

      return {
        entered,
        notEntered: examResults.length - entered,
        submitted: 0,
        inProgress: 0,
        notStarted: 0,
      }
    }

    return {
      entered: 0,
      notEntered: 0,
      submitted: examResults.filter(
        (result) => result.attemptStatus === "submitted"
      ).length,
      inProgress: examResults.filter(
        (result) => result.attemptStatus === "in_progress"
      ).length,
      notStarted: examResults.filter(
        (result) => result.attemptStatus === "not_started"
      ).length,
    }
  }, [examResults, selectedExam?.mode])

  const previewResult =
    results.find((result) => result.id === previewResultId) ?? null
  const previewExam = previewResult ? getExamForResult(previewResult) : null
  const rowFilters =
    selectedExam?.mode === "paper" ? paperRowFilters : onlineRowFilters
  const hasFilters = query.trim() !== "" || rowFilter !== "all"

  function handleExamChange(value: string | null) {
    setSelectedExamId(value ?? "")
    setRowFilter("all")
    setQuery("")
  }

  function clearFilters() {
    setQuery("")
    setRowFilter("all")
  }

  function resetLocalChanges() {
    setResults([...lecturerResults])
    setPreviewResultId(null)
  }

  function savePaperEntry(resultId: string, values: PaperEntryValues) {
    setResults((current) =>
      current.map((result) => {
        if (result.id !== resultId) return result

        const wasReleased = result.state === "released"

        return {
          ...result,
          score: values.score,
          grade: values.grade,
          remarks: values.remarks,
          state: wasReleased ? "released" : "provisional",
          releasedOn: wasReleased ? result.releasedOn : undefined,
          lastEditReason: wasReleased ? values.reason : undefined,
        }
      })
    )
    setPreviewResultId(null)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Results"
          description="Results for your own exams and courses. Online results are attempt-derived samples; paper marks, grades and remarks use a local entry preview. Nothing is graded, released or saved."
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
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <AwardIcon aria-hidden="true" />
              {resultExams.length} exams with results
            </Badge>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile
            icon={AwardIcon}
            label="Result rows"
            value={summary.total}
            tone="neutral"
          />
          <SummaryTile
            icon={ClockIcon}
            label="Provisional"
            value={summary.provisional}
            tone="amber"
          />
          <SummaryTile
            icon={CheckCircle2Icon}
            label="Released"
            value={summary.released}
            tone="emerald"
          />
          <SummaryTile
            icon={FileTextIcon}
            label="Paper pending entry"
            value={summary.paperPending}
            tone="sky"
          />
        </div>

        {!lecturerModules.onlineExams ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-xs text-amber-800 sm:p-4 dark:text-amber-300">
            <MonitorIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              Online exams are disabled in this demo, so attempt-derived online
              results are hidden. Paper entry previews remain available.
            </p>
          </div>
        ) : null}

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
                  Paper entries update this page only. Nothing is graded,
                  released or saved.
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
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Exam
                </CardTitle>
                <CardDescription>
                  Choose one of your exams with recorded results.
                </CardDescription>
              </div>
              {selectedExam ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <ExamModeBadge mode={selectedExam.mode} />
                  <LecturerExamStatusBadge status={selectedExam.status} />
                  <ExamResultStateBadge state={selectedExam.resultsState} />
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="flex max-w-xl flex-col gap-1.5">
              <label
                htmlFor="lecturer-results-exam"
                className="text-xs font-medium text-muted-foreground"
              >
                Exam
              </label>
              <Select
                items={resultExams.map((exam) => ({
                  value: exam.id,
                  label: `${exam.title} · ${formatShortDate(exam.date)}`,
                }))}
                value={selectedExam?.id ?? ""}
                onValueChange={handleExamChange}
              >
                <SelectTrigger id="lecturer-results-exam" className="w-full">
                  <CalendarDaysIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resultExams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title} · {formatShortDate(exam.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedExam ? (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {selectedCourse?.name ?? selectedExam.courseName} ·{" "}
                    {selectedCourse?.branch ?? "Branch"}
                  </span>
                  <span>{formatDisplayDate(selectedExam.date)}</span>
                  <span>{selectedExam.maxMarks} marks</span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {selectedExam.mode === "online_mcq" ? (
                    <>
                      <StatBox label="Submitted" value={examCounts.submitted} />
                      <StatBox
                        label="In progress"
                        value={examCounts.inProgress}
                      />
                      <StatBox
                        label="Not started"
                        value={examCounts.notStarted}
                      />
                      <StatBox label="Students" value={examResults.length} />
                    </>
                  ) : (
                    <>
                      <StatBox
                        label="Marks entered"
                        value={examCounts.entered}
                      />
                      <StatBox
                        label="Not entered"
                        value={examCounts.notEntered}
                      />
                      <StatBox label="Students" value={examResults.length} />
                      <StatBox
                        label="Released rows"
                        value={
                          examResults.filter(
                            (result) => result.state === "released"
                          ).length
                        }
                      />
                    </>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p>
                    Results visibility:{" "}
                    <span className="text-foreground">
                      {
                        LECTURER_EXAM_RESULTS_VISIBILITY_LABELS[
                          selectedExam.resultsVisibility
                        ]
                      }
                    </span>
                  </p>
                  <p>
                    {selectedExam.resultsReleasedOn
                      ? `Released ${formatDisplayDate(
                          selectedExam.resultsReleasedOn
                        )}.`
                      : "Not released. Provisional and pending rows are local samples."}
                  </p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <AwardIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Students
                </CardTitle>
                <CardDescription>
                  {selectedExam?.title ?? "No exam selected"}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {filteredResults.length} of {examResults.length} shown
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="flex max-w-md flex-col gap-1.5">
                <Label htmlFor="lecturer-results-search">Search students</Label>
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="lecturer-results-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name or student number"
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                >
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            </div>

            <div
              role="group"
              aria-label="Filter students"
              className="flex w-fit flex-wrap gap-1 rounded-lg border p-1"
            >
              {rowFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={rowFilter === filter.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setRowFilter(filter.value)}
                  aria-pressed={rowFilter === filter.value}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {filteredResults.length === 0 ? (
              <EmptyState
                icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                title="No matching results"
                description={
                  examResults.length === 0
                    ? "This exam does not have result rows yet."
                    : "Try another student name or filter. Clear the filters to see all students."
                }
              />
            ) : (
              <div className="rounded-lg border">
                <div className="hidden grid-cols-[minmax(0,1fr)_140px_110px_130px_110px] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Student</span>
                  <span>
                    {selectedExam?.mode === "paper" ? "Entry" : "Attempt"}
                  </span>
                  <span>Score</span>
                  <span>Result</span>
                  <span className="text-right">Action</span>
                </div>
                <ul className="divide-y">
                  {filteredResults.map((result) => {
                    const exam = getExamForResult(result)
                    const isPaper = exam?.mode === "paper"
                    const entered = result.score !== null

                    return (
                      <li
                        key={result.id}
                        className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_140px_110px_130px_110px] md:items-center md:gap-3"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">
                            {result.studentName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {result.studentNo}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground md:hidden">
                            {isPaper ? "Entry" : "Attempt"}
                          </span>
                          {isPaper ? (
                            <PaperEntryBadge entered={entered} />
                          ) : result.attemptStatus ? (
                            <AttemptStatusBadge status={result.attemptStatus} />
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground md:hidden">
                            Score
                          </span>
                          {entered ? (
                            <span className="text-sm font-medium tabular-nums">
                              {result.score} / {result.maxMarks}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No score
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground md:hidden">
                            Result
                          </span>
                          <ExamResultStateBadge state={result.state} />
                        </div>

                        <div className="flex md:justify-end">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setPreviewResultId(result.id)}
                          >
                            {isPaper ? (
                              <PencilIcon
                                data-icon="inline-start"
                                aria-hidden="true"
                              />
                            ) : (
                              <AwardIcon
                                data-icon="inline-start"
                                aria-hidden="true"
                              />
                            )}
                            {isPaper
                              ? entered
                                ? "Edit entry"
                                : "Enter marks"
                              : "View result"}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Only students in {selectedCourse?.name ?? "the selected course"} are
            shown. Online results are attempt-derived samples; paper entries are
            local previews.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page is limited to {lecturer.fullName}&apos;s own exams and
              courses. Online attempt status and scores are sample values. Paper
              marks, grades and remarks are local entry previews only — no
              grading, result calculation, release or audit persistence is
              implemented.
            </p>
          </CardContent>
        </Card>
      </div>

      {previewResult && previewExam ? (
        <ResultDetailDialog
          key={`${previewResult.id}-${previewResult.score}-${previewResult.state}`}
          result={previewResult}
          exam={previewExam}
          courseName={
            getLecturerCourseById(previewExam.courseId)?.name ??
            previewExam.courseName
          }
          branch={getLecturerCourseById(previewExam.courseId)?.branch ?? null}
          onOpenChange={(open) => {
            if (!open) setPreviewResultId(null)
          }}
          onSavePaperEntry={(values) =>
            savePaperEntry(previewResult.id, values)
          }
        />
      ) : null}
    </main>
  )
}

function ResultDetailDialog({
  result,
  exam,
  courseName,
  branch,
  onOpenChange,
  onSavePaperEntry,
}: {
  result: LecturerResultRecord
  exam: LecturerExam
  courseName: string
  branch: string | null
  onOpenChange: (open: boolean) => void
  onSavePaperEntry: (values: PaperEntryValues) => void
}) {
  const isPaper = exam.mode === "paper"
  const isReleased = result.state === "released"
  const [marks, setMarks] = useState(
    result.score !== null ? String(result.score) : ""
  )
  const [grade, setGrade] = useState(result.grade ?? "none")
  const [remarks, setRemarks] = useState(result.remarks ?? "")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const submittedAt = result.submittedAt

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedMarks = Number.parseInt(marks, 10)

    if (
      !Number.isFinite(parsedMarks) ||
      parsedMarks < 0 ||
      parsedMarks > result.maxMarks
    ) {
      setError(`Marks must be between 0 and ${result.maxMarks}.`)
      return
    }
    if (isReleased && !reason.trim()) {
      setError(
        "Add a reason before changing a released paper result in this preview."
      )
      return
    }

    onSavePaperEntry({
      score: parsedMarks,
      grade: grade === "none" ? null : grade,
      remarks: remarks.trim() || null,
      reason: isReleased ? reason.trim() : undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <ExamModeBadge mode={exam.mode} />
            {isPaper ? (
              <PaperEntryBadge entered={result.score !== null} />
            ) : result.attemptStatus ? (
              <AttemptStatusBadge status={result.attemptStatus} />
            ) : null}
            <ExamResultStateBadge state={result.state} />
          </div>
          <DialogTitle className="text-lg">{result.studentName}</DialogTitle>
          <DialogDescription>
            {exam.title} · {courseName}
            {branch ? ` · ${branch}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isPaper ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="result-marks">Marks</Label>
                <Input
                  id="result-marks"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={result.maxMarks}
                  step={1}
                  value={marks}
                  onChange={(event) => {
                    setMarks(event.target.value)
                    setError(null)
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Out of {result.maxMarks}. No marks are calculated or saved.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="result-grade">Grade</Label>
                <Select
                  items={gradeOptions}
                  value={grade}
                  onValueChange={(value) => {
                    setGrade(value ?? "none")
                    setError(null)
                  }}
                >
                  <SelectTrigger id="result-grade" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Grade is entered manually in this preview.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="result-remarks">Remarks</Label>
              <Textarea
                id="result-remarks"
                value={remarks}
                onChange={(event) => {
                  setRemarks(event.target.value)
                  setError(null)
                }}
                placeholder="Optional remarks for this paper result."
                rows={2}
                maxLength={300}
              />
            </div>

            {isReleased ? (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlertIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>
                    This paper result is already released. In a live system,
                    editing it would require a reason and create an audit entry.
                    Nothing is saved here.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="result-reason">Reason for change</Label>
                  <Textarea
                    id="result-reason"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                      setError(null)
                    }}
                    placeholder="Required for this released-result preview."
                    rows={2}
                    maxLength={200}
                  />
                </div>
              </div>
            ) : (
              <p className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Provisional paper entry preview. No grading, release or audit
                record is created.
              </p>
            )}

            {result.lastEditReason ? (
              <p className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                Last local edit reason: {result.lastEditReason}
              </p>
            ) : null}

            <div className="grid gap-2 text-xs text-muted-foreground">
              <span>Student number: {result.studentNo}</span>
              <span>Exam date: {formatDisplayDate(exam.date)}</span>
              {exam.resultsReleasedOn ? (
                <span>
                  Exam released: {formatDisplayDate(exam.resultsReleasedOn)}
                </span>
              ) : null}
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
                {isReleased ? "Preview released edit" : "Update local preview"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <div className="grid gap-3 text-sm">
              <DetailRow
                icon={BookOpenIcon}
                label="Course"
                value={`${courseName}${branch ? ` · ${branch}` : ""}`}
              />
              <DetailRow
                icon={CalendarDaysIcon}
                label="Exam date"
                value={formatDisplayDate(exam.date)}
              />
              <DetailRow
                icon={MonitorIcon}
                label="Attempt status"
                value={
                  result.attemptStatus
                    ? LECTURER_RESULT_ATTEMPT_LABELS[result.attemptStatus]
                    : "Not recorded"
                }
              />
              {submittedAt ? (
                <DetailRow
                  icon={ClockIcon}
                  label="Submitted"
                  value={formatDisplayDate(submittedAt)}
                />
              ) : null}
              <DetailRow
                icon={TrophyIcon}
                label="Score"
                value={
                  result.score !== null
                    ? `${result.score} / ${result.maxMarks}`
                    : "No submitted attempt"
                }
              />
              {result.grade ? (
                <DetailRow
                  icon={AwardIcon}
                  label="Grade"
                  value={result.grade}
                />
              ) : null}
              {result.remarks ? (
                <DetailRow
                  icon={FileTextIcon}
                  label="Remarks"
                  value={result.remarks}
                />
              ) : null}
            </div>

            <Separator />

            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              {isReleased ? (
                <LockKeyholeIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              )}
              <p>
                {isReleased
                  ? `Released ${formatDisplayDate(
                      result.releasedOn ?? exam.resultsReleasedOn ?? exam.date
                    )}. Online results are attempt-derived and read-only in this preview.`
                  : "Online results are attempt-derived and provisional in this demo. No grading or release is implemented."}
              </p>
            </div>

            <DialogFooter showCloseButton />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AttemptStatusBadge({
  status,
}: {
  status: LecturerResultAttemptStatus
}) {
  const config = {
    submitted: {
      icon: CheckCircle2Icon,
      className:
        "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    },
    in_progress: {
      icon: ClockIcon,
      className:
        "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
    },
    not_started: {
      icon: InfoIcon,
      className: "border-border bg-muted/60 text-muted-foreground",
    },
  }[status]

  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 rounded-full", config.className)}
    >
      <Icon aria-hidden="true" />
      {LECTURER_RESULT_ATTEMPT_LABELS[status]}
    </Badge>
  )
}

function PaperEntryBadge({ entered }: { entered: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-full",
        entered
          ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
          : "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
      )}
    >
      {entered ? (
        <CheckCircle2Icon aria-hidden="true" />
      ) : (
        <PencilIcon aria-hidden="true" />
      )}
      {entered ? "Marks entered" : "Not entered"}
    </Badge>
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
