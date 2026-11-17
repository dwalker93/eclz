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
import { Label } from "@workspace/ui/components/label"
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
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  RepeatIcon,
  SearchIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"

import {
  FeeBillingBadge,
  FeeStructureStatusBadge,
} from "@/components/fee-structures/fee-billing-badge"
import { FeeStructureDetailSheet } from "@/components/fee-structures/fee-structure-detail-sheet"
import { FeeStructureFormDialog } from "@/components/fee-structures/fee-structure-form-dialog"
import { courseKindLabels, formatLkr } from "@/lib/courses-data"
import {
  feeBillingTypeLabels,
  feeFrequencyLabels,
  feeStructureBillingFilterOptions,
  feeStructureBranchFilterOptions,
  feeStructureCourseFilterOptions,
  feeStructureDirectory,
  feeStructureStatusFilterOptions,
  getCurrentRate,
  getFeeStructureStatus,
  getFeeStructureUsage,
  overdueActionLabels,
  type FeeStructureRecord,
} from "@/lib/fee-structures-data"
import { formatDisplayDate } from "@/lib/students-data"

export function FeeStructureDirectory() {
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [billingFilter, setBillingFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [effectiveOn, setEffectiveOn] = useState("")
  const [selected, setSelected] = useState<FeeStructureRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FeeStructureRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Fee structures refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    branchFilter !== "all" ||
    courseFilter !== "all" ||
    billingFilter !== "all" ||
    statusFilter !== "all" ||
    effectiveOn !== ""

  const filtered = useMemo(() => {
    return feeStructureDirectory.filter((structure) => {
      if (branchFilter !== "all" && structure.branchId !== branchFilter) {
        return false
      }
      if (courseFilter !== "all" && structure.courseId !== courseFilter) {
        return false
      }
      if (billingFilter !== "all" && structure.billingType !== billingFilter) {
        return false
      }
      if (
        statusFilter !== "all" &&
        getFeeStructureStatus(structure) !== statusFilter
      ) {
        return false
      }
      if (effectiveOn !== "") {
        const hasEffectiveRate = structure.rates.some(
          (rate) =>
            rate.effectiveFrom <= effectiveOn &&
            (rate.effectiveTo === null || effectiveOn < rate.effectiveTo)
        )

        if (!hasEffectiveRate) return false
      }

      if (query.length === 0) return true

      return [
        structure.name,
        structure.courseName,
        structure.subjectName,
        structure.branchName,
        structure.intakeName ?? "",
        structure.gradeNames.join(" "),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [
    branchFilter,
    courseFilter,
    billingFilter,
    statusFilter,
    effectiveOn,
    query,
  ])

  const usage = getFeeStructureUsage()
  const rateAsOf = effectiveOn || undefined

  function clearFilters() {
    setSearch("")
    setBranchFilter("all")
    setCourseFilter("all")
    setBillingFilter("all")
    setStatusFilter("all")
    setEffectiveOn("")
  }

  function openDetail(structure: FeeStructureRecord) {
    setSelected(structure)
    setDetailOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(structure: FeeStructureRecord) {
    setSelected(null)
    setDetailOpen(false)
    setEditing(structure)
    setFormOpen(true)
  }

  async function copyName(structure: FeeStructureRecord) {
    try {
      await navigator.clipboard.writeText(structure.name)
      setNotice(`“${structure.name}” copied to the clipboard.`)
    } catch {
      setNotice(`Fee: ${structure.name}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Fee Structures
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Course fee catalog built from <code>fee_structure</code>,{" "}
              <code>fee_rate</code> and <code>installment_option</code>. A fee
              belongs to a course or class and defaults onto new enrollments.
              Nothing on this page is saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              Add fee structure
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<ReceiptTextIcon aria-hidden="true" />}
            value={usage.total}
            label="Fee structures"
            hint={`${usage.branches} branches`}
          />
          <SummaryCard
            icon={<RepeatIcon aria-hidden="true" />}
            value={usage.recurring}
            label="Recurring"
            hint="Monthly and per-term fees"
          />
          <SummaryCard
            icon={<PackageIcon aria-hidden="true" />}
            value={usage.packages}
            label="One-time packages"
            hint="May offer installments"
          />
          <SummaryCard
            icon={<BadgeCheckIcon aria-hidden="true" />}
            value={usage.active}
            label="Active now"
            hint={`${usage.scheduled} scheduled for later`}
          />
        </div>

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Filters</span>
                <span className="text-xs text-muted-foreground">
                  Filter by branch, course, billing type, status or effective
                  date.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Reset
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by fee name, course, branch or subject"
                  aria-label="Search fee structures"
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="fee-effective-on"
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  Effective on
                </Label>
                <Input
                  id="fee-effective-on"
                  type="date"
                  value={effectiveOn}
                  onChange={(event) => setEffectiveOn(event.target.value)}
                  aria-label="Show fees with a rate effective on this date"
                  className="w-full sm:w-44"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                items={feeStructureBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feeStructureBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={feeStructureCourseFilterOptions}
                value={courseFilter}
                onValueChange={(value) => setCourseFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by course">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feeStructureCourseFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={feeStructureBillingFilterOptions}
                value={billingFilter}
                onValueChange={(value) => setBillingFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by billing type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feeStructureBillingFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={feeStructureStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feeStructureStatusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <WalletIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Course fees
              </CardTitle>
              <CardDescription>
                {filtered.length} of {feeStructureDirectory.length}{" "}
                {feeStructureDirectory.length === 1
                  ? "structure"
                  : "structures"}{" "}
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

          {isRefreshing ? (
            <FeeStructureSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ReceiptTextIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  No fee structures match these filters
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different branch, course, billing type or status, or add
                  a fee structure to a course.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  Clear filters
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <PlusIcon data-icon="inline-start" />
                  Add fee structure
                </Button>
              </div>
            </div>
          ) : (
            <FeeStructureTable
              structures={filtered}
              rateAsOf={rateAsOf}
              onView={openDetail}
              onEdit={openEdit}
              onCopy={copyName}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Rates are grade-specific and date-bounded. Recurring fees bill
              monthly or per term; one-time packages may set an access duration
              and installment options. No invoice or balance is calculated here.
            </span>
          </div>
        </Card>
      </div>

      <FeeStructureDetailSheet
        structure={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />

      <FeeStructureFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        structure={editing}
        onSaved={(message) => setNotice(message)}
      />
    </main>
  )
}

function FeeStructureTable({
  structures,
  rateAsOf,
  onView,
  onEdit,
  onCopy,
}: {
  structures: FeeStructureRecord[]
  rateAsOf?: string
  onView: (structure: FeeStructureRecord) => void
  onEdit: (structure: FeeStructureRecord) => void
  onCopy: (structure: FeeStructureRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Fee / course
          </TableHead>
          <TableHead className="text-muted-foreground">Billing</TableHead>
          <TableHead className="text-muted-foreground">Access</TableHead>
          <TableHead className="text-muted-foreground">Current rate</TableHead>
          <TableHead className="text-muted-foreground">Overdue</TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {structures.map((structure) => {
          const rate = getCurrentRate(structure, rateAsOf)
          const status = getFeeStructureStatus(structure)

          return (
            <TableRow key={structure.id}>
              <TableCell className="py-3 pl-4 sm:pl-6">
                <button
                  type="button"
                  onClick={() => onView(structure)}
                  className="w-fit max-w-[260px] truncate text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {structure.name}
                </button>
                <div className="max-w-[260px] truncate text-xs text-muted-foreground">
                  {structure.courseName} · {structure.branchName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {courseKindLabels[structure.courseKind]}
                  {structure.gradeNames.length > 0
                    ? ` · ${structure.gradeNames.join(", ")}`
                    : ""}
                  {structure.intakeName ? ` · ${structure.intakeName}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <FeeBillingBadge billingType={structure.billingType} />
                  <span className="text-xs text-muted-foreground">
                    {structure.frequency
                      ? feeFrequencyLabels[structure.frequency]
                      : "No frequency"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {structure.billingType === "one_time_package"
                  ? structure.accessDurationMonths === null
                    ? "Lifetime"
                    : `${structure.accessDurationMonths} months`
                  : "Per enrollment"}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium tabular-nums">
                    {rate ? formatLkr(rate.amount) : "No rate"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rate
                      ? `${rate.gradeName ?? "All grades"} · from ${formatDisplayDate(
                          rate.effectiveFrom
                        )}`
                      : "No effective rate"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex max-w-[180px] flex-col gap-0.5">
                  <span className="text-sm">
                    {structure.overdueGraceDays === null
                      ? "No grace"
                      : `${structure.overdueGraceDays} days grace`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {overdueActionLabels[structure.overdueAction]}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <FeeStructureStatusBadge status={status} />
                  {structure.isDefault ? (
                    <Badge variant="outline" className="rounded-full text-xs">
                      Default
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="pr-4 text-right sm:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${structure.name}`}
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
                        {feeBillingTypeLabels[structure.billingType]}
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(structure)}>
                        <EyeIcon aria-hidden="true" />
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(structure)}>
                        <PencilIcon aria-hidden="true" />
                        Edit structure (demo)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopy(structure)}>
                        <CopyIcon aria-hidden="true" />
                        Copy fee name
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        <ReceiptTextIcon aria-hidden="true" />
                        Invoices (Invoices page)
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function FeeStructureSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
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
