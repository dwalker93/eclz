"use client"

import { useEffect, useRef } from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BanknoteIcon,
  BadgeCheckIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CoinsIcon,
  DownloadIcon,
  FilePenIcon,
  FileTextIcon,
  HandCoinsIcon,
  InfoIcon,
  LockIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react"

import { PayoutStatusBadge } from "@/components/teacher-payouts/payout-status-badge"
import { formatLkr } from "@/lib/courses-data"
import { formatDateTime, formatDisplayDate } from "@/lib/students-data"
import {
  formatPayoutAmount,
  getPayoutEntryGroups,
  getPayoutPeriodLabel,
  payoutStatusHints,
  type CommissionEntryRecord,
  type TeacherPayoutRecord,
} from "@/lib/teacher-payouts-data"

export type PayoutAction = "preview" | "approve" | "pay" | "discard"

type PayoutDetailSheetProps = {
  payout: TeacherPayoutRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (action: PayoutAction, payout: TeacherPayoutRecord) => void
  onNotice: (message: string) => void
}

export function PayoutDetailSheet({
  payout,
  open,
  onOpenChange,
  onAction,
  onNotice,
}: PayoutDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    headerRef.current?.scrollIntoView({ block: "start" })
  }, [payout?.id])

  const groups = payout ? getPayoutEntryGroups(payout) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        {payout && groups ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                <HandCoinsIcon className="size-5" aria-hidden="true" />
                {payout.lecturerName}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <PayoutStatusBadge status={payout.status} />
                <Badge variant="outline" className="rounded-full font-mono">
                  {payout.payoutNo}
                </Badge>
                <span>{getPayoutPeriodLabel(payout.periodId)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <StatusNotice payout={payout} />

              <section className="flex flex-col gap-3">
                <SectionHeading icon={<InfoIcon />} title="Payout summary" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                  <DetailField
                    label="Lecturer"
                    value={
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <UserRoundIcon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {payout.lecturerName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {payout.lecturerQualification}
                        </span>
                      </span>
                    }
                  />
                  <DetailField
                    label="Period"
                    value={
                      <span className="flex flex-col gap-0.5">
                        <span>{getPayoutPeriodLabel(payout.periodId)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDisplayDate(payout.periodStart)} –{" "}
                          {formatDisplayDate(payout.periodEnd)}
                        </span>
                      </span>
                    }
                  />
                  <DetailField
                    label="Gross collected"
                    value={
                      <span className="tabular-nums">
                        {formatLkr(payout.grossCollected)}
                      </span>
                    }
                  />
                  <DetailField
                    label="Commission base (after reversals)"
                    value={
                      <span className="tabular-nums">
                        {formatPayoutAmount(payout.commissionBase)}
                      </span>
                    }
                  />
                  <DetailField
                    label="Institute commission"
                    value={
                      <span className="tabular-nums">
                        {formatPayoutAmount(payout.commissionAmount)}
                      </span>
                    }
                  />
                  <DetailField
                    label="Lecturer share"
                    value={
                      <span className="tabular-nums">
                        {formatPayoutAmount(payout.teacherTotal)}
                      </span>
                    }
                  />
                  <DetailField
                    label="Carry-forward in"
                    value={
                      <span className="tabular-nums">
                        {payout.carryForwardIn === 0
                          ? "None"
                          : formatPayoutAmount(payout.carryForwardIn)}
                      </span>
                    }
                  />
                  <DetailField
                    label="Net payable"
                    value={
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold tabular-nums">
                          {formatLkr(payout.amountDue)}
                        </span>
                        {payout.carryForwardOut < 0 ? (
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            {formatPayoutAmount(payout.carryForwardOut)} carries
                            forward
                          </span>
                        ) : null}
                      </span>
                    }
                  />
                  <DetailField
                    label="Created"
                    value={formatDateTime(payout.createdAt)}
                  />
                  <DetailField
                    label="Entries"
                    value={`${payout.entries.length} total · ${groups.accruals.length} accrued · ${groups.reversals.length} reversed`}
                  />
                </dl>
              </section>

              {payout.carryForwardIn < 0 || payout.carryForwardOut < 0 ? (
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<RotateCcwIcon />}
                    title="Carry-forward"
                    aside={
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
                      >
                        Negative reversal
                      </Badge>
                    }
                  />
                  <div className="flex flex-col gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-4 text-sm">
                    {payout.carryForwardIn < 0 ? (
                      <div className="flex items-start gap-2">
                        <ArrowDownIcon
                          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                          aria-hidden="true"
                        />
                        <p>
                          <span className="font-medium">
                            {formatPayoutAmount(payout.carryForwardIn)}
                          </span>{" "}
                          was carried in from an earlier period&apos;s late
                          reversal and is deducted before this payout.
                        </p>
                      </div>
                    ) : null}
                    {payout.carryForwardOut < 0 ? (
                      <div className="flex items-start gap-2">
                        <ArrowUpIcon
                          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                          aria-hidden="true"
                        />
                        <p>
                          This period&apos;s reversals exceed the
                          lecturer&apos;s available earnings. Net payable is{" "}
                          <span className="font-medium">LKR 0</span>, and{" "}
                          <span className="font-medium">
                            {formatPayoutAmount(payout.carryForwardOut)}
                          </span>{" "}
                          would carry forward to the lecturer&apos;s next
                          payout.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Carry-forward is shown for context only. No balance is
                      moved or saved in this demo.
                    </p>
                  </div>
                </section>
              ) : null}

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CoinsIcon />}
                  title="Accrued entries"
                  aside={
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {groups.accruals.length}{" "}
                      {groups.accruals.length === 1 ? "entry" : "entries"} ·{" "}
                      {formatLkr(groups.accrualTotals.teacher)} lecturer share
                    </span>
                  }
                />
                <EntryTable
                  entries={groups.accruals}
                  emptyMessage="No accrued entries in this period."
                />
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<RotateCcwIcon />}
                  title="Reversal entries"
                  aside={
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {groups.reversals.length}{" "}
                      {groups.reversals.length === 1 ? "entry" : "entries"} ·{" "}
                      {formatPayoutAmount(groups.reversalTotals.teacher)}{" "}
                      lecturer share
                    </span>
                  }
                />
                <EntryTable
                  entries={groups.reversals}
                  emptyMessage="No reversal entries in this period."
                />
                <p className="text-xs text-muted-foreground">
                  Reversal entries reduce the base and the commission share.
                  They are never edited into a paid payout; a later correction
                  is a new entry in the next open period.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ReceiptTextIcon />}
                  title="Payout trail"
                />
                <ol className="flex flex-col divide-y rounded-lg border">
                  <TrailRow
                    icon={<FilePenIcon />}
                    label="Draft created"
                    value={formatDateTime(payout.createdAt)}
                    done
                  />
                  <TrailRow
                    icon={<BadgeCheckIcon />}
                    label="Approved"
                    value={
                      payout.approvedAt
                        ? `${formatDateTime(payout.approvedAt)} · ${
                            payout.approvedBy ?? "Accounts"
                          }`
                        : "Not approved yet"
                    }
                    done={Boolean(payout.approvedAt)}
                  />
                  <TrailRow
                    icon={<BanknoteIcon />}
                    label="Paid"
                    value={
                      payout.paidAt
                        ? `${formatDateTime(payout.paidAt)} · ${
                            payout.paidBy ?? "Accounts"
                          }`
                        : "Not paid yet"
                    }
                    done={Boolean(payout.paidAt)}
                  />
                </ol>
              </section>

              {payout.status === "paid" ? (
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<ShieldCheckIcon />}
                    title="Payment details"
                    aside={
                      <Badge variant="outline" className="rounded-full">
                        <LockIcon aria-hidden="true" />
                        Immutable
                      </Badge>
                    }
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <DetailField
                      label="Payment reference"
                      value={
                        <span className="font-mono">
                          {payout.paymentReference ?? "—"}
                        </span>
                      }
                    />
                    <DetailField
                      label="Method"
                      value={payout.paymentMethod ?? "—"}
                    />
                    <DetailField
                      label="Paid on"
                      value={formatDateTime(payout.paidAt)}
                    />
                    <DetailField
                      label="Proof"
                      value={
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1.5">
                            <FileTextIcon
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            {payout.proofFileName ?? "No proof attached"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onNotice(
                                `Downloading ${payout.proofFileName ?? "the payout proof"} is a placeholder in this UI demo. No file was generated.`
                              )
                            }
                          >
                            <DownloadIcon data-icon="inline-start" />
                            Download
                          </Button>
                        </span>
                      }
                    />
                  </dl>
                </section>
              ) : null}

              <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                <HandCoinsIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Sample payout data only. Totals are illustrative, no
                  commission is calculated, and no money is moved by this page.
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                {payoutStatusHints[payout.status]}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {payout.status === "draft" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onAction("preview", payout)}
                    >
                      <FileTextIcon data-icon="inline-start" />
                      Preview draft
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onAction("discard", payout)}
                    >
                      <TriangleAlertIcon data-icon="inline-start" />
                      Discard draft
                    </Button>
                    <Button onClick={() => onAction("approve", payout)}>
                      <BadgeCheckIcon data-icon="inline-start" />
                      Approve payout
                    </Button>
                  </>
                ) : payout.status === "approved" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onAction("preview", payout)}
                    >
                      <FileTextIcon data-icon="inline-start" />
                      Preview
                    </Button>
                    <Button onClick={() => onAction("pay", payout)}>
                      <BanknoteIcon data-icon="inline-start" />
                      Pay payout
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function StatusNotice({ payout }: { payout: TeacherPayoutRecord }) {
  if (payout.status === "paid") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
        <CheckCircle2Icon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Paid payout · immutable</span>
          <span>
            The payment reference and proof are recorded against this payout.
            Paid totals cannot be edited; a later correction would be a new
            reversal entry in an open period.
          </span>
        </div>
      </div>
    )
  }

  if (payout.status === "approved") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-sky-600/20 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-800 dark:text-sky-300">
        <BadgeCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Approved · totals frozen</span>
          <span>
            Approval locked the entries and totals shown here. The next step is
            payment; no further edits are possible in this preview.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
      <FilePenIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">Draft · totals can still change</span>
        <span>
          Review the accrued and reversal entries before approving. Approval
          freezes these totals; payment follows afterwards.
        </span>
      </div>
    </div>
  )
}

function EntryTable({
  entries,
  emptyMessage,
}: {
  entries: CommissionEntryRecord[]
  emptyMessage: string
}) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-3">Student / course</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Rule snapshot</TableHead>
            <TableHead className="text-right">Base</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead className="pr-3 text-right">Lecturer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="pl-3">
                <div className="flex max-w-[220px] flex-col gap-0.5">
                  <span className="font-medium">{entry.studentName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.courseName} · {entry.invoiceNo}
                  </span>
                  {entry.note ? (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {entry.note}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDisplayDate(entry.occurredOn)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {entry.ruleLabel}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPayoutAmount(entry.baseAmount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPayoutAmount(entry.commissionAmount)}
              </TableCell>
              <TableCell className="pr-3 text-right tabular-nums">
                {formatPayoutAmount(entry.teacherAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function TrailRow({
  icon,
  label,
  value,
  done,
}: {
  icon: ReactNode
  label: string
  value: string
  done: boolean
}) {
  return (
    <li className="flex items-start gap-3 p-3">
      <span
        className={
          done
            ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&>svg]:size-3.5"
            : "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-3.5"
        }
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{value}</span>
      </div>
      {done ? (
        <CheckCircle2Icon
          className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      ) : (
        <CalendarDaysIcon
          className="mt-1 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </li>
  )
}
