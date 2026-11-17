"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  Building2Icon,
  BookOpenIcon,
  EllipsisVerticalIcon,
  InfoIcon,
  LandmarkIcon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react"

import {
  BranchFormDialog,
  type BranchDraft,
} from "@/components/branches/branch-form-dialog"
import {
  branches as branchSeeds,
  branchHasDependents,
  getBranchDependents,
  type BranchRecord,
} from "@/lib/branches-data"
import { MOCK_TODAY, formatDisplayDate } from "@/lib/students-data"

export function BranchesDirectory() {
  const [branches, setBranches] = useState<BranchRecord[]>(() =>
    branchSeeds.map((branch) => ({ ...branch }))
  )
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const createCountRef = useRef(0)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Branches refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const query = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (query.length === 0) return branches

    return branches.filter((branch) =>
      [branch.name, branch.address ?? "", branch.phone ?? ""].some((value) =>
        value.toLowerCase().includes(query)
      )
    )
  }, [branches, query])

  const summary = useMemo(
    () => ({
      total: branches.length,
      active: branches.filter((branch) => branch.isActive).length,
      defaultName:
        branches.find((branch) => branch.isDefault)?.name ?? "Not set",
      coursePlacements: branches.reduce(
        (total, branch) => total + branch.courseCount,
        0
      ),
      bankAccounts: branches.reduce(
        (total, branch) => total + branch.bankAccountCount,
        0
      ),
    }),
    [branches]
  )

  const editingBranch =
    !isCreating && editingId
      ? (branches.find((branch) => branch.id === editingId) ?? null)
      : null

  function openCreate() {
    setEditingId(null)
    setIsCreating(true)
    setDialogOpen(true)
  }

  function openEdit(branch: BranchRecord) {
    setEditingId(branch.id)
    setIsCreating(false)
    setDialogOpen(true)
  }

  function handleSave(draft: BranchDraft, branchId: string | null) {
    if (branchId) {
      setBranches((previous) =>
        previous.map((branch) => {
          if (branch.id === branchId) {
            return { ...branch, ...draft }
          }
          return draft.isDefault ? { ...branch, isDefault: false } : branch
        })
      )
      setNotice(
        `“${draft.name}” updated in this session. Local demo only — nothing was saved.`
      )
      setDialogOpen(false)
      return
    }

    createCountRef.current += 1
    const newBranch: BranchRecord = {
      id: `br-new-${createCountRef.current}`,
      ...draft,
      studentCount: 0,
      courseCount: 0,
      bankAccountCount: 0,
      createdAt: MOCK_TODAY,
    }

    setBranches((previous) => [
      newBranch,
      ...(draft.isDefault
        ? previous.map((branch) => ({ ...branch, isDefault: false }))
        : previous),
    ])
    setNotice(
      `“${draft.name}” added in this session. Local demo only — nothing was saved.`
    )
    setDialogOpen(false)
  }

  function setDefault(branch: BranchRecord) {
    setBranches((previous) =>
      previous.map((item) => ({
        ...item,
        isDefault: item.id === branch.id,
      }))
    )
    setNotice(
      `“${branch.name}” set as the default branch in this session. Nothing was saved.`
    )
  }

  function toggleActive(branch: BranchRecord) {
    if (branch.isDefault && branch.isActive) {
      setNotice(
        "The default branch must stay active. Set another branch as default before deactivating this one."
      )
      return
    }

    const nextActive = !branch.isActive
    setBranches((previous) =>
      previous.map((item) =>
        item.id === branch.id ? { ...item, isActive: nextActive } : item
      )
    )
    setNotice(
      `“${branch.name}” ${nextActive ? "reactivated" : "deactivated"} in this session. Existing records keep their branch and nothing was saved.`
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Directory built from <code>branch</code>. A branch scopes courses,
              students, invoices, payments, receipts and bank accounts. Nothing
              on this page is saved.
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
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              Add branch
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
            icon={<MapPinIcon aria-hidden="true" />}
            value={summary.total}
            label="Branches"
            hint={`${summary.active} active`}
          />
          <SummaryCard
            icon={<StarIcon aria-hidden="true" />}
            value={summary.defaultName}
            label="Default branch"
            hint="Receives transfers by default"
            isText
          />
          <SummaryCard
            icon={<BookOpenIcon aria-hidden="true" />}
            value={summary.coursePlacements}
            label="Course placements"
            hint="Across all branches"
          />
          <SummaryCard
            icon={<LandmarkIcon aria-hidden="true" />}
            value={summary.bankAccounts}
            label="Bank accounts"
            hint="Branch-scoped destinations"
          />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <Building2Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Branch directory
              </CardTitle>
              <CardDescription>
                {filtered.length} of {branches.length}{" "}
                {branches.length === 1 ? "branch" : "branches"}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, address or phone"
                aria-label="Search branches"
                className="pl-8"
              />
            </div>
          </CardHeader>

          {isRefreshing ? (
            <BranchesSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MapPinIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No branches match</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different name, address or phone number.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearch("")}
                disabled={search.length === 0}
              >
                Clear search
              </Button>
            </div>
          ) : (
            <BranchesTable
              branches={filtered}
              onEdit={openEdit}
              onSetDefault={setDefault}
              onToggleActive={toggleActive}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Exactly one branch is the default. A branch that has linked
              students, courses or bank accounts is deactivated rather than
              deleted, so its history is preserved.
            </span>
          </div>
        </Card>
      </div>

      <BranchFormDialog
        open={dialogOpen}
        branch={editingBranch}
        isCreating={isCreating}
        existingNames={branches.map((branch) => branch.name.toLowerCase())}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingId(null)
        }}
        onSave={handleSave}
      />
    </main>
  )
}

function BranchesTable({
  branches,
  onEdit,
  onSetDefault,
  onToggleActive,
}: {
  branches: BranchRecord[]
  onEdit: (branch: BranchRecord) => void
  onSetDefault: (branch: BranchRecord) => void
  onToggleActive: (branch: BranchRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Branch
          </TableHead>
          <TableHead className="text-muted-foreground">Address</TableHead>
          <TableHead className="text-muted-foreground">Phone</TableHead>
          <TableHead className="text-right text-muted-foreground">
            Students
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Courses
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Bank accts
          </TableHead>
          <TableHead className="text-muted-foreground">Created</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {branches.map((branch) => {
          const dependents = getBranchDependents(branch)
          const hasDependents = branchHasDependents(branch)

          return (
            <TableRow
              key={branch.id}
              className={branch.isActive ? undefined : "opacity-60"}
            >
              <TableCell className="py-3 pl-4 sm:pl-6">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{branch.name}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {branch.isDefault ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/20 bg-primary/10 text-primary"
                      >
                        <StarIcon aria-hidden="true" />
                        Default
                      </Badge>
                    ) : null}
                    {!branch.isActive ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-border bg-muted text-muted-foreground"
                      >
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] text-muted-foreground">
                {branch.address ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {branch.phone ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {branch.studentCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {branch.courseCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {branch.bankAccountCount}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDisplayDate(branch.createdAt)}
              </TableCell>
              <TableCell className="pr-4 text-right sm:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${branch.name}`}
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
                      <DropdownMenuLabel>{branch.name}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onEdit(branch)}>
                        <PencilIcon aria-hidden="true" />
                        Edit branch (demo)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={branch.isDefault || !branch.isActive}
                        onClick={() => onSetDefault(branch)}
                      >
                        <StarIcon aria-hidden="true" />
                        Set as default
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={branch.isDefault && branch.isActive}
                        onClick={() => onToggleActive(branch)}
                      >
                        <PowerIcon aria-hidden="true" />
                        {branch.isActive ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>
                        <LockIcon aria-hidden="true" />
                        {hasDependents
                          ? `Delete — has ${dependents
                              .map((entry) => `${entry.count} ${entry.label}`)
                              .join(", ")}`
                          : "Delete branch (none in demo)"}
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

function BranchesSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="ml-auto h-3.5 w-10" />
          <Skeleton className="h-3.5 w-10" />
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
  isText,
}: {
  icon: ReactNode
  value: number | string
  label: string
  hint: string
  isText?: boolean
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span
          className={
            isText
              ? "truncate text-lg font-semibold"
              : "text-2xl font-semibold tabular-nums"
          }
        >
          {value}
        </span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
