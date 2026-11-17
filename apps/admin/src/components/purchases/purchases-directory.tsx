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
  ClockIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  InfoIcon,
  PackageCheckIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingCartIcon,
  StoreIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"

import { CONTENT_STORE_MODULE_MOCK } from "@/lib/content-data"
import { formatLkr } from "@/lib/courses-data"
import { PurchaseHandoverDialog } from "@/components/purchases/purchase-handover-dialog"
import { PurchaseDetailSheet } from "@/components/purchases/purchase-detail-sheet"
import {
  HandoverBadge,
  PurchaseChannelBadge,
  PurchaseStatusBadge,
} from "@/components/purchases/purchase-status-badge"
import {
  canHandOver,
  contentPurchases,
  getHandoverState,
  purchaseBranchFilterOptions,
  purchaseChannelFilterOptions,
  purchaseHandoverFilterOptions,
  purchaseStatusFilterOptions,
  purchaseStatusLabels,
  type ContentPurchaseRecord,
} from "@/lib/purchases-data"
import {
  formatDateTime,
  formatDisplayDate,
  getInitials,
} from "@/lib/students-data"

type HandoverOverride = {
  handedOverAt: string
  handedOverBy: string
}

export function PurchasesDirectory() {
  const [handoverOverrides, setHandoverOverrides] = useState<
    Record<string, HandoverOverride>
  >({})

  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [handoverFilter, setHandoverFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [handoverId, setHandoverId] = useState<string | null>(null)

  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Purchases refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const purchases = useMemo<ContentPurchaseRecord[]>(() => {
    return contentPurchases.map((purchase) => {
      const override = handoverOverrides[purchase.id]
      return override
        ? {
            ...purchase,
            handedOverAt: override.handedOverAt,
            handedOverBy: override.handedOverBy,
          }
        : purchase
    })
  }, [handoverOverrides])

  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    channelFilter !== "all" ||
    statusFilter !== "all" ||
    branchFilter !== "all" ||
    handoverFilter !== "all" ||
    fromDate !== "" ||
    toDate !== ""

  const filtered = useMemo(() => {
    return purchases.filter((purchase) => {
      if (channelFilter !== "all" && purchase.channel !== channelFilter) {
        return false
      }
      if (statusFilter !== "all" && purchase.status !== statusFilter) {
        return false
      }
      if (branchFilter !== "all" && purchase.branchId !== branchFilter) {
        return false
      }

      if (handoverFilter !== "all") {
        const state = getHandoverState(purchase)
        if (handoverFilter === "not_applicable" && state !== "na") return false
        if (handoverFilter === "pending" && state !== "pending") return false
        if (handoverFilter === "blocked" && state !== "blocked") return false
        if (handoverFilter === "done" && state !== "done") return false
      }

      const purchasedOn = purchase.purchasedAt.slice(0, 10)
      if (fromDate !== "" && purchasedOn < fromDate) return false
      if (toDate !== "" && purchasedOn > toDate) return false

      if (query.length === 0) return true

      return [
        purchase.studentName,
        purchase.studentNo,
        purchase.contentTitle,
        purchase.reference,
        purchase.invoiceNo ?? "",
        purchase.branchName,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [
    purchases,
    channelFilter,
    statusFilter,
    branchFilter,
    handoverFilter,
    fromDate,
    toDate,
    query,
  ])

  const usage = useMemo(
    () => ({
      total: purchases.length,
      paid: purchases.filter((purchase) => purchase.status === "paid").length,
      pending: purchases.filter((purchase) => purchase.status === "pending")
        .length,
      handoverPending: purchases.filter(
        (purchase) => getHandoverState(purchase) === "pending"
      ).length,
      handedOver: purchases.filter(
        (purchase) => getHandoverState(purchase) === "done"
      ).length,
    }),
    [purchases]
  )

  const selectedPurchase = selectedId
    ? (purchases.find((purchase) => purchase.id === selectedId) ?? null)
    : null
  const handoverPurchase = handoverId
    ? (purchases.find((purchase) => purchase.id === handoverId) ?? null)
    : null

  function clearFilters() {
    setSearch("")
    setChannelFilter("all")
    setStatusFilter("all")
    setBranchFilter("all")
    setHandoverFilter("all")
    setFromDate("")
    setToDate("")
  }

  function openDetail(purchase: ContentPurchaseRecord) {
    setSelectedId(purchase.id)
    setDetailOpen(true)
  }

  function openHandover(purchase: ContentPurchaseRecord) {
    setDetailOpen(false)
    setHandoverId(purchase.id)
    setHandoverOpen(true)
  }

  function handleHandoverConfirm(
    purchase: ContentPurchaseRecord,
    _staffId: string,
    staffName: string,
    date: string
  ) {
    setHandoverOverrides((previous) => ({
      ...previous,
      [purchase.id]: {
        handedOverAt: `${date}T12:00:00+05:30`,
        handedOverBy: staffName,
      },
    }))
    setNotice(
      `${purchase.contentTitle} handed over to ${purchase.studentName} by ${staffName} on ${formatDisplayDate(
        date
      )}. Local demo only — nothing was saved.`
    )
    setHandoverOpen(false)
    setHandoverId(null)
  }

  async function copyReference(purchase: ContentPurchaseRecord) {
    try {
      await navigator.clipboard.writeText(purchase.reference)
      setNotice(`${purchase.reference} copied to the clipboard.`)
    } catch {
      setNotice(`Purchase reference: ${purchase.reference}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Purchases
              <Badge variant="outline" className="rounded-full">
                <StoreIcon aria-hidden="true" />
                {CONTENT_STORE_MODULE_MOCK.label}
              </Badge>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Order register built from <code>content_purchase</code> and linked
              to a student, content item, branch and invoice. Payment state and
              physical handover are kept separate. Nothing on this page is
              saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
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
            icon={<ShoppingCartIcon aria-hidden="true" />}
            value={usage.total}
            label="Purchases"
            hint={`${usage.paid} paid · ${usage.pending} pending`}
          />
          <SummaryCard
            icon={<WalletIcon aria-hidden="true" />}
            value={usage.paid}
            label="Paid"
            hint="Grants access"
          />
          <SummaryCard
            icon={<ClockIcon aria-hidden="true" />}
            value={usage.pending}
            label="Pending"
            hint="No access until paid"
          />
          <SummaryCard
            icon={<PackageCheckIcon aria-hidden="true" />}
            value={usage.handoverPending}
            label="Handover pending"
            hint={`${usage.handedOver} handed over`}
          />
        </div>

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Filters</span>
                <span className="text-xs text-muted-foreground">
                  Filter by channel, status, branch, purchase date or handover
                  state.
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

            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="relative flex-1">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by student, content, reference or invoice"
                  aria-label="Search purchases"
                  className="pl-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="purchases-from"
                    className="text-xs text-muted-foreground"
                  >
                    Purchased from
                  </Label>
                  <Input
                    id="purchases-from"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="purchases-to"
                    className="text-xs text-muted-foreground"
                  >
                    Purchased to
                  </Label>
                  <Input
                    id="purchases-to"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                items={purchaseChannelFilterOptions}
                value={channelFilter}
                onValueChange={(value) => setChannelFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by channel"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {purchaseChannelFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={purchaseStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {purchaseStatusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={purchaseBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {purchaseBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={purchaseHandoverFilterOptions}
                value={handoverFilter}
                onValueChange={(value) => setHandoverFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by handover state"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {purchaseHandoverFilterOptions.map((option) => (
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
                <ShoppingCartIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Purchase register
              </CardTitle>
              <CardDescription>
                {filtered.length} of {purchases.length}{" "}
                {purchases.length === 1 ? "purchase" : "purchases"}
                {usage.handoverPending > 0
                  ? ` · ${usage.handoverPending} awaiting handover`
                  : ""}
              </CardDescription>
            </div>
          </CardHeader>

          {isRefreshing ? (
            <PurchasesSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ShoppingCartIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  No purchases match these filters
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different channel, status, branch, date range or
                  handover state.
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
          ) : (
            <PurchasesTable
              purchases={filtered}
              onView={openDetail}
              onHandOver={openHandover}
              onCopy={copyReference}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Paid status grants access; pending and cancelled do not. Physical
              handover is a separate action, only available for paid books, and
              records a staff member and date.
            </span>
          </div>
        </Card>
      </div>

      <PurchaseDetailSheet
        open={detailOpen}
        purchase={selectedPurchase}
        onOpenChange={setDetailOpen}
        onHandOver={openHandover}
      />

      <PurchaseHandoverDialog
        open={handoverOpen}
        purchase={handoverPurchase}
        onOpenChange={(open) => {
          setHandoverOpen(open)
          if (!open) setHandoverId(null)
        }}
        onConfirm={handleHandoverConfirm}
      />
    </main>
  )
}

function PurchasesTable({
  purchases,
  onView,
  onHandOver,
  onCopy,
}: {
  purchases: ContentPurchaseRecord[]
  onView: (purchase: ContentPurchaseRecord) => void
  onHandOver: (purchase: ContentPurchaseRecord) => void
  onCopy: (purchase: ContentPurchaseRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Student
          </TableHead>
          <TableHead className="text-muted-foreground">Content</TableHead>
          <TableHead className="text-muted-foreground">Channel</TableHead>
          <TableHead className="text-right text-muted-foreground">
            Price
          </TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="text-muted-foreground">Purchased</TableHead>
          <TableHead className="text-muted-foreground">Handover</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((purchase) => {
          const handoverState = getHandoverState(purchase)
          const eligible = canHandOver(purchase)

          return (
            <TableRow key={purchase.id}>
              <TableCell className="py-3 pl-4 sm:pl-6">
                <button
                  type="button"
                  onClick={() => onView(purchase)}
                  className="flex items-center gap-2 text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-muted-foreground">
                    {getInitials(purchase.studentName)}
                  </span>
                  {purchase.studentName}
                </button>
                <div className="text-xs text-muted-foreground">
                  {purchase.studentNo} · {purchase.branchName}
                </div>
              </TableCell>
              <TableCell className="max-w-[220px]">
                <span className="line-clamp-2 text-sm">
                  {purchase.contentTitle}
                </span>
                <div className="text-xs text-muted-foreground">
                  {purchase.reference}
                </div>
              </TableCell>
              <TableCell>
                <PurchaseChannelBadge channel={purchase.channel} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatLkr(purchase.price)}
              </TableCell>
              <TableCell>
                <PurchaseStatusBadge status={purchase.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="flex flex-col gap-0.5 text-xs">
                  <span>{formatDateTime(purchase.purchasedAt)}</span>
                  <span>
                    {purchase.invoiceNo
                      ? `Invoice ${purchase.invoiceNo}`
                      : "No invoice linked"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <HandoverBadge state={handoverState} />
                  {purchase.handedOverAt ? (
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(purchase.handedOverAt)}
                      {purchase.handedOverBy
                        ? ` · ${purchase.handedOverBy}`
                        : ""}
                    </span>
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
                        aria-label={`Actions for ${purchase.reference}`}
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
                        {purchaseStatusLabels[purchase.status]} ·{" "}
                        {purchase.studentName}
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(purchase)}>
                        <EyeIcon aria-hidden="true" />
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!eligible}
                        onClick={() => onHandOver(purchase)}
                      >
                        <PackageCheckIcon aria-hidden="true" />
                        Hand over book (demo)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopy(purchase)}>
                        <CopyIcon aria-hidden="true" />
                        Copy reference
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        <StoreIcon aria-hidden="true" />
                        {purchase.channel === "physical"
                          ? "Physical item"
                          : "Online item"}
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

function PurchasesSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />
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
