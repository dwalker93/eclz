"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  AwardIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckCheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"

import {
  ExamControlDialog,
  type ExamControlMode,
} from "@/components/results/exam-control-dialog"
import {
  EnterMarksDialog,
  type MarksEntryDraft,
} from "@/components/results/enter-marks-dialog"
import { ResultDetailSheet } from "@/components/results/result-detail-sheet"
import {
  ExamStatusBadge,
  ReleaseStateBadge,
  ResultSourceBadge,
} from "@/components/results/result-status-badge"
import {
  RESULTS_MOCK_NOW,
  canCloseExam,
  canReleaseResults,
  examBranchFilterOptions,
  examCourseOptions,
  examModeLabels,
  examReleaseFilterOptions,
  examScoringLabels,
  examSourceFilterOptions,
  exams,
  examVisibilityLabels,
  getDefaultExamId,
  getExamResultRows,
  getExamUsage,
  gradeFromPercentage,
  type ExamRecord,
  type ExamResultRecord,
  type ExamResultRow,
  type ExamStatus,
  type ReleaseState,
  type ResultSource,
} from "@/lib/results-data"
import {
  formatDateTime,
  formatDisplayDate,
  getInitials,
} from "@/lib/students-data"

/** Local, session-only edit of a result. Cleared when the page is reloaded. */
type ResultOverride = {
  marks: number
  remarks: string | null
  source: ResultSource
  reason: string | null
  releasedAt: string | null
  updatedAt: string
}

export function ResultsDirectory() {
  const [examId, setExamId] = useState(getDefaultExamId())
  const [examStatusOverrides, setExamStatusOverrides] = useState<
    Record<string, ExamStatus>
  >({})
  const [resultOverrides, setResultOverrides] = useState<
    Record<string, ResultOverride>
  >({})

  const [search, setSearch] = useState("")
  const [courseFilter, setCourseFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [releaseFilter, setReleaseFilter] = useState("all")

  const [selected, setSelected] = useState<ExamResultRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [marksOpen, setMarksOpen] = useState(false)
  const [marksRow, setMarksRow] = useState<ExamResultRow | null>(null)
  const [controlMode, setControlMode] = useState<ExamControlMode | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Results refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const resolvedExam = useMemo(() => {
    const base = exams.find((exam) => exam.id === examId) ?? exams[0] ?? null
    if (!base) return null
    const statusOverride = examStatusOverrides[base.id]
    return statusOverride ? { ...base, status: statusOverride } : base
  }, [examId, examStatusOverrides])

  const baseRows = useMemo(
    () => (resolvedExam ? getExamResultRows(resolvedExam) : []),
    [resolvedExam]
  )

  // Fold any local edits onto the sample rows so the table stays coherent.
  const rows = useMemo<ExamResultRow[]>(() => {
    if (!resolvedExam) return []

    return baseRows.map((row) => {
      const override = resultOverrides[row.key]
      if (!override) return row

      const percentage =
        resolvedExam.maxMarks > 0
          ? (override.marks / resolvedExam.maxMarks) * 100
          : 0

      const result: ExamResultRecord = {
        id: row.result?.id ?? `res-${row.key}`,
        examId: resolvedExam.id,
        studentId: row.studentId,
        enrollmentId: row.result?.enrollmentId ?? null,
        courseId: row.result?.courseId ?? row.courseId,
        attemptId: row.result?.attemptId ?? row.countedAttempt?.id ?? null,
        marks: override.marks,
        maxMarks: resolvedExam.maxMarks,
        percentage,
        grade: gradeFromPercentage(percentage),
        remarks: override.remarks,
        source: override.source,
        releasedAt: override.releasedAt,
        updatedAt: override.updatedAt,
      }

      const releaseState: ReleaseState = override.releasedAt
        ? "released"
        : "provisional"

      return { ...row, result, releaseState }
    })
  }, [baseRows, resultOverrides, resolvedExam])

  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    courseFilter !== "all" ||
    branchFilter !== "all" ||
    sourceFilter !== "all" ||
    releaseFilter !== "all"

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (courseFilter !== "all" && row.courseId !== courseFilter) return false
      if (branchFilter !== "all" && row.branchName !== branchFilter)
        return false
      if (sourceFilter !== "all" && row.result?.source !== sourceFilter) {
        return false
      }
      if (releaseFilter !== "all" && row.releaseState !== releaseFilter) {
        return false
      }

      if (query.length === 0) return true

      return [
        row.studentName,
        row.studentNo,
        row.courseName ?? "",
        row.branchName,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [rows, courseFilter, branchFilter, sourceFilter, releaseFilter, query])

  const usage = resolvedExam ? getExamUsage(resolvedExam, rows) : null
  const canClose = resolvedExam ? canCloseExam(resolvedExam) : false
  const canRelease = resolvedExam
    ? canReleaseResults(resolvedExam, rows)
    : false

  const courseFilterOptions = useMemo(
    () => [{ value: "all", label: "All courses" }, ...examCourseOptions],
    []
  )

  const selectedRow = selected
    ? (rows.find((row) => row.key === selected.key) ?? selected)
    : null
  const activeMarksRow = marksRow
    ? (rows.find((row) => row.key === marksRow.key) ?? marksRow)
    : null

  function clearFilters() {
    setSearch("")
    setCourseFilter("all")
    setBranchFilter("all")
    setSourceFilter("all")
    setReleaseFilter("all")
  }

  function handleExamChange(value: string) {
    setExamId(value)
    setSelected(null)
    setDetailOpen(false)
  }

  function openDetail(row: ExamResultRow) {
    setSelected(row)
    setDetailOpen(true)
  }

  function openMarks(row: ExamResultRow) {
    setSelected(null)
    setDetailOpen(false)
    setMarksRow(row)
    setMarksOpen(true)
  }

  function handleMarksSubmit(draft: MarksEntryDraft) {
    if (!activeMarksRow || !resolvedExam) return

    setResultOverrides((previous) => ({
      ...previous,
      [activeMarksRow.key]: {
        marks: draft.marks,
        remarks: draft.remarks,
        source: draft.source,
        reason: draft.reason,
        releasedAt: activeMarksRow.result?.releasedAt ?? null,
        updatedAt: RESULTS_MOCK_NOW,
      },
    }))

    const wasReleased = activeMarksRow.result?.releasedAt != null
    setNotice(
      wasReleased
        ? `${activeMarksRow.studentName}'s released result was edited and an audit reason was recorded. Local demo only — nothing was saved.`
        : `Result for ${activeMarksRow.studentName} updated to ${draft.marks} / ${
            resolvedExam.maxMarks
          }. Local demo only — nothing was saved.`
    )
    setMarksOpen(false)
    setMarksRow(null)
  }

  function handleControlConfirm(mode: ExamControlMode, exam: ExamRecord) {
    if (mode === "close") {
      setExamStatusOverrides((previous) => ({
        ...previous,
        [exam.id]: "closed",
      }))
      setNotice(
        `“${exam.title}” is now closed for this session, so results can be released. Local demo only — nothing was saved.`
      )
      return
    }

    const releasable = rows.filter(
      (row) => row.result !== null && row.releaseState !== "released"
    )

    setResultOverrides((previous) => {
      const next = { ...previous }

      releasable.forEach((row) => {
        if (!row.result) return
        next[row.key] = {
          marks: row.result.marks,
          remarks: row.result.remarks,
          source: row.result.source,
          reason: previous[row.key]?.reason ?? null,
          releasedAt: RESULTS_MOCK_NOW,
          updatedAt: RESULTS_MOCK_NOW,
        }
      })

      return next
    })

    setNotice(
      `Released ${releasable.length} ${
        releasable.length === 1 ? "result" : "results"
      } for “${exam.title}” in this session view. Local demo only — nothing was saved.`
    )
  }

  async function copyStudentNo(row: ExamResultRow) {
    try {
      await navigator.clipboard.writeText(row.studentNo)
      setNotice(`${row.studentNo} copied to the clipboard.`)
    } catch {
      setNotice(`Student number: ${row.studentNo}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Result workspace built from <code>exam_result</code>,{" "}
              <code>exam_attempt</code> and <code>attempt_answer</code>. Select
              an exam, then review or preview-entering marks. Nothing on this
              page is saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRefreshing(true)}
              disabled={isRefreshing}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Exam</span>
              <span className="text-xs text-muted-foreground">
                Results are scoped to one exam; its courses and branches set the
                candidate set.
              </span>
            </div>

            <Select
              items={exams.map((exam) => ({
                value: exam.id,
                label: exam.title,
              }))}
              value={resolvedExam?.id ?? null}
              onValueChange={(value) => handleExamChange(value ?? "")}
            >
              <SelectTrigger className="w-full" aria-label="Select exam">
                <AwardIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {resolvedExam ? <ExamMeta exam={resolvedExam} /> : null}
          </div>
        </Card>

        {resolvedExam ? (
          <ExamControls
            exam={resolvedExam}
            canClose={canClose}
            canRelease={canRelease}
            unreleased={usage?.provisional ?? 0}
            onClose={() => setControlMode("close")}
            onRelease={() => setControlMode("release")}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<UsersRoundIcon aria-hidden="true" />}
            value={usage?.candidates ?? 0}
            label="Candidates"
            hint="Students attached to this exam"
          />
          <SummaryCard
            icon={<CheckCheckIcon aria-hidden="true" />}
            value={usage?.entered ?? 0}
            label="Results recorded"
            hint={`${usage?.notEntered ?? 0} without marks yet`}
          />
          <SummaryCard
            icon={<ShieldCheckIcon aria-hidden="true" />}
            value={usage?.released ?? 0}
            label="Released"
            hint={`${usage?.provisional ?? 0} provisional`}
          />
          <SummaryCard
            icon={<TrendingUpIcon aria-hidden="true" />}
            value={usage?.average ?? 0}
            label="Average score"
            hint={`High ${usage?.highest ?? 0}% · low ${usage?.lowest ?? 0}%`}
            isPercent
          />
        </div>

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Filters</span>
                <span className="text-xs text-muted-foreground">
                  Filter candidates by course, branch, source or release state.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Reset
              </Button>
            </div>

            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by student or student number"
                aria-label="Search results"
                className="pl-8"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                items={courseFilterOptions}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by course">
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={examBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <Building2Icon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={examSourceFilterOptions}
                value={sourceFilter}
                onValueChange={(value) => setSourceFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examSourceFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={examReleaseFilterOptions}
                value={releaseFilter}
                onValueChange={(value) => setReleaseFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by release state"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examReleaseFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <AwardIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Result register
              </CardTitle>
              <CardDescription>
                {filtered.length} of {rows.length}{" "}
                {rows.length === 1 ? "candidate" : "candidates"}
                {resolvedExam ? ` · ${examModeLabels[resolvedExam.mode]}` : ""}
              </CardDescription>
            </div>
          </CardHeader>

          {isRefreshing ? (
            <ResultsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AwardIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  No candidates match these filters
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different course, branch, source or release state.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <ResultsTable
              rows={filtered}
              maxMarks={resolvedExam?.maxMarks ?? 0}
              onView={openDetail}
              onEnter={openMarks}
              onCopy={copyStudentNo}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Grade is derived from the percentage band (≥75 A, ≥65 B, ≥55 C,
              ≥40 S, else F). Online MCQ marks come from the counted attempt; a
              manual change is stored as an override and keeps the attempt
              unchanged.
            </span>
          </div>
        </Card>
      </div>

      <ResultDetailSheet
        exam={resolvedExam}
        row={selectedRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEnterMarks={openMarks}
      />

      <EnterMarksDialog
        open={marksOpen}
        onOpenChange={setMarksOpen}
        exam={resolvedExam}
        row={activeMarksRow}
        onSubmit={handleMarksSubmit}
      />

      <ExamControlDialog
        mode={controlMode}
        exam={resolvedExam}
        usage={usage}
        onOpenChange={(open) => {
          if (!open) setControlMode(null)
        }}
        onConfirm={handleControlConfirm}
      />
    </main>
  )
}

function ExamMeta({ exam }: { exam: ExamRecord }) {
  const windowLabel =
    exam.mode === "paper"
      ? exam.examDate
        ? formatDisplayDate(exam.examDate)
        : "—"
      : exam.opensAt && exam.closesAt
        ? `${formatDateTime(exam.opensAt)} → ${formatDateTime(exam.closesAt)}`
        : "—"

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ExamStatusBadge status={exam.status} />
        <Badge variant="outline" className="rounded-full">
          {examModeLabels[exam.mode]}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Max {exam.maxMarks}
        </Badge>
        {exam.weight ? (
          <Badge variant="outline" className="rounded-full">
            Weight {exam.weight}%
          </Badge>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label="Owner" value={exam.lecturerName} />
        <MetaField label="Courses" value={exam.courseNames.join(", ")} />
        <MetaField label="Branches" value={exam.branchNames.join(", ")} />
        <MetaField label="Window" value={windowLabel} />
        <MetaField
          label="Scoring"
          value={examScoringLabels[exam.attemptScoring]}
        />
        <MetaField
          label="Result visibility"
          value={examVisibilityLabels[exam.resultsVisibility]}
        />
        {exam.mode === "online_mcq" ? (
          <>
            <MetaField
              label="Time limit"
              value={
                exam.timeLimitMinutes ? `${exam.timeLimitMinutes} minutes` : "—"
              }
            />
            <MetaField
              label="Attempt limit"
              value={exam.maxAttempts ? `${exam.maxAttempts}` : "Unlimited"}
            />
            <MetaField label="Questions" value={`${exam.questions.length}`} />
          </>
        ) : (
          <MetaField
            label="Marking"
            value="Manual entry; grade derived from percentage"
          />
        )}
      </dl>
    </div>
  )
}

function ExamControls({
  exam,
  canClose,
  canRelease,
  unreleased,
  onClose,
  onRelease,
}: {
  exam: ExamRecord
  canClose: boolean
  canRelease: boolean
  unreleased: number
  onClose: () => void
  onRelease: () => void
}) {
  const closeReason = canClose
    ? "The window has passed; closing stops new attempts and unlocks release."
    : exam.status === "closed"
      ? "This exam is already closed."
      : exam.status === "draft"
        ? "Publish the exam before it can be closed."
        : "Available once the open/close window has passed."

  const releaseReason = canRelease
    ? `${unreleased} recorded ${
        unreleased === 1 ? "result is" : "results are"
      } not yet released.`
    : exam.status !== "closed"
      ? "Close the exam first; results can only be released afterwards."
      : "Every recorded result is already released."

  return (
    <Card className="gap-0 py-4">
      <div className="flex flex-col gap-3 px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Exam controls</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={!canClose}>
              <LockIcon data-icon="inline-start" />
              Close exam
            </Button>
            <Button onClick={onRelease} disabled={!canRelease}>
              <SendIcon data-icon="inline-start" />
              Release results
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ControlHint
            icon={<LockIcon />}
            text={closeReason}
            muted={!canClose}
          />
          <ControlHint
            icon={<SendIcon />}
            text={releaseReason}
            muted={!canRelease}
          />
        </div>
      </div>
    </Card>
  )
}

function ControlHint({
  icon,
  text,
  muted,
}: {
  icon: ReactNode
  text: string
  muted: boolean
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span className="mt-0.5 shrink-0 [&>svg]:size-3.5">{icon}</span>
      <span>
        {text}
        {muted ? " Disabled in this state." : ""}
      </span>
    </div>
  )
}

function ResultsTable({
  rows,
  maxMarks,
  onView,
  onEnter,
  onCopy,
}: {
  rows: ExamResultRow[]
  maxMarks: number
  onView: (row: ExamResultRow) => void
  onEnter: (row: ExamResultRow) => void
  onCopy: (row: ExamResultRow) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Student
          </TableHead>
          <TableHead className="text-muted-foreground">
            Course / branch
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Marks / max
          </TableHead>
          <TableHead className="text-muted-foreground">Grade</TableHead>
          <TableHead className="text-muted-foreground">Source</TableHead>
          <TableHead className="text-muted-foreground">Remarks</TableHead>
          <TableHead className="text-muted-foreground">Released</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const result = row.result

          return (
            <TableRow key={row.key}>
              <TableCell className="py-3 pl-4 sm:pl-6">
                <button
                  type="button"
                  onClick={() => onView(row)}
                  className="flex items-center gap-2 text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-muted-foreground">
                    {getInitials(row.studentName)}
                  </span>
                  {row.studentName}
                </button>
                <div className="text-xs text-muted-foreground">
                  {row.studentNo}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  <span>{row.courseName ?? "—"}</span>
                  <span className="text-xs">{row.branchName}</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {result ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-medium">
                      {result.marks} / {maxMarks}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.percentage.toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not entered</span>
                )}
              </TableCell>
              <TableCell>
                {result ? (
                  <Badge variant="outline" className="rounded-full">
                    {result.grade}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {result ? (
                  <ResultSourceBadge source={result.source} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-[200px] text-muted-foreground">
                {result?.remarks ? (
                  <span className="line-clamp-2 text-xs">{result.remarks}</span>
                ) : (
                  <span className="text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <ReleaseStateBadge state={row.releaseState} />
                  {result?.releasedAt ? (
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(result.releasedAt)}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="pr-4 text-right sm:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${row.studentName}`}
                      />
                    }
                  >
                    <EllipsisVerticalIcon
                      className="size-4"
                      aria-hidden="true"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{row.studentName}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(row)}>
                        <EyeIcon aria-hidden="true" />
                        View result & attempts
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEnter(row)}>
                        <PencilIcon aria-hidden="true" />
                        {result ? "Edit result (demo)" : "Enter marks (demo)"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopy(row)}>
                        <CopyIcon aria-hidden="true" />
                        Copy student number
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        <CalendarDaysIcon aria-hidden="true" />
                        {row.attempts.length}{" "}
                        {row.attempts.length === 1 ? "attempt" : "attempts"}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
  isPercent,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
  isPercent?: boolean
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span className="flex items-baseline gap-1 text-2xl font-semibold tabular-nums">
          {value}
          {isPercent ? (
            <span className="text-sm text-muted-foreground">%</span>
          ) : null}
        </span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
