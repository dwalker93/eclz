"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  BanIcon,
  BanknoteIcon,
  ClockIcon,
  CreditCardIcon,
  InfoIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import {
  PaymentActionDialog,
  type PaymentAction,
} from "@/components/payments/payment-action-dialogs"
import { PaymentDetailSheet } from "@/components/payments/payment-detail-sheet"
import { PaymentFilters } from "@/components/payments/payment-filters"
import { PaymentSummary } from "@/components/payments/payment-summary"
import { PaymentTable } from "@/components/payments/payment-table"
import { formatLkr } from "@/lib/courses-data"
import { paymentMethodLabels, paymentStatusLabels } from "@/lib/invoices-data"
import {
  getPaymentUsage,
  getTargetInvoiceNumbers,
  paymentDirectory,
  paymentStatusTabs,
  type PaymentRecord,
  type PaymentStatus,
} from "@/lib/payments-data"

export function PaymentDirectory() {
  const [activeStatus, setActiveStatus] = useState<PaymentStatus>(
    "pending_verification"
  )
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [studentFilter, setStudentFilter] = useState("all")
  const [submittedFrom, setSubmittedFrom] = useState("")
  const [submittedTo, setSubmittedTo] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [action, setAction] = useState<PaymentAction | null>(null)
  const [actionPayment, setActionPayment] = useState<PaymentRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Payment register refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const usage = getPaymentUsage()
  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    branchFilter !== "all" ||
    methodFilter !== "all" ||
    studentFilter !== "all" ||
    submittedFrom !== "" ||
    submittedTo !== ""

  const filtered = useMemo(() => {
    return paymentDirectory.filter((payment) => {
      if (payment.status !== activeStatus) return false
      if (branchFilter !== "all" && payment.branchId !== branchFilter) {
        return false
      }
      if (methodFilter !== "all" && payment.method !== methodFilter) {
        return false
      }
      if (studentFilter !== "all" && payment.studentId !== studentFilter) {
        return false
      }

      const submittedOn = payment.submittedAt.slice(0, 10)
      if (submittedFrom !== "" && submittedOn < submittedFrom) return false
      if (submittedTo !== "" && submittedOn > submittedTo) return false

      if (query.length === 0) return true

      return [
        payment.studentName,
        payment.studentNo,
        payment.branchName,
        payment.referenceNo ?? "",
        payment.submittedByLabel,
        payment.submittedVia,
        paymentMethodLabels[payment.method],
        payment.gatewayTransaction?.provider ?? "",
        payment.gatewayTransaction?.providerRef ?? "",
        ...getTargetInvoiceNumbers(payment),
        ...payment.allocations.map((allocation) => allocation.invoiceNo),
        ...payment.allocations.map((allocation) => allocation.itemDescription),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [
    activeStatus,
    branchFilter,
    methodFilter,
    studentFilter,
    submittedFrom,
    submittedTo,
    query,
  ])

  const filteredAmount = filtered.reduce(
    (total, payment) => total + payment.amount,
    0
  )
  const selectedPayment =
    paymentDirectory.find((payment) => payment.id === selectedId) ?? null

  const tabCounts: Record<PaymentStatus, number> = {
    pending_verification: usage.pending,
    verified: usage.verified,
    rejected: usage.rejected,
    voided: usage.voided,
  }

  function clearFilters() {
    setSearch("")
    setBranchFilter("all")
    setMethodFilter("all")
    setStudentFilter("all")
    setSubmittedFrom("")
    setSubmittedTo("")
  }

  function openDetail(payment: PaymentRecord) {
    setSelectedId(payment.id)
    setDetailOpen(true)
  }

  function openAction(
    nextAction: PaymentAction,
    payment: PaymentRecord | null
  ) {
    setDetailOpen(false)
    setSelectedId(null)
    setActionPayment(payment)
    setAction(nextAction)
  }

  function closeAction(open: boolean) {
    if (!open) {
      setAction(null)
      setActionPayment(null)
    }
  }

  async function copyReference(payment: PaymentRecord) {
    const reference = payment.referenceNo ?? payment.id

    try {
      await navigator.clipboard.writeText(reference)
      setNotice(`${reference} copied to the clipboard.`)
    } catch {
      setNotice(`Payment reference: ${reference}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Verification queue and payment register from <code>payment</code>,{" "}
              <code>payment_allocation</code>, <code>invoice</code>,{" "}
              <code>bank_account</code>, <code>file</code> and{" "}
              <code>gateway_transaction</code>. This is sample data; actions
              only open local previews and nothing is saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRefreshing(true)}
              disabled={isRefreshing}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
            <Button onClick={() => openAction("cash", null)}>
              <BanknoteIcon data-icon="inline-start" />
              Record cash
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <PaymentSummary usage={usage} />

        <PaymentFilters
          search={search}
          onSearchChange={setSearch}
          branch={branchFilter}
          onBranchChange={setBranchFilter}
          method={methodFilter}
          onMethodChange={setMethodFilter}
          student={studentFilter}
          onStudentChange={setStudentFilter}
          submittedFrom={submittedFrom}
          onSubmittedFromChange={setSubmittedFrom}
          submittedTo={submittedTo}
          onSubmittedToChange={setSubmittedTo}
          hasActiveFilters={hasActiveFilters}
          onReset={clearFilters}
        />

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Payment register
              </CardTitle>
              <CardDescription>
                {filtered.length} of {paymentDirectory.length}{" "}
                {paymentDirectory.length === 1 ? "payment" : "payments"} ·{" "}
                {formatLkr(filteredAmount)} in view · {usage.cashRecorded} cash{" "}
                {usage.cashRecorded === 1 ? "entry" : "entries"} at the desk
              </CardDescription>
            </div>
          </CardHeader>

          <div
            role="tablist"
            aria-label="Payment status"
            className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3 sm:px-6"
          >
            {paymentStatusTabs.map((tab) => {
              const isActive = activeStatus === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveStatus(tab.value)}
                  className={
                    isActive
                      ? "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      : "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  }
                >
                  {tab.label}
                  <span className="tabular-nums opacity-70">
                    {tabCounts[tab.value]}
                  </span>
                </button>
              )
            })}
          </div>

          {isRefreshing ? (
            <PaymentSkeleton />
          ) : filtered.length === 0 ? (
            <PaymentEmptyState
              status={activeStatus}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          ) : (
            <PaymentTable
              payments={filtered}
              onView={openDetail}
              onCopy={copyReference}
              onAction={openAction}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Bank transfers and gateway payments wait for verification. Cash is
              recorded by staff and is immediately verified. Voiding reverses
              allocations instead of deleting the payment or its audit trail.
            </span>
          </div>
        </Card>
      </div>

      <PaymentDetailSheet
        payment={selectedPayment}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onVerify={(payment) => openAction("verify", payment)}
        onReject={(payment) => openAction("reject", payment)}
        onVoid={(payment) => openAction("void", payment)}
        onAdjustAllocation={(payment) => openAction("allocation", payment)}
        onCopy={copyReference}
      />

      <PaymentActionDialog
        action={action}
        payment={actionPayment}
        onOpenChange={closeAction}
        onCompleted={(message) => {
          setAction(null)
          setActionPayment(null)
          setNotice(message)
        }}
      />
    </main>
  )
}

function PaymentEmptyState({
  status,
  hasActiveFilters,
  onClearFilters,
}: {
  status: PaymentStatus
  hasActiveFilters: boolean
  onClearFilters: () => void
}) {
  const Icon =
    status === "pending_verification"
      ? ClockIcon
      : status === "verified"
        ? ShieldCheckIcon
        : status === "rejected"
          ? TriangleAlertIcon
          : BanIcon

  const hint =
    status === "pending_verification"
      ? "Every submitted slip in view has been reviewed."
      : status === "rejected"
        ? "Rejected payments keep their reason and stay in the register."
        : status === "voided"
          ? "Voided payments stay in the register with reversed allocations."
          : "Try a different branch, method, student, date range or search."

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          No {paymentStatusLabels[status].toLowerCase()} payments match these
          filters
        </p>
        <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClearFilters}
        disabled={!hasActiveFilters}
      >
        Clear filters
      </Button>
    </div>
  )
}

function PaymentSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}
