"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@workspace/ui/components/pagination"
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
import {
  BellRingIcon,
  CircleAlertIcon,
  ClipboardCopyIcon,
  Clock3Icon,
  EllipsisVerticalIcon,
  EyeIcon,
  MailOpenIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "lucide-react"

import {
  NotificationChannelBadge,
  NotificationStatusBadge,
} from "@/components/notifications/notification-badges"
import { NotificationDetailSheet } from "@/components/notifications/notification-detail-sheet"
import { usePagination } from "@/hooks/use-pagination"
import {
  getNotificationRecipient,
  getNotificationSummary,
  notificationChannelFilterOptions,
  notificationChannelLabels,
  notificationEventFilterOptions,
  notificationEventLabels,
  notificationStatusFilterOptions,
  notifications,
  type NotificationTemplateRecord,
} from "@/lib/notifications-data"
import { formatDateTime, getInitials } from "@/lib/students-data"

const PAGE_SIZE = 10

type DeliveryLogProps = {
  templates: NotificationTemplateRecord[]
  onNotify: (message: string) => void
}

export function DeliveryLog({ templates, onNotify }: DeliveryLogProps) {
  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [eventFilter, setEventFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)

  const summary = getNotificationSummary(notifications)
  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (channelFilter !== "all" && item.channel !== channelFilter) return false
      if (statusFilter !== "all" && item.status !== statusFilter) return false
      if (eventFilter !== "all" && item.event !== eventFilter) return false
      if (query.length === 0) return true

      const recipient = getNotificationRecipient(item.recipientId)

      return [
        recipient?.fullName ?? "",
        recipient?.role ?? "",
        recipient?.detail ?? "",
        notificationEventLabels[item.event],
        notificationChannelLabels[item.channel],
        item.eventKey,
        item.error ?? "",
        ...Object.values(item.payload),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [channelFilter, eventFilter, query, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paged = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 ||
    channelFilter !== "all" ||
    statusFilter !== "all" ||
    eventFilter !== "all"

  function clearFilters() {
    setSearch("")
    setChannelFilter("all")
    setStatusFilter("all")
    setEventFilter("all")
    setPage(1)
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      onNotify(`${label} copied to the clipboard.`)
    } catch {
      onNotify(`${label}: ${value}`)
    }
  }

  const selectedNotification =
    notifications.find((item) => item.id === detailId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<BellRingIcon aria-hidden="true" />}
          value={summary.total}
          label="Deliveries"
          hint="Across all channels"
        />
        <SummaryCard
          icon={<Clock3Icon aria-hidden="true" />}
          value={summary.queued}
          label="Queued"
          hint="Waiting in the demo queue"
        />
        <SummaryCard
          icon={<CircleAlertIcon aria-hidden="true" />}
          value={summary.failed}
          label="Failed"
          hint="Kept for reference"
        />
        <SummaryCard
          icon={<MailOpenIcon aria-hidden="true" />}
          value={summary.unreadInApp}
          label="Unread in-app"
          hint="Read state is per user"
        />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="flex items-center gap-2">
              <SendIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Delivery log
            </CardTitle>
            <CardDescription>
              {filtered.length} of {notifications.length} notifications ·
              read-only demo history
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground">
            Queued, sent and failed rows are sample data. Nothing is retried or
            sent from this screen.
          </p>
        </CardHeader>

        <div className="grid grid-cols-1 gap-2 border-b px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_12rem_auto]">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search recipient, event, key or payload"
              aria-label="Search notifications"
              className="pl-8"
            />
          </div>

          <Select
            items={notificationChannelFilterOptions}
            value={channelFilter}
            onValueChange={(value) => {
              setChannelFilter(value ?? "all")
              setPage(1)
            }}
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

          <Select
            items={notificationStatusFilterOptions}
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {notificationStatusFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={notificationEventFilterOptions}
            value={eventFilter}
            onValueChange={(value) => {
              setEventFilter(value ?? "all")
              setPage(1)
            }}
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
              <SearchIcon className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">No notifications match</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try another recipient, event or channel, or clear the filters.
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
                  Recipient
                </TableHead>
                <TableHead className="text-muted-foreground">Event</TableHead>
                <TableHead className="text-muted-foreground">Channel</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="hidden text-muted-foreground md:table-cell">
                  Created
                </TableHead>
                <TableHead className="hidden text-muted-foreground xl:table-cell">
                  Sent / read
                </TableHead>
                <TableHead className="hidden max-w-[12rem] text-muted-foreground lg:table-cell">
                  Failure
                </TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item) => {
                const recipient = getNotificationRecipient(item.recipientId)

                return (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="py-3 pl-4 sm:pl-6">
                      <button
                        type="button"
                        onClick={() => setDetailId(item.id)}
                        className="flex items-start gap-2.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={`Open delivery ${item.id} for ${recipient?.fullName ?? "unknown recipient"}`}
                      >
                        <Avatar className="mt-0.5 size-8">
                          <AvatarFallback className="text-[11px]">
                            {recipient
                              ? getInitials(recipient.fullName)
                              : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">
                            {recipient?.fullName ?? "Unknown recipient"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {recipient
                              ? `${recipient.role} · ${recipient.detail}`
                              : "No profile match"}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm">
                          {notificationEventLabels[item.event]}
                        </span>
                        <code className="max-w-[14rem] truncate text-xs text-muted-foreground">
                          {item.eventKey}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <NotificationChannelBadge channel={item.channel} />
                    </TableCell>
                    <TableCell className="py-3">
                      <NotificationStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="hidden py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="hidden py-3 text-muted-foreground xl:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {item.sentAt ? (
                          <span>Sent {formatDateTime(item.sentAt)}</span>
                        ) : (
                          <span>Not sent</span>
                        )}
                        {item.channel === "in_app" ? (
                          <span className="text-xs">
                            {item.readAt
                              ? `Read ${formatDateTime(item.readAt)}`
                              : "Unread"}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[12rem] py-3 lg:table-cell">
                      {item.error ? (
                        <span
                          className="block truncate text-xs text-destructive"
                          title={item.error}
                        >
                          {item.error}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right sm:pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for notification ${item.id}`}
                            />
                          }
                        >
                          <EllipsisVerticalIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>{item.id}</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setDetailId(item.id)}
                            >
                              <EyeIcon aria-hidden="true" />
                              View delivery
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                copyValue(item.id, "Notification reference")
                              }
                            >
                              <ClipboardCopyIcon aria-hidden="true" />
                              Copy reference
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                copyValue(item.eventKey, "Event key")
                              }
                            >
                              <ClipboardCopyIcon aria-hidden="true" />
                              Copy event key
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          {item.status === "failed" ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  onNotify(
                                    "Failed deliveries are kept for reference. This demo does not retry or resend notifications."
                                  )
                                }
                              >
                                <CircleAlertIcon aria-hidden="true" />
                                Retry is not available
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col-reverse items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row sm:px-6">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing{" "}
            <span className="tabular-nums">
              {filtered.length === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + PAGE_SIZE, filtered.length)}
            </span>{" "}
            of <span className="tabular-nums">{filtered.length}</span>{" "}
            notifications
          </p>

          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                >
                  Previous
                </Button>
              </PaginationItem>

              {showLeftEllipsis ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}

              {pages.map((pageNumber) => {
                const isActive = pageNumber === currentPage

                return (
                  <PaginationItem key={pageNumber}>
                    <Button
                      variant={isActive ? "outline" : "ghost"}
                      size="icon-sm"
                      onClick={() => setPage(pageNumber)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={`Go to page ${pageNumber}`}
                      className="tabular-nums"
                    >
                      {pageNumber}
                    </Button>
                  </PaginationItem>
                )
              })}

              {showRightEllipsis ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}

              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Go to next page"
                >
                  Next
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </Card>

      <Card className="gap-0 py-0">
        <CardContent className="flex items-start gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <CircleAlertIcon
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            Historical rows stay after a channel is switched off. Disabled
            channels do not create new rows or send attempts. Read state is only
            tracked for in-app notifications.
          </span>
        </CardContent>
      </Card>

      <NotificationDetailSheet
        notification={selectedNotification ?? null}
        open={selectedNotification !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        templates={templates}
        onNotify={onNotify}
      />
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
