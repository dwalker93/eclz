/**
 * Local mock fixtures for the Receipts UI demo.
 *
 * Receipts are derived from the verified and voided payments so receipt numbers,
 * payment references, students, branches and amounts stay coherent with the
 * Payments page. Two voided payments also get a reissued replacement receipt to
 * demonstrate the void/reissue relationship.
 *
 * Raw signatures and content hashes are stored but never rendered directly; the
 * UI only shows masked values. Nothing here is persisted.
 */

import { formatLkr } from "@/lib/courses-data"
import {
  getBranchCode,
  paymentDirectory,
  type PaymentRecord,
} from "@/lib/payments-data"

export type ReceiptStatus = "issued" | "void"
export type ReceiptMethod = "Bank transfer" | "Cash" | "Card gateway"

export type ReceiptRecord = {
  id: string
  receiptNo: string
  status: ReceiptStatus
  branchId: string
  branchName: string
  branchCode: string
  studentId: string
  studentName: string
  studentNo: string
  amount: number
  methodName: ReceiptMethod
  paymentId: string
  paymentReference: string
  paidOn: string
  issuedAt: string
  signedAt: string
  verificationCode: string
  contentHash: string
  signature: string
  hasPdf: boolean
  replacedByReceiptId: string | null
  /** Derived: the earlier voided receipt this record replaced, when present. */
  replacesReceiptId: string | null
}

const methodNames: Record<PaymentRecord["method"], ReceiptMethod> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  gateway: "Card gateway",
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16).toUpperCase().padStart(8, "0")
}

function buildReceipt(
  payment: PaymentRecord,
  overrides: Partial<ReceiptRecord> = {}
): ReceiptRecord {
  const branchCode = getBranchCode(payment.branchId)
  const fingerprint = hashString(payment.id)
  const issuedAt = payment.verifiedAt ?? `${payment.paidOn}T09:00:00+05:30`

  return {
    id: `rcp-${payment.id}`,
    receiptNo:
      payment.receiptNo ??
      `RCPT-${branchCode}-2026-${String(
        paymentDirectory.indexOf(payment) + 1
      ).padStart(4, "0")}`,
    status: payment.status === "voided" ? "void" : "issued",
    branchId: payment.branchId,
    branchName: payment.branchName,
    branchCode,
    studentId: payment.studentId,
    studentName: payment.studentName,
    studentNo: payment.studentNo,
    amount: payment.amount,
    methodName: methodNames[payment.method],
    paymentId: payment.id,
    paymentReference: payment.referenceNo ?? payment.id,
    paidOn: payment.paidOn,
    issuedAt,
    signedAt: issuedAt,
    verificationCode: `VRF-${fingerprint.slice(0, 4)}-${fingerprint.slice(4)}`,
    contentHash: `${fingerprint}${fingerprint}${fingerprint}${fingerprint}`,
    signature: `ed25519:sample-${fingerprint}`,
    hasPdf: true,
    replacedByReceiptId: null,
    replacesReceiptId: null,
    ...overrides,
  }
}

const receiptPayments = paymentDirectory.filter(
  (payment) =>
    (payment.status === "verified" || payment.status === "voided") &&
    payment.receiptNo !== null
)

const baseReceipts = receiptPayments.map((payment) => buildReceipt(payment))

type ReissueSeed = {
  paymentId: string
  receiptNo: string
  issuedAt: string
}

const reissueSeeds: ReissueSeed[] = [
  {
    paymentId: "inv-ishara-2026-11-pay-1",
    receiptNo: "RCPT-COL-2026-0009",
    issuedAt: "2026-11-05T09:30:00+05:30",
  },
  {
    paymentId: "pay-br-4479",
    receiptNo: "RCPT-COL-2026-0010",
    issuedAt: "2026-11-08T10:15:00+05:30",
  },
]

const reissueReceipts = reissueSeeds.flatMap((seed) => {
  const payment = receiptPayments.find(
    (candidate) => candidate.id === seed.paymentId
  )
  if (!payment) return []

  const original = baseReceipts.find(
    (receiptRecord) => receiptRecord.paymentId === payment.id
  )
  if (!original) return []

  return [
    buildReceipt(payment, {
      id: `rcp-reissue-${payment.id}`,
      receiptNo: seed.receiptNo,
      status: "issued",
      issuedAt: seed.issuedAt,
      signedAt: seed.issuedAt,
      replacesReceiptId: original.id,
    }),
  ]
})

const receiptsWithLinks = baseReceipts.map((receiptRecord) => {
  const replacement = reissueReceipts.find(
    (candidate) => candidate.replacesReceiptId === receiptRecord.id
  )

  return {
    ...receiptRecord,
    replacedByReceiptId: replacement?.id ?? null,
  }
})

export const receipts: ReceiptRecord[] = [
  ...receiptsWithLinks,
  ...reissueReceipts,
].sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))

export function getReceiptById(receiptId: string) {
  return receipts.find((receiptRecord) => receiptRecord.id === receiptId)
}

export function getReceiptUsageCounts() {
  const issued = receipts.filter(
    (receiptRecord) => receiptRecord.status === "issued"
  )

  return {
    total: receipts.length,
    issued: issued.length,
    voided: receipts.length - issued.length,
    issuedValue: issued.reduce(
      (total, receiptRecord) => total + receiptRecord.amount,
      0
    ),
  }
}

export function getIssuedValueLabel() {
  return formatLkr(getReceiptUsageCounts().issuedValue)
}

export const receiptStatusLabels: Record<ReceiptStatus, string> = {
  issued: "Issued",
  void: "Void",
}

export const receiptStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "issued", label: "Issued" },
  { value: "void", label: "Void" },
]

const receiptBranches = Array.from(
  new Map(
    receipts.map((receiptRecord) => [
      receiptRecord.branchId,
      { id: receiptRecord.branchId, name: receiptRecord.branchName },
    ])
  ).values()
).sort((left, right) => left.name.localeCompare(right.name))

export const receiptBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...receiptBranches.map((branch) => ({
    value: branch.id,
    label: branch.name,
  })),
]

export const receiptStudentFilterOptions = [
  { value: "all", label: "All students" },
  ...Array.from(
    new Map(
      receipts.map((receiptRecord) => [
        receiptRecord.studentId,
        receiptRecord.studentName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

/** Next branch-scoped receipt number for the demo year. */
export function getNextReceiptNumber(branchCode: string, year = "2026") {
  const prefix = `RCPT-${branchCode}-${year}-`
  const highest = receipts
    .filter((receiptRecord) => receiptRecord.receiptNo.startsWith(prefix))
    .map((receiptRecord) =>
      Number(receiptRecord.receiptNo.slice(prefix.length))
    )
    .filter((sequence) => Number.isFinite(sequence))
    .reduce((max, sequence) => Math.max(max, sequence), 0)

  return `${prefix}${String(highest + 1).padStart(4, "0")}`
}

export const receiptPaymentMethods: ReceiptMethod[] = [
  "Bank transfer",
  "Cash",
  "Card gateway",
]

/** Keep the first four and last four characters; mask everything between. */
function maskMiddle(value: string, visible = 4) {
  if (value.length <= visible * 2) {
    return "•".repeat(value.length)
  }

  const head = value.slice(0, visible)
  const tail = value.slice(-visible)
  const maskedLength = Math.max(value.length - visible * 2, 4)

  return `${head}${"•".repeat(maskedLength)}${tail}`
}

export function maskVerificationCode(code: string) {
  return maskMiddle(code, 4)
}

export function maskContentHash(hash: string) {
  return `sha256: ${maskMiddle(hash, 4)}`
}

export function maskSignature(signature: string) {
  const [algorithm = "signature"] = signature.split(":")

  return `${algorithm} •••• (verified at signing)`
}
