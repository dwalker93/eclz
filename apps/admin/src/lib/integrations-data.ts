/**
 * Local mock fixtures for the Integrations settings screen.
 *
 * The screen is a read-only overview of the module-backed external
 * connections: the payment gateway (`gateway_transaction`), the notification
 * channels (`notification_channel`), web-push subscriptions
 * (`push_subscription`) and the private file storage behind `file`.
 *
 * Every credential is a masked reference only. No signing key, password,
 * card number or provider secret is modelled, requested or revealed, and
 * nothing here is persisted or makes a network call.
 */

import { organization } from "@/lib/organization-data"
import { paymentDirectory, type GatewayStatus } from "@/lib/payments-data"
import { MOCK_TODAY } from "@/lib/students-data"
import { getRoleNamesForUser, getUserById } from "@/lib/users-roles-data"

export type IntegrationState =
  "connected" | "attention" | "disabled" | "not_configured"

export const integrationStateLabels: Record<
  IntegrationState,
  { label: string; hint: string }
> = {
  connected: {
    label: "Connected",
    hint: "The connection is enabled and its last sample succeeded.",
  },
  attention: {
    label: "Needs attention",
    hint: "The connection is enabled but its last sample did not succeed.",
  },
  disabled: {
    label: "Disabled",
    hint: "The module is switched off, so this connection sends nothing.",
  },
  not_configured: {
    label: "Not configured",
    hint: "No provider is set up yet for this connection.",
  },
}

export const NO_SECRET_NOTE =
  "Values are masked references only. Raw keys, passwords, tokens and card data stay in the server environment and are never shown or requested here."

/** A masked pointer to a stored credential. The raw value is never modelled. */
export type CredentialRef = {
  label: string
  /** Always masked. Never a real key, password or token. */
  maskedValue: string
  hint: string
}

/** A non-secret setting that is safe to show in a configure dialog. */
export type ConfigField = {
  label: string
  value: string
  hint?: string
}

/* ------------------------------------------------------------------ */
/* Gateway                                                             */
/* ------------------------------------------------------------------ */

export type GatewayTransactionRow = {
  id: string
  provider: string
  providerRef: string
  status: GatewayStatus
  amount: number
  studentName: string
  referenceNo: string | null
  initiatedAt: string
  note: string
}

/**
 * Failed, cancelled and still-open attempts that never became a verified
 * payment, so they have no row in the payment fixtures.
 */
const extraGatewayTransactionSeeds: GatewayTransactionRow[] = [
  {
    id: "gt-ph-8830",
    provider: "PayHere",
    providerRef: "PH-8830",
    status: "initiated",
    amount: 6000,
    studentName: "Methum Liyanage",
    referenceNo: null,
    initiatedAt: "2026-11-13T09:12:00+05:30",
    note: "Checkout opened; the buyer has not finished on the provider page.",
  },
  {
    id: "gt-ph-8824",
    provider: "PayHere",
    providerRef: "PH-8824",
    status: "failed",
    amount: 8500,
    studentName: "Ruwanthi de Silva",
    referenceNo: null,
    initiatedAt: "2026-11-12T17:05:00+05:30",
    note: "Issuer declined the card; no funds were received.",
  },
  {
    id: "gt-ph-8819",
    provider: "PayHere",
    providerRef: "PH-8819",
    status: "cancelled",
    amount: 12000,
    studentName: "Anjali Fernando",
    referenceNo: null,
    initiatedAt: "2026-11-11T20:41:00+05:30",
    note: "The buyer closed the provider page before paying.",
  },
]

/** Gateway attempts derived from the payments fixtures plus open attempts. */
export const gatewayTransactions: GatewayTransactionRow[] = [
  ...paymentDirectory
    .filter((payment) => payment.method === "gateway")
    .map<GatewayTransactionRow>((payment) => {
      const transaction = payment.gatewayTransaction

      return {
        id: `gt-${payment.id}`,
        provider: transaction?.provider ?? "PayHere",
        providerRef: transaction?.providerRef ?? "PH-000000",
        status: transaction?.status ?? "succeeded",
        amount: payment.amount,
        studentName: payment.studentName,
        referenceNo: payment.referenceNo,
        initiatedAt: transaction?.initiatedAt ?? payment.submittedAt,
        note: transaction?.note ?? "Checkout completed.",
      }
    }),
  ...extraGatewayTransactionSeeds,
].sort((left, right) =>
  left.initiatedAt < right.initiatedAt
    ? 1
    : left.initiatedAt > right.initiatedAt
      ? -1
      : 0
)

export function countGatewayTransactions(
  rows: GatewayTransactionRow[] = gatewayTransactions
): Record<GatewayStatus, number> {
  const totals: Record<GatewayStatus, number> = {
    initiated: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  }

  for (const row of rows) totals[row.status] += 1

  return totals
}

export type GatewayConnection = {
  id: "gateway"
  label: string
  provider: string
  mode: "live" | "sandbox"
  state: IntegrationState
  /** The `organization.enabled_modules.gateway` switch. */
  enabledByModule: boolean
  moduleLabel: string
  merchantRef: string
  credentials: CredentialRef[]
  config: ConfigField[]
  lastActivityAt: string | null
  lastStatus: GatewayStatus | null
  totals: Record<GatewayStatus, number>
}

const gatewayEnabled = organization.enabledModules.gateway
const latestGatewayTransaction = gatewayTransactions[0] ?? null

export const gatewayConnection: GatewayConnection = {
  id: "gateway",
  label: "Payment gateway",
  provider: "PayHere",
  mode: "live",
  state: gatewayEnabled ? "connected" : "disabled",
  enabledByModule: gatewayEnabled,
  moduleLabel: "Payment gateway module",
  merchantRef: "merchant_••••••2048",
  credentials: [
    {
      label: "Merchant secret",
      maskedValue: "sec_••••••••••••a91c",
      hint: "The merchant secret is held in the server environment. It is never shown here.",
    },
    {
      label: "Webhook signature",
      maskedValue: "sig_••••••••••••7be4",
      hint: "Callback signatures are verified with the secret above; the raw value stays server-side.",
    },
  ],
  config: [
    {
      label: "Merchant ID",
      value: "1224801",
      hint: "Public merchant identifier from the provider dashboard.",
    },
    {
      label: "Checkout mode",
      value: "Live",
      hint: "Sandbox mode would route checkouts to the provider's test environment.",
    },
    {
      label: "Callback URL",
      value: "https://admin.eclz.lk/api/gateway/payhere",
      hint: "Read-only in this demo. The callback is idempotent on the provider reference.",
    },
  ],
  lastActivityAt: latestGatewayTransaction?.initiatedAt ?? null,
  lastStatus: latestGatewayTransaction?.status ?? null,
  totals: countGatewayTransactions(),
}

/* ------------------------------------------------------------------ */
/* Push subscriptions                                                  */
/* ------------------------------------------------------------------ */

export type PushSubscriptionRecord = {
  id: string
  userLabel: string
  roleLabel: string
  deviceLabel: string
  /** Masked endpoint. The raw push endpoint is never shown. */
  endpointRef: string
  /** Masked key reference. Raw `p256dh`/`auth` keys are never shown. */
  keyRef: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
}

type PushSubscriptionSeed = {
  id: string
  userId: string
  deviceLabel: string
  endpointRef: string
  keyRef: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
}

const pushSubscriptionSeeds: PushSubscriptionSeed[] = [
  {
    id: "ps-1042",
    userId: "usr-acct",
    deviceLabel: "Windows · Chrome",
    endpointRef: "fcm-••••••a1f2",
    keyRef: "p256dh_•••••••••4c21 / auth_•••••••••9b73",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/134.0 Safari/537.36",
    createdAt: "2026-09-14",
    lastSeenAt: "2026-11-12",
  },
  {
    id: "ps-1043",
    userId: "usr-mgr-cmb",
    deviceLabel: "Android · Chrome",
    endpointRef: "fcm-••••••b7d9",
    keyRef: "p256dh_•••••••••77ae / auth_•••••••••1d0c",
    userAgent:
      "Mozilla/5.0 (Linux; Android 15) Chrome/134.0 Mobile Safari/537.36",
    createdAt: "2026-08-02",
    lastSeenAt: "2026-11-12",
  },
  {
    id: "ps-1044",
    userId: "usr-recep",
    deviceLabel: "iOS · Safari",
    endpointRef: "apns-••••••c3e8",
    keyRef: "p256dh_•••••••••2f45 / auth_•••••••••6a91",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2) AppleWebKit/605.1.15 Safari/604.1",
    createdAt: "2026-10-21",
    lastSeenAt: "2026-11-11",
  },
  {
    id: "ps-1045",
    userId: "usr-admin",
    deviceLabel: "Windows · Edge",
    endpointRef: "wms-••••••d1a7",
    keyRef: "p256dh_•••••••••8c02 / auth_•••••••••4e6f",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0) Chrome/134.0 Safari/537.36 Edg/134.0",
    createdAt: "2026-07-19",
    lastSeenAt: "2026-11-10",
  },
  {
    id: "ps-1046",
    userId: "usr-coord",
    deviceLabel: "macOS · Chrome",
    endpointRef: "fcm-••••••e5b3",
    keyRef: "p256dh_•••••••••a907 / auth_•••••••••3c1d",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) Chrome/134.0 Safari/537.36",
    createdAt: "2026-10-05",
    lastSeenAt: "2026-11-09",
  },
  {
    id: "ps-1047",
    userId: "usr-mgr-kdy",
    deviceLabel: "Windows · Firefox",
    endpointRef: "fcm-••••••f9c0",
    keyRef: "p256dh_•••••••••5d84 / auth_•••••••••80b2",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; rv:135.0) Gecko/20100101 Firefox/135.0",
    createdAt: "2026-06-11",
    lastSeenAt: "2026-11-08",
  },
]

export const pushSubscriptions: PushSubscriptionRecord[] =
  pushSubscriptionSeeds.map((seed) => {
    const user = getUserById(seed.userId)

    return {
      id: seed.id,
      userLabel: user?.fullName ?? "Unknown user",
      roleLabel: getRoleNamesForUser(seed.userId)[0] ?? "No role",
      deviceLabel: seed.deviceLabel,
      endpointRef: seed.endpointRef,
      keyRef: seed.keyRef,
      userAgent: seed.userAgent,
      createdAt: seed.createdAt,
      lastSeenAt: seed.lastSeenAt,
    }
  })

const pushSubscriptionCount = pushSubscriptions.length

export function getPushSubscriptionSummary(
  rows: PushSubscriptionRecord[] = pushSubscriptions
) {
  const platforms = new Set(rows.map((row) => row.deviceLabel.split(" · ")[0]))

  return {
    total: rows.length,
    users: new Set(rows.map((row) => row.userLabel)).size,
    platforms: platforms.size,
    enabled: organization.enabledModules.web_push,
  }
}

/* ------------------------------------------------------------------ */
/* Notification channels                                               */
/* ------------------------------------------------------------------ */

export type NotificationChannelKind = "email" | "sms" | "push" | "in_app"

export type NotificationChannelConnection = {
  id: string
  channel: NotificationChannelKind
  label: string
  /** null for the always-available in-app channel. */
  provider: string | null
  state: IntegrationState
  /** The matching `organization.enabled_modules` switch, if any. */
  enabledByModule: boolean
  moduleLabel: string | null
  /** The per-channel switch from `notification_channel`. */
  channelEnabled: boolean
  credentials: CredentialRef[]
  config: ConfigField[]
  lastActivityAt: string | null
  lastStatus: "sent" | "failed" | "queued" | null
  sampleNote: string
}

const emailEnabled = organization.enabledModules.email
const smsEnabled = organization.enabledModules.sms
const pushEnabled = organization.enabledModules.web_push

export const notificationChannelConnections: NotificationChannelConnection[] = [
  {
    id: "nc-email",
    channel: "email",
    label: "Email",
    provider: "Resend",
    state: emailEnabled ? "connected" : "disabled",
    enabledByModule: emailEnabled,
    moduleLabel: "Email module",
    channelEnabled: emailEnabled,
    credentials: [
      {
        label: "API key",
        maskedValue: "re_••••••••••••k2p9",
        hint: "The provider API key is held in the server environment and is never shown here.",
      },
    ],
    config: [
      {
        label: "From address",
        value: "no-reply@eclz.lk",
        hint: "Verified sending domain. Replies are routed to the front desk inbox.",
      },
      {
        label: "Reply-to",
        value: "frontdesk@eclz.lk",
      },
      {
        label: "Daily send cap",
        value: "5,000",
        hint: "Raising the cap requires a verified domain with the provider.",
      },
    ],
    lastActivityAt: "2026-11-12T12:00:00+05:30",
    lastStatus: "sent",
    sampleNote: "Receipt delivery batch · 18 sent, 0 failed.",
  },
  {
    id: "nc-sms",
    channel: "sms",
    label: "SMS",
    provider: "Text.lk",
    state: smsEnabled ? "connected" : "disabled",
    enabledByModule: smsEnabled,
    moduleLabel: "SMS module",
    channelEnabled: smsEnabled,
    credentials: [
      {
        label: "API token",
        maskedValue: "tlk_••••••••••••c4d1",
        hint: "The SMS API token is held in the server environment and is never shown here.",
      },
    ],
    config: [
      {
        label: "Sender ID",
        value: "ECLZ",
        hint: "The sender name shown on the recipient's phone.",
      },
      {
        label: "Default country code",
        value: "+94",
      },
      {
        label: "Daily send cap",
        value: "2,000",
        hint: "SMS is billed per segment; long bodies are split by the provider.",
      },
    ],
    lastActivityAt: "2026-11-11T09:30:00+05:30",
    lastStatus: "sent",
    sampleNote:
      "Installment reminder batch · 42 sent, 0 failed. The SMS module is currently switched off, so no new messages are queued.",
  },
  {
    id: "nc-push",
    channel: "push",
    label: "Web push",
    provider: "VAPID (browser push)",
    state: pushEnabled ? "connected" : "disabled",
    enabledByModule: pushEnabled,
    moduleLabel: "Web push module",
    channelEnabled: pushEnabled,
    credentials: [
      {
        label: "Private VAPID key",
        maskedValue: "vapid_•••••••••••8f0a",
        hint: "The private VAPID key is held in the server environment and is never shown here.",
      },
    ],
    config: [
      {
        label: "Contact",
        value: "mailto:it@eclz.lk",
        hint: "Push services use this contact if the sender misbehaves.",
      },
      {
        label: "Subscription TTL",
        value: "30 days",
        hint: "Stale subscriptions are dropped after this and re-created on the next visit.",
      },
      {
        label: "Active subscriptions",
        value: String(pushSubscriptionCount),
      },
    ],
    lastActivityAt: "2026-11-12T08:05:00+05:30",
    lastStatus: "sent",
    sampleNote: "Class reminder batch · 7 delivered across 6 devices.",
  },
  {
    id: "nc-in-app",
    channel: "in_app",
    label: "In-app",
    provider: null,
    state: "connected",
    enabledByModule: true,
    moduleLabel: null,
    channelEnabled: true,
    credentials: [],
    config: [
      {
        label: "Availability",
        value: "Always on",
        hint: "In-app notifications run in the app itself and need no provider.",
      },
      {
        label: "Retention",
        value: "90 days",
        hint: "Read and unread in-app notifications are pruned after this window.",
      },
    ],
    lastActivityAt: `${MOCK_TODAY}T07:40:00+05:30`,
    lastStatus: "sent",
    sampleNote: "Every in-app notification is stored locally inside the app.",
  },
]

/* ------------------------------------------------------------------ */
/* File storage                                                        */
/* ------------------------------------------------------------------ */

export type FileStorageConnection = {
  id: "file_storage"
  label: string
  provider: string
  state: IntegrationState
  bucketRef: string
  region: string
  credentials: CredentialRef[]
  config: ConfigField[]
  objectCount: number
  totalSizeLabel: string
  lastActivityAt: string
}

export const fileStorageConnection: FileStorageConnection = {
  id: "file_storage",
  label: "File storage",
  provider: "Private object storage (S3-compatible)",
  state: "connected",
  bucketRef: "eclz-private-•••••• (masked)",
  region: "ap-south-1 · Mumbai",
  credentials: [
    {
      label: "Access key ID",
      maskedValue: "AKIA••••••••••••7N2Q",
      hint: "Scoped to this bucket only. The matching secret is held in the server environment.",
    },
    {
      label: "Secret access key",
      maskedValue: "•••••••••••••••••••• (never shown)",
      hint: "The secret access key is never displayed, copied or requested on this screen.",
    },
  ],
  config: [
    {
      label: "Public access",
      value: "Disabled",
      hint: "Files are served through short-lived signed URLs only.",
    },
    {
      label: "Signed URL TTL",
      value: "15 minutes",
    },
    {
      label: "Encryption at rest",
      value: "SSE-S3",
      hint: "Server-side encryption is applied to every uploaded object.",
    },
  ],
  objectCount: 4182,
  totalSizeLabel: "18.6 GB",
  lastActivityAt: "2026-11-12T16:10:00+05:30",
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export function getIntegrationsSummary() {
  const states: IntegrationState[] = [
    gatewayConnection.state,
    ...notificationChannelConnections.map((channel) => channel.state),
    fileStorageConnection.state,
  ]

  return {
    total: states.length,
    connected: states.filter((state) => state === "connected").length,
    disabled: states.filter((state) => state === "disabled").length,
    attention: states.filter(
      (state) => state === "attention" || state === "not_configured"
    ).length,
    subscriptions: pushSubscriptions.length,
  }
}

export function getIntegrationStateLabel(state: IntegrationState) {
  return integrationStateLabels[state].label
}
