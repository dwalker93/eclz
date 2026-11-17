"use client"

import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FileTextIcon, PencilIcon, SearchIcon, XIcon } from "lucide-react"

import { NotificationChannelBadge } from "@/components/notifications/notification-badges"
import { TemplateEditDialog } from "@/components/notifications/template-edit-dialog"
import {
  notificationChannelFilterOptions,
  notificationChannelLabels,
  notificationEventDescriptions,
  notificationEventFilterOptions,
  notificationEventLabels,
  type NotificationChannel,
  type NotificationTemplateRecord,
} from "@/lib/notifications-data"
import { formatDateTime } from "@/lib/students-data"

type NotificationTemplatesProps = {
  templates: NotificationTemplateRecord[]
  enabledChannels: Record<NotificationChannel, boolean>
  onSave: (template: NotificationTemplateRecord) => void
  onNotify: (message: string) => void
}

export function NotificationTemplates({
  templates,
  enabledChannels,
  onSave,
  onNotify,
}: NotificationTemplatesProps) {
  const [search, setSearch] = useState("")
  const [eventFilter, setEventFilter] = useState("all")
  const [channelFilter, setChannelFilter] = useState("all")
  const [editingId, setEditingId] = useState<string | null>(null)

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return templates.filter((template) => {
      if (eventFilter !== "all" && template.event !== eventFilter) return false
      if (
        channelFilter !== "all" &&
        template.channel !== channelFilter
      ) {
        return false
      }
      if (query.length === 0) return true

      return [
        notificationEventLabels[template.event],
        notificationChannelLabels[template.channel],
        template.subject ?? "",
        template.body,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [channelFilter, eventFilter, query, templates])

  const editingTemplate =
    templates.find((template) => template.id === editingId) ?? null

  const hasActiveFilters =
    search.length > 0 || eventFilter !== "all" || channelFilter !== "all"

  function clearFilters() {
    setSearch("")
    setEventFilter("all")
    setChannelFilter("all")
  }

  function handleSave(template: NotificationTemplateRecord) {
    onSave(template)
    onNotify(
      `Template for ${notificationEventLabels[template.event]} · ${
        notificationChannelLabels[template.channel]
      } updated in local demo state. Nothing was saved or sent.`
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Notification templates
            </CardTitle>
            <CardDescription>
              {filtered.length} of {templates.length} templates · keyed by event
              and channel
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground">
            In-app templates always exist. Templates for disabled external
            channels are kept but not used.
          </p>
        </CardHeader>

        <div className="grid grid-cols-1 gap-2 border-b px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_auto]">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event, subject or body"
              aria-label="Search templates"
              className="pl-8"
            />
          </div>

          <Select
            items={notificationEventFilterOptions}
            value={eventFilter}
            onValueChange={(value) => setEventFilter(value ?? "all")}
          >
            <SelectTrigger className="w-full" aria-label="Filter by event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {notificationEventFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={notificationChannelFilterOptions}
            value={channelFilter}
            onValueChange={(value) => setChannelFilter(value ?? "all")}
          >
            <SelectTrigger className="w-full" aria-label="Filter by channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {notificationChannelFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            <XIcon data-icon="inline-start" />
            Clear
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileTextIcon className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">No templates match</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a different event or channel, or clear the filters. Missing
              external templates are skipped when that channel is used.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                  Event
                </TableHead>
                <TableHead className="text-muted-foreground">Channel</TableHead>
                <TableHead className="text-muted-foreground">Subject</TableHead>
                <TableHead className="hidden text-muted-foreground md:table-cell">
                  Updated
                </TableHead>
                <TableHead className="w-24 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((template) => {
                const channelOff =
                  template.channel !== "in_app" &&
                  !enabledChannels[template.channel]

                return (
                  <TableRow key={template.id} className="align-top">
                    <TableCell className="py-3 pl-4 sm:pl-6">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {notificationEventLabels[template.event]}
                        </span>
                        <span className="max-w-[22rem] truncate text-xs text-muted-foreground">
                          {notificationEventDescriptions[template.event]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <NotificationChannelBadge
                          channel={template.channel}
                        />
                        {channelOff ? (
                          <Badge
                            variant="outline"
                            className="rounded-full text-muted-foreground"
                          >
                            Off
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="max-w-[18rem] truncate text-sm">
                          {template.subject ?? "No subject"}
                        </span>
                        <span className="max-w-[22rem] truncate text-xs text-muted-foreground">
                          {template.body.replaceAll("\n", " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(template.updatedAt)}
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right sm:pr-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(template.id)}
                        aria-label={`Edit template for ${
                          notificationEventLabels[template.event]
                        } ${notificationChannelLabels[template.channel]}`}
                      >
                        <PencilIcon data-icon="inline-start" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
        <FileTextIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Templates are matched by event and notification channel. A missing
          template means the external channel is skipped; in-app notifications
          are still stored. Placeholder values come from the notification
          payload. Edits and previews are local to this browser session.
        </span>
      </div>

      <TemplateEditDialog
        template={editingTemplate}
        open={editingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        onSave={handleSave}
      />
    </div>
  )
}
