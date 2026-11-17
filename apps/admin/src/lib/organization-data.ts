/**
 * Local mock fixtures for the Organization settings screen.
 *
 * Mirrors the single `organization` row (invariant A2) — name, type, currency,
 * timezone, guardian age threshold, overdue behaviour, discount commission
 * basis and the `enabled_modules` switches. The signing key is shown as a
 * configured/not-configured reference only; no secret value is modelled.
 * Nothing here is persisted.
 */

export type OrganizationType = "individual" | "institution"
export type OverdueAction =
  "none" | "notify" | "restrict" | "notify_and_restrict"
export type CommissionBasis = "paid" | "list"

export type ModuleName =
  | "parent_portal"
  | "lecturer_portal"
  | "online_exams"
  | "content_store"
  | "commissions"
  | "fee_exceptions"
  | "qr_attendance"
  | "gateway"
  | "email"
  | "sms"
  | "web_push"

export type OrganizationModule = {
  name: ModuleName
  label: string
  description: string
  /** Shown next to the switch so the module's effect is visible. */
  effect: string
}

export type OrganizationModuleGroup = {
  label: string
  description: string
  modules: OrganizationModule[]
}

export type OrganizationRecord = {
  id: string
  name: string
  type: OrganizationType
  currency: string
  timezone: string
  guardianRequiredBelowAge: number
  overdueGraceDays: number
  overdueAction: OverdueAction
  discountCommissionBasis: CommissionBasis
  enabledModules: Record<ModuleName, boolean>
  /** Masked reference only. Never a raw key. */
  signingKeyRef: string | null
  createdAt: string
}

export const organizationTypeLabels: Record<OrganizationType, string> = {
  individual: "Individual",
  institution: "Institution",
}

export const overdueActionLabels: Record<OverdueAction, string> = {
  none: "None",
  notify: "Notify only",
  restrict: "Restrict access",
  notify_and_restrict: "Notify and restrict",
}

export const overdueActionHints: Record<OverdueAction, string> = {
  none: "Overdue invoices are flagged but no action is taken.",
  notify: "Guardians are notified once an invoice passes the grace period.",
  restrict: "Enrollment access is restricted after the grace period.",
  notify_and_restrict:
    "Guardians are notified and enrollment access is restricted after the grace period.",
}

export const commissionBasisLabels: Record<CommissionBasis, string> = {
  paid: "Paid amount",
  list: "List (invoiced) amount",
}

export const commissionBasisHints: Record<CommissionBasis, string> = {
  paid: "Commission is calculated on the amount actually collected.",
  list: "Commission is calculated on the invoiced list amount, before discounts.",
}

export const organizationTypeOptions = (
  Object.entries(organizationTypeLabels) as [OrganizationType, string][]
).map(([value, label]) => ({ value, label }))

export const overdueActionOptions = (
  Object.entries(overdueActionLabels) as [OverdueAction, string][]
).map(([value, label]) => ({ value, label }))

export const commissionBasisOptions = (
  Object.entries(commissionBasisLabels) as [CommissionBasis, string][]
).map(([value, label]) => ({ value, label }))

/**
 * Single-currency deployment in this demo, so the selector pins LKR. Timezone
 * options stay in the same region as the mock data.
 */
export const currencyOptions = [
  { value: "LKR", label: "LKR · Sri Lankan rupee" },
]

export const timezoneOptions = [
  { value: "Asia/Colombo", label: "Asia/Colombo (GMT+05:30)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (GMT+05:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GMT+04:00)" },
]

export const ORGANIZATION_MODULE_GROUPS: OrganizationModuleGroup[] = [
  {
    label: "Portals & exams",
    description:
      "Sign-in for guardians and lecturers, and the online exam tooling.",
    modules: [
      {
        name: "parent_portal",
        label: "Parent portal",
        description: "Guardian accounts can sign in to view students.",
        effect: "Gates guardian portal access in the Guardians screen.",
      },
      {
        name: "lecturer_portal",
        label: "Lecturer portal",
        description: "Lecturer accounts can sign in to their own workspace.",
        effect: "Gates the lecturer portal toggle in the Lecturers screen.",
      },
      {
        name: "online_exams",
        label: "Online exams",
        description: "MCQ exams, attempts and the shared question bank.",
        effect: "Gates the question bank and online exam results.",
      },
      {
        name: "qr_attendance",
        label: "QR attendance",
        description: "Students mark attendance by scanning a session QR code.",
        effect: "Gates QR marking in the Attendance screen.",
      },
    ],
  },
  {
    label: "Finance & content",
    description:
      "Paid content, discounts, commissions and the online payment gateway.",
    modules: [
      {
        name: "content_store",
        label: "Content store",
        description: "Paid content sold through purchases and invoices.",
        effect: "Gates paid store capability in the Content Library.",
      },
      {
        name: "fee_exceptions",
        label: "Fee exceptions",
        description: "Alternate fee options and discounts per enrollment.",
        effect: "Gates the Fee Exceptions screen.",
      },
      {
        name: "commissions",
        label: "Commissions",
        description: "Commission rules and teacher payouts.",
        effect: "Gates the Commission Rules and Teacher Payouts screens.",
      },
      {
        name: "gateway",
        label: "Payment gateway",
        description: "Card and online checkout through the payment provider.",
        effect: "Gates gateway checkout as an offered payment method.",
      },
    ],
  },
  {
    label: "Communication",
    description:
      "External notification channels. In-app notifications always exist.",
    modules: [
      {
        name: "email",
        label: "Email",
        description: "Email notifications through the configured provider.",
        effect: "Adds email as a delivery channel in Notifications.",
      },
      {
        name: "sms",
        label: "SMS",
        description: "SMS notifications through the configured provider.",
        effect: "Adds SMS as a delivery channel in Notifications.",
      },
      {
        name: "web_push",
        label: "Web push",
        description: "Browser push notifications to subscribed devices.",
        effect: "Adds web push as a delivery channel in Notifications.",
      },
    ],
  },
]

export const organization: OrganizationRecord = {
  id: "org-1",
  name: "Eclz Institute (Pvt) Ltd",
  type: "institution",
  currency: "LKR",
  timezone: "Asia/Colombo",
  guardianRequiredBelowAge: 16,
  overdueGraceDays: 7,
  overdueAction: "notify",
  discountCommissionBasis: "paid",
  enabledModules: {
    parent_portal: true,
    lecturer_portal: true,
    online_exams: true,
    content_store: true,
    commissions: false,
    fee_exceptions: true,
    qr_attendance: false,
    gateway: true,
    email: true,
    sms: false,
    web_push: true,
  },
  signingKeyRef: "key_••••••••••3f7a",
  createdAt: "2024-01-15",
}

export const ORGANIZATION_MODULE_COUNT = ORGANIZATION_MODULE_GROUPS.reduce(
  (total, group) => total + group.modules.length,
  0
)

export function getEnabledModuleCount(
  modules: Record<ModuleName, boolean> = organization.enabledModules
) {
  return Object.values(modules).filter(Boolean).length
}
