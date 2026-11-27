"use client"

import { useEffect, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  CircleDollarSignIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  FilterIcon,
  InfoIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchXIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  NotificationChannelBadge,
  NotificationDeliveryBadge,
} from "@/components/portal-status-badge"
import {
  PARENT_NOTIFICATION_EVENT_LABELS,
  parent,
  parentNotifications,
  type ParentChild,
  type ParentNotification,
  type ParentNotificationEvent,
} from "@/lib/parent-portal-data"
import {
  formatDateTime,
  formatDisplayDate,
  MOCK_TODAY,
  NOTIFICATION_CHANNEL_LABELS,
  portalModules,
  type NotificationChannel,
} from "@/lib/student-portal-data"

const eventIcons: Record<ParentNotificationEvent, LucideIcon> = {
  payment_submitted: CircleDollarSignIcon,
  payment_verified: BadgeCheckIcon,
  payment_rejected: CircleXIcon,
  receipt_issued: ReceiptTextIcon,
  installment_due: WalletCardsIcon,
  installment_overdue: TriangleAlertIcon,
  attendance_marked: ClipboardCheckIcon,
  class_reminder: CalendarClockIcon,
  exam_published: FileCheck2Icon,
  notice: MegaphoneIcon,
}

const channelOrder: NotificationChannel[] = ["in_app", "email", "sms", "push"]

function childName(childId: string | undefined, children: ParentChild[]) {
  if (!childId) return null

  return children.find((child) => child.id === childId)?.preferredName ?? null
}

export function ParentNotifications() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [notifications, setNotifications] = useState<ParentNotification[]>(
    () => parentNotifications
  )
  const [eventFilter, setEventFilter] = useState<
    ParentNotificationEvent | "all"
  >("all")
  const [channelFilter, setChannelFilter] = useState<
    NotificationChannel | "all"
  >("all")
  const [unreadOnly, setUnreadOnly] = useState(false)

  // The header selector changes the child without remounting this page, so the
  // filters reset to keep the notification context child-scoped.
  useEffect(() => {
    setEventFilter("all")
    setChannelFilter("all")
    setUnreadOnly(false)
  }, [selectedChild?.id])

  // Guardian-level notifications (no child) apply to every child; child
  // notifications appear only for the child they concern.
  const scopedNotifications = notifications.filter(
    (notification) =>
      !notification.childId || notification.childId === selectedChild?.id
  )

  const unreadCount = scopedNotifications.filter(
    (notification) => !notification.read
  ).length

  const hasFilters =
    eventFilter !== "all" || channelFilter !== "all" || unreadOnly

  const eventOptions = [
    { value: "all", label: "All events" },
    ...Array.from(new Set(scopedNotifications.map((n) => n.event)))
      .sort((first, second) =>
        PARENT_NOTIFICATION_EVENT_LABELS[first].localeCompare(
          PARENT_NOTIFICATION_EVENT_LABELS[second]
        )
      )
      .map((event) => ({
        value: event,
        label: PARENT_NOTIFICATION_EVENT_LABELS[event],
      })),
  ]

  const channelOptions = [
    { value: "all", label: "All channels" },
    ...channelOrder
      .filter((channel) =>
        scopedNotifications.some(
          (notification) => notification.channel === channel
        )
      )
      .map((channel) => ({
        value: channel,
        label: NOTIFICATION_CHANNEL_LABELS[channel],
      })),
  ]

  const visibleNotifications = scopedNotifications.filter((notification) => {
    if (eventFilter !== "all" && notification.event !== eventFilter) {
      return false
    }

    if (channelFilter !== "all" && notification.channel !== channelFilter) {
      return false
    }

    if (unreadOnly && notification.read) {
      return false
    }

    return true
  })

  function toggleRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: !notification.read }
          : notification
      )
    )
  }

  function markAllRead() {
    const scopedIds = new Set(
      scopedNotifications.map((notification) => notification.id)
    )

    setNotifications((current) =>
      current.map((notification) =>
        scopedIds.has(notification.id)
          ? { ...notification, read: true }
          : notification
      )
    )
  }

  function clearFilters() {
    setEventFilter("all")
    setChannelFilter("all")
    setUnreadOnly(false)
  }

  if (!selectedChild) {
    return (
      <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6">
          <PortalPageHeader
            title="Notifications"
            description="Updates about your guardian account and the children linked to it, with the event, child context, channel, status and time."
            meta={
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
            }
            actions={
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
            }
          />
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no notifications to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Notifications"
          description="Updates about your guardian account and the children linked to it. Each row shows the event, the child it concerns where there is one, the channel, the delivery status and the time. Read state is local to this preview."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Viewing {selectedChild.preferredName}
              </Badge>
              {unreadCount > 0 ? (
                <Badge variant="outline" className="gap-1.5 rounded-full">
                  {unreadCount} unread
                </Badge>
              ) : null}
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
                Mark all as read
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <UserRoundIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            {parent.fullName}
          </span>
          <span className="text-muted-foreground">Guardian</span>
          <span className="text-muted-foreground">
            Viewing {selectedChild.fullName} · {selectedChild.grade} ·{" "}
            {selectedChild.branch} branch
          </span>
          <Badge variant="outline" className="gap-1.5 rounded-full sm:ml-auto">
            Local demo only
          </Badge>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <FilterIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Filter notifications
            </CardTitle>
            <CardDescription>
              Filter by event, channel and whether you have read them. The
              header selector changes which child&apos;s notifications are
              shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] lg:items-end">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="parent-notifications-event-filter"
                className="text-xs font-medium text-muted-foreground"
              >
                Event
              </label>
              <Select
                items={eventOptions}
                value={eventFilter}
                onValueChange={(value) =>
                  setEventFilter(
                    (value ?? "all") as ParentNotificationEvent | "all"
                  )
                }
              >
                <SelectTrigger
                  id="parent-notifications-event-filter"
                  className="w-full"
                  aria-label="Filter notifications by event"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="parent-notifications-channel-filter"
                className="text-xs font-medium text-muted-foreground"
              >
                Channel
              </label>
              <Select
                items={channelOptions}
                value={channelFilter}
                onValueChange={(value) =>
                  setChannelFilter(
                    (value ?? "all") as NotificationChannel | "all"
                  )
                }
              >
                <SelectTrigger
                  id="parent-notifications-channel-filter"
                  className="w-full"
                  aria-label="Filter notifications by channel"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant={unreadOnly ? "default" : "outline"}
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((current) => !current)}
              className="w-full lg:w-auto"
            >
              <BellIcon data-icon="inline-start" aria-hidden="true" />
              Unread only
            </Button>

            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full lg:w-auto"
            >
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Clear
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <BellIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Notifications
              </CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread for ${selectedChild.preferredName}.`
                  : `You are up to date for ${selectedChild.preferredName}.`}
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              {visibleNotifications.length} shown
            </Badge>
          </CardHeader>

          {visibleNotifications.length === 0 ? (
            <EmptyState
              icon={<SearchXIcon className="size-5" aria-hidden="true" />}
              title="No notifications match this view"
              description="Try another event or channel, or turn off the unread-only filter. Clear the filters to see every notification."
            />
          ) : (
            <ul className="divide-y">
              {visibleNotifications.map((notification) => {
                const Icon = eventIcons[notification.event]
                const about = childName(notification.childId, linkedChildren)

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => toggleRead(notification.id)}
                      aria-pressed={!notification.read}
                      className="flex w-full gap-3 px-4 py-3.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          notification.read
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-sm",
                              notification.read
                                ? "font-medium"
                                : "font-semibold"
                            )}
                          >
                            {notification.title}
                          </span>
                          {!notification.read ? (
                            <span
                              className="size-1.5 rounded-full bg-primary"
                              aria-label="Unread notification"
                            />
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {notification.body}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full font-normal"
                          >
                            <Icon aria-hidden="true" />
                            {
                              PARENT_NOTIFICATION_EVENT_LABELS[
                                notification.event
                              ]
                            }
                          </Badge>
                          {about ? (
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full font-normal"
                            >
                              <UserRoundIcon aria-hidden="true" />
                              {about}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full font-normal text-muted-foreground"
                            >
                              <UsersRoundIcon aria-hidden="true" />
                              Guardian
                            </Badge>
                          )}
                          <NotificationChannelBadge
                            channel={notification.channel}
                          />
                          <NotificationDeliveryBadge
                            status={notification.status}
                          />
                          <span>{formatDateTime(notification.createdAt)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            In-app notifications are always available. In this demo email is{" "}
            {portalModules.email ? "enabled" : "disabled"}, SMS is{" "}
            {portalModules.sms ? "enabled" : "disabled"} and push is{" "}
            {portalModules.webPush ? "enabled" : "disabled"}. External channels
            depend on institute settings, and nothing is sent from this preview.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              These rows belong to your guardian account only — no other
              user&apos;s notifications are shown. Notifications about a
              specific child are tagged with that child; guardian-level rows
              apply to all your children. Read state here is local to the
              preview, and no provider error details are displayed.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
