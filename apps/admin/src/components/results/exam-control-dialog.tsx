"use client"

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
  BadgeCheckIcon,
  CircleAlertIcon,
  InfoIcon,
  LockIcon,
  SendIcon,
} from "lucide-react"

import { ExamStatusBadge } from "@/components/results/result-status-badge"
import type { ExamRecord } from "@/lib/results-data"
import { formatDateTime } from "@/lib/students-data"

export type ExamControlMode = "close" | "release"

type ExamControlDialogProps = {
  mode: ExamControlMode | null
  exam: ExamRecord | null
  usage: {
    candidates: number
    entered: number
    released: number
    provisional: number
    notEntered: number
  } | null
  onOpenChange: (open: boolean) => void
  onConfirm: (mode: ExamControlMode, exam: ExamRecord) => void
}

export function ExamControlDialog({
  mode,
  exam,
  usage,
  onOpenChange,
  onConfirm,
}: ExamControlDialogProps) {
  const open = mode !== null && exam !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {mode === "close" && exam ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LockIcon className="size-4" aria-hidden="true" />
                Close exam
              </DialogTitle>
              <DialogDescription>
                Closing stops new attempts and unlocks result release.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{exam.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {exam.courseNames.join(", ")} ·{" "}
                    {exam.branchNames.join(", ")}
                  </span>
                </span>
                <ExamStatusBadge status={exam.status} />
              </div>

              <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <BadgeCheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  Window closed on{" "}
                  {exam.closesAt ? formatDateTime(exam.closesAt) : "—"}.
                </li>
                <li className="flex items-start gap-1.5">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {usage?.candidates ?? 0} candidates · {usage?.entered ?? 0}{" "}
                  results recorded.
                </li>
                <li className="flex items-start gap-1.5">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  Status moves draft → published → closed only; it cannot be
                  reopened.
                </li>
              </ul>

              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Local demo only. Nothing is saved; reloading restores the
                  sample exam and its status.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onConfirm("close", exam)
                }}
              >
                Confirm close (demo)
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {mode === "release" && exam ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SendIcon className="size-4" aria-hidden="true" />
                Release results
              </DialogTitle>
              <DialogDescription>
                Release makes final marks visible to students and guardians.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{exam.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {exam.courseNames.join(", ")}
                  </span>
                </span>
                <Badge variant="outline" className="rounded-full">
                  {exam.status === "closed" ? "Closed" : "Not closed yet"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <ReleaseStat label="Recorded" value={usage?.entered ?? 0} />
                <ReleaseStat label="Released" value={usage?.released ?? 0} />
                <ReleaseStat
                  label="Provisional"
                  value={usage?.provisional ?? 0}
                  tone="warn"
                />
              </div>

              {exam.status === "closed" ? (
                <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Provisional results become final and store a release date.
                    Results still missing marks ({usage?.notEntered ?? 0}) stay
                    unreleased until they are entered.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                  <LockIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Results can only be released after the exam is closed. Close
                    the exam first.
                  </span>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Local demo only. Nothing is saved; reloading restores the
                  sample results.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={exam.status !== "closed"}
                onClick={() => {
                  onOpenChange(false)
                  onConfirm("release", exam)
                }}
              >
                Confirm release (demo)
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ReleaseStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warn"
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`text-lg font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}
