"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

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
  CalendarIcon,
  CpuIcon,
  EyeIcon,
  FingerprintIcon,
  InfoIcon,
  LayersIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SearchIcon,
  UserRoundIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { AuditDetailSheet } from "@/components/audit-log/audit-detail-sheet"
import { usePagination } from "@/hooks/use-pagination"
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_ACTOR_OPTIONS,
  AUDIT_ENTITY_TYPE_OPTIONS,
  auditRecords as auditSeeds,
  getAuditSummary,
  getEntityTypeLabel,
  type AuditRecord,
} from "@/lib/audit-log-data"
import { MOCK_TODAY, formatDateTime } from "@/lib/students-data"

const PAGE_SIZE = 10

const rangeOptions = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
]

function shiftDate(date: string, days: number) {
  const base = new Date(`${date}T12:00:00+05:30`)
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export function AuditLogDirectory() {
  const [search, setSearch] = useState("")
  const [actorFilter, setActorFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityTypeFilter, setEntityTypeFilter] = useState("all")
  const [rangePreset, setRangePreset] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)

  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Audit records refreshed from local mock data. The register is append-only and nothing was changed."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const records = useMemo(
    () =>
      [...auditSeeds].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    []
  )

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (actorFilter === "system") {
        if (!record.actor.isSystem) return false
      } else if (actorFilter !== "all" && record.actor.userId !== actorFilter) {
        return false
      }

      if (actionFilter !== "all" && record.action !== actionFilter) return false
      if (
        entityTypeFilter !== "all" &&
        record.entityType !== entityTypeFilter
      ) {
        return false
      }

      const day = record.at.slice(0, 10)
      if (fromDate && day < fromDate) return false
      if (toDate && day > toDate) return false

      if (query.length === 0) return true

      return [
        record.actor.name,
        record.action,
        record.entityType,
        record.entityId,
        record.entityLabel,
        record.reason ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [
    records,
    query,
    actorFilter,
    actionFilter,
    entityTypeFilter,
    fromDate,
    toDate,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pagedRecords = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const summary = getAuditSummary(records)
  const detailRecord = detailRecordId
    ? (records.find((record) => record.id === detailRecordId) ?? null)
    : null

  const hasActiveFilters =
    search.length > 0 ||
    actorFilter !== "all" ||
    actionFilter !== "all" ||
    entityTypeFilter !== "all" ||
    rangePreset !== "all" ||
    fromDate.length > 0 ||
    toDate.length > 0

  function applyRange(preset: string) {
    setRangePreset(preset)
    setPage(1)

    if (preset === "today") {
      setFromDate(MOCK_TODAY)
      setToDate(MOCK_TODAY)
      return
    }
    if (preset === "7d") {
      setFromDate(shiftDate(MOCK_TODAY, -6))
      setToDate(MOCK_TODAY)
      return
    }
    if (preset === "30d") {
      setFromDate(shiftDate(MOCK_TODAY, -29))
      setToDate(MOCK_TODAY)
      return
    }

    setFromDate("")
    setToDate("")
  }

  function clearFilters() {
    setSearch("")
    setActorFilter("all")
    setActionFilter("all")
    setEntityTypeFilter("all")
    setRangePreset("all")
    setFromDate("")
    setToDate("")
    setPage(1)
  }

  function openDetail(record: AuditRecord) {
    setDetailRecordId(record.id)
    setDetailOpen(true)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Audit Log
              <Badge variant="outline" className="rounded-full">
                <ScrollTextIcon aria-hidden="true" />
                Append-only
              </Badge>
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Read-only register built from <code>audit_log</code>. Every change
              records its actor, action, entity, reason and before/after data.
              Records cannot be edited or deleted, and nothing on this page is
              saved.
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
            icon={<ScrollTextIcon aria-hidden="true" />}
            value={summary.total}
            label="Records"
            hint="Newest first"
          />
          <SummaryCard
            icon={<UsersIcon aria-hidden="true" />}
            value={summary.actors}
            label="Actors"
            hint={`${summary.system} by System`}
          />
          <SummaryCard
            icon={<UserRoundIcon aria-hidden="true" />}
            value={summary.total - summary.system}
            label="User actions"
            hint="Signed-in staff"
          />
          <SummaryCard
            icon={<LayersIcon aria-hidden="true" />}
            value={summary.entityTypes}
            label="Entity types"
            hint="Students, finance, admin"
          />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <FingerprintIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Register
              </CardTitle>
              <CardDescription>
                {filtered.length} of {records.length}{" "}
                {records.length === 1 ? "record" : "records"}
              </CardDescription>
            </div>
          </CardHeader>

          <div className="border-b px-4 py-3 sm:px-6">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative lg:col-span-2">
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
                  placeholder="Search actor, action, entity or reason"
                  aria-label="Search audit records"
                  className="pl-8"
                />
              </div>

              <Select
                items={rangeOptions}
                value={rangePreset}
                onValueChange={(value) => applyRange(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by date range"
                >
                  <CalendarIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-1">
                <Input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    setRangePreset("all")
                    setPage(1)
                  }}
                  aria-label="From date"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value)
                    setRangePreset("all")
                    setPage(1)
                  }}
                  aria-label="To date"
                />
              </div>

              <div className="flex items-center">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  <XIcon data-icon="inline-start" />
                  Clear filters
                </Button>
              </div>

              <Select
                items={AUDIT_ACTOR_OPTIONS}
                value={actorFilter}
                onValueChange={(value) => {
                  setActorFilter(value ?? "all")
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full" aria-label="Filter by actor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_ACTOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={AUDIT_ACTION_OPTIONS}
                value={actionFilter}
                onValueChange={(value) => {
                  setActionFilter(value ?? "all")
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full" aria-label="Filter by action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={AUDIT_ENTITY_TYPE_OPTIONS}
                value={entityTypeFilter}
                onValueChange={(value) => {
                  setEntityTypeFilter(value ?? "all")
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by entity type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_ENTITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isRefreshing ? (
            <AuditSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ScrollTextIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No records match</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different search term, date range, actor, action or
                  entity type.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                      Timestamp
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Actor
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Action
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Entity
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Reason
                    </TableHead>
                    <TableHead className="w-12 pr-4 text-right sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(record)}
                    >
                      <TableCell className="py-3 pl-4 whitespace-nowrap text-muted-foreground sm:pl-6">
                        {formatDateTime(record.at)}
                      </TableCell>
                      <TableCell>
                        {record.actor.isSystem ? (
                          <Badge variant="secondary" className="rounded-full">
                            <CpuIcon data-icon="inline-start" />
                            System
                          </Badge>
                        ) : (
                          <span className="text-sm">{record.actor.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {record.action}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{record.entityLabel}</span>
                          <span className="text-xs text-muted-foreground">
                            {getEntityTypeLabel(record.entityType)} ·{" "}
                            {record.entityId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                        {record.reason ?? "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-6">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`View details for ${record.action}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openDetail(record)
                          }}
                        >
                          <EyeIcon className="size-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filtered.length)}
                  </span>{" "}
                  of <span className="tabular-nums">{filtered.length}</span>{" "}
                  records
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
            </>
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Update, delete and truncate are blocked on this register. Select a
              row to read the before and after data. Passwords, signing keys,
              card numbers and NIC values are never shown.
            </span>
          </div>
        </Card>
      </div>

      <AuditDetailSheet
        record={detailRecord}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailRecordId(null)
        }}
        onNotice={setNotice}
      />
    </main>
  )
}

function AuditSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="ml-auto h-3.5 w-24" />
        </div>
      ))}
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
