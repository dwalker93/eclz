"use client"

import { useState } from "react"
import type { ReactNode } from "react"

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
import {
  BanknoteIcon,
  BadgeCheckIcon,
  CircleAlertIcon,
  FilePenIcon,
  FileTextIcon,
  HandCoinsIcon,
  InfoIcon,
  LockIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { PayoutStatusBadge } from "@/components/teacher-payouts/payout-status-badge"
import { formatLkr } from "@/lib/courses-data"
import { MOCK_TODAY, formatDisplayDate } from "@/lib/students-data"
import {
  formatPayoutAmount,
  getPayoutEntryGroups,
  getPayoutPeriodLabel,
  type CommissionEntryRecord,
  type PayoutPaymentMethod,
  type TeacherPayoutRecord,
} from "@/lib/teacher-payouts-data"

import type { PayoutAction } from "@/components/teacher-payouts/payout-detail-sheet"

export type PayoutActionWithCreate = PayoutAction | "create"

export type PayoutPaymentDetails = {
  reference: string
  paidAt: string
  method: PayoutPaymentMethod
  proofFileName: string
}

type PayoutActionDialogProps = {
  action: PayoutActionWithCreate | null
  payout: TeacherPayoutRecord | null
  candidates: TeacherPayoutRecord[]
  onOpenChange: (open: boolean) => void
  onCreateDraft: (candidate: TeacherPayoutRecord) => void
  onApprove: (payout: TeacherPayoutRecord) => void
  onPay: (payout: TeacherPayoutRecord, details: PayoutPaymentDetails) => void
  onDiscard: (payout: TeacherPayoutRecord) => void
}

export function PayoutActionDialog({
  action,
  payout,
  candidates,
  onOpenChange,
  onCreateDraft,
  onApprove,
  onPay,
  onDiscard,
}: PayoutActionDialogProps) {
  const open = action === "create" || (action !== null && payout !== null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        {action === "create" ? (
          <CreateDraftForm
            candidates={candidates}
            onCancel={() => onOpenChange(false)}
            onCreate={onCreateDraft}
          />
        ) : null}
        {action === "preview" && payout ? (
          <PreviewForm payout={payout} onClose={() => onOpenChange(false)} />
        ) : null}
        {action === "approve" && payout ? (
          <ApproveForm
            payout={payout}
            onCancel={() => onOpenChange(false)}
            onApprove={onApprove}
          />
        ) : null}
        {action === "pay" && payout ? (
          <PayForm
            payout={payout}
            onCancel={() => onOpenChange(false)}
            onPay={onPay}
          />
        ) : null}
        {action === "discard" && payout ? (
          <DiscardForm
            payout={payout}
            onCancel={() => onOpenChange(false)}
            onDiscard={onDiscard}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CreateDraftForm({
  candidates,
  onCancel,
  onCreate,
}: {
  candidates: TeacherPayoutRecord[]
  onCancel: () => void
  onCreate: (candidate: TeacherPayoutRecord) => void
}) {
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "")
  const selected =
    candidates.find((candidate) => candidate.id === selectedId) ?? null
  const groups = selected ? getPayoutEntryGroups(selected) : null

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FilePenIcon className="size-4" aria-hidden="true" />
          Create payout draft
        </DialogTitle>
        <DialogDescription>
          Choose a lecturer and period with accrued entries. The draft groups
          accruals and reversals without calculating or settling anything.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payout-candidate">Lecturer and period</Label>
          <Select
            items={candidates.map((candidate) => ({
              value: candidate.id,
              label: `${candidate.lecturerName} · ${getPayoutPeriodLabel(
                candidate.periodId
              )}`,
            }))}
            value={selectedId}
            onValueChange={(value) => setSelectedId(value ?? "")}
          >
            <SelectTrigger id="payout-candidate" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.lecturerName} ·{" "}
                  {getPayoutPeriodLabel(candidate.periodId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected && groups ? (
          <>
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {selected.lecturerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getPayoutPeriodLabel(selected.periodId)} ·{" "}
                    {formatDisplayDate(selected.periodStart)} –{" "}
                    {formatDisplayDate(selected.periodEnd)}
                  </span>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {selected.entries.length} entries
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <PreviewAmount
                  label="Gross collected"
                  value={formatLkr(selected.grossCollected)}
                />
                <PreviewAmount
                  label="Base after reversals"
                  value={formatPayoutAmount(selected.commissionBase)}
                />
                <PreviewAmount
                  label="Commission"
                  value={formatPayoutAmount(selected.commissionAmount)}
                />
                <PreviewAmount
                  label="Net payable"
                  value={formatLkr(selected.amountDue)}
                />
              </div>

              <div className="flex flex-col gap-2 border-t pt-3">
                <GroupRow
                  icon={<HandCoinsIcon />}
                  label="Accrued entries"
                  count={groups.accruals.length}
                  amount={formatPayoutAmount(groups.accrualTotals.teacher)}
                />
                <GroupRow
                  icon={<RotateCcwIcon />}
                  label="Reversal entries"
                  count={groups.reversals.length}
                  amount={formatPayoutAmount(groups.reversalTotals.teacher)}
                />
              </div>

              <div className="flex flex-col gap-2 border-t pt-3">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Entries in this draft
                </span>
                <ul className="flex flex-col gap-2">
                  {selected.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-start justify-between gap-2 text-sm"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">{entry.studentName}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.courseName} · {entry.invoiceNo} ·{" "}
                          {formatDisplayDate(entry.occurredOn)}
                        </span>
                      </div>
                      <span className="text-right tabular-nums">
                        {formatPayoutAmount(entry.teacherAmount)}
                        <span className="block text-xs text-muted-foreground">
                          base {formatPayoutAmount(entry.baseAmount)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo only. Creating a draft adds a local preview row; no payout
                is written and no commission is calculated.
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
            No lecturer-period has unbilled entries right now.
          </div>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => selected && onCreate(selected)}
          disabled={!selected}
        >
          <FilePenIcon data-icon="inline-start" />
          Create draft
        </Button>
      </DialogFooter>
    </>
  )
}

function PreviewForm({
  payout,
  onClose,
}: {
  payout: TeacherPayoutRecord
  onClose: () => void
}) {
  const groups = getPayoutEntryGroups(payout)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileTextIcon className="size-4" aria-hidden="true" />
          Draft preview
        </DialogTitle>
        <DialogDescription>
          {payout.lecturerName} · {getPayoutPeriodLabel(payout.periodId)}. The
          draft groups accrued and reversal entries; nothing is changed by
          previewing.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <PayoutStatusBadge status={payout.status} />
          <Badge variant="outline" className="rounded-full font-mono">
            {payout.payoutNo}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDisplayDate(payout.periodStart)} –{" "}
            {formatDisplayDate(payout.periodEnd)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
          <PreviewAmount
            label="Gross collected"
            value={formatLkr(payout.grossCollected)}
          />
          <PreviewAmount
            label="Commission base"
            value={formatPayoutAmount(payout.commissionBase)}
          />
          <PreviewAmount
            label="Commission"
            value={formatPayoutAmount(payout.commissionAmount)}
          />
          <PreviewAmount
            label="Net payable"
            value={formatLkr(payout.amountDue)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <PreviewGroup
            icon={<HandCoinsIcon />}
            title="Accrued entries"
            entries={groups.accruals}
            count={groups.accruals.length}
            base={groups.accrualTotals.base}
            commission={groups.accrualTotals.commission}
            teacher={groups.accrualTotals.teacher}
          />
          <PreviewGroup
            icon={<RotateCcwIcon />}
            title="Reversal entries"
            entries={groups.reversals}
            count={groups.reversals.length}
            base={groups.reversalTotals.base}
            commission={groups.reversalTotals.commission}
            teacher={groups.reversalTotals.teacher}
          />
        </div>

        {payout.carryForwardIn < 0 || payout.carryForwardOut < 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <RotateCcwIcon
                className="size-4 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              Carry-forward context
            </span>
            {payout.carryForwardIn < 0 ? (
              <p>
                {formatPayoutAmount(payout.carryForwardIn)} carried in from an
                earlier period and deducted before payment.
              </p>
            ) : null}
            {payout.carryForwardOut < 0 ? (
              <p>
                Net payable is LKR 0.{" "}
                {formatPayoutAmount(payout.carryForwardOut)} would carry forward
                to the next payout.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <CircleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            {payout.status === "paid"
              ? "This payout is already paid and immutable. Preview only; no record is changed."
              : payout.status === "approved"
                ? "Approved totals are frozen. Payment is a separate step; previewing changes nothing."
                : "Preview only. Approval is a separate step and no payout is saved."}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close preview
        </Button>
      </DialogFooter>
    </>
  )
}

function ApproveForm({
  payout,
  onCancel,
  onApprove,
}: {
  payout: TeacherPayoutRecord
  onCancel: () => void
  onApprove: (payout: TeacherPayoutRecord) => void
}) {
  const groups = getPayoutEntryGroups(payout)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BadgeCheckIcon className="size-4" aria-hidden="true" />
          Approve payout
        </DialogTitle>
        <DialogDescription>
          Confirm {payout.payoutNo} for {payout.lecturerName}. Approval freezes
          the totals and entries.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PayoutConfirmationSummary payout={payout} />

        <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            What approval does
          </span>
          <SideEffect
            icon={<LockIcon aria-hidden="true" />}
            label="Freezes totals"
            value={`${formatLkr(payout.amountDue)} becomes the approved net payable.`}
          />
          <SideEffect
            icon={<FilePenIcon aria-hidden="true" />}
            label="Locks entries"
            value={`${payout.entries.length} accrued and reversal entries can no longer be edited.`}
          />
          <SideEffect
            icon={<HandCoinsIcon aria-hidden="true" />}
            label="Reversals"
            value={
              groups.reversals.length > 0
                ? `${groups.reversals.length} reversal ${groups.reversals.length === 1 ? "entry stays" : "entries stay"} in the payout.`
                : "No reversals in this period."
            }
          />
          <SideEffect
            icon={<BanknoteIcon aria-hidden="true" />}
            label="Payment"
            value="Payment is a separate step after approval."
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <CircleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            Demo confirmation only. The payout status changes locally; nothing
            is approved in a real system.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onApprove(payout)}>
          <BadgeCheckIcon data-icon="inline-start" />
          Approve payout
        </Button>
      </DialogFooter>
    </>
  )
}

function PayForm({
  payout,
  onCancel,
  onPay,
}: {
  payout: TeacherPayoutRecord
  onCancel: () => void
  onPay: (payout: TeacherPayoutRecord, details: PayoutPaymentDetails) => void
}) {
  const [reference, setReference] = useState("")
  const [paidAt, setPaidAt] = useState(MOCK_TODAY)
  const [method, setMethod] = useState<PayoutPaymentMethod>("Bank transfer")
  const [proofFileName, setProofFileName] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    if (reference.trim().length === 0) {
      setError("Enter the payment reference used for this payout.")
      return
    }

    if (paidAt.length === 0) {
      setError("Choose the date the payout was paid.")
      return
    }

    setError(null)
    onPay(payout, {
      reference: reference.trim(),
      paidAt,
      method,
      proofFileName:
        proofFileName.trim() || `payout-${payout.payoutNo.toLowerCase()}.pdf`,
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BanknoteIcon className="size-4" aria-hidden="true" />
          Pay payout
        </DialogTitle>
        <DialogDescription>
          Record the payment reference and proof for {payout.payoutNo}. Paid
          payouts are immutable.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PayoutConfirmationSummary payout={payout} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-reference">Payment reference</Label>
            <Input
              id="payout-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. BANK-88421"
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-paid-on">Paid on</Label>
            <Input
              id="payout-paid-on"
              type="date"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-method">Method</Label>
            <Select
              items={[
                { value: "Bank transfer", label: "Bank transfer" },
                { value: "Cash", label: "Cash" },
                { value: "Cheque", label: "Cheque" },
              ]}
              value={method}
              onValueChange={(value) =>
                setMethod((value ?? "Bank transfer") as PayoutPaymentMethod)
              }
            >
              <SelectTrigger id="payout-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-proof">Proof file</Label>
            <div className="flex items-center gap-2">
              <Input
                id="payout-proof"
                value={proofFileName}
                onChange={(event) => setProofFileName(event.target.value)}
                placeholder={`payout-${payout.payoutNo.toLowerCase()}.pdf`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Upload proof placeholder"
                onClick={() =>
                  setProofFileName(
                    `payout-${payout.payoutNo.toLowerCase()}.pdf`
                  )
                }
              >
                <UploadIcon aria-hidden="true" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload is a placeholder. Only the file name is shown.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            What paying does
          </span>
          <SideEffect
            icon={<BanknoteIcon aria-hidden="true" />}
            label="Marks paid"
            value={`${formatLkr(payout.amountDue)} would be recorded as paid on ${formatDisplayDate(paidAt)}.`}
          />
          <SideEffect
            icon={<FileTextIcon aria-hidden="true" />}
            label="Proof"
            value="The reference and proof file name are attached to the payout."
          />
          <SideEffect
            icon={<LockIcon aria-hidden="true" />}
            label="Immutable"
            value="A paid payout cannot be edited; corrections use a new reversal entry."
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <CircleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            Demo only. This records a local status and sample reference; no
            money moves and no payout is settled.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          <BanknoteIcon data-icon="inline-start" />
          Confirm payment
        </Button>
      </DialogFooter>
    </>
  )
}

function DiscardForm({
  payout,
  onCancel,
  onDiscard,
}: {
  payout: TeacherPayoutRecord
  onCancel: () => void
  onDiscard: (payout: TeacherPayoutRecord) => void
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Trash2Icon className="size-4" aria-hidden="true" />
          Discard draft
        </DialogTitle>
        <DialogDescription>
          Discard {payout.payoutNo} for {payout.lecturerName}?
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PayoutConfirmationSummary payout={payout} />

        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <CircleAlertIcon
            className="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="font-medium">The draft would be removed</span>
            <p>
              Its {payout.entries.length} entries would return to the unbilled
              pool for a future draft. No commission entry, payment or paid
              payout is deleted.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <CircleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            Demo only. The draft disappears from this local preview; nothing is
            deleted from a database.
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          Keep draft
        </Button>
        <Button variant="destructive" onClick={() => onDiscard(payout)}>
          <Trash2Icon data-icon="inline-start" />
          Discard draft
        </Button>
      </DialogFooter>
    </>
  )
}

function PayoutConfirmationSummary({
  payout,
}: {
  payout: TeacherPayoutRecord
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{payout.lecturerName}</span>
          <span className="text-xs text-muted-foreground">
            {getPayoutPeriodLabel(payout.periodId)} ·{" "}
            {formatDisplayDate(payout.periodStart)} –{" "}
            {formatDisplayDate(payout.periodEnd)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PayoutStatusBadge status={payout.status} />
          <Badge variant="outline" className="rounded-full font-mono">
            {payout.payoutNo}
          </Badge>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <PreviewAmount
          label="Gross collected"
          value={formatLkr(payout.grossCollected)}
        />
        <PreviewAmount
          label="Commission"
          value={formatPayoutAmount(payout.commissionAmount)}
        />
        <PreviewAmount
          label="Carry-forward"
          value={
            payout.carryForwardIn === 0
              ? "None"
              : formatPayoutAmount(payout.carryForwardIn)
          }
        />
        <PreviewAmount
          label="Net payable"
          value={formatLkr(payout.amountDue)}
        />
      </dl>
    </div>
  )
}

function PreviewAmount({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function PreviewGroup({
  icon,
  title,
  entries,
  count,
  base,
  commission,
  teacher,
}: {
  icon: ReactNode
  title: string
  entries: CommissionEntryRecord[]
  count: number
  base: number
  commission: number
  teacher: number
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
          {title}
        </span>
        <Badge variant="outline" className="rounded-full">
          {count} {count === 1 ? "entry" : "entries"}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <PreviewAmount label="Base" value={formatPayoutAmount(base)} />
        <PreviewAmount
          label="Commission"
          value={formatPayoutAmount(commission)}
        />
        <PreviewAmount label="Lecturer" value={formatPayoutAmount(teacher)} />
      </div>
      {entries.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t pt-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-start justify-between gap-2 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">{entry.studentName}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.courseName} · {entry.invoiceNo} ·{" "}
                  {formatDisplayDate(entry.occurredOn)}
                </span>
              </div>
              <span className="text-right tabular-nums">
                {formatPayoutAmount(entry.teacherAmount)}
                <span className="block text-xs text-muted-foreground">
                  base {formatPayoutAmount(entry.baseAmount)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function GroupRow({
  icon,
  label,
  count,
  amount,
}: {
  icon: ReactNode
  label: string
  count: number
  amount: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="[&>svg]:size-3.5">{icon}</span>
        {label}
      </span>
      <span className="tabular-nums">
        {count} · {amount}
      </span>
    </div>
  )
}

function SideEffect({
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
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-3.5">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
    </div>
  )
}
