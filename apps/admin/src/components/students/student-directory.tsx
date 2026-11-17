"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  InfoIcon,
  Link2Icon,
  MapPinIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UserRoundPlusIcon,
  XIcon,
} from "lucide-react"

import { AddStudentDialog } from "@/components/students/add-student-dialog"
import { StudentDetailSheet } from "@/components/students/student-detail-sheet"
import { StudentStatusBadge } from "@/components/students/student-status-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  branchFilterOptions,
  calculateAge,
  courseFilterOptions,
  formatDisplayDate,
  getActiveEnrollmentCount,
  getGradeAsOf,
  getInitials,
  getPrimaryBranch,
  gradeFilterOptions,
  GUARDIAN_REQUIRED_BELOW_AGE,
  stageLabel,
  statusFilterOptions,
  students,
  type StudentRecord,
} from "@/lib/students-data"

const PAGE_SIZE = 8

export function StudentDirectory() {
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, branchFilter, statusFilter, gradeFilter, courseFilter])

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

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch =
        query.length === 0 ||
        [
          student.studentNo,
          student.fullName,
          student.contactEmail ?? "",
          student.contactPhone ?? "",
          ...student.guardians.map((guardian) => guardian.phone),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesBranch =
        branchFilter === "all" ||
        student.branches.some((branch) => branch.branchName === branchFilter)

      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter

      const currentGrade = getGradeAsOf(student)
      const matchesGrade =
        gradeFilter === "all" ||
        (gradeFilter === "no-grade"
          ? !currentGrade
          : currentGrade?.gradeName === gradeFilter)

      const matchesCourse =
        courseFilter === "all" ||
        student.enrollments.some(
          (enrollment) => enrollment.courseId === courseFilter
        )

      return (
        matchesSearch &&
        matchesBranch &&
        matchesStatus &&
        matchesGrade &&
        matchesCourse
      )
    })
  }, [search, branchFilter, statusFilter, gradeFilter, courseFilter])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleStudents = filteredStudents.slice(
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
    gradeFilter !== "all" ||
    courseFilter !== "all"

  const activeStudents = students.filter(
    (student) => student.status === "active"
  ).length
  const newThisMonth = students.filter((student) =>
    student.createdAt.startsWith("2026-11")
  ).length
  const guardianRequired = students.filter(
    (student) => calculateAge(student.dateOfBirth) < GUARDIAN_REQUIRED_BELOW_AGE
  ).length
  const portalLinked = students.filter((student) => student.portalLinked).length

  function clearFilters() {
    setSearch("")
    setBranchFilter("all")
    setStatusFilter("all")
    setGradeFilter("all")
    setCourseFilter("all")
  }

  function openStudent(student: StudentRecord) {
    setSelectedStudent(student)
    setDetailOpen(true)
  }

  async function copyStudentNumber(student: StudentRecord) {
    try {
      await navigator.clipboard.writeText(student.studentNo)
      setNotice(`${student.studentNo} copied to the clipboard.`)
    } catch {
      setNotice(`Student number: ${student.studentNo}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Student directory across all branches, with grade, guardian and
              enrollment context. All records on this page are sample data.
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
            <Button onClick={() => setAddStudentOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Add student
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<GraduationCapIcon aria-hidden="true" />}
            value={activeStudents}
            label="Active students"
            hint={`${students.length} student profiles`}
          />
          <SummaryCard
            icon={<UserRoundPlusIcon aria-hidden="true" />}
            value={newThisMonth}
            label="New this month"
            hint="Registrations in November 2026"
          />
          <SummaryCard
            icon={<HeartHandshakeIcon aria-hidden="true" />}
            value={guardianRequired}
            label="Under 16"
            hint={`Guardian required below age ${GUARDIAN_REQUIRED_BELOW_AGE}`}
          />
          <SummaryCard
            icon={<Link2Icon aria-hidden="true" />}
            value={portalLinked}
            label="Portal linked"
            hint="Students with a linked user"
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
              <CardTitle>Student directory</CardTitle>
              <CardDescription>
                Search by student number, name or contact.{" "}
                {filteredStudents.length}{" "}
                {filteredStudents.length === 1 ? "student" : "students"} match
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search students"
                  aria-label="Search students"
                  className="pl-8"
                />
              </div>

              <Select
                items={branchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={statusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={gradeFilterOptions}
                value={gradeFilter}
                onValueChange={(value) => setGradeFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradeFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={courseFilterOptions}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by course">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseFilterOptions.map((option) => (
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
                  Student
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Grade today
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Primary branch
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Active enrollments
                </TableHead>
                <TableHead className="text-muted-foreground">Contact</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <StudentTableSkeleton />
              ) : visibleStudents.length > 0 ? (
                visibleStudents.map((student) => {
                  const currentGrade = getGradeAsOf(student)
                  const primaryBranch = getPrimaryBranch(student)

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs">
                              {getInitials(student.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <button
                              type="button"
                              onClick={() => openStudent(student)}
                              className="w-fit text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {student.fullName}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              {student.studentNo}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {currentGrade ? (
                          <div className="flex flex-col">
                            <span>{currentGrade.gradeName}</span>
                            <span className="text-xs text-muted-foreground">
                              {stageLabel(currentGrade.stage)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span>No grade</span>
                            <span className="text-xs text-muted-foreground">
                              {student.status === "alumni"
                                ? "Alumni — no current grade"
                                : "Program enrolment"}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {primaryBranch ? (
                          <div className="flex items-center gap-1.5">
                            <MapPinIcon
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span>{primaryBranch.branchName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="tabular-nums">
                          {getActiveEnrollmentCount(student)}
                        </span>{" "}
                        <span className="text-muted-foreground">active</span>
                      </TableCell>

                      <TableCell>
                        <div className="flex max-w-[220px] flex-col">
                          <span>
                            {student.contactPhone ?? "No phone recorded"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {student.contactEmail ?? "No email recorded"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StudentStatusBadge status={student.status} />
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(student.createdAt)}
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${student.fullName}`}
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
                                {student.studentNo}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openStudent(student)}
                              >
                                <EyeIcon aria-hidden="true" />
                                View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyStudentNumber(student)}
                              >
                                <CopyIcon aria-hidden="true" />
                                Copy student number
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setNotice(
                                    `Profile export for ${student.fullName} is a placeholder. No file was generated.`
                                  )
                                }
                              >
                                <DownloadIcon aria-hidden="true" />
                                Export profile (placeholder)
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
                  <TableCell colSpan={8} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <GraduationCapIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No students match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, branch, status, grade or
                          course.
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
              {filteredStudents.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredStudents.length)}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">
                    {filteredStudents.length}
                  </span>{" "}
                  students
                </>
              ) : (
                "No students to show"
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
            Amounts and dates follow the organization defaults (LKR,
            Asia/Colombo). Grade is derived from the dated grade history, not
            stored on the student profile. This page uses local mock data only;
            actions do not persist.
          </span>
        </div>
      </div>

      <StudentDetailSheet
        student={selectedStudent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <AddStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
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

function StudentTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-10" />
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
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
