"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  BellIcon,
  BellRingIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CreditCardIcon,
  HardDriveIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  MessageSquareIcon,
  PlugZapIcon,
  RefreshCwIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { ConnectionConfigureDialog } from "@/components/integrations/connection-configure-dialog"
import { IntegrationStateBadge } from "@/components/integrations/integration-state-badge"
import { GatewayStatusBadge } from "@/components/payments/payment-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  fileStorageConnection,
  gatewayConnection,
  gatewayTransactions,
  getIntegrationsSummary,
  getPushSubscriptionSummary,
  notificationChannelConnections,
  pushSubscriptions,
  type ConfigField,
  type CredentialRef,
  type GatewayTransactionRow,
  type IntegrationState,
} from "@/lib/integrations-data"
import { gatewayStatusLabels, type GatewayStatus } from "@/lib/payments-data"
import { formatDateTime, formatDisplayDate } from "@/lib/students-data"

type ConnectionModel = {
  key: string
  title: string
  description: string
  icon: LucideIcon
  provider: string | null
  state: IntegrationState
  moduleLabel: string | null
  moduleEnabled: boolean
  channelEnabled: boolean | null
  toggledBy: string
  lastActivityAt: string | null
  lastSample: string
  credentials: CredentialRef[]
  config: ConfigField[]
}

const gatewayStatusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(gatewayStatusLabels) as GatewayStatus[]).map((status) => ({
    value: status,
    label: gatewayStatusLabels[status],
  })),
]

export function IntegrationsSettings() {
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Connection overview refreshed from local mock data. No network call was made and nothing was saved."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const connections = useMemo<ConnectionModel[]>(() => {
    const gateway: ConnectionModel = {
      key: "gateway",
      title: gatewayConnection.label,
      description:
        "Card and online checkout through the payment provider, verified through gateway_transaction.",
      icon: CreditCardIcon,
      provider: gatewayConnection.provider,
      state: gatewayConnection.state,
      moduleLabel: gatewayConnection.moduleLabel,
      moduleEnabled: gatewayConnection.enabledByModule,
      channelEnabled: null,
      toggledBy: "organization.enabled_modules.gateway",
      lastActivityAt: gatewayConnection.lastActivityAt,
      lastSample: gatewayConnection.lastStatus
        ? `Latest attempt · ${gatewayStatusLabels[gatewayConnection.lastStatus]}`
        : "No attempts recorded yet.",
      credentials: gatewayConnection.credentials,
      config: gatewayConnection.config,
    }

    const channels: ConnectionModel[] = notificationChannelConnections.map(
      (channel) => ({
        key: channel.id,
        title: channel.label,
        description:
          channel.provider === null
            ? "Notifications shown inside the app. Always available."
            : `Outbound ${channel.label.toLowerCase()} through the configured provider, read from notification_channel.`,
        icon: channelIcon(channel.channel),
        provider: channel.provider,
        state: channel.state,
        moduleLabel: channel.moduleLabel,
        moduleEnabled: channel.enabledByModule,
        channelEnabled: channel.channelEnabled,
        toggledBy:
          channel.channel === "email"
            ? "organization.enabled_modules.email"
            : channel.channel === "sms"
              ? "organization.enabled_modules.sms"
              : channel.channel === "push"
                ? "organization.enabled_modules.web_push"
                : "Always on",
        lastActivityAt: channel.lastActivityAt,
        lastSample: channel.sampleNote,
        credentials: channel.credentials,
        config: channel.config,
      })
    )

    const storage: ConnectionModel = {
      key: fileStorageConnection.id,
      title: fileStorageConnection.label,
      description:
        "Private storage for slips, receipts and content files, referenced by the file table.",
      icon: HardDriveIcon,
      provider: fileStorageConnection.provider,
      state: fileStorageConnection.state,
      moduleLabel: null,
      moduleEnabled: true,
      channelEnabled: null,
      toggledBy: "file (private storage)",
      lastActivityAt: fileStorageConnection.lastActivityAt,
      lastSample: `${fileStorageConnection.objectCount.toLocaleString("en-GB")} objects · ${fileStorageConnection.totalSizeLabel}`,
      credentials: fileStorageConnection.credentials,
      config: fileStorageConnection.config,
    }

    return [gateway, ...channels, storage]
  }, [])

  const summary = getIntegrationsSummary()
  const pushSummary = getPushSubscriptionSummary()

  const filteredTransactions = useMemo(() => {
    if (statusFilter === "all") return gatewayTransactions

    return gatewayTransactions.filter(
      (transaction) => transaction.status === statusFilter
    )
  }, [statusFilter])

  const openConnection = openKey
    ? (connections.find((connection) => connection.key === openKey) ?? null)
    : null

  function handleSave(title: string) {
    setOpenKey(null)
    setNotice(
      `${title} configuration was saved locally for preview only. Credentials and secrets are never changed here.`
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Integrations
              <Badge variant="outline" className="rounded-full">
                <PlugZapIcon aria-hidden="true" />
                External connections
              </Badge>
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Module-backed connections to outside providers: the payment
              gateway, the notification channels, web-push subscriptions and
              file storage. Credentials are shown as masked references only —
              raw keys, passwords and card data are never displayed or
              requested. Nothing here is saved and no network call is made.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsRefreshing(true)}
            disabled={isRefreshing}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={isRefreshing ? "animate-spin" : undefined}
            />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<PlugZapIcon aria-hidden="true" />}
            value={summary.total}
            label="Connections"
            hint="Gateway, channels and storage"
          />
          <SummaryCard
            icon={<CircleCheckIcon aria-hidden="true" />}
            value={summary.connected}
            label="Connected"
            hint="Enabled and healthy"
          />
          <SummaryCard
            icon={<ShieldCheckIcon aria-hidden="true" />}
            value={summary.disabled}
            label="Disabled"
            hint="Module switched off"
          />
          <SummaryCard
            icon={<BellRingIcon aria-hidden="true" />}
            value={summary.subscriptions}
            label="Push subscriptions"
            hint={`${pushSummary.users} users · ${pushSummary.platforms} platforms`}
          />
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Connections</h2>
            <p className="text-sm text-muted-foreground">
              Each card reflects the matching module switch and the channel row.
              Open Configure to review the non-secret settings and the masked
              credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {isRefreshing
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} size="sm" className="gap-3">
                    <CardHeader>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-7 w-24" />
                    </CardContent>
                  </Card>
                ))
              : connections.map((connection) => (
                  <ConnectionCard
                    key={connection.key}
                    connection={connection}
                    onConfigure={() => setOpenKey(connection.key)}
                  />
                ))}
          </div>
        </section>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Gateway transactions
              </CardTitle>
              <CardDescription>
                Attempts from <code>gateway_transaction</code>. Statuses are
                initiated, succeeded, failed and cancelled.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                Object.entries(gatewayConnection.totals) as [
                  GatewayStatus,
                  number,
                ][]
              ).map(([status, count]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className="rounded-full text-xs"
                >
                  {gatewayStatusLabels[status]}{" "}
                  <span className="tabular-nums">{count}</span>
                </Badge>
              ))}
            </div>
          </CardHeader>

          <div className="border-b px-4 py-3 sm:px-6">
            <Select
              items={gatewayStatusFilterOptions}
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "all")}
            >
              <SelectTrigger
                className="w-full sm:w-56"
                aria-label="Filter gateway transactions by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gatewayStatusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CreditCardIcon className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">
                No transactions with this status
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Choose another status to review the checkout attempts.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                    Reference
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Student
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Initiated
                  </TableHead>
                  <TableHead className="pr-4 text-muted-foreground sm:pr-6">
                    Note
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <GatewayTransactionRowItem
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Only the provider reference is stored. Card numbers are never
              modelled or shown, and no connection test is run from this page.
            </span>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <BellRingIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Push subscriptions
              </CardTitle>
              <CardDescription>
                Devices subscribed to web push. Endpoints and keys are stored
                masked and are never revealed.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="rounded-full">
                <UsersIcon data-icon="inline-start" />
                {pushSummary.users} users
              </Badge>
              <Badge variant="outline" className="rounded-full">
                <SmartphoneIcon data-icon="inline-start" />
                {pushSummary.platforms} platforms
              </Badge>
              <Badge
                variant={pushSummary.enabled ? "secondary" : "outline"}
                className="rounded-full"
              >
                {pushSummary.enabled
                  ? "Web push module on"
                  : "Web push module off"}
              </Badge>
            </div>
          </CardHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                  User
                </TableHead>
                <TableHead className="text-muted-foreground">Device</TableHead>
                <TableHead className="text-muted-foreground">
                  Endpoint (masked)
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Keys (masked)
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Last seen
                </TableHead>
                <TableHead className="pr-4 text-muted-foreground sm:pr-6">
                  Subscribed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pushSubscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="py-3 pl-4 sm:pl-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">{subscription.userLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {subscription.roleLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {subscription.deviceLabel}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {subscription.endpointRef}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <LockIcon className="size-3" aria-hidden="true" />
                      {subscription.keyRef}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDisplayDate(subscription.lastSeenAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-sm text-muted-foreground sm:pr-6">
                    {formatDisplayDate(subscription.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Raw push endpoints and the p256dh and auth keys are never
              displayed. Removing a subscription is handled on the user's
              device, not here.
            </span>
          </div>
        </Card>

        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheckIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            This screen never reveals or requests raw signing keys, passwords,
            card details or provider secrets. Every credential shown is a masked
            reference, and the page makes no real connection test or network
            call.
          </span>
        </div>
      </div>

      <ConnectionConfigureDialog
        open={openConnection !== null}
        onOpenChange={(open) => {
          if (!open) setOpenKey(null)
        }}
        title={openConnection?.title ?? "connection"}
        description={openConnection?.description ?? ""}
        provider={openConnection?.provider ?? null}
        state={openConnection?.state ?? "connected"}
        moduleLabel={openConnection?.moduleLabel ?? null}
        credentials={openConnection?.credentials ?? []}
        config={openConnection?.config ?? []}
        onSave={handleSave}
      />
    </main>
  )
}

function channelIcon(
  channel: (typeof notificationChannelConnections)[number]["channel"]
): LucideIcon {
  if (channel === "email") return MailIcon
  if (channel === "sms") return MessageSquareIcon
  if (channel === "push") return BellRingIcon
  return BellIcon
}

function ConnectionCard({
  connection,
  onConfigure,
}: {
  connection: ConnectionModel
  onConfigure: () => void
}) {
  const Icon = connection.icon

  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
            <Icon aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span>{connection.title}</span>
            {connection.provider ? (
              <span className="text-xs font-normal text-muted-foreground">
                {connection.provider}
              </span>
            ) : (
              <span className="text-xs font-normal text-muted-foreground">
                No external provider
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <IntegrationStateBadge state={connection.state} />
          {connection.moduleLabel ? (
            <Badge
              variant={connection.moduleEnabled ? "secondary" : "outline"}
              className="rounded-full text-xs"
            >
              {connection.moduleEnabled ? "Module on" : "Module off"} ·{" "}
              {connection.moduleLabel}
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full text-xs">
              Always available
            </Badge>
          )}
        </div>

        <dl className="flex flex-col gap-2 text-xs">
          <Row
            label="Channel switch"
            value={
              connection.channelEnabled === null
                ? "Not applicable"
                : connection.channelEnabled
                  ? "Enabled"
                  : "Disabled"
            }
          />
          <Row label="Toggled by" value={connection.toggledBy} mono />
          <Row
            label="Last activity"
            value={
              connection.lastActivityAt
                ? formatDateTime(connection.lastActivityAt)
                : "No activity yet"
            }
          />
        </dl>

        <p className="flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
          <CalendarClockIcon
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          {connection.lastSample}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={onConfigure}
        >
          <SettingsIcon data-icon="inline-start" />
          Configure
        </Button>
      </CardContent>
    </Card>
  )
}

function GatewayTransactionRowItem({
  transaction,
}: {
  transaction: GatewayTransactionRow
}) {
  return (
    <TableRow>
      <TableCell className="py-3 pl-4 sm:pl-6">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm">{transaction.providerRef}</span>
          <span className="text-xs text-muted-foreground">
            {transaction.provider}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        <div className="flex flex-col gap-0.5">
          <span>{transaction.studentName}</span>
          <span className="text-xs text-muted-foreground">
            {transaction.referenceNo ?? "No payment row yet"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        {formatLkr(transaction.amount)}
      </TableCell>
      <TableCell>
        <GatewayStatusBadge status={transaction.status} />
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
        {formatDateTime(transaction.initiatedAt)}
      </TableCell>
      <TableCell className="max-w-[280px] pr-4 text-sm text-muted-foreground sm:pr-6">
        {transaction.note}
      </TableCell>
    </TableRow>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "text-right font-mono text-xs break-words"
            : "text-right text-xs break-words"
        }
      >
        {value}
      </dd>
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span className="truncate text-2xl font-semibold tabular-nums">
          {value}
        </span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
