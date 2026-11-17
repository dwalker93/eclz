/**
 * Local mock fixtures for the Payments UI demo.
 *
 * Most records are derived from the invoice fixtures so payment references,
 * amounts and allocations stay coherent across the Invoices and Payments
 * pages. A few verification-queue records are added on top of the invoice
 * seeds so the pending, rejected and voided tabs have realistic examples.
 *
 * The schema concepts shown here are `payment`, `payment_allocation`,
 * `bank_account`, `file` and `gateway_transaction`. Nothing is persisted.
 */

import {
  getInvoiceById,
  invoiceDirectory,
  paymentMethodLabels,
  paymentStatusLabels,
  type InvoiceRecord,
  type PaymentMethodType,
  type PaymentStatus,
} from "@/lib/invoices-data"
import { MOCK_TODAY } from "@/lib/students-data"

export type { PaymentMethodType, PaymentStatus }
export { paymentMethodLabels, paymentStatusLabels }

export type PaymentSource = "student" | "cashier"

export type PaymentChannel =
  "Student portal" | "Guardian portal" | "Front desk" | "Gateway checkout"

export type GatewayStatus = "initiated" | "succeeded" | "failed" | "cancelled"

export type BankAccountRecord = {
  id: string
  bankName: string
  accountName: string
  maskedNumber: string
  branchName: string
}

export type PaymentSlipRecord = {
  fileName: string
  mimeType: string
  sizeLabel: string
  uploadedAt: string
  uploadedByLabel: string
}

export type GatewayTransactionRecord = {
  provider: string
  providerRef: string
  status: GatewayStatus
  initiatedAt: string
  note: string
}

export type PaymentAllocationRecord = {
  id: string
  invoiceId: string
  invoiceNo: string
  invoiceItemId: string
  itemDescription: string
  amount: number
  reversedAt: string | null
}

export type PaymentRecord = {
  id: string
  referenceNo: string | null
  method: PaymentMethodType
  amount: number
  status: PaymentStatus
  studentId: string
  studentName: string
  studentNo: string
  branchId: string
  branchName: string
  submittedAt: string
  paidOn: string
  submittedByLabel: string
  submittedVia: PaymentChannel
  source: PaymentSource
  intendedInvoiceNos: string[]
  bankAccount: BankAccountRecord | null
  slip: PaymentSlipRecord | null
  gatewayTransaction: GatewayTransactionRecord | null
  allocations: PaymentAllocationRecord[]
  verifiedAt: string | null
  verifiedByLabel: string | null
  rejectedAt: string | null
  rejectedByLabel: string | null
  rejectionReason: string | null
  voidedAt: string | null
  voidedByLabel: string | null
  voidReason: string | null
  receiptNo: string | null
  cashRecordedBy: string | null
}

export const CASHIER_NAME = "Nadeesha Fernando"

const branchHandlers: Record<string, string> = {
  "br-colombo": "Kavindu Jayasuriya",
  "br-kandy": "Dilani Wickramasinghe",
  "br-galle": "Ruwan Perera",
  "br-negombo": "Nadeesha Fernando",
  "br-jaffna": "Aravinth Raj",
}

const branchCodes: Record<string, string> = {
  "br-colombo": "COL",
  "br-kandy": "KAN",
  "br-galle": "GAL",
  "br-negombo": "NEG",
  "br-jaffna": "JAF",
}

const branchBankAccounts: Record<string, BankAccountRecord> = {
  "br-colombo": {
    id: "ba-colombo",
    bankName: "Commercial Bank of Ceylon",
    accountName: "Eclz Institute (Pvt) Ltd",
    maskedNumber: "•••• 4567",
    branchName: "Colombo 03",
  },
  "br-kandy": {
    id: "ba-kandy",
    bankName: "Sampath Bank",
    accountName: "Eclz Institute (Pvt) Ltd",
    maskedNumber: "•••• 8821",
    branchName: "Kandy",
  },
  "br-galle": {
    id: "ba-galle",
    bankName: "Hatton National Bank",
    accountName: "Eclz Institute (Pvt) Ltd",
    maskedNumber: "•••• 3390",
    branchName: "Galle",
  },
  "br-negombo": {
    id: "ba-negombo",
    bankName: "Commercial Bank of Ceylon",
    accountName: "Eclz Institute (Pvt) Ltd",
    maskedNumber: "•••• 7712",
    branchName: "Negombo",
  },
  "br-jaffna": {
    id: "ba-jaffna",
    bankName: "Bank of Ceylon",
    accountName: "Eclz Institute (Pvt) Ltd",
    maskedNumber: "•••• 6604",
    branchName: "Jaffna",
  },
}

export function getPaymentHandler(branchId: string) {
  return branchHandlers[branchId] ?? "Payment handler"
}

export function getBranchCode(branchId: string) {
  return branchCodes[branchId] ?? "HQ"
}

export function getBankAccount(branchId: string) {
  return branchBankAccounts[branchId] ?? null
}

function referenceDigits(reference: string) {
  return reference.replace(/\D/g, "")
}

function submittedTime(reference: string) {
  const digits = referenceDigits(reference)
  const seed = digits ? Number(digits.slice(-2)) : 17
  const hour = 8 + (seed % 9)
  const minute = (seed * 7) % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function verifiedTime(reference: string) {
  const digits = referenceDigits(reference)
  const seed = digits ? Number(digits.slice(-2)) : 11
  const hour = 10 + (seed % 7)
  const minute = (seed * 11) % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function slipFor(
  reference: string,
  submittedAt: string,
  uploadedByLabel: string
): PaymentSlipRecord {
  const digits = referenceDigits(reference)
  const sizeKb = 280 + (digits ? Number(digits.slice(-3)) % 420 : 120)

  return {
    fileName: `slip-${reference.toLowerCase()}.jpg`,
    mimeType: "image/jpeg",
    sizeLabel: `${sizeKb} KB`,
    uploadedAt: submittedAt,
    uploadedByLabel,
  }
}

function gatewayFor(
  reference: string,
  submittedAt: string,
  status: GatewayStatus,
  note: string
): GatewayTransactionRecord {
  const digits = referenceDigits(reference)

  return {
    provider: "PayHere",
    providerRef: `PH-${digits || "000000"}`,
    status,
    initiatedAt: submittedAt,
    note,
  }
}

function mapInvoiceAllocation(
  invoice: InvoiceRecord,
  allocation: InvoiceRecord["allocations"][number]
): PaymentAllocationRecord {
  return {
    id: allocation.id,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    invoiceItemId: allocation.invoiceItemId,
    itemDescription: allocation.itemDescription,
    amount: allocation.amount,
    reversedAt: allocation.reversedAt,
  }
}

function getPayableRemaining(invoice: InvoiceRecord) {
  const remaining = new Map<string, number>()

  for (const item of invoice.items) {
    if (item.amount > 0) remaining.set(item.id, item.amount)
  }

  for (const allocation of invoice.allocations) {
    if (allocation.reversedAt) continue
    const current = remaining.get(allocation.invoiceItemId)
    if (current === undefined) continue
    remaining.set(
      allocation.invoiceItemId,
      Math.max(current - allocation.amount, 0)
    )
  }

  return remaining
}

export function proposeAllocations(
  invoice: InvoiceRecord,
  amount: number,
  idPrefix: string,
  reversedAt: string | null = null
): PaymentAllocationRecord[] {
  const remaining = getPayableRemaining(invoice)
  const allocations: PaymentAllocationRecord[] = []
  let left = amount

  for (const item of invoice.items) {
    if (left <= 0) break
    if (item.amount <= 0) continue

    const capacity = remaining.get(item.id) ?? 0
    if (capacity <= 0) continue

    const slice = Math.min(capacity, left)
    left -= slice
    remaining.set(item.id, capacity - slice)

    allocations.push({
      id: `${idPrefix}-${allocations.length + 1}`,
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceItemId: item.id,
      itemDescription: item.description,
      amount: slice,
      reversedAt,
    })
  }

  return allocations
}

function buildFromInvoicePayment(
  invoice: InvoiceRecord,
  payment: InvoiceRecord["payments"][number]
): PaymentRecord {
  const status = payment.status
  const isCash = payment.method === "cash"
  const submittedAt = `${payment.paidOn}T${submittedTime(payment.reference)}:00+05:30`
  const verifiedAt =
    status === "verified"
      ? `${payment.verifiedOn ?? payment.paidOn}T${verifiedTime(payment.reference)}:00+05:30`
      : status === "voided"
        ? `${payment.paidOn}T11:20:00+05:30`
        : null

  const allocations =
    status === "verified"
      ? invoice.allocations
          .filter(
            (allocation) =>
              allocation.paymentId === payment.id && !allocation.reversedAt
          )
          .map((allocation) => mapInvoiceAllocation(invoice, allocation))
      : status === "pending_verification"
        ? proposeAllocations(invoice, payment.amount, `${payment.id}-proposed`)
        : invoice.allocations
            .filter((allocation) => allocation.paymentId === payment.id)
            .map((allocation) => mapInvoiceAllocation(invoice, allocation))

  const isGateway = payment.method === "gateway"
  const isBankTransfer = payment.method === "bank_transfer"
  const submittedVia: PaymentChannel = isCash
    ? "Front desk"
    : isGateway
      ? "Gateway checkout"
      : "Student portal"
  const submittedBy = isCash ? CASHIER_NAME : invoice.studentName
  const handler = getPaymentHandler(invoice.branchId)

  return {
    id: payment.id,
    referenceNo: payment.reference,
    method: payment.method,
    amount: payment.amount,
    status,
    studentId: invoice.studentId,
    studentName: invoice.studentName,
    studentNo: invoice.studentNo,
    branchId: invoice.branchId,
    branchName: invoice.branchName,
    submittedAt,
    paidOn: payment.paidOn,
    submittedByLabel: `${submittedBy} · ${submittedVia}`,
    submittedVia,
    source: isCash ? "cashier" : "student",
    intendedInvoiceNos: [invoice.invoiceNo],
    bankAccount: isBankTransfer
      ? (getBankAccount(invoice.branchId) ?? null)
      : null,
    slip: isBankTransfer
      ? slipFor(payment.reference, submittedAt, submittedBy)
      : null,
    gatewayTransaction: isGateway
      ? gatewayFor(
          payment.reference,
          submittedAt,
          status === "rejected"
            ? "failed"
            : status === "voided"
              ? "cancelled"
              : "succeeded",
          status === "pending_verification"
            ? "Provider confirmed the capture; staff verification is still pending."
            : status === "voided"
              ? "The gateway capture succeeded before the payment was voided."
              : "Provider capture confirmed and reconciled by staff."
        )
      : null,
    allocations,
    verifiedAt,
    verifiedByLabel:
      status === "verified" || status === "voided" ? handler : null,
    rejectedAt: null,
    rejectedByLabel: null,
    rejectionReason: null,
    voidedAt: status === "voided" ? `${payment.paidOn}T16:30:00+05:30` : null,
    voidedByLabel: status === "voided" ? handler : null,
    voidReason:
      status === "voided"
        ? "Duplicate transfer reversed after the student confirmed the other payment."
        : null,
    receiptNo: null,
    cashRecordedBy: isCash ? CASHIER_NAME : null,
  }
}

type ExtraPaymentSeed = {
  invoiceId: string
  amount: number
  method: PaymentMethodType
  reference: string
  submittedAt: string
  status: "pending_verification" | "rejected" | "voided"
  submittedVia?: PaymentChannel
  submittedBy?: string
  verifiedAt?: string
  actionAt?: string
  reason?: string
  gatewayStatus?: GatewayStatus
}

const extraPaymentSeeds: ExtraPaymentSeed[] = [
  {
    invoiceId: "inv-janith-2026-11",
    amount: 2500,
    method: "bank_transfer",
    reference: "BR-4512",
    submittedAt: "2026-11-12T10:20:00+05:30",
    status: "pending_verification",
  },
  {
    invoiceId: "inv-tharindu-2026-11",
    amount: 3800,
    method: "gateway",
    reference: "GW-8044",
    submittedAt: "2026-11-13T09:42:00+05:30",
    status: "pending_verification",
    gatewayStatus: "succeeded",
  },
  {
    invoiceId: "inv-ruwanthi-2026-10",
    amount: 2000,
    method: "bank_transfer",
    reference: "BR-4499",
    submittedAt: "2026-11-10T15:05:00+05:30",
    status: "pending_verification",
  },
  {
    invoiceId: "inv-adeesha-2026-08",
    amount: 6000,
    method: "gateway",
    reference: "GW-8031",
    submittedAt: "2026-11-11T11:30:00+05:30",
    status: "pending_verification",
    gatewayStatus: "succeeded",
  },
  {
    invoiceId: "inv-hasini-2026-11",
    amount: 1500,
    method: "bank_transfer",
    reference: "BR-4508",
    submittedAt: "2026-11-12T16:10:00+05:30",
    status: "pending_verification",
  },
  {
    invoiceId: "inv-anjali-2026-11",
    amount: 3000,
    method: "bank_transfer",
    reference: "BR-4515",
    submittedAt: "2026-11-13T08:55:00+05:30",
    status: "pending_verification",
  },
  {
    invoiceId: "inv-dinuka-2026-11",
    amount: 8500,
    method: "bank_transfer",
    reference: "BR-4475",
    submittedAt: "2026-11-09T10:05:00+05:30",
    status: "rejected",
    actionAt: "2026-11-09T11:10:00+05:30",
    reason: "Duplicate of BR-4471 — the invoice was already settled in full.",
  },
  {
    invoiceId: "inv-tharindu-2026-11",
    amount: 3800,
    method: "gateway",
    reference: "GW-7999",
    submittedAt: "2026-11-08T19:22:00+05:30",
    status: "rejected",
    actionAt: "2026-11-08T19:30:00+05:30",
    reason: "Gateway transaction failed — no funds were received.",
    gatewayStatus: "failed",
  },
  {
    invoiceId: "inv-anjali-2026-11",
    amount: 5000,
    method: "bank_transfer",
    reference: "BR-4479",
    submittedAt: "2026-11-07T12:15:00+05:30",
    status: "voided",
    verifiedAt: "2026-11-07T13:05:00+05:30",
    actionAt: "2026-11-07T16:45:00+05:30",
    reason:
      "Duplicate transfer; reversed after the student confirmed the other payment.",
  },
]

function buildExtraPayment(seed: ExtraPaymentSeed): PaymentRecord | null {
  const invoice = getInvoiceById(seed.invoiceId)
  if (!invoice) return null

  const isRejected = seed.status === "rejected"
  const isVoided = seed.status === "voided"
  const isBankTransfer = seed.method === "bank_transfer"
  const isGateway = seed.method === "gateway"
  const submittedBy = seed.submittedBy ?? invoice.studentName
  const submittedVia =
    seed.submittedVia ?? (isGateway ? "Gateway checkout" : "Student portal")
  const handler = getPaymentHandler(invoice.branchId)

  return {
    id: `pay-${seed.reference.toLowerCase()}`,
    referenceNo: seed.reference,
    method: seed.method,
    amount: seed.amount,
    status: seed.status,
    studentId: invoice.studentId,
    studentName: invoice.studentName,
    studentNo: invoice.studentNo,
    branchId: invoice.branchId,
    branchName: invoice.branchName,
    submittedAt: seed.submittedAt,
    paidOn: seed.submittedAt.slice(0, 10),
    submittedByLabel: `${submittedBy} · ${submittedVia}`,
    submittedVia,
    source: "student",
    intendedInvoiceNos: [invoice.invoiceNo],
    bankAccount: isBankTransfer
      ? (getBankAccount(invoice.branchId) ?? null)
      : null,
    slip: isBankTransfer
      ? slipFor(seed.reference, seed.submittedAt, submittedBy)
      : null,
    gatewayTransaction: isGateway
      ? gatewayFor(
          seed.reference,
          seed.submittedAt,
          seed.gatewayStatus ??
            (isRejected ? "failed" : isVoided ? "cancelled" : "succeeded"),
          isRejected
            ? "Provider reported a failed attempt; no funds were captured."
            : isVoided
              ? "The gateway capture succeeded before the payment was voided."
              : "Provider confirmed the capture; staff verification is still pending."
        )
      : null,
    allocations: isRejected
      ? []
      : proposeAllocations(
          invoice,
          seed.amount,
          `alloc-${seed.reference.toLowerCase()}`,
          isVoided ? (seed.actionAt ?? seed.submittedAt) : null
        ),
    verifiedAt: isVoided
      ? (seed.verifiedAt ?? seed.actionAt ?? seed.submittedAt)
      : null,
    verifiedByLabel: isVoided ? handler : null,
    rejectedAt: isRejected ? (seed.actionAt ?? seed.submittedAt) : null,
    rejectedByLabel: isRejected ? handler : null,
    rejectionReason: isRejected
      ? (seed.reason ?? "Payment could not be verified.")
      : null,
    voidedAt: isVoided ? (seed.actionAt ?? seed.submittedAt) : null,
    voidedByLabel: isVoided ? handler : null,
    voidReason: isVoided
      ? (seed.reason ?? "Payment voided after review.")
      : null,
    receiptNo: null,
    cashRecordedBy: null,
  }
}

function assignReceiptNumbers(records: PaymentRecord[]) {
  const counters: Record<string, number> = {}
  const verified = [...records]
    .filter(
      (payment) => payment.status === "verified" || payment.status === "voided"
    )
    .sort((left, right) => {
      const leftTime = left.verifiedAt ?? ""
      const rightTime = right.verifiedAt ?? ""
      if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1
      return (left.referenceNo ?? "").localeCompare(right.referenceNo ?? "")
    })

  for (const payment of verified) {
    const code = getBranchCode(payment.branchId)
    const year = (payment.verifiedAt ?? MOCK_TODAY).slice(0, 4)
    const key = `${code}-${year}`
    counters[key] = (counters[key] ?? 0) + 1
    payment.receiptNo = `RCPT-${code}-${year}-${String(counters[key]).padStart(4, "0")}`
  }
}

export const paymentDirectory: PaymentRecord[] = (() => {
  const derived = invoiceDirectory.flatMap((invoice) =>
    invoice.payments.map((payment) => buildFromInvoicePayment(invoice, payment))
  )
  const extras = extraPaymentSeeds
    .map((seed) => buildExtraPayment(seed))
    .filter((payment): payment is PaymentRecord => payment !== null)
  const records = [...derived, ...extras]

  assignReceiptNumbers(records)

  return records.sort((left, right) => {
    if (left.submittedAt !== right.submittedAt) {
      return left.submittedAt < right.submittedAt ? 1 : -1
    }
    return (left.referenceNo ?? "") < (right.referenceNo ?? "") ? 1 : -1
  })
})()

export function getNextReceiptNumber(
  records: PaymentRecord[],
  branchId: string,
  asOf: string = MOCK_TODAY
) {
  const code = getBranchCode(branchId)
  const year = asOf.slice(0, 4)
  const prefix = `RCPT-${code}-${year}-`
  const count = records.filter((payment) =>
    payment.receiptNo?.startsWith(prefix)
  ).length

  return `${prefix}${String(count + 1).padStart(4, "0")}`
}

export function getTargetInvoiceNumbers(payment: PaymentRecord) {
  const fromAllocations = payment.allocations.map(
    (allocation) => allocation.invoiceNo
  )

  return Array.from(
    new Set([...fromAllocations, ...payment.intendedInvoiceNos])
  )
}

export function getActiveAllocations(payment: PaymentRecord) {
  return payment.allocations.filter((allocation) => !allocation.reversedAt)
}

export function getPaymentAllocationTotal(payment: PaymentRecord) {
  return getActiveAllocations(payment).reduce(
    (total, allocation) => total + allocation.amount,
    0
  )
}

export function getCommissionPreview(payment: PaymentRecord) {
  const active = getActiveAllocations(payment).filter(
    (allocation) => allocation.amount > 0
  )
  const base = active.reduce(
    (total, allocation) => total + allocation.amount,
    0
  )

  return {
    entries: active.length,
    estimatedAmount: Math.round(base * 0.1),
  }
}

export function getProjectedInvoiceBalance(
  invoiceId: string,
  allocations: PaymentAllocationRecord[]
) {
  const invoice = getInvoiceById(invoiceId)
  if (!invoice) return 0

  const applied = allocations
    .filter(
      (allocation) =>
        allocation.invoiceId === invoiceId && !allocation.reversedAt
    )
    .reduce((total, allocation) => total + allocation.amount, 0)

  return Math.max(invoice.balance - applied, 0)
}

export function getPaymentUsage(records: PaymentRecord[] = paymentDirectory) {
  const pending = records.filter(
    (payment) => payment.status === "pending_verification"
  )
  const verified = records.filter((payment) => payment.status === "verified")
  const rejected = records.filter((payment) => payment.status === "rejected")
  const voided = records.filter((payment) => payment.status === "voided")
  const cash = records.filter(
    (payment) => payment.method === "cash" && payment.status === "verified"
  )

  const totalFor = (items: PaymentRecord[]) =>
    items.reduce((total, payment) => total + payment.amount, 0)

  return {
    total: records.length,
    pending: pending.length,
    pendingAmount: totalFor(pending),
    verified: verified.length,
    verifiedAmount: totalFor(verified),
    rejected: rejected.length,
    rejectedAmount: totalFor(rejected),
    voided: voided.length,
    voidedAmount: totalFor(voided),
    cashRecorded: cash.length,
    cashAmount: totalFor(cash),
    attention: rejected.length + voided.length,
    attentionAmount: totalFor(rejected) + totalFor(voided),
  }
}

export const paymentStatusTabs: {
  value: PaymentStatus
  label: string
  description: string
}[] = [
  {
    value: "pending_verification",
    label: paymentStatusLabels.pending_verification,
    description:
      "Student and gateway payments waiting for a payment handler to check the reference, slip and allocation.",
  },
  {
    value: "verified",
    label: paymentStatusLabels.verified,
    description:
      "Verified payments with an issued receipt and active invoice allocations.",
  },
  {
    value: "rejected",
    label: paymentStatusLabels.rejected,
    description:
      "Payments that failed review. The reason stays in the register for audit.",
  },
  {
    value: "voided",
    label: paymentStatusLabels.voided,
    description:
      "Reversed payments. Allocations and receipts keep a void/reversed marker.",
  },
]

export const paymentTabCounts: Record<PaymentStatus, number> = {
  pending_verification: paymentDirectory.filter(
    (payment) => payment.status === "pending_verification"
  ).length,
  verified: paymentDirectory.filter((payment) => payment.status === "verified")
    .length,
  rejected: paymentDirectory.filter((payment) => payment.status === "rejected")
    .length,
  voided: paymentDirectory.filter((payment) => payment.status === "voided")
    .length,
}

export const paymentMethodFilterOptions = [
  { value: "all", label: "All methods" },
  ...(Object.entries(paymentMethodLabels) as [PaymentMethodType, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const paymentBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...Array.from(
    new Map(
      paymentDirectory.map((payment) => [payment.branchId, payment.branchName])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const paymentStudentFilterOptions = [
  { value: "all", label: "All students" },
  ...Array.from(
    new Map(
      paymentDirectory.map((payment) => [
        payment.studentId,
        payment.studentName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const gatewayStatusLabels: Record<GatewayStatus, string> = {
  initiated: "Initiated",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
}
