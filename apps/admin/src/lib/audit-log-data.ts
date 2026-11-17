/**
 * Local mock fixtures for the Audit Log screen.
 *
 * Mirrors the append-only `audit_log` table: timestamp, actor (or System),
 * action, entity, reason and before/after JSON. Records are read-only sample
 * data; sensitive values are stored already masked and nothing here is
 * persisted or editable.
 */

import { roles, users } from "@/lib/users-roles-data"

export type AuditActor = {
  /** null for scheduled jobs and system actions. */
  userId: string | null
  name: string
  isSystem: boolean
}

export type AuditRecord = {
  id: string
  at: string
  actor: AuditActor
  action: string
  entityType: string
  entityId: string
  entityLabel: string
  reason: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

type AuditSeed = {
  id: string
  at: string
  actorUserId: string | null
  action: string
  entityType: string
  entityId: string
  entityLabel: string
  reason?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

const SYSTEM_ACTOR: AuditActor = {
  userId: null,
  name: "System",
  isSystem: true,
}

function resolveActor(userId: string | null): AuditActor {
  if (!userId) return SYSTEM_ACTOR

  const user = users.find((item) => item.id === userId)

  return {
    userId,
    name: user?.fullName ?? "Unknown user",
    isSystem: false,
  }
}

const auditSeeds: AuditSeed[] = [
  {
    id: "aud-0001",
    at: "2026-11-13T08:42:00+05:30",
    actorUserId: "usr-acct",
    action: "payment.verified",
    entityType: "payment",
    entityId: "pay-2011",
    entityLabel: "PAY-2026-2011",
    reason: "Bank slip matched to the reference on the statement.",
    before: {
      status: "pending_verification",
      amount: 12500,
      verifiedBy: null,
    },
    after: {
      status: "verified",
      amount: 12500,
      verifiedBy: "Hasini Silva",
      allocatedTo: ["INV-2026-0044"],
    },
  },
  {
    id: "aud-0002",
    at: "2026-11-13T08:15:00+05:30",
    actorUserId: "usr-mgr-cmb",
    action: "student.status_changed",
    entityType: "student",
    entityId: "stu-13",
    entityLabel: "STU-2023-0105 · Ruwanthi de Silva",
    reason:
      "Repeated failed payments; access restricted pending a guardian meeting.",
    before: { status: "active", accessStatus: "active" },
    after: { status: "suspended", accessStatus: "restricted" },
  },
  {
    id: "aud-0003",
    at: "2026-11-12T19:26:00+05:30",
    actorUserId: "usr-root",
    action: "organization.module_toggled",
    entityType: "organization",
    entityId: "org-1",
    entityLabel: "Eclz Institute (Pvt) Ltd",
    reason: "Turn QR attendance off until the scanner rollout is complete.",
    before: { qr_attendance: true },
    after: { qr_attendance: false },
  },
  {
    id: "aud-0004",
    at: "2026-11-12T18:40:00+05:30",
    actorUserId: null,
    action: "invoice.issued",
    entityType: "invoice",
    entityId: "inv-2026-0044",
    entityLabel: "INV-2026-0044",
    reason: "Monthly recurring generation.",
    after: {
      studentNo: "STU-2024-0114",
      branch: "Colombo",
      total: 8500,
      dueDate: "2026-11-25",
      items: [
        {
          kind: "recurring_fee",
          description: "Grade 8 Mathematics — November",
          amount: 6000,
        },
        {
          kind: "recurring_fee",
          description: "Science lab fee — November",
          amount: 2500,
        },
      ],
    },
  },
  {
    id: "aud-0005",
    at: "2026-11-12T17:58:00+05:30",
    actorUserId: "usr-acct",
    action: "receipt.issued",
    entityType: "receipt",
    entityId: "rcp-cmb-512",
    entityLabel: "COL-2026-000512",
    after: {
      payment: "PAY-2026-2008",
      branch: "Colombo",
      amount: 8500,
      verificationCode: "rcpt_•••••4f2a",
      signature: "sig_••••••••a91c",
    },
  },
  {
    id: "aud-0006",
    at: "2026-11-12T16:20:00+05:30",
    actorUserId: "usr-admin",
    action: "fee_exception.created",
    entityType: "fee_exception",
    entityId: "fex-31",
    entityLabel: "Sibling discount · Anjali Fernando",
    reason: "Second child enrolled in the same term.",
    after: {
      kind: "discount",
      discountType: "percent",
      discountValue: 10,
      effectiveFrom: "2026-12-01",
      enrollment: "Grade 9 Mathematics",
    },
  },
  {
    id: "aud-0007",
    at: "2026-11-12T14:05:00+05:30",
    actorUserId: "usr-mgr-kdy",
    action: "payment.rejected",
    entityType: "payment",
    entityId: "pay-2009",
    entityLabel: "PAY-2026-2009",
    reason:
      "Slip amount did not match the transfer; guardian asked to resubmit.",
    before: { status: "pending_verification", amount: 4500 },
    after: {
      status: "rejected",
      rejectionReason: "Amount on slip does not match the deposit.",
    },
  },
  {
    id: "aud-0008",
    at: "2026-11-12T11:32:00+05:30",
    actorUserId: "usr-root",
    action: "user.created",
    entityType: "user",
    entityId: "usr-new-7",
    entityLabel: "Nimali Perera",
    reason: "New front-desk hire at the Negombo branch.",
    after: {
      email: "nimali.perera@eclz.lk",
      username: "nimali.p",
      status: "active",
      mfa: false,
      passwordHash: "•••••••• (never shown)",
    },
  },
  {
    id: "aud-0009",
    at: "2026-11-11T20:10:00+05:30",
    actorUserId: null,
    action: "promotion_run.confirmed",
    entityType: "promotion_run",
    entityId: "promo-2026-annual",
    entityLabel: "Annual promotion · 2027 intake",
    reason: "Reviewed and confirmed by the academic team.",
    before: { status: "draft", items: 148 },
    after: {
      status: "confirmed",
      items: 141,
      moved: 132,
      stayed: 6,
      skipped: 3,
    },
  },
  {
    id: "aud-0010",
    at: "2026-11-11T18:44:00+05:30",
    actorUserId: "usr-coord",
    action: "course.updated",
    entityType: "course",
    entityId: "co-g11-maths",
    entityLabel: "O/L Mathematics — Grade 11",
    reason: "Added the second weekly session for the November revision block.",
    before: { sessionsPerWeek: 2, feeStructure: "Grade 11 · monthly" },
    after: { sessionsPerWeek: 3, feeStructure: "Grade 11 · monthly" },
  },
  {
    id: "aud-0011",
    at: "2026-11-11T16:02:00+05:30",
    actorUserId: "usr-acct",
    action: "payment.recorded",
    entityType: "payment",
    entityId: "pay-2010",
    entityLabel: "PAY-2026-2010",
    reason: "Counter cash payment recorded at the front desk.",
    after: {
      method: "cash",
      amount: 6000,
      branch: "Colombo",
      submittedVia: "Front desk",
    },
  },
  {
    id: "aud-0012",
    at: "2026-11-11T15:12:00+05:30",
    actorUserId: "usr-admin",
    action: "role.updated",
    entityType: "role",
    entityId: "role-receptionist",
    entityLabel: "Receptionist",
    reason: "Front desk can now view invoices while taking counter payments.",
    before: { permissions: 6, added: null },
    after: { permissions: 7, added: "invoices.view" },
  },
  {
    id: "aud-0013",
    at: "2026-11-11T09:30:00+05:30",
    actorUserId: null,
    action: "notification_channel.sent",
    entityType: "notification_channel",
    entityId: "nc-sms",
    entityLabel: "SMS · Text.lk",
    reason: "Installment reminder batch.",
    after: {
      channel: "sms",
      provider: "Text.lk",
      queued: 42,
      sent: 42,
      failed: 0,
      sender: "ECLZ",
    },
  },
  {
    id: "aud-0014",
    at: "2026-11-10T21:18:00+05:30",
    actorUserId: "usr-root",
    action: "organization.updated",
    entityType: "organization",
    entityId: "org-1",
    entityLabel: "Eclz Institute (Pvt) Ltd",
    reason: "Extended the overdue grace period before restricting access.",
    before: { overdueGraceDays: 5, overdueAction: "notify" },
    after: { overdueGraceDays: 7, overdueAction: "notify" },
  },
  {
    id: "aud-0015",
    at: "2026-11-10T19:05:00+05:30",
    actorUserId: "usr-mgr-cmb",
    action: "student.created",
    entityType: "student",
    entityId: "stu-15",
    entityLabel: "STU-2026-0250 · Dulanjana Fernando",
    reason: "Walk-in admission for the Grade 6 weekend class.",
    after: {
      branch: "Colombo",
      guardian: "Sunethra Fernando (Mother)",
      grade: "Grade 6",
      guardianRequired: true,
    },
  },
  {
    id: "aud-0016",
    at: "2026-11-10T16:40:00+05:30",
    actorUserId: "usr-acct",
    action: "gateway_transaction.succeeded",
    entityType: "gateway_transaction",
    entityId: "gt-4412",
    entityLabel: "PH-4412",
    reason: "Card checkout completed; payment verified and allocated.",
    after: {
      provider: "PayHere",
      providerRef: "PH-4412",
      status: "succeeded",
      amount: 12000,
      card: "•••• •••• •••• 1234 (never stored)",
    },
  },
  {
    id: "aud-0017",
    at: "2026-11-10T13:22:00+05:30",
    actorUserId: null,
    action: "gateway_transaction.failed",
    entityType: "gateway_transaction",
    entityId: "gt-4410",
    entityLabel: "PH-4410",
    reason: "Issuer declined the card; no funds were received.",
    after: {
      provider: "PayHere",
      providerRef: "PH-4410",
      status: "failed",
      amount: 4500,
    },
  },
  {
    id: "aud-0018",
    at: "2026-11-10T10:55:00+05:30",
    actorUserId: "usr-admin",
    action: "user.mfa_enabled",
    entityType: "user",
    entityId: "usr-acct",
    entityLabel: "Hasini Silva",
    reason: "Finance account required to enrol in multi-factor sign-in.",
    before: { mfa: false },
    after: { mfa: true },
  },
  {
    id: "aud-0019",
    at: "2026-11-09T18:48:00+05:30",
    actorUserId: "usr-mgr-kdy",
    action: "invoice.cancelled",
    entityType: "invoice",
    entityId: "inv-2026-0039",
    entityLabel: "INV-2026-0039",
    reason: "Issued against the wrong intake; reissued as INV-2026-0041.",
    before: { status: "pending", total: 7500 },
    after: {
      status: "cancelled",
      total: 7500,
      replacedBy: "INV-2026-0041",
    },
  },
  {
    id: "aud-0020",
    at: "2026-11-09T15:30:00+05:30",
    actorUserId: "usr-recep",
    action: "guardian.created",
    entityType: "guardian",
    entityId: "gu-15",
    entityLabel: "Dulanjana Fernando's guardian",
    reason: "Guardian added during the walk-in admission.",
    after: {
      fullName: "Chamari Fernando",
      relationship: "Mother",
      primary: true,
      portalEnabled: false,
      nic: "••••••••• V",
    },
  },
  {
    id: "aud-0021",
    at: "2026-11-09T11:12:00+05:30",
    actorUserId: "usr-root",
    action: "user.role_assigned",
    entityType: "user",
    entityId: "usr-1",
    entityLabel: "Anushka Wijesuriya",
    reason: "Senior lecturer coordinating the mathematics course group.",
    after: {
      role: "Academic Coordinator",
      branch: "Colombo",
      allBranches: false,
    },
  },
  {
    id: "aud-0022",
    at: "2026-11-08T20:40:00+05:30",
    actorUserId: "usr-acct",
    action: "payment.voided",
    entityType: "payment",
    entityId: "pay-1998",
    entityLabel: "PAY-2026-1998",
    reason: "Duplicate capture; the original payment was already verified.",
    before: { status: "verified", amount: 9000 },
    after: {
      status: "voided",
      voidReason: "Duplicate of PAY-2026-1997.",
      voidedBy: "Hasini Silva",
    },
  },
  {
    id: "aud-0023",
    at: "2026-11-08T17:15:00+05:30",
    actorUserId: "usr-admin",
    action: "fee_structure.updated",
    entityType: "fee_structure",
    entityId: "fs-g11-maths",
    entityLabel: "Grade 11 Mathematics · monthly",
    reason: "December rate applied from the first billing day.",
    before: { amount: 6000, effectiveFrom: "2026-09-01" },
    after: { amount: 6200, effectiveFrom: "2026-12-01" },
  },
  {
    id: "aud-0024",
    at: "2026-11-08T12:00:00+05:30",
    actorUserId: null,
    action: "notification_channel.sent",
    entityType: "notification_channel",
    entityId: "nc-email",
    entityLabel: "Email · Resend",
    reason: "Receipt delivery batch.",
    after: {
      channel: "email",
      provider: "Resend",
      queued: 18,
      sent: 18,
      failed: 0,
      from: "no-reply@eclz.lk",
    },
  },
  {
    id: "aud-0025",
    at: "2026-11-07T19:22:00+05:30",
    actorUserId: "usr-root",
    action: "branch.deactivated",
    entityType: "branch",
    entityId: "br-galle",
    entityLabel: "Galle",
    reason: "Temporary closure for renovation; history is preserved.",
    before: { isActive: true },
    after: { isActive: false, isDefault: false },
  },
  {
    id: "aud-0026",
    at: "2026-11-07T16:48:00+05:30",
    actorUserId: "usr-mgr-cmb",
    action: "fee_exception.ended",
    entityType: "fee_exception",
    entityId: "fex-22",
    entityLabel: "Hardship discount · Methum Liyanage",
    reason: "Financial situation resolved; the standard rate resumes.",
    before: { kind: "discount", discountValue: 25, effectiveTo: null },
    after: { kind: "discount", discountValue: 25, effectiveTo: "2026-11-30" },
  },
  {
    id: "aud-0027",
    at: "2026-11-07T10:05:00+05:30",
    actorUserId: "usr-admin",
    action: "user.password_reset",
    entityType: "user",
    entityId: "usr-recep",
    entityLabel: "Kasun Bandara",
    reason: "Self-service reset link requested from the sign-in screen.",
    before: { passwordChangedAt: "2026-05-02" },
    after: {
      passwordChangedAt: "2026-11-07",
      resetMethod: "email link",
      passwordHash: "•••••••• (never shown)",
    },
  },
  {
    id: "aud-0028",
    at: "2026-11-06T18:30:00+05:30",
    actorUserId: "usr-root",
    action: "role.created",
    entityType: "role",
    entityId: "role-lab-assistant",
    entityLabel: "Lab Assistant",
    reason: "New support role for the science labs.",
    after: {
      isSystem: false,
      permissions: ["students.view", "attendance.mark", "content.manage"],
    },
  },
  {
    id: "aud-0029",
    at: "2026-11-06T14:12:00+05:30",
    actorUserId: null,
    action: "invoice.overdue_flagged",
    entityType: "invoice",
    entityId: "inv-2026-0031",
    entityLabel: "INV-2026-0031",
    reason: "Passed the 7-day grace period with an open balance.",
    before: { status: "pending", balance: 8500 },
    after: { status: "overdue", balance: 8500, action: "notify" },
  },
  {
    id: "aud-0030",
    at: "2026-11-05T20:00:00+05:30",
    actorUserId: "usr-acct",
    action: "receipt.voided",
    entityType: "receipt",
    entityId: "rcp-kan-118",
    entityLabel: "KAN-2026-000118",
    reason: "Issued against a payment that was later voided.",
    before: { status: "issued", amount: 9000 },
    after: {
      status: "void",
      amount: 9000,
      replacedBy: null,
      signature: "sig_••••••••77be",
    },
  },
  {
    id: "aud-0031",
    at: "2026-11-05T15:40:00+05:30",
    actorUserId: "usr-root",
    action: "organization.updated",
    entityType: "organization",
    entityId: "org-1",
    entityLabel: "Eclz Institute (Pvt) Ltd",
    reason: "Signing key rotated during the quarterly security review.",
    before: { signingKeyRef: "key_••••••••••1b2c" },
    after: { signingKeyRef: "key_••••••••••3f7a", rotatedAt: "2026-11-05" },
  },
  {
    id: "aud-0032",
    at: "2026-11-04T17:26:00+05:30",
    actorUserId: "usr-coord",
    action: "student.grade_changed",
    entityType: "student",
    entityId: "stu-5",
    entityLabel: "STU-2024-0142 · Tharindu Bandara",
    reason: "Mid-year correction after verifying the admission record.",
    before: { grade: "Grade 4", reason: "admission" },
    after: { grade: "Grade 5", reason: "correction" },
  },
  {
    id: "aud-0033",
    at: "2026-11-04T11:18:00+05:30",
    actorUserId: "usr-admin",
    action: "user.disabled",
    entityType: "user",
    entityId: "usr-nm",
    entityLabel: "Mohamed Aslam",
    reason: "Left the institute; account disabled and roles kept for audit.",
    before: { status: "active" },
    after: { status: "disabled", rolesKept: ["Receptionist"] },
  },
  {
    id: "aud-0034",
    at: "2026-11-03T19:52:00+05:30",
    actorUserId: "usr-mgr-cmb",
    action: "payment.verified",
    entityType: "payment",
    entityId: "pay-1985",
    entityLabel: "PAY-2026-1985",
    reason: "Cash deposit confirmed against the bank statement.",
    before: { status: "pending_verification", amount: 6200 },
    after: {
      status: "verified",
      amount: 6200,
      verifiedBy: "Chandana Wijeratne",
      allocatedTo: ["INV-2026-0028"],
    },
  },
]

export const auditRecords: AuditRecord[] = auditSeeds.map((seed) => ({
  id: seed.id,
  at: seed.at,
  actor: resolveActor(seed.actorUserId),
  action: seed.action,
  entityType: seed.entityType,
  entityId: seed.entityId,
  entityLabel: seed.entityLabel,
  reason: seed.reason ?? null,
  before: seed.before ?? null,
  after: seed.after ?? null,
}))

const entityTypeLabels: Record<string, string> = {
  student: "Student",
  guardian: "Guardian",
  invoice: "Invoice",
  payment: "Payment",
  receipt: "Receipt",
  fee_exception: "Fee exception",
  fee_structure: "Fee structure",
  user: "User",
  role: "Role",
  organization: "Organization",
  branch: "Branch",
  course: "Course",
  promotion_run: "Promotion run",
  gateway_transaction: "Gateway transaction",
  notification_channel: "Notification channel",
}

export function getEntityTypeLabel(entityType: string) {
  return entityTypeLabels[entityType] ?? entityType
}

export const AUDIT_ENTITY_TYPE_OPTIONS = [
  { value: "all", label: "All entity types" },
  ...Object.keys(entityTypeLabels)
    .sort()
    .map((value) => ({ value, label: entityTypeLabels[value] ?? value })),
]

export const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  ...[...new Set(auditRecords.map((record) => record.action))]
    .sort()
    .map((action) => ({ value: action, label: action })),
]

export const AUDIT_ACTOR_OPTIONS = [
  { value: "all", label: "All actors" },
  { value: "system", label: "System" },
  ...[...new Set(auditRecords.map((record) => record.actor.userId))]
    .filter((userId): userId is string => Boolean(userId))
    .map((userId) => ({
      value: userId,
      label: users.find((user) => user.id === userId)?.fullName ?? userId,
    })),
]

export const AUDIT_TEXT_SEARCH_OPTIONS = {
  placeholder: "Search actor, action, entity or reason",
}

export function getAuditSummary(records: AuditRecord[] = auditRecords) {
  return {
    total: records.length,
    actors: new Set(records.map((record) => record.actor.userId ?? "system"))
      .size,
    system: records.filter((record) => record.actor.isSystem).length,
    entityTypes: new Set(records.map((record) => record.entityType)).size,
  }
}

export function getAuditReasonLabel(record: AuditRecord) {
  return record.reason ?? "No reason recorded"
}

/** Role names are handy when a record touches a role entity. */
export function getRoleLabel(roleId: string) {
  return roles.find((role) => role.id === roleId)?.name ?? roleId
}

export function isSensitiveKey(key: string) {
  return /pass|secret|token|key|signature|hash|card|nic|cvv/i.test(key)
}

/** Presentation helper: never widen a value beyond a fixed preview length. */
export function truncateAuditValue(value: string, max = 48) {
  if (value.length <= max) return value

  return `${value.slice(0, max - 1)}…`
}

export function countAuditFields(value: Record<string, unknown> | null) {
  if (!value) return 0

  return Object.keys(value).length
}
