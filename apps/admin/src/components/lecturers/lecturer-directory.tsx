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
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  Link2Icon,
  Link2OffIcon,
  PencilIcon,
  PlusIcon,
  PresentationIcon,
  RefreshCwIcon,
  SearchIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  XIcon,
} from "lucide-react"

import { LecturerDetailSheet } from "@/components/lecturers/lecturer-detail-sheet"
import { LecturerFormDialog } from "@/components/lecturers/lecturer-form-dialog"
import { LecturerPortalBadge } from "@/components/lecturers/lecturer-portal-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  getAssignedCourses,
  lecturerBranchFilterOptions,
  lecturerPortalFilterOptions,
  lecturers,
  type LecturerRecord,
} from "@/lib/lecturers-data"
import { formatDisplayDate, getInitials } from "@/lib/students-data"

const PAGE_SIZE = 8

export function LecturerDirectory() {
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [portalFilter, setPortalFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedLecturer, setSelectedLecturer] =
    useState<LecturerRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingLecturer, setEditingLecturer] = useState<LecturerRecord | null>(
    null
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, branchFilter, portalFilter])

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

  const filteredLecturers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return lecturers.filter((lecturer) => {
      const matchesSearch =
        query.length === 0 ||
        [
          lecturer.fullName,
          lecturer.qualification,
          lecturer.bio,
          lecturer.accountEmail ?? "",
          lecturer.accountUsername ?? "",
          ...lecturer.branches.map((branch) => branch.branchName),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesBranch =
        branchFilter === "all" ||
        lecturer.branches.some((branch) => branch.branchName === branchFilter)

      const matchesPortal =
        portalFilter === "all" ||
        (portalFilter === "enabled"
          ? lecturer.portalEnabled
          : !lecturer.portalEnabled)

      return matchesSearch && matchesBranch && matchesPortal
    })
  }, [search, branchFilter, portalFilter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLecturers.length / PAGE_SIZE)
  )
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleLecturers = filteredLecturers.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 || branchFilter !== "all" || portalFilter !== "all"

  const portalEnabled = lecturers.filter(
    (lecturer) => lecturer.portalEnabled
  ).length
  const portalDisabled = lecturers.length - portalEnabled
  const totalAssignments = lecturers.reduce(
    (total, lecturer) => total + lecturer.assignments.length,
    0
  )
  const courseLecturerCounts = new Map<string, number>()
  for (const lecturer of lecturers) {
    for (const assignment of lecturer.assignments) {
      courseLecturerCounts.set(
        assignment.courseId,
        (courseLecturerCounts.get(assignment.courseId) ?? 0) + 1
      )
    }
  }
  const coursesWithCoTeachers = [...courseLecturerCounts.values()].filter(
    (count) => count > 1
  ).length

  function clearFilters() {
    setSearch("")
    setBranchFilter("all")
    setPortalFilter("all")
  }

  function openLecturer(lecturer: LecturerRecord) {
    setSelectedLecturer(lecturer)
    setDetailOpen(true)
  }

  function openAddDialog() {
    setEditingLecturer(null)
    setFormOpen(true)
  }

  function openEditDialog(lecturer: LecturerRecord) {
    setEditingLecturer(lecturer)
    setDetailOpen(false)
    setFormOpen(true)
  }

  async function copyAccountEmail(lecturer: LecturerRecord) {
    if (!lecturer.accountEmail) return

    try {
      await navigator.clipboard.writeText(lecturer.accountEmail)
      setNotice(`${lecturer.accountEmail} copied to the clipboard.`)
    } catch {
      setNotice(`Account email: ${lecturer.accountEmail}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Lecturers</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Lecturer profiles, branch membership and course assignments.
              Portal access only controls login — profiles and history are
              always kept. All records on this page are sample data.
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
            <Button onClick={openAddDialog}>
              <PlusIcon data-icon="inline-start" />
              Add lecturer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<PresentationIcon aria-hidden="true" />}
            value={lecturers.length}
            label="Lecturers"
            hint={`${totalAssignments} course assignments`}
          />
          <SummaryCard
            icon={<UserRoundCheckIcon aria-hidden="true" />}
            value={portalEnabled}
            label="Portal enabled"
            hint="Linked user accounts can log in"
          />
          <SummaryCard
            icon={<UserRoundXIcon aria-hidden="true" />}
            value={portalDisabled}
            label="Portal off"
            hint="Profiles kept without login"
          />
          <SummaryCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={coursesWithCoTeachers}
            label="Co-taught courses"
            hint="Shares per course sum to 100%"
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
              <CardTitle>Lecturer directory</CardTitle>
              <CardDescription>
                Search by name, qualification, biography or account email.{" "}
                {filteredLecturers.length}{" "}
                {filteredLecturers.length === 1 ? "lecturer" : "lecturers"}{" "}
                match the current filters.
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))_auto]">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search lecturers"
                  aria-label="Search lecturers"
                  className="pl-8"
                />
              </div>

              <Select
                items={lecturerBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lecturerBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={lecturerPortalFilterOptions}
                value={portalFilter}
                onValueChange={(value) => setPortalFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by portal access"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lecturerPortalFilterOptions.map((option) => (
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
                <TableHead className="text-muted-foreground">
                  Qualification
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Branches
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Assigned courses
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Portal status
                </TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <LecturerTableSkeleton />
              ) : visibleLecturers.length > 0 ? (
                visibleLecturers.map((lecturer) => {
                  const assignedCourses = getAssignedCourses(lecturer)

                  return (
                    <TableRow key={lecturer.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs">
                              {getInitials(lecturer.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <button
                              type="button"
                              onClick={() => openLecturer(lecturer)}
                              className="w-fit text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {lecturer.fullName}
                            </button>
                            <span className="truncate text-xs text-muted-foreground">
                              {lecturer.accountEmail ?? "No account linked"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="block max-w-[200px]">
                          {lecturer.qualification}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {lecturer.branches.slice(0, 2).map((branch) => (
                            <Badge
                              key={branch.branchId}
                              variant="secondary"
                              className="rounded-full"
                            >
                              {branch.branchName}
                            </Badge>
                          ))}
                          {lecturer.branches.length > 2 ? (
                            <Badge variant="outline" className="rounded-full">
                              +{lecturer.branches.length - 2}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        {assignedCourses.length > 0 ? (
                          <div className="flex max-w-[220px] flex-col">
                            <span>
                              {assignedCourses.length}{" "}
                              {assignedCourses.length === 1
                                ? "course"
                                : "courses"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {assignedCourses[0]?.courseName}
                              {assignedCourses.length > 1
                                ? ` +${assignedCourses.length - 1} more`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span>No courses</span>
                            <span className="text-xs text-muted-foreground">
                              Profile awaiting allocation
                            </span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <LecturerPortalBadge lecturer={lecturer} />
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(lecturer.createdAt)}
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${lecturer.fullName}`}
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
                              <DropdownMenuLabel>
                                {lecturer.fullName}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openLecturer(lecturer)}
                              >
                                <EyeIcon aria-hidden="true" />
                                View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditDialog(lecturer)}
                              >
                                <PencilIcon aria-hidden="true" />
                                Edit lecturer
                              </DropdownMenuItem>
                              {lecturer.accountEmail ? (
                                <DropdownMenuItem
                                  onClick={() => copyAccountEmail(lecturer)}
                                >
                                  <CopyIcon aria-hidden="true" />
                                  Copy account email
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setNotice(
                                    lecturer.portalEnabled
                                      ? `Portal access for ${lecturer.fullName} is managed under Users & Roles. No account changes were made.`
                                      : `${lecturer.fullName} has no linked account. Account linking happens under Users & Roles; the lecturer profile is kept.`
                                  )
                                }
                              >
                                {lecturer.portalEnabled ? (
                                  <Link2Icon aria-hidden="true" />
                                ) : (
                                  <Link2OffIcon aria-hidden="true" />
                                )}
                                Account access (placeholder)
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
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <PresentationIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No lecturers match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, branch or portal state.
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
              {filteredLecturers.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredLecturers.length)}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">
                    {filteredLecturers.length}
                  </span>{" "}
                  lecturers
                </>
              ) : (
                "No lecturers to show"
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
            Course shares are per course and sum to 100%. Portal access is an
            account concern only; disabling it keeps the lecturer profile,
            branch membership and course history. This page uses local mock data
            only; actions do not persist.
          </span>
        </div>
      </div>

      <LecturerDetailSheet
        lecturer={selectedLecturer}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEditDialog}
      />

      <LecturerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lecturer={editingLecturer}
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

function LecturerTableSkeleton() {
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
            <Skeleton className="h-3.5 w-28" />
          </TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3 w-36" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
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
