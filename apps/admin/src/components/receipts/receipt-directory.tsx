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
  BanIcon,
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FileTextIcon,
  InfoIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet"
import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import { formatLkr } from "@/lib/courses-data"
import {
  getReceiptById,
  getReceiptUsageCounts,
  maskVerificationCode,
  receiptBranchFilterOptions,
  receiptStatusFilterOptions,
  receiptStudentFilterOptions,
  receipts,
  type ReceiptRecord,
} from "@/lib/receipts-data"
import { formatDisplayDate } from "@/lib/students-data"

const PAGE_SIZE = 8

export function ReceiptDirectory() {
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [studentFilter, setStudentFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, branchFilter, statusFilter, studentFilter, fromDate, toDate])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Register refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const filteredReceipts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return receipts.filter((receiptRecord) => {
      const matchesSearch =
        query.length === 0 ||
        [
          receiptRecord.receiptNo,
          receiptRecord.studentName,
          receiptRecord.studentNo,
          receiptRecord.paymentReference,
        ].some((value) => value.toLowerCase().includes(query))

      const matchesBranch =
        branchFilter === "all" || receiptRecord.branchId === branchFilter
      const matchesStatus =
        statusFilter === "all" || receiptRecord.status === statusFilter
      const matchesStudent =
        studentFilter === "all" || receiptRecord.studentId === studentFilter

      const issuedDate = receiptRecord.issuedAt.slice(0, 10)
      const matchesFrom = fromDate === "" || issuedDate >= fromDate
      const matchesTo = toDate === "" || issuedDate <= toDate

      return (
        matchesSearch &&
        matchesBranch &&
        matchesStatus &&
        matchesStudent &&
        matchesFrom &&
        matchesTo
      )
    })
  }, [search, branchFilter, statusFilter, studentFilter, fromDate, toDate])

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleReceipts = filteredReceipts.slice(
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
    branchFilter !== "all" ||
    statusFilter !== "all" ||
    studentFilter !== "all" ||
    fromDate !== "" ||
    toDate !== ""

  const usage = getReceiptUsageCounts()

  function clearFilters() {
    setSearch("")
    setBranchFilter("all")
    setStatusFilter("all")
    setStudentFilter("all")
    setFromDate("")
    setToDate("")
  }

  function openReceipt(receiptRecord: ReceiptRecord) {
    setSelectedReceipt(receiptRecord)
    setDetailOpen(true)
  }

  async function copyReceiptNumber(receiptRecord: ReceiptRecord) {
    try {
      await navigator.clipboard.writeText(receiptRecord.receiptNo)
      setNotice(`${receiptRecord.receiptNo} copied to the clipboard.`)
    } catch {
      setNotice(`Receipt number: ${receiptRecord.receiptNo}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Issued receipt register with branch-scoped numbers, verification
              and void or reissue history. All records on this page are sample
              data.
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
              variant="outline"
              onClick={() =>
                setNotice(
                  "Receipts are issued automatically when a payment is verified. Verifying payments belongs to the Payments page — this is a placeholder here."
                )
              }
            >
              <PlusIcon data-icon="inline-start" />
              Issue from payment (demo)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<ReceiptIcon aria-hidden="true" />}
            value={String(usage.total)}
            label="Receipts"
            hint="Issued and void sample records"
          />
          <SummaryCard
            icon={<BadgeCheckIcon aria-hidden="true" />}
            value={String(usage.issued)}
            label="Issued"
            hint="Active receipts per payment"
          />
          <SummaryCard
            icon={<BanIcon aria-hidden="true" />}
            value={String(usage.voided)}
            label="Void"
            hint="Kept for audit and reissue"
          />
          <SummaryCard
            icon={<FileTextIcon aria-hidden="true" />}
            value={formatLkr(usage.issuedValue)}
            label="Issued value"
            hint="Total of issued receipts (LKR)"
          />
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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>Receipt register</CardTitle>
              <CardDescription>
                Search by receipt number, student or payment reference.{" "}
                {filteredReceipts.length}{" "}
                {filteredReceipts.length === 1 ? "receipt" : "receipts"} match
                the current filters.
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
                  placeholder="Search receipts, students or references"
                  aria-label="Search receipts"
                  className="pl-8"
                />
              </div>

              <Select
                items={receiptBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {receiptBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={receiptStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {receiptStatusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={receiptStudentFilterOptions}
                value={studentFilter}
                onValueChange={(value) => setStudentFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by student"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {receiptStudentFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="receipt-from-date"
                  className="text-xs text-muted-foreground"
                >
                  From
                </label>
                <Input
                  id="receipt-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  aria-label="Issued from date"
                />
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="receipt-to-date"
                  className="text-xs text-muted-foreground"
                >
                  To
                </label>
                <Input
                  id="receipt-to-date"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  aria-label="Issued to date"
                />
              </div>

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
                  Receipt
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Student / payment
                </TableHead>
                <TableHead className="text-muted-foreground">Branch</TableHead>
                <TableHead className="text-muted-foreground">Issued</TableHead>
                <TableHead className="text-muted-foreground">Amount</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">
                  Verification
                </TableHead>
                <TableHead className="text-muted-foreground">PDF</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <ReceiptTableSkeleton />
              ) : visibleReceipts.length > 0 ? (
                visibleReceipts.map((receiptRecord) => {
                  const replacement = receiptRecord.replacedByReceiptId
                    ? getReceiptById(receiptRecord.replacedByReceiptId)
                    : undefined

                  return (
                    <TableRow key={receiptRecord.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                            <ReceiptIcon aria-hidden="true" />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <button
                              type="button"
                              onClick={() => openReceipt(receiptRecord)}
                              className="w-fit text-left font-mono font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {receiptRecord.receiptNo}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              {replacement
                                ? `Replaced by ${replacement.receiptNo}`
                                : `${receiptRecord.branchCode} counter`}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex max-w-[220px] flex-col">
                          <span className="truncate">
                            {receiptRecord.studentName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {receiptRecord.studentNo} ·{" "}
                            {receiptRecord.paymentReference}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2Icon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span>{receiptRecord.branchName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(receiptRecord.issuedAt.slice(0, 10))}
                      </TableCell>

                      <TableCell className="font-medium tabular-nums">
                        {formatLkr(receiptRecord.amount)}
                      </TableCell>

                      <TableCell>
                        <ReceiptStatusBadge status={receiptRecord.status} />
                      </TableCell>

                      <TableCell>
                        <span
                          className="font-mono text-xs text-muted-foreground"
                          title="Verification codes are masked"
                        >
                          {maskVerificationCode(receiptRecord.verificationCode)}
                        </span>
                      </TableCell>

                      <TableCell>
                        {receiptRecord.hasPdf ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                          >
                            <FileTextIcon aria-hidden="true" />
                            PDF
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${receiptRecord.receiptNo}`}
                              />
                            }
                          >
                            <EllipsisVerticalIcon
                              className="size-4"
                              aria-hidden="true"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-mono">
                              {receiptRecord.receiptNo}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => openReceipt(receiptRecord)}
                            >
                              <EyeIcon aria-hidden="true" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyReceiptNumber(receiptRecord)}
                            >
                              <CopyIcon aria-hidden="true" />
                              Copy receipt number
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!receiptRecord.hasPdf}
                              onClick={() =>
                                setNotice(
                                  `Downloading ${receiptRecord.receiptNo} is a placeholder in this UI demo. No file was generated.`
                                )
                              }
                            >
                              <DownloadIcon aria-hidden="true" />
                              Download PDF (demo)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ReceiptIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No receipts match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, branch, status or date
                          range.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
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
              {filteredReceipts.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredReceipts.length)}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">
                    {filteredReceipts.length}
                  </span>{" "}
                  receipts
                </>
              ) : (
                "No receipts to show"
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
            Receipt numbers are branch-scoped and immutable. Verification codes
            and signatures are masked, and raw hashes or signing keys are never
            shown. Amounts and dates follow the organization defaults (LKR,
            Asia/Colombo). This page uses local mock data only; actions do not
            persist.
          </span>
        </div>
      </div>

      <ReceiptDetailSheet
        receipt={selectedReceipt}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onNotice={(message) => setNotice(message)}
        onSelectReceipt={(nextReceipt) => setSelectedReceipt(nextReceipt)}
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

function ReceiptTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
