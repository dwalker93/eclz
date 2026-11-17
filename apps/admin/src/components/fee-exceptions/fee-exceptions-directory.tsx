"use client"

import { useEffect, useMemo, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { Skeleton } from "@workspace/ui/components/skeleton"
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
  BadgeCheckIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  InfoIcon,
  PercentIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  RepeatIcon,
  SearchIcon,
  SquarePenIcon,
  StopCircleIcon,
  XIcon,
} from "lucide-react"

import { FeeExceptionDetailSheet } from "@/components/fee-exceptions/fee-exception-detail-sheet"
import { FeeExceptionFormDialog } from "@/components/fee-exceptions/fee-exception-form-dialog"
import {
  FeeExceptionKindBadge,
  FeeExceptionStatusBadge,
} from "@/components/fee-exceptions/fee-exception-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  FEE_EXCEPTIONS_MODULE_MOCK,
  feeExceptionCourseFilterOptions,
  feeExceptionKindFilterOptions,
  feeExceptionStatusLabels,
  feeExceptions,
  formatExceptionEffect,
  getFeeExceptionUsageCounts,
  type FeeExceptionRecord,
  type FeeExceptionStatus,
} from "@/lib/fee-exceptions-data"
import { formatDisplayDate } from "@/lib/students-data"

const PAGE_SIZE = 8

const statusOrder: FeeExceptionStatus[] = ["active", "scheduled", "ended"]

const statusIcons: Record<FeeExceptionStatus, ReactNode> = {
  active: <BadgeCheckIcon aria-hidden="true" />,
  scheduled: <CalendarClockIcon aria-hidden="true" />,
  ended: <StopCircleIcon aria-hidden="true" />,
}

export function FeeExceptionsDirectory() {
  const [moduleEnabled, setModuleEnabled] = useState(
    FEE_EXCEPTIONS_MODULE_MOCK.enabled
  )
  const [activeTab, setActiveTab] = useState<FeeExceptionStatus>("active")
  const [search, setSearch] = useState("")
  const [courseFilter, setCourseFilter] = useState("all")
  const [kindFilter, setKindFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingException, setEditingException] =
    useState<FeeExceptionRecord | null>(null)
  const [selectedException, setSelectedException] =
    useState<FeeExceptionRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, courseFilter, kindFilter, activeTab])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Exceptions refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const usage = getFeeExceptionUsageCounts()

  const filteredExceptions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return feeExceptions.filter((exception) => {
      const matchesTab = exception.status === activeTab
      const matchesSearch =
        query.length === 0 ||
        [
          exception.studentName,
          exception.studentNo,
          exception.courseName,
          exception.reason,
        ].some((value) => value.toLowerCase().includes(query))

      const matchesCourse =
        courseFilter === "all" || exception.courseId === courseFilter
      const matchesKind =
        kindFilter === "all" || exception.kind === kindFilter

      return matchesTab && matchesSearch && matchesCourse && matchesKind
    })
  }, [activeTab, search, courseFilter, kindFilter])

  const totalPages = Math.max(1, Math.ceil(filteredExceptions.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleExceptions = filteredExceptions.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 || courseFilter !== "all" || kindFilter !== "all"

  function clearFilters() {
    setSearch("")
    setCourseFilter("all")
    setKindFilter("all")
  }

  function openCreate() {
    setEditingException(null)
    setFormOpen(true)
  }

  function openEdit(exception: FeeExceptionRecord) {
    setEditingException(exception)
    setDetailOpen(false)
    setFormOpen(true)
  }

  function openDetail(exception: FeeExceptionRecord) {
    setSelectedException(exception)
    setDetailOpen(true)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

    event.preventDefault()
    const currentIndex = statusOrder.indexOf(activeTab)
    const direction = event.key === "ArrowRight" ? 1 : -1
    const nextIndex =
      (currentIndex + direction + statusOrder.length) % statusOrder.length
    const nextTab = statusOrder[nextIndex] ?? activeTab

    setActiveTab(nextTab)
    document.getElementById(`fex-tab-${nextTab}`)?.focus()
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Fee Exceptions
              <Badge variant="outline" className="rounded-full">
                <PercentIcon aria-hidden="true" />
                Optional module
              </Badge>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Discounts and alternate fee options attached to a student&apos;s
              enrollment. All records on this page are sample data and nothing
              is recalculated.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setNotice(
                  "Export is a placeholder in this UI demo. No file was generated."
                )
              }
            >
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
            <Button onClick={openCreate} disabled={!moduleEnabled}>
              <PlusIcon data-icon="inline-start" />
              Add exception
            </Button>
          </div>
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

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <PowerIcon className="size-4" aria-hidden="true" />
                {FEE_EXCEPTIONS_MODULE_MOCK.label}
              </CardTitle>
              <CardDescription>
                {FEE_EXCEPTIONS_MODULE_MOCK.hint}
              </CardDescription>
            </div>
            <Switch
              checked={moduleEnabled}
              onCheckedChange={(checked) => {
                setModuleEnabled(checked)
                setNotice(
                  checked
                    ? "Module switched on in this preview. Existing exceptions still apply either way."
                    : "Module switched off in this preview. Existing active exceptions keep applying — records are not deleted."
                )
              }}
              aria-label="Enable the fee exceptions module"
            />
          </CardHeader>
        </Card>

        {!moduleEnabled ? (
          <Card className="py-0">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <PercentIcon className="size-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">
                  Fee exceptions module is off
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  This optional module is disabled. Existing active exceptions
                  still apply to billing — switching the module off only hides
                  this screen and keeps all records.
                </p>
              </div>
              <Button variant="outline" onClick={() => setModuleEnabled(true)}>
                <PowerIcon data-icon="inline-start" />
                Enable module (demo)
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {isRefreshing ? null : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard
                  icon={<BadgeCheckIcon aria-hidden="true" />}
                  value={usage.active}
                  label="Active"
                  hint="Apply right now to enrollments"
                />
                <SummaryCard
                  icon={<RepeatIcon aria-hidden="true" />}
                  value={usage.alternates}
                  label="Alternate options"
                  hint="Alternate fee structures"
                />
                <SummaryCard
                  icon={<PercentIcon aria-hidden="true" />}
                  value={usage.discounts}
                  label="Discounts"
                  hint="Percent or fixed amounts"
                />
                <SummaryCard
                  icon={<CalendarClockIcon aria-hidden="true" />}
                  value={usage.scheduled + usage.ended}
                  label="Scheduled / ended"
                  hint="Not currently applying"
                />
              </div>
            )}

            <div
              role="tablist"
              aria-label="Fee exception status"
              onKeyDown={handleTabKeyDown}
              className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/40 p-1"
            >
              {statusOrder.map((status) => (
                <TabButton
                  key={status}
                  id={`fex-tab-${status}`}
                  controls="fex-panel"
                  isActive={activeTab === status}
                  icon={statusIcons[status]}
                  label={`${feeExceptionStatusLabels[status]} ${
                    status === "active" ? "now" : ""
                  }`.trim()}
                  count={usage[status]}
                  onClick={() => setActiveTab(status)}
                />
              ))}
            </div>

            <Card
              id="fex-panel"
              role="tabpanel"
              aria-labelledby={`fex-tab-${activeTab}`}
              tabIndex={0}
              className="gap-0 py-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <CardTitle>{feeExceptionStatusLabels[activeTab]} exceptions</CardTitle>
                  <CardDescription>
                    {filteredExceptions.length}{" "}
                    {filteredExceptions.length === 1
                      ? "exception"
                      : "exceptions"}{" "}
                    match the current filters.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRefreshing(true)}
                  disabled={isRefreshing}
                >
                  <RefreshCwIcon
                    data-icon="inline-start"
                    className={isRefreshing ? "animate-spin" : undefined}
                  />
                  {isRefreshing ? "Refreshing" : "Refresh"}
                </Button>
              </CardHeader>

              <div className="border-b px-4 py-3 sm:px-6">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="relative lg:col-span-2">
                    <SearchIcon
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search students, courses or reasons"
                      aria-label="Search fee exceptions"
                      className="pl-8"
                    />
                  </div>

                  <Select
                    items={feeExceptionCourseFilterOptions}
                    value={courseFilter}
                    onValueChange={(value) => setCourseFilter(value ?? "all")}
                  >
                    <SelectTrigger className="w-full" aria-label="Filter by course">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {feeExceptionCourseFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Select
                      items={feeExceptionKindFilterOptions}
                      value={kindFilter}
                      onValueChange={(value) => setKindFilter(value ?? "all")}
                    >
                      <SelectTrigger className="w-full" aria-label="Filter by kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {feeExceptionKindFilterOptions.map((option) => (
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
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                      Student
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Enrollment / course
                    </TableHead>
                    <TableHead className="text-muted-foreground">Kind</TableHead>
                    <TableHead className="text-muted-foreground">
                      Amount / type
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Effective dates
                    </TableHead>
                    <TableHead className="text-muted-foreground">Reason</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="w-12 pr-4 text-right sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRefreshing ? (
                    <ExceptionTableSkeleton />
                  ) : visibleExceptions.length > 0 ? (
                    visibleExceptions.map((exception) => (
                      <TableRow key={exception.id}>
                        <TableCell className="py-3 pl-4 sm:pl-6">
                          <button
                            type="button"
                            onClick={() => openDetail(exception)}
                            className="flex flex-col text-left focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <span className="font-medium text-card-foreground hover:underline">
                              {exception.studentName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {exception.studentNo}
                            </span>
                          </button>
                        </TableCell>

                        <TableCell>
                          <div className="flex max-w-[240px] flex-col">
                            <span className="truncate">
                              {exception.courseName}
                            </span>
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {exception.enrollmentId} · {exception.branchName}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <FeeExceptionKindBadge kind={exception.kind} />
                        </TableCell>

                        <TableCell>
                          <span className="text-sm">
                            {formatExceptionEffect(exception)}
                          </span>
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{formatDisplayDate(exception.effectiveFrom)}</span>
                            <span className="text-xs">
                              to{" "}
                              {exception.effectiveTo
                                ? formatDisplayDate(exception.effectiveTo)
                                : "open-ended"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span
                            className="line-clamp-2 max-w-[220px] text-sm text-muted-foreground"
                            title={exception.reason}
                          >
                            {exception.reason}
                          </span>
                        </TableCell>

                        <TableCell>
                          <FeeExceptionStatusBadge status={exception.status} />
                        </TableCell>

                        <TableCell className="pr-4 text-right sm:pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${exception.studentName}`}
                                />
                              }
                            >
                              <EllipsisVerticalIcon
                                className="size-4"
                                aria-hidden="true"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="truncate">
                                {exception.studentName}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openDetail(exception)}
                              >
                                <InfoIcon aria-hidden="true" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEdit(exception)}
                              >
                                <SquarePenIcon aria-hidden="true" />
                                Edit (demo)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled
                                title="End an exception from its detail view"
                              >
                                <StopCircleIcon aria-hidden="true" />
                                End exception
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <PercentIcon className="size-5" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">
                              No {feeExceptionStatusLabels[activeTab].toLowerCase()} exceptions
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try a different search term, course or kind.
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
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {filteredExceptions.length > 0 ? (
                    <>
                      Showing{" "}
                      <span className="tabular-nums">
                        {startIndex + 1}–
                        {Math.min(
                          startIndex + PAGE_SIZE,
                          filteredExceptions.length
                        )}
                      </span>{" "}
                      of <span className="tabular-nums">{filteredExceptions.length}</span>{" "}
                      exceptions
                    </>
                  ) : (
                    "No exceptions to show"
                  )}
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
                        <ChevronLeftIcon aria-hidden="true" />
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
                        <ChevronRightIcon aria-hidden="true" />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </Card>

            <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Exceptions attach to an enrollment, and an alternate fee option
                must belong to the same course. Existing active exceptions keep
                applying if the module is switched off. Resulting amounts are
                illustrative only; nothing on this page is saved or
                recalculated.
              </span>
            </div>
          </>
        )}
      </div>

      <FeeExceptionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        exception={editingException}
        onSaved={(message) => setNotice(message)}
      />

      <FeeExceptionDetailSheet
        exception={selectedException}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onNotice={(message) => setNotice(message)}
        onEdit={openEdit}
      />
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

function ExceptionTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-32 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
