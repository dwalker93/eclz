"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  CheckIcon,
  ImageIcon,
  InfoIcon,
  ListChecksIcon,
  LockIcon,
  SnowflakeIcon,
  SquarePenIcon,
  UserRoundIcon,
} from "lucide-react"

import { ExamStatusBadge } from "@/components/exams/exam-status-badge"
import {
  getQuestionUsage,
  isQuestionInPublishedSnapshot,
} from "@/lib/exams-data"
import type { QuestionRecord } from "@/lib/questions-data"
import { formatDisplayDate } from "@/lib/students-data"

type QuestionDetailSheetProps = {
  question: QuestionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (question: QuestionRecord) => void
}

export function QuestionDetailSheet({
  question,
  open,
  onOpenChange,
  onEdit,
}: QuestionDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  const usage = question ? getQuestionUsage(question.id) : []
  const frozen = question ? isQuestionInPublishedSnapshot(question.id) : false
  const correctCount = question
    ? question.options.filter((option) => option.isCorrect).length
    : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {question ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                <ListChecksIcon className="size-5" aria-hidden="true" />
                {question.subjectName} question
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  <UserRoundIcon aria-hidden="true" />
                  {question.lecturerName}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {question.defaultMarks}{" "}
                  {question.defaultMarks === 1 ? "mark" : "marks"}
                </Badge>
                {question.imageFileName ? (
                  <Badge variant="outline" className="rounded-full">
                    <ImageIcon aria-hidden="true" />
                    Image attached
                  </Badge>
                ) : null}
                {frozen ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                  >
                    <SnowflakeIcon aria-hidden="true" />
                    In a published snapshot
                  </Badge>
                ) : null}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              {frozen ? (
                <div className="flex items-start gap-2 rounded-lg border border-sky-600/20 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-800 dark:border-sky-400/20 dark:text-sky-300">
                  <SnowflakeIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      Used in a published exam snapshot
                    </span>
                    <span>
                      At least one exam froze this question and its options at
                      publish. That snapshot is read-only here; editing the bank
                      record never rewrites it.
                    </span>
                  </div>
                </div>
              ) : null}

              <section className="flex flex-col gap-3">
                <SectionHeading icon={<InfoIcon />} title="Question" />
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <p className="text-sm leading-relaxed">{question.body}</p>
                  {question.imageFileName ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2">
                      <ImageIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {question.imageFileName}
                      </span>
                      <Badge variant="outline" className="rounded-full">
                        Placeholder
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No image attached to this prompt.
                    </p>
                  )}
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Explanation
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {question.explanation ?? "No explanation provided."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ListChecksIcon />}
                  title="Answer options"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {question.options.length} options · {correctCount} correct
                    </Badge>
                  }
                />
                <ol className="flex flex-col divide-y rounded-lg border">
                  {question.options.map((option, index) => (
                    <li
                      key={`${question.id}-${option.key}`}
                      className="flex items-start gap-3 p-3"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        {option.body}
                      </span>
                      {option.isCorrect ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                        >
                          <CheckIcon aria-hidden="true" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full text-muted-foreground"
                        >
                          Distractor
                        </Badge>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">
                  The schema allows one or more correct options, so grading can
                  accept multiple answers.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<LockIcon />}
                  title="Used by exams"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {usage.length} {usage.length === 1 ? "exam" : "exams"}
                    </span>
                  }
                />
                {usage.length > 0 ? (
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {usage.map((item) => (
                      <li
                        key={item.examId}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {item.examTitle}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.frozen
                              ? "Frozen snapshot — read-only"
                              : "Draft placement — snapshot not frozen yet"}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ExamStatusBadge status={item.examStatus} />
                          {item.frozen ? (
                            <SnowflakeIcon
                              className="size-4 text-muted-foreground"
                              aria-label="Snapshot frozen"
                            />
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
                    Not placed in any exam yet. It is available to draft exams.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Published and closed exams keep their own frozen copy. Editing
                  or removing this bank question does not edit those snapshots.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Created {formatDisplayDate(question.createdAt)} · sample data
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => onEdit(question)}>
                  <SquarePenIcon data-icon="inline-start" />
                  {frozen ? "Edit bank copy (demo)" : "Edit question (demo)"}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
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