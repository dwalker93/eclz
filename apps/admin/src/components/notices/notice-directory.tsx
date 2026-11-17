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
  DropdownMenuGroup,
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
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilePenIcon,
  InfoIcon,
  MegaphoneIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { NoticeDetailSheet } from "@/components/notices/notice-detail-sheet"
import { NoticeFormDialog } from "@/components/notices/notice-form-dialog"
import { NoticeStatusBadge } from "@/components/notices/notice-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  describeRecipientCount,
  estimateNoticeRecipients,
  getNoticeAudienceLabels,
  getNoticeAudienceSummary,
  getNoticeAuthor,
  getNoticeBranchLabel,
  getNoticeState,
  getNoticeTargetLabel,
  noticeAudienceFilterOptions,
  noticeBranchFilterOptions,
  noticeStateFilterOptions,
  notices,
  type NoticeRecord,
} from "@/lib/notices-data"
import { formatDisplayDate } from "@/lib/students-data"

const PAGE_SIZE = 8

export function NoticeDirectory() {
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [audienceFilter, setAudienceFilter] = useState("any")
  const [page, setPage] = useState(1)
  const [selectedNotice, setSelectedNotice] = useState<NoticeRecord | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<NoticeRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, stateFilter, branchFilter, audienceFilter])

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

  const filteredNotices = useMemo(() => {
    const query = search.trim().toLowerCase()

    return notices.filter((item) => {
      const author = getNoticeAuthor(item)
      const matchesSearch =
        query.length === 0 ||
        [
          item.title,
          item.body,
          author.fullName,
          author.role,
          getNoticeBranchLabel(item),
          ...getNoticeAudienceLabels(item),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesState =
        stateFilter === "all" || getNoticeState(item) === stateFilter

      const matchesBranch =
        branchFilter === "all" ||
        (branchFilter === "global"
          ? item.branchId === null
          : item.branchId === branchFilter)

      const matchesAudience =
        audienceFilter === "any" ||
        item.targets.some((target) => target.targetType === audienceFilter)

      return (
        matchesSearch && matchesState && matchesBranch && matchesAudience
      )
    })
  }, [search, stateFilter, branchFilter, audienceFilter])

  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleNotices = filteredNotices.slice(
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
    stateFilter !== "all" ||
    branchFilter !== "all" ||
    audienceFilter !== "any"

  const publishedCount = notices.filter(
    (item) => getNoticeState(item) === "published"
  ).length
  const scheduledCount = notices.filter(
    (item) => getNoticeState(item) === "scheduled"
  ).length
  const draftCount = notices.filter(
    (item) => getNoticeState(item) === "draft"
  ).length
  const expiredCount = notices.filter(
    (item) => getNoticeState(item) === "expired"
  ).length

  function clearFilters() {
    setSearch("")
    setStateFilter("all")
    setBranchFilter("all")
    setAudienceFilter("any")
  }

  function openNotice(item: NoticeRecord) {
    setSelectedNotice(item)
    setDetailOpen(true)
  }

  function openCreate() {
    setEditingNotice(null)
    setFormOpen(true)
  }

  function openEdit(item: NoticeRecord) {
    setEditingNotice(item)
    setFormOpen(true)
  }

  async function copyReference(item: NoticeRecord) {
    try {
      await navigator.clipboard.writeText(item.id)
      setNotice(`${item.id} copied to the clipboard.`)
    } catch {
      setNotice(`Notice reference: ${item.id}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Notices</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Write notices, schedule when they appear, and target them by
              branch, role, course, grade or student. Status is derived for
              display. This page uses sample data — no notice is published or
              sent.
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
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              New notice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<MegaphoneIcon aria-hidden="true" />}
            value={publishedCount}
            label="Published"
            hint="Visible to their audience"
          />
          <SummaryCard
            icon={<CalendarClockIcon aria-hidden="true" />}
            value={scheduledCount}
            label="Scheduled"
            hint="Publishes at a future time"
          />
          <SummaryCard
            icon={<FilePenIcon aria-hidden="true" />}
            value={draftCount}
            label="Drafts"
            hint="Not published yet"
          />
          <SummaryCard
            icon={<BanIcon aria-hidden="true" />}
            value={expiredCount}
            label="Expired"
            hint="Past the expiry date"
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
              <CardTitle>Notice board</CardTitle>
              <CardDescription>
                Search by title, body, author or audience.{" "}
                {filteredNotices.length}{" "}
                {filteredNotices.length === 1 ? "notice matches" : "notices match"}{" "}
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notices"
                  aria-label="Search notices"
                  className="pl-8"
                />
              </div>

              <Select
                items={noticeStateFilterOptions}
                value={stateFilter}
                onValueChange={(value) => setStateFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noticeStateFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={noticeBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by branch"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noticeBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={noticeAudienceFilterOptions}
                value={audienceFilter}
                onValueChange={(value) => setAudienceFilter(value ?? "any")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by audience type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noticeAudienceFilterOptions.map((option) => (
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
                  Notice
                </TableHead>
                <TableHead className="text-muted-foreground">Author</TableHead>
                <TableHead className="text-muted-foreground">Branch</TableHead>
                <TableHead className="text-muted-foreground">
                  Publish / expiry
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Audience
                </TableHead>
                <TableHead className="text-muted-foreground">State</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <NoticeTableSkeleton />
              ) : visibleNotices.length > 0 ? (
                visibleNotices.map((item) => {
                  const state = getNoticeState(item)
                  const author = getNoticeAuthor(item)
                  const recipients = estimateNoticeRecipients(item)

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex max-w-[340px] flex-col">
                          <button
                            type="button"
                            onClick={() => openNotice(item)}
                            className="w-fit text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {item.title}
                          </button>
                          <span
                            className="truncate text-xs text-muted-foreground"
                            title={item.body}
                          >
                            {item.body}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            {item.targets.slice(0, 2).map((target) => (
                              <Badge
                                key={target.id}
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                {getNoticeTargetLabel(target)}
                              </Badge>
                            ))}
                            {item.targets.length > 2 ? (
                              <Badge
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                +{item.targets.length - 2} more
                              </Badge>
                            ) : null}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex max-w-[160px] flex-col">
                          <span className="truncate">{author.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            {author.role}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {getNoticeBranchLabel(item)}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>
                            {item.publishedAt ? (
                              state === "scheduled" ? (
                                <span className="text-sky-700 dark:text-sky-400">
                                  Publishes{" "}
                                  {formatDisplayDate(
                                    item.publishedAt.slice(0, 10)
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Published{" "}
                                  {formatDisplayDate(
                                    item.publishedAt.slice(0, 10)
                                  )}
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground">
                                Not published
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {item.expiresAt
                              ? `Expires ${formatDisplayDate(
                                  item.expiresAt.slice(0, 10)
                                )}`
                              : "No expiry"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex max-w-[220px] flex-col">
                          <span
                            className="truncate"
                            title={getNoticeAudienceSummary(item)}
                          >
                            {getNoticeAudienceSummary(item)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {describeRecipientCount(recipients)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <NoticeStatusBadge state={state} />
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${item.title}`}
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
                                onClick={() => openNotice(item)}
                              >
                                <EyeIcon aria-hidden="true" />
                                Preview notice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(item)}>
                                <PencilIcon aria-hidden="true" />
                                Edit notice (preview)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyReference(item)}
                              >
                                <CopyIcon aria-hidden="true" />
                                Copy notice reference
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setNotice(
                                  `Duplicating “${item.title}” is a placeholder in this demo. No notice was created.`
                                )
                              }
                            >
                              <MegaphoneIcon aria-hidden="true" />
                              Duplicate (placeholder)
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
                        <MegaphoneIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No notices match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, state or audience.
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
              {filteredNotices.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredNotices.length)}
                  </span>{" "}
                  of <span className="tabular-nums">{filteredNotices.length}</span>{" "}
                  notices
                </>
              ) : (
                "No notices to show"
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
            Draft, scheduled, published and expired are derived from the publish
            and expiry timestamps. A global notice has no branch; specific
            targets can combine roles, courses, grades and students. Publishing
            and delivery are local UI only — this demo never sends a notice.
          </span>
        </div>
      </div>

      <NoticeDetailSheet
        notice={selectedNotice}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />

      <NoticeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        notice={editingNotice}
        onSaved={(message) => setNotice(message)}
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

function NoticeTableSkeleton() {
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
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
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
