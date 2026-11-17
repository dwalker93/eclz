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
  BanIcon,
  CircleDollarSignIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FileTextIcon,
  InfoIcon,
  PrinterIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  WalletIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"

import {
  InvoiceActionDialog,
  type InvoiceAction,
} from "@/components/invoices/invoice-action-dialogs"
import { InvoiceDetailSheet } from "@/components/invoices/invoice-detail-sheet"
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  getInvoiceBalance,
  getInvoiceById,
  getInvoiceUsage,
  invoiceBranchFilterOptions,
  invoiceDirectory,
  invoiceStatusFilterOptions,
  invoiceStatusLabels,
  invoiceStudentFilterOptions,
  type InvoiceRecord,
} from "@/lib/invoices-data"
import { formatDisplayDate } from "@/lib/students-data"

export function InvoiceDirectory() {
  const [search, setSearch] = useState("")
  const [studentFilter, setStudentFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [issuedFrom, setIssuedFrom] = useState("")
  const [issuedTo, setIssuedTo] = useState("")
  const [dueFrom, setDueFrom] = useState("")
  const [dueTo, setDueTo] = useState("")
  const [selected, setSelected] = useState<InvoiceRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [action, setAction] = useState<InvoiceAction | null>(null)
  const [actionInvoice, setActionInvoice] = useState<InvoiceRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Invoices refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    studentFilter !== "all" ||
    branchFilter !== "all" ||
    statusFilter !== "all" ||
    issuedFrom !== "" ||
    issuedTo !== "" ||
    dueFrom !== "" ||
    dueTo !== ""

  const filtered = useMemo(() => {
    return invoiceDirectory.filter((invoice) => {
      if (studentFilter !== "all" && invoice.studentId !== studentFilter) {
        return false
      }
      if (branchFilter !== "all" && invoice.branchId !== branchFilter) {
        return false
      }
      if (statusFilter !== "all" && invoice.status !== statusFilter) {
        return false
      }
      if (issuedFrom !== "" && invoice.issuedOn < issuedFrom) return false
      if (issuedTo !== "" && invoice.issuedOn > issuedTo) return false
      if (dueFrom !== "" && invoice.dueDate < dueFrom) return false
      if (dueTo !== "" && invoice.dueDate > dueTo) return false

      if (query.length === 0) return true

      return [
        invoice.invoiceNo,
        invoice.studentName,
        invoice.studentNo,
        invoice.branchName,
        ...invoice.items.map((item) => item.description),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [
    studentFilter,
    branchFilter,
    statusFilter,
    issuedFrom,
    issuedTo,
    dueFrom,
    dueTo,
    query,
  ])

  const usage = getInvoiceUsage()
  const filteredBalance = filtered.reduce(
    (total, invoice) => total + getInvoiceBalance(invoice),
    0
  )

  function clearFilters() {
    setSearch("")
    setStudentFilter("all")
    setBranchFilter("all")
    setStatusFilter("all")
    setIssuedFrom("")
    setIssuedTo("")
    setDueFrom("")
    setDueTo("")
  }

  function openDetail(invoice: InvoiceRecord) {
    setSelected(invoice)
    setDetailOpen(true)
  }

  function openAction(nextAction: InvoiceAction, invoice: InvoiceRecord) {
    setSelected(null)
    setDetailOpen(false)
    setActionInvoice(invoice)
    setAction(nextAction)
  }

  function closeAction(open: boolean) {
    if (!open) {
      setAction(null)
      setActionInvoice(null)
    }
  }

  function printPlaceholder(invoice: InvoiceRecord) {
    setNotice(
      `Print preview for ${invoice.invoiceNo} — this demo does not start a print job or download a file.`
    )
  }

  async function copyNumber(invoice: InvoiceRecord) {
    try {
      await navigator.clipboard.writeText(invoice.invoiceNo)
      setNotice(`${invoice.invoiceNo} copied to the clipboard.`)
    } catch {
      setNotice(`Invoice reference: ${invoice.invoiceNo}`)
    }
  }

  // Keep the selected invoice in sync with edits from the action previews.
  const selectedInvoice = selected
    ? (getInvoiceById(selected.id) ?? selected)
    : null

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Invoice register built from <code>invoice</code>,{" "}
              <code>invoice_item</code> and <code>invoice_installment</code>.
              Issued invoices are append-only; corrections are posted as new
              adjustment or discount lines. Nothing on this page is saved.
            </p>
          </div>
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
            icon={<FileTextIcon aria-hidden="true" />}
            value={usage.total}
            label="Invoices"
            hint={`${usage.open} still open`}
          />
          <SummaryCard
            icon={<WalletIcon aria-hidden="true" />}
            value={usage.outstanding}
            label="Outstanding"
            hint={`${usage.collected ? formatLkr(usage.collected) : formatLkr(0)} collected`}
            isCurrency
          />
          <SummaryCard
            icon={<TriangleAlertIcon aria-hidden="true" />}
            value={usage.overdue}
            label="Overdue"
            hint={`${formatLkr(usage.overdueAmount)} past due`}
          />
          <SummaryCard
            icon={<CircleDollarSignIcon aria-hidden="true" />}
            value={usage.paid}
            label="Paid in full"
            hint={`${usage.waived} waived · ${usage.cancelled} cancelled`}
          />
        </div>

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Filters</span>
                <span className="text-xs text-muted-foreground">
                  Filter by student, branch, status, issue date or due date.
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
                  placeholder="Search by reference, student or line description"
                  aria-label="Search invoices"
                  className="pl-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="invoices-issued-from"
                    className="text-xs text-muted-foreground"
                  >
                    Issued from
                  </Label>
                  <Input
                    id="invoices-issued-from"
                    type="date"
                    value={issuedFrom}
                    onChange={(event) => setIssuedFrom(event.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="invoices-issued-to"
                    className="text-xs text-muted-foreground"
                  >
                    Issued to
                  </Label>
                  <Input
                    id="invoices-issued-to"
                    type="date"
                    value={issuedTo}
                    onChange={(event) => setIssuedTo(event.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Select
                items={invoiceStudentFilterOptions}
                value={studentFilter}
                onValueChange={(value) => setStudentFilter(value ?? "all")}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter by student"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invoiceStudentFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={invoiceBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invoiceBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={invoiceStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invoiceStatusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="invoices-due-from"
                  className="text-xs text-muted-foreground"
                >
                  Due from
                </Label>
                <Input
                  id="invoices-due-from"
                  type="date"
                  value={dueFrom}
                  onChange={(event) => setDueFrom(event.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="invoices-due-to"
                  className="text-xs text-muted-foreground"
                >
                  Due to
                </Label>
                <Input
                  id="invoices-due-to"
                  type="date"
                  value={dueTo}
                  onChange={(event) => setDueTo(event.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Invoice register
              </CardTitle>
              <CardDescription>
                {filtered.length} of {invoiceDirectory.length}{" "}
                {invoiceDirectory.length === 1 ? "invoice" : "invoices"} ·{" "}
                {formatLkr(filteredBalance)} balance in view
              </CardDescription>
            </div>
          </CardHeader>

          {isRefreshing ? (
            <InvoiceSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileTextIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  No invoices match these filters
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different student, branch, status or date range.
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
            <InvoiceTable
              invoices={filtered}
              onView={openDetail}
              onPrint={printPlaceholder}
              onCopy={copyNumber}
              onAction={openAction}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              The invoice reference is a display value for this demo; the schema
              does not model an invoice number. Totals, paid amounts and
              balances are derived from signed lines and active allocations so
              they stay coherent.
            </span>
          </div>
        </Card>
      </div>

      <InvoiceDetailSheet
        invoice={selectedInvoice}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddAdjustment={(invoice) => openAction("adjustment", invoice)}
        onCancelInvoice={(invoice) => openAction("cancel", invoice)}
        onReissue={(invoice) => openAction("reissue", invoice)}
        onPrint={printPlaceholder}
      />

      <InvoiceActionDialog
        action={action}
        invoice={actionInvoice}
        onOpenChange={closeAction}
        onCompleted={(message) => setNotice(message)}
      />
    </main>
  )
}

function InvoiceTable({
  invoices,
  onView,
  onPrint,
  onCopy,
  onAction,
}: {
  invoices: InvoiceRecord[]
  onView: (invoice: InvoiceRecord) => void
  onPrint: (invoice: InvoiceRecord) => void
  onCopy: (invoice: InvoiceRecord) => void
  onAction: (action: InvoiceAction, invoice: InvoiceRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Invoice / student
          </TableHead>
          <TableHead className="text-muted-foreground">Branch</TableHead>
          <TableHead className="text-muted-foreground">Issue / due</TableHead>
          <TableHead className="text-right text-muted-foreground">
            Total
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Paid
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Balance
          </TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const balance = getInvoiceBalance(invoice)
          const canCorrect =
            invoice.status !== "cancelled" && invoice.status !== "waived"

          return (
            <TableRow key={invoice.id}>
              <TableCell className="py-3 pl-4 sm:pl-6">
                <button
                  type="button"
                  onClick={() => onView(invoice)}
                  className="w-fit font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {invoice.invoiceNo}
                </button>
                <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                  {invoice.studentName} · {invoice.studentNo}
                </div>
                <div className="text-xs text-muted-foreground">
                  {invoice.items.length}{" "}
                  {invoice.items.length === 1 ? "line" : "lines"}
                  {invoice.installmentOptionName
                    ? ` · ${invoice.installmentOptionName}`
                    : ""}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {invoice.branchName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  <span>{formatDisplayDate(invoice.issuedOn)}</span>
                  <span className="text-xs">
                    due {formatDisplayDate(invoice.dueDate)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatLkr(invoice.total)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatLkr(invoice.amountPaid)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span
                  className={
                    balance > 0 && canCorrect ? "font-medium" : undefined
                  }
                >
                  {formatLkr(balance)}
                </span>
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="pr-4 text-right sm:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${invoice.invoiceNo}`}
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
                        {invoiceStatusLabels[invoice.status]}
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(invoice)}>
                        <EyeIcon aria-hidden="true" />
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPrint(invoice)}>
                        <PrinterIcon aria-hidden="true" />
                        Print / export (demo)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopy(invoice)}>
                        <CopyIcon aria-hidden="true" />
                        Copy reference
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!canCorrect}
                        onClick={() => onAction("adjustment", invoice)}
                      >
                        <WrenchIcon aria-hidden="true" />
                        Add adjustment
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={invoice.status !== "cancelled"}
                        onClick={() => onAction("reissue", invoice)}
                      >
                        <RefreshCwIcon aria-hidden="true" />
                        Reissue invoice
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!canCorrect}
                        onClick={() => onAction("cancel", invoice)}
                      >
                        <BanIcon aria-hidden="true" />
                        Cancel invoice
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

function InvoiceSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-20" />
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
  isCurrency,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
  isCurrency?: boolean
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span className="text-2xl font-semibold tabular-nums">
          {isCurrency ? formatLkr(value) : value}
        </span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
