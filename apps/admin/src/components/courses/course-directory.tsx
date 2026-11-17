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
  BoxesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  GraduationCapIcon,
  InfoIcon,
  LayersIcon,
  MapPinIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"

import { CourseCreateDialog } from "@/components/courses/course-create-dialog"
import { CourseDetailSheet } from "@/components/courses/course-detail-sheet"
import { CourseStatusBadge } from "@/components/courses/course-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  courseBranchFilterOptions,
  courseDeliveryFilterOptions,
  courseGradeFilterOptions,
  courseKindLabels,
  courseKindTabs,
  courseLecturerFilterOptions,
  courseStatusFilterOptions,
  courseSubjectFilterOptions,
  courseTermFilterOptions,
  courses,
  deliveryModeLabels,
  getCourseEnrollmentCounts,
  getCourseTermLabel,
  learningModeLabels,
  type CourseKind,
  type CourseRecord,
} from "@/lib/courses-data"
import { formatDisplayDate } from "@/lib/students-data"

const PAGE_SIZE = 8

type KindFilter = "all" | CourseKind

export function CourseDirectory() {
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [termFilter, setTermFilter] = useState("all")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [deliveryFilter, setDeliveryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedCourse, setSelectedCourse] = useState<CourseRecord | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CourseKind>("class")
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [
    search,
    kindFilter,
    branchFilter,
    subjectFilter,
    gradeFilter,
    termFilter,
    lecturerFilter,
    deliveryFilter,
    statusFilter,
  ])

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

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase()

    return courses.filter((course) => {
      const matchesSearch =
        query.length === 0 ||
        [
          course.name,
          course.subjectName,
          course.branchName,
          course.courseGroupName ?? "",
          course.batchLabel ?? "",
          course.termName ?? "",
          ...course.lecturers.map((item) => item.fullName),
          ...course.gradeNames,
        ].some((value) => value.toLowerCase().includes(query))

      const matchesKind = kindFilter === "all" || course.kind === kindFilter
      const matchesBranch =
        branchFilter === "all" || course.branchId === branchFilter
      const matchesSubject =
        subjectFilter === "all" || course.subjectId === subjectFilter
      const matchesGrade =
        gradeFilter === "all" || course.gradeIds.includes(gradeFilter)
      const matchesTerm = termFilter === "all" || course.termId === termFilter
      const matchesLecturer =
        lecturerFilter === "all" ||
        course.lecturers.some((item) => item.lecturerId === lecturerFilter)
      const matchesDelivery =
        deliveryFilter === "all" || course.deliveryMode === deliveryFilter
      const matchesStatus =
        statusFilter === "all" || course.status === statusFilter

      return (
        matchesSearch &&
        matchesKind &&
        matchesBranch &&
        matchesSubject &&
        matchesGrade &&
        matchesTerm &&
        matchesLecturer &&
        matchesDelivery &&
        matchesStatus
      )
    })
  }, [
    search,
    kindFilter,
    branchFilter,
    subjectFilter,
    gradeFilter,
    termFilter,
    lecturerFilter,
    deliveryFilter,
    statusFilter,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleCourses = filteredCourses.slice(
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
    kindFilter !== "all" ||
    branchFilter !== "all" ||
    subjectFilter !== "all" ||
    gradeFilter !== "all" ||
    termFilter !== "all" ||
    lecturerFilter !== "all" ||
    deliveryFilter !== "all" ||
    statusFilter !== "all"

  const classCount = courses.filter((course) => course.kind === "class").length
  const programCount = courses.filter(
    (course) => course.kind === "program"
  ).length
  const activeCount = courses.filter(
    (course) => course.status === "active"
  ).length
  const activeEnrollments = courses.reduce(
    (total, course) => total + getCourseEnrollmentCounts(course.id).active,
    0
  )

  function clearFilters() {
    setSearch("")
    setKindFilter("all")
    setBranchFilter("all")
    setSubjectFilter("all")
    setGradeFilter("all")
    setTermFilter("all")
    setLecturerFilter("all")
    setDeliveryFilter("all")
    setStatusFilter("all")
  }

  function openCourse(course: CourseRecord) {
    setSelectedCourse(course)
    setDetailOpen(true)
  }

  function openCreate(kind: CourseKind) {
    setCreateKind(kind)
    setCreateOpen(true)
  }

  async function copyCourseReference(course: CourseRecord) {
    try {
      await navigator.clipboard.writeText(course.id)
      setNotice(`${course.id} copied to the clipboard.`)
    } catch {
      setNotice(`Course reference: ${course.id}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Courses &amp; Classes
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Course and class directory across branches, with grade, teacher,
              term and fee context. All records on this page are sample data.
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
            <Button variant="outline" onClick={() => openCreate("program")}>
              <BoxesIcon data-icon="inline-start" />
              Create program
            </Button>
            <Button onClick={() => openCreate("class")}>
              <PlusIcon data-icon="inline-start" />
              Create class
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<GraduationCapIcon aria-hidden="true" />}
            value={classCount}
            label="Classes"
            hint="Schedule-based course records"
          />
          <SummaryCard
            icon={<BoxesIcon aria-hidden="true" />}
            value={programCount}
            label="Programs"
            hint="Scheduled or self-paced"
          />
          <SummaryCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={activeCount}
            label="Active courses"
            hint={`${courses.length} total sample courses`}
          />
          <SummaryCard
            icon={<UsersRoundIcon aria-hidden="true" />}
            value={activeEnrollments}
            label="Active enrollments"
            hint="Derived from the student mock data"
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
              <CardTitle>Course directory</CardTitle>
              <CardDescription>
                Search by course, group, subject, teacher or grade.{" "}
                {filteredCourses.length}{" "}
                {filteredCourses.length === 1 ? "course" : "courses"} match the
                current filters.
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

          <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3 sm:px-6">
            <KindChip
              label="All courses"
              count={courses.length}
              isActive={kindFilter === "all"}
              onClick={() => setKindFilter("all")}
            />
            {courseKindTabs.map((tab) => (
              <KindChip
                key={tab.value}
                label={tab.label}
                count={tab.value === "class" ? classCount : programCount}
                isActive={kindFilter === tab.value}
                onClick={() => setKindFilter(tab.value)}
              />
            ))}
          </div>

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
                  placeholder="Search courses"
                  aria-label="Search courses"
                  className="pl-8"
                />
              </div>

              <Select
                items={courseBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseSubjectFilterOptions}
                value={subjectFilter}
                onValueChange={(value) => setSubjectFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by subject"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseSubjectFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseGradeFilterOptions}
                value={gradeFilter}
                onValueChange={(value) => setGradeFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseGradeFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseTermFilterOptions}
                value={termFilter}
                onValueChange={(value) => setTermFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by academic term"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseTermFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseLecturerFilterOptions}
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
                  {courseLecturerFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseDeliveryFilterOptions}
                value={deliveryFilter}
                onValueChange={(value) => setDeliveryFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by delivery mode"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseDeliveryFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseStatusFilterOptions.map((option) => (
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
                  Course
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Kind &amp; mode
                </TableHead>
                <TableHead className="text-muted-foreground">Subject</TableHead>
                <TableHead className="text-muted-foreground">Branch</TableHead>
                <TableHead className="text-muted-foreground">Grades</TableHead>
                <TableHead className="text-muted-foreground">
                  Teacher(s)
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Term / intake
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Enrolled / capacity
                </TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <CourseTableSkeleton />
              ) : visibleCourses.length > 0 ? (
                visibleCourses.map((course) => {
                  const counts = getCourseEnrollmentCounts(course.id)
                  const primaryLecturer = course.lecturers.find(
                    (item) => item.isPrimary
                  )
                  const coTeacherCount = course.lecturers.length - 1

                  return (
                    <TableRow key={course.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                            {course.kind === "class" ? (
                              <GraduationCapIcon aria-hidden="true" />
                            ) : (
                              <BoxesIcon aria-hidden="true" />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <button
                              type="button"
                              onClick={() => openCourse(course)}
                              className="w-fit max-w-[240px] truncate text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {course.name}
                            </button>
                            <span className="truncate text-xs text-muted-foreground">
                              {course.courseGroupName ?? "Standalone course"}
                              {course.batchLabel
                                ? ` · ${course.batchLabel}`
                                : ""}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className="w-fit rounded-full"
                          >
                            {courseKindLabels[course.kind]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {course.kind === "class"
                              ? "Scheduled"
                              : learningModeLabels[course.learningMode]}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>{course.subjectName}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPinIcon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span>{course.branchName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {deliveryModeLabels[course.deliveryMode]}
                        </span>
                      </TableCell>

                      <TableCell>
                        {course.gradeNames.length > 0 ? (
                          <div className="flex max-w-[180px] flex-wrap gap-1">
                            {course.gradeNames.map((gradeName) => (
                              <Badge
                                key={gradeName}
                                variant="outline"
                                className="rounded-full text-xs"
                              >
                                {gradeName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Not grade-bound
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        {primaryLecturer ? (
                          <div className="flex max-w-[200px] flex-col">
                            <span className="truncate">
                              {primaryLecturer.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {coTeacherCount > 0
                                ? `+ ${coTeacherCount} co-${
                                    coTeacherCount === 1
                                      ? "teacher"
                                      : "teachers"
                                  }`
                                : "Primary teacher"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {getCourseTermLabel(course)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <LayersIcon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="tabular-nums">
                            {counts.active}
                            {course.capacity !== null
                              ? ` / ${course.capacity}`
                              : " / no limit"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {counts.total === 0
                            ? "No sample enrollments"
                            : `${counts.total} total enrollment${
                                counts.total === 1 ? "" : "s"
                              }`}
                        </span>
                      </TableCell>

                      <TableCell>
                        <CourseStatusBadge status={course.status} />
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${course.name}`}
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
                                {courseKindLabels[course.kind]}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openCourse(course)}
                              >
                                <EyeIcon aria-hidden="true" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyCourseReference(course)}
                              >
                                <CopyIcon aria-hidden="true" />
                                Copy course reference
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setNotice(
                                    `Editing “${course.name}” is a placeholder in this UI demo. No record was changed.`
                                  )
                                }
                              >
                                <BookOpenIcon aria-hidden="true" />
                                Edit setup (demo)
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <BookOpenIcon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No courses match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, kind, branch, subject,
                          grade, term, teacher, delivery mode or status.
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
              {filteredCourses.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredCourses.length)}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">{filteredCourses.length}</span>{" "}
                  courses
                </>
              ) : (
                "No courses to show"
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
            Classes are always scheduled and keep an attendance register.
            Self-paced programs have no attendance, and scheduled programs need
            an intake before enrollment. Fees and dates follow the organization
            defaults (LKR, Asia/Colombo). This page uses local mock data only;
            actions do not persist.
          </span>
        </div>
      </div>

      <CourseDetailSheet
        course={selectedCourse}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <CourseCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialKind={createKind}
        onCreated={(message) => setNotice(message)}
      />
    </main>
  )
}

function KindChip({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={
        isActive
          ? "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          : "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      }
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
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
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}

function CourseTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
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
