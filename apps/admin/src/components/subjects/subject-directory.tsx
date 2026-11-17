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
  CircleSlashIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  LayersIcon,
  LibraryBigIcon,
  PencilIcon,
  PlusIcon,
  PresentationIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { SubjectDetailSheet } from "@/components/subjects/subject-detail-sheet"
import { SubjectFormDialog } from "@/components/subjects/subject-form-dialog"
import { usePagination } from "@/hooks/use-pagination"
import type { SubjectRecord } from "@/lib/courses-data"
import {
  getSubjectUsageCounts,
  subjectCoverageFilterOptions,
  subjectDirectory,
  type SubjectDirectoryRecord,
} from "@/lib/subjects-data"

const PAGE_SIZE = 8

export function SubjectDirectory() {
  const [search, setSearch] = useState("")
  const [coverageFilter, setCoverageFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedSubject, setSelectedSubject] =
    useState<SubjectDirectoryRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(
    null
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, coverageFilter])

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Catalog refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase()

    return subjectDirectory.filter((subject) => {
      const matchesSearch =
        query.length === 0 ||
        [subject.code ?? "", subject.name].some((value) =>
          value.toLowerCase().includes(query)
        )

      const matchesCoverage =
        coverageFilter === "all" ||
        (coverageFilter === "with-courses"
          ? subject.courseCount > 0
          : subject.courseCount === 0)

      return matchesSearch && matchesCoverage
    })
  }, [search, coverageFilter])

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleSubjects = filteredSubjects.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters = search.length > 0 || coverageFilter !== "all"
  const usage = getSubjectUsageCounts()

  function clearFilters() {
    setSearch("")
    setCoverageFilter("all")
  }

  function openCreate() {
    setEditingSubject(null)
    setFormOpen(true)
  }

  function openEdit(subject: SubjectRecord) {
    setEditingSubject(subject)
    setFormOpen(true)
  }

  function openSubject(subject: SubjectDirectoryRecord) {
    setSelectedSubject(subject)
    setDetailOpen(true)
  }

  async function copyCode(subject: SubjectDirectoryRecord) {
    if (!subject.code) {
      setNotice(`“${subject.name}” has no code set.`)
      return
    }

    try {
      await navigator.clipboard.writeText(subject.code)
      setNotice(`${subject.code} copied to the clipboard.`)
    } catch {
      setNotice(`Subject code: ${subject.code}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              The subject catalog used by courses and class setup. Subjects
              store only a code and a name; counts and teachers are derived from
              courses. All records on this page are sample data.
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
              Add subject
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<LibraryBigIcon aria-hidden="true" />}
            value={usage.total}
            label="Subjects"
            hint="Catalog entries in the sample data"
          />
          <SummaryCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={usage.withCourses}
            label="With courses"
            hint="Referenced by at least one course"
          />
          <SummaryCard
            icon={<CircleSlashIcon aria-hidden="true" />}
            value={usage.withoutCourses}
            label="No courses"
            hint="Catalog entries not used yet"
          />
          <SummaryCard
            icon={<LayersIcon aria-hidden="true" />}
            value={usage.courseLinks}
            label="Course links"
            hint="Classes and programs by subject"
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
              <CardTitle>Subject catalog</CardTitle>
              <CardDescription>
                Search by subject code or name. {filteredSubjects.length}{" "}
                {filteredSubjects.length === 1 ? "subject" : "subjects"} match
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
                  placeholder="Search by code or name"
                  aria-label="Search subjects"
                  className="pl-8"
                />
              </div>

              <Select
                items={subjectCoverageFilterOptions}
                value={coverageFilter}
                onValueChange={(value) => setCoverageFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by course coverage"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjectCoverageFilterOptions.map((option) => (
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
                  Code
                </TableHead>
                <TableHead className="text-muted-foreground">Subject</TableHead>
                <TableHead className="text-muted-foreground">Courses</TableHead>
                <TableHead className="text-muted-foreground">
                  Teachers
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Branches
                </TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <SubjectTableSkeleton />
              ) : visibleSubjects.length > 0 ? (
                visibleSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="py-3 pl-4 sm:pl-6">
                      {subject.code ? (
                        <Badge variant="outline" className="rounded-full">
                          {subject.code}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No code
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                          <LibraryBigIcon aria-hidden="true" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={() => openSubject(subject)}
                            className="w-fit max-w-[240px] truncate text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {subject.name}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {subject.courseCount === 0
                              ? "Not used by a course yet"
                              : `${subject.classCount} ${
                                  subject.classCount === 1 ? "class" : "classes"
                                } · ${subject.programCount} ${
                                  subject.programCount === 1
                                    ? "program"
                                    : "programs"
                                }`}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <BookOpenIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {subject.courseCount}
                        </span>
                        <span className="text-muted-foreground">
                          {subject.courseCount === 1 ? "course" : "courses"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <PresentationIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {subject.lecturerCount}
                        </span>
                        <span className="text-muted-foreground">
                          {subject.lecturerCount === 1 ? "teacher" : "teachers"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {subject.branchNames.length > 0 ? (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {subject.branchNames.map((branchName) => (
                            <Badge
                              key={branchName}
                              variant="outline"
                              className="rounded-full text-xs"
                            >
                              {branchName}
                            </Badge>
                          ))}
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
                              aria-label={`Actions for ${subject.name}`}
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
                              {subject.code ?? "No code"}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => openSubject(subject)}
                            >
                              <EyeIcon aria-hidden="true" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(subject)}>
                              <PencilIcon aria-hidden="true" />
                              Edit subject (demo)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyCode(subject)}
                              disabled={!subject.code}
                            >
                              <CopyIcon aria-hidden="true" />
                              Copy code
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setNotice(
                                  `Adding a course under “${subject.name}” is a placeholder in this UI demo. Use Create class or Create program on Courses & Classes.`
                                )
                              }
                            >
                              <BookOpenIcon aria-hidden="true" />
                              Add course (demo)
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <LibraryBigIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No subjects match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term or course coverage filter.
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
              {filteredSubjects.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredSubjects.length)}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">
                    {filteredSubjects.length}
                  </span>{" "}
                  subjects
                </>
              ) : (
                "No subjects to show"
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
            Subjects only store an optional unique code and a required name.
            Course counts, branches and teachers are derived from linked course
            records. This page uses local mock data only; actions do not
            persist.
          </span>
        </div>
      </div>

      <SubjectDetailSheet
        subject={selectedSubject}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <SubjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        subject={editingSubject}
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

function SubjectTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <Skeleton className="h-5 w-12 rounded-full" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
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
