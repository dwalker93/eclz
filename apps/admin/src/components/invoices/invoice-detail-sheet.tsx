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
  CalendarDaysIcon,
  CreditCardIcon,
  InfoIcon,
  LockIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  Undo2Icon,
  WrenchIcon,
} from "lucide-react"

import {
  InstallmentStatusBadge,
  InvoiceItemKindBadge,
  InvoiceStatusBadge,
  PaymentStatusBadge,
} from "@/components/invoices/invoice-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  getInvoiceBalance,
  paymentMethodLabels,
  type InvoiceRecord,
} from "@/lib/invoices-data"
import {
  formatDisplayDate,
  formatDateTime,
  getInitials,
} from "@/lib/students-data"

type InvoiceDetailSheetProps = {
  invoice: InvoiceRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddAdjustment: (invoice: InvoiceRecord) => void
  onCancelInvoice: (invoice: InvoiceRecord) => void
  onReissue: (invoice: InvoiceRecord) => void
  onPrint: (invoice: InvoiceRecord) => void
}

function formatSignedLkr(amount: number) {
  if (amount < 0) return `− ${formatLkr(Math.abs(amount))}`
  return formatLkr(amount)
}

export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  onAddAdjustment,
  onCancelInvoice,
  onReissue,
  onPrint,
}: InvoiceDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  const canCorrect =
    invoice !== null &&
    invoice.status !== "cancelled" &&
    invoice.status !== "waived"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        {invoice ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {invoice.invoiceNo}
                <InvoiceStatusBadge status={invoice.status} />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Invoice {invoice.invoiceNo} for {invoice.studentName}
              </SheetDescription>
              <div className="flex items-center gap-2 pt-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {getInitials(invoice.studentName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm text-foreground">
                    {invoice.studentName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {invoice.studentNo} · {invoice.branchName} branch
                  </span>
                </span>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <SummaryStat
                  label="Subtotal"
                  value={formatLkr(invoice.subtotal)}
                />
                <SummaryStat
                  label="Discounts"
                  value={
                    invoice.discountTotal > 0
                      ? `− ${formatLkr(invoice.discountTotal)}`
                      : "—"
                  }
                />
                <SummaryStat
                  label="Total"
                  value={formatLkr(invoice.total)}
                  strong
                />
                <SummaryStat
                  label="Paid"
                  value={formatLkr(invoice.amountPaid)}
                />
                <SummaryStat
                  label="Balance"
                  value={formatLkr(getInvoiceBalance(invoice))}
                  strong
                  tone={
                    invoice.balance > 0 && invoice.status !== "waived"
                      ? "warn"
                      : "default"
                  }
                />
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CalendarDaysIcon />}
                  title="Invoice terms"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField
                    label="Issued on"
                    value={formatDisplayDate(invoice.issuedOn)}
                  />
                  <ProfileField
                    label="Due date"
                    value={formatDisplayDate(invoice.dueDate)}
                  />
                  <ProfileField
                    label="Payment plan"
                    value={
                      invoice.installmentOptionName
                        ? invoice.installmentOptionName
                        : "Pay in full"
                    }
                  />
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ReceiptTextIcon />}
                  title="Itemized lines"
                  aside={
                    <Badge variant="outline" className="gap-1.5 rounded-full">
                      <LockIcon aria-hidden="true" />
                      Immutable once issued
                    </Badge>
                  }
                />
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Line</th>
                        <th className="px-3 py-2 font-medium">
                          Covered / refs
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoice.items.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            item.cancelledAt ? "opacity-60" : undefined
                          }
                        >
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <InvoiceItemKindBadge kind={item.kind} />
                              {item.cancelledAt ? (
                                <Badge
                                  variant="outline"
                                  className="rounded-full text-muted-foreground line-through"
                                >
                                  Cancelled
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 font-medium text-card-foreground">
                              {item.description}
                            </p>
                            {item.appliesToDescription ? (
                              <p className="text-xs text-muted-foreground">
                                Applies to: {item.appliesToDescription}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                            {item.periodStart && item.periodEnd ? (
                              <span className="block">
                                Period {formatDisplayDate(item.periodStart)} –{" "}
                                {formatDisplayDate(item.periodEnd)}
                              </span>
                            ) : null}
                            {item.gradeName ? (
                              <span className="block">
                                Grade: {item.gradeName}
                              </span>
                            ) : null}
                            {item.feeStructureName ? (
                              <span className="block">
                                Fee: {item.feeStructureName}
                              </span>
                            ) : null}
                            {item.courseName ? (
                              <span className="block">
                                Course: {item.courseName}
                              </span>
                            ) : null}
                            {item.contentPurchaseId ? (
                              <span className="block">
                                Purchase ref: {item.contentPurchaseId}
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={`px-3 py-3 text-right align-top font-medium tabular-nums ${
                              item.amount < 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : ""
                            }`}
                          >
                            {formatSignedLkr(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 text-sm">
                      <tr>
                        <td
                          className="px-3 py-2 text-muted-foreground"
                          colSpan={2}
                        >
                          Subtotal (before discounts)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatLkr(invoice.subtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td
                          className="px-3 py-2 text-muted-foreground"
                          colSpan={2}
                        >
                          Discounts
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {invoice.discountTotal > 0
                            ? `− ${formatLkr(invoice.discountTotal)}`
                            : formatLkr(0)}
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2 font-medium" colSpan={2}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatLkr(invoice.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  <LockIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Issued lines are immutable and kept for audit. Corrections
                    are posted as new adjustment or discount lines, never by
                    rewriting an existing line.
                  </span>
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CreditCardIcon />}
                  title="Installment schedule"
                  aside={
                    invoice.installments.length > 0 ? (
                      <Badge variant="outline" className="rounded-full">
                        {invoice.installments.length} installments
                      </Badge>
                    ) : undefined
                  }
                />
                {invoice.installments.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Seq</th>
                          <th className="px-3 py-2 font-medium">Due date</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Amount
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Paid
                          </th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invoice.installments.map((installment) => (
                          <tr key={installment.id}>
                            <td className="px-3 py-2 tabular-nums">
                              #{installment.seq}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDisplayDate(installment.dueDate)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatLkr(installment.amount)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatLkr(installment.amountPaid)}
                            </td>
                            <td className="px-3 py-2">
                              <InstallmentStatusBadge
                                status={installment.status}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      This invoice is payable in full. Installment plans are
                      chosen when the invoice is issued and only apply to
                      one-time packages.
                    </span>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CreditCardIcon />}
                  title="Payments & allocations"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {invoice.payments.length} payments
                    </Badge>
                  }
                />
                {invoice.payments.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {invoice.payments.map((payment) => {
                      const paymentAllocations = invoice.allocations.filter(
                        (allocation) => allocation.paymentId === payment.id
                      )

                      return (
                        <li
                          key={payment.id}
                          className="flex flex-col gap-2 rounded-lg border p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {formatLkr(payment.amount)}
                              <span className="font-normal text-muted-foreground">
                                · {paymentMethodLabels[payment.method]} ·{" "}
                                {payment.reference}
                              </span>
                            </span>
                            <PaymentStatusBadge status={payment.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>
                              Paid: {formatDisplayDate(payment.paidOn)}
                            </span>
                            <span>
                              Verified:{" "}
                              {payment.verifiedOn
                                ? formatDateTime(payment.verifiedOn)
                                : "Not verified"}
                            </span>
                          </div>
                          {paymentAllocations.length > 0 ? (
                            <ul className="flex flex-col gap-1 rounded-md border bg-muted/20 p-2 text-xs">
                              {paymentAllocations.map((allocation) => (
                                <li
                                  key={allocation.id}
                                  className="flex flex-wrap items-center justify-between gap-2"
                                >
                                  <span className="flex items-center gap-1.5">
                                    {allocation.reversedAt ? (
                                      <Undo2Icon
                                        className="size-3.5 text-rose-600 dark:text-rose-400"
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    <span
                                      className={
                                        allocation.reversedAt
                                          ? "text-muted-foreground line-through"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {allocation.itemDescription}
                                    </span>
                                    {allocation.reversedAt ? (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full text-muted-foreground"
                                      >
                                        Reversed
                                      </Badge>
                                    ) : null}
                                  </span>
                                  <span className="tabular-nums">
                                    {formatLkr(allocation.amount)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No allocation yet —{" "}
                              {paymentStatusLabel(payment.status)}.
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      No payments have been recorded for this invoice.
                    </span>
                  </div>
                )}
              </section>

              {invoice.cancelledAt ? (
                <div className="flex items-start gap-2 rounded-md border border-red-600/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-800 dark:text-red-300">
                  <BanIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Cancelled on {formatDateTime(invoice.cancelledAt)}. Every
                    line keeps its cancelled marker; the invoice is not deleted.
                    A corrected invoice can be reissued as a new document.
                  </span>
                </div>
              ) : null}

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Payments are allocated to payable lines, and installment paid
                  amounts are derived by the allocation waterfall. Amounts on
                  this page are sample data and nothing is saved.
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <Button variant="outline" onClick={() => onPrint(invoice)}>
                <PrinterIcon data-icon="inline-start" />
                Print / export (demo)
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  disabled={!canCorrect}
                  onClick={() => onAddAdjustment(invoice)}
                >
                  <WrenchIcon data-icon="inline-start" />
                  Add adjustment
                </Button>
                <Button
                  variant="outline"
                  disabled={invoice.status !== "cancelled"}
                  onClick={() => onReissue(invoice)}
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Reissue
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canCorrect}
                  onClick={() => onCancelInvoice(invoice)}
                >
                  <BanIcon data-icon="inline-start" />
                  Cancel invoice
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function paymentStatusLabel(
  status: InvoiceRecord["payments"][number]["status"]
) {
  switch (status) {
    case "pending_verification":
      return "awaiting verification"
    case "verified":
      return "verified"
    case "rejected":
      return "rejected"
    case "voided":
      return "voided"
    default:
      return status
  }
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
        className={`tabular-nums ${strong ? "text-base font-semibold" : "text-sm"} ${
          tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}
