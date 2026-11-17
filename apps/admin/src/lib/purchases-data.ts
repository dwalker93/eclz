/**
 * Local mock fixtures for the Purchases UI demo.
 *
 * Mirrors `content_purchase` linked to a student, a content item and (usually)
 * an invoice. Payment state and physical handover are modelled separately: a
 * `paid` purchase grants access, a `pending` one does not, and handover only
 * applies to paid physical books. Nothing here is persisted.
 */

import { getContentItemById, type ContentKind } from "@/lib/content-data"
import { formatLkr } from "@/lib/courses-data"
import { getInvoiceById, type InvoiceStatus } from "@/lib/invoices-data"
import { MOCK_TODAY, branches, students } from "@/lib/students-data"

export type PurchaseChannel = "online" | "physical"
export type PurchaseStatus = "pending" | "paid" | "cancelled"

export const purchaseChannelLabels: Record<PurchaseChannel, string> = {
  online: "Online",
  physical: "Physical",
}

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  cancelled: "Cancelled",
}

export type ContentPurchaseRecord = {
  id: string
  /** Display reference only — the schema does not model a purchase number. */
  reference: string
  contentId: string
  contentTitle: string
  contentKind: ContentKind
  studentId: string
  studentName: string
  studentNo: string
  branchId: string
  branchName: string
  invoiceId: string | null
  invoiceNo: string | null
  invoiceStatus: InvoiceStatus | null
  channel: PurchaseChannel
  price: number
  status: PurchaseStatus
  purchasedAt: string
  handedOverAt: string | null
  handedOverBy: string | null
}

/** Front-desk / store staff shown in the handover preview. */
export const handoverStaff = [
  { id: "usr-staff-1", name: "Nimal Sirisena", role: "Front desk · Colombo" },
  { id: "usr-staff-2", name: "Dilani Perera", role: "Front desk · Kandy" },
  { id: "usr-staff-3", name: "Roshan Fernando", role: "Front desk · Galle" },
  { id: "usr-staff-4", name: "Tharaka Silva", role: "Store keeper" },
]

const studentIndex = new Map(students.map((student) => [student.id, student]))
const staffIndex = new Map(handoverStaff.map((staff) => [staff.id, staff]))

function studentName(studentId: string) {
  return studentIndex.get(studentId)?.fullName ?? "Unknown student"
}

function studentNo(studentId: string) {
  return studentIndex.get(studentId)?.studentNo ?? "—"
}

function branchName(branchId: string) {
  return branches.find((branch) => branch.id === branchId)?.name ?? branchId
}

type PurchaseSeed = {
  id: string
  contentId: string
  studentId: string
  /** Falls back to the item price when omitted. */
  price?: number
  channel: PurchaseChannel
  status: PurchaseStatus
  invoiceId?: string
  branchId: string
  purchasedAt: string
  handedOverAt?: string
  handedOverBy?: string
}

const purchaseSeeds: PurchaseSeed[] = [
  {
    id: "pur-hasini-science-practicals",
    contentId: "cont-science-practicals",
    studentId: "stu-11",
    channel: "online",
    status: "paid",
    invoiceId: "inv-hasini-2026-11",
    branchId: "br-negombo",
    purchasedAt: "2026-11-02T10:15:00+05:30",
  },
  {
    id: "pur-anjali-combined-pack",
    contentId: "cont-combined-revision-pack",
    studentId: "stu-2",
    channel: "online",
    status: "paid",
    invoiceId: "inv-anjali-2026-11",
    branchId: "br-colombo",
    purchasedAt: "2026-11-03T14:40:00+05:30",
  },
  {
    id: "pur-ishara-combined-pack",
    contentId: "cont-combined-revision-pack",
    studentId: "stu-7",
    channel: "online",
    status: "paid",
    invoiceId: "inv-ishara-2026-11",
    branchId: "br-colombo",
    purchasedAt: "2026-11-06T16:20:00+05:30",
  },
  {
    id: "pur-nethmi-combined-pack",
    contentId: "cont-combined-revision-pack",
    studentId: "stu-4",
    channel: "online",
    status: "pending",
    branchId: "br-colombo",
    purchasedAt: "2026-11-12T09:05:00+05:30",
  },
  {
    id: "pur-kavindu-ol-maths-book",
    contentId: "cont-ol-maths-book",
    studentId: "stu-3",
    channel: "physical",
    status: "paid",
    invoiceId: "inv-kavindu-2026-11",
    branchId: "br-kandy",
    purchasedAt: "2026-11-05T10:00:00+05:30",
    handedOverAt: "2026-11-05T16:45:00+05:30",
    handedOverBy: "usr-staff-2",
  },
  {
    id: "pur-dinuka-ol-maths-book",
    contentId: "cont-ol-maths-book",
    studentId: "stu-1",
    channel: "physical",
    status: "paid",
    invoiceId: "inv-dinuka-2026-11",
    branchId: "br-colombo",
    purchasedAt: "2026-11-07T09:20:00+05:30",
  },
  {
    id: "pur-methum-ict-workbook",
    contentId: "cont-ict-beginners-workbook",
    studentId: "stu-10",
    channel: "physical",
    status: "paid",
    invoiceId: "inv-methum-2026-11",
    branchId: "br-galle",
    purchasedAt: "2026-11-09T14:10:00+05:30",
  },
  {
    id: "pur-tharindu-ict-workbook",
    contentId: "cont-ict-beginners-workbook",
    studentId: "stu-5",
    channel: "physical",
    status: "pending",
    invoiceId: "inv-tharindu-2026-11",
    branchId: "br-galle",
    purchasedAt: "2026-11-08T11:30:00+05:30",
  },
  {
    id: "pur-adeesha-ict-workbook",
    contentId: "cont-ict-beginners-workbook",
    studentId: "stu-14",
    channel: "physical",
    status: "pending",
    invoiceId: "inv-adeesha-2026-08",
    branchId: "br-colombo",
    purchasedAt: "2026-08-19T13:00:00+05:30",
  },
  {
    id: "pur-dinuka-science-cancelled",
    contentId: "cont-science-practicals",
    studentId: "stu-1",
    channel: "online",
    status: "cancelled",
    branchId: "br-colombo",
    purchasedAt: "2026-11-01T08:30:00+05:30",
  },
]

function buildPurchase(seed: PurchaseSeed): ContentPurchaseRecord {
  const item = getContentItemById(seed.contentId)
  const invoice = seed.invoiceId ? getInvoiceById(seed.invoiceId) : undefined
  const staff = seed.handedOverBy
    ? staffIndex.get(seed.handedOverBy)
    : undefined

  return {
    id: seed.id,
    reference: `CP-${seed.id.replace(/^pur-/, "").slice(0, 12).toUpperCase()}`,
    contentId: seed.contentId,
    contentTitle: item?.title ?? seed.contentId,
    contentKind: item?.kind ?? "file",
    studentId: seed.studentId,
    studentName: studentName(seed.studentId),
    studentNo: studentNo(seed.studentId),
    branchId: invoice?.branchId ?? seed.branchId,
    branchName: invoice?.branchName ?? branchName(seed.branchId),
    invoiceId: invoice?.id ?? null,
    invoiceNo: invoice?.invoiceNo ?? null,
    invoiceStatus: invoice?.status ?? null,
    channel: seed.channel,
    price: seed.price ?? item?.price ?? 0,
    status: seed.status,
    purchasedAt: seed.purchasedAt,
    handedOverAt: seed.handedOverAt ?? null,
    handedOverBy: staff?.name ?? null,
  }
}

export const contentPurchases: ContentPurchaseRecord[] =
  purchaseSeeds.map(buildPurchase)

export function getPurchaseById(purchaseId: string) {
  return contentPurchases.find((purchase) => purchase.id === purchaseId)
}

/** Paid purchases grant access; pending and cancelled ones do not. */
export function purchaseGrantsAccess(purchase: ContentPurchaseRecord) {
  return purchase.status === "paid"
}

/** Handover is only offered for paid physical books that are not yet handed over. */
export function canHandOver(purchase: ContentPurchaseRecord) {
  return (
    purchase.status === "paid" &&
    purchase.channel === "physical" &&
    purchase.handedOverAt === null
  )
}

export function isHandoverPending(purchase: ContentPurchaseRecord) {
  return canHandOver(purchase)
}

export type HandoverState = "done" | "pending" | "blocked" | "na"

export function getHandoverState(
  purchase: ContentPurchaseRecord
): HandoverState {
  if (purchase.channel !== "physical") return "na"
  if (purchase.handedOverAt) return "done"
  if (canHandOver(purchase)) return "pending"
  return "blocked"
}

export function getPurchaseUsage() {
  const count = (predicate: (purchase: ContentPurchaseRecord) => boolean) =>
    contentPurchases.filter(predicate).length

  return {
    total: contentPurchases.length,
    paid: count((purchase) => purchase.status === "paid"),
    pending: count((purchase) => purchase.status === "pending"),
    cancelled: count((purchase) => purchase.status === "cancelled"),
    online: count((purchase) => purchase.channel === "online"),
    physical: count((purchase) => purchase.channel === "physical"),
    handoverPending: contentPurchases.filter(isHandoverPending).length,
    handedOver: count((purchase) => purchase.handedOverAt !== null),
  }
}

export function formatPurchasePrice(purchase: ContentPurchaseRecord) {
  return formatLkr(purchase.price)
}

export function getDefaultPurchaseId() {
  return contentPurchases[0]?.id ?? ""
}

export const purchaseChannelFilterOptions = [
  { value: "all", label: "All channels" },
  ...(Object.entries(purchaseChannelLabels) as [PurchaseChannel, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const purchaseStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(Object.entries(purchaseStatusLabels) as [PurchaseStatus, string][]).map(
    ([value, label]) => ({ value, label })
  ),
]

export const purchaseBranchFilterOptions = [
  { value: "all", label: "All branches" },
  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
]

export const purchaseHandoverFilterOptions = [
  { value: "all", label: "All handover states" },
  { value: "pending", label: "Handover pending" },
  { value: "blocked", label: "Handover locked" },
  { value: "done", label: "Handed over" },
  { value: "not_applicable", label: "Not a physical book" },
]

export const purchaseStaffFormOptions = handoverStaff.map((staff) => ({
  value: staff.id,
  label: `${staff.name} · ${staff.role}`,
}))

export const PURCHASE_MOCK_NOW = `${MOCK_TODAY}T12:00:00+05:30`
