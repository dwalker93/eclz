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
  BanIcon,
  BadgeCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilePenIcon,
  InfoIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { PromotionReviewSheet } from "@/components/promotions/promotion-review-sheet"
import { PromotionSetupDialog } from "@/components/promotions/promotion-setup-dialog"
import { PromotionStatusBadge } from "@/components/promotions/promotion-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  getPromotionRunSummary,
  promotionRuns,
  promotionStatusFilterOptions,
  type PromotionRunRecord,
} from "@/lib/promotions-data"
import { formatDisplayDate } from "@/lib/students-data"

const PAGE_SIZE = 8

export function PromotionDirectory() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedRun, setSelectedRun] = useState<PromotionRunRecord | null>(
    null
  )
  const [reviewOpen, setReviewOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Directory refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase()

    return promotionRuns.filter((run) => {
      const matchesSearch =
        query.length === 0 ||
        [
          run.title,
          run.note,
          run.scopeBranch,
          run.scopeGrade,
          run.scopeCourseGroup,
        ].some((value) => value.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === "all" || run.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleRuns = filteredRuns.slice(startIndex, startIndex + PAGE_SIZE)

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters = search.length > 0 || statusFilter !== "all"

  const draftRuns = promotionRuns.filter((run) => run.status === "draft").length
  const confirmedRuns = promotionRuns.filter(
    (run) => run.status === "confirmed"
  ).length
  const discardedRuns = promotionRuns.filter(
    (run) => run.status === "discarded"
  ).length
  const needsReview = promotionRuns
    .filter((run) => run.status === "draft")
    .reduce(
      (total, run) => total + getPromotionRunSummary(run.items).needsReview,
      0
    )

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
  }

  function openRun(run: PromotionRunRecord) {
    setSelectedRun(run)
    setReviewOpen(true)
  }

  function handleConfirmed(run: PromotionRunRecord) {
    setNotice(
      `Confirmation preview for “${run.title}” completed. No student grades, class enrollments or billing records were changed.`
    )
  }

  async function copyRunReference(run: PromotionRunRecord) {
    try {
      await navigator.clipboard.writeText(run.id)
      setNotice(`${run.id} copied to the clipboard.`)
    } catch {
      setNotice(`Run reference: ${run.id}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Promotions
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Draft, review and confirm grade advancement runs. Decisions are
              previews only — no grade, class or billing record changes until a
              run is confirmed. All records on this page are sample data.
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
            <Button onClick={() => setSetupOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Create promotion run
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<FilePenIcon aria-hidden="true" />}
            value={draftRuns}
            label="Draft runs"
            hint="Awaiting review and confirmation"
          />
          <SummaryCard
            icon={<BadgeCheckIcon aria-hidden="true" />}
            value={confirmedRuns}
            label="Confirmed runs"
            hint="Historical sample runs"
          />
          <SummaryCard
            icon={<BanIcon aria-hidden="true" />}
            value={discardedRuns}
            label="Discarded runs"
            hint="No changes were applied"
          />
          <SummaryCard
            icon={<TriangleAlertIcon aria-hidden="true" />}
            value={needsReview}
            label="Needs review"
            hint="Items blocking confirmation"
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
              <CardTitle>Promotion runs</CardTitle>
              <CardDescription>
                Search by run title, scope or note. {filteredRuns.length}{" "}
                {filteredRuns.length === 1 ? "run" : "runs"} match the current
                filters.
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search promotion runs"
                  aria-label="Search promotion runs"
                  className="pl-8"
                />
              </div>

              <Select
                items={promotionStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {promotionStatusFilterOptions.map((option) => (
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
                  Run
                </TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">
                  Effective date
                </TableHead>
                <TableHead className="text-muted-foreground">Items</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <PromotionTableSkeleton />
              ) : visibleRuns.length > 0 ? (
                visibleRuns.map((run) => {
                  const summary = getPromotionRunSummary(run.items)

                  return (
                    <TableRow key={run.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex max-w-[340px] flex-col">
                          <button
                            type="button"
                            onClick={() => openRun(run)}
                            className="w-fit text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {run.title}
                          </button>
                          <span className="truncate text-xs text-muted-foreground">
                            {run.note}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="rounded-full">
                              {run.scopeBranch}
                            </Badge>
                            <Badge variant="outline" className="rounded-full">
                              {run.scopeGrade}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="rounded-full text-muted-foreground"
                            >
                              {run.scopeCourseGroup}
                            </Badge>
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <PromotionStatusBadge status={run.status} />
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(run.effectiveDate)}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="tabular-nums">
                            {run.items.length}{" "}
                            {run.items.length === 1 ? "item" : "items"}
                          </span>
                          {summary.needsReview > 0 ? (
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                              {summary.needsReview} needs review
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {summary.move} move · {summary.stay} stay ·{" "}
                              {summary.skip} skip
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(run.performedAt.slice(0, 10))}
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${run.title}`}
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
                              <DropdownMenuLabel>{run.id}</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openRun(run)}>
                                <EyeIcon aria-hidden="true" />
                                {run.status === "draft"
                                  ? "Open review"
                                  : "View run"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyRunReference(run)}
                              >
                                <CopyIcon aria-hidden="true" />
                                Copy run reference
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {run.status === "draft" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setNotice(
                                      `Discarding “${run.title}” is a placeholder in this demo. The draft was not changed.`
                                    )
                                  }
                                >
                                  <BanIcon aria-hidden="true" />
                                  Discard draft (placeholder)
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setNotice(
                                      `Run export for “${run.title}” is a placeholder. No file was generated.`
                                    )
                                  }
                                >
                                  <DownloadIcon aria-hidden="true" />
                                  Export run (placeholder)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <TrendingUpIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No promotion runs match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term or run status.
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
              {filteredRuns.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredRuns.length)}
                  </span>{" "}
                  of <span className="tabular-nums">{filteredRuns.length}</span>{" "}
                  runs
                </>
              ) : (
                "No promotion runs to show"
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
            A promotion run is a draft until it is reviewed and confirmed.{" "}
            <span className="font-medium text-foreground">Move</span> creates
            next-grade class placement,{" "}
            <span className="font-medium text-foreground">Stay</span> advances
            the grade but pins the enrollment billing grade,{" "}
            <span className="font-medium text-foreground">Skip</span> leaves the
            student unchanged, and{" "}
            <span className="font-medium text-foreground">Needs review</span>{" "}
            blocks confirmation. This page uses local mock data only; no
            decisions are applied and nothing persists.
          </span>
        </div>
      </div>

      <PromotionReviewSheet
        run={selectedRun}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onConfirmed={handleConfirmed}
      />

      <PromotionSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onCreated={() =>
          setNotice(
            "Draft setup preview closed. Nothing was generated or saved — create a run from a real cohort once the workflow is wired up."
          )
        }
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
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}

function PromotionTableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-5 w-40 rounded-full" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
