"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  Building2Icon,
  CircleAlertIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GraduationCapIcon,
  GripVerticalIcon,
  InfoIcon,
  LayersIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  StoreIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react"

import {
  ContentAccessBadge,
  ContentKindBadge,
  ContentStatusBadge,
} from "@/components/content/content-status-badge"
import {
  CONTENT_STORE_MODULE_MOCK,
  contentAccessFormOptions,
  contentAccessHints,
  contentAccessLabels,
  contentBranchFormOptions,
  contentCourseFormOptions,
  contentKindFormOptions,
  contentKindLabels,
  contentLecturerFormOptions,
  contentStatusFormOptions,
  contentStatusLabels,
  formatContentPrice,
  getCourseSections,
  type ContentAccessType,
  type ContentItemRecord,
  type ContentKind,
  type ContentPlacementRecord,
  type ContentStatus,
} from "@/lib/content-data"
import { formatDisplayDate } from "@/lib/students-data"

export type ContentDraft = {
  title: string
  description: string | null
  kind: ContentKind
  lecturerId: string
  externalUrl: string | null
  fileName: string | null
  fileLabel: string | null
  accessType: ContentAccessType
  price: number | null
  status: ContentStatus
  branchIds: string[]
  placements: ContentPlacementRecord[]
}

type FormState = {
  title: string
  description: string
  kind: ContentKind
  lecturerId: string
  externalUrl: string
  fileName: string
  fileLabel: string
  accessType: ContentAccessType
  price: string
  status: ContentStatus
  branchIds: string[]
  placements: ContentPlacementRecord[]
}

type FormErrors = {
  title?: string
  lecturerId?: string
  externalUrl?: string
  fileName?: string
  price?: string
  branchIds?: string
}

type ContentItemSheetProps = {
  open: boolean
  item: ContentItemRecord | null
  isCreating: boolean
  startEditing?: boolean
  moduleEnabled: boolean
  onOpenChange: (open: boolean) => void
  onSave: (draft: ContentDraft, itemId: string | null) => void
}

function createEmptyForm(item: ContentItemRecord | null): FormState {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    kind: item?.kind ?? "recording",
    lecturerId: item?.lecturerId ?? contentLecturerFormOptions[0]?.value ?? "",
    externalUrl: item?.externalUrl ?? "",
    fileName: item?.fileName ?? "",
    fileLabel: item?.fileLabel ?? "",
    accessType: item?.accessType ?? "course",
    price: item?.price != null ? String(item.price) : "",
    status: item?.status ?? "draft",
    branchIds: item?.branchIds ? [...item.branchIds] : [],
    placements: item?.placements
      ? item.placements.map((placement) => ({ ...placement }))
      : [],
  }
}

export function ContentItemSheet({
  open,
  item,
  isCreating,
  startEditing = false,
  moduleEnabled,
  onOpenChange,
  onSave,
}: ContentItemSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const initKeyRef = useRef("")
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(() => createEmptyForm(item))
  const [errors, setErrors] = useState<FormErrors>({})
  const [addCourseId, setAddCourseId] = useState(
    contentCourseFormOptions[0]?.value ?? ""
  )

  useEffect(() => {
    if (!open) {
      initKeyRef.current = ""
      return
    }

    const key = `${isCreating ? "new" : (item?.id ?? "none")}:${startEditing ? "edit" : "view"}`
    if (initKeyRef.current === key) return

    initKeyRef.current = key
    setEditing(isCreating || startEditing)
    setForm(createEmptyForm(item))
    setErrors({})
  }, [open, item, isCreating, startEditing])

  const addCourseOptions = useMemo(
    () =>
      contentCourseFormOptions.map((option) => ({
        ...option,
        disabled: form.placements.some(
          (placement) => placement.courseId === option.value
        ),
      })),
    [form.placements]
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function toggleBranch(branchId: string, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      branchIds: checked
        ? [...previous.branchIds, branchId]
        : previous.branchIds.filter((id) => id !== branchId),
    }))
  }

  function setPlacementSection(placementId: string, value: string) {
    setForm((previous) => ({
      ...previous,
      placements: previous.placements.map((placement) => {
        if (placement.id !== placementId) return placement
        const section =
          value === "none"
            ? undefined
            : getCourseSections(placement.courseId).find(
                (item) => item.id === value
              )
        return {
          ...placement,
          sectionId: value === "none" ? null : (section?.id ?? null),
          sectionTitle: value === "none" ? null : (section?.title ?? null),
        }
      }),
    }))
  }

  function movePlacement(index: number, direction: -1 | 1) {
    setForm((previous) => {
      const target = index + direction
      if (target < 0 || target >= previous.placements.length) return previous
      const placements = [...previous.placements]
      const current = placements[index]
      const swap = placements[target]
      if (!current || !swap) return previous
      placements[index] = swap
      placements[target] = current
      return { ...previous, placements }
    })
  }

  function removePlacement(placementId: string) {
    setForm((previous) => ({
      ...previous,
      placements: previous.placements.filter(
        (placement) => placement.id !== placementId
      ),
    }))
  }

  function addPlacement() {
    const course = contentCourseFormOptions.find(
      (option) => option.value === addCourseId
    )
    if (!course) return
    if (form.placements.some((p) => p.courseId === addCourseId)) return

    const section = getCourseSections(addCourseId)[0]
    setForm((previous) => ({
      ...previous,
      placements: [
        ...previous.placements,
        {
          id: `tmp-${previous.placements.length}-${addCourseId}`,
          courseId: addCourseId,
          courseName: course.label,
          sectionId: section?.id ?? null,
          sectionTitle: section?.title ?? null,
          position: previous.placements.length,
        },
      ],
    }))
  }

  function handleSave() {
    const nextErrors: FormErrors = {}
    const priceNumber = Number(form.price)

    if (!form.title.trim()) nextErrors.title = "Enter a title."
    if (!form.lecturerId) nextErrors.lecturerId = "Choose an owner lecturer."
    if (form.kind === "recording" && !form.externalUrl.trim()) {
      nextErrors.externalUrl = "Recordings need an external link."
    }
    if (form.kind === "file" && !form.fileName.trim()) {
      nextErrors.fileName = "Attach a file or enter a display name."
    }
    if (
      form.accessType === "paid" &&
      (form.price.trim() === "" ||
        !Number.isFinite(priceNumber) ||
        priceNumber <= 0)
    ) {
      nextErrors.price = "Paid content needs a price above 0."
    }
    if (form.branchIds.length === 0) {
      nextErrors.branchIds = "List the item in at least one branch."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSave(
      {
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        lecturerId: form.lecturerId,
        externalUrl:
          form.kind === "recording" ? form.externalUrl.trim() || null : null,
        fileName: form.kind === "file" ? form.fileName.trim() || null : null,
        fileLabel:
          form.kind === "file" ? form.fileLabel.trim() || "File" : null,
        accessType: form.accessType,
        price: form.accessType === "paid" ? priceNumber : null,
        status: form.status,
        branchIds: form.branchIds,
        placements: form.placements.map((placement, index) => ({
          ...placement,
          position: index,
        })),
      },
      item?.id ?? null
    )
    setEditing(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader
          ref={headerRef}
          tabIndex={-1}
          className="border-b p-6 pr-14 outline-none"
        >
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
            {isCreating ? "New content item" : (item?.title ?? "Content item")}
            {item ? <ContentKindBadge kind={item.kind} /> : null}
            {item ? <ContentStatusBadge status={item.status} /> : null}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isCreating
              ? "Create a content item in this demo"
              : `Details for ${item?.title}`}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span>Content catalog</span>
            {item ? <span>· {item.lecturerName}</span> : null}
            {item ? (
              <span>· Updated {formatDisplayDate(item.updatedAt)}</span>
            ) : null}
          </div>
        </SheetHeader>

        {editing ? (
          <ContentForm
            form={form}
            errors={errors}
            addCourseId={addCourseId}
            addCourseOptions={addCourseOptions}
            onAddCourseIdChange={setAddCourseId}
            onUpdate={update}
            onToggleBranch={toggleBranch}
            onSetPlacementSection={setPlacementSection}
            onMovePlacement={movePlacement}
            onRemovePlacement={removePlacement}
            onAddPlacement={addPlacement}
            moduleEnabled={moduleEnabled}
          />
        ) : item ? (
          <ContentView item={item} moduleEnabled={moduleEnabled} />
        ) : null}

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
          <span className="text-xs text-muted-foreground">
            {editing
              ? "Local demo — nothing is saved"
              : item
                ? "Sample content · no changes are saved"
                : "New item preview"}
          </span>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isCreating) {
                      onOpenChange(false)
                      return
                    }
                    setEditing(false)
                    setForm(createEmptyForm(item))
                    setErrors({})
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {isCreating ? "Create item (demo)" : "Save changes (demo)"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {item ? (
                  <Button
                    onClick={() => {
                      setForm(createEmptyForm(item))
                      setErrors({})
                      setEditing(true)
                    }}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Edit item (demo)
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ContentView({
  item,
  moduleEnabled,
}: {
  item: ContentItemRecord
  moduleEnabled: boolean
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Access"
          value={contentAccessLabels[item.accessType]}
          strong
        />
        <SummaryStat label="Price" value={formatContentPrice(item)} />
        <SummaryStat label="Branches" value={`${item.branchIds.length}`} />
        <SummaryStat label="Placements" value={`${item.placements.length}`} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<FileTextIcon />} title="Overview" />
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
          <DetailField label="Title" value={item.title} />
          <DetailField label="Kind" value={contentKindLabels[item.kind]} />
          <DetailField label="Owner" value={item.lecturerName} />
          <DetailField
            label="Status"
            value={contentStatusLabels[item.status]}
          />
          <DetailField
            label="Created"
            value={formatDisplayDate(item.createdAt)}
          />
          <DetailField
            label="Updated"
            value={formatDisplayDate(item.updatedAt)}
          />
        </dl>
        {item.description ? (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>{item.description}</span>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<LayersIcon />} title="Kind-specific details" />
        {item.kind === "recording" ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
            <div className="flex min-w-0 items-center gap-2">
              <VideoIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  External link
                </span>
                <span className="truncate text-sm">
                  {item.externalUrl ?? "Not set"}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full">
              <ExternalLinkIcon aria-hidden="true" />
              Opens away
            </Badge>
          </div>
        ) : item.kind === "file" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div className="flex min-w-0 items-center gap-2">
              <PaperclipIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  File
                </span>
                <span className="truncate text-sm">
                  {item.fileName ?? "Not attached"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.fileLabel ?? "—"}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => undefined}
              disabled
            >
              <PaperclipIcon data-icon="inline-start" />
              Replace file (demo)
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <BookOpenIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Physical book — no file or external link. Stock is handed over at
              a branch after a paid purchase.
            </span>
          </div>
        )}
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Storage keys are never shown. File items expose a display name only;
            recordings expose their external link.
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<CreditCardIcon />} title="Access" />
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ContentAccessBadge accessType={item.accessType} />
            {item.accessType === "paid" ? (
              <span className="text-sm font-medium tabular-nums">
                {formatContentPrice(item)}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {contentAccessHints[item.accessType]}
          </p>
          {item.accessType === "paid" ? (
            <div
              className={
                moduleEnabled
                  ? "flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                  : "flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
              }
            >
              <StoreIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                {moduleEnabled
                  ? "Paid content sells through a purchase and invoice. Paid items grant access only once paid."
                  : "Content store module is off. This paid item can be edited but cannot be sold until the module is re-enabled. Course and free content are unaffected."}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<Building2Icon />} title="Listed branches" />
        <div className="flex flex-wrap gap-2 rounded-lg border p-4">
          {item.branchNames.length > 0 ? (
            item.branchNames.map((name) => (
              <Badge key={name} variant="outline" className="rounded-full">
                <Building2Icon aria-hidden="true" />
                {name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              Not listed in any branch.
            </span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          icon={<GraduationCapIcon />}
          title="Course placement"
          aside={
            <Badge variant="outline" className="rounded-full">
              {item.placements.length}{" "}
              {item.placements.length === 1 ? "course" : "courses"}
            </Badge>
          }
        />
        {item.placements.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Not placed in a course yet.</span>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {item.placements.map((placement) => (
              <li
                key={placement.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {placement.position + 1}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {placement.courseName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {placement.sectionTitle ?? "Course level (no section)"}
                    </span>
                  </span>
                </span>
                <GripVerticalIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
        <CircleAlertIcon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          Demo only. Content items, branches and placements are sample data; no
          file is uploaded and nothing is saved.
        </span>
      </div>
    </div>
  )
}

function ContentForm({
  form,
  errors,
  addCourseId,
  addCourseOptions,
  onAddCourseIdChange,
  onUpdate,
  onToggleBranch,
  onSetPlacementSection,
  onMovePlacement,
  onRemovePlacement,
  onAddPlacement,
  moduleEnabled,
}: {
  form: FormState
  errors: FormErrors
  addCourseId: string
  addCourseOptions: { value: string; label: string; disabled: boolean }[]
  onAddCourseIdChange: (value: string) => void
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onToggleBranch: (branchId: string, checked: boolean) => void
  onSetPlacementSection: (placementId: string, value: string) => void
  onMovePlacement: (index: number, direction: -1 | 1) => void
  onRemovePlacement: (placementId: string) => void
  onAddPlacement: () => void
  moduleEnabled: boolean
}) {
  return (
    <div className="flex flex-col gap-5 p-6">
      <section className="flex flex-col gap-3">
        <SectionHeading icon={<FileTextIcon />} title="Basics" />
        <FormField
          label="Title"
          htmlFor="content-title"
          required
          error={errors.title}
        >
          <Input
            id="content-title"
            value={form.title}
            onChange={(event) => onUpdate("title", event.target.value)}
            placeholder="e.g. Grade 8 Maths — Algebra walkthrough"
            aria-invalid={errors.title ? true : undefined}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Kind" htmlFor="content-kind">
            <Select
              items={contentKindFormOptions}
              value={form.kind}
              onValueChange={(value) =>
                onUpdate("kind", (value ?? "recording") as ContentKind)
              }
            >
              <SelectTrigger id="content-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentKindFormOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Owner lecturer"
            htmlFor="content-lecturer"
            required
            error={errors.lecturerId}
          >
            <Select
              items={contentLecturerFormOptions}
              value={form.lecturerId}
              onValueChange={(value) => onUpdate("lecturerId", value ?? "")}
            >
              <SelectTrigger id="content-lecturer" className="w-full">
                <SelectValue placeholder="Select lecturer" />
              </SelectTrigger>
              <SelectContent>
                {contentLecturerFormOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Description" htmlFor="content-description">
          <Textarea
            id="content-description"
            value={form.description}
            onChange={(event) => onUpdate("description", event.target.value)}
            placeholder="Short summary shown in the catalog"
          />
        </FormField>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<LayersIcon />} title="Kind-specific fields" />
        {form.kind === "recording" ? (
          <FormField
            label="External link"
            htmlFor="content-url"
            required
            error={errors.externalUrl}
            hint="YouTube or other external URL. The link is shown as-is."
          >
            <Input
              id="content-url"
              value={form.externalUrl}
              onChange={(event) => onUpdate("externalUrl", event.target.value)}
              placeholder="https://youtu.be/…"
              aria-invalid={errors.externalUrl ? true : undefined}
            />
          </FormField>
        ) : form.kind === "file" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="File display name"
              htmlFor="content-file"
              required
              error={errors.fileName}
              hint="No upload in this demo; only the display name."
            >
              <Input
                id="content-file"
                value={form.fileName}
                onChange={(event) => onUpdate("fileName", event.target.value)}
                placeholder="worksheet-02.pdf"
                aria-invalid={errors.fileName ? true : undefined}
              />
            </FormField>
            <FormField label="Type / size label" htmlFor="content-file-label">
              <Input
                id="content-file-label"
                value={form.fileLabel}
                onChange={(event) => onUpdate("fileLabel", event.target.value)}
                placeholder="PDF · 1.2 MB"
              />
            </FormField>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <BookOpenIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              Physical books have no link or file. They are sold as paid items
              and handed over at a branch.
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<CreditCardIcon />} title="Access & price" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Access type" htmlFor="content-access">
            <Select
              items={contentAccessFormOptions}
              value={form.accessType}
              onValueChange={(value) =>
                onUpdate("accessType", (value ?? "course") as ContentAccessType)
              }
            >
              <SelectTrigger id="content-access" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentAccessFormOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Price (LKR)"
            htmlFor="content-price"
            required={form.accessType === "paid"}
            error={errors.price}
          >
            <Input
              id="content-price"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => onUpdate("price", event.target.value)}
              disabled={form.accessType !== "paid"}
              placeholder={form.accessType === "paid" ? "1500" : "Not priced"}
              aria-invalid={errors.price ? true : undefined}
            />
          </FormField>
        </div>
        <p className="text-xs text-muted-foreground">
          {contentAccessHints[form.accessType]}
        </p>
        {form.accessType === "paid" && !moduleEnabled ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <StoreIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              The content store module is off. This item can be saved in the
              catalog but cannot be sold until the module is re-enabled.
            </span>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<SendIcon />} title="Publishing" />
        <FormField label="Status" htmlFor="content-status">
          <Select
            items={contentStatusFormOptions}
            value={form.status}
            onValueChange={(value) =>
              onUpdate("status", (value ?? "draft") as ContentStatus)
            }
          >
            <SelectTrigger id="content-status" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contentStatusFormOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          icon={<Building2Icon />}
          title="Branch visibility"
          aside={
            <Badge variant="outline" className="rounded-full">
              {form.branchIds.length} selected
            </Badge>
          }
        />
        <div className="grid grid-cols-1 gap-1.5 rounded-lg border p-2 sm:grid-cols-2">
          {contentBranchFormOptions.map((branch) => {
            const checked = form.branchIds.includes(branch.value)
            return (
              <Label
                key={branch.value}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 font-normal hover:bg-muted/60"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    onToggleBranch(branch.value, value === true)
                  }
                />
                <span className="text-sm">{branch.label}</span>
              </Label>
            )
          })}
        </div>
        {errors.branchIds ? (
          <p className="text-xs text-destructive">{errors.branchIds}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          icon={<GraduationCapIcon />}
          title="Course placement"
          aside={
            <Badge variant="outline" className="rounded-full">
              {form.placements.length}{" "}
              {form.placements.length === 1 ? "course" : "courses"}
            </Badge>
          }
        />
        {form.placements.length === 0 ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Not placed in a course yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {form.placements.map((placement, index) => (
              <li
                key={placement.id}
                className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <GripVerticalIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium">
                      {placement.courseName}
                    </span>
                    <Select
                      items={getSectionOptions(placement.courseId)}
                      value={placement.sectionId ?? "none"}
                      onValueChange={(value) =>
                        onSetPlacementSection(placement.id, value ?? "none")
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-full"
                        aria-label={`Section for ${placement.courseName}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getSectionOptions(placement.courseId).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move placement up"
                    disabled={index === 0}
                    onClick={() => onMovePlacement(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move placement down"
                    disabled={index === form.placements.length - 1}
                    onClick={() => onMovePlacement(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove placement"
                    onClick={() => onRemovePlacement(placement.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            items={addCourseOptions}
            value={addCourseId}
            onValueChange={(value) => onAddCourseIdChange(value ?? "")}
          >
            <SelectTrigger
              className="w-full sm:w-72"
              aria-label="Course to add"
            >
              <PlusIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <SelectValue placeholder="Add course" />
            </SelectTrigger>
            <SelectContent>
              {addCourseOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                  {option.disabled ? " · added" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={onAddPlacement}
            disabled={
              addCourseId === "" ||
              form.placements.some(
                (placement) => placement.courseId === addCourseId
              )
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add placement
          </Button>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
        <CircleAlertIcon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          Demo only. Saving updates this session&apos;s preview; nothing is
          written to a database and no file is uploaded.
        </span>
      </div>
    </div>
  )
}

function getSectionOptions(courseId: string) {
  return [
    { value: "none", label: "Course level (no section)" },
    ...getCourseSections(courseId).map((section) => ({
      value: section.id,
      label: section.title,
    })),
  ]
}

function SectionHeading({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
  )
}

function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`truncate ${strong ? "text-base font-semibold" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  )
}
