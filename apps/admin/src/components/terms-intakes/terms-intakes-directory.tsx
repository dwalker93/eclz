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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
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
  BookOpenIcon,
  BoxesIcon,
  CalendarPlusIcon,
  CalendarRangeIcon,
  CircleDotIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { IntakeStatusBadge } from "@/components/courses/course-status-badge"
import { IntakeFormDialog } from "@/components/terms-intakes/intake-form-dialog"
import { TermFormDialog } from "@/components/terms-intakes/term-form-dialog"
import { formatDisplayDate } from "@/lib/students-data"
import {
  getCurrentTerm,
  getIntakeUsageCounts,
  intakeDirectory,
  intakeProgramFilterOptions,
  intakeStatusFilterOptions,
  termDirectory,
  type IntakeDirectoryRecord,
  type TermDirectoryRecord,
} from "@/lib/terms-intakes-data"

type TabKey = "terms" | "intakes"

export function TermsIntakesDirectory() {
  const [activeTab, setActiveTab] = useState<TabKey>("terms")
  const [termFormOpen, setTermFormOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<TermDirectoryRecord | null>(
    null
  )
  const [intakeFormOpen, setIntakeFormOpen] = useState(false)
  const [editingIntake, setEditingIntake] =
    useState<IntakeDirectoryRecord | null>(null)
  const [search, setSearch] = useState("")
  const [programFilter, setProgramFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Lists refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const filteredIntakes = useMemo(() => {
    const query = search.trim().toLowerCase()

    return intakeDirectory.filter((intakeRecord) => {
      const matchesSearch =
        query.length === 0 ||
        [intakeRecord.name, intakeRecord.programName].some((value) =>
          value.toLowerCase().includes(query)
        )

      const matchesProgram =
        programFilter === "all" || intakeRecord.courseId === programFilter
      const matchesStatus =
        statusFilter === "all" || intakeRecord.status === statusFilter

      return matchesSearch && matchesProgram && matchesStatus
    })
  }, [search, programFilter, statusFilter])

  const hasActiveFilters =
    search.length > 0 || programFilter !== "all" || statusFilter !== "all"

  const currentTerm = getCurrentTerm()
  const usage = getIntakeUsageCounts()

  function clearFilters() {
    setSearch("")
    setProgramFilter("all")
    setStatusFilter("all")
  }

  function openTermCreate() {
    setEditingTerm(null)
    setTermFormOpen(true)
  }

  function openTermEdit(term: TermDirectoryRecord) {
    setEditingTerm(term)
    setTermFormOpen(true)
  }

  function openIntakeCreate() {
    setEditingIntake(null)
    setIntakeFormOpen(true)
  }

  function openIntakeEdit(intakeRecord: IntakeDirectoryRecord) {
    setEditingIntake(intakeRecord)
    setIntakeFormOpen(true)
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(`${label} copied to the clipboard.`)
    } catch {
      setNotice(`${label}: ${value}`)
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

    event.preventDefault()
    const nextTab: TabKey = activeTab === "terms" ? "intakes" : "terms"

    setActiveTab(nextTab)
    document
      .getElementById(nextTab === "terms" ? "terms-tab" : "intakes-tab")
      ?.focus()
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Terms &amp; Intakes
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Academic terms and program intakes are distinct concepts. Terms
              give classes a display range; intakes define enrollment windows
              for scheduled programs. All records on this page are sample data.
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
            {activeTab === "terms" ? (
              <Button onClick={openTermCreate}>
                <PlusIcon data-icon="inline-start" />
                Add academic term
              </Button>
            ) : (
              <Button onClick={openIntakeCreate}>
                <PlusIcon data-icon="inline-start" />
                Add intake
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<CalendarRangeIcon aria-hidden="true" />}
            value={termDirectory.length}
            label="Academic terms"
            hint="Display ranges for classes"
          />
          <SummaryCard
            icon={<BadgeCheckIcon aria-hidden="true" />}
            value={currentTerm ? 1 : 0}
            label="Current term"
            hint={currentTerm?.name ?? "No term marked current"}
          />
          <SummaryCard
            icon={<BoxesIcon aria-hidden="true" />}
            value={usage.total}
            label="Program intakes"
            hint="Across scheduled programs"
          />
          <SummaryCard
            icon={<CircleDotIcon aria-hidden="true" />}
            value={usage.open}
            label="Open intakes"
            hint={`${usage.running} running · ${usage.closed} closed`}
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

        <div
          role="tablist"
          aria-label="Terms and intakes"
          onKeyDown={handleTabKeyDown}
          className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/40 p-1"
        >
          <TabButton
            id="terms-tab"
            controls="terms-panel"
            isActive={activeTab === "terms"}
            icon={<CalendarRangeIcon aria-hidden="true" />}
            label="Academic terms"
            count={termDirectory.length}
            onClick={() => setActiveTab("terms")}
          />
          <TabButton
            id="intakes-tab"
            controls="intakes-panel"
            isActive={activeTab === "intakes"}
            icon={<BoxesIcon aria-hidden="true" />}
            label="Program intakes"
            count={usage.total}
            onClick={() => setActiveTab("intakes")}
          />
        </div>

        {activeTab === "terms" ? (
          <Card
            id="terms-panel"
            role="tabpanel"
            aria-labelledby="terms-tab"
            tabIndex={0}
            className="gap-0 py-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-0.5">
                <CardTitle>Academic terms</CardTitle>
                <CardDescription>
                  Name, display dates and the single current marker. End dates
                  are inclusive last days.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentTerm ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                  >
                    <BadgeCheckIcon aria-hidden="true" />
                    Current: {currentTerm.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full">
                    No current term
                  </Badge>
                )}
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
              </div>
            </CardHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                    Term
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Starts
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Ends (inclusive)
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Current
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Classes
                  </TableHead>
                  <TableHead className="w-12 pr-4 text-right sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRefreshing ? (
                  <TableSkeleton columns={6} />
                ) : termDirectory.length > 0 ? (
                  termDirectory.map((term) => (
                    <TableRow key={term.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                            <CalendarRangeIcon aria-hidden="true" />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-medium">{term.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Academic year
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(term.startsOn)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDisplayDate(term.endsOn)}
                      </TableCell>
                      <TableCell>
                        {term.isCurrent ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                          >
                            <BadgeCheckIcon aria-hidden="true" />
                            Current
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <BookOpenIcon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="tabular-nums">
                            {term.courseCount}
                          </span>
                          <span className="text-muted-foreground">
                            {term.courseCount === 1 ? "class" : "classes"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${term.name}`}
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
                              <DropdownMenuLabel>{term.name}</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openTermEdit(term)}
                              >
                                <PencilIcon aria-hidden="true" />
                                Edit term (demo)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  copyValue(term.name, "Term name")
                                }
                              >
                                <CopyIcon aria-hidden="true" />
                                Copy name
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={term.isCurrent}
                                onClick={() =>
                                  setNotice(
                                    `Only one term can be current. Use Edit term to move the current marker from “${currentTerm?.name ?? "the current term"}” — no change was made.`
                                  )
                                }
                              >
                                <BadgeCheckIcon aria-hidden="true" />
                                Set as current (demo)
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
                      <EmptyTableState
                        icon={<CalendarRangeIcon aria-hidden="true" />}
                        title="No academic terms yet"
                        description="Add an academic term to give classes a display range."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Academic term end dates are display-inclusive last days. Access
              and effectivity dates elsewhere are end-exclusive.
            </div>
          </Card>
        ) : (
          <Card
            id="intakes-panel"
            role="tabpanel"
            aria-labelledby="intakes-tab"
            tabIndex={0}
            className="gap-0 py-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-0.5">
                <CardTitle>Program intakes</CardTitle>
                <CardDescription>
                  Search by intake or program. {filteredIntakes.length}{" "}
                  {filteredIntakes.length === 1 ? "intake" : "intakes"} match
                  the current filters. Enrollment counts are sample display
                  values.
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search intakes or programs"
                    aria-label="Search intakes"
                    className="pl-8"
                  />
                </div>

                <Select
                  items={intakeProgramFilterOptions}
                  value={programFilter}
                  onValueChange={(value) => setProgramFilter(value ?? "all")}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Filter by program"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intakeProgramFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  items={intakeStatusFilterOptions}
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value ?? "all")}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Filter by status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intakeStatusFilterOptions.map((option) => (
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
                    Intake
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Program
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Date window
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Capacity
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Enrolled
                  </TableHead>
                  <TableHead className="w-12 pr-4 text-right sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRefreshing ? (
                  <TableSkeleton columns={7} />
                ) : filteredIntakes.length > 0 ? (
                  filteredIntakes.map((intakeRecord) => (
                    <TableRow key={intakeRecord.id}>
                      <TableCell className="py-3 pl-4 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                            <CalendarPlusIcon aria-hidden="true" />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-medium">
                              {intakeRecord.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Intake
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] flex-col">
                          <span className="truncate">
                            {intakeRecord.programName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {intakeRecord.programBranchName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-col">
                          <span>
                            {formatDisplayDate(intakeRecord.startsOn)} –{" "}
                            {intakeRecord.endsOn
                              ? formatDisplayDate(intakeRecord.endsOn)
                              : "open-ended"}
                          </span>
                          <span className="text-xs">Inclusive last day</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {intakeRecord.capacity === null ? (
                          <span className="text-muted-foreground">
                            No limit
                          </span>
                        ) : (
                          <span className="tabular-nums">
                            {intakeRecord.capacity} seats
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <IntakeStatusBadge status={intakeRecord.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums">
                            {intakeRecord.enrolledCount}
                          </span>
                          <span className="text-muted-foreground">
                            {intakeRecord.capacity === null
                              ? "enrolled"
                              : `of ${intakeRecord.capacity}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${intakeRecord.name}`}
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
                                {intakeRecord.name}
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openIntakeEdit(intakeRecord)}
                              >
                                <PencilIcon aria-hidden="true" />
                                Edit intake (demo)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  copyValue(intakeRecord.name, "Intake name")
                                }
                              >
                                <CopyIcon aria-hidden="true" />
                                Copy name
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setNotice(
                                    `“${intakeRecord.programName}” is a program with its own course detail. Editing the program from an intake is a placeholder in this demo.`
                                  )
                                }
                              >
                                <BoxesIcon aria-hidden="true" />
                                View program (demo)
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
                          <CalendarPlusIcon
                            className="size-5"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium">
                            No intakes match these filters
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Try a different search term, program or status.
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

            <div className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Intakes belong to scheduled programs. Self-paced programs do not
              use intakes, and intake end dates are display-inclusive last days.
            </div>
          </Card>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Academic term and intake are distinct concepts: terms organize
            classes, while intakes control enrollment windows for scheduled
            programs. Both use display-inclusive end dates. This page uses local
            mock data only; actions do not persist.
          </span>
        </div>
      </div>

      <TermFormDialog
        open={termFormOpen}
        onOpenChange={setTermFormOpen}
        term={editingTerm}
        onSaved={(message) => setNotice(message)}
      />

      <IntakeFormDialog
        open={intakeFormOpen}
        onOpenChange={setIntakeFormOpen}
        intake={editingIntake}
        onSaved={(message) => setNotice(message)}
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
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </span>
      </div>
    </Card>
  )
}

function EmptyTableState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell
              key={columnIndex}
              className={
                columnIndex === 0
                  ? "py-3 pl-4 sm:pl-6"
                  : columnIndex === columns - 1
                    ? "pr-4 sm:pr-6"
                    : undefined
              }
            >
              {columnIndex === 0 ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-md" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ) : columnIndex === columns - 1 ? (
                <Skeleton className="ml-auto size-7 rounded-md" />
              ) : (
                <Skeleton className="h-3.5 w-20" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
