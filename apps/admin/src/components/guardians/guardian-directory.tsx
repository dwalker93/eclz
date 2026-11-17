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
  Link2OffIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UserRoundXIcon,
  XIcon,
} from "lucide-react"

import { GuardianDetailSheet } from "@/components/guardians/guardian-detail-sheet"
import { GuardianFormDialog } from "@/components/guardians/guardian-form-dialog"
import { GuardianPortalBadge } from "@/components/guardians/guardian-portal-badge"
import { usePagination } from "@/hooks/use-pagination"
import {
  getLinkedStudents,
  getRelationshipSummary,
  guardianLinkFilterOptions,
  guardianPortalFilterOptions,
  guardians,
  type GuardianRecord,
} from "@/lib/guardians-data"
import { formatDisplayDate, getInitials } from "@/lib/students-data"

const PAGE_SIZE = 8

export function GuardianDirectory() {
  const [search, setSearch] = useState("")
  const [portalFilter, setPortalFilter] = useState("all")
  const [linkFilter, setLinkFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedGuardian, setSelectedGuardian] =
    useState<GuardianRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingGuardian, setEditingGuardian] = useState<GuardianRecord | null>(
    null
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, portalFilter, linkFilter])

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

  const filteredGuardians = useMemo(() => {
    const query = search.trim().toLowerCase()

    return guardians.filter((guardian) => {
      const linkedStudents = getLinkedStudents(guardian)
      const matchesSearch =
        query.length === 0 ||
        [
          guardian.fullName,
          guardian.phone ?? "",
          guardian.email ?? "",
          guardian.nic ?? "",
          guardian.address ?? "",
          ...linkedStudents.flatMap((student) => [
            student.fullName,
            student.studentNo,
          ]),
        ].some((value) => value.toLowerCase().includes(query))

      const matchesPortal =
        portalFilter === "all" ||
        (portalFilter === "enabled"
          ? guardian.portalEnabled
          : !guardian.portalEnabled)

      const matchesLink =
        linkFilter === "all" ||
        (linkFilter === "linked"
          ? guardian.links.length > 0
          : guardian.links.length === 0)

      return matchesSearch && matchesPortal && matchesLink
    })
  }, [search, portalFilter, linkFilter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGuardians.length / PAGE_SIZE)
  )
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const visibleGuardians = filteredGuardians.slice(
    startIndex,
    startIndex + PAGE_SIZE
  )

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  const hasActiveFilters =
    search.length > 0 || portalFilter !== "all" || linkFilter !== "all"

  const linkedGuardians = guardians.filter(
    (guardian) => guardian.links.length > 0
  ).length
  const unlinkedGuardians = guardians.length - linkedGuardians
  const portalEnabled = guardians.filter(
    (guardian) => guardian.portalEnabled
  ).length

  function clearFilters() {
    setSearch("")
    setPortalFilter("all")
    setLinkFilter("all")
  }

  function openGuardian(guardian: GuardianRecord) {
    setSelectedGuardian(guardian)
    setDetailOpen(true)
  }

  function openAddDialog() {
    setEditingGuardian(null)
    setFormOpen(true)
  }

  function openEditDialog(guardian: GuardianRecord) {
    setEditingGuardian(guardian)
    setDetailOpen(false)
    setFormOpen(true)
  }

  async function copyPhone(guardian: GuardianRecord) {
    if (!guardian.phone) return

    try {
      await navigator.clipboard.writeText(guardian.phone)
      setNotice(`${guardian.phone} copied to the clipboard.`)
    } catch {
      setNotice(`Phone: ${guardian.phone}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Guardians</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Guardian directory with contact details, linked students and
              parent portal access. A guardian can exist without a student link
              or a login. All records on this page are sample data.
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
              Add guardian
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<HeartHandshakeIcon aria-hidden="true" />}
            value={guardians.length}
            label="Guardians"
            hint="Profiles across all students"
          />
          <SummaryCard
            icon={<GraduationCapIcon aria-hidden="true" />}
            value={linkedGuardians}
            label="Linked to students"
            hint="At least one student relationship"
          />
          <SummaryCard
            icon={<UserRoundXIcon aria-hidden="true" />}
            value={unlinkedGuardians}
            label="Awaiting link"
            hint="Profiles kept without a student"
          />
          <SummaryCard
            icon={<Link2Icon aria-hidden="true" />}
            value={portalEnabled}
            label="Portal enabled"
            hint="Parent portal logins allowed"
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
              <CardTitle>Guardian directory</CardTitle>
              <CardDescription>
                Search by name, phone, email, NIC or linked student.{" "}
                {filteredGuardians.length}{" "}
                {filteredGuardians.length === 1 ? "guardian" : "guardians"}{" "}
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
                  placeholder="Search guardians"
                  aria-label="Search guardians"
                  className="pl-8"
                />
              </div>

              <Select
                items={guardianLinkFilterOptions}
                value={linkFilter}
                onValueChange={(value) => setLinkFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by student link"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {guardianLinkFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={guardianPortalFilterOptions}
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
                  {guardianPortalFilterOptions.map((option) => (
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
                  Guardian
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Phone / email
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Linked students
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Relationship / primary
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Portal status
                </TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRefreshing ? (
                <GuardianTableSkeleton />
              ) : visibleGuardians.length > 0 ? (
                visibleGuardians.map((guardian) => {
                  const linkedStudents = getLinkedStudents(guardian)
                  const relationship = getRelationshipSummary(guardian)

                  return (
                    <TableRow key={guardian.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs">
                              {getInitials(guardian.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col">
                            <button
                              type="button"
                              onClick={() => openGuardian(guardian)}
                              className="w-fit text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {guardian.fullName}
                            </button>
                            <span className="truncate text-xs text-muted-foreground">
                              Guardian since{" "}
                              {formatDisplayDate(guardian.createdAt)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex max-w-[220px] flex-col">
                          <span>{guardian.phone ?? "No phone recorded"}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {guardian.email ?? "No email recorded"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {linkedStudents.length > 0 ? (
                          <div className="flex max-w-[220px] flex-col">
                            <span>
                              {linkedStudents.length}{" "}
                              {linkedStudents.length === 1
                                ? "student"
                                : "students"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {linkedStudents[0]?.fullName}
                              {linkedStudents.length > 1
                                ? ` +${linkedStudents.length - 1} more`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span>No students linked</span>
                            <span className="text-xs text-muted-foreground">
                              Profile kept for later linking
                            </span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {guardian.links.length > 0 ? (
                          <div className="flex flex-col">
                            <span>{relationship.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {guardian.links.length === 1
                                ? relationship.primaryCount === 1
                                  ? "Primary guardian"
                                  : "Additional guardian"
                                : `${relationship.primaryCount} of ${guardian.links.length} primary`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <GuardianPortalBadge guardian={guardian} />
                      </TableCell>

                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${guardian.fullName}`}
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
                                {guardian.fullName}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openGuardian(guardian)}
                              >
                                <EyeIcon aria-hidden="true" />
                                View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditDialog(guardian)}
                              >
                                <PencilIcon aria-hidden="true" />
                                Edit guardian
                              </DropdownMenuItem>
                              {guardian.phone ? (
                                <DropdownMenuItem
                                  onClick={() => copyPhone(guardian)}
                                >
                                  <CopyIcon aria-hidden="true" />
                                  Copy phone number
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setNotice(
                                    guardian.portalEnabled
                                      ? `Parent portal access for ${guardian.fullName} is managed under Users & Roles and needs the parent portal module. No account changes were made.`
                                      : `${guardian.fullName} has no parent portal login. Accounts are linked under Users & Roles; the guardian profile is kept.`
                                  )
                                }
                              >
                                {guardian.portalEnabled ? (
                                  <Link2Icon aria-hidden="true" />
                                ) : (
                                  <Link2OffIcon aria-hidden="true" />
                                )}
                                Parent portal (placeholder)
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
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <HeartHandshakeIcon
                          className="size-5"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">
                          No guardians match these filters
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search term, student link or portal
                          state.
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
              {filteredGuardians.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="tabular-nums">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, filteredGuardians.length)}
                  </span>{" "}
                  of{" "}
                  <span className="tabular-nums">
                    {filteredGuardians.length}
                  </span>{" "}
                  guardians
                </>
              ) : (
                "No guardians to show"
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
            A student may have only one primary guardian, while one guardian may
            be linked to several students. A parent portal login is optional and
            also needs the parent portal module. This page uses local mock data
            only; actions do not persist.
          </span>
        </div>
      </div>

      <GuardianDetailSheet
        guardian={selectedGuardian}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEditDialog}
      />

      <GuardianFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        guardian={editingGuardian}
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

function GuardianTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="py-3 pl-4 sm:pl-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="pr-4 sm:pr-6">
            <Skeleton className="ml-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
