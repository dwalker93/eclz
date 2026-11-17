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
  BookOpenIcon,
  CircleAlertIcon,
  InfoIcon,
  LockIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  StoreIcon,
  WalletIcon,
} from "lucide-react"

import { ContentKindBadge } from "@/components/content/content-status-badge"
import {
  HandoverBadge,
  PurchaseChannelBadge,
  PurchaseStatusBadge,
} from "@/components/purchases/purchase-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  getInvoiceBalance,
  getInvoiceById,
  invoiceStatusLabels,
} from "@/lib/invoices-data"
import {
  canHandOver,
  getHandoverState,
  purchaseStatusLabels,
  type ContentPurchaseRecord,
} from "@/lib/purchases-data"
import {
  formatDateTime,
  formatDisplayDate,
  getInitials,
} from "@/lib/students-data"

type PurchaseDetailSheetProps = {
  open: boolean
  purchase: ContentPurchaseRecord | null
  onOpenChange: (open: boolean) => void
  onHandOver: (purchase: ContentPurchaseRecord) => void
}

export function PurchaseDetailSheet({
  open,
  purchase,
  onOpenChange,
  onHandOver,
}: PurchaseDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const invoice = purchase?.invoiceId
    ? getInvoiceById(purchase.invoiceId)
    : undefined
  const handoverState = purchase ? getHandoverState(purchase) : "na"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {purchase ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {purchase.studentName}
                <PurchaseStatusBadge status={purchase.status} />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Purchase of {purchase.contentTitle} by {purchase.studentName}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {getInitials(purchase.studentName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm text-foreground">
                    {purchase.contentTitle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {purchase.studentNo} · {purchase.branchName} ·{" "}
                    {purchase.reference}
                  </span>
                </span>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat
                  label="Price"
                  value={formatLkr(purchase.price)}
                  strong
                />
                <SummaryStat
                  label="Payment"
                  value={purchaseStatusLabels[purchase.status]}
                  strong
                />
                <SummaryStat
                  label="Channel"
                  value={
                    purchase.channel === "physical" ? "Physical" : "Online"
                  }
                />
                <SummaryStat
                  label="Access"
                  value={
                    purchase.status === "paid"
                      ? "Granted"
                      : purchase.status === "cancelled"
                        ? "Revoked"
                        : "Locked"
                  }
                />
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading icon={<WalletIcon />} title="Payment state" />
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">Payment</span>
                    <PurchaseStatusBadge status={purchase.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {purchase.status === "paid"
                      ? "Paid purchases grant access immediately."
                      : purchase.status === "cancelled"
                        ? "Cancelled purchases never granted access."
                        : "Pending purchases do not grant access until the invoice is paid."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                    <ReceiptTextIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {invoice ? (
                      <>
                        <span className="font-medium">{invoice.invoiceNo}</span>
                        <Badge variant="outline" className="rounded-full">
                          Invoice {invoiceStatusLabels[invoice.status]}
                        </Badge>
                        <span className="text-muted-foreground">
                          Balance {formatLkr(getInvoiceBalance(invoice))}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No invoice linked — an invoice is generated on payment.
                      </span>
                    )}
                  </div>
                  {invoice ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Issued {formatDisplayDate(invoice.issuedOn)}</span>
                      <span>Due {formatDisplayDate(invoice.dueDate)}</span>
                      <span>{invoice.branchName} branch</span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<PackageCheckIcon />}
                  title="Physical handover"
                  aside={<HandoverBadge state={handoverState} />}
                />
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  {purchase.channel !== "physical" ? (
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <BookOpenIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      Not applicable — online content has no physical handover.
                    </p>
                  ) : purchase.handedOverAt ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">Handed over</span>
                        <span className="text-muted-foreground">
                          {formatDateTime(purchase.handedOverAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Handed over by {purchase.handedOverBy ?? "—"} at the{" "}
                        {purchase.branchName} branch.
                      </p>
                      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <LockIcon
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Handover is already recorded; it is not changed by
                          later payment edits.
                        </span>
                      </div>
                    </>
                  ) : canHandOver(purchase) ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        This paid physical book has not been handed over yet.
                        Record who handed it over and when.
                      </p>
                      <Button onClick={() => onHandOver(purchase)}>
                        <PackageCheckIcon data-icon="inline-start" />
                        Hand over book (demo)
                      </Button>
                    </>
                  ) : (
                    <p className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      <LockIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      Handover is locked until this physical purchase is paid.
                    </p>
                  )}
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading icon={<ShoppingCartIcon />} title="Order" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <DetailField label="Reference" value={purchase.reference} />
                  <DetailField label="Student" value={purchase.studentName} />
                  <DetailField label="Student no." value={purchase.studentNo} />
                  <DetailField label="Content" value={purchase.contentTitle} />
                  <DetailField label="Branch" value={purchase.branchName} />
                  <DetailField
                    label="Purchased"
                    value={formatDateTime(purchase.purchasedAt)}
                  />
                </dl>
                <div className="flex flex-wrap items-center gap-2">
                  <ContentKindBadge kind={purchase.contentKind} />
                  <PurchaseChannelBadge channel={purchase.channel} />
                </div>
              </section>

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Payment state and handover are separate. Paid status grants
                  access; pending and cancelled do not. Physical handover is
                  only possible for a paid book.
                </span>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Demo only. This purchase is sample data and nothing is saved.
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StoreIcon className="size-3.5" aria-hidden="true" />
                Content store purchase
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {canHandOver(purchase) ? (
                  <Button onClick={() => onHandOver(purchase)}>
                    <PackageCheckIcon data-icon="inline-start" />
                    Hand over (demo)
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1 text-sm">
        <span className="truncate">{value}</span>
      </dd>
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
        className={`truncate ${strong ? "text-base font-semibold" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  )
}
