"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  BarChart3Icon,
  CalendarClockIcon,
  CheckIcon,
  CircleAlertIcon,
  ClipboardListIcon,
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  LayersIcon,
  ListChecksIcon,
  LockIcon,
  SendIcon,
  SnowflakeIcon,
  SquarePenIcon,
  UnlockIcon,
} from "lucide-react"

import { ExamModeBadge, ExamStatusBadge } from "@/components/exams/exam-status-badge"
import {
  attemptScoringLabels,
  getExamCandidateCount,
  getExamTotalMarks,
  resultsVisibilityLabels,
  type ExamRecord,
} from "@/lib/exams-data"
import { formatDateTime, formatDisplayDate } from "@/lib/students-data"

type ExamDetailSheetProps = {
  exam: ExamRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotice: (message: string) => void
  onEdit: (exam: ExamRecord) => void
}

export function ExamDetailSheet({
  exam,
  open,
  onOpenChange,
  onNotice,
  onEdit,
}: ExamDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          initialFocus={headerRef}
          className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        >
          {exam ? (
            <>
              <SheetHeader
                ref={headerRef}
                tabIndex={-1}
                className="border-b p-6 pr-14 outline-none"
              >
                <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <ClipboardListIcon className="size-5" aria-hidden="true" />
                  {exam.title}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <ExamModeBadge mode={exam.mode} />
                  <ExamStatusBadge status={exam.status} />
                  <span>
                    {exam.lecturerName} · {getExamTotalMarks(exam)} marks
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 p-6">
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<InfoIcon />}
                    title="Overview"
                    aside={
                      exam.status === "draft" ? (
                        <Badge variant="outline" className="rounded-full">
                          Editable draft
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full">
                          <LockIcon aria-hidden="true" />
                          Frozen after publish
                        </Badge>
                      )
                    }
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailField label="Title" value={exam.title} />
                    <DetailField
                      label="Owner lecturer"
                      value={exam.lecturerName}
                    />
                    <DetailField
                      label="Mode"
                      value={<ExamModeBadge mode={exam.mode} />}
                    />
                    <DetailField
                      label="Total marks"
                      value={String(getExamTotalMarks(exam))}
                    />
                    <DetailField
                      label="Weight in overall mark"
                      value={exam.weight ? `${exam.weight}%` : "Not weighted"}
                    />
                    <DetailField
                      label="Created on"
                      value={formatDisplayDate(exam.createdAt)}
                    />
                  </dl>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<CalendarClockIcon />}
                    title={exam.mode === "online_mcq" ? "Window" : "Exam date"}
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    {exam.mode === "online_mcq" ? (
                      <>
                        <DetailField
                          label="Opens"
                          value={
                            exam.opensAt
                              ? formatDateTime(exam.opensAt)
                              : "Not set"
                          }
                        />
                        <DetailField
                          label="Closes"
                          value={
                            exam.closesAt
                              ? formatDateTime(exam.closesAt)
                              : "Not set"
                          }
                        />
                        <DetailField
                          label="Time limit"
                          value={
                            exam.timeLimitMinutes === null
                              ? "No limit inside the window"
                              : `${exam.timeLimitMinutes} minutes`
                          }
                        />
                        <DetailField
                          label="Question order"
                          value={
                            exam.shuffleQuestions
                              ? "Shuffled per candidate"
                              : "Fixed order"
                          }
                        />
                      </>
                    ) : (
                      <>
                        <DetailField
                          label="Exam date"
                          value={
                            exam.examDate
                              ? formatDisplayDate(exam.examDate)
                              : "Not set"
                          }
                        />
                        <DetailField
                          label="Paper total"
                          value={
                            exam.maxMarks ? `${exam.maxMarks} marks` : "Not set"
                          }
                        />
                      </>
                    )}
                  </dl>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<BarChart3Icon />}
                    title="Limits, scoring &amp; visibility"
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailField
                      label="Attempt limit"
                      value={
                        exam.mode === "paper"
                          ? "Not applicable for paper"
                          : exam.maxAttempts === null
                            ? "Unlimited"
                            : `${exam.maxAttempts} ${
                                exam.maxAttempts === 1 ? "attempt" : "attempts"
                              }`
                      }
                    />
                    <DetailField
                      label="Attempt scoring"
                      value={
                        exam.mode === "paper"
                          ? "Not applicable for paper"
                          : attemptScoringLabels[exam.attemptScoring]
                      }
                    />
                    <DetailField
                      label="Results visibility"
                      value={resultsVisibilityLabels[exam.resultsVisibility]}
                    />
                    <DetailField
                      label="Eligible candidates"
                      value={`${getExamCandidateCount(exam)} (sample)`}
                    />
                  </dl>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<LayersIcon />}
                    title="Attached courses"
                    aside={
                      <span className="text-xs text-muted-foreground">
                        {exam.courses.length}{" "}
                        {exam.courses.length === 1 ? "course" : "courses"}
                      </span>
                    }
                  />
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {exam.courses.map((course) => (
                      <li
                        key={course.courseId}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {course.courseName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {course.branchName} ·{" "}
                            {course.courseKind === "program"
                              ? "Program"
                              : "Class"}
                          </span>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {course.candidates} candidates
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    An exam attaches to courses, so a shared or branch-specific
                    scope is simply which courses it covers.
                  </p>
                </section>

                {exam.mode === "online_mcq" ? (
                  <section className="flex flex-col gap-3">
                    <SectionHeading
                      icon={<ListChecksIcon />}
                      title="Questions"
                      aside={
                        <Badge variant="outline" className="rounded-full">
                          {exam.questions.length}{" "}
                          {exam.questions.length === 1
                            ? "question"
                            : "questions"}{" "}
                          · {getExamTotalMarks(exam)} marks
                        </Badge>
                      }
                    />
                    {exam.questions.length > 0 ? (
                      <ol className="flex flex-col divide-y rounded-lg border">
                        {exam.questions.map((question) => (
                          <li
                            key={question.id}
                            className="flex items-start gap-3 p-3"
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                              {question.position}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-sm">{question.body}</span>
                              <span className="text-xs text-muted-foreground">
                                {question.optionCount} options ·{" "}
                                {question.marks}{" "}
                                {question.marks === 1 ? "mark" : "marks"}
                              </span>
                            </div>
                            {question.frozen ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full"
                              >
                                <SnowflakeIcon aria-hidden="true" />
                                Snapshot
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full text-muted-foreground"
                              >
                                Draft
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                        <InfoIcon
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        No questions placed yet.
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Questions come from the Question Bank. Publishing freezes a
                      snapshot of each question and its options, so published
                      questions cannot be edited in place.
                    </p>
                  </section>
                ) : (
                  <section className="flex flex-col gap-3">
                    <SectionHeading
                      icon={<FileTextIcon />}
                      title="Paper results entry"
                      aside={
                        <Badge variant="outline" className="rounded-full">
                          Manual
                        </Badge>
                      }
                    />
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
                      <FileTextIcon
                        className="size-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">
                        {exam.maxMarks ?? 0} mark paper
                      </span>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Paper marks are entered manually for each candidate.
                        Result entry happens on the Results page, not here.
                      </p>
                    </div>
                  </section>
                )}

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<BarChart3Icon />}
                    title="Attempts &amp; results"
                  />
                  <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4 sm:grid-cols-4">
                    <Stat label="In progress" value={exam.attempts.inProgress} />
                    <Stat label="Submitted" value={exam.attempts.submitted} />
                    <Stat label="Graded" value={exam.attempts.graded} />
                    <Stat label="Expired" value={exam.attempts.expired} />
                  </dl>

                  {exam.results.releasedAt ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4">
                      <div className="flex items-start gap-2">
                        <CheckIcon
                          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            Results released
                          </span>
                          <span className="text-xs text-emerald-800 dark:text-emerald-300">
                            {exam.results.released} of {exam.results.count}{" "}
                            released on{" "}
                            {formatDateTime(exam.results.releasedAt)}
                          </span>
                        </div>
                      </div>
                      {exam.results.averagePercent !== null ? (
                        <Badge variant="outline" className="rounded-full">
                          Average {exam.results.averagePercent}%
                        </Badge>
                      ) : null}
                    </div>
                  ) : exam.status === "closed" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-2">
                        <UnlockIcon
                          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            Results not released
                          </span>
                          <span className="text-xs text-amber-800 dark:text-amber-300">
                            {exam.results.count} results recorded. Release is
                            only available after the exam is closed.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                      <ClockIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Results can only be released after the exam closes.
                      </span>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<SnowflakeIcon />}
                    title="Publishing &amp; snapshots"
                  />
                  <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <CircleAlertIcon
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Publishing freezes a snapshot of every question and option.
                      Published questions cannot be edited in place — changes are
                      made by creating a new version or a new exam. No real exam
                      or grading runs on this page.
                    </span>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
                <span className="text-xs text-muted-foreground">
                  Sample exam · no changes are saved
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {exam.status === "draft" ? (
                    <>
                      <Button variant="outline" onClick={() => onEdit(exam)}>
                        <SquarePenIcon data-icon="inline-start" />
                        Edit (demo)
                      </Button>
                      <Button onClick={() => setPublishOpen(true)}>
                        <SendIcon data-icon="inline-start" />
                        Publish (demo)
                      </Button>
                    </>
                  ) : null}
                  {exam.status === "published" ? (
                    <Button
                      variant="outline"
                      onClick={() => setCloseOpen(true)}
                    >
                      <LockIcon data-icon="inline-start" />
                      Close exam (demo)
                    </Button>
                  ) : null}
                  {exam.status === "closed" && !exam.results.releasedAt ? (
                    <Button onClick={() => setReleaseOpen(true)}>
                      <UnlockIcon data-icon="inline-start" />
                      Release results (demo)
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmExamDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish exam"
        description={
          exam
            ? `“${exam.title}” will be published and opened to its attached courses.`
            : "This exam will be published."
        }
        confirmLabel="Publish exam (demo)"
        successTitle="Publish preview ready"
        successBody="The exam would become visible to eligible candidates, and question and option snapshots would freeze at this point."
        notes={[
          "A frozen snapshot is stored for every question and option.",
          "Published questions cannot be edited in place; create a new version instead.",
          "Online exams open and close strictly within their configured window.",
        ]}
        onDone={onNotice}
      />

      <ConfirmExamDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close exam"
        description={
          exam
            ? `“${exam.title}” will be closed to further attempts.`
            : "This exam will be closed."
        }
        confirmLabel="Close exam (demo)"
        successTitle="Close preview ready"
        successBody="No new attempts would be accepted. Recorded results stay editable until they are released."
        notes={[
          "Result release becomes available only after closure.",
          "Closing does not release results by itself.",
        ]}
        onDone={onNotice}
      />

      <ConfirmExamDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        title="Release results"
        description={
          exam
            ? `Results for “${exam.title}” will be released to candidates and guardians.`
            : "Results will be released."
        }
        confirmLabel="Release results (demo)"
        successTitle="Release preview ready"
        successBody="Recorded results would become visible according to the exam's visibility setting."
        notes={[
          "Release is available only after the exam is closed.",
          "A released result is final; later edits need a reason and an audit cue.",
        ]}
        onDone={onNotice}
      />
    </>
  )
}

function ConfirmExamDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  successTitle,
  successBody,
  notes,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  successTitle: string
  successBody: string
  notes: string[]
  onDone: (message: string) => void
}) {
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setSubmitted(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-4" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description} This is a UI preview — nothing is changed.
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
                <span className="text-sm font-medium">{successTitle}</span>
                <p className="text-sm">{successBody}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>Demo only. Nothing is published, closed or released.</span>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-1.5">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {note}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onDone(
                    `${title} preview closed. Nothing was changed — this is a UI demo.`
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
              <Button onClick={() => setSubmitted(true)}>{confirmLabel}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function SectionHeading({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          mono ? "truncate font-mono text-sm" : "text-sm [&>span]:truncate"
        }
      >
        {value}
      </dd>
    </div>
  )
}
