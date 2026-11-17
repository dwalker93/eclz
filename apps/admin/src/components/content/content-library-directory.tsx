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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  CopyIcon,
  CreditCardIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilePenLineIcon,
  FolderOpenIcon,
  InfoIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  StoreIcon,
  XIcon,
} from "lucide-react"

import {
  ContentAccessBadge,
  ContentKindBadge,
  ContentStatusBadge,
} from "@/components/content/content-status-badge"
import {
  ContentItemSheet,
  type ContentDraft,
} from "@/components/content/content-item-sheet"
import {
  CONTENT_STORE_MODULE_MOCK,
  contentAccessFilterOptions,
  contentBranchFilterOptions,
  contentBranchFormOptions,
  contentItems,
  contentKindFilterOptions,
  contentLecturerFilterOptions,
  contentLecturerFormOptions,
  contentStatusFilterOptions,
  type ContentItemRecord,
} from "@/lib/content-data"
import { formatLkr } from "@/lib/courses-data"
import { MOCK_TODAY, formatDisplayDate } from "@/lib/students-data"

export function ContentLibraryDirectory() {
  const [items, setItems] = useState<ContentItemRecord[]>(() =>
    contentItems.map((item) => ({ ...item }))
  )
  const [moduleEnabled, setModuleEnabled] = useState(
    CONTENT_STORE_MODULE_MOCK.enabled
  )

  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState("all")
  const [accessFilter, setAccessFilter] = useState("all")
  const [lecturerFilter, setLecturerFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetItemId, setSheetItemId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [startEditing, setStartEditing] = useState(false)

  const [notice, setNotice] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const createCountRef = useRef(0)

  useEffect(() => {
    if (!isRefreshing) return

    const timer = window.setTimeout(() => {
      setIsRefreshing(false)
      setNotice(
        "Content catalog refreshed from local mock data. No server request was made."
      )
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isRefreshing])

  const query = search.trim().toLowerCase()
  const hasActiveFilters =
    search.length > 0 ||
    kindFilter !== "all" ||
    accessFilter !== "all" ||
    lecturerFilter !== "all" ||
    branchFilter !== "all" ||
    statusFilter !== "all"

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false
      if (accessFilter !== "all" && item.accessType !== accessFilter) {
        return false
      }
      if (lecturerFilter !== "all" && item.lecturerId !== lecturerFilter) {
        return false
      }
      if (branchFilter !== "all" && !item.branchIds.includes(branchFilter)) {
        return false
      }
      if (statusFilter !== "all" && item.status !== statusFilter) return false

      if (query.length === 0) return true

      return [
        item.title,
        item.lecturerName,
        item.description ?? "",
        item.fileName ?? "",
        ...item.placements.map((placement) => placement.courseName),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [
    items,
    kindFilter,
    accessFilter,
    lecturerFilter,
    branchFilter,
    statusFilter,
    query,
  ])

  const usage = useMemo(
    () => ({
      total: items.length,
      published: items.filter((item) => item.status === "published").length,
      paid: items.filter((item) => item.accessType === "paid").length,
      draft: items.filter((item) => item.status === "draft").length,
      archived: items.filter((item) => item.status === "archived").length,
    }),
    [items]
  )

  const sheetItem =
    !isCreating && sheetItemId
      ? (items.find((item) => item.id === sheetItemId) ?? null)
      : null

  function clearFilters() {
    setSearch("")
    setKindFilter("all")
    setAccessFilter("all")
    setLecturerFilter("all")
    setBranchFilter("all")
    setStatusFilter("all")
  }

  function openCreate() {
    setSheetItemId(null)
    setIsCreating(true)
    setStartEditing(false)
    setSheetOpen(true)
  }

  function openItem(item: ContentItemRecord, edit: boolean) {
    setSheetItemId(item.id)
    setIsCreating(false)
    setStartEditing(edit)
    setSheetOpen(true)
  }

  function handleSave(draft: ContentDraft, itemId: string | null) {
    const lecturerName =
      contentLecturerFormOptions.find(
        (option) => option.value === draft.lecturerId
      )?.label ?? "Unknown lecturer"
    const branchNames = draft.branchIds.map(
      (branchId) =>
        contentBranchFormOptions.find((option) => option.value === branchId)
          ?.label ?? branchId
    )

    if (itemId) {
      setItems((previous) =>
        previous.map((item) =>
          item.id === itemId
            ? {
                ...item,
                ...draft,
                lecturerName,
                branchNames,
                updatedAt: MOCK_TODAY,
              }
            : item
        )
      )
      setNotice(
        `“${draft.title}” updated in this session. Local demo only — nothing was saved.`
      )
      return
    }

    createCountRef.current += 1
    const newItem: ContentItemRecord = {
      id: `cont-new-${createCountRef.current}`,
      ...draft,
      lecturerName,
      branchNames,
      createdAt: MOCK_TODAY,
      updatedAt: MOCK_TODAY,
    }
    setItems((previous) => [newItem, ...previous])
    setNotice(
      `“${draft.title}” added to the catalog in this session. Local demo only — nothing was saved.`
    )
    setSheetOpen(false)
  }

  async function copyTitle(item: ContentItemRecord) {
    try {
      await navigator.clipboard.writeText(item.title)
      setNotice(`“${item.title}” copied to the clipboard.`)
    } catch {
      setNotice(`Content title: ${item.title}`)
    }
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Content Library
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Catalog built from <code>content_item</code>,{" "}
              <code>content_branch</code>, <code>course_section</code> and{" "}
              <code>course_content</code>. Course, free and paid content are
              kept distinct. Nothing on this page is saved.
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
              Add content
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

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <StoreIcon className="size-4" aria-hidden="true" />
                {CONTENT_STORE_MODULE_MOCK.label}
              </CardTitle>
              <CardDescription>
                {CONTENT_STORE_MODULE_MOCK.hint}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {moduleEnabled ? "On" : "Off"}
              </span>
              <Switch
                checked={moduleEnabled}
                onCheckedChange={(checked) => {
                  setModuleEnabled(checked)
                  setNotice(
                    checked
                      ? "Content store switched on in this preview. Paid items can be sold again."
                      : "Content store switched off in this preview. Paid items stay in the catalog but cannot be sold; course and free content are unaffected."
                  )
                }}
                aria-label="Enable the content store module"
              />
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<FolderOpenIcon aria-hidden="true" />}
            value={usage.total}
            label="Content items"
            hint={`${usage.published} published`}
          />
          <SummaryCard
            icon={<SendIcon aria-hidden="true" />}
            value={usage.published}
            label="Published"
            hint="Visible to eligible students"
          />
          <SummaryCard
            icon={<CreditCardIcon aria-hidden="true" />}
            value={usage.paid}
            label="Paid items"
            hint={moduleEnabled ? "Store module is on" : "Store module is off"}
          />
          <SummaryCard
            icon={<FilePenLineIcon aria-hidden="true" />}
            value={usage.draft}
            label="Drafts"
            hint={`${usage.archived} archived`}
          />
        </div>

        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Filters</span>
                <span className="text-xs text-muted-foreground">
                  Filter by kind, access type, owner, branch or status.
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

            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title, owner, file name or course"
                aria-label="Search content"
                className="pl-8"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Select
                items={contentKindFilterOptions}
                value={kindFilter}
                onValueChange={(value) => setKindFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentKindFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={contentAccessFilterOptions}
                value={accessFilter}
                onValueChange={(value) => setAccessFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentAccessFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={contentLecturerFilterOptions}
                value={lecturerFilter}
                onValueChange={(value) => setLecturerFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentLecturerFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={contentBranchFilterOptions}
                value={branchFilter}
                onValueChange={(value) => setBranchFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentBranchFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={contentStatusFilterOptions}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentStatusFilterOptions.map((option) => (
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
                <FolderOpenIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Content catalog
              </CardTitle>
              <CardDescription>
                {filtered.length} of {items.length}{" "}
                {items.length === 1 ? "item" : "items"}
              </CardDescription>
            </div>
          </CardHeader>

          {isRefreshing ? (
            <ContentSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FolderOpenIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  No content matches these filters
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a different kind, access type, owner, branch or status.
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
            <ContentTable
              items={filtered}
              onView={(item) => openItem(item, false)}
              onEdit={(item) => openItem(item, true)}
              onCopy={copyTitle}
            />
          )}

          <div className="flex items-start gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Course content is included with a linked course; free content is
              open to registered students; paid content needs a purchase. File
              items show a display name only — raw storage keys are never shown.
            </span>
          </div>
        </Card>
      </div>

      <ContentItemSheet
        open={sheetOpen}
        item={sheetItem}
        isCreating={isCreating}
        startEditing={startEditing}
        moduleEnabled={moduleEnabled}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setStartEditing(false)
        }}
        onSave={handleSave}
      />
    </main>
  )
}

function ContentTable({
  items,
  onView,
  onEdit,
  onCopy,
}: {
  items: ContentItemRecord[]
  onView: (item: ContentItemRecord) => void
  onEdit: (item: ContentItemRecord) => void
  onCopy: (item: ContentItemRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Title
          </TableHead>
          <TableHead className="text-muted-foreground">Owner</TableHead>
          <TableHead className="text-muted-foreground">
            Access / price
          </TableHead>
          <TableHead className="text-muted-foreground">Branches</TableHead>
          <TableHead className="text-muted-foreground">
            Courses / sections
          </TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="py-3 pl-4 sm:pl-6">
              <button
                type="button"
                onClick={() => onView(item)}
                className="w-fit text-left font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {item.title}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ContentKindBadge kind={item.kind} />
                <span className="text-xs text-muted-foreground">
                  Updated {formatDisplayDate(item.updatedAt)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {item.lecturerName}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <ContentAccessBadge accessType={item.accessType} />
                {item.price != null ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatLkr(item.price)}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="max-w-[160px] text-muted-foreground">
              <span className="line-clamp-2 text-xs">
                {item.branchNames.join(", ")}
              </span>
            </TableCell>
            <TableCell className="max-w-[240px]">
              {item.placements.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Not placed
                </span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {item.placements.slice(0, 2).map((placement) => (
                    <span key={placement.id} className="truncate text-xs">
                      {placement.courseName}
                      {placement.sectionTitle
                        ? ` · ${placement.sectionTitle}`
                        : ""}
                    </span>
                  ))}
                  {item.placements.length > 2 ? (
                    <span className="text-xs text-muted-foreground">
                      +{item.placements.length - 2} more
                    </span>
                  ) : null}
                </div>
              )}
            </TableCell>
            <TableCell>
              <ContentStatusBadge status={item.status} />
            </TableCell>
            <TableCell className="pr-4 text-right sm:pr-6">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${item.title}`}
                    />
                  }
                >
                  <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onView(item)}>
                      <EyeIcon aria-hidden="true" />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <PencilIcon aria-hidden="true" />
                      Edit item (demo)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCopy(item)}>
                      <CopyIcon aria-hidden="true" />
                      Copy title
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <LayersIcon aria-hidden="true" />
                      {item.placements.length}{" "}
                      {item.placements.length === 1
                        ? "placement"
                        : "placements"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
        >
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-5 w-24 rounded-full" />
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
