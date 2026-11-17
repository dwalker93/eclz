/**
 * Local mock fixtures for the Invoices UI demo.
 *
 * Mirrors `invoice`, `invoice_item`, `invoice_installment`, `payment` and
 * `payment_allocation` using the shared Students and Courses fixtures. Totals
 * are computed from the signed item lines so the header stays coherent:
 * `total = subtotal - discountTotal`, `amountPaid` counts only active
 * allocations, and `balance = total - amountPaid`. Issued invoices are
 * append-only, so every line carries a `cancelledAt` marker only on cancelled
 * invoices instead of being edited in place. Nothing here is persisted.
 */

import { getCourseById, type CourseRecord } from "@/lib/courses-data"
import { getFeeStructureById } from "@/lib/fee-structures-data"
import {
  MOCK_TODAY,
  getPrimaryBranch,
  students,
  type StudentEnrollment,
  type StudentRecord,
} from "@/lib/students-data"

export type InvoiceStatus =
  "pending" | "partial" | "paid" | "overdue" | "waived" | "cancelled"

export type InvoiceItemKind =
  "recurring_fee" | "package_fee" | "content" | "adjustment" | "discount"

export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue"

export type PaymentMethodType = "bank_transfer" | "cash" | "gateway"

export type PaymentStatus =
  "pending_verification" | "verified" | "rejected" | "voided"

export type InvoiceLineRecord = {
  id: string
  kind: InvoiceItemKind
  description: string
  /** Signed: fees and content are positive, discounts negative, adjustments either. */
  amount: number
  enrollmentId: string | null
  courseName: string | null
  feeStructureId: string | null
  feeStructureName: string | null
  gradeLevelId: string | null
  gradeName: string | null
  /** Discounts and negative adjustments point at the payable line they reduce. */
  appliesToItemId: string | null
  appliesToDescription: string | null
  contentPurchaseId: string | null
  /** Inclusive first day of the covered period. */
  periodStart: string | null
  /** Exclusive end of the covered period. */
  periodEnd: string | null
  cancelledAt: string | null
}

export type InvoiceInstallmentRecord = {
  id: string
  seq: number
  dueDate: string
  amount: number
  amountPaid: number
  status: InstallmentStatus
}

export type InvoiceAllocationRecord = {
  id: string
  paymentId: string
  paymentReference: string
  paymentMethod: PaymentMethodType
  paidOn: string
  verifiedOn: string
  amount: number
  invoiceItemId: string
  itemDescription: string
  reversedAt: string | null
}

export type InvoicePaymentRecord = {
  id: string
  reference: string
  method: PaymentMethodType
  amount: number
  paidOn: string
  verifiedOn: string | null
  status: PaymentStatus
  allocationCount: number
}

export type InvoiceRecord = {
  id: string
  /** Display reference only — the schema does not model an invoice number. */
  invoiceNo: string
  studentId: string
  studentName: string
  studentNo: string
  branchId: string
  branchName: string
  issuedOn: string
  dueDate: string
  installmentOptionId: string | null
  installmentOptionName: string | null
  subtotal: number
  discountTotal: number
  total: number
  amountPaid: number
  balance: number
  status: InvoiceStatus
  createdAt: string
  cancelledAt: string | null
  items: InvoiceLineRecord[]
  installments: InvoiceInstallmentRecord[]
  payments: InvoicePaymentRecord[]
  allocations: InvoiceAllocationRecord[]
}

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  pending: "Pending",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
  cancelled: "Cancelled",
}

export const invoiceItemKindLabels: Record<InvoiceItemKind, string> = {
  recurring_fee: "Recurring fee",
  package_fee: "Package fee",
  content: "Content",
  adjustment: "Adjustment",
  discount: "Discount",
}

export const installmentStatusLabels: Record<InstallmentStatus, string> = {
  pending: "Pending",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
}

export const paymentMethodLabels: Record<PaymentMethodType, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  gateway: "Payment gateway",
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending_verification: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
  voided: "Voided",
}

type EnrollmentLookup = {
  student: StudentRecord
  enrollment: StudentEnrollment
}

const enrollmentIndex = new Map<string, EnrollmentLookup>()

for (const student of students) {
  for (const enrollment of student.enrollments) {
    enrollmentIndex.set(enrollment.id, { student, enrollment })
  }
}

const studentIndex = new Map(students.map((student) => [student.id, student]))

export function getStudentById(studentId: string) {
  return studentIndex.get(studentId)
}

type SeedItem = {
  kind: InvoiceItemKind
  amount: number
  description?: string
  enrollmentId?: string
  contentTitle?: string
  /** Signed index into the item list a discount/negative adjustment reduces. */
  appliesToIndex?: number
  periodStart?: string
  periodEnd?: string
}

type SeedPayment = {
  amount: number
  method: PaymentMethodType
  paidOn: string
  reference: string
  status?: PaymentStatus
  verifiedOn?: string | null
  reversed?: boolean
}

type SeedInstallmentPlan = {
  optionId: string
  optionName: string
  count: number
  intervalDays: number
}

type InvoiceSeed = {
  id: string
  studentId: string
  issuedOn: string
  dueDate: string
  items: SeedItem[]
  payments?: SeedPayment[]
  installments?: SeedInstallmentPlan
  statusOverride?: "waived" | "cancelled"
  cancelledAt?: string
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function resolveCourse(enrollmentId: string | undefined): {
  course: CourseRecord | undefined
  lookup: EnrollmentLookup | undefined
} {
  if (!enrollmentId) return { course: undefined, lookup: undefined }

  const lookup = enrollmentIndex.get(enrollmentId)
  const course = lookup ? getCourseById(lookup.enrollment.courseId) : undefined

  return { course, lookup }
}

function buildLine(
  seed: SeedItem,
  index: number,
  itemIds: string[],
  cancelledAt: string | null
): InvoiceLineRecord {
  const { course, lookup } = resolveCourse(seed.enrollmentId)
  const feeStructure = course
    ? getFeeStructureById(`fee-${course.id}`)
    : undefined
  const appliesToItemId =
    seed.appliesToIndex === undefined
      ? null
      : (itemIds[seed.appliesToIndex] ?? null)

  return {
    id: itemIds[index] ?? `line-${index}`,
    kind: seed.kind,
    description:
      seed.description ??
      seed.contentTitle ??
      lookup?.enrollment.courseName ??
      "Invoice line",
    amount: seed.amount,
    enrollmentId: seed.enrollmentId ?? null,
    courseName: lookup?.enrollment.courseName ?? null,
    feeStructureId: feeStructure?.id ?? null,
    feeStructureName: feeStructure?.name ?? null,
    gradeLevelId: course?.gradeIds[0] ?? null,
    gradeName: course?.gradeNames[0] ?? null,
    appliesToItemId,
    appliesToDescription: null,
    contentPurchaseId:
      seed.kind === "content"
        ? `cp-${seed.enrollmentId ?? "misc"}-${index}`
        : null,
    periodStart: seed.periodStart ?? null,
    periodEnd: seed.periodEnd ?? null,
    cancelledAt,
  }
}

function buildInvoice(
  seed: InvoiceSeed,
  invoiceNo: string
): InvoiceRecord | null {
  const student = getStudentById(seed.studentId)
  if (!student) return null

  const branch = getPrimaryBranch(student)
  const cancelledAt =
    seed.statusOverride === "cancelled"
      ? (seed.cancelledAt ?? `${seed.issuedOn}T09:00:00+05:30`)
      : null

  const itemIds = seed.items.map((_, index) => `${seed.id}-line-${index + 1}`)
  const items = seed.items.map((item, index) =>
    buildLine(item, index, itemIds, cancelledAt)
  )

  // Resolve the "applies to" description now that all lines exist.
  for (const [index, item] of seed.items.entries()) {
    if (item.appliesToIndex === undefined) continue
    const target = items[item.appliesToIndex]
    items[index]!.appliesToDescription = target?.description ?? null
  }

  const subtotal = sum(
    items.filter((item) => item.amount > 0).map((item) => item.amount)
  )
  const discountTotal = sum(
    items.filter((item) => item.amount < 0).map((item) => -item.amount)
  )
  const total = subtotal - discountTotal

  const payableItems = items.filter((item) => item.amount > 0)
  const remainingByItem = new Map(
    payableItems.map((item) => [item.id, item.amount])
  )

  const payments: InvoicePaymentRecord[] = []
  const allocations: InvoiceAllocationRecord[] = []
  let allocatedTotal = 0

  const orderedPayments = [...(seed.payments ?? [])].sort((a, b) =>
    a.paidOn.localeCompare(b.paidOn)
  )

  orderedPayments.forEach((payment, paymentIndex) => {
    const paymentId = `${seed.id}-pay-${paymentIndex + 1}`
    const status: PaymentStatus =
      payment.status ?? (payment.reversed ? "voided" : "verified")
    const verifiedOn =
      payment.verifiedOn ??
      (status === "verified" ? addDays(payment.paidOn, 1) : null)

    let allocationCount = 0

    if (status === "verified") {
      let remainingPayment = Math.min(
        payment.amount,
        Math.max(total - allocatedTotal, 0)
      )

      for (const item of payableItems) {
        if (remainingPayment <= 0) break
        const capacity = remainingByItem.get(item.id) ?? 0
        if (capacity <= 0) continue

        const slice = Math.min(capacity, remainingPayment)
        remainingByItem.set(item.id, capacity - slice)
        remainingPayment -= slice
        allocatedTotal += slice
        allocationCount += 1

        allocations.push({
          id: `${paymentId}-alloc-${allocationCount}`,
          paymentId,
          paymentReference: payment.reference,
          paymentMethod: payment.method,
          paidOn: payment.paidOn,
          verifiedOn: verifiedOn ?? payment.paidOn,
          amount: slice,
          invoiceItemId: item.id,
          itemDescription: item.description,
          reversedAt: null,
        })
      }
    }

    if (payment.reversed) {
      allocations.push({
        id: `${paymentId}-alloc-reversed`,
        paymentId,
        paymentReference: payment.reference,
        paymentMethod: payment.method,
        paidOn: payment.paidOn,
        verifiedOn: verifiedOn ?? payment.paidOn,
        amount: payment.amount,
        invoiceItemId: payableItems[0]?.id ?? itemIds[0] ?? `${seed.id}-line-1`,
        itemDescription: payableItems[0]?.description ?? "Invoice line",
        reversedAt: `${payment.paidOn}T16:30:00+05:30`,
      })
      allocationCount += 1
    }

    payments.push({
      id: paymentId,
      reference: payment.reference,
      method: payment.method,
      amount: payment.amount,
      paidOn: payment.paidOn,
      verifiedOn,
      status,
      allocationCount,
    })
  })

  const amountPaid = Math.min(allocatedTotal, total)

  const installments: InvoiceInstallmentRecord[] = []
  if (seed.installments) {
    const { count, intervalDays } = seed.installments
    const base = Math.floor(total / count)
    let assigned = 0
    let remainingPaid = amountPaid

    for (let index = 0; index < count; index += 1) {
      const amount = index === count - 1 ? total - assigned : base
      assigned += amount

      const paid = Math.min(remainingPaid, amount)
      remainingPaid -= paid

      const dueDate = addDays(seed.issuedOn, intervalDays * index)
      const isPastDue = dueDate < MOCK_TODAY

      const status: InstallmentStatus =
        paid >= amount
          ? "paid"
          : paid > 0
            ? isPastDue
              ? "overdue"
              : "partial"
            : isPastDue
              ? "overdue"
              : "pending"

      installments.push({
        id: `${seed.id}-inst-${index + 1}`,
        seq: index + 1,
        dueDate,
        amount,
        amountPaid: paid,
        status,
      })
    }
  }

  const status: InvoiceStatus = seed.statusOverride
    ? seed.statusOverride
    : amountPaid >= total
      ? "paid"
      : seed.dueDate < MOCK_TODAY
        ? "overdue"
        : amountPaid > 0
          ? "partial"
          : "pending"

  return {
    id: seed.id,
    invoiceNo,
    studentId: student.id,
    studentName: student.fullName,
    studentNo: student.studentNo,
    branchId: branch?.branchId ?? "br-colombo",
    branchName: branch?.branchName ?? "Colombo",
    issuedOn: seed.issuedOn,
    dueDate: seed.dueDate,
    installmentOptionId: seed.installments?.optionId ?? null,
    installmentOptionName: seed.installments?.optionName ?? null,
    subtotal,
    discountTotal,
    total,
    amountPaid,
    balance: Math.max(total - amountPaid, 0),
    status,
    createdAt: `${seed.issuedOn}T09:00:00+05:30`,
    cancelledAt,
    items,
    installments,
    payments,
    allocations,
  }
}

const invoiceSeeds: InvoiceSeed[] = [
  {
    id: "inv-dinuka-2026-11",
    studentId: "stu-1",
    issuedOn: "2026-11-01",
    dueDate: "2026-11-10",
    items: [
      {
        kind: "recurring_fee",
        amount: 4500,
        enrollmentId: "en-1a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
      {
        kind: "recurring_fee",
        amount: 4000,
        enrollmentId: "en-1b",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
    ],
    payments: [
      {
        amount: 8500,
        method: "bank_transfer",
        paidOn: "2026-11-08",
        reference: "BR-4471",
      },
    ],
  },
  {
    id: "inv-janith-2026-11",
    studentId: "stu-12",
    issuedOn: "2026-11-01",
    dueDate: "2026-11-10",
    items: [
      {
        kind: "recurring_fee",
        amount: 4500,
        enrollmentId: "en-12a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
    ],
    payments: [
      {
        amount: 2000,
        method: "cash",
        paidOn: "2026-11-05",
        reference: "CASH-2210",
      },
    ],
  },
  {
    id: "inv-anjali-2026-11",
    studentId: "stu-2",
    issuedOn: "2026-11-01",
    dueDate: "2026-12-01",
    items: [
      {
        kind: "recurring_fee",
        amount: 5000,
        enrollmentId: "en-2a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
      {
        kind: "recurring_fee",
        amount: 5500,
        enrollmentId: "en-2b",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
      {
        kind: "content",
        amount: 1500,
        enrollmentId: "en-2b",
        contentTitle: "Combined revision pack (digital download)",
      },
      {
        kind: "discount",
        amount: -525,
        appliesToIndex: 1,
        description: "Merit discount — 5% (fee exception)",
      },
    ],
    payments: [
      {
        amount: 6000,
        method: "gateway",
        paidOn: "2026-11-09",
        reference: "GW-8012",
      },
    ],
  },
  {
    id: "inv-tharindu-2026-11",
    studentId: "stu-5",
    issuedOn: "2026-11-12",
    dueDate: "2026-12-01",
    items: [
      {
        kind: "recurring_fee",
        amount: 3800,
        enrollmentId: "en-5a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
    ],
  },
  {
    id: "inv-hasini-2026-11",
    studentId: "stu-11",
    issuedOn: "2026-11-01",
    dueDate: "2026-11-15",
    items: [
      {
        kind: "recurring_fee",
        amount: 4800,
        enrollmentId: "en-11a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
      {
        kind: "content",
        amount: 900,
        enrollmentId: "en-11a",
        contentTitle: "Science practical video series",
      },
      {
        kind: "adjustment",
        amount: 500,
        description: "Extra lab session charge (posted correction)",
      },
    ],
    payments: [
      {
        amount: 3000,
        method: "bank_transfer",
        paidOn: "2026-11-06",
        reference: "BR-4488",
      },
    ],
  },
  {
    id: "inv-ruwanthi-2026-10",
    studentId: "stu-13",
    issuedOn: "2026-10-01",
    dueDate: "2026-10-25",
    items: [
      {
        kind: "recurring_fee",
        amount: 4200,
        enrollmentId: "en-13a",
        periodStart: "2026-10-01",
        periodEnd: "2026-11-01",
      },
    ],
  },
  {
    id: "inv-kavindu-2026-11",
    studentId: "stu-3",
    issuedOn: "2026-11-01",
    dueDate: "2026-11-10",
    items: [
      {
        kind: "recurring_fee",
        amount: 4000,
        enrollmentId: "en-3a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
    ],
    payments: [
      {
        amount: 4000,
        method: "cash",
        paidOn: "2026-11-07",
        reference: "CASH-2245",
      },
    ],
  },
  {
    id: "inv-senuri-2026-11",
    studentId: "stu-6",
    issuedOn: "2026-11-02",
    dueDate: "2026-11-20",
    items: [
      {
        kind: "recurring_fee",
        amount: 3000,
        enrollmentId: "en-6a",
        periodStart: "2026-11-02",
        periodEnd: "2026-12-02",
      },
    ],
    payments: [
      {
        amount: 3000,
        method: "bank_transfer",
        paidOn: "2026-11-12",
        reference: "BR-4501",
        status: "pending_verification",
        verifiedOn: null,
      },
    ],
  },
  {
    id: "inv-sachini-2026-11",
    studentId: "stu-8",
    issuedOn: "2026-11-01",
    dueDate: "2026-11-15",
    items: [
      {
        kind: "recurring_fee",
        amount: 3800,
        enrollmentId: "en-8a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
    ],
    statusOverride: "waived",
  },
  {
    id: "inv-pasindu-2026-10",
    studentId: "stu-9",
    issuedOn: "2026-10-05",
    dueDate: "2026-10-15",
    items: [
      {
        kind: "recurring_fee",
        amount: 6500,
        enrollmentId: "en-9a",
        periodStart: "2026-10-01",
        periodEnd: "2026-11-01",
      },
    ],
    statusOverride: "cancelled",
    cancelledAt: "2026-10-06T09:15:00+05:30",
  },
  {
    id: "inv-adeesha-2026-08",
    studentId: "stu-14",
    issuedOn: "2026-08-18",
    dueDate: "2026-11-20",
    items: [
      {
        kind: "package_fee",
        amount: 18000,
        enrollmentId: "en-14a",
      },
    ],
    installments: {
      optionId: "inst-co-adult-ict-3",
      optionName: "3 installments",
      count: 3,
      intervalDays: 30,
    },
    payments: [
      {
        amount: 6000,
        method: "gateway",
        paidOn: "2026-08-18",
        reference: "GW-7781",
      },
      {
        amount: 1000,
        method: "gateway",
        paidOn: "2026-09-22",
        reference: "GW-7902",
      },
    ],
  },
  {
    id: "inv-methum-2026-11",
    studentId: "stu-10",
    issuedOn: "2026-11-10",
    dueDate: "2026-11-30",
    items: [
      {
        kind: "recurring_fee",
        amount: 2800,
        enrollmentId: "en-10a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
      {
        kind: "discount",
        amount: -280,
        appliesToIndex: 0,
        description: "Early-settlement discount — 10% (fee exception)",
      },
    ],
    payments: [
      {
        amount: 2520,
        method: "cash",
        paidOn: "2026-11-11",
        reference: "CASH-2288",
      },
    ],
  },
  {
    id: "inv-ishara-2026-11",
    studentId: "stu-7",
    issuedOn: "2026-11-01",
    dueDate: "2026-11-10",
    items: [
      {
        kind: "recurring_fee",
        amount: 7500,
        enrollmentId: "en-7a",
        periodStart: "2026-11-01",
        periodEnd: "2026-12-01",
      },
    ],
    payments: [
      {
        amount: 2000,
        method: "bank_transfer",
        paidOn: "2026-11-04",
        reference: "BR-4462",
        reversed: true,
      },
      {
        amount: 7500,
        method: "cash",
        paidOn: "2026-11-06",
        reference: "CASH-2251",
      },
    ],
  },
]

const invoiceNumbers = new Map<string, string>()
{
  const ordered = [...invoiceSeeds].sort((a, b) => {
    if (a.issuedOn !== b.issuedOn) return a.issuedOn < b.issuedOn ? -1 : 1
    return a.id.localeCompare(b.id)
  })
  const counters: Record<string, number> = {}

  for (const seed of ordered) {
    const year = seed.issuedOn.slice(0, 4)
    counters[year] = (counters[year] ?? 0) + 1
    invoiceNumbers.set(
      seed.id,
      `INV-${year}-${String(counters[year]).padStart(4, "0")}`
    )
  }
}

export const invoiceDirectory: InvoiceRecord[] = invoiceSeeds
  .map((seed) => buildInvoice(seed, invoiceNumbers.get(seed.id) ?? seed.id))
  .filter((invoice): invoice is InvoiceRecord => invoice !== null)
  .sort((a, b) => {
    if (a.issuedOn !== b.issuedOn) return a.issuedOn < b.issuedOn ? 1 : -1
    return a.invoiceNo < b.invoiceNo ? 1 : -1
  })

export function getInvoiceById(invoiceId: string) {
  return invoiceDirectory.find((invoice) => invoice.id === invoiceId)
}

export function getInvoiceBalance(invoice: InvoiceRecord) {
  return Math.max(invoice.total - invoice.amountPaid, 0)
}

export function isInvoiceOpen(invoice: InvoiceRecord) {
  return (
    invoice.status !== "paid" &&
    invoice.status !== "waived" &&
    invoice.status !== "cancelled"
  )
}

export function getInvoiceUsage() {
  const open = invoiceDirectory.filter(isInvoiceOpen)
  const overdue = invoiceDirectory.filter(
    (invoice) => invoice.status === "overdue"
  )

  return {
    total: invoiceDirectory.length,
    open: open.length,
    overdue: overdue.length,
    overdueAmount: sum(overdue.map((invoice) => invoice.balance)),
    outstanding: sum(open.map((invoice) => invoice.balance)),
    collected: sum(invoiceDirectory.map((invoice) => invoice.amountPaid)),
    paid: invoiceDirectory.filter((invoice) => invoice.status === "paid")
      .length,
    waived: invoiceDirectory.filter((invoice) => invoice.status === "waived")
      .length,
    cancelled: invoiceDirectory.filter(
      (invoice) => invoice.status === "cancelled"
    ).length,
  }
}

export const invoiceStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(Object.entries(invoiceStatusLabels) as [InvoiceStatus, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const invoiceBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...Array.from(
    new Map(
      invoiceDirectory.map((invoice) => [invoice.branchId, invoice.branchName])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

export const invoiceStudentFilterOptions = [
  { value: "all", label: "All students" },
  ...Array.from(
    new Map(
      invoiceDirectory.map((invoice) => [
        invoice.studentId,
        invoice.studentName,
      ])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]
