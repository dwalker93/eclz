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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FilePenLineIcon,
  InfoIcon,
  LayersIcon,
  LockIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  SquarePenIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { ExamDetailSheet } from "@/components/exams/exam-detail-sheet"
import { ExamFormDialog } from "@/components/exams/exam-form-dialog"
import {
  ExamModeBadge,
  ExamStatusBadge,
} from "@/components/exams/exam-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  attemptScoringLabels,
  examCourseFilterOptions,
  examLecturerFilterOptions,
  examModeFilterOptions,
  examStatusLabels,
  exams,
  formatExamLimits,
  formatExamSchedule,
  getExamUsageCounts,
  resultsVisibilityShortLabels,
  type ExamRecord,
  type ExamStatus,
} from "@/lib/exams-data"

const PAGE_SIZE = 8

const statusOrder: ExamStatus[] = ["draft", "published", "closed"]

const statusTabIcons: Record<ExamStatus, ReactNode> = {
  draft: <FilePenLineIcon aria-hidden="true" />,
  published: <SendIcon aria-hidden="true" />,
  closed: <LockIcon aria-hidden="true" />,
}

export function ExamDirectory() {
  const [activeTab, setActiveTab] = useState<ExamStatus>("published")
  const [search, setSearch] = useState("")
  const [modeFilter, setModeFilter] = useState("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamRecord | null>(null)
  const [selectedExam, setSelectedExam] = useState<ExamRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, modeFilter, courseFilter, lecturerFilter, activeTab])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice("Exams refreshed from local mock data. No server request was made.")
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const usage = getExamUsageCounts()

  const filteredExams = useMemo(() => {
    const query = search.trim().toLowerCase()

    return exams.filter((exam) => {
      const matchesTab = exam.status === activeTab
      const matchesSearch =
        query.length === 0 ||
        [exam.title, exam.lecturerName].some((value) =>
          value.toLowerCase().includes(query)
        ) ||
        exam.courses.some((course) =>
          course.courseName.toLowerCase().includes(query)
        )

      const matchesMode = modeFilter === "all" || exam.mode === modeFilter
      const matchesCourse =
        courseFilter === "all" ||
        exam.courses.some((course) => course.courseId === courseFilter)
      const matchesLecturer =
        lecturerFilter === "all" || exam.lecturerId === lecturerFilter

      return (
        matchesTab && matchesSearch && matchesMode && matchesCourse && matchesLecturer
      )
    })
  }, [activeTab, search, modeFilter, courseFilter, lecturerFilter])

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleExams = filteredExams.slice(startIndex, startIndex + PAGE_SIZE)

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 ||
    modeFilter !== "all" ||
    courseFilter !== "all" ||
    lecturerFilter !== "all"

  function clearFilters() {
    setSearch("")
    setModeFilter("all")
    setCourseFilter("all")
    setLecturerFilter("all")
  }

  function openCreate() {
    setEditingExam(null)
    setFormOpen(true)
  }

  function openEdit(exam: ExamRecord) {
    setEditingExam(exam)
    setDetailOpen(false)
    setFormOpen(true)
  }

  function openDetail(exam: ExamRecord) {
    setSelectedExam(exam)
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
    document.getElementById(`exam-tab-${nextTab}`)?.focus()
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Online MCQ and paper exams attached to courses. Draft, publish and
              close flow, question snapshots and result release. All records on
              this page are sample data; no exam or grading runs.
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
              Create exam
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

        {isRefreshing ? null : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              icon={<FilePenLineIcon aria-hidden="true" />}
              value={usage.draft}
              label="Drafts"
              hint="Editable, not visible to candidates"
            />
            <SummaryCard
              icon={<SendIcon aria-hidden="true" />}
              value={usage.published}
              label="Published"
              hint="Open within their window"
            />
            <SummaryCard
              icon={<LockIcon aria-hidden="true" />}
              value={usage.closed}
              label="Closed"
              hint="Awaiting or past release"
            />
            <SummaryCard
              icon={<UsersIcon aria-hidden="true" />}
              value={usage.candidates}
              label="Eligible candidates"
              hint="Across attached courses (sample)"
            />
          </div>
        )}

        <div
          role="tablist"
          aria-label="Exam status"
          onKeyDown={handleTabKeyDown}
          className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {statusOrder.map((status) => (
            <TabButton
              key={status}
              id={`exam-tab-${status}`}
              controls="exam-panel"
              isActive={activeTab === status}
              icon={statusTabIcons[status]}
              label={examStatusLabels[status]}
              count={usage[status]}
              onClick={() => setActiveTab(status)}
            />
          ))}
        </div>

        <Card
          id="exam-panel"
          role="tabpanel"
          aria-labelledby={`exam-tab-${activeTab}`}
          tabIndex={0}
          className="gap-0 py-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>{examStatusLabels[activeTab]} exams</CardTitle>
              <CardDescription>
                {filteredExams.length}{" "}
                {filteredExams.length === 1 ? "exam" : "exams"} match the current
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
                  placeholder="Search exams, lecturers or courses"
                  aria-label="Search exams"
                  className="pl-8"
                />
              </div>

              <Select
                items={examModeFilterOptions}
                value={modeFilter}
                onValueChange={(value) => setModeFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examModeFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={examCourseFilterOptions}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by course">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examCourseFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={examLecturerFilterOptions}
                value={lecturerFilter}
                onValueChange={(value) => setLecturerFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by lecturer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {examLecturerFilterOptions.map((option) => (
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
                  Exam
                </TableHead>
                <TableHead className="text-muted-foreground">Mode</TableHead>
                <TableHead className="text-muted-foreground">Courses</TableHead>
                <TableHead className="text-muted-foreground">Schedule</TableHead>
                <TableHead className="text-muted-foreground">Limits</TableHead>
                <TableHead className="text-muted-foreground">Scoring</TableHead>
                <TableHead className="text-muted-foreground">
                  Visibility
                </TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <ExamTableSkeleton />
              ) : visibleExams.length > 0 ? (
                visibleExams.map((exam) => {
                  const firstCourse = exam.courses[0]

                  return (
                    <TableRow key={exam.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <button
                          type="button"
                          onClick={() => openDetail(exam)}
                          className="flex max-w-[260px] flex-col text-left focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <span className="font-medium text-card-foreground hover:underline">
                            {exam.title}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {exam.lecturerName}
                          </span>
                        </button>
                      </TableCell>

                      <TableCell>
                        <ExamModeBadge mode={exam.mode} />
                      </TableCell>

                      <TableCell>
                        <div className="flex max-w-[200px] flex-col">
                          <span className="truncate text-sm">
                            {firstCourse?.courseName ?? "No course"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {exam.courses.length > 1
                              ? `+${exam.courses.length - 1} more`
                              : "1 course"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatExamSchedule(exam)}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatExamLimits(exam)}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {exam.mode === "paper"
                          ? "Manual marks"
                          : attemptScoringLabels[exam.attemptScoring]}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {resultsVisibilityShortLabels[exam.resultsVisibility]}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <ExamStatusBadge status={exam.status} />
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${exam.title}`}
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
                              {exam.title}
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetail(exam)}>
                              <InfoIcon aria-hidden="true" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={exam.status !== "draft"}
                              onClick={() => openEdit(exam)}
                            >
                              <SquarePenIcon aria-hidden="true" />
                              Edit draft (demo)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openDetail(exam)}
                            >
                              <LayersIcon aria-hidden="true" />
                              {exam.status === "draft"
                                ? "Publish / manage"
                                : exam.status === "published"
                                  ? "Close / manage"
                                  : "Release / manage"}
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
                        <FilePenLineIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No {examStatusLabels[activeTab].toLowerCase()} exams
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, mode, course or lecturer.
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
              {filteredExams.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredExams.length)}
                  </span>{" "}
                  of <span className="tabular-nums">{filteredExams.length}</span>{" "}
                  exams
                </>
              ) : (
                "No exams to show"
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
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
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
            Status moves draft → published → closed only. Publishing freezes
            question and option snapshots, so published questions cannot be
            edited in place. Results can only be released after the exam closes.
            No real exams run and no grading is calculated on this page.
          </span>
        </div>
      </div>

      <ExamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        exam={editingExam}
        onSaved={(message) => setNotice(message)}
      />

      <ExamDetailSheet
        exam={selectedExam}
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

function ExamTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
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
