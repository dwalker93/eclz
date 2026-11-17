"use client"

import { useMemo } from "react"
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
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
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
  CircleAlertIcon,
  Clock3Icon,
  InfoIcon,
  LockIcon,
  MailIcon,
  MessageSquareIcon,
  RadioTowerIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  getPushSubscriptionSummary,
  notificationChannelConnections,
  pushSubscriptions,
} from "@/lib/integrations-data"
import {
  notificationChannelDescriptions,
  notificationChannelLabels,
  type NotificationChannel,
} from "@/lib/notifications-data"
import { formatDateTime, formatDisplayDate } from "@/lib/students-data"

const channelIcons: Record<NotificationChannel, LucideIcon> = {
  in_app: BellIcon,
  email: MailIcon,
  sms: MessageSquareIcon,
  push: BellRingIcon,
}

type NotificationConfigurationProps = {
  enabledChannels: Record<NotificationChannel, boolean>
  onToggleChannel: (channel: NotificationChannel, enabled: boolean) => void
  onNotify: (message: string) => void
}

export function NotificationConfiguration({
  enabledChannels,
  onToggleChannel,
  onNotify,
}: NotificationConfigurationProps) {
  const pushSummary = getPushSubscriptionSummary()

  const onCount = useMemo(
    () =>
      (Object.keys(enabledChannels) as NotificationChannel[]).filter(
        (channel) => enabledChannels[channel]
      ).length,
    [enabledChannels]
  )

  const blockedByModule = notificationChannelConnections.filter(
    (connection) =>
      connection.channel !== "in_app" && !connection.enabledByModule
  ).length

  function handleToggle(channel: NotificationChannel, enabled: boolean) {
    onToggleChannel(channel, enabled)

    onNotify(
      enabled
        ? `${notificationChannelLabels[channel]} notifications switched on in local demo state. Nothing is sent automatically.`
        : `${notificationChannelLabels[channel]} notifications switched off in local demo state. No new rows or send attempts are created.`
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<SlidersHorizontalIcon aria-hidden="true" />}
          value={`${onCount} / 4`}
          label="Channels on"
          hint="In-app is always on"
        />
        <SummaryCard
          icon={<RadioTowerIcon aria-hidden="true" />}
          value={pushSummary.total}
          label="Push subscriptions"
          hint={`${pushSummary.users} users · ${pushSummary.platforms} platforms`}
        />
        <SummaryCard
          icon={<MailIcon aria-hidden="true" />}
          value={notificationChannelConnections.filter(
            (connection) => connection.provider !== null
          ).length}
          label="Providers"
          hint="Email, SMS and web push"
        />
        <SummaryCard
          icon={<LockIcon aria-hidden="true" />}
          value={blockedByModule}
          label="Module blocked"
          hint="Switched off in Organization"
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-600/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-900 dark:border-sky-400/25 dark:text-sky-200">
        <InfoIcon
          className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-400"
          aria-hidden="true"
        />
        <span>
          In-app notifications are always available. External channels need both
          their module switch in Organization settings and the channel switch
          here. Turning a channel off stops new rows and send attempts; existing
          history is kept. Demo switches change this browser session only.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {notificationChannelConnections.map((connection) => {
          const channel = connection.channel as NotificationChannel
          const Icon = channelIcons[channel]
          const isInApp = channel === "in_app"
          const isOn = enabledChannels[channel]
          const blocked = !isInApp && !connection.enabledByModule

          return (
            <Card key={connection.id} size="sm" className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span>{notificationChannelLabels[channel]}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {connection.provider ?? "Built into the app"}
                      </span>
                    </span>
                  </span>
                  <Badge
                    variant={isOn ? "secondary" : "outline"}
                    className="shrink-0 rounded-full text-xs"
                  >
                    {isInApp ? "Always on" : isOn ? "On" : "Off"}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="gap-3">
                <p className="text-sm text-muted-foreground">
                  {notificationChannelDescriptions[channel]}
                </p>

                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor={`channel-switch-${channel}`}
                      className="text-sm font-medium"
                    >
                      Channel switch
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {blocked
                        ? `${connection.moduleLabel} is switched off in Organization settings.`
                        : isInApp
                          ? "In-app notifications cannot be switched off."
                          : isOn
                            ? "New notifications are allowed on this channel."
                            : "No new notification rows will be created."}
                    </span>
                  </div>
                  <Switch
                    id={`channel-switch-${channel}`}
                    checked={isOn}
                    disabled={isInApp || blocked}
                    onCheckedChange={(value) => handleToggle(channel, value)}
                    aria-label={`Enable ${notificationChannelLabels[channel]} notifications`}
                  />
                </div>

                {connection.moduleLabel ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="rounded-full text-xs"
                    >
                      {connection.enabledByModule ? "Module on" : "Module off"}
                    </Badge>
                    {connection.moduleLabel}
                    {blocked ? (
                      <span className="text-muted-foreground">
                        · turn it on under Organization settings
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <dl className="flex flex-col gap-2 text-xs">
                  {connection.credentials.map((credential) => (
                    <div
                      key={credential.label}
                      className="flex flex-col gap-1 rounded-md border bg-muted/20 px-2.5 py-2"
                    >
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <LockIcon
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                        {credential.label}
                      </dt>
                      <dd className="font-mono text-[11px] break-all">
                        {credential.maskedValue}
                      </dd>
                      <span className="text-[11px] text-muted-foreground">
                        {credential.hint}
                      </span>
                    </div>
                  ))}
                </dl>

                <dl className="flex flex-col gap-1.5 text-xs">
                  {connection.config.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-start justify-between gap-3"
                    >
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="text-right font-medium">{field.value}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-3 border-t pt-1.5">
                    <dt className="text-muted-foreground">Last activity</dt>
                    <dd className="text-right">
                      {connection.lastActivityAt
                        ? formatDateTime(connection.lastActivityAt)
                        : "No activity yet"}
                    </dd>
                  </div>
                </dl>

                <p className="flex items-start gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-xs text-muted-foreground">
                  <Clock3Icon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {connection.sampleNote}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <SmartphoneIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Push subscriptions
            </CardTitle>
            <CardDescription>
              {pushSummary.total} browser and device subscriptions ·{" "}
              {pushSummary.users} users · {pushSummary.platforms} platforms
            </CardDescription>
          </div>
          <Badge
            variant={pushSummary.enabled ? "secondary" : "outline"}
            className="rounded-full"
          >
            {pushSummary.enabled ? "Web push module on" : "Web push module off"}
          </Badge>
        </CardHeader>

        <div className="border-b px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          Endpoints and encryption keys are masked. Removing a subscription is
          handled by the browser, not this screen.
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                User
              </TableHead>
              <TableHead className="text-muted-foreground">Device</TableHead>
              <TableHead className="hidden text-muted-foreground md:table-cell">
                Endpoint
              </TableHead>
              <TableHead className="hidden text-muted-foreground lg:table-cell">
                Key reference
              </TableHead>
              <TableHead className="hidden text-muted-foreground xl:table-cell">
                Created
              </TableHead>
              <TableHead className="pr-4 text-muted-foreground sm:pr-6">
                Last seen
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pushSubscriptions.map((subscription) => (
              <TableRow key={subscription.id} className="align-top">
                <TableCell className="py-3 pl-4 sm:pl-6">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {subscription.userLabel}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {subscription.roleLabel}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm">{subscription.deviceLabel}</span>
                    <span className="max-w-[14rem] truncate text-xs text-muted-foreground">
                      {subscription.userAgent}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden py-3 md:table-cell">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {subscription.endpointRef}
                  </code>
                </TableCell>
                <TableCell className="hidden py-3 lg:table-cell">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {subscription.keyRef}
                  </code>
                </TableCell>
                <TableCell className="hidden py-3 whitespace-nowrap text-muted-foreground xl:table-cell">
                  {formatDisplayDate(subscription.createdAt)}
                </TableCell>
                <TableCell className="py-3 pr-4 whitespace-nowrap text-muted-foreground sm:pr-6">
                  {formatDisplayDate(subscription.lastSeenAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheckIcon
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            Provider credentials stay masked and are never edited from this
            screen. Real keys live in the server environment.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onNotify(
              "Provider settings and credentials are read-only in this demo. No send was triggered."
            )
          }
        >
          <CircleAlertIcon data-icon="inline-start" />
          Editing provider settings is disabled
        </Button>
      </div>
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
  value: string | number
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
