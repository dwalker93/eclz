/**
 * Local mock fixtures for the Teacher Payouts UI demo.
 *
 * Mirrors `teacher_payout` and `commission_entry`: a payout covers one lecturer
 * and one period, and every commission entry snapshots its own rule and rate.
 * Entries can be accruals or negative reversals; reversals that exceed the
 * period's available earnings carry forward to the lecturer's next payout.
 *
 * All amounts are illustrative sample values. Nothing here is persisted, no
 * commission is calculated, and no payout is settled.
 */

import { formatLkr } from "@/lib/courses-data"
import { lecturers } from "@/lib/lecturers-data"
import { commissionRulesModuleMock } from "@/lib/commissions-data"
import { MOCK_TODAY } from "@/lib/students-data"

export type PayoutStatus = "draft" | "approved" | "paid"
export type CommissionEntryKind = "accrual" | "reversal"
export type PayoutPaymentMethod = "Bank transfer" | "Cash" | "Cheque"

export type CommissionEntryRecord = {
  id: string
  payoutId: string
  kind: CommissionEntryKind
  occurredOn: string
  studentName: string
  courseName: string
  invoiceNo: string
  /** Negative for a reversal. */
  baseAmount: number
  /** Snapshot of the rule that applied when the entry was accrued. */
  ruleLabel: string
  /** Negative for a reversal. */
  commissionAmount: number
  /** Negative for a reversal. */
  teacherAmount: number
  note: string | null
}

export type TeacherPayoutRecord = {
  id: string
  payoutNo: string
  lecturerId: string
  lecturerName: string
  lecturerQualification: string
  periodId: string
  periodStart: string
  periodEnd: string
  status: PayoutStatus
  entries: CommissionEntryRecord[]
  /** Collected from students before reversals. */
  grossCollected: number
  /** Base after reversals; the amount commission is applied to. */
  commissionBase: number
  /** Institute share across accruals and reversals. */
  commissionAmount: number
  /** Lecturer share across accruals and reversals. */
  teacherTotal: number
  /** Negative amount carried in from an earlier period. */
  carryForwardIn: number
  /** Negative amount carried to the next period. */
  carryForwardOut: number
  /** Signed total after carry-forward. Can be negative. */
  netPayable: number
  /** Amount actually payable, never below zero. */
  amountDue: number
  createdAt: string
  approvedAt: string | null
  approvedBy: string | null
  paidAt: string | null
  paidBy: string | null
  paymentReference: string | null
  paymentMethod: PayoutPaymentMethod | null
  proofFileName: string | null
  note: string | null
}

type CommissionEntrySeed = Omit<CommissionEntryRecord, "payoutId">

type PayoutSeed = Omit<
  TeacherPayoutRecord,
  | "entries"
  | "grossCollected"
  | "commissionBase"
  | "commissionAmount"
  | "teacherTotal"
  | "carryForwardOut"
  | "netPayable"
  | "amountDue"
  | "lecturerName"
  | "lecturerQualification"
  | "periodStart"
  | "periodEnd"
  | "carryForwardIn"
> & {
  entries: CommissionEntrySeed[]
  carryForwardIn?: number
}

export const payoutPeriods: Record<
  string,
  { label: string; start: string; end: string }
> = {
  "2026-08": { label: "August 2026", start: "2026-08-01", end: "2026-08-31" },
  "2026-09": {
    label: "September 2026",
    start: "2026-09-01",
    end: "2026-09-30",
  },
  "2026-10": { label: "October 2026", start: "2026-10-01", end: "2026-10-31" },
  "2026-11": {
    label: "November 2026",
    start: "2026-11-01",
    end: "2026-11-30",
  },
}

export const payoutStatusLabels: Record<PayoutStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
}

export const payoutStatusHints: Record<PayoutStatus, string> = {
  draft: "Entries are still open. Totals can change until approval.",
  approved: "Approval freezes the totals and entries. Only payment can follow.",
  paid: "Paid payouts are immutable. Corrections use a new reversal entry.",
}

export const payoutStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(Object.entries(payoutStatusLabels) as [PayoutStatus, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const payoutModuleMock = {
  key: "commissions" as const,
  label: commissionRulesModuleMock.label,
  hint: commissionRulesModuleMock.hint,
  enabled: true,
  organizationEnabled: commissionRulesModuleMock.organizationEnabled,
}

function getLecturer(lecturerId: string) {
  return lecturers.find((lecturer) => lecturer.id === lecturerId)
}

function buildPayout(seed: PayoutSeed): TeacherPayoutRecord {
  const lecturer = getLecturer(seed.lecturerId)
  const period = payoutPeriods[seed.periodId]!
  const entries = seed.entries.map((entry) => ({
    ...entry,
    payoutId: seed.id,
  }))
  const grossCollected = entries
    .filter((entry) => entry.baseAmount > 0)
    .reduce((total, entry) => total + entry.baseAmount, 0)
  const commissionBase = entries.reduce(
    (total, entry) => total + entry.baseAmount,
    0
  )
  const commissionAmount = entries.reduce(
    (total, entry) => total + entry.commissionAmount,
    0
  )
  const teacherTotal = entries.reduce(
    (total, entry) => total + entry.teacherAmount,
    0
  )
  const carryForwardIn = seed.carryForwardIn ?? 0
  const netPayable = teacherTotal + carryForwardIn
  const carryForwardOut = Math.min(0, netPayable)

  return {
    ...seed,
    lecturerName: lecturer?.fullName ?? "Lecturer",
    lecturerQualification: lecturer?.qualification ?? "—",
    periodStart: period.start,
    periodEnd: period.end,
    entries,
    grossCollected,
    commissionBase,
    commissionAmount,
    teacherTotal,
    carryForwardIn,
    carryForwardOut,
    netPayable,
    amountDue: Math.max(0, netPayable),
  }
}

const payoutSeeds: PayoutSeed[] = [
  {
    id: "po-2026-10-lec-1",
    payoutNo: "PAY-2026-10-001",
    lecturerId: "lec-1",
    periodId: "2026-10",
    status: "draft",
    createdAt: "2026-11-02T09:20:00+05:30",
    approvedAt: null,
    approvedBy: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "Draft prepared from October accruals. One transfer reversal is included.",
    entries: [
      {
        id: "ce-1",
        kind: "accrual",
        occurredOn: "2026-10-04",
        studentName: "Dinuka Perera",
        courseName: "Advanced Level Mathematics",
        invoiceNo: "INV-2026-1042",
        baseAmount: 30000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 7500,
        teacherAmount: 22500,
        note: null,
      },
      {
        id: "ce-2",
        kind: "accrual",
        occurredOn: "2026-10-12",
        studentName: "Nethmi Silva",
        courseName: "Grade 11 Mathematics",
        invoiceNo: "INV-2026-1067",
        baseAmount: 24000,
        ruleLabel: "22% · subject: Mathematics",
        commissionAmount: 5280,
        teacherAmount: 18720,
        note: null,
      },
      {
        id: "ce-3",
        kind: "accrual",
        occurredOn: "2026-10-21",
        studentName: "Sachini Rajapaksa",
        courseName: "Advanced Level Mathematics",
        invoiceNo: "INV-2026-1081",
        baseAmount: 30000,
        ruleLabel: "22% · subject: Mathematics",
        commissionAmount: 6600,
        teacherAmount: 23400,
        note: null,
      },
      {
        id: "ce-4",
        kind: "reversal",
        occurredOn: "2026-10-27",
        studentName: "Pasindu Herath",
        courseName: "Advanced Level Mathematics",
        invoiceNo: "INV-2026-1048",
        baseAmount: -6000,
        ruleLabel: "22% · subject: Mathematics",
        commissionAmount: -1320,
        teacherAmount: -4680,
        note: "Course transfer after collection; the commission share is reversed.",
      },
    ],
  },
  {
    id: "po-2026-10-lec-5",
    payoutNo: "PAY-2026-10-002",
    lecturerId: "lec-5",
    periodId: "2026-10",
    status: "draft",
    createdAt: "2026-11-02T10:05:00+05:30",
    approvedAt: null,
    approvedBy: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "A LKR 3,000 late reversal from the September payout is carried into this draft.",
    carryForwardIn: -3000,
    entries: [
      {
        id: "ce-5",
        kind: "accrual",
        occurredOn: "2026-10-03",
        studentName: "Hasini Weerasinghe",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-1055",
        baseAmount: 28000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 7000,
        teacherAmount: 21000,
        note: null,
      },
      {
        id: "ce-6",
        kind: "accrual",
        occurredOn: "2026-10-16",
        studentName: "Janith Dissanayake",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-1074",
        baseAmount: 20000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 5000,
        teacherAmount: 15000,
        note: null,
      },
      {
        id: "ce-7",
        kind: "reversal",
        occurredOn: "2026-10-29",
        studentName: "Ruwanthi de Silva",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-1029",
        baseAmount: -6000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: -1500,
        teacherAmount: -4500,
        note: "Fee exception applied after collection; the commission is adjusted.",
      },
    ],
  },
  {
    id: "po-2026-10-lec-3",
    payoutNo: "PAY-2026-10-003",
    lecturerId: "lec-3",
    periodId: "2026-10",
    status: "draft",
    createdAt: "2026-11-02T11:40:00+05:30",
    approvedAt: null,
    approvedBy: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "Two October accruals; no reversals in this period.",
    entries: [
      {
        id: "ce-8",
        kind: "accrual",
        occurredOn: "2026-10-05",
        studentName: "Adeesha Karunaratne",
        courseName: "Diploma in Information Technology",
        invoiceNo: "INV-2026-1090",
        baseAmount: 18000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 4500,
        teacherAmount: 13500,
        note: null,
      },
      {
        id: "ce-9",
        kind: "accrual",
        occurredOn: "2026-10-19",
        studentName: "Methum Liyanage",
        courseName: "Certificate in Web Development",
        invoiceNo: "INV-2026-1099",
        baseAmount: 12000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3000,
        teacherAmount: 9000,
        note: null,
      },
    ],
  },
  {
    id: "po-2026-10-lec-9",
    payoutNo: "PAY-2026-10-004",
    lecturerId: "lec-9",
    periodId: "2026-10",
    status: "draft",
    createdAt: "2026-11-03T08:55:00+05:30",
    approvedAt: null,
    approvedBy: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "Reversals exceed this period's earnings. The balance carries forward instead of creating a negative payment.",
    carryForwardIn: -1000,
    entries: [
      {
        id: "ce-10",
        kind: "accrual",
        occurredOn: "2026-10-06",
        studentName: "Senuri Wickramasinghe",
        courseName: "Foundation in Early Childhood",
        invoiceNo: "INV-2026-1102",
        baseAmount: 12000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3000,
        teacherAmount: 9000,
        note: null,
      },
      {
        id: "ce-11",
        kind: "reversal",
        occurredOn: "2026-10-24",
        studentName: "Tharindu Bandara",
        courseName: "Foundation in Early Childhood",
        invoiceNo: "INV-2026-1031",
        baseAmount: -14000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: -3500,
        teacherAmount: -10500,
        note: "Withdrawal before the census date; the full commission share is reversed.",
      },
    ],
  },
  {
    id: "po-2026-09-lec-2",
    payoutNo: "PAY-2026-09-001",
    lecturerId: "lec-2",
    periodId: "2026-09",
    status: "approved",
    createdAt: "2026-09-30T16:10:00+05:30",
    approvedAt: "2026-10-04T10:25:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "Approved totals are frozen until payment.",
    entries: [
      {
        id: "ce-12",
        kind: "accrual",
        occurredOn: "2026-09-07",
        studentName: "Anjali Fernando",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-0951",
        baseAmount: 32000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 8000,
        teacherAmount: 24000,
        note: null,
      },
      {
        id: "ce-13",
        kind: "accrual",
        occurredOn: "2026-09-18",
        studentName: "Kavindu Jayasinghe",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-0977",
        baseAmount: 28000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 7000,
        teacherAmount: 21000,
        note: null,
      },
    ],
  },
  {
    id: "po-2026-10-lec-7",
    payoutNo: "PAY-2026-10-005",
    lecturerId: "lec-7",
    periodId: "2026-10",
    status: "approved",
    createdAt: "2026-11-01T14:30:00+05:30",
    approvedAt: "2026-11-06T09:15:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "A duplicate-entry correction is included; totals were frozen at approval.",
    entries: [
      {
        id: "ce-14",
        kind: "accrual",
        occurredOn: "2026-10-02",
        studentName: "Adeesha Karunaratne",
        courseName: "Diploma in Business Management",
        invoiceNo: "INV-2026-1107",
        baseAmount: 36000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 9000,
        teacherAmount: 27000,
        note: null,
      },
      {
        id: "ce-15",
        kind: "accrual",
        occurredOn: "2026-10-14",
        studentName: "Nethmi Silva",
        courseName: "Diploma in Business Management",
        invoiceNo: "INV-2026-1114",
        baseAmount: 24000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 6000,
        teacherAmount: 18000,
        note: null,
      },
      {
        id: "ce-16",
        kind: "reversal",
        occurredOn: "2026-10-28",
        studentName: "Sachini Rajapaksa",
        courseName: "Diploma in Business Management",
        invoiceNo: "INV-2026-1002",
        baseAmount: -4000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: -1000,
        teacherAmount: -3000,
        note: "Duplicate commission entry corrected in the same period.",
      },
    ],
  },
  {
    id: "po-2026-09-lec-1",
    payoutNo: "PAY-2026-09-002",
    lecturerId: "lec-1",
    periodId: "2026-09",
    status: "paid",
    createdAt: "2026-09-29T15:45:00+05:30",
    approvedAt: "2026-10-02T11:05:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: "2026-10-08T14:20:00+05:30",
    paidBy: "Nadeesha Fernando",
    paymentReference: "BANK-77304",
    paymentMethod: "Bank transfer",
    proofFileName: "payout-2026-09-anushka.pdf",
    note: "Paid payouts are immutable; later corrections use reversal entries.",
    entries: [
      {
        id: "ce-17",
        kind: "accrual",
        occurredOn: "2026-09-05",
        studentName: "Dinuka Perera",
        courseName: "Advanced Level Mathematics",
        invoiceNo: "INV-2026-0921",
        baseAmount: 30000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 7500,
        teacherAmount: 22500,
        note: null,
      },
      {
        id: "ce-18",
        kind: "accrual",
        occurredOn: "2026-09-21",
        studentName: "Nethmi Silva",
        courseName: "Grade 11 Mathematics",
        invoiceNo: "INV-2026-0983",
        baseAmount: 24000,
        ruleLabel: "22% · subject: Mathematics",
        commissionAmount: 5280,
        teacherAmount: 18720,
        note: null,
      },
    ],
  },
  {
    id: "po-2026-09-lec-4",
    payoutNo: "PAY-2026-09-003",
    lecturerId: "lec-4",
    periodId: "2026-09",
    status: "paid",
    createdAt: "2026-09-29T16:00:00+05:30",
    approvedAt: "2026-10-02T11:20:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: "2026-10-08T14:25:00+05:30",
    paidBy: "Nadeesha Fernando",
    paymentReference: "BANK-77310",
    paymentMethod: "Bank transfer",
    proofFileName: "payout-2026-09-fathima.pdf",
    note: "Paid payouts are immutable; later corrections use reversal entries.",
    entries: [
      {
        id: "ce-19",
        kind: "accrual",
        occurredOn: "2026-09-09",
        studentName: "Senuri Wickramasinghe",
        courseName: "Foundation in Early Childhood",
        invoiceNo: "INV-2026-0938",
        baseAmount: 15000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3750,
        teacherAmount: 11250,
        note: null,
      },
      {
        id: "ce-20",
        kind: "accrual",
        occurredOn: "2026-09-23",
        studentName: "Tharindu Bandara",
        courseName: "Foundation in Early Childhood",
        invoiceNo: "INV-2026-0991",
        baseAmount: 15000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3750,
        teacherAmount: 11250,
        note: null,
      },
    ],
  },
  {
    id: "po-2026-09-lec-6",
    payoutNo: "PAY-2026-09-004",
    lecturerId: "lec-6",
    periodId: "2026-09",
    status: "paid",
    createdAt: "2026-09-30T09:05:00+05:30",
    approvedAt: "2026-10-02T11:35:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: "2026-10-08T14:30:00+05:30",
    paidBy: "Nadeesha Fernando",
    paymentReference: "BANK-77312",
    paymentMethod: "Bank transfer",
    proofFileName: "payout-2026-09-shalini.pdf",
    note: "Paid payouts are immutable; later corrections use reversal entries.",
    entries: [
      {
        id: "ce-21",
        kind: "accrual",
        occurredOn: "2026-09-11",
        studentName: "Ishara Gunawardena",
        courseName: "Diploma in English",
        invoiceNo: "INV-2026-0947",
        baseAmount: 18000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 4500,
        teacherAmount: 13500,
        note: null,
      },
      {
        id: "ce-22",
        kind: "accrual",
        occurredOn: "2026-09-25",
        studentName: "Ruwanthi de Silva",
        courseName: "Diploma in English",
        invoiceNo: "INV-2026-0998",
        baseAmount: 16000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 4000,
        teacherAmount: 12000,
        note: null,
      },
    ],
  },
  {
    id: "po-2026-08-lec-8",
    payoutNo: "PAY-2026-08-001",
    lecturerId: "lec-8",
    periodId: "2026-08",
    status: "paid",
    createdAt: "2026-08-29T13:15:00+05:30",
    approvedAt: "2026-09-02T10:10:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: "2026-09-06T15:05:00+05:30",
    paidBy: "Nadeesha Fernando",
    paymentReference: "BANK-76188",
    paymentMethod: "Bank transfer",
    proofFileName: "payout-2026-08-hasitha.pdf",
    note: "Paid payouts are immutable; later corrections use reversal entries.",
    entries: [
      {
        id: "ce-23",
        kind: "accrual",
        occurredOn: "2026-08-08",
        studentName: "Hasini Weerasinghe",
        courseName: "Certificate in English",
        invoiceNo: "INV-2026-0831",
        baseAmount: 14000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3500,
        teacherAmount: 10500,
        note: null,
      },
      {
        id: "ce-24",
        kind: "accrual",
        occurredOn: "2026-08-22",
        studentName: "Methum Liyanage",
        courseName: "Certificate in English",
        invoiceNo: "INV-2026-0892",
        baseAmount: 14000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3500,
        teacherAmount: 10500,
        note: null,
      },
    ],
  },
  {
    id: "po-2026-08-lec-10",
    payoutNo: "PAY-2026-08-002",
    lecturerId: "lec-10",
    periodId: "2026-08",
    status: "paid",
    createdAt: "2026-08-30T09:40:00+05:30",
    approvedAt: "2026-09-02T10:30:00+05:30",
    approvedBy: "Nadeesha Fernando",
    paidAt: "2026-09-06T15:10:00+05:30",
    paidBy: "Nadeesha Fernando",
    paymentReference: "BANK-76192",
    paymentMethod: "Bank transfer",
    proofFileName: "payout-2026-08-malinda.pdf",
    note: "Paid payouts are immutable; later corrections use reversal entries.",
    entries: [
      {
        id: "ce-25",
        kind: "accrual",
        occurredOn: "2026-08-10",
        studentName: "Janith Dissanayake",
        courseName: "Diploma in Business Management",
        invoiceNo: "INV-2026-0846",
        baseAmount: 22000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 5500,
        teacherAmount: 16500,
        note: null,
      },
      {
        id: "ce-26",
        kind: "accrual",
        occurredOn: "2026-08-24",
        studentName: "Sachini Rajapaksa",
        courseName: "Diploma in Business Management",
        invoiceNo: "INV-2026-0888",
        baseAmount: 18000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 4500,
        teacherAmount: 13500,
        note: null,
      },
    ],
  },
]

export const initialPayouts: TeacherPayoutRecord[] = payoutSeeds
  .map(buildPayout)
  .sort((left, right) => right.periodId.localeCompare(left.periodId))

/**
 * Periods with accrued entries but no payout yet. Creating a draft from one of
 * these only adds a local demo row; nothing is written to a database.
 */
const payoutCandidateSeeds: PayoutSeed[] = [
  {
    id: "candidate-2026-10-lec-2",
    payoutNo: "PAY-2026-10-006",
    lecturerId: "lec-2",
    periodId: "2026-10",
    status: "draft",
    createdAt: MOCK_TODAY,
    approvedAt: null,
    approvedBy: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "October accruals waiting for a draft.",
    entries: [
      {
        id: "ce-c1",
        kind: "accrual",
        occurredOn: "2026-10-07",
        studentName: "Anjali Fernando",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-1119",
        baseAmount: 32000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 8000,
        teacherAmount: 24000,
        note: null,
      },
      {
        id: "ce-c2",
        kind: "accrual",
        occurredOn: "2026-10-20",
        studentName: "Kavindu Jayasinghe",
        courseName: "Advanced Level Physics",
        invoiceNo: "INV-2026-1128",
        baseAmount: 28000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 7000,
        teacherAmount: 21000,
        note: null,
      },
    ],
  },
  {
    id: "candidate-2026-10-lec-4",
    payoutNo: "PAY-2026-10-007",
    lecturerId: "lec-4",
    periodId: "2026-10",
    status: "draft",
    createdAt: MOCK_TODAY,
    approvedAt: null,
    approvedBy: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
    paymentMethod: null,
    proofFileName: null,
    note: "October accruals waiting for a draft.",
    entries: [
      {
        id: "ce-c3",
        kind: "accrual",
        occurredOn: "2026-10-09",
        studentName: "Senuri Wickramasinghe",
        courseName: "Foundation in Early Childhood",
        invoiceNo: "INV-2026-1122",
        baseAmount: 15000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3750,
        teacherAmount: 11250,
        note: null,
      },
      {
        id: "ce-c4",
        kind: "accrual",
        occurredOn: "2026-10-23",
        studentName: "Tharindu Bandara",
        courseName: "Foundation in Early Childhood",
        invoiceNo: "INV-2026-1134",
        baseAmount: 15000,
        ruleLabel: "25% · lecturer default",
        commissionAmount: 3750,
        teacherAmount: 11250,
        note: null,
      },
    ],
  },
]

export const payoutCandidates: TeacherPayoutRecord[] =
  payoutCandidateSeeds.map(buildPayout)

export function getPayoutById(
  payouts: TeacherPayoutRecord[],
  payoutId: string
) {
  return payouts.find((payout) => payout.id === payoutId)
}

export function getPayoutPeriodLabel(periodId: string) {
  return payoutPeriods[periodId]?.label ?? periodId
}

export function getPayoutUsageCounts(payouts: TeacherPayoutRecord[]) {
  const drafts = payouts.filter((payout) => payout.status === "draft")
  const approved = payouts.filter((payout) => payout.status === "approved")
  const paid = payouts.filter((payout) => payout.status === "paid")

  return {
    draftCount: drafts.length,
    approvedCount: approved.length,
    paidCount: paid.length,
    draftValue: drafts.reduce((total, payout) => total + payout.amountDue, 0),
    approvedValue: approved.reduce(
      (total, payout) => total + payout.amountDue,
      0
    ),
    paidValue: paid.reduce((total, payout) => total + payout.amountDue, 0),
    carryForward: payouts.reduce(
      (total, payout) => total + Math.abs(payout.carryForwardOut),
      0
    ),
    carryForwardIn: payouts.reduce(
      (total, payout) => total + Math.abs(payout.carryForwardIn),
      0
    ),
    openEntries: drafts.reduce(
      (total, payout) => total + payout.entries.length,
      0
    ),
  }
}

export function getPayoutLecturerFilterOptions(payouts: TeacherPayoutRecord[]) {
  return [
    { value: "all", label: "All lecturers" },
    ...Array.from(
      new Map(
        payouts.map((payout) => [payout.lecturerId, payout.lecturerName])
      ).entries()
    )
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  ]
}

export function getPayoutPeriodFilterOptions(payouts: TeacherPayoutRecord[]) {
  return [
    { value: "all", label: "All periods" },
    ...Array.from(new Set(payouts.map((payout) => payout.periodId)))
      .sort((left, right) => right.localeCompare(left))
      .map((periodId) => ({
        value: periodId,
        label: getPayoutPeriodLabel(periodId),
      })),
  ]
}

export function getPayoutEntryGroups(payout: TeacherPayoutRecord) {
  const accruals = payout.entries.filter((entry) => entry.kind === "accrual")
  const reversals = payout.entries.filter((entry) => entry.kind === "reversal")

  function totals(entries: CommissionEntryRecord[]) {
    return {
      count: entries.length,
      base: entries.reduce((total, entry) => total + entry.baseAmount, 0),
      commission: entries.reduce(
        (total, entry) => total + entry.commissionAmount,
        0
      ),
      teacher: entries.reduce((total, entry) => total + entry.teacherAmount, 0),
    }
  }

  return {
    accruals,
    reversals,
    accrualTotals: totals(accruals),
    reversalTotals: totals(reversals),
  }
}

/** Formats negative amounts with a proper minus sign and spacing. */
export function formatPayoutAmount(amount: number) {
  return amount < 0 ? `− ${formatLkr(Math.abs(amount))}` : formatLkr(amount)
}

export function getNextPayoutNumber(
  payouts: TeacherPayoutRecord[],
  periodId: string
) {
  const prefix = `PAY-${periodId}-`
  const highest = payouts
    .filter((payout) => payout.payoutNo.startsWith(prefix))
    .map((payout) => Number(payout.payoutNo.slice(prefix.length)))
    .filter((sequence) => Number.isFinite(sequence))
    .reduce((max, sequence) => Math.max(max, sequence), 0)

  return `${prefix}${String(highest + 1).padStart(3, "0")}`
}
