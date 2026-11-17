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
  BanIcon,
  BanknoteIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CopyIcon,
  CreditCardIcon,
  FileImageIcon,
  InfoIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  Undo2Icon,
  WalletIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react"

import { PaymentMethodLabel } from "@/components/payments/payment-method-label"
import {
  GatewayStatusBadge,
  PaymentStatusBadge,
} from "@/components/payments/payment-status-badge"
import { formatLkr } from "@/lib/courses-data"
import { paymentMethodLabels, paymentStatusLabels } from "@/lib/invoices-data"
import {
  getActiveAllocations,
  getCommissionPreview,
  getTargetInvoiceNumbers,
  type PaymentRecord,
} from "@/lib/payments-data"
import { formatDateTime, getInitials } from "@/lib/students-data"

type PaymentDetailSheetProps = {
  payment: PaymentRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerify: (payment: PaymentRecord) => void
  onReject: (payment: PaymentRecord) => void
  onVoid: (payment: PaymentRecord) => void
  onAdjustAllocation: (payment: PaymentRecord) => void
  onCopy: (payment: PaymentRecord) => void
}

export function PaymentDetailSheet({
  payment,
  open,
  onOpenChange,
  onVerify,
  onReject,
  onVoid,
  onAdjustAllocation,
  onCopy,
}: PaymentDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const activeAllocations = payment ? getActiveAllocations(payment) : []
  const activeAllocatedTotal = activeAllocations.reduce(
    (total, allocation) => total + allocation.amount,
    0
  )
  const reversedAllocatedTotal = payment
    ? payment.allocations.reduce(
        (total, allocation) => total + allocation.amount,
        0
      ) - activeAllocatedTotal
    : 0
  const unallocatedTotal = payment
    ? Math.max(payment.amount - activeAllocatedTotal, 0)
    : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        {payment ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {payment.referenceNo ?? payment.id}
                <PaymentStatusBadge status={payment.status} />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Payment {payment.referenceNo ?? payment.id} submitted by{" "}
                {payment.studentName}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {getInitials(payment.studentName)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">
                    {payment.studentName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {payment.studentNo} · {payment.branchName} branch
                  </span>
                </span>
                <PaymentMethodLabel method={payment.method} />
                {payment.source === "cashier" ? (
                  <Badge variant="outline" className="rounded-full">
                    Cash recorded at desk
                  </Badge>
                ) : null}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat
                  label="Amount"
                  value={formatLkr(payment.amount)}
                  strong
                />
                <SummaryStat
                  label="Submitted"
                  value={formatDateTime(payment.submittedAt)}
                />
                <SummaryStat
                  label="Target invoices"
                  value={String(getTargetInvoiceNumbers(payment).length)}
                />
                <SummaryStat
                  label="Receipt"
                  value={
                    payment.receiptNo
                      ? payment.status === "voided"
                        ? `${payment.receiptNo} (reversed)`
                        : payment.receiptNo
                      : "Not issued"
                  }
                  tone={
                    payment.status === "voided" || !payment.receiptNo
                      ? "warn"
                      : "default"
                  }
                />
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<WalletIcon />}
                  title="Payment information"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField
                    label="Method"
                    value={paymentMethodLabels[payment.method]}
                  />
                  <ProfileField
                    label="Reference"
                    value={payment.referenceNo ?? payment.id}
                  />
                  <ProfileField
                    label="Status"
                    value={paymentStatusLabels[payment.status]}
                  />
                  <ProfileField
                    label="Submitted by"
                    value={payment.submittedByLabel.split(" · ")[0]}
                  />
                  <ProfileField
                    label="Submitted via"
                    value={payment.submittedVia}
                  />
                  <ProfileField
                    label="Submitted on"
                    value={formatDateTime(payment.submittedAt)}
                  />
                  {payment.cashRecordedBy ? (
                    <ProfileField
                      label="Cash received by"
                      value={payment.cashRecordedBy}
                    />
                  ) : null}
                  {payment.bankAccount ? (
                    <>
                      <ProfileField
                        label="Bank"
                        value={payment.bankAccount.bankName}
                      />
                      <ProfileField
                        label="Account"
                        value={`${payment.bankAccount.accountName} · ${payment.bankAccount.maskedNumber}`}
                      />
                      <ProfileField
                        label="Bank branch"
                        value={payment.bankAccount.branchName}
                      />
                    </>
                  ) : null}
                  {payment.gatewayTransaction ? (
                    <>
                      <ProfileField
                        label="Gateway"
                        value={payment.gatewayTransaction.provider}
                      />
                      <ProfileField
                        label="Provider ref"
                        value={payment.gatewayTransaction.providerRef}
                      />
                      <ProfileField
                        label="Gateway status"
                        value={
                          <GatewayStatusBadge
                            status={payment.gatewayTransaction.status}
                          />
                        }
                      />
                    </>
                  ) : null}
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<FileImageIcon />}
                  title="Proof / slip preview"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      Placeholder
                    </Badge>
                  }
                />
                {payment.slip ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <FileImageIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {payment.slip.fileName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {payment.slip.mimeType} · {payment.slip.sizeLabel} ·
                          uploaded {formatDateTime(payment.slip.uploadedAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Slip preview is a placeholder. No file is opened,
                      downloaded or stored by this demo.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {payment.method === "cash" ? (
                        <BanknoteIcon className="size-5" aria-hidden="true" />
                      ) : payment.method === "bank_transfer" ? (
                        <LandmarkIcon className="size-5" aria-hidden="true" />
                      ) : (
                        <CreditCardIcon className="size-5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">
                        {getProofPlaceholder(payment).title}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {getProofPlaceholder(payment).description}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ReceiptTextIcon />}
                  title="Invoice allocation split"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {activeAllocations.length}{" "}
                      {payment.status === "pending_verification"
                        ? "proposed"
                        : "active"}
                    </Badge>
                  }
                />
                {payment.allocations.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Invoice</th>
                          <th className="px-3 py-2 font-medium">
                            Invoice line
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payment.allocations.map((allocation) => (
                          <tr key={allocation.id}>
                            <td className="px-3 py-2.5 align-top">
                              <span className="font-medium">
                                {allocation.invoiceNo}
                              </span>
                              {allocation.reversedAt ? (
                                <Badge
                                  variant="outline"
                                  className="ml-2 rounded-full text-muted-foreground"
                                >
                                  Reversed
                                </Badge>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 align-top text-muted-foreground">
                              {allocation.itemDescription}
                            </td>
                            <td className="px-3 py-2.5 text-right align-top tabular-nums">
                              {formatLkr(allocation.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30">
                        <tr>
                          <td className="px-3 py-2 font-medium" colSpan={2}>
                            {payment.status === "pending_verification"
                              ? "Proposed allocation"
                              : "Active allocated"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {formatLkr(activeAllocatedTotal)}
                          </td>
                        </tr>
                        {reversedAllocatedTotal > 0 ? (
                          <tr>
                            <td
                              className="px-3 py-2 text-muted-foreground"
                              colSpan={2}
                            >
                              Reversed
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                              {formatLkr(reversedAllocatedTotal)}
                            </td>
                          </tr>
                        ) : null}
                        {payment.status !== "voided" ? (
                          <tr>
                            <td
                              className="px-3 py-2 text-muted-foreground"
                              colSpan={2}
                            >
                              Unallocated
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatLkr(unallocatedTotal)}
                            </td>
                          </tr>
                        ) : null}
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {payment.status === "rejected"
                        ? "This payment was rejected, so no invoice allocation exists."
                        : "No allocation has been recorded for this payment yet."}
                    </span>
                  </div>
                )}
                {payment.status === "pending_verification" ? (
                  <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      The split above is a proposed allocation. It only becomes
                      an active allocation after a payment handler verifies the
                      payment.
                    </span>
                  </div>
                ) : null}
              </section>

              {payment.gatewayTransaction ? (
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<CreditCardIcon />}
                    title="Gateway transaction"
                    aside={
                      <GatewayStatusBadge
                        status={payment.gatewayTransaction.status}
                      />
                    }
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                    <ProfileField
                      label="Provider"
                      value={payment.gatewayTransaction.provider}
                    />
                    <ProfileField
                      label="Provider reference"
                      value={payment.gatewayTransaction.providerRef}
                    />
                    <ProfileField
                      label="Initiated"
                      value={formatDateTime(
                        payment.gatewayTransaction.initiatedAt
                      )}
                    />
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {payment.gatewayTransaction.note} Raw callback data is not
                    shown in this demo.
                  </p>
                </section>
              ) : null}

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ShieldCheckIcon />}
                  title="Verification & audit trail"
                />
                <ol className="flex flex-col gap-3">
                  <TimelineItem
                    icon={<CalendarClockIcon />}
                    title="Payment submitted"
                    at={formatDateTime(payment.submittedAt)}
                    description={`${payment.submittedByLabel.split(" · ")[0]} · ${payment.submittedVia}`}
                  />
                  {payment.verifiedAt ? (
                    <TimelineItem
                      icon={<CheckCircle2Icon />}
                      title="Payment verified"
                      at={formatDateTime(payment.verifiedAt)}
                      description={
                        payment.verifiedByLabel
                          ? `Verified by ${payment.verifiedByLabel}`
                          : "Verified by a payment handler"
                      }
                    />
                  ) : null}
                  {payment.rejectionReason ? (
                    <TimelineItem
                      icon={<XCircleIcon />}
                      title="Payment rejected"
                      at={formatDateTime(payment.rejectedAt)}
                      description={`${payment.rejectedByLabel ?? "Payment handler"} · ${payment.rejectionReason}`}
                      tone="danger"
                    />
                  ) : null}
                  {payment.voidReason ? (
                    <TimelineItem
                      icon={<Undo2Icon />}
                      title="Payment voided"
                      at={formatDateTime(payment.voidedAt)}
                      description={`${payment.voidedByLabel ?? "Payment handler"} · ${payment.voidReason}`}
                      tone="danger"
                    />
                  ) : null}
                  {payment.status === "pending_verification" ? (
                    <TimelineItem
                      icon={<InfoIcon />}
                      title="Awaiting verification"
                      at="Not yet reviewed"
                      description="A payment handler must verify the reference, slip and allocation before a receipt is issued."
                      tone="warn"
                    />
                  ) : null}
                </ol>
              </section>

              <section className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Receipt side effect
                  </span>
                  <span className="text-sm">
                    {getReceiptSideEffect(payment)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Commission side effect
                  </span>
                  <span className="text-sm">
                    {getCommissionSideEffect(payment)}
                  </span>
                </div>
              </section>

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  All values on this page are local sample data. Verifying,
                  rejecting, voiding or adjusting an allocation only opens a
                  preview and never persists to the database.
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <Button variant="outline" onClick={() => onCopy(payment)}>
                <CopyIcon data-icon="inline-start" />
                Copy reference
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {payment.status === "pending_verification" ? (
                  <>
                    <Button variant="outline" onClick={() => onReject(payment)}>
                      <XCircleIcon data-icon="inline-start" />
                      Reject
                    </Button>
                    <Button onClick={() => onVerify(payment)}>
                      <CheckCircle2Icon data-icon="inline-start" />
                      Verify payment
                    </Button>
                  </>
                ) : null}
                {payment.status === "verified" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onAdjustAllocation(payment)}
                    >
                      <WrenchIcon data-icon="inline-start" />
                      Adjust allocation
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => onVoid(payment)}
                    >
                      <BanIcon data-icon="inline-start" />
                      Void payment
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function getProofPlaceholder(payment: PaymentRecord) {
  if (payment.method === "cash") {
    return {
      title: "Cash counted at the front desk",
      description:
        "Cash payments do not need a bank slip. The desk records the cashier and the receipt is issued immediately in this preview.",
    }
  }

  if (payment.method === "bank_transfer") {
    return {
      title: "No bank slip attached",
      description:
        "This sample payment has no uploaded proof. A payment handler would check the bank statement before verifying.",
    }
  }

  const status = payment.gatewayTransaction?.status

  if (status === "failed") {
    return {
      title: "Gateway payment failed",
      description:
        "The provider did not capture funds. The failed attempt stays in the register for audit.",
    }
  }

  if (status === "cancelled") {
    return {
      title: "Gateway payment cancelled",
      description:
        "The provider capture was cancelled or reversed. The transaction record stays for audit.",
    }
  }

  if (status === "initiated") {
    return {
      title: "Gateway payment initiated",
      description:
        "The provider has not confirmed the capture yet. Staff verification should wait for confirmation.",
    }
  }

  return {
    title: "Gateway confirmation captured",
    description:
      "No manual slip is required. The gateway transaction and provider reference are shown below.",
  }
}

function getReceiptSideEffect(payment: PaymentRecord) {
  if (payment.status === "verified") {
    return payment.receiptNo
      ? `${payment.receiptNo} was issued when this payment was verified.`
      : "A receipt was issued when this payment was verified."
  }

  if (payment.status === "voided") {
    return payment.receiptNo
      ? `${payment.receiptNo} was issued at verification and reversed when the payment was voided.`
      : "The receipt issued at verification was reversed when the payment was voided."
  }

  if (payment.status === "rejected") {
    return "No receipt was issued because this payment was rejected."
  }

  return "A receipt would be issued only after a payment handler verifies this payment."
}

function getCommissionSideEffect(payment: PaymentRecord) {
  if (payment.status === "voided") {
    return "Commission entries linked to this payment were reversed with the void."
  }

  if (payment.status === "rejected") {
    return "No commission entries were created for this rejected payment."
  }

  const commission = getCommissionPreview(payment)

  if (commission.entries === 0) {
    return payment.status === "pending_verification"
      ? "No commission entries would be created from the proposed allocation."
      : "No commission entries while the payment has no active allocation."
  }

  const entries = `${commission.entries} commission ${commission.entries === 1 ? "entry" : "entries"}`

  return payment.status === "pending_verification"
    ? `${entries} would be created after verification · illustrative ${formatLkr(commission.estimatedAmount)} (module-dependent).`
    : `${entries} · illustrative ${formatLkr(commission.estimatedAmount)} (module-dependent).`
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
  tone = "default",
}: {
  label: string
  value: string
  strong?: boolean
  tone?: "default" | "warn"
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`truncate text-sm tabular-nums ${strong ? "text-base font-semibold" : ""} ${
          tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

function TimelineItem({
  icon,
  title,
  at,
  description,
  tone = "default",
}: {
  icon: ReactNode
  title: string
  at: string
  description: string
  tone?: "default" | "warn" | "danger"
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400"

  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted [&>svg]:size-4 ${toneClass}`}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{at}</span>
        </div>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </li>
  )
}
