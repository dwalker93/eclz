"use client"

import { useEffect, useRef, useState } from "react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import {
  BanIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { PromotionStatusBadge } from "@/components/promotions/promotion-status-badge"
import {
  getPromotionDecisionLabel,
  getPromotionRunSummary,
  promotionDecisionOptions,
  type PromotionDecision,
  type PromotionItemRecord,
  type PromotionRunRecord,
} from "@/lib/promotions-data"
import { formatDisplayDate, formatDateTime } from "@/lib/students-data"

type PromotionReviewSheetProps = {
  run: PromotionRunRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: (run: PromotionRunRecord) => void
}

const decisionStyles: Record<PromotionDecision, string> = {
  move:
    "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  stay:
    "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  skip: "border-border bg-muted text-muted-foreground",
  needs_review:
    "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
}

export function PromotionReviewSheet({
  run,
  open,
  onOpenChange,
  onConfirmed,
}: PromotionReviewSheetProps) {
  const [decisions, setDecisions] = useState<
    Record<string, PromotionDecision>
  >({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDecisions(
      run
        ? Object.fromEntries(run.items.map((item) => [item.id, item.decision]))
        : {}
    )
    setConfirmOpen(false)
  }, [run])

  const items: PromotionItemRecord[] = run
    ? run.items.map((item) => ({
        ...item,
        decision: decisions[item.id] ?? item.decision,
      }))
    : []
  const summary = getPromotionRunSummary(items)
  const readOnly = run?.status !== "draft"
  const canConfirm = !readOnly && summary.needsReview === 0

  function setDecision(itemId: string, decision: PromotionDecision) {
    setDecisions((previous) => ({ ...previous, [itemId]: decision }))
  }

  function resetDecisions() {
    if (!run) return
    setDecisions(
      Object.fromEntries(run.items.map((item) => [item.id, item.decision]))
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          initialFocus={headerRef}
          className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-5xl"
        >
          {run ? (
            <>
              <SheetHeader
                ref={headerRef}
                tabIndex={-1}
                className="border-b p-6 pr-14 outline-none"
              >
                <SheetTitle className="text-lg">{run.title}</SheetTitle>
                <SheetDescription>
                  {run.scopeBranch} · {run.scopeGrade} ·{" "}
                  {run.scopeCourseGroup}
                </SheetDescription>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <PromotionStatusBadge status={run.status} />
                  <Badge variant="outline" className="rounded-full">
                    Effective {formatDisplayDate(run.effectiveDate)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    Created {formatDateTime(run.performedAt)}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="flex flex-col gap-6 p-6">
                {run.status === "draft" ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      This is a draft review. Changing decisions only updates
                      this preview; no grade, class, enrollment or billing
                      record changes before confirmation.
                    </span>
                  </div>
                ) : run.status === "confirmed" ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
                    <CircleCheckIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Confirmed
                      {run.confirmedAt
                        ? ` on ${formatDateTime(run.confirmedAt)}`
                        : ""}
                      . This historical run is read-only in the demo.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                    <BanIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      This run was discarded and is read-only. Nothing from this
                      proposal was applied.
                    </span>
                  </div>
                )}

                <section className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Decision summary</h3>
                    <span className="text-xs text-muted-foreground">
                      {run.note}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <SummaryTile
                      label="Move"
                      value={summary.move}
                      tone="move"
                    />
                    <SummaryTile
                      label="Stay"
                      value={summary.stay}
                      tone="stay"
                    />
                    <SummaryTile
                      label="Skip"
                      value={summary.skip}
                      tone="skip"
                    />
                    <SummaryTile
                      label="Needs review"
                      value={summary.needsReview}
                      tone="needs_review"
                    />
                  </div>
                </section>

                <section className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                  <h3 className="text-sm font-semibold">How decisions behave</h3>
                  <ul className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                    <li>
                      <span className="font-medium text-foreground">Move</span>{" "}
                      creates next-grade class placement from the effective
                      date.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Stay</span>{" "}
                      advances the grade but pins the enrollment billing grade.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Skip</span>{" "}
                      leaves the current grade and class unchanged.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">
                        Needs review
                      </span>{" "}
                      blocks confirmation until resolved.
                    </li>
                  </ul>
                </section>

                <Separator />

                <section className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Review items</h3>
                    <span className="text-xs text-muted-foreground">
                      One item per active class enrollment
                    </span>
                  </div>

                  {items.length > 0 ? (
                    <div className="rounded-lg border">
                      <Table className="min-w-[780px] table-fixed">
                        <colgroup>
                          <col className="w-[150px]" />
                          <col className="w-[190px]" />
                          <col className="w-[190px]" />
                          <col className="w-[190px]" />
                          <col />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-3 whitespace-normal text-muted-foreground">
                              Student
                            </TableHead>
                            <TableHead className="whitespace-normal text-muted-foreground">
                              Current grade / class
                            </TableHead>
                            <TableHead className="whitespace-normal text-muted-foreground">
                              Proposed next class
                            </TableHead>
                            <TableHead className="whitespace-normal text-muted-foreground">
                              Decision
                            </TableHead>
                            <TableHead className="pr-3 whitespace-normal text-muted-foreground">
                              Reason / warning
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="pl-3 whitespace-normal">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {item.studentName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.studentNo}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-normal">
                                <div className="flex flex-col">
                                  <span>{item.currentGrade}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.currentClass} ·{" "}
                                    {item.currentBranch}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-normal">
                                <div className="flex flex-col">
                                  <span>
                                    {item.proposedCourseName ??
                                      "No next class matched"}
                                  </span>
                                  {item.billingGradeName ? (
                                    <span className="text-xs text-sky-700 dark:text-sky-400">
                                      Billing grade stays{" "}
                                      {item.billingGradeName}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-normal">
                                {readOnly ? (
                                  <DecisionBadge decision={item.decision} />
                                ) : (
                                  <Select
                                    items={promotionDecisionOptions}
                                    value={item.decision}
                                    onValueChange={(value) =>
                                      setDecision(
                                        item.id,
                                        (value ??
                                          "needs_review") as PromotionDecision
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      className="w-[170px]"
                                      aria-label={`Decision for ${item.studentName}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {promotionDecisionOptions.map((option) => (
                                        <SelectItem
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell className="pr-3 whitespace-normal">
                                {item.note ? (
                                  <span
                                    className={cn(
                                      "flex items-start gap-1.5 text-xs",
                                      item.decision === "needs_review"
                                        ? "text-amber-700 dark:text-amber-400"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {item.decision === "needs_review" ? (
                                      <TriangleAlertIcon
                                        className="mt-0.5 size-3.5 shrink-0"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <InfoIcon
                                        className="mt-0.5 size-3.5 shrink-0"
                                        aria-hidden="true"
                                      />
                                    )}
                                    {item.note}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <InfoIcon className="size-4" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-medium">
                        No review items in this run
                      </span>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Nothing is proposed for this cohort, so there is no
                        grade or class placement to confirm.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-popover p-4">
                <span className="mr-auto text-xs text-muted-foreground">
                  {readOnly
                    ? "Read-only sample run"
                    : canConfirm
                      ? "All items resolved. Confirmation is the only step that would apply changes."
                      : `${summary.needsReview} ${
                          summary.needsReview === 1 ? "item needs" : "items need"
                        } review before confirmation.`}
                </span>
                {!readOnly && run.items.length > 0 ? (
                  <Button variant="ghost" onClick={resetDecisions}>
                    Reset decisions
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {!readOnly && run.items.length > 0 ? (
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canConfirm}
                  >
                    Confirm run
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {run ? (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TriangleAlertIcon
                  className="size-4 text-amber-500"
                  aria-hidden="true"
                />
                Confirm promotion run
              </DialogTitle>
              <DialogDescription>
                Review the impact summary for “{run.title}”. No changes occur
                before confirmation.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                <ConfirmField
                  label="Effective date"
                  value={formatDisplayDate(run.effectiveDate)}
                />
                <ConfirmField label="Items" value={String(summary.total)} />
                <ConfirmField label="Branch scope" value={run.scopeBranch} />
                <ConfirmField label="Grade scope" value={run.scopeGrade} />
              </dl>

              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full",
                      decisionStyles.move
                    )}
                  >
                    Move
                  </Badge>
                  <span>
                    {summary.move} — a next-grade class placement is created
                    from {formatDisplayDate(run.effectiveDate)}.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={cn("rounded-full", decisionStyles.stay)}
                  >
                    Stay
                  </Badge>
                  <span>
                    {summary.stay} — the grade advances but the enrollment
                    billing grade is pinned to the current grade.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={cn("rounded-full", decisionStyles.skip)}
                  >
                    Skip
                  </Badge>
                  <span>{summary.skip} — no grade or class change.</span>
                </li>
                {summary.needsReview > 0 ? (
                  <li className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full",
                        decisionStyles.needs_review
                      )}
                    >
                      Review
                    </Badge>
                    <span>
                      {summary.needsReview} — left unchanged until resolved.
                    </span>
                  </li>
                ) : null}
              </ul>

              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Confirmation is the only step that would apply changes. In
                  this UI demo it closes the preview only — no student grade,
                  class enrollment or billing record is changed.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setConfirmOpen(false)
                  onOpenChange(false)
                  onConfirmed(run)
                }}
              >
                Confirm run (demo)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: PromotionDecision
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg border p-3", decisionStyles[tone])}>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: PromotionDecision }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", decisionStyles[decision])}
    >
      {getPromotionDecisionLabel(decision)}
    </Badge>
  )
}

function ConfirmField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}
