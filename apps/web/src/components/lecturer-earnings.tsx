"use client"

import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BanIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  ClockIcon,
  FileTextIcon,
  HandCoinsIcon,
  InfoIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchXIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import { LecturerPayoutStatusBadge } from "@/components/portal-status-badge"
import {
  getLecturerPayoutById,
  LECTURER_COMMISSION_BASIS_LABELS,
  LECTURER_COMMISSION_CALC_LABELS,
  LECTURER_COMMISSION_ENTRY_STATUS_LABELS,
  LECTURER_COMMISSION_ENTRY_TYPE_LABELS,
  LECTURER_PAYOUT_STATUS_LABELS,
  lecturer,
  lecturerCommissionEntries,
  lecturerCourses,
  lecturerEarnings,
  lecturerModules,
  lecturerPayouts,
  type LecturerCommissionEntry,
  type LecturerCommissionEntryStatus,
  type LecturerCommissionEntryType,
  type LecturerPayout,
} from "@/lib/lecturer-portal-data"
import { formatDisplayDate, formatLkr } from "@/lib/student-portal-data"

type EntryStatusFilter = "all" | LecturerCommissionEntryStatus
type EntryTypeFilter = "all" | LecturerCommissionEntryType

const statusFilters: Array<{
  value: EntryStatusFilter
  label: string
}> = [
  { value: "all", label: "All entries" },
  { value: "accrued", label: "Accrued" },
  { value: "settled", label: "Settled" },
  { value: "void", label: "Void" },
]

const typeFilters: Array<{ value: EntryTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "accrual", label: "Accruals" },
  { value: "reversal", label: "Reversals" },
]

function formatSignedLkr(amount: number) {
  return `${amount < 0 ? "−" : ""}${formatLkr(Math.abs(amount))}`
}

function formatRate(entry: LecturerCommissionEntry) {
  return entry.calcTypeApplied === "percent"
    ? `${entry.rateApplied}%`
    : `${formatLkr(entry.rateApplied)} per student / month`
}

export function LecturerEarnings() {
  const commissionsEnabled = lecturerModules.commissions
  const [statusFilter, setStatusFilter] = useState<EntryStatusFilter>("all")
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null)

  const sortedEntries = useMemo(
    () =>
      [...lecturerCommissionEntries].sort(
        (first, second) =>
          second.recordedOn.localeCompare(first.recordedOn) ||
          second.id.localeCompare(first.id)
      ),
    []
  )

  const entryCounts = useMemo(
    () => ({
      all: sortedEntries.length,
      accrued: sortedEntries.filter((entry) => entry.status === "accrued")
        .length,
      settled: sortedEntries.filter((entry) => entry.status === "settled")
        .length,
      void: sortedEntries.filter((entry) => entry.status === "void").length,
    }),
    [sortedEntries]
  )

  const courseOptions = useMemo(
    () =>
      lecturerCourses
        .filter(
          (course) =>
            sortedEntries.some((entry) => entry.courseId === course.id) ||
            course.id === courseFilter
        )
        .map((course) => ({
          value: course.id,
          label: `${course.name} · ${course.branch}`,
        })),
    [courseFilter, sortedEntries]
  )

  const filteredEntries = useMemo(
    () =>
      sortedEntries.filter((entry) => {
        if (statusFilter !== "all" && entry.status !== statusFilter) {
          return false
        }
        if (typeFilter !== "all" && entry.entryType !== typeFilter) {
          return false
        }
        if (courseFilter !== "all" && entry.courseId !== courseFilter) {
          return false
        }
        return true
      }),
    [courseFilter, sortedEntries, statusFilter, typeFilter]
  )

  const sortedPayouts = useMemo(() => {
    const statusOrder: Record<LecturerPayout["status"], number> = {
      draft: 0,
      approved: 1,
      paid: 2,
    }

    return [...lecturerPayouts].sort(
      (first, second) =>
        second.periodStart.localeCompare(first.periodStart) ||
        statusOrder[first.status] - statusOrder[second.status] ||
        second.id.localeCompare(first.id)
    )
  }, [])

  const selectedEntry =
    lecturerCommissionEntries.find((entry) => entry.id === selectedEntryId) ??
    null
  const selectedPayout = selectedPayoutId
    ? (getLecturerPayoutById(selectedPayoutId) ?? null)
    : null
  const hasFilters =
    statusFilter !== "all" || typeFilter !== "all" || courseFilter !== "all"

  function clearFilters() {
    setStatusFilter("all")
    setTypeFilter("all")
    setCourseFilter("all")
  }

  if (!commissionsEnabled) {
    return (
      <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6">
          <PortalPageHeader
            title="My Earnings"
            description="Your own commission entries and payout history. This page depends on the commissions module."
            meta={
              <>
                <Badge variant="secondary" className="rounded-full">
                  Lecturer portal
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {lecturer.designation}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  Commissions disabled
                </Badge>
              </>
            }
          />
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<BanIcon className="size-5" aria-hidden="true" />}
              title="Commissions are disabled"
              description="Your earnings, commission entries and payout history are unavailable while the commissions module is off for this institute. Your courses, attendance and exams remain available."
            />
          </Card>
          <Card className="gap-0 py-0">
            <CardContent className="flex items-start gap-3 p-4 sm:p-6">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                This page never shows another lecturer&apos;s earnings and does
                not calculate commission or create payouts.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="My Earnings"
          description="Your own commission entries and payout history for your courses. Figures are snapshots of recorded entries — nothing is calculated, approved or paid from this demo."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Lecturer portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.designation}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {lecturer.branch} branch
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
              >
                <HandCoinsIcon aria-hidden="true" />
                Commissions enabled
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <CalendarDaysIcon aria-hidden="true" />
                {lecturerEarnings.period}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Only your earnings
              </Badge>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile
            icon={CircleDollarSignIcon}
            label="Net payable"
            value={formatLkr(lecturerEarnings.netPayable)}
            hint="Current draft period"
            tone="neutral"
          />
          <SummaryTile
            icon={ClockIcon}
            label="Accrued (not settled)"
            value={formatLkr(lecturerEarnings.accrued)}
            hint={`${entryCounts.accrued} accrued entries`}
            tone="amber"
          />
          <SummaryTile
            icon={BadgeCheckIcon}
            label="Settled this term"
            value={formatLkr(lecturerEarnings.settledThisTerm)}
            hint={`${entryCounts.settled} settled entries`}
            tone="emerald"
          />
          <SummaryTile
            icon={LandmarkIcon}
            label="Last paid"
            value={formatLkr(lecturerEarnings.lastPaidAmount ?? 0)}
            hint={
              lecturerEarnings.lastPaidOn
                ? formatDisplayDate(lecturerEarnings.lastPaidOn)
                : "No payout yet"
            }
            tone="sky"
          />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <ReceiptTextIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {lecturerEarnings.period} payout
                </CardTitle>
                <CardDescription>
                  Draft summary for your own courses. This payout has not been
                  submitted, approved or paid.
                </CardDescription>
              </div>
              <LecturerPayoutStatusBadge
                status={lecturerEarnings.payoutStatus}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <MoneyStat
                label="Gross base"
                value={formatLkr(lecturerEarnings.grossBase)}
                tone="muted"
              />
              <MoneyStat
                label="Institute commission"
                value={formatLkr(lecturerEarnings.commissionAmount)}
                tone="muted"
              />
              <MoneyStat
                label="Net teacher amount"
                value={formatLkr(lecturerEarnings.netPayable)}
                tone="emphasis"
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Course breakdown
              </p>
              <ul className="flex flex-col divide-y rounded-lg border">
                {lecturerEarnings.breakdown.map((row) => (
                  <li
                    key={row.courseId}
                    className="flex flex-wrap items-center justify-between gap-2 p-3"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {row.courseName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Base {formatLkr(row.grossBase)} · commission{" "}
                        {formatLkr(row.commissionAmount)}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatLkr(row.netPayable)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <span>
                Payout reference:{" "}
                <span className="text-foreground">
                  {lecturerEarnings.payoutReference ?? "Not issued yet"}
                </span>
              </span>
              {lecturerEarnings.lastPaidOn ? (
                <span>
                  Previous payout{" "}
                  {formatLkr(lecturerEarnings.lastPaidAmount ?? 0)} paid{" "}
                  {formatDisplayDate(lecturerEarnings.lastPaidOn)}
                </span>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Commission entries are snapshots and reversal lines can be negative.
            No commission is calculated and no payout is created from this page.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <FileTextIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Commission entries
                </CardTitle>
                <CardDescription>
                  Accrued, settled and void entries for your courses. Reversal
                  lines are negative.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {filteredEntries.length} of {sortedEntries.length} shown
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div
              role="group"
              aria-label="Filter entries by status"
              className="flex w-fit flex-wrap gap-1 rounded-lg border p-1"
            >
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={
                    statusFilter === filter.value ? "secondary" : "ghost"
                  }
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                  aria-pressed={statusFilter === filter.value}
                  className="gap-1.5"
                >
                  {filter.label}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {entryCounts[filter.value]}
                  </span>
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div
                role="group"
                aria-label="Filter entries by type"
                className="flex w-fit flex-wrap gap-1 rounded-lg border p-1"
              >
                {typeFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={
                      typeFilter === filter.value ? "secondary" : "ghost"
                    }
                    size="sm"
                    onClick={() => setTypeFilter(filter.value)}
                    aria-pressed={typeFilter === filter.value}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              <div className="flex max-w-sm flex-1 flex-col gap-1.5">
                <label
                  htmlFor="earnings-entry-course"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Course
                </label>
                <Select
                  items={[
                    { value: "all", label: "All my courses" },
                    ...courseOptions,
                  ]}
                  value={courseFilter}
                  onValueChange={(value) => setCourseFilter(value ?? "all")}
                >
                  <SelectTrigger id="earnings-entry-course" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All my courses</SelectItem>
                    {courseOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasFilters ? (
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Clear filters
                </Button>
              ) : null}
            </div>

            {filteredEntries.length === 0 ? (
              <EmptyState
                icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                title="No matching entries"
                description="Try another status, type or course. Clear the filters to see every entry."
              />
            ) : (
              <div className="rounded-lg border">
                <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_120px_120px_100px] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Entry</span>
                  <span className="text-right">Base</span>
                  <span className="text-right">Commission</span>
                  <span className="text-right">Net teacher</span>
                  <span>Status</span>
                  <span className="text-right">Action</span>
                </div>
                <ul className="divide-y">
                  {filteredEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_110px_110px_120px_120px_100px] md:items-center md:gap-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <EntryTypeBadge type={entry.entryType} />
                          <span className="truncate text-sm font-medium">
                            {entry.courseName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.period} · recorded{" "}
                          {formatDisplayDate(entry.recordedOn)}
                        </span>
                        {entry.note ? (
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {entry.note}
                          </span>
                        ) : null}
                      </div>

                      <AmountCell
                        label="Base"
                        value={formatSignedLkr(entry.baseAmount)}
                        negative={entry.baseAmount < 0}
                      />
                      <AmountCell
                        label="Commission"
                        value={formatSignedLkr(entry.commissionAmount)}
                        negative={entry.commissionAmount < 0}
                      />
                      <AmountCell
                        label="Net teacher"
                        value={formatSignedLkr(entry.teacherAmount)}
                        negative={entry.teacherAmount < 0}
                        emphasized
                      />

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground md:hidden">
                          Status
                        </span>
                        <EntryStatusBadge status={entry.status} />
                      </div>

                      <div className="flex md:justify-end">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setSelectedEntryId(entry.id)}
                        >
                          <ChevronRightIcon
                            data-icon="inline-start"
                            aria-hidden="true"
                          />
                          Details
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Entries snapshot the rule, rate, share and basis at the time they
            were recorded. Reversals are negative and past entries are never
            recalculated or edited here.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <LandmarkIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Payout history
                </CardTitle>
                <CardDescription>
                  Draft, approved and paid payouts for your own earnings.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {sortedPayouts.length} payouts
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {sortedPayouts.map((payout) => (
                <PayoutRow
                  key={payout.id}
                  payout={payout}
                  onOpen={() => setSelectedPayoutId(payout.id)}
                />
              ))}
            </ul>
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Payout records are read-only. Drafting, approving, paying and proof
            uploads are not available from this demo.
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page is limited to {lecturer.fullName}&apos;s own commission
              entries and payout history. Entries are snapshots, reversal lines
              may be negative, and proof file details are masked. No commission
              calculation, payout action or bank detail is implemented.
            </p>
          </CardContent>
        </Card>
      </div>

      {selectedEntry ? (
        <EntryDetailDialog
          key={selectedEntry.id}
          entry={selectedEntry}
          onOpenChange={(open) => {
            if (!open) setSelectedEntryId(null)
          }}
        />
      ) : null}

      {selectedPayout ? (
        <PayoutDetailDialog
          key={selectedPayout.id}
          payout={selectedPayout}
          onOpenChange={(open) => {
            if (!open) setSelectedPayoutId(null)
          }}
        />
      ) : null}
    </main>
  )
}

function EntryDetailDialog({
  entry,
  onOpenChange,
}: {
  entry: LecturerCommissionEntry
  onOpenChange: (open: boolean) => void
}) {
  const entryPayout = entry.payoutId
    ? (getLecturerPayoutById(entry.payoutId) ?? null)
    : null
  const reversedEntry = entry.reversesEntryId
    ? (lecturerCommissionEntries.find(
        (candidate) => candidate.id === entry.reversesEntryId
      ) ?? null)
    : null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <EntryTypeBadge type={entry.entryType} />
            <EntryStatusBadge status={entry.status} />
          </div>
          <DialogTitle className="text-lg">{entry.courseName}</DialogTitle>
          <DialogDescription>
            {entry.period} · recorded {formatDisplayDate(entry.recordedOn)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MoneyStat
            label="Base"
            value={formatSignedLkr(entry.baseAmount)}
            tone={entry.baseAmount < 0 ? "negative" : "muted"}
          />
          <MoneyStat
            label="Commission"
            value={formatSignedLkr(entry.commissionAmount)}
            tone={entry.commissionAmount < 0 ? "negative" : "muted"}
          />
          <MoneyStat
            label="Net teacher"
            value={formatSignedLkr(entry.teacherAmount)}
            tone={entry.teacherAmount < 0 ? "negative" : "emphasis"}
          />
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailRow
            icon={FileTextIcon}
            label="Entry type"
            value={LECTURER_COMMISSION_ENTRY_TYPE_LABELS[entry.entryType]}
          />
          <DetailRow
            icon={BadgeCheckIcon}
            label="Status"
            value={LECTURER_COMMISSION_ENTRY_STATUS_LABELS[entry.status]}
          />
          <DetailRow
            icon={CalculatorIcon}
            label="Calculation"
            value={LECTURER_COMMISSION_CALC_LABELS[entry.calcTypeApplied]}
          />
          <DetailRow
            icon={CircleDollarSignIcon}
            label="Rate applied"
            value={formatRate(entry)}
          />
          <DetailRow
            icon={HandCoinsIcon}
            label="Share applied"
            value={`${entry.sharePercentApplied}%`}
          />
          <DetailRow
            icon={ReceiptTextIcon}
            label="Basis applied"
            value={LECTURER_COMMISSION_BASIS_LABELS[entry.basisApplied]}
          />
          {entry.payoutId ? (
            <DetailRow
              icon={LandmarkIcon}
              label="Payout"
              value={
                entryPayout
                  ? `${entryPayout.period} · ${LECTURER_PAYOUT_STATUS_LABELS[entryPayout.status]}${
                      entryPayout.paymentReference
                        ? ` · ${entryPayout.paymentReference}`
                        : ""
                    }`
                  : entry.payoutId
              }
            />
          ) : (
            <DetailRow
              icon={ClockIcon}
              label="Payout"
              value="Not settled in a payout"
            />
          )}
          {entry.reversesEntryId ? (
            <DetailRow
              icon={RotateCcwIcon}
              label="Reverses entry"
              value={
                reversedEntry
                  ? `${reversedEntry.courseName} · ${reversedEntry.period}`
                  : entry.reversesEntryId
              }
            />
          ) : null}
        </div>

        {entry.note ? (
          <p className="rounded-lg border bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {entry.note}
          </p>
        ) : null}

        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <LockKeyholeIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            This entry is a read-only snapshot. Reversal lines may be negative,
            and nothing is recalculated, edited or settled from this demo.
          </p>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

function PayoutDetailDialog({
  payout,
  onOpenChange,
}: {
  payout: LecturerPayout
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <LecturerPayoutStatusBadge status={payout.status} />
            <Badge variant="outline" className="rounded-full">
              {payout.entryCount}{" "}
              {payout.entryCount === 1 ? "entry" : "entries"}
            </Badge>
          </div>
          <DialogTitle className="text-lg">{payout.period} payout</DialogTitle>
          <DialogDescription>
            {formatDisplayDate(payout.periodStart)} –{" "}
            {formatDisplayDate(payout.periodEnd)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MoneyStat
            label="Gross collected"
            value={formatLkr(payout.grossCollected)}
            tone="muted"
          />
          <MoneyStat
            label="Commission total"
            value={formatLkr(payout.commissionTotal)}
            tone="muted"
          />
          <MoneyStat
            label="Net payable"
            value={formatLkr(payout.netPayable)}
            tone="emphasis"
          />
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <DetailRow
            icon={BadgeCheckIcon}
            label="Status"
            value={
              payout.status === "paid"
                ? "Paid"
                : payout.status === "approved"
                  ? "Approved, awaiting payment"
                  : "Draft, not submitted"
            }
          />
          <DetailRow
            icon={ReceiptTextIcon}
            label="Payment reference"
            value={payout.paymentReference ?? "Not issued"}
          />
          {payout.approvedOn ? (
            <DetailRow
              icon={CheckCircle2Icon}
              label="Approved"
              value={formatDisplayDate(payout.approvedOn)}
            />
          ) : null}
          {payout.paidOn ? (
            <DetailRow
              icon={LandmarkIcon}
              label="Paid"
              value={formatDisplayDate(payout.paidOn)}
            />
          ) : null}
        </div>

        {payout.proof ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheckIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Proof file
            </div>
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span>File: {payout.proof.fileName}</span>
              <span>Reference: {payout.proof.maskedReference}</span>
              <span>Uploaded {formatDisplayDate(payout.proof.uploadedOn)}</span>
              <span>
                File contents, storage keys and bank details are masked in this
                demo.
              </span>
            </div>
          </div>
        ) : null}

        {payout.note ? (
          <p className="rounded-lg border bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {payout.note}
          </p>
        ) : null}

        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <LockKeyholeIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            Payout history is read-only. Drafting, approving, paying and proof
            uploads are unavailable, and a negative net would carry forward to a
            later payout in a live system.
          </p>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

function PayoutRow({
  payout,
  onOpen,
}: {
  payout: LecturerPayout
  onOpen: () => void
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{payout.period}</span>
          <span className="text-xs text-muted-foreground">
            {formatDisplayDate(payout.periodStart)} –{" "}
            {formatDisplayDate(payout.periodEnd)} · {payout.entryCount}{" "}
            {payout.entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LecturerPayoutStatusBadge status={payout.status} />
          <span className="text-sm font-semibold tabular-nums">
            {formatLkr(payout.netPayable)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Gross {formatLkr(payout.grossCollected)}</span>
        <span>Commission {formatLkr(payout.commissionTotal)}</span>
        <span>
          Reference:{" "}
          <span className="text-foreground">
            {payout.paymentReference ?? "Not issued"}
          </span>
        </span>
        {payout.paidOn ? (
          <span>Paid {formatDisplayDate(payout.paidOn)}</span>
        ) : null}
        {payout.approvedOn ? (
          <span>Approved {formatDisplayDate(payout.approvedOn)}</span>
        ) : null}
        {payout.proof ? <span>Proof masked</span> : null}
      </div>

      <div>
        <Button variant="outline" size="xs" onClick={onOpen}>
          <ChevronRightIcon data-icon="inline-start" aria-hidden="true" />
          View payout
        </Button>
      </div>
    </li>
  )
}

function EntryStatusBadge({
  status,
}: {
  status: LecturerCommissionEntryStatus
}) {
  const config = {
    accrued: {
      icon: ClockIcon,
      className:
        "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    },
    settled: {
      icon: BadgeCheckIcon,
      className:
        "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    },
    void: {
      icon: BanIcon,
      className: "border-border bg-muted/60 text-muted-foreground",
    },
  }[status]

  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 rounded-full", config.className)}
    >
      <Icon aria-hidden="true" />
      {LECTURER_COMMISSION_ENTRY_STATUS_LABELS[status]}
    </Badge>
  )
}

function EntryTypeBadge({ type }: { type: LecturerCommissionEntryType }) {
  const config = {
    accrual: {
      icon: CircleDollarSignIcon,
      className:
        "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
    },
    reversal: {
      icon: RotateCcwIcon,
      className:
        "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
    },
  }[type]

  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 rounded-full", config.className)}
    >
      <Icon aria-hidden="true" />
      {LECTURER_COMMISSION_ENTRY_TYPE_LABELS[type]}
    </Badge>
  )
}

function AmountCell({
  label,
  value,
  negative,
  emphasized,
}: {
  label: string
  value: string
  negative: boolean
  emphasized?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 md:flex-col md:items-end md:gap-0.5">
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      <span
        className={cn(
          "text-sm tabular-nums",
          emphasized && "font-medium",
          negative && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MoneyStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "muted" | "emphasis" | "negative"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border p-3",
        tone === "emphasis" && "border-primary/20 bg-primary/5",
        tone === "negative" && "border-destructive/20 bg-destructive/5"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "negative" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="break-words">{value}</span>
      </div>
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: "neutral" | "amber" | "emerald" | "sky"
}) {
  const toneClasses = {
    neutral: "border-border bg-muted/30 text-foreground",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        toneClasses[tone]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-base leading-tight font-semibold tabular-nums">
          {value}
        </p>
        <Icon className="size-4 opacity-70" aria-hidden="true" />
      </div>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
