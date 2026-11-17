"use client"

import { useState } from "react"
import type { ReactNode } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  BanIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  InfoIcon,
  LockIcon,
  ReceiptTextIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react"

import { formatLkr } from "@/lib/courses-data"
import {
  getInvoiceBalance,
  getInvoiceById,
  invoiceDirectory,
  isInvoiceOpen,
  paymentMethodLabels,
} from "@/lib/invoices-data"
import {
  CASHIER_NAME,
  getActiveAllocations,
  getCommissionPreview,
  getNextReceiptNumber,
  getPaymentHandler,
  getProjectedInvoiceBalance,
  getTargetInvoiceNumbers,
  paymentDirectory,
  proposeAllocations,
  type PaymentAllocationRecord,
  type PaymentRecord,
} from "@/lib/payments-data"
import { MOCK_TODAY, formatDateTime } from "@/lib/students-data"

export type PaymentAction = "verify" | "reject" | "void" | "allocation" | "cash"

type PaymentActionDialogProps = {
  action: PaymentAction | null
  payment: PaymentRecord | null
  onOpenChange: (open: boolean) => void
  onCompleted: (message: string) => void
}

export function PaymentActionDialog({
  action,
  payment,
  onOpenChange,
  onCompleted,
}: PaymentActionDialogProps) {
  const open = action !== null && (action === "cash" || payment !== null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        {action === "verify" && payment ? (
          <VerifyForm
            key={payment.id}
            payment={payment}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
        {action === "reject" && payment ? (
          <RejectForm
            key={payment.id}
            payment={payment}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
        {action === "void" && payment ? (
          <VoidForm
            key={payment.id}
            payment={payment}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
        {action === "allocation" && payment ? (
          <AllocationForm
            key={payment.id}
            payment={payment}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
        {action === "cash" ? (
          <CashForm
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function VerifyForm({
  payment,
  onCancel,
  onCompleted,
}: {
  payment: PaymentRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const receiptNo = getNextReceiptNumber(
    paymentDirectory,
    payment.branchId,
    MOCK_TODAY
  )
  const activeAllocations = getActiveAllocations(payment)
  const commission = getCommissionPreview(payment)
  const invoiceImpacts = getInvoiceImpacts(activeAllocations)

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4" aria-hidden="true" />
            Verification preview
          </DialogTitle>
          <DialogDescription>
            Preview of verifying {payment.referenceNo ?? payment.id} for{" "}
            {payment.studentName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2Icon
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Payment would be verified
              </span>
              <p className="text-sm">
                {formatLkr(payment.amount)} would be allocated to the target
                invoice and a receipt would be issued.
              </p>
            </div>
          </div>

          <PaymentPreview payment={payment} />
          <AllocationPreviewTable allocations={activeAllocations} />

          <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Side effects
            </span>
            <SideEffectRow
              icon={<ReceiptTextIcon aria-hidden="true" />}
              label="Receipt"
              value={`${receiptNo} would be issued.`}
            />
            {invoiceImpacts.map((impact) => (
              <SideEffectRow
                key={impact.invoiceId}
                icon={<CheckCircle2Icon aria-hidden="true" />}
                label={impact.invoiceNo}
                value={`Balance after verification: ${formatLkr(impact.balance)}.`}
              />
            ))}
            <SideEffectRow
              icon={<WrenchIcon aria-hidden="true" />}
              label="Commission"
              value={
                commission.entries > 0
                  ? `${commission.entries} ${commission.entries === 1 ? "entry" : "entries"} would be created · illustrative ${formatLkr(commission.estimatedAmount)} (module-dependent).`
                  : "No commission entries would be created."
              }
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. The payment is not verified and nothing is
              saved.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back to review
          </Button>
          <Button
            onClick={() => {
              onCancel()
              onCompleted(
                `Verification preview closed for ${payment.referenceNo ?? payment.id} — receipt ${receiptNo} was previewed; nothing was saved.`
              )
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-4" aria-hidden="true" />
          Verify payment
        </DialogTitle>
        <DialogDescription>
          Check the reference, proof and allocation before verifying. A receipt
          and commission entries are side effects of verification.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PaymentPreview payment={payment} />

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Target invoice
            {getTargetInvoiceNumbers(payment).length === 1 ? "" : "s"}:{" "}
            {getTargetInvoiceNumbers(payment).join(", ") || "none"}. The
            proposed allocation is shown in the next step.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => setSubmitted(true)}>Review verification</Button>
      </DialogFooter>
    </>
  )
}

function RejectForm({
  payment,
  onCancel,
  onCompleted,
}: {
  payment: PaymentRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircleIcon className="size-4" aria-hidden="true" />
            Rejection preview
          </DialogTitle>
          <DialogDescription>
            Preview of rejecting {payment.referenceNo ?? payment.id}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-red-600/20 bg-red-500/10 p-4 text-red-800 dark:text-red-300">
            <XCircleIcon
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Payment would be rejected
              </span>
              <p className="text-sm">
                No receipt or commission entries would be created, and invoice
                balances stay unchanged.
              </p>
            </div>
          </div>

          <PaymentPreview payment={payment} />
          <PreviewField label="Reason" value={reason} />

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. The payment is not rejected and nothing is
              saved.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onCancel()
              onCompleted(
                `Rejection preview closed for ${payment.referenceNo ?? payment.id} — no receipt or commission entries were created; nothing was saved.`
              )
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <XCircleIcon className="size-4" aria-hidden="true" />
          Reject payment
        </DialogTitle>
        <DialogDescription>
          Rejecting requires a reason. The payment stays in the register for
          audit and is not counted as paid.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PaymentPreview payment={payment} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-reject-reason">
            <span>
              Reason
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
          </Label>
          <Textarea
            id="payment-reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Reference not found on the bank statement"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "payment-reject-reason-error" : undefined}
          />
          {error ? (
            <p
              id="payment-reject-reason-error"
              className="text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            A rejected payment keeps its submitted reference and reason for the
            audit trail. The student would need to submit a new payment.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Keep pending
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!reason.trim()) {
              setError("Give a short reason for rejecting the payment.")
              return
            }
            setError(null)
            setSubmitted(true)
          }}
        >
          Preview rejection
        </Button>
      </DialogFooter>
    </>
  )
}

function VoidForm({
  payment,
  onCancel,
  onCompleted,
}: {
  payment: PaymentRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const activeAllocations = getActiveAllocations(payment)
  const activeTotal = activeAllocations.reduce(
    (total, allocation) => total + allocation.amount,
    0
  )
  const commission = getCommissionPreview(payment)

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanIcon className="size-4" aria-hidden="true" />
            Void preview
          </DialogTitle>
          <DialogDescription>
            Preview of voiding {payment.referenceNo ?? payment.id}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-red-600/20 bg-red-500/10 p-4 text-red-800 dark:text-red-300">
            <BanIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Payment would be voided
              </span>
              <p className="text-sm">
                Allocations are reversed, not deleted. The receipt would be
                voided and the invoice balances would reopen.
              </p>
            </div>
          </div>

          <PaymentPreview payment={payment} />
          <PreviewField label="Reason" value={reason} />
          <PreviewField
            label="Allocations to reverse"
            value={`${activeAllocations.length} · ${formatLkr(activeTotal)}`}
          />
          <PreviewField
            label="Receipt to void"
            value={payment.receiptNo ?? "No receipt on record"}
          />
          <PreviewField
            label="Commission reversals"
            value={
              commission.entries > 0
                ? `${commission.entries} reversal ${commission.entries === 1 ? "entry" : "entries"} · illustrative ${formatLkr(commission.estimatedAmount)}`
                : "None"
            }
          />

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. The payment is not voided and nothing is saved.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onCancel()
              onCompleted(
                `Void preview closed for ${payment.referenceNo ?? payment.id} — allocations and receipt would be reversed; nothing was saved.`
              )
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BanIcon className="size-4" aria-hidden="true" />
          Void payment
        </DialogTitle>
        <DialogDescription>
          Voiding reverses every active allocation and the receipt. The payment
          record is kept for audit.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PaymentPreview payment={payment} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-void-reason">
            <span>
              Reason
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
          </Label>
          <Textarea
            id="payment-void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Duplicate transfer confirmed by the branch"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "payment-void-reason-error" : undefined}
          />
          {error ? (
            <p
              id="payment-void-reason-error"
              className="text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Allocations are marked reversed instead of being removed. Receipts
            and commission entries keep their audit relationship to the payment.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Keep verified
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!reason.trim()) {
              setError("Give a short reason for voiding the payment.")
              return
            }
            setError(null)
            setSubmitted(true)
          }}
        >
          Preview void
        </Button>
      </DialogFooter>
    </>
  )
}

function AllocationForm({
  payment,
  onCancel,
  onCompleted,
}: {
  payment: PaymentRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const editable = getActiveAllocations(payment)
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editable.map((allocation) => [allocation.id, String(allocation.amount)])
    )
  )
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const updatedAllocations = editable.map((allocation) => ({
    ...allocation,
    amount: Number(amounts[allocation.id]) || 0,
  }))
  const allocatedTotal = updatedAllocations.reduce(
    (total, allocation) => total + allocation.amount,
    0
  )
  const difference = payment.amount - allocatedTotal
  const invoiceImpacts = getReallocationImpacts(payment, updatedAllocations)
  const commission = getCommissionPreview({
    ...payment,
    allocations: updatedAllocations,
  })

  if (editable.length === 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WrenchIcon className="size-4" aria-hidden="true" />
            Adjust allocation
          </DialogTitle>
          <DialogDescription>
            This payment has no active allocation to adjust.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Rejected or voided payments do not carry an active allocation.
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </DialogFooter>
      </>
    )
  }

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WrenchIcon className="size-4" aria-hidden="true" />
            Allocation preview
          </DialogTitle>
          <DialogDescription>
            Preview of the new split for {payment.referenceNo ?? payment.id}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2Icon
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Allocation ready to apply
              </span>
              <p className="text-sm">
                {formatLkr(payment.amount)} would be split across{" "}
                {updatedAllocations.length}{" "}
                {updatedAllocations.length === 1
                  ? "invoice line"
                  : "invoice lines"}
                .
              </p>
            </div>
          </div>

          <AllocationPreviewTable allocations={updatedAllocations} />

          <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Side effects
            </span>
            {invoiceImpacts.map((impact) => (
              <SideEffectRow
                key={impact.invoiceId}
                icon={<CheckCircle2Icon aria-hidden="true" />}
                label={impact.invoiceNo}
                value={`Balance after reallocation: ${formatLkr(impact.balance)}.`}
              />
            ))}
            <SideEffectRow
              icon={<ReceiptTextIcon aria-hidden="true" />}
              label="Receipt"
              value={`${payment.receiptNo ?? "Receipt"} stays issued for the same ${formatLkr(payment.amount)} total.`}
            />
            <SideEffectRow
              icon={<WrenchIcon aria-hidden="true" />}
              label="Commission"
              value={
                commission.entries > 0
                  ? `${commission.entries} ${commission.entries === 1 ? "entry" : "entries"} would be recalculated · illustrative ${formatLkr(commission.estimatedAmount)}.`
                  : "No commission entries would remain."
              }
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. Applying this split would not change the
              invoice total or receipt amount, and nothing is saved.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back to edit
          </Button>
          <Button
            onClick={() => {
              onCancel()
              onCompleted(
                `Allocation preview closed for ${payment.referenceNo ?? payment.id} — nothing was saved.`
              )
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <WrenchIcon className="size-4" aria-hidden="true" />
          Adjust allocation
        </DialogTitle>
        <DialogDescription>
          Split {formatLkr(payment.amount)} across the target invoice lines. The
          total must match the payment amount.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PaymentPreview payment={payment} />

        <div className="flex flex-col gap-3">
          {editable.map((allocation) => (
            <div
              key={allocation.id}
              className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-end"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {allocation.invoiceNo}
                </span>
                <span className="text-xs text-muted-foreground">
                  {allocation.itemDescription}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`allocation-${allocation.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Amount (LKR)
                </Label>
                <Input
                  id={`allocation-${allocation.id}`}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={amounts[allocation.id] ?? ""}
                  onChange={(event) =>
                    setAmounts((current) => ({
                      ...current,
                      [allocation.id]: event.target.value,
                    }))
                  }
                  className="w-full sm:w-36"
                  aria-invalid={error ? true : undefined}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Payment amount {formatLkr(payment.amount)}
          </span>
          <span className="flex flex-wrap items-center gap-3">
            <span>
              Allocated{" "}
              <span className="font-medium tabular-nums">
                {formatLkr(allocatedTotal)}
              </span>
            </span>
            <span
              className={
                difference === 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-400"
              }
            >
              {difference === 0
                ? "Balanced"
                : difference > 0
                  ? `${formatLkr(difference)} unallocated`
                  : `${formatLkr(Math.abs(difference))} over`}
            </span>
          </span>
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            The invoice total and receipt amount never change when an allocation
            is adjusted. Only the split across invoice lines changes.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (
              updatedAllocations.some((allocation) => allocation.amount < 0)
            ) {
              setError("Allocation amounts cannot be negative.")
              return
            }
            if (difference !== 0) {
              setError(
                "The allocation total must match the payment amount exactly."
              )
              return
            }
            setError(null)
            setSubmitted(true)
          }}
        >
          Review allocation
        </Button>
      </DialogFooter>
    </>
  )
}

function CashForm({
  onCancel,
  onCompleted,
}: {
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const openInvoices = invoiceDirectory.filter(isInvoiceOpen)
  const studentOptions = Array.from(
    new Map(
      openInvoices.map((invoice) => [invoice.studentId, invoice.studentName])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label))

  const [studentId, setStudentId] = useState(studentOptions[0]?.value ?? "")
  const studentInvoices = openInvoices.filter(
    (invoice) => invoice.studentId === studentId
  )
  const [invoiceId, setInvoiceId] = useState(studentInvoices[0]?.id ?? "")
  const selectedInvoice =
    studentInvoices.find((invoice) => invoice.id === invoiceId) ??
    studentInvoices[0]
  const [amount, setAmount] = useState(
    selectedInvoice ? String(getInvoiceBalance(selectedInvoice)) : ""
  )
  const [receivedBy, setReceivedBy] = useState(CASHIER_NAME)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const amountNumber = Number(amount) || 0
  const referenceNo = `CASH-${2300 + paymentDirectory.filter((payment) => payment.method === "cash").length}`
  const receiptNo = selectedInvoice
    ? getNextReceiptNumber(
        paymentDirectory,
        selectedInvoice.branchId,
        MOCK_TODAY
      )
    : "RCPT-—"
  const allocations =
    selectedInvoice && amountNumber > 0
      ? proposeAllocations(
          selectedInvoice,
          amountNumber,
          `cash-${referenceNo.toLowerCase()}`
        )
      : []
  const allocatedTotal = allocations.reduce(
    (total, allocation) => total + allocation.amount,
    0
  )
  const balanceAfter = selectedInvoice
    ? Math.max(getInvoiceBalance(selectedInvoice) - allocatedTotal, 0)
    : 0

  const cashierOptions = Array.from(
    new Set([
      CASHIER_NAME,
      ...openInvoices.map((invoice) => getPaymentHandler(invoice.branchId)),
    ])
  ).map((value) => ({ value, label: value }))

  function handleStudentChange(value: string) {
    const nextInvoices = openInvoices.filter(
      (invoice) => invoice.studentId === value
    )
    const nextInvoice = nextInvoices[0]

    setStudentId(value)
    setInvoiceId(nextInvoice?.id ?? "")
    setAmount(nextInvoice ? String(getInvoiceBalance(nextInvoice)) : "")
  }

  function handleInvoiceChange(value: string) {
    const nextInvoice = studentInvoices.find((invoice) => invoice.id === value)

    setInvoiceId(value)
    setAmount(nextInvoice ? String(getInvoiceBalance(nextInvoice)) : "")
  }

  if (submitted && selectedInvoice) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanknoteIcon className="size-4" aria-hidden="true" />
            Cash recording preview
          </DialogTitle>
          <DialogDescription>
            Preview of a staff-recorded cash payment for{" "}
            {selectedInvoice.studentName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2Icon
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Cash would be recorded as verified
              </span>
              <p className="text-sm">
                {formatLkr(amountNumber)} would be recorded at the front desk
                and verified immediately, without a student submission.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
            <PreviewField label="Student" value={selectedInvoice.studentName} />
            <PreviewField label="Branch" value={selectedInvoice.branchName} />
            <PreviewField label="Amount" value={formatLkr(amountNumber)} />
            <PreviewField label="Method" value="Cash" />
            <PreviewField label="Reference" value={referenceNo} />
            <PreviewField label="Received by" value={receivedBy} />
            <PreviewField
              label="Target invoice"
              value={selectedInvoice.invoiceNo}
            />
            <PreviewField
              label="Status after recording"
              value="Verified immediately"
            />
          </dl>

          <AllocationPreviewTable allocations={allocations} />

          <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Side effects
            </span>
            <SideEffectRow
              icon={<ReceiptTextIcon aria-hidden="true" />}
              label="Receipt"
              value={`${receiptNo} would be issued immediately.`}
            />
            <SideEffectRow
              icon={<CheckCircle2Icon aria-hidden="true" />}
              label={selectedInvoice.invoiceNo}
              value={`Balance after cash recording: ${formatLkr(balanceAfter)}.`}
            />
            <SideEffectRow
              icon={<WrenchIcon aria-hidden="true" />}
              label="Commission"
              value={
                allocations.length > 0
                  ? `${allocations.length} ${allocations.length === 1 ? "entry" : "entries"} would be created · illustrative ${formatLkr(Math.round(allocatedTotal * 0.1))} (module-dependent).`
                  : "No commission entries would be created."
              }
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. Cash is recorded by staff, not submitted by a
              student, and nothing is saved.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back to form
          </Button>
          <Button
            onClick={() => {
              onCancel()
              onCompleted(
                `Cash preview closed for ${selectedInvoice.studentName} — receipt ${receiptNo} was previewed; nothing was saved.`
              )
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BanknoteIcon className="size-4" aria-hidden="true" />
          Record cash at the front desk
        </DialogTitle>
        <DialogDescription>
          Cash is recorded by staff, not submitted by a student, and is verified
          immediately. The receipt and commission entries below are a preview
          only.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-student">Student</Label>
            <Select
              items={studentOptions}
              value={studentId}
              onValueChange={(value) => handleStudentChange(value ?? "")}
            >
              <SelectTrigger id="cash-student" className="w-full">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {studentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-invoice">Target invoice</Label>
            <Select
              items={studentInvoices.map((invoice) => ({
                value: invoice.id,
                label: `${invoice.invoiceNo} · ${formatLkr(getInvoiceBalance(invoice))} due`,
              }))}
              value={invoiceId}
              onValueChange={(value) => handleInvoiceChange(value ?? "")}
            >
              <SelectTrigger id="cash-invoice" className="w-full">
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                {studentInvoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNo} ·{" "}
                    {formatLkr(getInvoiceBalance(invoice))} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-amount">
              <span>
                Amount (LKR)
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
            </Label>
            <Input
              id="cash-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
            {selectedInvoice ? (
              <p className="text-xs text-muted-foreground">
                Invoice balance {formatLkr(getInvoiceBalance(selectedInvoice))}.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-received-by">Received by</Label>
            <Select
              items={cashierOptions}
              value={receivedBy}
              onValueChange={(value) => setReceivedBy(value ?? CASHIER_NAME)}
            >
              <SelectTrigger id="cash-received-by" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cashierOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Cash is verified immediately because a staff member counts it at the
            desk. It never waits in the pending verification queue.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!selectedInvoice) {
              setError("Select a student and an open invoice first.")
              return
            }
            if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
              setError("Enter an amount greater than zero.")
              return
            }
            if (amountNumber > getInvoiceBalance(selectedInvoice)) {
              setError("Cash cannot exceed the selected invoice balance.")
              return
            }
            setError(null)
            setSubmitted(true)
          }}
        >
          Preview cash recording
        </Button>
      </DialogFooter>
    </>
  )
}

function PaymentPreview({ payment }: { payment: PaymentRecord }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
      <PreviewField label="Student" value={payment.studentName} />
      <PreviewField label="Branch" value={payment.branchName} />
      <PreviewField label="Amount" value={formatLkr(payment.amount)} />
      <PreviewField
        label="Method"
        value={paymentMethodLabels[payment.method]}
      />
      <PreviewField
        label="Reference"
        value={payment.referenceNo ?? payment.id}
      />
      <PreviewField
        label="Submitted"
        value={formatDateTime(payment.submittedAt)}
      />
    </dl>
  )
}

function AllocationPreviewTable({
  allocations,
}: {
  allocations: PaymentAllocationRecord[]
}) {
  if (allocations.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>No allocation lines are available for this payment.</span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[460px] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Invoice</th>
            <th className="px-3 py-2 font-medium">Invoice line</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {allocations.map((allocation) => (
            <tr key={allocation.id}>
              <td className="px-3 py-2 font-medium">{allocation.invoiceNo}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {allocation.itemDescription}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatLkr(allocation.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/30">
          <tr>
            <td className="px-3 py-2 font-medium" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums">
              {formatLkr(
                allocations.reduce(
                  (total, allocation) => total + allocation.amount,
                  0
                )
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function getInvoiceImpacts(allocations: PaymentAllocationRecord[]) {
  return Array.from(
    new Map(
      allocations.map((allocation) => [
        allocation.invoiceId,
        allocation.invoiceNo,
      ])
    ).entries()
  ).map(([invoiceId, invoiceNo]) => ({
    invoiceId,
    invoiceNo,
    balance: getProjectedInvoiceBalance(invoiceId, allocations),
  }))
}

function getReallocationImpacts(
  payment: PaymentRecord,
  nextAllocations: PaymentAllocationRecord[]
) {
  return Array.from(
    new Map(
      nextAllocations.map((allocation) => [
        allocation.invoiceId,
        allocation.invoiceNo,
      ])
    ).entries()
  ).map(([invoiceId, invoiceNo]) => {
    const invoice = getInvoiceById(invoiceId)
    if (!invoice) return { invoiceId, invoiceNo, balance: 0 }

    const current = getActiveAllocations(payment)
      .filter((allocation) => allocation.invoiceId === invoiceId)
      .reduce((total, allocation) => total + allocation.amount, 0)
    const next = nextAllocations
      .filter((allocation) => allocation.invoiceId === invoiceId)
      .reduce((total, allocation) => total + allocation.amount, 0)

    return {
      invoiceId,
      invoiceNo,
      balance: Math.max(invoice.balance + current - next, 0),
    }
  })
}

function SideEffectRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="font-medium">{label}: </span>
        <span className="text-muted-foreground">{value}</span>
      </span>
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm" title={value}>
        {value}
      </dd>
    </div>
  )
}
