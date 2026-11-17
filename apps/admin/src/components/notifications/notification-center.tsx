"use client"

import { useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  BellRingIcon,
  FileTextIcon,
  InfoIcon,
  SendIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"

import { DeliveryLog } from "@/components/notifications/delivery-log"
import { NotificationConfiguration } from "@/components/notifications/notification-configuration"
import { NotificationTemplates } from "@/components/notifications/notification-templates"
import { notificationChannelConnections } from "@/lib/integrations-data"
import {
  notificationTemplates,
  notifications,
  type NotificationChannel,
  type NotificationTemplateRecord,
} from "@/lib/notifications-data"

type NotificationsTab = "delivery" | "configuration" | "templates"

const tabOrder: NotificationsTab[] = ["delivery", "configuration", "templates"]

const tabLabels: Record<NotificationsTab, string> = {
  delivery: "Delivery log",
  configuration: "Configuration",
  templates: "Templates",
}

const tabIcons: Record<NotificationsTab, ReactNode> = {
  delivery: <SendIcon aria-hidden="true" />,
  configuration: <SlidersHorizontalIcon aria-hidden="true" />,
  templates: <FileTextIcon aria-hidden="true" />,
}

function initialEnabledChannels(): Record<NotificationChannel, boolean> {
  return notificationChannelConnections.reduce(
    (accumulator, connection) => {
      accumulator[connection.channel as NotificationChannel] =
        connection.channelEnabled
      return accumulator
    },
    {} as Record<NotificationChannel, boolean>
  )
}

export function NotificationCenter() {
  const [activeTab, setActiveTab] = useState<NotificationsTab>("delivery")
  const [notice, setNotice] = useState<string | null>(null)
  const [enabledChannels, setEnabledChannels] = useState<
    Record<NotificationChannel, boolean>
  >(initialEnabledChannels)
  const [templates, setTemplates] = useState<NotificationTemplateRecord[]>(() =>
    notificationTemplates.map((template) => ({ ...template }))
  )

  function countFor(tab: NotificationsTab) {
    if (tab === "delivery") return notifications.length
    if (tab === "configuration")
      return Object.values(enabledChannels).filter(Boolean).length
    return templates.length
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabOrder.indexOf(activeTab)
    let nextIndex = currentIndex

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      nextIndex = (currentIndex + 1) % tabOrder.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length
    } else if (event.key === "Home") {
      event.preventDefault()
      nextIndex = 0
    } else if (event.key === "End") {
      event.preventDefault()
      nextIndex = tabOrder.length - 1
    } else {
      return
    }

    const nextTab = tabOrder[nextIndex]
    if (!nextTab) return

    setActiveTab(nextTab)
    document.getElementById(`ntf-tab-${nextTab}`)?.focus()
  }

  function handleToggleChannel(channel: NotificationChannel, enabled: boolean) {
    if (channel === "in_app") return

    setEnabledChannels((previous) => ({ ...previous, [channel]: enabled }))
  }

  function handleSaveTemplate(template: NotificationTemplateRecord) {
    setTemplates((previous) =>
      previous.map((item) => (item.id === template.id ? template : item))
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Notifications
              <Badge variant="outline" className="rounded-full">
                <BellRingIcon aria-hidden="true" />
                Delivery &amp; channels
              </Badge>
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              A read-only delivery log plus the channel and template setup behind
              it, built from <code>notification</code>,{" "}
              <code>notification_channel</code>,{" "}
              <code>notification_template</code> and{" "}
              <code>push_subscription</code>. Sample data only — nothing is
              queued, retried or sent, and settings stay in this browser session.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setNotice(
                "This screen never triggers a send. Delivery rows, channel switches and template edits are local demo data."
              )
            }
          >
            <InfoIcon data-icon="inline-start" />
            How this demo works
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

        <div
          role="tablist"
          aria-label="Notification sections"
          onKeyDown={handleTabKeyDown}
          className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {tabOrder.map((tab) => (
            <TabButton
              key={tab}
              id={`ntf-tab-${tab}`}
              controls="ntf-panel"
              isActive={activeTab === tab}
              icon={tabIcons[tab]}
              label={tabLabels[tab]}
              count={countFor(tab)}
              onClick={() => setActiveTab(tab)}
            />
          ))}
        </div>

        <div
          id="ntf-panel"
          role="tabpanel"
          aria-labelledby={`ntf-tab-${activeTab}`}
          tabIndex={0}
          className="flex flex-col gap-4 focus-visible:outline-none"
        >
          {activeTab === "delivery" ? (
            <DeliveryLog templates={templates} onNotify={setNotice} />
          ) : activeTab === "configuration" ? (
            <NotificationConfiguration
              enabledChannels={enabledChannels}
              onToggleChannel={handleToggleChannel}
              onNotify={setNotice}
            />
          ) : (
            <NotificationTemplates
              templates={templates}
              enabledChannels={enabledChannels}
              onSave={handleSaveTemplate}
              onNotify={setNotice}
            />
          )}
        </div>
      </div>
    </main>
  )
}

function TabButton({
  id,
  controls,
  isActive,
  icon,
  label,
  count,
  onClick,
}: {
  id: string
  controls: string
  isActive: boolean
  icon: ReactNode
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={controls}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      className={
        isActive
          ? "inline-flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>svg]:size-4"
          : "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>svg]:size-4"
      }
    >
      {icon}
      {label}
      <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
        {count}
      </span>
    </button>
  )
}
