"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"

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
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  Clock3Icon,
  ClockIcon,
  FileCheck2Icon,
  FileTextIcon,
  InfoIcon,
  ListChecksIcon,
  LockKeyholeIcon,
  MapPinIcon,
  MonitorIcon,
  PlayIcon,
  SearchXIcon,
  TimerIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ExamModeBadge,
  ExamResultStateBadge,
} from "@/components/portal-status-badge"
import {
  EXAM_AVAILABILITY_LABELS,
  EXAM_RESULT_STATE_LABELS,
  formatDisplayDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
  getExamAvailability,
  MOCK_TODAY,
  portalModules,
  student,
  studentExams,
  type ExamAvailability,
  type StudentExam,
} from "@/lib/student-portal-data"

type ExamTab = "available" | "in_progress" | "past" | "results"

const examTabs: Array<{ value: ExamTab; label: string }> = [
  { value: "available", label: "Available & upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "past", label: "Past" },
  { value: "results", label: "Results" },
]

const tabDescriptions: Record<ExamTab, string> = {
  available:
    "Exams you can open now or that are coming up. Paper exams are read-only; online MCQ papers open a local preview.",
  in_progress:
    "Attempts that have been started but not submitted. This demo does not save question answers.",
  past: "Exams whose window has closed. Results appear here once they are released.",
  results:
    "Released and provisional marks. Correct answers are never shown in this demo.",
}

const emptyStateCopy: Record<
  ExamTab,
  { title: string; description: string }
> = {
  available: {
    title: "No available or upcoming exams",
    description:
      "New papers will appear here when your courses schedule them. Contact the Academic Office if you expected an exam.",
  },
  in_progress: {
    title: "No attempts in progress",
    description:
      "Started online papers appear here until they are submitted. This demo does not store saved answers.",
  },
  past: {
    title: "No past exams",
    description:
      "Papers appear here after their window closes. Results are added once they are released.",
  },
  results: {
    title: "No released results",
    description:
      "Marks appear here after the Academic Office releases them. Provisional results are labelled until moderation is complete.",
  },
}

function getExamsForTab(tab: ExamTab) {
  const filtered = studentExams.filter((exam) => {
    const availability = getExamAvailability(exam)

    if (tab === "available") {
      return availability === "available" || availability === "upcoming"
    }

    if (tab === "results") {
      return availability === "results"
    }

    return availability === tab
  })

  const direction = tab === "past" || tab === "results" ? -1 : 1

  return [...filtered].sort((a, b) => {
    if (a.date === b.date) return 0
    return (a.date < b.date ? -1 : 1) * direction
  })
}

function getExamScheduleLine(exam: StudentExam) {
  if (exam.mode === "paper") {
    return `${formatShortDate(exam.date)} · ${formatTimeRange(
      exam.startsAt,
      exam.endsAt
    )}`
  }

  return `${formatShortDate(exam.date)} ${formatTime(
    exam.startsAt
  )} – ${formatShortDate(exam.endDate ?? exam.date)} ${formatTime(
    exam.endsAt
  )}`
}

function getExamWindowLabel(exam: StudentExam) {
  if (exam.mode === "paper") {
    return `${formatDisplayDate(exam.date)} · ${formatTimeRange(
      exam.startsAt,
      exam.endsAt
    )}`
  }

  return `${formatDisplayDate(exam.date)}, ${formatTime(
    exam.startsAt
  )} – ${formatDisplayDate(exam.endDate ?? exam.date)}, ${formatTime(
    exam.endsAt
  )}`
}

function getExamStatusLine(
  exam: StudentExam,
  availability: ExamAvailability
) {
  if (availability === "results" && exam.result) {
    if (exam.result.state === "provisional") {
      return "Provisional · marks may change"
    }

    return exam.result.releasedOn
      ? `Released ${formatDisplayDate(exam.result.releasedOn)}`
      : "Released"
  }

  if (availability === "past") {
    return `Closed ${formatDisplayDate(
      exam.endDate ?? exam.date
    )} · results pending`
  }

  if (availability === "in_progress") {
    return `Attempt started · ${exam.usedAttempts} of ${exam.maxAttempts} used`
  }

  if (availability === "available") {
    return `Closes ${formatDisplayDate(
      exam.endDate ?? exam.date
    )}, ${formatTime(exam.endsAt)}`
  }

  return `Opens ${formatDisplayDate(exam.date)}, ${formatTime(exam.startsAt)}`
}

export function StudentExams() {
  const idPrefix = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeTab, setActiveTab] = useState<ExamTab>("available")
  const [selectedExam, setSelectedExam] = useState<StudentExam | null>(null)

  const onlineExamsEnabled = portalModules.onlineExams
  const visibleExams = getExamsForTab(activeTab)

  const availableNow = studentExams.filter(
    (exam) => getExamAvailability(exam) === "available"
  ).length
  const upcomingCount = studentExams.filter(
    (exam) => getExamAvailability(exam) === "upcoming"
  ).length
  const inProgressCount = studentExams.filter(
    (exam) => getExamAvailability(exam) === "in_progress"
  ).length
  const resultCount = studentExams.filter(
    (exam) => getExamAvailability(exam) === "results"
  ).length

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    let nextIndex: number | null = null

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % examTabs.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + examTabs.length) % examTabs.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = examTabs.length - 1
    }

    if (nextIndex === null) return

    const nextTab = examTabs[nextIndex]

    if (!nextTab) return

    event.preventDefault()
    setActiveTab(nextTab.value)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Exams & Results"
          description="Your exam schedule, online MCQ previews and released marks. Online attempts are local-only: answers stay on this page and no timer is enforced."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Student portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {student.grade} · {student.branch}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              {onlineExamsEnabled ? (
                <Badge variant="outline" className="gap-1.5 rounded-full">
                  <MonitorIcon aria-hidden="true" />
                  Online MCQ available
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
                >
                  <LockKeyholeIcon aria-hidden="true" />
                  Online exams disabled
                </Badge>
              )}
            </div>
          }
        />

        {!onlineExamsEnabled ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <LockKeyholeIcon
              className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Online exams are currently disabled</p>
              <p className="text-muted-foreground">
                Paper exams and released results remain available. Online MCQ
                papers cannot be started in this state.
              </p>
            </div>
          </div>
        ) : null}

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <FileCheck2Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Exam overview
            </CardTitle>
            <CardDescription>
              Counts use the local sample schedule for{" "}
              {formatDisplayDate(MOCK_TODAY)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-6">
            <ExamSummaryTile
              icon={CircleCheckIcon}
              label="Available now"
              value={availableNow}
              tone="emerald"
            />
            <ExamSummaryTile
              icon={CalendarClockIcon}
              label="Upcoming"
              value={upcomingCount}
              tone="sky"
            />
            <ExamSummaryTile
              icon={Clock3Icon}
              label="In progress"
              value={inProgressCount}
              tone="amber"
            />
            <ExamSummaryTile
              icon={TrophyIcon}
              label="Results"
              value={resultCount}
              tone="violet"
            />
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            {onlineExamsEnabled
              ? "Online MCQ previews are local: answers are not saved, scored or timed."
              : "Online exams are disabled. Paper exams and released results remain available."}
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="Exam status"
            className="flex w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1 sm:w-fit"
          >
            {examTabs.map((tab, index) => {
              const isSelected = activeTab === tab.value
              const count = getExamsForTab(tab.value).length

              return (
                <button
                  key={tab.value}
                  ref={(element) => {
                    tabRefs.current[index] = element
                  }}
                  type="button"
                  role="tab"
                  id={`${idPrefix}-tab-${tab.value}`}
                  aria-selected={isSelected}
                  aria-controls={`${idPrefix}-panel`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.value)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-none",
                    isSelected
                      ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id={`${idPrefix}-panel`}
            aria-labelledby={`${idPrefix}-tab-${activeTab}`}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-muted-foreground">
              {tabDescriptions[activeTab]}
            </p>

            {visibleExams.length === 0 ? (
              <Card className="gap-0 py-0">
                <EmptyState
                  icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                  title={emptyStateCopy[activeTab].title}
                  description={emptyStateCopy[activeTab].description}
                />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onlineExamsEnabled={onlineExamsEnabled}
                    onOpen={() => setSelectedExam(exam)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Online attempts are a UI preview only. Answers are not saved,
              submitted or scored, the timer does not count down, and attempt
              counts are sample data. Correct answers are never shown before
              results are released.
            </p>
          </CardContent>
        </Card>
      </div>

      <ExamDialog
        exam={selectedExam}
        onlineExamsEnabled={onlineExamsEnabled}
        onOpenChange={(open) => {
          if (!open) setSelectedExam(null)
        }}
      />
    </main>
  )
}

function ExamSummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: "emerald" | "sky" | "amber" | "violet"
}) {
  const toneClasses = {
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    violet:
      "border-violet-600/15 bg-violet-500/5 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
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

function ExamCard({
  exam,
  onlineExamsEnabled,
  onOpen,
}: {
  exam: StudentExam
  onlineExamsEnabled: boolean
  onOpen: () => void
}) {
  const availability = getExamAvailability(exam)
  const isOnline = exam.mode === "online_mcq"
  const result = exam.result
  const showsResult = availability === "results" && result
  const onlineUnavailable = isOnline && !onlineExamsEnabled && !showsResult
  const isProvisional = result?.state === "provisional"

  const actionLabel = showsResult
    ? "View result"
    : isOnline
      ? exam.attemptInProgress
        ? "Continue preview"
        : "Open instructions"
      : "View details"

  const ActionIcon = showsResult
    ? TrophyIcon
    : isOnline
      ? PlayIcon
      : FileTextIcon

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <ExamModeBadge mode={exam.mode} />
          {result ? <ExamResultStateBadge state={result.state} /> : null}
          <Badge variant="outline" className="rounded-full">
            {EXAM_AVAILABILITY_LABELS[availability]}
          </Badge>
        </div>
        <CardTitle className="mt-1 text-base">{exam.title}</CardTitle>
        <CardDescription>
          {exam.courseName} · {exam.subject}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        <div className="grid gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-start gap-1.5">
            <CalendarDaysIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            {getExamScheduleLine(exam)}
          </span>
          <span className="inline-flex items-start gap-1.5">
            <ClockIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            {isOnline
              ? `Time limit ${exam.durationMinutes} minutes`
              : `${exam.durationMinutes} minute paper`}
          </span>
          {isOnline ? (
            <span className="inline-flex items-start gap-1.5">
              <ListChecksIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Attempts {exam.usedAttempts} of {exam.maxAttempts} used
            </span>
          ) : (
            <span className="inline-flex items-start gap-1.5">
              <MapPinIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {exam.venue ?? "Venue to be confirmed"}
            </span>
          )}
        </div>

        {showsResult && result ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 p-2.5 text-xs">
            <span className="font-semibold text-foreground tabular-nums">
              {result.marks ?? "—"} / {result.maxMarks}
            </span>
            <span className="text-muted-foreground">
              Grade {result.grade ?? "—"}
            </span>
            {isProvisional ? (
              <span className="text-amber-700 dark:text-amber-400">
                Provisional · may change
              </span>
            ) : null}
          </div>
        ) : null}

        {onlineUnavailable ? (
          <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs text-muted-foreground">
            Online exams are disabled. Paper exams and released results remain
            available.
          </p>
        ) : exam.availabilityNote ? (
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {exam.availabilityNote}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
        <span className="text-xs text-muted-foreground">
          {getExamStatusLine(exam, availability)}
        </span>
        {onlineUnavailable ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
            Online exams disabled
          </span>
        ) : (
          <Button variant="outline" size="xs" onClick={onOpen}>
            <ActionIcon data-icon="inline-start" aria-hidden="true" />
            {actionLabel}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function ExamDialog({
  exam,
  onlineExamsEnabled,
  onOpenChange,
}: {
  exam: StudentExam | null
  onlineExamsEnabled: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={exam !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {exam ? (
          <ExamDialogBody
            key={exam.id}
            exam={exam}
            onlineExamsEnabled={onlineExamsEnabled}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ExamDialogBody({
  exam,
  onlineExamsEnabled,
}: {
  exam: StudentExam
  onlineExamsEnabled: boolean
}) {
  const availability = getExamAvailability(exam)
  const showsResult = availability === "results" && exam.result
  const canStartOnline =
    exam.mode === "online_mcq" &&
    onlineExamsEnabled &&
    (availability === "available" || availability === "in_progress")

  if (showsResult && exam.result) {
    return <ExamResultView exam={exam} result={exam.result} />
  }

  if (canStartOnline) {
    return <OnlineExamFlow exam={exam} />
  }

  return (
    <ExamDetailsView
      exam={exam}
      availability={availability}
      onlineExamsEnabled={onlineExamsEnabled}
    />
  )
}

function ExamDialogHeader({
  exam,
  children,
}: {
  exam: StudentExam
  children?: React.ReactNode
}) {
  return (
    <DialogHeader>
      <div className="flex flex-wrap items-center gap-1.5">
        <ExamModeBadge mode={exam.mode} />
        {exam.result ? (
          <ExamResultStateBadge state={exam.result.state} />
        ) : null}
      </div>
      <DialogTitle className="text-lg">{exam.title}</DialogTitle>
      <DialogDescription>
        {exam.courseName} · {exam.subject}
        {children ? (
          <>
            {" · "}
            {children}
          </>
        ) : null}
      </DialogDescription>
    </DialogHeader>
  )
}

function ExamDetailsView({
  exam,
  availability,
  onlineExamsEnabled,
}: {
  exam: StudentExam
  availability: ExamAvailability
  onlineExamsEnabled: boolean
}) {
  const isOnline = exam.mode === "online_mcq"
  const onlineUnavailable = isOnline && !onlineExamsEnabled

  return (
    <>
      <ExamDialogHeader exam={exam}>
        {EXAM_AVAILABILITY_LABELS[availability]}
      </ExamDialogHeader>

      {onlineUnavailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm">
          <LockKeyholeIcon
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <p className="font-medium">Online exams are disabled</p>
            <p className="text-muted-foreground">
              This online paper cannot be started. Paper exams and released
              results remain available.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 text-sm">
        <DetailRow
          icon={CalendarDaysIcon}
          label={isOnline ? "Window" : "Exam date"}
          value={getExamWindowLabel(exam)}
        />
        <DetailRow
          icon={ClockIcon}
          label="Duration"
          value={`${exam.durationMinutes} minutes`}
        />
        {isOnline ? (
          <DetailRow
            icon={ListChecksIcon}
            label="Attempts"
            value={`${exam.usedAttempts} of ${exam.maxAttempts} used`}
          />
        ) : (
          <DetailRow
            icon={MapPinIcon}
            label="Venue"
            value={exam.venue ?? "Venue to be confirmed"}
          />
        )}
        <DetailRow
          icon={FileCheck2Icon}
          label="Results"
          value={
            exam.result?.state === "pending"
              ? "Pending release"
              : "Released by the Academic Office"
          }
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ListChecksIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Instructions
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {exam.instructions.map((instruction) => (
            <li key={instruction} className="flex items-start gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              {instruction}
            </li>
          ))}
        </ul>
      </div>

      {exam.availabilityNote ? (
        <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
          {exam.availabilityNote}
        </p>
      ) : null}

      {exam.result?.state === "pending" ? (
        <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
          Results for this paper have not been released. Marks and correct
          answers stay hidden until the Academic Office publishes them.
        </p>
      ) : null}

      <DialogFooter showCloseButton />
    </>
  )
}

function ExamResultView({
  exam,
  result,
}: {
  exam: StudentExam
  result: NonNullable<StudentExam["result"]>
}) {
  const provisional = result.state === "provisional"

  return (
    <>
      <ExamDialogHeader exam={exam}>
        {EXAM_RESULT_STATE_LABELS[result.state]}
      </ExamDialogHeader>

      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">Marks</p>
          <p className="text-2xl leading-none font-semibold tabular-nums">
            {result.marks ?? "—"}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {result.maxMarks}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">Grade</p>
          <p className="text-2xl leading-none font-semibold">
            {result.grade ?? "—"}
          </p>
        </div>
      </div>

      {result.remarks ? (
        <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <p className="text-xs text-muted-foreground">Remarks</p>
          <p>{result.remarks}</p>
        </div>
      ) : null}

      <div className="grid gap-3 text-sm">
        <DetailRow
          icon={CalendarDaysIcon}
          label={provisional ? "Provisional on" : "Released on"}
          value={
            result.releasedOn
              ? formatDisplayDate(result.releasedOn)
              : "Not recorded"
          }
        />
        <DetailRow
          icon={TrophyIcon}
          label="Visibility"
          value={provisional ? "Provisional — may change" : "Released"}
        />
      </div>

      {provisional ? (
        <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
          This result is provisional. Marks and grade may change after
          moderation. Correct answers are not shown.
        </p>
      ) : (
        <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
          Correct answers are not shown in the student portal.
        </p>
      )}

      <DialogFooter showCloseButton />
    </>
  )
}

type OnlineStep = "instructions" | "questions" | "confirm" | "submitted"

function OnlineExamFlow({ exam }: { exam: StudentExam }) {
  const questions = exam.questions ?? []
  const [step, setStep] = useState<OnlineStep>("instructions")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})

  const answeredCount = questions.filter(
    (question) => answers[question.id] !== undefined
  ).length
  const progressValue =
    questions.length === 0 ? 0 : (answeredCount / questions.length) * 100
  const question = questions[questionIndex]
  const selectedOption = question ? answers[question.id] : undefined
  const isLastQuestion = questionIndex === questions.length - 1

  function startPreview() {
    setQuestionIndex(0)
    setAnswers({})
    setStep("questions")
  }

  function selectOption(questionId: string, optionIndex: number) {
    setAnswers((current) => ({ ...current, [questionId]: optionIndex }))
  }

  return (
    <>
      <ExamDialogHeader exam={exam}>
        {step === "instructions"
          ? "Instructions"
          : step === "questions"
            ? `Question ${questionIndex + 1} of ${questions.length}`
            : step === "confirm"
              ? "Submit confirmation"
              : "Submitted"}
      </ExamDialogHeader>

      {step === "instructions" ? (
        <>
          <div className="grid gap-3 text-sm">
            <DetailRow
              icon={CalendarDaysIcon}
              label="Window"
              value={getExamWindowLabel(exam)}
            />
            <DetailRow
              icon={TimerIcon}
              label="Time limit"
              value={`${exam.durationMinutes} minutes · not enforced in this demo`}
            />
            <DetailRow
              icon={ListChecksIcon}
              label="Attempts"
              value={`${exam.usedAttempts} of ${exam.maxAttempts} used`}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ListChecksIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Before you start
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {exam.instructions.map((instruction) => (
                <li key={instruction} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {instruction}
                </li>
              ))}
            </ul>
          </div>

          {exam.attemptInProgress ? (
            <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
              An attempt is already in progress. This preview restarts at
              question 1 and does not restore saved answers.
            </p>
          ) : null}

          <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            Answers stay in this dialog. Nothing is saved, submitted or scored.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("instructions")}>
              Cancel
            </Button>
            <Button onClick={startPreview} disabled={questions.length === 0}>
              <PlayIcon data-icon="inline-start" aria-hidden="true" />
              Start preview
            </Button>
          </DialogFooter>
        </>
      ) : null}

      {step === "questions" && question ? (
        <>
          <Progress value={progressValue} className="gap-2">
            <ProgressLabel className="text-xs text-muted-foreground">
              Answered
            </ProgressLabel>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {answeredCount} of {questions.length}
            </span>
          </Progress>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Question {questionIndex + 1} of {questions.length}
            </p>
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <TimerIcon aria-hidden="true" />
              {exam.durationMinutes}:00 demo
            </Badge>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{question.prompt}</p>
            <div
              role="radiogroup"
              aria-label={`Question ${questionIndex + 1}`}
              className="flex flex-col gap-2"
            >
              {question.options.map((option, optionIndex) => {
                const optionId = `${question.id}-option-${optionIndex}`
                const selected = selectedOption === optionIndex

                return (
                  <label
                    key={optionId}
                    htmlFor={optionId}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <input
                      id={optionId}
                      type="radio"
                      name={question.id}
                      checked={selected}
                      onChange={() =>
                        selectOption(question.id, optionIndex)
                      }
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>{option}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuestionIndex((index) => index - 1)}
              disabled={questionIndex === 0}
            >
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuestionIndex((index) => index + 1)}
              disabled={isLastQuestion}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>

          <Button className="w-full" onClick={() => setStep("confirm")}>
            Review and submit
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Demo timer is illustrative and does not count down. Answers are not
            scored.
          </p>
        </>
      ) : null}

      {step === "confirm" ? (
        <>
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Questions answered</span>
              <span className="font-medium tabular-nums">
                {answeredCount} of {questions.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Questions unanswered</span>
              <span className="font-medium tabular-nums">
                {questions.length - answeredCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Time limit</span>
              <span className="text-right">
                {exam.durationMinutes} minutes (not enforced)
              </span>
            </div>
          </div>

          <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
            Submitting only ends the local preview. No answers are sent, saved
            or scored, and attempt counts do not change.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("questions")}>
              Keep working
            </Button>
            <Button onClick={() => setStep("submitted")}>
              Confirm submit
            </Button>
          </DialogFooter>
        </>
      ) : null}

      {step === "submitted" ? (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/5 p-3 text-sm">
            <CheckCircle2Icon
              className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Attempt submitted (demo)</p>
              <p className="text-muted-foreground">
                You answered {answeredCount} of {questions.length} questions. No
                score was calculated and nothing was saved.
              </p>
            </div>
          </div>

          <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            Results appear in the portal only after the Academic Office releases
            them. Correct answers are never shown before release.
          </p>

          <DialogFooter showCloseButton />
        </>
      ) : null}
    </>
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
