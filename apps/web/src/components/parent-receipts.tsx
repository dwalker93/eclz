"use client"

import { useEffect, useState, type ReactNode } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowRightLeftIcon,
  BanIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CircleDollarSignIcon,
  FileDownIcon,
  HashIcon,
  InfoIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  SearchXIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  PaymentMethodBadge,
  ReceiptStatusBadge,
} from "@/components/portal-status-badge"
import { type ParentChild } from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  formatLkr,
  MOCK_TODAY,
  receiptStatusFilterOptions,
  type ReceiptStatus,
  type StudentReceipt,
} from "@/lib/student-portal-data"

function summariseReceipts(receipts: StudentReceipt[]) {
  const issued = receipts.filter((receipt) => receipt.status === "issued")
  const issueDates = receipts
    .map((receipt) => receipt.issuedOn)
    .sort((first, second) => first.localeCompare(second))

  return {
    issuedCount: issued.length,
    voidCount: receipts.filter((receipt) => receipt.status === "void").length,
    receiptedTotal: issued.reduce(
      (total, receipt) => total + receipt.amount,
      0
    ),
    latestIssuedOn: issueDates[issueDates.length - 1] ?? null,
  }
}

export function ParentReceipts() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "all">("all")
  const [detailReceiptId, setDetailReceiptId] = useState<string | null>(null)

  // The header selector changes the child without remounting this page, so the
  // filter and any open receipt must reset to stay child-scoped.
  useEffect(() => {
    setStatusFilter("all")
    setDetailReceiptId(null)
  }, [selectedChild?.id])

  const receipts = (selectedChild?.billing?.receipts ?? [])
    .slice()
    .sort((first, second) => {
      const byDate = second.issuedOn.localeCompare(first.issuedOn)
      return byDate !== 0
        ? byDate
        : second.receiptNo.localeCompare(first.receiptNo)
    })
  const summary = summariseReceipts(receipts)

  const visibleReceipts = receipts.filter(
    (receipt) => statusFilter === "all" || receipt.status === statusFilter
  )
  const detailReceipt = detailReceiptId
    ? (receipts.find((receipt) => receipt.id === detailReceiptId) ?? null)
    : null

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Receipts"
          description="Receipts issued for the child selected in the header. Every receipt links to a verified payment. This parent view is read-only and never shows signatures, hashes or storage details."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
              </Badge>
              {selectedChild ? (
                <Badge variant="outline" className="rounded-full">
                  Viewing {selectedChild.preferredName}
                </Badge>
              ) : null}
            </>
          }
          actions={
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        {linkedChildren.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no receipts to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : selectedChild ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <UserRoundIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {selectedChild.fullName}
              </span>
              <span className="text-muted-foreground">
                Student no. {selectedChild.studentNo}
              </span>
              <span className="text-muted-foreground">
                {selectedChild.grade} · {selectedChild.branch} branch
              </span>
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full sm:ml-auto"
              >
                <ShieldCheckIcon aria-hidden="true" />
                This child only
              </Badge>
            </div>

            {receipts.length === 0 ? (
              <Card className="gap-0 py-0">
                <EmptyState
                  icon={
                    <ReceiptTextIcon className="size-5" aria-hidden="true" />
                  }
                  title={`No receipts for ${selectedChild.preferredName}`}
                  description="A receipt appears here only after a payment is verified. Contact the branch office if you expected a receipt for a payment already made."
                />
              </Card>
            ) : (
              <>
                <Card className="gap-0 py-0">
                  <CardHeader className="border-b px-4 py-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2">
                      <ReceiptTextIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Receipts overview
                    </CardTitle>
                    <CardDescription>
                      Sample totals across {receipts.length}{" "}
                      {receipts.length === 1 ? "receipt" : "receipts"} for{" "}
                      {selectedChild.fullName}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-6">
                    <ReceiptSummaryTile
                      icon={BadgeCheckIcon}
                      label="Issued"
                      value={String(summary.issuedCount)}
                      hint={`${summary.issuedCount === 1 ? "valid receipt" : "valid receipts"}`}
                      tone="emerald"
                    />
                    <ReceiptSummaryTile
                      icon={BanIcon}
                      label="Void"
                      value={String(summary.voidCount)}
                      hint="Kept for the record"
                      tone="muted"
                    />
                    <ReceiptSummaryTile
                      icon={CircleDollarSignIcon}
                      label="Total receipted"
                      value={formatLkr(summary.receiptedTotal)}
                      hint="Issued receipts only"
                      tone="sky"
                    />
                    <ReceiptSummaryTile
                      icon={CalendarClockIcon}
                      label="Latest receipt"
                      value={
                        summary.latestIssuedOn
                          ? formatDisplayDate(summary.latestIssuedOn)
                          : "—"
                      }
                      hint="Most recent issue date"
                      tone="violet"
                    />
                  </CardContent>
                  <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                    Only {selectedChild.preferredName}&apos;s receipts are
                    counted. Void receipts are kept for the record but are not
                    valid proof of payment.
                  </CardFooter>
                </Card>

                <Card className="gap-0 py-0">
                  <CardHeader className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="flex items-center gap-2">
                        <ReceiptTextIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Receipt list
                      </CardTitle>
                      <CardDescription>
                        {selectedChild.preferredName}&apos;s receipts, newest
                        first · {visibleReceipts.length} of {receipts.length}
                      </CardDescription>
                    </div>
                    <Select
                      items={receiptStatusFilterOptions}
                      value={statusFilter}
                      onValueChange={(value) =>
                        setStatusFilter(
                          (value ?? "all") as ReceiptStatus | "all"
                        )
                      }
                    >
                      <SelectTrigger
                        className="w-full sm:w-56"
                        aria-label="Filter receipts by status"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {receiptStatusFilterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardHeader>

                  {visibleReceipts.length === 0 ? (
                    <EmptyState
                      icon={
                        <SearchXIcon className="size-5" aria-hidden="true" />
                      }
                      title="No receipts match this status"
                      description="Try another status filter, or contact the institute office if you expected a receipt here."
                    />
                  ) : (
                    <ul className="divide-y">
                      {visibleReceipts.map((receipt) => (
                        <ReceiptRow
                          key={receipt.id}
                          receipt={receipt}
                          onOpen={() => setDetailReceiptId(receipt.id)}
                        />
                      ))}
                    </ul>
                  )}

                  <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                    Receipts are read-only and belong only to{" "}
                    {selectedChild.fullName}. Contact the Accounts Office if a
                    receipt looks incorrect.
                  </CardFooter>
                </Card>
              </>
            )}

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  These receipts belong only to {selectedChild.fullName}. A
                  receipt is issued only for a verified payment. No receipt is
                  created, voided or reissued from the parent portal, no PDF is
                  generated or downloaded, and no signing key, hash or storage
                  path is ever shown.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <ReceiptDetailDialog
        receipt={detailReceipt}
        child={selectedChild}
        onOpenChange={(open) => {
          if (!open) setDetailReceiptId(null)
        }}
      />
    </main>
  )
}

function ReceiptSummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: "emerald" | "muted" | "sky" | "violet"
}) {
  const toneClasses = {
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    muted: "border-border bg-muted/30 text-muted-foreground",
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
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
        <p className="text-sm leading-tight font-semibold tabular-nums sm:text-base">
          {value}
        </p>
        <Icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
      </div>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function ReceiptRow({
  receipt,
  onOpen,
}: {
  receipt: StudentReceipt
  onOpen: () => void
}) {
  const isVoid = receipt.status === "void"

  return (
    <li
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6",
        isVoid && "bg-muted/20"
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
            isVoid && "opacity-60"
          )}
        >
          <ReceiptTextIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{receipt.receiptNo}</span>
            <ReceiptStatusBadge status={receipt.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {receipt.branch} branch · issued{" "}
            {formatDisplayDate(receipt.issuedOn)}
            {receipt.invoiceNo ? ` · ${receipt.invoiceNo}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <PaymentMethodBadge method={receipt.method} />
            <span className="text-xs text-muted-foreground">
              {receipt.reference}
            </span>
          </div>
          {receipt.replacedByReceiptNo ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRightLeftIcon className="size-3.5" aria-hidden="true" />
              Replaced by {receipt.replacedByReceiptNo}
            </p>
          ) : null}
          {receipt.replacesReceiptNo ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRightLeftIcon className="size-3.5" aria-hidden="true" />
              Replaces {receipt.replacesReceiptNo}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            isVoid && "text-muted-foreground line-through"
          )}
        >
          {formatLkr(receipt.amount)}
        </span>
        <Button variant="outline" size="xs" onClick={onOpen}>
          View receipt
        </Button>
      </div>
    </li>
  )
}

function ReceiptDetailDialog({
  receipt,
  child,
  onOpenChange,
}: {
  receipt: StudentReceipt | null
  child: ParentChild | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={receipt !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {receipt ? (
          <ReceiptDetailBody key={receipt.id} receipt={receipt} child={child} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ReceiptDetailBody({
  receipt,
  child,
}: {
  receipt: StudentReceipt
  child: ParentChild | null
}) {
  const isVoid = receipt.status === "void"

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptStatusBadge status={receipt.status} />
          <Badge variant="outline" className="rounded-full">
            {receipt.receiptNo}
          </Badge>
        </div>
        <DialogTitle className="text-lg">Payment receipt</DialogTitle>
        <DialogDescription>
          Issued {formatDisplayDate(receipt.issuedOn)} for a verified payment.
        </DialogDescription>
      </DialogHeader>

      {isVoid ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            This receipt is void and is not a valid proof of payment.
            {receipt.replacedByReceiptNo
              ? ` It was replaced by ${receipt.replacedByReceiptNo}.`
              : ""}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              ECLZ Institute
            </p>
            <p className="text-sm font-semibold">Official payment receipt</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Receipt no.</p>
            <p className="text-sm font-medium">{receipt.receiptNo}</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <DetailField
            label="Child"
            value={
              child ? `${child.fullName} · ${child.studentNo}` : "Linked child"
            }
          />
          <DetailField label="Branch" value={`${receipt.branch} branch`} />
          <DetailField
            label="Issued"
            value={formatDisplayDate(receipt.issuedOn)}
          />
          <DetailField label="Amount" value={formatLkr(receipt.amount)} />
          <DetailField label="Method">
            <PaymentMethodBadge method={receipt.method} />
          </DetailField>
          <DetailField label="Reference" value={receipt.reference} />
          {receipt.invoiceNo ? (
            <DetailField label="Invoice" value={receipt.invoiceNo} />
          ) : null}
          <DetailField label="Status" value={isVoid ? "Void" : "Issued"} />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <HashIcon className="size-3.5" aria-hidden="true" />
            Verification code
          </p>
          <p className="font-mono text-base font-semibold tracking-wider">
            {receipt.verificationCode}
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <QrCodeIcon className="size-6" aria-hidden="true" />
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              A verification QR placeholder would appear here. Share the
              verification code with the branch to confirm the receipt.
              Signatures, content hashes and storage details are never shown.
            </p>
          </div>
        </div>

        {receipt.replacesReceiptNo ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRightLeftIcon className="size-3.5" aria-hidden="true" />
            This receipt replaces {receipt.replacesReceiptNo}.
          </p>
        ) : null}

        {receipt.note ? (
          <p className="rounded-lg border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {receipt.note}
          </p>
        ) : null}
      </div>

      <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
        <Button
          variant="outline"
          disabled
          className="w-full sm:w-auto sm:self-end"
        >
          <FileDownIcon data-icon="inline-start" aria-hidden="true" />
          Download PDF
        </Button>
        <p className="text-xs text-muted-foreground sm:text-right">
          Downloads are disabled in this preview. No file is generated, stored
          or sent.
        </p>
      </DialogFooter>
    </>
  )
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children ?? <span className="text-sm font-medium">{value}</span>}
    </div>
  )
}
