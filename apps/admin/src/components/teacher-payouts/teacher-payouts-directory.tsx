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
  BanknoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FilePenIcon,
  FileTextIcon,
  HandCoinsIcon,
  InfoIcon,
  LockIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import {
  PayoutActionDialog,
  type PayoutActionWithCreate,
  type PayoutPaymentDetails,
} from "@/components/teacher-payouts/payout-action-dialogs"
import {
  PayoutDetailSheet,
  type PayoutAction,
} from "@/components/teacher-payouts/payout-detail-sheet"
import { PayoutStatusBadge } from "@/components/teacher-payouts/payout-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import { formatLkr } from "@/lib/courses-data"
import { MOCK_TODAY, formatDisplayDate } from "@/lib/students-data"
import {
  formatPayoutAmount,
  getNextPayoutNumber,
  getPayoutLecturerFilterOptions,
  getPayoutPeriodFilterOptions,
  getPayoutPeriodLabel,
  getPayoutUsageCounts,
  initialPayouts,
  payoutCandidates,
  payoutModuleMock,
  payoutStatusFilterOptions,
  type TeacherPayoutRecord,
} from "@/lib/teacher-payouts-data"

const PAGE_SIZE = 6

export function TeacherPayoutsDirectory() {
  const [moduleEnabled, setModuleEnabled] = useState(payoutModuleMock.enabled)
  const [payouts, setPayouts] = useState<TeacherPayoutRecord[]>(initialPayouts)
  const [candidates, setCandidates] =
    useState<TeacherPayoutRecord[]>(payoutCandidates)
  const [search, setSearch] = useState("")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedPayout, setSelectedPayout] =
    useState<TeacherPayoutRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [action, setAction] = useState<PayoutActionWithCreate | null>(null)
  const [actionPayout, setActionPayout] = useState<TeacherPayoutRecord | null>(
    null
  )

  useEffect(() => {
    setPage(1)
  }, [search, lecturerFilter, periodFilter, statusFilter])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Teacher payouts refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const usage = getPayoutUsageCounts(payouts)
  const lecturerFilterOptions = getPayoutLecturerFilterOptions(payouts)
  const periodFilterOptions = getPayoutPeriodFilterOptions(payouts)

  const filteredPayouts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return payouts.filter((payout) => {
      const matchesSearch =
        query.length === 0 ||
        [
          payout.lecturerName,
          payout.lecturerQualification,
          payout.payoutNo,
          payout.paymentReference ?? "",
          getPayoutPeriodLabel(payout.periodId),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesLecturer =
        lecturerFilter === "all" || payout.lecturerId === lecturerFilter
      const matchesPeriod =
        periodFilter === "all" || payout.periodId === periodFilter
      const matchesStatus =
        statusFilter === "all" || payout.status === statusFilter

      return matchesSearch && matchesLecturer && matchesPeriod && matchesStatus
    })
  }, [payouts, search, lecturerFilter, periodFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPayouts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visiblePayouts = filteredPayouts.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 ||
    lecturerFilter !== "all" ||
    periodFilter !== "all" ||
    statusFilter !== "all"

  function clearFilters() {
    setSearch("")
    setLecturerFilter("all")
    setPeriodFilter("all")
    setStatusFilter("all")
  }

  function openDetail(payout: TeacherPayoutRecord) {
    setSelectedPayout(payout)
    setDetailOpen(true)
  }

  function openAction(
    nextAction: PayoutActionWithCreate,
    payout: TeacherPayoutRecord | null = null
  ) {
    setActionPayout(payout)
    setDetailOpen(false)
    setAction(nextAction)
  }

  function handleCreateDraft(candidate: TeacherPayoutRecord) {
    const nextPayout: TeacherPayoutRecord = {
      ...candidate,
      payoutNo: getNextPayoutNumber(payouts, candidate.periodId),
      status: "draft",
      createdAt: `${MOCK_TODAY}T09:00:00+05:30`,
      note: "Created as a local demo draft. Entries still need review before approval.",
    }

    setPayouts((current) => [nextPayout, ...current])
    setCandidates((current) =>
      current.filter((item) => item.id !== candidate.id)
    )
    setAction(null)
    setActionPayout(null)
    setNotice(
      `Draft ${nextPayout.payoutNo} created for ${nextPayout.lecturerName} in this preview. Nothing was saved.`
    )
  }

  function handleApprove(payout: TeacherPayoutRecord) {
    setPayouts((current) =>
      current.map((item) =>
        item.id === payout.id
          ? {
              ...item,
              status: "approved",
              approvedAt: `${MOCK_TODAY}T10:00:00+05:30`,
              approvedBy: "You (demo)",
            }
          : item
      )
    )
    setAction(null)
    setActionPayout(null)
    setSelectedPayout((current) =>
      current?.id === payout.id
        ? {
            ...current,
            status: "approved",
            approvedAt: `${MOCK_TODAY}T10:00:00+05:30`,
            approvedBy: "You (demo)",
          }
        : current
    )
    setNotice(
      `${payout.payoutNo} approved in this preview. Totals are frozen locally; nothing was saved.`
    )
  }

  function handlePay(
    payout: TeacherPayoutRecord,
    details: PayoutPaymentDetails
  ) {
    const paidAt = `${details.paidAt}T14:00:00+05:30`
    const update = (item: TeacherPayoutRecord): TeacherPayoutRecord =>
      item.id === payout.id
        ? {
            ...item,
            status: "paid",
            paidAt,
            paidBy: "You (demo)",
            paymentReference: details.reference,
            paymentMethod: details.method,
            proofFileName: details.proofFileName,
          }
        : item

    setPayouts((current) => current.map(update))
    setAction(null)
    setActionPayout(null)
    setSelectedPayout((current) => (current ? update(current) : current))
    setNotice(
      `${payout.payoutNo} marked paid in this preview with reference ${details.reference}. No money moved and nothing was saved.`
    )
  }

  function handleDiscard(payout: TeacherPayoutRecord) {
    setPayouts((current) => current.filter((item) => item.id !== payout.id))
    setCandidates((current) => [
      {
        ...payout,
        status: "draft",
        approvedAt: null,
        approvedBy: null,
        paidAt: null,
        paidBy: null,
        paymentReference: null,
        paymentMethod: null,
        proofFileName: null,
        note: "Returned to the unbilled pool after a discarded draft.",
      },
      ...current,
    ])
    setAction(null)
    setActionPayout(null)
    setSelectedPayout(null)
    setNotice(
      `Draft ${payout.payoutNo} discarded in this preview. Its entries returned to the unbilled pool; nothing was deleted.`
    )
  }

  function handleDetailAction(
    nextAction: PayoutAction,
    payout: TeacherPayoutRecord
  ) {
    openAction(nextAction, payout)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Teacher Payouts
              <Badge variant="outline" className="rounded-full">
                <HandCoinsIcon aria-hidden="true" />
                Optional module
              </Badge>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Period payouts built from commission entries. Review accruals and
              reversals, approve frozen totals, then record payment. Amounts are
              illustrative and nothing is settled on this page.
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
            <Button
              onClick={() => openAction("create")}
              disabled={!moduleEnabled || candidates.length === 0}
            >
              <PlusIcon data-icon="inline-start" />
              New draft
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
                {payoutModuleMock.label}
              </CardTitle>
              <CardDescription>{payoutModuleMock.hint}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="rounded-full">
                Organization fixture:{" "}
                {payoutModuleMock.organizationEnabled ? "on" : "off"}
              </Badge>
              <Switch
                checked={moduleEnabled}
                onCheckedChange={(checked) => {
                  setModuleEnabled(checked)
                  setNotice(
                    checked
                      ? "Commissions module switched on in this preview. Teacher payouts are available."
                      : "Commissions module switched off in this preview. The screen is hidden, but no payout or entry is deleted."
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
                <HandCoinsIcon className="size-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">
                  Commissions module is off
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Teacher payouts are optional. Switching the module off hides
                  this screen; sample payouts and entries are kept as-is and no
                  data is deleted.
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
                  icon={<FilePenIcon aria-hidden="true" />}
                  value={String(usage.draftCount)}
                  label="Draft payouts"
                  hint={`${usage.openEntries} entries · ${formatLkr(
                    usage.draftValue
                  )}`}
                />
                <SummaryCard
                  icon={<BadgeCheckIcon aria-hidden="true" />}
                  value={String(usage.approvedCount)}
                  label="Approved, unpaid"
                  hint={`Frozen totals · ${formatLkr(usage.approvedValue)}`}
                />
                <SummaryCard
                  icon={<BanknoteIcon aria-hidden="true" />}
                  value={String(usage.paidCount)}
                  label="Paid payouts"
                  hint={`Recorded · ${formatLkr(usage.paidValue)}`}
                />
                <SummaryCard
                  icon={<RotateCcwIcon aria-hidden="true" />}
                  value={
                    usage.carryForward > 0
                      ? formatPayoutAmount(-usage.carryForward)
                      : "None"
                  }
                  label="Carry-forward out"
                  hint={
                    usage.carryForwardIn > 0
                      ? `${formatPayoutAmount(
                          -usage.carryForwardIn
                        )} also carried in from prior periods`
                      : "Negative balances moved to a later payout"
                  }
                />
              </div>
            )}

            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <CardTitle>Payout register</CardTitle>
                  <CardDescription>
                    {filteredPayouts.length}{" "}
                    {filteredPayouts.length === 1 ? "payout" : "payouts"} match
                    the current filters. {candidates.length} lecturer-period
                    {candidates.length === 1 ? " has" : "s have"} unbilled
                    entries.
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
                  <div className="relative">
                    <SearchIcon
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search lecturer, payout or reference"
                      aria-label="Search teacher payouts"
                      className="pl-8"
                    />
                  </div>

                  <Select
                    items={lecturerFilterOptions}
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
                      {lecturerFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={periodFilterOptions}
                    value={periodFilter}
                    onValueChange={(value) => setPeriodFilter(value ?? "all")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Filter by period"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {periodFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={payoutStatusFilterOptions}
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
                      {payoutStatusFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    Reset filters
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                      Lecturer
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Period
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Gross collected / base
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Commission
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Net payable
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Paid date / reference
                    </TableHead>
                    <TableHead className="w-12 pr-4 text-right sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRefreshing ? (
                    <PayoutTableSkeleton />
                  ) : visiblePayouts.length > 0 ? (
                    visiblePayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="py-3 pl-4 sm:pl-6">
                          <button
                            type="button"
                            onClick={() => openDetail(payout)}
                            className="flex max-w-[220px] flex-col text-left focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <span className="font-medium text-card-foreground hover:underline">
                              {payout.lecturerName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {payout.payoutNo} · {payout.lecturerQualification}
                            </span>
                          </button>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span>{getPayoutPeriodLabel(payout.periodId)}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatDisplayDate(payout.periodStart)} –{" "}
                              {formatDisplayDate(payout.periodEnd)}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="tabular-nums">
                              {formatLkr(payout.grossCollected)}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              Base after reversals:{" "}
                              {formatPayoutAmount(payout.commissionBase)}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="tabular-nums">
                              {formatPayoutAmount(payout.commissionAmount)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Institute share
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium tabular-nums">
                              {formatLkr(payout.amountDue)}
                            </span>
                            {payout.carryForwardOut < 0 ? (
                              <span className="text-xs text-amber-700 tabular-nums dark:text-amber-400">
                                {formatPayoutAmount(payout.carryForwardOut)}{" "}
                                carries forward
                              </span>
                            ) : payout.carryForwardIn < 0 ? (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {formatPayoutAmount(payout.carryForwardIn)}{" "}
                                carried in
                              </span>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell>
                          <PayoutStatusBadge status={payout.status} />
                        </TableCell>

                        <TableCell>
                          {payout.paidAt ? (
                            <div className="flex flex-col gap-0.5">
                              <span>
                                {formatDisplayDate(payout.paidAt.slice(0, 10))}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {payout.paymentReference}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="pr-4 text-right sm:pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${payout.lecturerName} ${getPayoutPeriodLabel(
                                    payout.periodId
                                  )} payout`}
                                />
                              }
                            >
                              <EllipsisVerticalIcon
                                className="size-4"
                                aria-hidden="true"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="truncate">
                                {payout.payoutNo}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openDetail(payout)}
                              >
                                <InfoIcon aria-hidden="true" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openAction("preview", payout)}
                              >
                                <FileTextIcon aria-hidden="true" />
                                Preview entries
                              </DropdownMenuItem>
                              {payout.status === "draft" ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openAction("approve", payout)
                                    }
                                  >
                                    <BadgeCheckIcon aria-hidden="true" />
                                    Approve payout
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() =>
                                      openAction("discard", payout)
                                    }
                                  >
                                    <Trash2Icon aria-hidden="true" />
                                    Discard draft
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              {payout.status === "approved" ? (
                                <DropdownMenuItem
                                  onClick={() => openAction("pay", payout)}
                                >
                                  <BanknoteIcon aria-hidden="true" />
                                  Pay payout
                                </DropdownMenuItem>
                              ) : null}
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
                            <HandCoinsIcon
                              className="size-5"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">
                              No payouts match
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Try a different search term, lecturer, period or
                              status.
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
                  {filteredPayouts.length > 0 ? (
                    <>
                      Showing{" "}
                      <span className="tabular-nums">
                        {startIndex + 1}–
                        {Math.min(
                          startIndex + PAGE_SIZE,
                          filteredPayouts.length
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="tabular-nums">
                        {filteredPayouts.length}
                      </span>{" "}
                      payouts
                    </>
                  ) : (
                    "No payouts to show"
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
                <RotateCcwIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Draft previews group accrued and reversal entries. A reversal
                  that exceeds available earnings is not paid as a negative
                  amount; the balance carries forward to the lecturer&apos;s
                  next payout.
                </span>
              </div>
              <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
                <LockIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Approval freezes totals and entries. Paid payouts are
                  immutable; a later correction is a new reversal entry in an
                  open period.
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <PayoutActionDialog
        action={action}
        payout={actionPayout}
        candidates={candidates}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null)
            setActionPayout(null)
          }
        }}
        onCreateDraft={handleCreateDraft}
        onApprove={handleApprove}
        onPay={handlePay}
        onDiscard={handleDiscard}
      />

      <PayoutDetailSheet
        payout={selectedPayout}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAction={handleDetailAction}
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
  value: string
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

function PayoutTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-28" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
