"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  CheckIcon,
  ClipboardListIcon,
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  PencilIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react"

import {
  AttemptStatusBadge,
  ReleaseStateBadge,
  ResultSourceBadge,
} from "@/components/results/result-status-badge"
import {
  attemptStatusLabels,
  examModeLabels,
  examScoringLabels,
  examVisibilityLabels,
  type AttemptAnswerRecord,
  type ExamAttemptRecord,
  type ExamRecord,
  type ExamResultRow,
} from "@/lib/results-data"
import {
  formatDateTime,
  formatDisplayDate,
  getInitials,
} from "@/lib/students-data"

type ResultDetailSheetProps = {
  exam: ExamRecord | null
  row: ExamResultRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnterMarks: (row: ExamResultRow) => void
}

export function ResultDetailSheet({
  exam,
  row,
  open,
  onOpenChange,
  onEnterMarks,
}: ResultDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const result = row?.result ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        {exam && row ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {row.studentName}
                <ReleaseStateBadge state={row.releaseState} />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Result for {row.studentName} in {exam.title}
              </SheetDescription>
              <div className="flex items-center gap-2 pt-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {getInitials(row.studentName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm text-foreground">{exam.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.studentNo} · {row.branchName}
                    {row.courseName ? ` · ${row.courseName}` : ""}
                  </span>
                </span>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat
                  label="Marks"
                  value={result ? `${result.marks} / ${result.maxMarks}` : "—"}
                  strong
                />
                <SummaryStat
                  label="Percentage"
                  value={result ? `${result.percentage.toFixed(0)}%` : "—"}
                />
                <SummaryStat
                  label="Grade"
                  value={result?.grade ?? "—"}
                  strong
                />
                <SummaryStat
                  label="Source"
                  value={result ? result.source.replace("_", " ") : "—"}
                />
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading icon={<FileTextIcon />} title="Exam & result" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField label="Exam" value={exam.title} />
                  <ProfileField
                    label="Mode"
                    value={examModeLabels[exam.mode]}
                  />
                  <ProfileField
                    label="Max marks"
                    value={`${exam.maxMarks}${
                      exam.weight ? ` · weight ${exam.weight}%` : ""
                    }`}
                  />
                  <ProfileField
                    label="Courses"
                    value={exam.courseNames.join(", ")}
                  />
                  <ProfileField
                    label="Branches"
                    value={exam.branchNames.join(", ")}
                  />
                  <ProfileField
                    label="Window"
                    value={
                      exam.mode === "paper"
                        ? exam.examDate
                          ? formatDisplayDate(exam.examDate)
                          : "—"
                        : exam.opensAt && exam.closesAt
                          ? `${formatDateTime(exam.opensAt)} → ${formatDateTime(exam.closesAt)}`
                          : "—"
                    }
                  />
                  <ProfileField label="Course" value={row.courseName ?? "—"} />
                  <ProfileField
                    label="Scoring"
                    value={examScoringLabels[exam.attemptScoring]}
                  />
                  <ProfileField
                    label="Visibility"
                    value={examVisibilityLabels[exam.resultsVisibility]}
                  />
                  <ProfileField
                    label="Released"
                    value={
                      result?.releasedAt
                        ? formatDateTime(result.releasedAt)
                        : "Not released"
                    }
                  />
                  <ProfileField
                    label="Last updated"
                    value={result ? formatDateTime(result.updatedAt) : "—"}
                  />
                  <ProfileField
                    label="Result source"
                    value={
                      result ? (
                        <ResultSourceBadge source={result.source} />
                      ) : (
                        "—"
                      )
                    }
                  />
                </dl>
                {result?.remarks ? (
                  <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{result.remarks}</span>
                  </div>
                ) : null}
                {result?.source === "manual_override" ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                    <ShieldCheckIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Manual override — the original counted attempt is kept
                      unchanged and this change is recorded with an audit note.
                    </span>
                  </div>
                ) : null}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ClipboardListIcon />}
                  title="Attempts & answers"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {row.attempts.length}{" "}
                      {row.attempts.length === 1 ? "attempt" : "attempts"}
                    </Badge>
                  }
                />
                {exam.mode === "paper" ? (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Paper exams have no online attempt. Marks are entered
                      manually and the grade is derived from the percentage.
                    </span>
                  </div>
                ) : row.attempts.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                    <ClockIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      No attempt has been started for this student yet.
                    </span>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {row.attempts.map((attempt) => (
                      <li key={attempt.id} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                          <span className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">
                              Attempt #{attempt.attemptNo}
                            </span>
                            {row.countedAttempt?.id === attempt.id ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                              >
                                Counted
                              </Badge>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm tabular-nums">
                              {attempt.score === null
                                ? "—"
                                : `${attempt.score} / ${exam.maxMarks}`}
                            </span>
                            <AttemptStatusBadge status={attempt.status} />
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <span>
                            Started: {formatDateTime(attempt.startedAt)}
                          </span>
                          <span>
                            Submitted:{" "}
                            {attempt.submittedAt
                              ? formatDateTime(attempt.submittedAt)
                              : "Not submitted"}
                          </span>
                          <span>
                            Status: {attemptStatusLabels[attempt.status]}
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full min-w-[560px] text-sm">
                            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 font-medium">
                                  Question
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Answer
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Correct
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                  Marks
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {attempt.answers.map((answer) => (
                                <AnswerRow key={answer.id} answer={answer} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Attempt answers are graded against the question snapshot
                  frozen at publish. Marks and correctness shown here are sample
                  data and nothing is saved.
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample result · no changes are saved
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {exam.mode === "paper" || row.result ? (
                  <Button onClick={() => onEnterMarks(row)}>
                    <PencilIcon data-icon="inline-start" />
                    {row.result ? "Edit result (demo)" : "Enter marks (demo)"}
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function AnswerRow({ answer }: { answer: AttemptAnswerRecord }) {
  const selected = answer.options.find(
    (option) => option.key === answer.selectedOptionKey
  )
  const correct = answer.options.find((option) => option.isCorrect)

  return (
    <tr>
      <td className="px-3 py-2 align-top">
        <span className="text-xs text-muted-foreground">
          Q{answer.position}
        </span>
        <p className="font-medium text-card-foreground">
          {answer.questionBody}
        </p>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        {selected ? (
          <span>
            <span className="font-medium">{selected.key}.</span> {selected.body}
          </span>
        ) : (
          <span className="text-muted-foreground">Not answered</span>
        )}
        {correct && !answer.isCorrect ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Correct: {correct.key}. {correct.body}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top">
        {answer.isCorrect === null ? (
          <Badge
            variant="outline"
            className="rounded-full text-muted-foreground"
          >
            Pending
          </Badge>
        ) : answer.isCorrect ? (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
          >
            <CheckIcon aria-hidden="true" />
            Correct
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-red-600/20 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-400"
          >
            <XIcon aria-hidden="true" />
            Incorrect
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top tabular-nums">
        {answer.marksAwarded === null
          ? "—"
          : `${answer.marksAwarded} / ${answer.marks}`}
      </td>
    </tr>
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

function ProfileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`capitalize tabular-nums ${strong ? "text-base font-semibold" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  )
}
