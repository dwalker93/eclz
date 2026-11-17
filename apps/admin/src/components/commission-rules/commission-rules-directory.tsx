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
  ChevronLeftIcon,
  ChevronRightIcon,
  CoinsIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  InfoIcon,
  PercentIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  ScaleIcon,
  SearchIcon,
  SquarePenIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import {
  CommissionCalcTypeBadge,
  CommissionScopeBadge,
  CommissionStatusBadge,
} from "@/components/commission-rules/commission-rule-badge"
import { CommissionRuleDetailSheet } from "@/components/commission-rules/commission-rule-detail-sheet"
import { CommissionRuleFormDialog } from "@/components/commission-rules/commission-rule-form-dialog"
import { usePagination } from "@/hooks/use-pagination"
import {
  commissionBasisHints,
  commissionBasisLabels,
  commissionBasisMock,
  commissionRuleCalcTypeFilterOptions,
  commissionRuleLecturerFilterOptions,
  commissionRuleScopeFilterOptions,
  commissionRuleStatusFilterOptions,
  commissionRules,
  commissionRulesModuleMock,
  findOverlappingRules,
  formatCommissionPeriod,
  formatCommissionRateShort,
  getCommissionRuleStatus,
  getCommissionScope,
  getCommissionRuleUsageCounts,
  type CommissionRuleRecord,
} from "@/lib/commissions-data"

const PAGE_SIZE = 8

export function CommissionRulesDirectory() {
  const [moduleEnabled, setModuleEnabled] = useState(
    commissionRulesModuleMock.enabled
  )
  const [search, setSearch] = useState("")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [scopeFilter, setScopeFilter] = useState("all")
  const [calcTypeFilter, setCalcTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CommissionRuleRecord | null>(
    null
  )
  const [selectedRule, setSelectedRule] = useState<CommissionRuleRecord | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, lecturerFilter, scopeFilter, calcTypeFilter, statusFilter])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Commission rules refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const usage = getCommissionRuleUsageCounts()

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase()

    return commissionRules.filter((rule) => {
      const scope = getCommissionScope(rule)
      const matchesSearch =
        query.length === 0 ||
        [
          rule.lecturerName,
          scope.detail,
          scope.label,
          formatCommissionRateShort(rule),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesLecturer =
        lecturerFilter === "all" || rule.lecturerId === lecturerFilter
      const matchesScope =
        scopeFilter === "all" || scope.kind === scopeFilter
      const matchesCalcType =
        calcTypeFilter === "all" || rule.calcType === calcTypeFilter
      const matchesStatus =
        statusFilter === "all" ||
        getCommissionRuleStatus(rule) === statusFilter

      return (
        matchesSearch &&
        matchesLecturer &&
        matchesScope &&
        matchesCalcType &&
        matchesStatus
      )
    })
  }, [
    search,
    lecturerFilter,
    scopeFilter,
    calcTypeFilter,
    statusFilter,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleRules = filteredRules.slice(startIndex, startIndex + PAGE_SIZE)

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 ||
    lecturerFilter !== "all" ||
    scopeFilter !== "all" ||
    calcTypeFilter !== "all" ||
    statusFilter !== "all"

  function clearFilters() {
    setSearch("")
    setLecturerFilter("all")
    setScopeFilter("all")
    setCalcTypeFilter("all")
    setStatusFilter("all")
  }

  function openCreate() {
    setEditingRule(null)
    setFormOpen(true)
  }

  function openEdit(rule: CommissionRuleRecord) {
    setEditingRule(rule)
    setDetailOpen(false)
    setFormOpen(true)
  }

  function openDetail(rule: CommissionRuleRecord) {
    setSelectedRule(rule)
    setDetailOpen(true)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Commission Rules
              <Badge variant="outline" className="rounded-full">
                <ScaleIcon aria-hidden="true" />
                Optional module
              </Badge>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              What the institute keeps from each lecturer&apos;s fees, resolved by
              specificity. Rates are illustrative sample values and nothing is
              accrued or paid on this page.
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
              Add rule
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
                {commissionRulesModuleMock.label}
              </CardTitle>
              <CardDescription>{commissionRulesModuleMock.hint}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="rounded-full">
                Organization fixture:{" "}
                {commissionRulesModuleMock.organizationEnabled
                  ? "on"
                  : "off"}
              </Badge>
              <Switch
                checked={moduleEnabled}
                onCheckedChange={(checked) => {
                  setModuleEnabled(checked)
                  setNotice(
                    checked
                      ? "Commissions module switched on in this preview. Rules and payouts are available."
                      : "Commissions module switched off in this preview. The screens are hidden, but no rule or payout is deleted."
                  )
                }}
                aria-label="Enable the commissions module"
              />
            </div>
          </CardHeader>
        </Card>

        {!moduleEnabled ? (
          <Card className="py-0">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ScaleIcon className="size-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">
                  Commissions module is off
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Commission rules and teacher payouts are optional. Switching
                  the module off hides these screens; sample rules are kept
                  as-is and no data is deleted.
                </p>
              </div>
              <Button variant="outline" onClick={() => setModuleEnabled(true)}>
                <PowerIcon data-icon="inline-start" />
                Turn module back on
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
                  label="Active now"
                  hint={`Of ${usage.total} total rules`}
                />
                <SummaryCard
                  icon={<PercentIcon aria-hidden="true" />}
                  value={usage.percent}
                  label="Percent rules"
                  hint="Rate is a share of the base"
                />
                <SummaryCard
                  icon={<CoinsIcon aria-hidden="true" />}
                  value={usage.fixed}
                  label="Fixed rules"
                  hint="Amount per student per month"
                />
                <SummaryCard
                  icon={<TriangleAlertIcon aria-hidden="true" />}
                  value={usage.overlappingLecturers}
                  label="Overlap warnings"
                  hint="Lecturers with a possible clash"
                />
              </div>
            )}

            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <CardTitle>Rules</CardTitle>
                  <CardDescription>
                    {filteredRules.length}{" "}
                    {filteredRules.length === 1 ? "rule" : "rules"} match the
                    current filters. Basis:{" "}
                    {commissionBasisLabels[commissionBasisMock].toLowerCase()}.
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div className="relative lg:col-span-2">
                    <SearchIcon
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search lecturer, scope or rate"
                      aria-label="Search commission rules"
                      className="pl-8"
                    />
                  </div>

                  <Select
                    items={commissionRuleLecturerFilterOptions}
                    value={lecturerFilter}
                    onValueChange={(value) => setLecturerFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by lecturer"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commissionRuleLecturerFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={commissionRuleScopeFilterOptions}
                    value={scopeFilter}
                    onValueChange={(value) => setScopeFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by scope"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commissionRuleScopeFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={commissionRuleCalcTypeFilterOptions}
                    value={calcTypeFilter}
                    onValueChange={(value) => setCalcTypeFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by calculation type"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commissionRuleCalcTypeFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={commissionRuleStatusFilterOptions}
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {commissionRuleStatusFilterOptions.map((option) => (
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
                    className="justify-self-start"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                      Lecturer
                    </TableHead>
                    <TableHead className="text-muted-foreground">Scope</TableHead>
                    <TableHead className="text-muted-foreground">
                      Calculation
                    </TableHead>
                    <TableHead className="text-muted-foreground">Rate</TableHead>
                    <TableHead className="text-muted-foreground">
                      Effective period
                    </TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="w-12 pr-4 text-right sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRefreshing ? (
                    <CommissionTableSkeleton />
                  ) : visibleRules.length > 0 ? (
                    visibleRules.map((rule) => {
                      const scope = getCommissionScope(rule)
                      const status = getCommissionRuleStatus(rule)
                      const overlaps = findOverlappingRules(rule)

                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="py-3 pl-4 sm:pl-6">
                            <button
                              type="button"
                              onClick={() => openDetail(rule)}
                              className="flex max-w-[220px] flex-col text-left focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              <span className="font-medium text-card-foreground hover:underline">
                                {rule.lecturerName}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {scope.label}
                              </span>
                            </button>
                          </TableCell>

                          <TableCell>
                            <div className="flex max-w-[220px] flex-col gap-0.5">
                              <CommissionScopeBadge rule={rule} />
                              <span className="truncate text-xs text-muted-foreground">
                                {scope.detail}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <CommissionCalcTypeBadge calcType={rule.calcType} />
                          </TableCell>

                          <TableCell className="text-muted-foreground tabular-nums">
                            {formatCommissionRateShort(rule)}
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {formatCommissionPeriod(rule)}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <CommissionStatusBadge status={status} />
                              {overlaps.length > 0 ? (
                                <span
                                  className="text-amber-600 dark:text-amber-400"
                                  title={`Overlaps ${overlaps.length} rule(s)`}
                                >
                                  <TriangleAlertIcon
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">
                                    Possible overlap
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell className="pr-4 text-right sm:pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${rule.lecturerName} rule`}
                                  />
                                }
                              >
                                <EllipsisVerticalIcon
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-56"
                              >
                                <DropdownMenuLabel className="truncate">
                                  {rule.lecturerName} · {scope.label}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => openDetail(rule)}
                                >
                                  <InfoIcon aria-hidden="true" />
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEdit(rule)}
                                >
                                  <SquarePenIcon aria-hidden="true" />
                                  Edit rule (demo)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openDetail(rule)}>
                                  <TriangleAlertIcon aria-hidden="true" />
                                  {overlaps.length > 0
                                    ? `${overlaps.length} overlap warning${
                                        overlaps.length === 1 ? "" : "s"
                                      }`
                                    : "No overlap"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <ScaleIcon className="size-5" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">
                              No rules match
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try a different search term, lecturer, scope,
                              calculation or status.
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
                  {filteredRules.length > 0 ? (
                    <>
                      Showing{" "}
                      <span className="tabular-nums">
                        {startIndex + 1}–
                        {Math.min(startIndex + PAGE_SIZE, filteredRules.length)}
                      </span>{" "}
                      of{" "}
                      <span className="tabular-nums">
                        {filteredRules.length}
                      </span>{" "}
                      rules
                    </>
                  ) : (
                    "No rules to show"
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

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="flex flex-1 items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                <ScaleIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  The most specific rule in effect wins: course, then subject +
                  grade, then subject, then the lecturer default. Each commission
                  entry snapshots its own rule and rate, so later edits never
                  change past earnings. No commission is accrued or paid here.
                </span>
              </div>
              <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
                <CoinsIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Commission basis is an organization setting:{" "}
                  <span className="font-medium text-foreground">
                    {commissionBasisLabels[commissionBasisMock]}
                  </span>
                  . {commissionBasisHints[commissionBasisMock]}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <CommissionRuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editingRule}
        onSaved={(message) => setNotice(message)}
      />

      <CommissionRuleDetailSheet
        rule={selectedRule}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onNotice={(message) => setNotice(message)}
      />
    </main>
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

function CommissionTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-28 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-28 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
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