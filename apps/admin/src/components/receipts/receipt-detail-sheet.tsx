"use client"

import { useEffect, useRef, useState } from "react"
import type { FormEvent, ReactNode } from "react"

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  BanIcon,
  BadgeCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  InfoIcon,
  LockIcon,
  QrCodeIcon,
  ReceiptIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  getNextReceiptNumber,
  getReceiptById,
  maskContentHash,
  maskSignature,
  maskVerificationCode,
  type ReceiptRecord,
} from "@/lib/receipts-data"
import { formatDateTime, formatDisplayDate } from "@/lib/students-data"

type ReceiptDetailSheetProps = {
  receipt: ReceiptRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotice: (message: string) => void
  onSelectReceipt: (receipt: ReceiptRecord) => void
}

export function ReceiptDetailSheet({
  receipt,
  open,
  onOpenChange,
  onNotice,
  onSelectReceipt,
}: ReceiptDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [voidOpen, setVoidOpen] = useState(false)

  useEffect(() => {
    headerRef.current?.scrollIntoView({ block: "start" })
  }, [receipt?.id])

  const replacement = receipt?.replacedByReceiptId
    ? getReceiptById(receipt.replacedByReceiptId)
    : undefined
  const original = receipt?.replacesReceiptId
    ? getReceiptById(receipt.replacesReceiptId)
    : undefined

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          initialFocus={headerRef}
          className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
        >
          {receipt ? (
            <>
              <SheetHeader
                ref={headerRef}
                tabIndex={-1}
                className="border-b p-6 pr-14 outline-none"
              >
                <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <ReceiptIcon className="size-5" aria-hidden="true" />
                  <span className="font-mono">{receipt.receiptNo}</span>
                  <ReceiptStatusBadge status={receipt.status} />
                </SheetTitle>
                <SheetDescription>
                  {receipt.studentName} · {receipt.branchName} ·{" "}
                  {formatLkr(receipt.amount)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 p-6">
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<InfoIcon />}
                    title="Overview"
                    aside={
                      <Badge variant="outline" className="rounded-full">
                        <LockIcon aria-hidden="true" />
                        Branch-scoped &amp; immutable
                      </Badge>
                    }
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                    <ProfileField
                      label="Receipt number"
                      value={receipt.receiptNo}
                      mono
                    />
                    <ProfileField
                      label="Branch"
                      value={`${receipt.branchName} (${receipt.branchCode})`}
                    />
                    <ProfileField
                      label="Student"
                      value={`${receipt.studentName} · ${receipt.studentNo}`}
                    />
                    <ProfileField
                      label="Payment reference"
                      value={receipt.paymentReference}
                      mono
                    />
                    <ProfileField label="Method" value={receipt.methodName} />
                    <ProfileField
                      label="Paid on"
                      value={formatDisplayDate(receipt.paidOn)}
                    />
                    <ProfileField
                      label="Amount"
                      value={formatLkr(receipt.amount)}
                    />
                    <ProfileField
                      label="Issued at"
                      value={formatDateTime(receipt.issuedAt)}
                    />
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Receipt numbers come from the branch receipt counter and
                    never change. Corrections happen through void and reissue,
                    not by editing this record.
                  </p>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<FileTextIcon />}
                    title="Receipt PDF"
                    aside={
                      receipt.hasPdf ? (
                        <Badge
                          variant="outline"
                          className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                        >
                          PDF available
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full text-muted-foreground"
                        >
                          No PDF attached
                        </Badge>
                      )
                    }
                  />
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <FileTextIcon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">
                        {receipt.hasPdf
                          ? "PDF preview placeholder"
                          : "PDF not available in this sample"}
                      </span>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {receipt.hasPdf
                          ? "The generated receipt PDF would render here, with the verification QR and signature footer."
                          : "This sample receipt has no attached file, so the PDF indicator is off."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!receipt.hasPdf}
                      onClick={() =>
                        onNotice(
                          `Downloading ${receipt.receiptNo} is a placeholder in this UI demo. No file was generated.`
                        )
                      }
                    >
                      <DownloadIcon data-icon="inline-start" />
                      Download PDF (demo)
                    </Button>
                  </div>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<QrCodeIcon />}
                    title="Verification"
                    aside={
                      <Badge variant="outline" className="rounded-full">
                        Masked
                      </Badge>
                    }
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Verification code
                      </span>
                      <span className="font-mono text-sm">
                        {maskVerificationCode(receipt.verificationCode)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onNotice(
                          `A public verify link for ${receipt.receiptNo} would be copied. Scanning and lookup are placeholders in this demo.`
                        )
                      }
                    >
                      <CopyIcon data-icon="inline-start" />
                      Copy verify link (demo)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The verification code is safe to share for QR checks.
                    Signing keys are never shown in the admin UI.
                  </p>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<ShieldCheckIcon />}
                    title="Signature & integrity (support details)"
                    aside={
                      <Badge variant="outline" className="rounded-full">
                        Read only
                      </Badge>
                    }
                  />
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
                    <ProfileField
                      label="Content hash"
                      value={maskContentHash(receipt.contentHash)}
                      mono
                    />
                    <ProfileField
                      label="Signature"
                      value={maskSignature(receipt.signature)}
                      mono
                    />
                    <ProfileField
                      label="Signed at"
                      value={formatDateTime(receipt.signedAt)}
                    />
                    <ProfileField
                      label="Payment reference"
                      value={receipt.paymentReference}
                      mono
                    />
                  </dl>
                  <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <CircleAlertIcon
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Raw hashes and signing keys are never exposed as primary
                      UI. These masked values are support metadata for verifying
                      a printed receipt.
                    </span>
                  </div>
                </section>

                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<RefreshCwIcon />}
                    title="Void & reissue"
                  />
                  {receipt.status === "void" && replacement ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                      <div className="flex items-start gap-2">
                        <BanIcon
                          className="mt-0.5 size-4 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            This receipt is void
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Replaced by {replacement.receiptNo} on{" "}
                            {formatDisplayDate(
                              replacement.issuedAt.slice(0, 10)
                            )}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectReceipt(replacement)}
                      >
                        View replacement
                      </Button>
                    </div>
                  ) : receipt.status === "issued" && original ? (
                    <div className="flex items-start gap-2 rounded-lg border p-4 text-sm">
                      <BadgeCheckIcon
                        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>
                        This receipt replaced the voided receipt{" "}
                        <span className="font-mono">{original.receiptNo}</span>.
                        Both records are kept for audit.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                      <InfoIcon
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        No void or reissue relationship for this receipt.
                      </span>
                    </div>
                  )}

                  {receipt.status === "issued" ? (
                    <Button variant="outline" onClick={() => setVoidOpen(true)}>
                      <BanIcon data-icon="inline-start" />
                      Void and reissue (demo)
                    </Button>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    A payment keeps one active receipt. Voiding keeps the number
                    for audit, and a reissue creates a new receipt under the
                    same branch counter.
                  </p>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
                <span className="text-xs text-muted-foreground">
                  Sample receipt · no changes are saved
                </span>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <VoidReissueDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        receipt={receipt}
        onDone={(message) => {
          onNotice(message)
        }}
      />
    </>
  )
}

function VoidReissueDialog({
  open,
  onOpenChange,
  receipt,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receipt: ReceiptRecord | null
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const replacementReceiptNo = receipt
    ? getNextReceiptNumber(receipt.branchCode)
    : ""

  useEffect(() => {
    setReason("")
    setError(null)
    setSubmitted(false)
  }, [open])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!reason.trim()) {
      setError("A reason is required to void a receipt.")
      return
    }

    setError(null)
    setSubmitted(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanIcon className="size-4" aria-hidden="true" />
            Void and reissue receipt
          </DialogTitle>
          <DialogDescription>
            {receipt
              ? `This action applies to ${receipt.receiptNo}. It is a UI preview — nothing is changed.`
              : "This action is a UI preview — nothing is changed."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CheckIcon
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Void and reissue preview ready
                </span>
                <p className="text-sm">
                  The current receipt would be kept with a void status, and{" "}
                  {replacementReceiptNo || "a new receipt"} would be issued
                  under the same branch counter.
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Current receipt
                </dt>
                <dd className="font-mono">{receipt?.receiptNo ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Amount
                </dt>
                <dd>{receipt ? formatLkr(receipt.amount) : "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Replacement receipt
                </dt>
                <dd className="font-mono">{replacementReceiptNo || "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reason
                </dt>
                <dd>{reason.trim()}</dd>
              </div>
            </dl>
            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Demo only. No receipt is voided and no replacement is issued.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="receipt-void-form"
            className="flex flex-col gap-3"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="receipt-void-reason"
                className="text-sm font-medium"
              >
                Reason{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Textarea
                id="receipt-void-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Duplicate July payment; reissued after bank reconciliation"
                aria-invalid={error ? true : undefined}
                aria-describedby={
                  error ? "receipt-void-reason-error" : undefined
                }
              />
              {error ? (
                <p
                  id="receipt-void-reason-error"
                  className="text-xs text-destructive"
                >
                  {error}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A reason is required. Voided receipts and their replacement
                  are both kept for audit.
                </p>
              )}
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Back to form
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onDone(
                    receipt
                      ? `${receipt.receiptNo} void preview closed. No receipt was voided or reissued — this is a UI demo.`
                      : "Void preview closed. No receipt was voided or reissued — this is a UI demo."
                  )
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="receipt-void-form"
                variant="destructive"
              >
                Void and reissue (demo)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function ProfileField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={mono ? "truncate font-mono text-sm" : "truncate text-sm"}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
