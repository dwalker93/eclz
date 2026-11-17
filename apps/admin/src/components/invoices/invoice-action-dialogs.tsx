"use client"

import { useEffect, useMemo, useState } from "react"

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
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  LockIcon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react"

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { formatLkr } from "@/lib/courses-data"
import { getInvoiceBalance, type InvoiceRecord } from "@/lib/invoices-data"
import { formatDisplayDate } from "@/lib/students-data"

export type InvoiceAction = "adjustment" | "cancel" | "reissue"

type InvoiceActionDialogProps = {
  action: InvoiceAction | null
  invoice: InvoiceRecord | null
  onOpenChange: (open: boolean) => void
  onCompleted: (message: string) => void
}

const adjustmentKindOptions = [
  { value: "adjustment", label: "Adjustment line" },
  { value: "discount", label: "Discount line" },
]

const adjustmentDirectionOptions = [
  { value: "increase", label: "Increase amount owed" },
  { value: "reduce", label: "Reduce amount owed" },
]

export function InvoiceActionDialog({
  action,
  invoice,
  onOpenChange,
  onCompleted,
}: InvoiceActionDialogProps) {
  const open = action !== null && invoice !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        {action === "adjustment" && invoice ? (
          <AdjustmentForm
            key={invoice.id}
            invoice={invoice}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
        {action === "cancel" && invoice ? (
          <CancelForm
            key={invoice.id}
            invoice={invoice}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
        {action === "reissue" && invoice ? (
          <ReissueForm
            key={invoice.id}
            invoice={invoice}
            onCancel={() => onOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AdjustmentForm({
  invoice,
  onCancel,
  onCompleted,
}: {
  invoice: InvoiceRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const payableItems = useMemo(
    () => invoice.items.filter((item) => item.amount > 0),
    [invoice.items]
  )
  const [kind, setKind] = useState<"adjustment" | "discount">("adjustment")
  const [direction, setDirection] = useState<"increase" | "reduce">("increase")
  const [appliesTo, setAppliesTo] = useState<string>(payableItems[0]?.id ?? "")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const magnitude = Number(amount) || 0
  const isDiscount = kind === "discount"
  const signedAmount = isDiscount
    ? -magnitude
    : direction === "reduce"
      ? -magnitude
      : magnitude
  const projectedTotal = invoice.total + signedAmount
  const projectedBalance = Math.max(projectedTotal - invoice.amountPaid, 0)
  const appliesToOptions = payableItems.map((item) => ({
    value: item.id,
    label: item.description,
  }))

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!description.trim()) {
      nextErrors.description = "Describe the adjustment or discount."
    }
    if (!amount.trim() || !Number.isFinite(magnitude) || magnitude <= 0) {
      nextErrors.amount = "Enter an amount greater than zero."
    }
    if (!isDiscount && direction === "reduce" && magnitude > invoice.total) {
      nextErrors.amount = "A reduction cannot exceed the invoice total."
    }
    if (isDiscount && !appliesTo) {
      nextErrors.appliesTo = "A discount must point at a payable line."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WrenchIcon className="size-4" aria-hidden="true" />
            Adjustment preview
          </DialogTitle>
          <DialogDescription>
            Preview of the new line that would be posted to {invoice.invoiceNo}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
            <CheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {isDiscount ? "Discount line ready" : "Adjustment line ready"}
              </span>
              <p className="text-sm">
                A new {isDiscount ? "discount" : "adjustment"} of{" "}
                {formatLkr(magnitude)} would be appended to {invoice.invoiceNo}.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
            <PreviewField
              label="Line type"
              value={isDiscount ? "Discount" : "Adjustment"}
            />
            <PreviewField
              label="Direction"
              value={
                isDiscount
                  ? "Reduces amount owed"
                  : direction === "reduce"
                    ? "Reduces amount owed"
                    : "Increases amount owed"
              }
            />
            <PreviewField label="Description" value={description} />
            <PreviewField
              label="Applies to"
              value={
                appliesToOptions.find((option) => option.value === appliesTo)
                  ?.label ?? "Whole invoice"
              }
            />
            <PreviewField
              label="Current total"
              value={formatLkr(invoice.total)}
            />
            <PreviewField
              label="Projected total"
              value={formatLkr(projectedTotal)}
            />
            <PreviewField
              label="Current balance"
              value={formatLkr(getInvoiceBalance(invoice))}
            />
            <PreviewField
              label="Projected balance"
              value={formatLkr(projectedBalance)}
            />
          </dl>

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. Issued lines stay unchanged; the new line is
              not saved and no total, balance or allocation is recalculated.
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
                `${isDiscount ? "Discount" : "Adjustment"} preview closed for ${invoice.invoiceNo} — nothing was saved.`
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
          Add adjustment or discount
        </DialogTitle>
        <DialogDescription>
          Post a correction to {invoice.invoiceNo} as a new line. Existing
          issued lines are immutable.
        </DialogDescription>
      </DialogHeader>

      <form
        id="invoice-adjustment-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjustment-kind">Line type</Label>
            <Select
              items={adjustmentKindOptions}
              value={kind}
              onValueChange={(value) =>
                setKind((value as "adjustment" | "discount") ?? "adjustment")
              }
            >
              <SelectTrigger id="adjustment-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {adjustmentKindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjustment-direction">Direction</Label>
            <Select
              items={adjustmentDirectionOptions}
              value={isDiscount ? "reduce" : direction}
              onValueChange={(value) =>
                setDirection((value as "increase" | "reduce") ?? "increase")
              }
              disabled={isDiscount}
            >
              <SelectTrigger id="adjustment-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {adjustmentDirectionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDiscount ? (
              <p className="text-xs text-muted-foreground">
                Discount lines always reduce the amount owed.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adjustment-description">
            <span>
              Description
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
          </Label>
          <Input
            id="adjustment-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Billing correction for extra session"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={
              errors.description ? "adjustment-description-error" : undefined
            }
          />
          {errors.description ? (
            <p
              id="adjustment-description-error"
              className="text-xs text-destructive"
            >
              {errors.description}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjustment-amount">
              <span>
                Amount (LKR)
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
            </Label>
            <Input
              id="adjustment-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 500"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={
                errors.amount ? "adjustment-amount-error" : undefined
              }
            />
            {errors.amount ? (
              <p
                id="adjustment-amount-error"
                className="text-xs text-destructive"
              >
                {errors.amount}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjustment-applies-to">
              <span>
                Applies to
                {isDiscount ? (
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                ) : (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                )}
              </span>
            </Label>
            <Select
              items={appliesToOptions}
              value={appliesTo || null}
              onValueChange={(value) => setAppliesTo(value ?? "")}
            >
              <SelectTrigger
                id="adjustment-applies-to"
                className="w-full"
                aria-invalid={errors.appliesTo ? true : undefined}
              >
                <SelectValue placeholder="Whole invoice" />
              </SelectTrigger>
              <SelectContent>
                {appliesToOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.appliesTo ? (
              <p className="text-xs text-destructive">{errors.appliesTo}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reductions point at the payable line they reduce.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Adjustments and discounts are append-only lines. Nothing is written
            and the current totals remain unchanged in this demo.
          </span>
        </div>
      </form>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="invoice-adjustment-form">
          Preview adjustment
        </Button>
      </DialogFooter>
    </>
  )
}

function CancelForm({
  invoice,
  onCancel,
  onCompleted,
}: {
  invoice: InvoiceRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const canCancel =
    invoice.status !== "cancelled" && invoice.status !== "waived"

  useEffect(() => {
    setReason("")
    setError(null)
    setSubmitted(false)
  }, [invoice.id])

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanIcon className="size-4" aria-hidden="true" />
            Cancellation preview
          </DialogTitle>
          <DialogDescription>
            Preview of cancelling {invoice.invoiceNo}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-red-600/20 bg-red-500/10 p-4 text-red-800 dark:text-red-300">
            <BanIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {invoice.invoiceNo} would be cancelled
              </span>
              <p className="text-sm">
                Every line keeps its cancelled marker and the invoice is
                retained for audit. A corrected invoice can be issued
                separately.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
            <PreviewField label="Student" value={invoice.studentName} />
            <PreviewField label="Branch" value={invoice.branchName} />
            <PreviewField label="Total" value={formatLkr(invoice.total)} />
            <PreviewField
              label="Paid so far"
              value={formatLkr(invoice.amountPaid)}
            />
            <PreviewField label="Reason" value={reason || "No reason given"} />
            <PreviewField label="Current status" value={invoice.status} />
          </dl>

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. The invoice is not cancelled and no payment or
              allocation is changed.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back
          </Button>
          <Button
            onClick={() => {
              onCancel()
              onCompleted(
                `Cancellation preview closed for ${invoice.invoiceNo} — nothing was cancelled.`
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
          Cancel invoice
        </DialogTitle>
        <DialogDescription>
          Cancelling is append-only: lines are marked cancelled and the record
          is kept. Use reissue to create a corrected invoice.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{invoice.invoiceNo}</span>
            <span className="text-xs text-muted-foreground">
              {invoice.studentName} · {invoice.branchName} ·{" "}
              {formatDisplayDate(invoice.issuedOn)}
            </span>
          </span>
          <InvoiceStatusBadge status={invoice.status} />
        </div>

        {!canCancel ? (
          <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              This invoice is already cancelled or waived, so it cannot be
              cancelled again.
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-reason">
            <span>
              Reason
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Issued in error; correct invoice will be reissued"
            aria-invalid={error ? true : undefined}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            A cancelled invoice no longer blocks reissuing the same recurring
            period, and its uncancelled lines are excluded from totals.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Keep invoice
        </Button>
        <Button
          variant="destructive"
          disabled={!canCancel}
          onClick={() => {
            if (!reason.trim()) {
              setError("Give a short reason for cancelling.")
              return
            }
            setError(null)
            setSubmitted(true)
          }}
        >
          Preview cancellation
        </Button>
      </DialogFooter>
    </>
  )
}

function ReissueForm({
  invoice,
  onCancel,
  onCompleted,
}: {
  invoice: InvoiceRecord
  onCancel: () => void
  onCompleted: (message: string) => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const canReissue = invoice.status === "cancelled"

  if (submitted) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCwIcon className="size-4" aria-hidden="true" />
            Reissue preview
          </DialogTitle>
          <DialogDescription>
            Preview of the corrected invoice for {invoice.studentName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
            <CheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                A corrected invoice would be issued
              </span>
              <p className="text-sm">
                The cancelled invoice stays for audit, and a new document copies
                its payable lines.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Copied line</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.items
                  .filter((item) => item.amount > 0)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatLkr(item.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr>
                  <td className="px-3 py-2 font-medium">New total</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatLkr(invoice.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Demo preview only. No new invoice is created and nothing is saved.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSubmitted(false)}>
            Back
          </Button>
          <Button
            onClick={() => {
              onCancel()
              onCompleted(
                `Reissue preview closed for ${invoice.studentName} — no invoice was created.`
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
          <RefreshCwIcon className="size-4" aria-hidden="true" />
          Reissue invoice
        </DialogTitle>
        <DialogDescription>
          Create a corrected invoice from a cancelled one. The original stays
          for audit.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{invoice.invoiceNo}</span>
            <span className="text-xs text-muted-foreground">
              {invoice.studentName} · {invoice.branchName}
            </span>
          </span>
          <Badge variant="outline" className="rounded-full">
            {invoice.items.filter((item) => item.amount > 0).length} payable
            lines
          </Badge>
        </div>

        {!canReissue ? (
          <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Only a cancelled invoice can be reissued.</span>
          </div>
        ) : null}

        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            A reissued invoice is a new document with its own issued date and
            due date. Payments are never moved between invoices.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!canReissue} onClick={() => setSubmitted(true)}>
          Preview reissue
        </Button>
      </DialogFooter>
    </>
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
