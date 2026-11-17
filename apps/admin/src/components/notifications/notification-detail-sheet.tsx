"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  BellIcon,
  CircleAlertIcon,
  ClipboardCopyIcon,
  Clock3Icon,
  FileTextIcon,
  InfoIcon,
  MailIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  NotificationChannelBadge,
  NotificationStatusBadge,
} from "@/components/notifications/notification-badges"
import {
  formatPayloadLabel,
  getNotificationRecipient,
  getNotificationTemplate,
  notificationChannelLabels,
  notificationEventDescriptions,
  notificationEventLabels,
  renderTemplateValues,
  type NotificationRecord,
  type NotificationTemplateRecord,
} from "@/lib/notifications-data"
import { formatDateTime, getInitials } from "@/lib/students-data"

type NotificationDetailSheetProps = {
  notification: NotificationRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: NotificationTemplateRecord[]
  onNotify: (message: string) => void
}

export function NotificationDetailSheet({
  notification,
  open,
  onOpenChange,
  templates,
  onNotify,
}: NotificationDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      onNotify(`${label} copied to the clipboard.`)
    } catch {
      onNotify(`${label}: ${value}`)
    }
  }

  const recipient = notification
    ? getNotificationRecipient(notification.recipientId)
    : undefined
  const template = notification
    ? getNotificationTemplate(
        notification.event,
        notification.channel,
        templates
      )
    : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {notification ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {notificationEventLabels[notification.event]}
                <NotificationStatusBadge status={notification.status} />
              </SheetTitle>
              <SheetDescription>
                {recipient?.fullName ?? "Unknown recipient"} ·{" "}
                {notificationChannelLabels[notification.channel]} · created{" "}
                {formatDateTime(notification.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              {notification.status === "failed" && notification.error ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm">
                  <CircleAlertIcon
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-destructive">
                      Delivery failed
                    </span>
                    <span className="text-muted-foreground">
                      {notification.error}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Failed deliveries are kept in the log for reference. This
                      demo does not retry or resend anything.
                    </span>
                  </div>
                </div>
              ) : null}

              {notification.status === "queued" ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-600/25 bg-amber-500/5 px-3.5 py-3 text-sm">
                  <Clock3Icon
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Waiting in the queue</span>
                    <span className="text-muted-foreground">
                      The notification has not been sent yet. This demo does not
                      dispatch queued notifications.
                    </span>
                  </div>
                </div>
              ) : null}

              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <UserRoundIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Recipient
                </h3>
                <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="text-xs">
                      {recipient ? getInitials(recipient.fullName) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {recipient?.fullName ?? "Unknown recipient"}
                      </span>
                      {recipient ? (
                        <Badge
                          variant="outline"
                          className="rounded-full text-muted-foreground"
                        >
                          {recipient.role}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {recipient?.detail ?? "No profile match"}
                    </span>
                    {recipient?.email ? (
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MailIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{recipient.email}</span>
                      </span>
                    ) : null}
                    {recipient?.phone ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PhoneIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {recipient.phone}
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <BellIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Delivery
                </h3>
                <dl className="rounded-lg border">
                  <DetailRow label="Channel">
                    <NotificationChannelBadge
                      channel={notification.channel}
                    />
                  </DetailRow>
                  <DetailRow label="Status">
                    <NotificationStatusBadge status={notification.status} />
                  </DetailRow>
                  <DetailRow label="Event">
                    <span className="text-right">
                      {notificationEventLabels[notification.event]}
                      <span className="block text-xs text-muted-foreground">
                        {notificationEventDescriptions[notification.event]}
                      </span>
                    </span>
                  </DetailRow>
                  <DetailRow label="Created">
                    {formatDateTime(notification.createdAt)}
                  </DetailRow>
                  <DetailRow label="Sent">
                    {notification.sentAt
                      ? formatDateTime(notification.sentAt)
                      : "Not sent"}
                  </DetailRow>
                  <DetailRow label="Read">
                    {notification.channel === "in_app"
                      ? notification.readAt
                        ? formatDateTime(notification.readAt)
                        : "Unread"
                      : "Not tracked for this channel"}
                  </DetailRow>
                  <DetailRow label="Event key">
                    <code className="block max-w-[16rem] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {notification.eventKey}
                    </code>
                  </DetailRow>
                  <DetailRow label="Reference">
                    <code className="block max-w-[16rem] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {notification.id}
                    </code>
                  </DetailRow>
                </dl>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  The event key prevents the same event from being delivered
                  twice on one channel.
                </p>
              </section>

              {Object.keys(notification.payload).length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <FileTextIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Payload
                  </h3>
                  <dl className="rounded-lg border">
                    {Object.entries(notification.payload).map(
                      ([key, value]) => (
                        <DetailRow key={key} label={formatPayloadLabel(key)}>
                          <span className="text-right break-words">{value}</span>
                        </DetailRow>
                      )
                    )}
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Payload values are sample data used to fill the template
                    placeholders. No personal data leaves this demo.
                  </p>
                </section>
              ) : null}

              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileTextIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Template
                </h3>
                {template ? (
                  <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {notificationEventLabels[template.event]} ·{" "}
                        {notificationChannelLabels[template.channel]}
                      </span>
                      <Badge
                        variant="outline"
                        className="rounded-full text-muted-foreground"
                      >
                        Preview
                      </Badge>
                    </div>
                    {template.subject ? (
                      <p className="text-sm font-medium">
                        {renderTemplateValues(
                          template.subject,
                          notification.payload
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        This channel does not use a subject line.
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {renderTemplateValues(
                        template.body,
                        notification.payload
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rendered with this notification&apos;s payload. Template
                      edits are local to the Templates tab.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 rounded-lg border border-dashed px-4 py-3 text-sm">
                    <span className="font-medium">No template configured</span>
                    <span className="text-xs text-muted-foreground">
                      There is no template for{" "}
                      {notificationEventLabels[notification.event]} on{" "}
                      {notificationChannelLabels[notification.channel]}. In-app
                      notifications still appear in the app; external channels
                      skip sending without a template.
                    </span>
                  </div>
                )}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  Read-only delivery log
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyValue(notification.id, "Notification reference")
                    }
                  >
                    <ClipboardCopyIcon data-icon="inline-start" />
                    Copy reference
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyValue(notification.eventKey, "Event key")
                    }
                  >
                    <ClipboardCopyIcon data-icon="inline-start" />
                    Copy event key
                  </Button>
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b px-4 py-2.5 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 justify-end text-right">{children}</dd>
    </div>
  )
}
