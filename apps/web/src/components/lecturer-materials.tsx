"use client"

import { useMemo, useState, type FormEvent } from "react"

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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArchiveIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  Clock3Icon,
  FileTextIcon,
  FolderOpenIcon,
  InfoIcon,
  LayersIcon,
  MapPinIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchXIcon,
  ShoppingBagIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  LecturerContentStatusBadge,
  MaterialAccessBadge,
  MaterialKindBadge,
} from "@/components/portal-status-badge"
import {
  getLecturerCourseById,
  getLecturerCourseClassLabel,
  lecturer,
  lecturerContentItems,
  lecturerCourses,
  type LecturerContentItem,
  type LecturerContentStatus,
  type LecturerCourse,
} from "@/lib/lecturer-portal-data"
import {
  formatDisplayDate,
  formatLkr,
  MATERIAL_ACCESS_LABELS,
  MATERIAL_KIND_LABELS,
  MOCK_TODAY,
  type MaterialAccessType,
  type MaterialKind,
} from "@/lib/student-portal-data"

type ContentStatusFilter = "all" | LecturerContentStatus
type ContentKindFilter = "all" | MaterialKind
type ContentEditorState = { mode: "create" } | { mode: "edit"; itemId: string }

type ContentFormValues = {
  title: string
  description: string
  kind: MaterialKind
  courseId: string
  section: string
  sectionOrder: number
  accessType: MaterialAccessType
  price?: number
  sourceLabel: string
}

type ContentFormState = {
  title: string
  description: string
  kind: MaterialKind
  courseId: string
  section: string
  sectionOrder: string
  accessType: MaterialAccessType
  price: string
  sourceLabel: string
}

const statusFilters: Array<{
  value: ContentStatusFilter
  label: string
}> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
]

const kindFilters: Array<{ value: ContentKindFilter; label: string }> = [
  { value: "all", label: "All kinds" },
  { value: "recording", label: MATERIAL_KIND_LABELS.recording },
  { value: "file", label: MATERIAL_KIND_LABELS.file },
  { value: "book", label: MATERIAL_KIND_LABELS.book },
]

const kindOptions: Array<{ value: MaterialKind; label: string }> = [
  { value: "recording", label: MATERIAL_KIND_LABELS.recording },
  { value: "file", label: MATERIAL_KIND_LABELS.file },
  { value: "book", label: MATERIAL_KIND_LABELS.book },
]

const accessOptions: Array<{ value: MaterialAccessType; label: string }> = [
  { value: "course_only", label: MATERIAL_ACCESS_LABELS.course_only },
  { value: "registered", label: MATERIAL_ACCESS_LABELS.registered },
  { value: "paid", label: MATERIAL_ACCESS_LABELS.paid },
]

const kindSourceField: Record<
  MaterialKind,
  { label: string; placeholder: string; hint: string }
> = {
  recording: {
    label: "Recording link placeholder",
    placeholder: "Lesson recording (demo label)",
    hint: "No URL is opened and no recording is streamed.",
  },
  file: {
    label: "File name placeholder",
    placeholder: "worksheet.pdf",
    hint: "No file is uploaded, stored or downloaded.",
  },
  book: {
    label: "Book reference placeholder",
    placeholder: "Workbook chapter 4 · library desk",
    hint: "No stock check or reservation is made.",
  },
}

const contentKindTones: Record<MaterialKind, string> = {
  recording: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  file: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  book: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

function contentKindIcon(kind: MaterialKind) {
  return kind === "recording"
    ? VideoIcon
    : kind === "file"
      ? FileTextIcon
      : BookOpenIcon
}

function contentItemsEqual(
  first: LecturerContentItem,
  second: LecturerContentItem
) {
  return (
    first.title === second.title &&
    first.description === second.description &&
    first.kind === second.kind &&
    first.courseId === second.courseId &&
    first.section === second.section &&
    first.sectionOrder === second.sectionOrder &&
    first.accessType === second.accessType &&
    (first.price ?? null) === (second.price ?? null) &&
    first.status === second.status &&
    first.listedOn === second.listedOn &&
    first.sourceLabel === second.sourceLabel
  )
}

function groupContentByCourse(items: LecturerContentItem[]) {
  const itemsByCourse = new Map<string, LecturerContentItem[]>()

  for (const item of items) {
    const existing = itemsByCourse.get(item.courseId)

    if (existing) {
      existing.push(item)
    } else {
      itemsByCourse.set(item.courseId, [item])
    }
  }

  return lecturerCourses
    .filter((course) => itemsByCourse.has(course.id))
    .map((course) => {
      const courseItems = itemsByCourse.get(course.id) ?? []
      const itemsBySection = new Map<string, LecturerContentItem[]>()

      for (const item of courseItems) {
        const existing = itemsBySection.get(item.section)

        if (existing) {
          existing.push(item)
        } else {
          itemsBySection.set(item.section, [item])
        }
      }

      const sections = Array.from(
        itemsBySection,
        ([section, sectionItems]) => ({
          section,
          order: Math.min(...sectionItems.map((item) => item.sectionOrder)),
          items: [...sectionItems].sort(
            (first, second) =>
              second.listedOn.localeCompare(first.listedOn) ||
              first.title.localeCompare(second.title)
          ),
        })
      ).sort(
        (first, second) =>
          first.order - second.order ||
          first.section.localeCompare(second.section)
      )

      return { course, sections, count: courseItems.length }
    })
}

function createFormState(item?: LecturerContentItem): ContentFormState {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    kind: item?.kind ?? "file",
    courseId: item?.courseId ?? lecturerCourses[0]?.id ?? "",
    section: item?.section ?? "",
    sectionOrder: String(item?.sectionOrder ?? 1),
    accessType: item?.accessType ?? "course_only",
    price: item?.price !== undefined ? String(item.price) : "",
    sourceLabel: item?.sourceLabel ?? "",
  }
}

export function LecturerMaterials() {
  const [items, setItems] = useState<LecturerContentItem[]>(() => [
    ...lecturerContentItems,
  ])
  const [statusFilter, setStatusFilter] = useState<ContentStatusFilter>("all")
  const [kindFilter, setKindFilter] = useState<ContentKindFilter>("all")
  const [courseFilter, setCourseFilter] = useState("all")
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)
  const [editor, setEditor] = useState<ContentEditorState | null>(null)

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((item) => item.status === "published").length,
      draft: items.filter((item) => item.status === "draft").length,
      archived: items.filter((item) => item.status === "archived").length,
    }),
    [items]
  )

  const localChangeCount = useMemo(
    () =>
      items.reduce((count, item) => {
        const original = lecturerContentItems.find(
          (candidate) => candidate.id === item.id
        )

        if (!original) return count + 1

        return contentItemsEqual(original, item) ? count : count + 1
      }, 0),
    [items]
  )

  const courseOptions = useMemo(
    () =>
      lecturerCourses
        .filter(
          (course) =>
            items.some((item) => item.courseId === course.id) ||
            course.id === courseFilter
        )
        .map((course) => ({
          value: course.id,
          label: `${course.name} · ${course.branch}`,
        })),
    [courseFilter, items]
  )

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false
        }
        if (kindFilter !== "all" && item.kind !== kindFilter) {
          return false
        }
        if (courseFilter !== "all" && item.courseId !== courseFilter) {
          return false
        }
        return true
      }),
    [courseFilter, items, kindFilter, statusFilter]
  )

  const courseGroups = useMemo(
    () => groupContentByCourse(filteredItems),
    [filteredItems]
  )
  const previewItem = items.find((item) => item.id === previewItemId) ?? null
  const editingItem =
    editor?.mode === "edit"
      ? (items.find((item) => item.id === editor.itemId) ?? null)
      : null
  const hasFilters =
    statusFilter !== "all" || kindFilter !== "all" || courseFilter !== "all"

  function clearFilters() {
    setStatusFilter("all")
    setKindFilter("all")
    setCourseFilter("all")
  }

  function resetLocalChanges() {
    setItems([...lecturerContentItems])
    setPreviewItemId(null)
    setEditor(null)
  }

  function handleSave(values: ContentFormValues) {
    if (!editor) return

    if (editor.mode === "create") {
      const newItem: LecturerContentItem = {
        id: `local-content-${Date.now()}`,
        status: "draft",
        listedOn: MOCK_TODAY,
        ...values,
      }

      setItems((current) => [newItem, ...current])
    } else {
      setItems((current) =>
        current.map((item) =>
          item.id === editor.itemId ? { ...item, ...values } : item
        )
      )
    }

    setEditor(null)
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Learning Materials"
          description="Recordings, files and physical books placed on your own courses. Create and edit local drafts, preview content and review paid items — nothing is uploaded, published, sold or saved."
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
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <FolderOpenIcon aria-hidden="true" />
                {items.length} items
              </Badge>
              <Button size="sm" onClick={() => setEditor({ mode: "create" })}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                New draft
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile
            icon={FolderOpenIcon}
            label="All items"
            value={counts.total}
            tone="neutral"
          />
          <SummaryTile
            icon={CircleCheckIcon}
            label="Published"
            value={counts.published}
            tone="emerald"
          />
          <SummaryTile
            icon={Clock3Icon}
            label="Drafts"
            value={counts.draft}
            tone="amber"
          />
          <SummaryTile
            icon={ArchiveIcon}
            label="Archived"
            value={counts.archived}
            tone="neutral"
          />
        </div>

        {localChangeCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-600/20 bg-amber-500/5 p-3 text-sm sm:p-4">
            <div className="flex items-start gap-3">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">
                  {localChangeCount} local{" "}
                  {localChangeCount === 1 ? "change" : "changes"}
                </p>
                <p className="text-muted-foreground">
                  Drafts, edits and resets stay in this page only. Nothing is
                  uploaded, published or saved.
                </p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={resetLocalChanges}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Reset local changes
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <LayersIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Filter library
                </CardTitle>
                <CardDescription>
                  Narrow content by status, kind or course placement.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {filteredItems.length} of {items.length} shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div
              role="group"
              aria-label="Filter by content status"
              className="flex w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1 sm:w-fit"
            >
              {statusFilters.map((filter) => {
                const isSelected = statusFilter === filter.value
                const count =
                  filter.value === "all" ? counts.total : counts[filter.value]

                return (
                  <Button
                    key={filter.value}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    aria-pressed={isSelected}
                    className="gap-1.5"
                  >
                    {filter.label}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </Button>
                )
              })}
            </div>

            <div
              role="group"
              aria-label="Filter by content kind"
              className="flex w-fit flex-wrap gap-1 rounded-lg border p-1"
            >
              {kindFilters.map((filter) => {
                const isSelected = kindFilter === filter.value

                return (
                  <Button
                    key={filter.value}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setKindFilter(filter.value)}
                    aria-pressed={isSelected}
                  >
                    {filter.label}
                  </Button>
                )
              })}
            </div>

            <div className="flex max-w-sm flex-col gap-1.5">
              <label
                htmlFor="lecturer-materials-course"
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
                <SelectTrigger
                  id="lecturer-materials-course"
                  className="w-full"
                >
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
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
              <div>
                <Button variant="ghost" size="xs" onClick={clearFilters}>
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {courseGroups.length === 0 ? (
          <Card className="gap-0 py-0">
            {items.length === 0 ? (
              <EmptyState
                icon={<FolderOpenIcon className="size-5" aria-hidden="true" />}
                title="No learning materials"
                description="Recordings, files and books for your own courses will appear here. Use New draft to preview the local editor."
              />
            ) : (
              <EmptyState
                icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                title="No matching content"
                description="Try another status, kind or course. Clear the filters to see all of your content."
              />
            )}
          </Card>
        ) : (
          courseGroups.map(({ course, sections, count }) => (
            <Card key={course.id} className="gap-0 py-0">
              <CardHeader className="border-b px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {course.subject.slice(0, 1)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <CardTitle>{course.name}</CardTitle>
                      <CardDescription>
                        {course.subject} · {course.branch} ·{" "}
                        {getLecturerCourseClassLabel(course)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {count} {count === 1 ? "item" : "items"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
                {sections.map(({ section, order, items: sectionItems }) => (
                  <section key={section} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{section}</h3>
                        <Badge variant="outline" className="rounded-full">
                          Section {order}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {sectionItems.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {sectionItems.map((item) => (
                        <ContentCard
                          key={item.id}
                          item={item}
                          course={course}
                          onPreview={() => setPreviewItemId(item.id)}
                          onEdit={() =>
                            setEditor({ mode: "edit", itemId: item.id })
                          }
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </CardContent>

              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Only content placed on your own courses is shown. Section order
                is sample placement data.
              </CardFooter>
            </Card>
          ))
        )}

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This library is limited to {lecturer.fullName}&apos;s own courses.
              New items, edits, paid prices and section ordering are local demo
              values. No uploads, storage keys, publishing, playback, downloads,
              purchases or reservations are connected.
            </p>
          </CardContent>
        </Card>
      </div>

      {editor ? (
        <ContentEditorDialog
          key={
            editor.mode === "edit" ? `edit-${editor.itemId}` : "create-draft"
          }
          item={editingItem}
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
          onSave={handleSave}
        />
      ) : null}

      <ContentPreviewDialog
        item={previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItemId(null)
        }}
      />
    </main>
  )
}

function ContentCard({
  item,
  course,
  onPreview,
  onEdit,
}: {
  item: LecturerContentItem
  course: LecturerCourse
  onPreview: () => void
  onEdit: () => void
}) {
  const KindIcon = contentKindIcon(item.kind)

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        item.status === "archived" && "border-dashed bg-muted/20"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            contentKindTones[item.kind]
          )}
        >
          <KindIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <MaterialKindBadge kind={item.kind} />
            <MaterialAccessBadge accessType={item.accessType} />
            <LecturerContentStatusBadge status={item.status} />
          </div>
          <p
            className={cn(
              "text-sm leading-snug font-medium",
              item.status === "archived" && "text-muted-foreground"
            )}
          >
            {item.title}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <BookOpenIcon className="size-3" aria-hidden="true" />
          {course.name}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3" aria-hidden="true" />
          {course.branch}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDaysIcon className="size-3" aria-hidden="true" />
          {item.status === "draft" ? "Prepared" : "Listed"}{" "}
          {formatDisplayDate(item.listedOn)}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        {item.accessType === "paid" && item.price !== undefined ? (
          <span className="text-sm font-medium tabular-nums">
            {formatLkr(item.price)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No charge</span>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="xs" onClick={onPreview}>
            <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
            Preview
          </Button>
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  )
}

function ContentPreviewDialog({
  item,
  onOpenChange,
}: {
  item: LecturerContentItem | null
  onOpenChange: (open: boolean) => void
}) {
  const course = item ? getLecturerCourseById(item.courseId) : null

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      {item ? (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <MaterialKindBadge kind={item.kind} />
              <MaterialAccessBadge accessType={item.accessType} />
              <LecturerContentStatusBadge status={item.status} />
            </div>
            <DialogTitle className="text-lg">{item.title}</DialogTitle>
            <DialogDescription>
              {course?.name ?? "Course content"} · {item.section}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>

          <div className="grid gap-3 text-sm">
            <DetailRow
              icon={BookOpenIcon}
              label="Course placement"
              value={
                course
                  ? `${course.name} · ${getLecturerCourseClassLabel(course)}`
                  : "Not listed"
              }
            />
            <DetailRow
              icon={MapPinIcon}
              label="Branch"
              value={course?.branch ?? "Not listed"}
            />
            <DetailRow
              icon={LayersIcon}
              label="Section order"
              value={`${item.section} · section ${item.sectionOrder}`}
            />
            <DetailRow
              icon={CalendarDaysIcon}
              label={item.status === "draft" ? "Prepared" : "Listed"}
              value={formatDisplayDate(item.listedOn)}
            />
            <DetailRow
              icon={ShoppingBagIcon}
              label="Access"
              value={
                item.accessType === "paid" && item.price !== undefined
                  ? `${MATERIAL_ACCESS_LABELS[item.accessType]} · ${formatLkr(
                      item.price
                    )}`
                  : MATERIAL_ACCESS_LABELS[item.accessType]
              }
            />
            <DetailRow
              icon={contentKindIcon(item.kind)}
              label="Source placeholder"
              value={item.sourceLabel}
            />
          </div>

          <Separator />

          <ContentPreviewPanel item={item} branch={course?.branch ?? null} />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Local preview only. No upload, playback, download, purchase or
            library reservation is connected, and no storage keys are shown.
          </p>

          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function ContentPreviewPanel({
  item,
  branch,
}: {
  item: LecturerContentItem
  branch: string | null
}) {
  const isRecording = item.kind === "recording"
  const isBook = item.kind === "book"
  const Icon = contentKindIcon(item.kind)

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md px-4 py-8 text-center",
          isRecording
            ? "bg-slate-950 text-slate-100"
            : "border bg-background/60"
        )}
      >
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            isRecording
              ? "bg-white/10 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">
          {isRecording
            ? "Recording preview placeholder"
            : isBook
              ? `Physical book · ${branch ?? "your branch"} library desk`
              : "File preview placeholder"}
        </p>
        <p
          className={cn(
            "max-w-xs text-xs leading-relaxed",
            isRecording ? "text-slate-300" : "text-muted-foreground"
          )}
        >
          {isRecording
            ? "Playback is not connected in this demo. No recording is streamed."
            : isBook
              ? "Students would collect this from the library desk. No stock check or reservation is made in this demo."
              : "No file is opened or downloaded in this demo."}
        </p>
      </div>
      <Button variant="outline" size="sm" disabled>
        {isRecording ? (
          <PlayIcon data-icon="inline-start" aria-hidden="true" />
        ) : isBook ? (
          <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <FileTextIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {isRecording
          ? "Play recording"
          : isBook
            ? "View book details"
            : "Open file"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {item.status === "draft"
          ? "Draft item. Students would not see this until it is published."
          : item.status === "archived"
            ? "Archived item. Retained here for reference only."
            : "Published item in this demo library."}
      </p>
    </div>
  )
}

function ContentEditorDialog({
  item,
  onOpenChange,
  onSave,
}: {
  item: LecturerContentItem | null
  onOpenChange: (open: boolean) => void
  onSave: (values: ContentFormValues) => void
}) {
  const [form, setForm] = useState<ContentFormState>(() =>
    createFormState(item ?? undefined)
  )
  const [error, setError] = useState<string | null>(null)

  const sourceField = kindSourceField[form.kind]
  const selectedCourse = getLecturerCourseById(form.courseId)

  function updateForm(patch: Partial<ContentFormState>) {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = form.title.trim()
    const section = form.section.trim()
    const sourceLabel = form.sourceLabel.trim()
    const sectionOrder = Number.parseInt(form.sectionOrder, 10)
    const price = Number.parseInt(form.price, 10)

    if (!title) {
      setError("Add a title for this content item.")
      return
    }
    if (!form.courseId || !selectedCourse) {
      setError("Choose one of your courses for this placement.")
      return
    }
    if (!section) {
      setError("Add a section name for the course placement.")
      return
    }
    if (!Number.isFinite(sectionOrder) || sectionOrder < 1) {
      setError("Section order must be a whole number of 1 or more.")
      return
    }
    if (form.accessType === "paid") {
      if (!Number.isFinite(price) || price <= 0) {
        setError("Add a positive LKR price for paid content.")
        return
      }
    }

    onSave({
      title,
      description: form.description.trim(),
      kind: form.kind,
      courseId: form.courseId,
      section,
      sectionOrder,
      accessType: form.accessType,
      price: form.accessType === "paid" ? price : undefined,
      sourceLabel: sourceLabel || sourceField.placeholder,
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="rounded-full">
              {item ? "Local edit" : "New local draft"}
            </Badge>
            {item ? (
              <LecturerContentStatusBadge status={item.status} />
            ) : (
              <LecturerContentStatusBadge status="draft" />
            )}
          </div>
          <DialogTitle className="text-lg">
            {item ? "Edit content draft" : "New content draft"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Changes update this page's local copy only. The item is not re-published or saved."
              : "New items stay as local drafts. Nothing is uploaded, published or saved."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-title">Title</Label>
            <Input
              id="content-title"
              value={form.title}
              onChange={(event) => updateForm({ title: event.target.value })}
              placeholder="e.g. Fractions revision worksheet"
              maxLength={120}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-description">Description</Label>
            <Textarea
              id="content-description"
              value={form.description}
              onChange={(event) =>
                updateForm({ description: event.target.value })
              }
              placeholder="What this item covers and who it is for."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-kind">Kind</Label>
              <Select
                items={kindOptions}
                value={form.kind}
                onValueChange={(value) =>
                  updateForm({ kind: (value as MaterialKind) ?? "file" })
                }
              >
                <SelectTrigger id="content-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-access">Access</Label>
              <Select
                items={accessOptions}
                value={form.accessType}
                onValueChange={(value) =>
                  updateForm({
                    accessType: (value as MaterialAccessType) ?? "course_only",
                  })
                }
              >
                <SelectTrigger id="content-access" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accessOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.accessType === "paid" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-price">Price (LKR)</Label>
              <Input
                id="content-price"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.price}
                onChange={(event) => updateForm({ price: event.target.value })}
                placeholder="1200"
              />
              <p className="text-xs text-muted-foreground">
                Local demo price only. No payment, store listing or checkout is
                connected.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-course">Course placement</Label>
            <Select
              items={lecturerCourses.map((course) => ({
                value: course.id,
                label: `${course.name} · ${course.branch}`,
              }))}
              value={form.courseId}
              onValueChange={(value) => updateForm({ courseId: value ?? "" })}
            >
              <SelectTrigger id="content-course" className="w-full">
                <BookOpenIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lecturerCourses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name} · {course.branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedCourse
                ? `${selectedCourse.subject} · ${getLecturerCourseClassLabel(
                    selectedCourse
                  )} · ${selectedCourse.branch} branch`
                : "Choose one of your courses."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-section">Section</Label>
              <Input
                id="content-section"
                value={form.section}
                onChange={(event) =>
                  updateForm({ section: event.target.value })
                }
                placeholder="e.g. Fractions and decimals"
                maxLength={80}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-section-order">Section order</Label>
              <Input
                id="content-section-order"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.sectionOrder}
                onChange={(event) =>
                  updateForm({ sectionOrder: event.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-source">{sourceField.label}</Label>
            <Input
              id="content-source"
              value={form.sourceLabel}
              onChange={(event) =>
                updateForm({ sourceLabel: event.target.value })
              }
              placeholder={sourceField.placeholder}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              {sourceField.hint} Raw storage keys and real media URLs are not
              modelled.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {item ? "Update local draft" : "Add local draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: "neutral" | "emerald" | "amber"
}) {
  const toneClasses = {
    neutral: "border-border bg-muted/30 text-foreground",
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        toneClasses[tone]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg leading-none font-semibold tabular-nums">
          {value}
        </p>
        <Icon className="size-4 opacity-70" aria-hidden="true" />
      </div>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}
