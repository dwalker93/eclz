"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

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
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  Clock3Icon,
  FileTextIcon,
  InfoIcon,
  LandmarkIcon,
  ListOrderedIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchXIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UploadIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  InstallmentStatusBadge,
  InvoiceStatusBadge,
  PaymentMethodBadge,
  PaymentVerificationBadge,
} from "@/components/portal-status-badge"
import { type ParentChild } from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  formatLkr,
  INVOICE_LINE_KIND_LABELS,
  invoiceStatusFilterOptions,
  isInvoiceOpen,
  MOCK_TODAY,
  PAYMENT_METHOD_LABELS,
  paymentStatusFilterOptions,
  portalModules,
  studentBankAccounts,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentVerificationStatus,
  type StudentInvoice,
  type StudentPayment,
} from "@/lib/student-portal-data"

type BillingTab = "invoices" | "payments"

const billingTabs: Array<{ value: BillingTab; label: string }> = [
  { value: "invoices", label: "Invoices" },
  { value: "payments", label: "Payments" },
]

type PreparedSample = {
  childName: string
  childNo: string
  amount: number
  method: PaymentMethod
  reference: string
  paidOn: string
  invoiceNos: string[]
  destinationLabel: string | null
  hasSlip: boolean
}

function summariseBilling(
  invoices: StudentInvoice[],
  payments: StudentPayment[]
) {
  const open = invoices.filter(isInvoiceOpen)
  const overdue = invoices.filter((invoice) => invoice.status === "overdue")
  const upcomingDueDates = open
    .map((invoice) => invoice.dueDate)
    .filter((dueDate) => dueDate >= MOCK_TODAY)
    .sort()

  return {
    outstanding: open.reduce((total, invoice) => total + invoice.balance, 0),
    openCount: open.length,
    overdueAmount: overdue.reduce(
      (total, invoice) => total + invoice.balance,
      0
    ),
    overdueCount: overdue.length,
    nextDueDate: upcomingDueDates[0] ?? null,
    pendingVerificationAmount: payments
      .filter((payment) => payment.status === "pending_verification")
      .reduce((total, payment) => total + payment.amount, 0),
    pendingVerificationCount: payments.filter(
      (payment) => payment.status === "pending_verification"
    ).length,
  }
}

function getInvoiceLineTotals(invoice: StudentInvoice) {
  const payable = invoice.lines
    .filter((line) => line.kind === "fee" || line.kind === "content")
    .reduce((total, line) => total + line.amount, 0)
  const discounts = Math.abs(
    invoice.lines
      .filter((line) => line.kind === "discount")
      .reduce((total, line) => total + line.amount, 0)
  )
  const adjustments = invoice.lines
    .filter((line) => line.kind === "adjustment")
    .reduce((total, line) => total + line.amount, 0)

  return {
    payable,
    discounts,
    adjustments,
    total: payable - discounts + adjustments,
  }
}

function getInvoiceStatusLine(invoice: StudentInvoice) {
  switch (invoice.status) {
    case "overdue":
      return `Overdue since ${formatDisplayDate(invoice.dueDate)}`
    case "pending":
      return `Due ${formatDisplayDate(invoice.dueDate)}`
    case "partial":
      return `Partially paid · ${formatLkr(invoice.balance)} remaining`
    case "paid":
      return "Settled in full"
    case "waived":
      return "Waived — no payment is due"
    case "cancelled":
      return "Cancelled — no payment is due"
    default:
      return `Due ${formatDisplayDate(invoice.dueDate)}`
  }
}

export function ParentBilling() {
  const idPrefix = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [activeTab, setActiveTab] = useState<BillingTab>("invoices")
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | "all">(
    "all"
  )
  const [paymentStatus, setPaymentStatus] = useState<
    PaymentVerificationStatus | "all"
  >("all")
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null)
  const [submitInvoiceId, setSubmitInvoiceId] = useState<string | null>(null)
  const [submitSession, setSubmitSession] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [preparedSample, setPreparedSample] = useState<PreparedSample | null>(
    null
  )

  // The header selector changes the child without remounting this page, so every
  // piece of local state must reset to keep the billing context child-scoped.
  useEffect(() => {
    setActiveTab("invoices")
    setInvoiceStatus("all")
    setPaymentStatus("all")
    setDetailInvoiceId(null)
    setSubmitInvoiceId(null)
    setSubmitOpen(false)
    setPreparedSample(null)
  }, [selectedChild?.id])

  const gatewayEnabled = portalModules.gateway
  const invoices = selectedChild?.billing?.invoices ?? []
  const payments = selectedChild?.billing?.payments ?? []
  const openInvoices = invoices.filter(isInvoiceOpen)
  const summary = summariseBilling(invoices, payments)

  const visibleInvoices = invoices.filter(
    (invoice) => invoiceStatus === "all" || invoice.status === invoiceStatus
  )
  const visiblePayments = payments.filter(
    (payment) => paymentStatus === "all" || payment.status === paymentStatus
  )
  const detailInvoice = detailInvoiceId
    ? (invoices.find((invoice) => invoice.id === detailInvoiceId) ?? null)
    : null

  function openSubmit(invoiceId?: string) {
    setDetailInvoiceId(null)
    setSubmitInvoiceId(invoiceId ?? null)
    setSubmitSession((session) => session + 1)
    setSubmitOpen(true)
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    let nextIndex: number | null = null

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % billingTabs.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + billingTabs.length) % billingTabs.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = billingTabs.length - 1
    }

    if (nextIndex === null) return

    const nextTab = billingTabs[nextIndex]

    if (!nextTab) return

    event.preventDefault()
    setActiveTab(nextTab.value)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Invoices & Payments"
          description="Fee invoices, installment schedules and payment history for the child selected in the header. You can prepare a payment on that child's behalf in this local demo only — nothing is submitted, verified or applied."
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              <Button
                size="sm"
                onClick={() => openSubmit()}
                disabled={openInvoices.length === 0}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Submit payment
              </Button>
            </div>
          }
        />

        {linkedChildren.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no invoices or payments to show. Contact the branch office if a child is missing from your account."
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

            {preparedSample ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
                <Clock3Icon
                  className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Sample payment prepared</p>
                    <PaymentVerificationBadge status="pending_verification" />
                  </div>
                  <p className="text-muted-foreground">
                    {formatLkr(preparedSample.amount)} ·{" "}
                    {PAYMENT_METHOD_LABELS[preparedSample.method]} ·{" "}
                    {preparedSample.reference} ·{" "}
                    {formatDisplayDate(preparedSample.paidOn)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    For {preparedSample.childName} ({preparedSample.childNo}).
                    Demo only — nothing was submitted to the institute or
                    applied to an invoice, and no balance changed.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setPreparedSample(null)}
                >
                  Discard
                </Button>
              </div>
            ) : null}

            {invoices.length === 0 && payments.length === 0 ? (
              <Card className="gap-0 py-0">
                <EmptyState
                  icon={
                    <WalletCardsIcon className="size-5" aria-hidden="true" />
                  }
                  title={`No invoices for ${selectedChild.preferredName}`}
                  description="No invoice or payment is recorded for this child. Contact the branch office if you expected fees to appear here."
                />
              </Card>
            ) : (
              <>
                <Card className="gap-0 py-0">
                  <CardHeader className="border-b px-4 py-4 sm:px-6">
                    <CardTitle className="flex items-center gap-2">
                      <WalletCardsIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Fees overview
                    </CardTitle>
                    <CardDescription>
                      Sample totals across {invoices.length}{" "}
                      {invoices.length === 1 ? "invoice" : "invoices"} for{" "}
                      {selectedChild.fullName}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-6">
                    <BillingSummaryTile
                      icon={CircleDollarSignIcon}
                      label="Outstanding"
                      value={formatLkr(summary.outstanding)}
                      hint={`${summary.openCount} open ${
                        summary.openCount === 1 ? "invoice" : "invoices"
                      }`}
                      tone="sky"
                    />
                    <BillingSummaryTile
                      icon={TriangleAlertIcon}
                      label="Overdue"
                      value={formatLkr(summary.overdueAmount)}
                      hint={`${summary.overdueCount} overdue`}
                      tone="red"
                    />
                    <BillingSummaryTile
                      icon={CalendarClockIcon}
                      label="Next due"
                      value={
                        summary.nextDueDate
                          ? formatDisplayDate(summary.nextDueDate)
                          : "—"
                      }
                      hint="Soonest upcoming"
                      tone="amber"
                    />
                    <BillingSummaryTile
                      icon={Clock3Icon}
                      label="Pending verification"
                      value={formatLkr(summary.pendingVerificationAmount)}
                      hint={`${summary.pendingVerificationCount} payment`}
                      tone="violet"
                    />
                  </CardContent>
                  <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                    Only {selectedChild.preferredName}&apos;s invoices and
                    payments are counted. A sibling&apos;s balances are never
                    combined, and pending payments are not counted until the
                    institute verifies them.
                  </CardFooter>
                </Card>

                <div className="flex flex-col gap-4">
                  <div
                    role="tablist"
                    aria-label="Invoices and payments"
                    className="flex w-full gap-1 rounded-lg border bg-muted/30 p-1 sm:w-fit"
                  >
                    {billingTabs.map((tab, index) => {
                      const isSelected = activeTab === tab.value
                      const count =
                        tab.value === "invoices"
                          ? invoices.length
                          : payments.length

                      return (
                        <button
                          key={tab.value}
                          ref={(element) => {
                            tabRefs.current[index] = element
                          }}
                          type="button"
                          role="tab"
                          id={`${idPrefix}-tab-${tab.value}`}
                          aria-selected={isSelected}
                          aria-controls={`${idPrefix}-panel-${tab.value}`}
                          tabIndex={isSelected ? 0 : -1}
                          onClick={() => setActiveTab(tab.value)}
                          onKeyDown={(event) => handleTabKeyDown(event, index)}
                          className={cn(
                            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-none",
                            isSelected
                              ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                          )}
                        >
                          {tab.label}
                          <span
                            className={cn(
                              "rounded-full px-1.5 text-[11px] tabular-nums",
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {activeTab === "invoices" ? (
                    <div
                      role="tabpanel"
                      id={`${idPrefix}-panel-invoices`}
                      aria-labelledby={`${idPrefix}-tab-invoices`}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Each invoice shows its issue and due dates, item
                          summary, total, paid amount and remaining balance.
                        </p>
                        <Select
                          items={invoiceStatusFilterOptions}
                          value={invoiceStatus}
                          onValueChange={(value) =>
                            setInvoiceStatus(
                              (value ?? "all") as InvoiceStatus | "all"
                            )
                          }
                        >
                          <SelectTrigger
                            className="w-full sm:w-56"
                            aria-label="Filter invoices by status"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {invoiceStatusFilterOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {visibleInvoices.length === 0 ? (
                        <Card className="gap-0 py-0">
                          <EmptyState
                            icon={
                              <SearchXIcon
                                className="size-5"
                                aria-hidden="true"
                              />
                            }
                            title="No invoices match this status"
                            description="Try another status filter, or contact the institute office if you expected an invoice here."
                          />
                        </Card>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {visibleInvoices.map((invoice) => (
                            <InvoiceCard
                              key={invoice.id}
                              invoice={invoice}
                              onOpen={() => setDetailInvoiceId(invoice.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      role="tabpanel"
                      id={`${idPrefix}-panel-payments`}
                      aria-labelledby={`${idPrefix}-tab-payments`}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Payments show the method, date, amount, reference and
                          verification status. A balance only reduces after
                          verification.
                        </p>
                        <Select
                          items={paymentStatusFilterOptions}
                          value={paymentStatus}
                          onValueChange={(value) =>
                            setPaymentStatus(
                              (value ?? "all") as
                                PaymentVerificationStatus | "all"
                            )
                          }
                        >
                          <SelectTrigger
                            className="w-full sm:w-56"
                            aria-label="Filter payments by verification status"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentStatusFilterOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Card className="gap-0 py-0">
                        {visiblePayments.length === 0 ? (
                          <EmptyState
                            icon={
                              <ReceiptTextIcon
                                className="size-5"
                                aria-hidden="true"
                              />
                            }
                            title="No payments match this filter"
                            description="Try another verification status, or use Submit payment to prepare a local sample payment for this child."
                          />
                        ) : (
                          <ul className="divide-y">
                            {visiblePayments.map((payment) => (
                              <li
                                key={payment.id}
                                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-6"
                              >
                                <div className="flex min-w-0 flex-1 gap-3">
                                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                    <LandmarkIcon
                                      className="size-4"
                                      aria-hidden="true"
                                    />
                                  </span>
                                  <div className="flex min-w-0 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <PaymentMethodBadge
                                        method={payment.method}
                                      />
                                      <span className="text-sm font-medium">
                                        {payment.reference}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {payment.invoiceNo} ·{" "}
                                      {formatDisplayDate(payment.paidOn)}
                                    </p>
                                    {payment.note ? (
                                      <p className="max-w-xl text-xs text-muted-foreground">
                                        {payment.note}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-sm font-medium tabular-nums">
                                    {formatLkr(payment.amount)}
                                  </span>
                                  <PaymentVerificationBadge
                                    status={payment.status}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Card>
                    </div>
                  )}
                </div>
              </>
            )}

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  These invoices and payments belong only to{" "}
                  {selectedChild.fullName}. No invoice is created, changed or
                  cancelled, no installment is calculated, no payment is
                  submitted, verified or allocated, and no receipt is issued.
                  Cash payments are recorded at the branch front desk and are
                  never submitted from the parent portal.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <InvoiceDetailDialog
        invoice={detailInvoice}
        child={selectedChild}
        payments={payments}
        onOpenChange={(open) => {
          if (!open) setDetailInvoiceId(null)
        }}
        onMakePayment={(invoiceId) => openSubmit(invoiceId)}
      />

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          {submitOpen && selectedChild ? (
            <SubmitPaymentFlow
              key={submitSession}
              child={selectedChild}
              openInvoices={openInvoices}
              gatewayEnabled={gatewayEnabled}
              preselectedInvoiceId={submitInvoiceId}
              onClose={() => setSubmitOpen(false)}
              onPrepared={(sample) => setPreparedSample(sample)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function BillingSummaryTile({
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
  tone: "sky" | "red" | "amber" | "violet"
}) {
  const toneClasses = {
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
    red: "border-destructive/15 bg-destructive/5 text-destructive",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
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

function InvoiceCard({
  invoice,
  onOpen,
}: {
  invoice: StudentInvoice
  onOpen: () => void
}) {
  const open = isInvoiceOpen(invoice)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{invoice.title}</CardTitle>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <CardDescription>
            {invoice.invoiceNo} · {invoice.itemSummary}
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {open ? "Balance due" : "Balance"}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {open ? formatLkr(invoice.balance) : "—"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6">
        <SummaryField
          label="Issued"
          value={formatDisplayDate(invoice.issuedOn)}
        />
        <SummaryField
          label="Due"
          value={formatDisplayDate(invoice.dueDate)}
          tone={invoice.status === "overdue" ? "danger" : undefined}
        />
        <SummaryField label="Total" value={formatLkr(invoice.total)} />
        <SummaryField label="Paid" value={formatLkr(invoice.amountPaid)} />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
        <span className="text-xs text-muted-foreground">
          {getInvoiceStatusLine(invoice)}
        </span>
        <Button variant="outline" size="xs" onClick={onOpen}>
          View invoice
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function SummaryField({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "danger"
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function InvoiceDetailDialog({
  invoice,
  child,
  payments,
  onOpenChange,
  onMakePayment,
}: {
  invoice: StudentInvoice | null
  child: ParentChild | null
  payments: StudentPayment[]
  onOpenChange: (open: boolean) => void
  onMakePayment: (invoiceId: string) => void
}) {
  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {invoice ? (
          <InvoiceDetailBody
            key={invoice.id}
            invoice={invoice}
            child={child}
            payments={payments.filter(
              (payment) => payment.invoiceId === invoice.id
            )}
            onMakePayment={() => onMakePayment(invoice.id)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function InvoiceDetailBody({
  invoice,
  child,
  payments,
  onMakePayment,
}: {
  invoice: StudentInvoice
  child: ParentChild | null
  payments: StudentPayment[]
  onMakePayment: () => void
}) {
  const totals = getInvoiceLineTotals(invoice)
  const open = isInvoiceOpen(invoice)

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={invoice.status} />
          <Badge variant="outline" className="rounded-full">
            {invoice.invoiceNo}
          </Badge>
        </div>
        <DialogTitle className="text-lg">{invoice.title}</DialogTitle>
        <DialogDescription>
          {invoice.itemSummary}
          {invoice.period ? ` · ${invoice.period}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {child ? (
          <>
            <span className="font-medium text-foreground">
              {child.fullName}
            </span>
            <span>Student no. {child.studentNo}</span>
          </>
        ) : null}
        <span>{invoice.branch} branch</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryField
          label="Issued"
          value={formatDisplayDate(invoice.issuedOn)}
        />
        <SummaryField
          label="Due"
          value={formatDisplayDate(invoice.dueDate)}
          tone={invoice.status === "overdue" ? "danger" : undefined}
        />
        <SummaryField label="Branch" value={invoice.branch} />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <FileTextIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Invoice items
        </p>
        <ul className="flex flex-col divide-y rounded-lg border">
          {invoice.lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-start justify-between gap-2 p-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {line.description}
                  </span>
                  <Badge variant="outline" className="rounded-full">
                    {INVOICE_LINE_KIND_LABELS[line.kind]}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {line.courseName ? `${line.courseName} · ` : ""}
                  {line.periodLabel ?? "No period"}
                </span>
              </div>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  line.amount < 0 && "text-emerald-700 dark:text-emerald-400"
                )}
              >
                {line.amount < 0
                  ? `− ${formatLkr(Math.abs(line.amount))}`
                  : formatLkr(line.amount)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
          <TotalRow
            label="Fees and content"
            value={formatLkr(totals.payable)}
          />
          {totals.discounts > 0 ? (
            <TotalRow
              label="Discounts"
              value={`− ${formatLkr(totals.discounts)}`}
            />
          ) : null}
          {totals.adjustments !== 0 ? (
            <TotalRow
              label="Adjustments"
              value={
                totals.adjustments < 0
                  ? `− ${formatLkr(Math.abs(totals.adjustments))}`
                  : formatLkr(totals.adjustments)
              }
            />
          ) : null}
          <Separator />
          <TotalRow label="Invoice total" value={formatLkr(totals.total)} />
          <TotalRow label="Paid" value={formatLkr(invoice.amountPaid)} />
          <TotalRow
            label="Balance"
            value={open ? formatLkr(invoice.balance) : "—"}
            strong
          />
        </div>
      </div>

      {invoice.installments.length > 0 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ListOrderedIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Installment schedule
            </p>
            <p className="text-xs text-muted-foreground">
              Shown in sequence. Due dates, amounts and paid amounts are sample
              data.
            </p>
            <ol className="flex flex-col gap-2">
              {invoice.installments.map((installment) => (
                <li
                  key={installment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                      {installment.seq}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        Installment {installment.seq}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Due {formatDisplayDate(installment.dueDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="text-sm tabular-nums">
                        {formatLkr(installment.amountPaid)} of{" "}
                        {formatLkr(installment.amount)}
                      </p>
                    </div>
                    <InstallmentStatusBadge status={installment.status} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <LandmarkIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Payments for this invoice
        </p>
        {payments.length === 0 ? (
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
            No payments are recorded for this invoice yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentMethodBadge method={payment.method} />
                    <span className="text-sm font-medium">
                      {payment.reference}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDisplayDate(payment.paidOn)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">
                    {formatLkr(payment.amount)}
                  </span>
                  <PaymentVerificationBadge status={payment.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {invoice.note ? (
        <p className="rounded-lg border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
          {invoice.note}
        </p>
      ) : null}

      <DialogFooter className="gap-2">
        {open ? (
          <Button onClick={onMakePayment}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Prepare a sample payment
          </Button>
        ) : null}
      </DialogFooter>
    </>
  )
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold")}>
        {value}
      </span>
    </div>
  )
}

type SubmitMethod = "bank_transfer" | "gateway"
type SubmitStep = "form" | "review"

function SubmitPaymentFlow({
  child,
  openInvoices,
  gatewayEnabled,
  preselectedInvoiceId,
  onClose,
  onPrepared,
}: {
  child: ParentChild
  openInvoices: StudentInvoice[]
  gatewayEnabled: boolean
  preselectedInvoiceId: string | null
  onClose: () => void
  onPrepared: (sample: PreparedSample) => void
}) {
  const preselected = preselectedInvoiceId
    ? openInvoices.find((invoice) => invoice.id === preselectedInvoiceId)
    : undefined

  const [step, setStep] = useState<SubmitStep>("form")
  const [invoiceIds, setInvoiceIds] = useState<string[]>(
    preselected ? [preselected.id] : []
  )
  const [amount, setAmount] = useState(
    preselected ? String(preselected.balance) : ""
  )
  const [amountEdited, setAmountEdited] = useState(false)
  const [method, setMethod] = useState<SubmitMethod>("bank_transfer")
  const [destinationId, setDestinationId] = useState<string>(
    studentBankAccounts[0]?.id ?? ""
  )
  const [reference, setReference] = useState("")
  const [paidOn, setPaidOn] = useState(MOCK_TODAY)
  const [slipAttached, setSlipAttached] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const selectedInvoices = openInvoices.filter((invoice) =>
    invoiceIds.includes(invoice.id)
  )
  const selectedTotal = selectedInvoices.reduce(
    (total, invoice) => total + invoice.balance,
    0
  )
  const amountValue = Number(amount)
  const destination = studentBankAccounts.find(
    (account) => account.id === destinationId
  )

  function computeTotal(ids: string[]) {
    return openInvoices
      .filter((invoice) => ids.includes(invoice.id))
      .reduce((total, invoice) => total + invoice.balance, 0)
  }

  function toggleInvoice(invoiceId: string) {
    const next = invoiceIds.includes(invoiceId)
      ? invoiceIds.filter((id) => id !== invoiceId)
      : [...invoiceIds, invoiceId]

    setInvoiceIds(next)

    if (!amountEdited) {
      setAmount(next.length > 0 ? String(computeTotal(next)) : "")
    }
  }

  function validate() {
    const issues: string[] = []

    if (invoiceIds.length === 0) {
      issues.push("Select at least one outstanding invoice.")
    }

    if (!amount || Number.isNaN(amountValue) || amountValue <= 0) {
      issues.push("Enter a payment amount greater than zero.")
    } else if (amountValue > selectedTotal) {
      issues.push(
        `The amount cannot exceed the selected balance of ${formatLkr(selectedTotal)} in this demo.`
      )
    }

    if (method === "bank_transfer" && !destinationId) {
      issues.push("Choose the bank destination for the transfer.")
    }

    if (!reference.trim()) {
      issues.push("Enter the transfer or payment reference.")
    }

    if (!paidOn) {
      issues.push("Choose the payment date.")
    }

    return issues
  }

  function goToReview() {
    const issues = validate()

    if (issues.length > 0) {
      setErrors(issues)
      return
    }

    setErrors([])
    setStep("review")
  }

  function finish() {
    onPrepared({
      childName: child.fullName,
      childNo: child.studentNo,
      amount: amountValue,
      method,
      reference: reference.trim(),
      paidOn,
      invoiceNos: selectedInvoices.map((invoice) => invoice.invoiceNo),
      destinationLabel:
        method === "bank_transfer" && destination
          ? `${destination.bankName} · ${destination.maskedNumber}`
          : null,
      hasSlip: slipAttached,
    })
    onClose()
  }

  if (step === "review") {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg">Review sample payment</DialogTitle>
          <DialogDescription>
            Check the details below. Nothing is sent, verified or applied in
            this demo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{child.fullName}</span>
          <span>Student no. {child.studentNo}</span>
          <span>{child.branch} branch</span>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <ReviewRow label="Child" value={child.fullName} />
          <ReviewRow
            label="Invoices"
            value={
              selectedInvoices.length > 0
                ? selectedInvoices
                    .map((invoice) => invoice.invoiceNo)
                    .join(", ")
                : "None selected"
            }
          />
          <ReviewRow label="Amount" value={formatLkr(amountValue)} />
          <ReviewRow label="Method" value={PAYMENT_METHOD_LABELS[method]} />
          {method === "bank_transfer" ? (
            <ReviewRow
              label="Bank destination"
              value={
                destination
                  ? `${destination.bankName} · ${destination.branchName} · ${destination.maskedNumber}`
                  : "Not selected"
              }
            />
          ) : null}
          <ReviewRow label="Reference" value={reference.trim() || "—"} />
          <ReviewRow label="Payment date" value={formatDisplayDate(paidOn)} />
          <ReviewRow
            label="Bank slip"
            value={
              slipAttached
                ? "bank-slip-sample.jpg (placeholder)"
                : "No slip attached"
            }
          />
        </dl>

        <div className="flex items-start gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm">
          <Clock3Icon
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">This sample is pending verification</p>
              <PaymentVerificationBadge status="pending_verification" />
            </div>
            <p className="text-muted-foreground">
              A real transfer for {child.preferredName} would stay pending until
              the finance team checks the reference and slip. No invoice balance
              changes until then.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setStep("form")}>
            Back to edit
          </Button>
          <Button onClick={finish}>Finish demo</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">Submit a sample payment</DialogTitle>
        <DialogDescription>
          A local-only demo payment for {child.fullName} ({child.studentNo}). No
          payment is submitted, and no slip is uploaded or stored.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{child.fullName}</span>
        <span>{child.grade}</span>
        <span>{child.branch} branch</span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            1. Choose outstanding invoices
          </span>
          {openInvoices.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              There are no outstanding invoices to pay for this child.
            </p>
          ) : (
            <div className="flex flex-col divide-y rounded-lg border">
              {openInvoices.map((invoice) => {
                const checked = invoiceIds.includes(invoice.id)

                return (
                  <label
                    key={invoice.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/40",
                      checked && "bg-muted/40"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleInvoice(invoice.id)}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {invoice.invoiceNo}
                        </span>
                        <InvoiceStatusBadge status={invoice.status} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.title} · due{" "}
                        {formatDisplayDate(invoice.dueDate)}
                      </span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatLkr(invoice.balance)}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Only {child.preferredName}&apos;s outstanding invoices at the{" "}
            {child.branch} branch are listed. A sibling&apos;s invoices are
            never combined, and how a payment is split across invoices is
            decided by the institute after verification.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="parent-sample-amount" className="text-sm font-medium">
            2. Amount (LKR)
          </Label>
          <Input
            id="parent-sample-amount"
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
              setAmountEdited(true)
            }}
            placeholder="Enter amount"
            aria-describedby="parent-sample-amount-hint"
            aria-invalid={errors.some((error) =>
              error.toLowerCase().includes("amount")
            )}
          />
          <p
            id="parent-sample-amount-hint"
            className="text-xs text-muted-foreground"
          >
            Selected balance {formatLkr(selectedTotal)}. This demo does not
            calculate allocations or installments.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">3. Payment method</span>
          <div
            role="radiogroup"
            aria-label="Payment method"
            className="flex flex-col gap-2"
          >
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                method === "bank_transfer"
                  ? "border-primary/40 bg-primary/5"
                  : "hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                name="parent-sample-payment-method"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={method === "bank_transfer"}
                onChange={() => setMethod("bank_transfer")}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Bank transfer</span>
                <span className="text-muted-foreground">
                  Transfer to the branch account below and attach a slip for
                  verification.
                </span>
              </span>
            </label>

            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                gatewayEnabled && method === "gateway"
                  ? "border-primary/40 bg-primary/5"
                  : "hover:bg-muted/40",
                !gatewayEnabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name="parent-sample-payment-method"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={method === "gateway"}
                disabled={!gatewayEnabled}
                onChange={() => setMethod("gateway")}
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  Payment gateway
                  {!gatewayEnabled ? (
                    <Badge variant="outline" className="rounded-full">
                      Not available
                    </Badge>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {gatewayEnabled
                    ? "Pay online through the payment provider. Card details are never entered on the portal."
                    : "The payment gateway is not enabled for this institute."}
                </span>
              </span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Cash is not offered here. Cash payments are recorded at the branch
            front desk by staff.
          </p>
        </div>

        {method === "bank_transfer" ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">4. Bank destination</span>
            <div
              role="radiogroup"
              aria-label="Bank destination"
              className="flex flex-col gap-2"
            >
              {studentBankAccounts.map((account) => (
                <label
                  key={account.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                    destinationId === account.id
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="parent-sample-bank-destination"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={destinationId === account.id}
                    onChange={() => setDestinationId(account.id)}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {account.bankName} · {account.branchName}
                    </span>
                    <span className="text-muted-foreground">
                      {account.accountName}
                    </span>
                    <span className="text-muted-foreground">
                      Account {account.maskedNumber}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Full account numbers are never shown in the portal.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="parent-sample-reference"
              className="text-sm font-medium"
            >
              5. Reference
            </Label>
            <Input
              id="parent-sample-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. BR-5102"
              aria-invalid={errors.some((error) =>
                error.toLowerCase().includes("reference")
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="parent-sample-date" className="text-sm font-medium">
              Payment date
            </Label>
            <Input
              id="parent-sample-date"
              type="date"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">6. Bank slip</span>
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center">
            <UploadIcon
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">Upload a bank slip</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Uploads are disabled in this demo. No file is read, stored or
              sent.
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setSlipAttached((current) => !current)}
            >
              {slipAttached
                ? "Remove sample slip"
                : "Simulate attaching a slip"}
            </Button>
          </div>
          {slipAttached ? (
            <p className="text-xs text-muted-foreground">
              Attached: bank-slip-sample.jpg (placeholder name only)
            </p>
          ) : null}
        </div>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <TriangleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={goToReview} disabled={openInvoices.length === 0}>
          Review
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DialogFooter>
    </>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{value}</dd>
    </div>
  )
}
