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
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShapesIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"

import { GradeLevelDetailSheet } from "@/components/grade-levels/grade-level-detail-sheet"
import { GradeLevelFormDialog } from "@/components/grade-levels/grade-level-form-dialog"
import { GradeStageBadge } from "@/components/grade-levels/grade-stage-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  getGradeLevelUsage,
  gradeLevelDirectory,
  gradeLevelStageFilterOptions,
  type GradeLevelDirectoryRecord,
} from "@/lib/grade-levels-data"
import { stageLabel } from "@/lib/students-data"

const PAGE_SIZE = 8

export function GradeLevelDirectory() {
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedGradeLevel, setSelectedGradeLevel] =
    useState<GradeLevelDirectoryRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingGradeLevel, setEditingGradeLevel] =
    useState<GradeLevelDirectoryRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, stageFilter])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Grade level list refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const filteredGradeLevels = useMemo(() => {
    const query = search.trim().toLowerCase()

    return gradeLevelDirectory.filter((gradeLevel) => {
      const matchesSearch =
        query.length === 0 ||
        [
          gradeLevel.name,
          String(gradeLevel.ordinal),
          stageLabel(gradeLevel.stage),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesStage =
        stageFilter === "all" || gradeLevel.stage === stageFilter

      return matchesSearch && matchesStage
    })
  }, [search, stageFilter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGradeLevels.length / PAGE_SIZE)
  )
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleGradeLevels = filteredGradeLevels.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters = search.length > 0 || stageFilter !== "all"
  const usage = getGradeLevelUsage()

  function clearFilters() {
    setSearch("")
    setStageFilter("all")
  }

  function openCreate() {
    setEditingGradeLevel(null)
    setFormOpen(true)
  }

  function openEdit(gradeLevel: GradeLevelDirectoryRecord) {
    setEditingGradeLevel(gradeLevel)
    setFormOpen(true)
  }

  function openGradeLevel(gradeLevel: GradeLevelDirectoryRecord) {
    setSelectedGradeLevel(gradeLevel)
    setDetailOpen(true)
  }

  async function copyName(gradeLevel: GradeLevelDirectoryRecord) {
    try {
      await navigator.clipboard.writeText(gradeLevel.name)
      setNotice(`${gradeLevel.name} copied to the clipboard.`)
    } catch {
      setNotice(`Grade level name: ${gradeLevel.name}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Grade Levels
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              The ordered grade list used by classes, courses and promotion.
              Each grade stores a name, stage and ordinal; student and course
              counts are derived. All records on this page are sample data.
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
              Add grade level
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<LayersIcon aria-hidden="true" />}
            value={usage.total}
            label="Grade levels"
            hint="Entries in the ordered list"
          />
          <SummaryCard
            icon={<UsersRoundIcon aria-hidden="true" />}
            value={usage.placedStudents}
            label="Students placed"
            hint="Students with a current grade today"
          />
          <SummaryCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={usage.coursePlacements}
            label="Course links"
            hint="Classes and programs by grade"
          />
          <SummaryCard
            icon={<ShapesIcon aria-hidden="true" />}
            value={usage.stages}
            label="Stages"
            hint="Primary to advanced level"
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:text-amber-300">
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              Changing the order affects promotion proposals.
            </span>
            <span>
              The list is read in ordinal order and promotion proposes the next
              ordinal as the next grade. Reordering or renumbering a grade can
              change which grade a promotion run proposes. This demo does not
              apply any order change.
            </span>
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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>Grade level order</CardTitle>
              <CardDescription>
                Ordered by ordinal. {filteredGradeLevels.length}{" "}
                {filteredGradeLevels.length === 1
                  ? "grade level matches"
                  : "grade levels match"}{" "}
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
                  placeholder="Search by grade name or ordinal"
                  aria-label="Search grade levels"
                  className="pl-8"
                />
              </div>

              <Select
                items={gradeLevelStageFilterOptions}
                value={stageFilter}
                onValueChange={(value) => setStageFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevelStageFilterOptions.map((option) => (
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
                  Order
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Grade level
                </TableHead>
                <TableHead className="text-muted-foreground">Stage</TableHead>
                <TableHead className="text-muted-foreground">
                  Students
                </TableHead>
                <TableHead className="text-muted-foreground">Courses</TableHead>
                <TableHead className="text-muted-foreground">
                  Next grade
                </TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <GradeLevelTableSkeleton />
              ) : visibleGradeLevels.length > 0 ? (
                visibleGradeLevels.map((gradeLevel) => (
                  <TableRow key={gradeLevel.id}>
                    <TableCell className="py-3 pl-4 sm:pl-6">
                      <Badge
                        variant="outline"
                        className="min-w-7 justify-center rounded-full tabular-nums"
                      >
                        {gradeLevel.ordinal}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                          <LayersIcon aria-hidden="true" />
                        </div>
                        <button
                          type="button"
                          onClick={() => openGradeLevel(gradeLevel)}
                          className="w-fit max-w-[200px] truncate text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {gradeLevel.name}
                        </button>
                      </div>
                    </TableCell>

                    <TableCell>
                      <GradeStageBadge stage={gradeLevel.stage} />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <UsersRoundIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {gradeLevel.studentCount}
                        </span>
                        <span className="text-muted-foreground">current</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <BookOpenIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {gradeLevel.courseCount}
                        </span>
                        <span className="text-muted-foreground">
                          {gradeLevel.courseCount === 1 ? "course" : "courses"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {gradeLevel.nextGradeName ? (
                        <span className="text-sm">
                          {gradeLevel.nextGradeName}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Highest grade
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
                              aria-label={`Actions for ${gradeLevel.name}`}
                            />
                          }
                        >
                          <EllipsisVerticalIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>
                              {gradeLevel.name}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => openGradeLevel(gradeLevel)}
                            >
                              <EyeIcon aria-hidden="true" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openEdit(gradeLevel)}
                            >
                              <PencilIcon aria-hidden="true" />
                              Edit grade level (demo)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyName(gradeLevel)}
                            >
                              <CopyIcon aria-hidden="true" />
                              Copy name
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setNotice(
                                  `Ordinal ${gradeLevel.ordinal}: a promotion run would propose the next grade in ordinal order${
                                    gradeLevel.nextGradeName
                                      ? ` (${gradeLevel.nextGradeName}).`
                                      : ", but this is the highest grade so students stay and are skipped."
                                  } Order changes are not applied in this demo.`
                                )
                              }
                            >
                              <TriangleAlertIcon aria-hidden="true" />
                              View promotion impact (demo)
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <LayersIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No grade levels match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term or stage filter.
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
              {filteredGradeLevels.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(
                      startIndex + PAGE_SIZE,
                      filteredGradeLevels.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">
                    {filteredGradeLevels.length}
                  </span>{" "}
                  grade levels
                </>
              ) : (
                "No grade levels to show"
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
            A grade level stores only a name, stage and ordinal. A student's
            current grade is read from the dated <code>student_level</code>{" "}
            history, never from the student profile, and courses link to grades
            through <code>course_grade_level</code>. This page uses local mock
            data only; actions do not persist.
          </span>
        </div>
      </div>

      <GradeLevelDetailSheet
        gradeLevel={selectedGradeLevel}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <GradeLevelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        gradeLevel={editingGradeLevel}
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

function GradeLevelTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <Skeleton className="h-5 w-7 rounded-full" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-14" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-14" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
