"use client"

import { useEffect, useState } from "react"

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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  CircleAlertIcon,
  InfoIcon,
  PencilIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { ResultSourceBadge } from "@/components/results/result-status-badge"
import {
  gradeFromPercentage,
  type ExamRecord,
  type ExamResultRow,
  type ResultSource,
} from "@/lib/results-data"
import { getInitials } from "@/lib/students-data"

export type MarksEntryDraft = {
  marks: number
  remarks: string | null
  reason: string | null
  source: ResultSource
}

type EnterMarksDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  exam: ExamRecord | null
  row: ExamResultRow | null
  onSubmit: (draft: MarksEntryDraft) => void
}

export function EnterMarksDialog({
  open,
  onOpenChange,
  exam,
  row,
  onSubmit,
}: EnterMarksDialogProps) {
  const existing = row?.result ?? null
  const isEdit = existing !== null
  const isReleased = existing?.releasedAt != null
  const isPaper = exam?.mode === "paper"

  const [marks, setMarks] = useState("")
  const [remarks, setRemarks] = useState("")
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setMarks(existing ? String(existing.marks) : "")
    setRemarks(existing?.remarks ?? "")
    setReason("")
    setErrors({})
  }, [open, existing])

  const maxMarks = exam?.maxMarks ?? 0
  const numericMarks = Number(marks)
  const validMarks =
    marks.trim() !== "" && Number.isFinite(numericMarks) && numericMarks >= 0
  const clampedMarks = validMarks ? Math.min(numericMarks, maxMarks) : 0
  const percentage =
    validMarks && maxMarks > 0 ? (clampedMarks / maxMarks) * 100 : 0
  const grade = gradeFromPercentage(percentage)

  // A manual change to an attempt-based result is an override.
  const source: ResultSource = isPaper
    ? "manual"
    : existing
      ? "manual_override"
      : "manual"

  function handleSubmit() {
    const nextErrors: Record<string, string> = {}

    if (marks.trim() === "" || !Number.isFinite(numericMarks)) {
      nextErrors.marks = "Enter the marks awarded."
    } else if (numericMarks < 0 || numericMarks > maxMarks) {
      nextErrors.marks = `Marks must be between 0 and ${maxMarks}.`
    }

    if (isReleased && !reason.trim()) {
      nextErrors.reason =
        "Editing a released result requires a short reason for the audit trail."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSubmit({
      marks: clampedMarks,
      remarks: remarks.trim() === "" ? null : remarks.trim(),
      reason: reason.trim() === "" ? null : reason.trim(),
      source,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilIcon className="size-4" aria-hidden="true" />
            {isEdit ? "Edit result" : "Enter marks"}
          </DialogTitle>
          <DialogDescription>
            {exam
              ? `${exam.title} · ${isPaper ? "Paper" : "Online MCQ"}`
              : "Select an exam to enter marks."}
          </DialogDescription>
        </DialogHeader>

        {row && exam ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <span className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {getInitials(row.studentName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{row.studentName}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.studentNo} · {row.branchName}
                  </span>
                </span>
              </span>
              <ResultSourceBadge source={source} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="result-marks">
                  <span>
                    Marks awarded
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="result-marks"
                    type="number"
                    min={0}
                    max={maxMarks}
                    step="0.01"
                    inputMode="decimal"
                    value={marks}
                    onChange={(event) => setMarks(event.target.value)}
                    aria-invalid={errors.marks ? true : undefined}
                    aria-describedby={
                      errors.marks ? "result-marks-error" : undefined
                    }
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    / {maxMarks}
                  </span>
                </div>
                {errors.marks ? (
                  <p
                    id="result-marks-error"
                    className="text-xs text-destructive"
                  >
                    {errors.marks}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Grade (derived)</span>
                <div className="flex h-8 items-center gap-2 rounded-lg border px-3 text-sm">
                  <Badge variant="outline" className="rounded-full">
                    {grade}
                  </Badge>
                  <span className="text-muted-foreground tabular-nums">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="result-remarks">
                Remarks
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="result-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Feedback shown with the result"
              />
            </div>

            {isReleased ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-amber-600/30 bg-amber-500/5 p-3">
                <Label
                  htmlFor="result-reason"
                  className="flex items-center gap-2"
                >
                  <ShieldCheckIcon
                    className="size-4 text-amber-700 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <span>
                    Reason for editing a released result
                    <span
                      className="ml-0.5 text-destructive"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </span>
                </Label>
                <Textarea
                  id="result-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Rechecking of script after student query"
                  aria-invalid={errors.reason ? true : undefined}
                />
                {errors.reason ? (
                  <p className="text-xs text-destructive">{errors.reason}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The change is recorded with a manual override source and an
                    audit cue. The original attempt or mark is not deleted.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {isPaper
                    ? "Paper results are entered manually. Set the mark here; the grade is derived from the percentage."
                    : "Changing an attempt-based result stores it as a manual override; the attempt and its answers stay unchanged."}
                </span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo only.{" "}
                {isEdit ? "The result is not updated" : "No result is created"}{" "}
                and nothing is saved.
              </span>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!row || !exam}>
            {isEdit ? "Save result (demo)" : "Add result (demo)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
