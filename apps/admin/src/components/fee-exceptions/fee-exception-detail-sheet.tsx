"use client"

import { useEffect, useRef, useState } from "react"
import type { FormEvent, ReactNode } from "react"

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
import { Textarea } from "@workspace/ui/components/textarea"
import {
  CalendarRangeIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  PercentIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  StopCircleIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  FeeExceptionKindBadge,
  FeeExceptionStatusBadge,
} from "@/components/fee-exceptions/fee-exception-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  formatExceptionEffect,
  type FeeExceptionRecord,
} from "@/lib/fee-exceptions-data"
import { formatDisplayDate } from "@/lib/students-data"

type FeeExceptionDetailSheetProps = {
  exception: FeeExceptionRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotice: (message: string) => void
  onEdit: (exception: FeeExceptionRecord) => void
}

export function FeeExceptionDetailSheet({
  exception,
  open,
  onOpenChange,
  onNotice,
  onEdit,
}: FeeExceptionDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [endOpen, setEndOpen] = useState(false)

  const reduction =
    exception && exception.originalFeeAmount > 0
      ? Math.round(
          ((exception.originalFeeAmount - exception.resultingAmount) /
            exception.originalFeeAmount) *
            100
        )
      : 0

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          initialFocus={headerRef}
          className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        >
          {exception ? (
            <>
              <SheetHeader
                ref={headerRef}
                tabIndex={-1}
                className="border-b p-6 pr-14 outline-none"
              >
                <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <PercentIcon className="size-5" aria-hidden="true" />
                  Fee exception
                  <FeeExceptionStatusBadge status={exception.status} />
                </SheetTitle>
                <SheetDescription>
                  {exception.studentName} · {exception.courseName} ·{" "}
                  {formatExceptionEffect(exception)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 p-6">
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<UserRoundIcon />}
                    title="Enrollment"
                    aside={
                      <Badge variant="outline" className="rounded-full">
                        {exception.branchName}
                      </Badge>
                    }
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailField
                      label="Student"
                      value={`${exception.studentName} · ${exception.studentNo}`}
                    />
                    <DetailField label="Course" value={exception.courseName} />
                    <DetailField
                      label="Enrollment ID"
                      value={exception.enrollmentId}
                      mono
                    />
                    <DetailField
                      label="Branch"
                      value={exception.branchName}
                    />
                    <DetailField
                      label="Kind"
                      value={
                        <FeeExceptionKindBadge kind={exception.kind} />
                      }
                    />
                    <DetailField
                      label="Status"
                      value={
                        <FeeExceptionStatusBadge status={exception.status} />
                      }
                    />
                  </dl>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<PercentIcon />}
                    title="Fee effect"
                    aside={
                      <Badge
                        variant="outline"
                        className="rounded-full text-muted-foreground"
                      >
                        Illustrative only
                      </Badge>
                    }
                  />
                  <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Original fee
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatLkr(exception.originalFeeAmount)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Resulting amount
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatLkr(exception.resultingAmount)}
                      </span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailField
                      label="Exception"
                      value={formatExceptionEffect(exception)}
                    />
                    <DetailField
                      label="Reduction"
                      value={reduction > 0 ? `${reduction}% lower` : "No reduction"}
                    />
                    {exception.kind === "alternate_option" ? (
                      <DetailField
                        label="Alternate fee structure"
                        value={
                          exception.alternateFeeStructureName ??
                          "Alternate fee option"
                        }
                      />
                    ) : (
                      <DetailField
                        label="Discount"
                        value={
                          exception.discountType === "percent"
                            ? `${exception.discountValue ?? 0}%`
                            : formatLkr(exception.discountValue ?? 0)
                        }
                      />
                    )}
                    <DetailField
                      label="Effectivity"
                      value={formatRange(
                        exception.effectiveFrom,
                        exception.effectiveTo
                      )}
                    />
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    The resulting amount is a local illustration. No invoice or
                    balance is recalculated on this page.
                  </p>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<CalendarRangeIcon />}
                    title="Reason &amp; audit"
                  />
                  <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Reason
                    </span>
                    <p>{exception.reason}</p>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                    <DetailField
                      label="Created by"
                      value={exception.createdByLabel}
                    />
                    <DetailField
                      label="Created on"
                      value={formatDisplayDate(exception.createdAt)}
                    />
                    {exception.endedAt ? (
                      <>
                        <DetailField
                          label="Ended by"
                          value={exception.endedByLabel ?? "—"}
                        />
                        <DetailField
                          label="Ended on"
                          value={formatDisplayDate(exception.endedAt)}
                        />
                      </>
                    ) : null}
                  </dl>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<ShieldCheckIcon />}
                    title="Rules &amp; module state"
                  />
                  <ul className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <li className="flex items-start gap-1.5">
                      <RepeatIcon
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      An alternate fee option must belong to the same course as
                      the enrollment.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <InfoIcon
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      Existing active exceptions keep applying if the fee
                      exceptions module is switched off.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CircleAlertIcon
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      Editing an exception does not change history; ending one
                      keeps the record for audit.
                    </li>
                  </ul>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
                <span className="text-xs text-muted-foreground">
                  Sample exception · no changes are saved
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {exception.status !== "ended" ? (
                    <Button
                      variant="outline"
                      onClick={() => setEndOpen(true)}
                    >
                      <StopCircleIcon data-icon="inline-start" />
                      End exception (demo)
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => onEdit(exception)}>
                    <SquarePenIcon data-icon="inline-start" />
                    Edit (demo)
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

      <EndExceptionDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        exception={exception}
        onDone={(message) => onNotice(message)}
      />
    </>
  )
}

function EndExceptionDialog({
  open,
  onOpenChange,
  exception,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exception: FeeExceptionRecord | null
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setReason("")
    setError(null)
    setSubmitted(false)
  }, [open])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!reason.trim()) {
      setError("A reason is required to end an exception.")
      return
    }

    setError(null)
    setSubmitted(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StopCircleIcon className="size-4" aria-hidden="true" />
            End fee exception
          </DialogTitle>
          <DialogDescription>
            {exception
              ? `This action applies to ${exception.studentName} · ${exception.courseName}. It is a UI preview — nothing is changed.`
              : "This action is a UI preview — nothing is changed."}
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
                <span className="text-sm font-medium">
                  End exception preview ready
                </span>
                <p className="text-sm">
                  The exception would stop applying from today and the record
                  would stay for audit.
                </p>
              </div>
            </div>
            <dl className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reason
                </dt>
                <dd>{reason.trim()}</dd>
              </div>
            </dl>
            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo only. No exception is ended and no fee is recalculated.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="fex-end-form"
            className="flex flex-col gap-3"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fex-end-reason" className="text-sm font-medium">
                Reason{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Textarea
                id="fex-end-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Sibling left the institute; concession no longer applies"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "fex-end-reason-error" : undefined}
              />
              {error ? (
                <p id="fex-end-reason-error" className="text-xs text-destructive">
                  {error}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A reason is required. The record is kept for audit.
                </p>
              )}
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Back to form
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onDone(
                    "End exception preview closed. Nothing was ended — this is a UI demo."
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
              <Button type="submit" form="fex-end-form" variant="destructive">
                End exception (demo)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatRange(from: string, to: string | null) {
  return `${formatDisplayDate(from)} → ${to ? formatDisplayDate(to) : "open-ended"}`
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
