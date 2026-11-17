"use client"

import { useEffect, useRef, useState } from "react"
import type { FormEvent, ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import {
  CalendarClockIcon,
  CircleAlertIcon,
  EyeIcon,
  InfoIcon,
  MegaphoneIcon,
  PlusIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react"

import { NoticeStatusBadge } from "@/components/notices/notice-status-badge"
import {
  countNoticeTargetRecipients,
  describeRecipientCount,
  estimateNoticeRecipients,
  formatNoticeTimestamp,
  getNoticeAudienceSummary,
  getNoticeAuthor,
  getNoticeBranchLabel,
  getNoticeState,
  getNoticeTargetLabel,
  getNoticeTargetValueLabel,
  noticeAuthors,
  noticeBranchFormOptions,
  noticeCourseOptions,
  noticeGradeOptions,
  noticeRoleOptions,
  noticeStateDescriptions,
  noticeStateLabels,
  noticeStudentOptions,
  noticeTargetTypeLabels,
  noticeTargetTypeOptions,
  type NoticeRecord,
  type NoticeTarget,
  type NoticeTargetType,
} from "@/lib/notices-data"
import { MOCK_TODAY } from "@/lib/students-data"
type NoticeFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  notice: NoticeRecord | null
  onSaved: (message: string) => void
}

type FormState = {
  title: string
  body: string
  branchId: string
  publishAt: string
  expiresAt: string
  targets: NoticeTarget[]
}

const emptyForm: FormState = {
  title: "",
  body: "",
  branchId: "all",
  publishAt: "",
  expiresAt: "",
  targets: [],
}

function toInputValue(value: string | null) {
  return value ? value.slice(0, 16) : ""
}

function toTimestamp(value: string) {
  return `${value}:00+05:30`
}

function defaultTargetRef(type: NoticeTargetType) {
  if (type === "role") return "role-student"
  if (type === "course") return noticeCourseOptions[0]?.value ?? ""
  if (type === "grade") return noticeGradeOptions[0]?.value ?? ""
  if (type === "student") return noticeStudentOptions[0]?.value ?? ""

  return ""
}

function targetRefOptions(type: NoticeTargetType) {
  if (type === "role") return noticeRoleOptions
  if (type === "course") return noticeCourseOptions
  if (type === "grade") return noticeGradeOptions
  if (type === "student") return noticeStudentOptions

  return []
}

export function NoticeFormDialog({
  open,
  onOpenChange,
  notice,
  onSaved,
}: NoticeFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [targetType, setTargetType] = useState<NoticeTargetType>("all")
  const [targetRef, setTargetRef] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const targetSeq = useRef(0)

  useEffect(() => {
    if (!open) return

    setForm(
      notice
        ? {
            title: notice.title,
            body: notice.body,
            branchId: notice.branchId ?? "all",
            publishAt: toInputValue(notice.publishedAt),
            expiresAt: toInputValue(notice.expiresAt),
            targets: notice.targets.map((target) => ({ ...target })),
          }
        : emptyForm
    )
    setTargetType("all")
    setTargetRef("")
    setErrors([])
    setPreview(false)
  }, [open, notice])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function changeTargetType(value: NoticeTargetType) {
    setTargetType(value)
    setTargetRef(defaultTargetRef(value))
  }

  function addTarget() {
    if (targetType === "all") {
      setForm((previous) => ({
        ...previous,
        targets: [
          {
            id: `preview-target-${++targetSeq.current}`,
            targetType: "all",
            targetId: null,
          },
        ],
      }))
      return
    }

    if (!targetRef) return

    const exists = form.targets.some(
      (target) =>
        target.targetType === targetType && target.targetId === targetRef
    )

    if (exists) return

    setForm((previous) => ({
      ...previous,
      targets: [
        ...previous.targets.filter((target) => target.targetType !== "all"),
        {
          id: `preview-target-${++targetSeq.current}`,
          targetType,
          targetId: targetRef,
        },
      ],
    }))
  }

  function removeTarget(targetId: string) {
    setForm((previous) => ({
      ...previous,
      targets: previous.targets.filter((target) => target.id !== targetId),
    }))
  }

  const authorRecord = notice
    ? getNoticeAuthor(notice)
    : (noticeAuthors[0] ?? {
        id: "usr-admin-1",
        fullName: "Dilani Jayawardena",
        role: "Administrator",
      })
  const previewRecord: NoticeRecord = {
    id: notice?.id ?? "preview-notice",
    title: form.title.trim() || "Untitled notice",
    body: form.body.trim() || "No body yet.",
    authorId: notice?.authorId ?? "usr-admin-1",
    branchId: form.branchId === "all" ? null : form.branchId,
    publishedAt: form.publishAt ? toTimestamp(form.publishAt) : null,
    expiresAt: form.expiresAt ? toTimestamp(form.expiresAt) : null,
    createdAt: notice?.createdAt ?? `${MOCK_TODAY}T09:00:00+05:30`,
    targets: form.targets,
  }
  const previewState = getNoticeState(previewRecord)

  function validate() {
    const nextErrors: string[] = []

    if (!form.title.trim()) nextErrors.push("Title is required.")
    if (!form.body.trim()) nextErrors.push("Notice body is required.")
    if (form.targets.length === 0) {
      nextErrors.push("Add at least one audience target.")
    }

    if (form.expiresAt && !form.publishAt) {
      nextErrors.push("Add a publish time before setting an expiry time.")
    }

    if (
      form.publishAt &&
      form.expiresAt &&
      form.expiresAt <= form.publishAt
    ) {
      nextErrors.push("Expiry must be after the publish time.")
    }

    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors([])
    setPreview(true)
  }

  const refOptions = targetRefOptions(targetType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MegaphoneIcon className="size-4" aria-hidden="true" />
            {preview
              ? "Notice preview"
              : notice
                ? "Edit notice"
                : "New notice"}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? "Check the recipient view and targeting. Nothing is published or sent."
              : "Write the notice, choose when it should appear, and target the audience. This is a UI demo — no notice is saved or sent."}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Preview only. Publishing and notifications are not implemented,
                and no notice record is written.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <NoticeStatusBadge state={previewState} />
              <Badge variant="outline" className="rounded-full">
                {previewState === "draft"
                  ? "Publishes when a time is set"
                  : noticeStateDescriptions[previewState]}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {getNoticeBranchLabel(previewRecord)}
              </Badge>
            </div>

            <article className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MegaphoneIcon className="size-4" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-base font-semibold">
                    {previewRecord.title}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {authorRecord.fullName} ·{" "}
                    {getNoticeBranchLabel(previewRecord)}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="text-sm whitespace-pre-line">
                {previewRecord.body}
              </div>
            </article>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
              <PreviewField
                label="Publish"
                value={
                  previewRecord.publishedAt
                    ? formatNoticeTimestamp(previewRecord.publishedAt)
                    : "Draft (no publish time)"
                }
              />
              <PreviewField
                label="Expires"
                value={
                  previewRecord.expiresAt
                    ? formatNoticeTimestamp(previewRecord.expiresAt)
                    : "No expiry"
                }
              />
              <PreviewField
                label="Audience"
                value={getNoticeAudienceSummary(previewRecord)}
              />
              <PreviewField
                label="Estimated recipients"
                value={describeRecipientCount(
                  estimateNoticeRecipients(previewRecord)
                )}
              />
            </dl>

            <section className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Targeting
              </span>
              <div className="flex flex-col divide-y rounded-lg border">
                {form.targets.map((target) => (
                  <div
                    key={target.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className="shrink-0 rounded-full text-muted-foreground"
                      >
                        {noticeTargetTypeLabels[target.targetType]}
                      </Badge>
                      <span className="truncate text-sm">
                        {getNoticeTargetValueLabel(target)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {describeRecipientCount(
                        countNoticeTargetRecipients(target)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Recipient counts are estimated from sample data and are not
                de-duplicated across targets. {noticeStateLabels[previewState]}{" "}
                is derived from the publish and expiry times.
              </span>
            </div>
          </div>
        ) : (
          <form
            id="notice-form"
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            {errors.length > 0 ? (
              <div
                role="alert"
                className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {errors.map((error) => (
                  <span key={error}>{error}</span>
                ))}
              </div>
            ) : null}

            <section className="flex flex-col gap-3">
              <FormSectionHeading
                icon={<MegaphoneIcon />}
                title="1. Content"
              />
              <Field label="Title" htmlFor="notice-title" required>
                <Input
                  id="notice-title"
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="e.g. December 2026 term fees due"
                />
              </Field>
              <Field
                label="Body"
                htmlFor="notice-body"
                required
                hint="Plain text. Line breaks are preserved in the preview."
              >
                <Textarea
                  id="notice-body"
                  value={form.body}
                  onChange={(event) => update("body", event.target.value)}
                  rows={6}
                  placeholder="Write the notice as recipients should read it."
                />
              </Field>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
                Author{" "}
                <span className="font-medium text-foreground">
                  {authorRecord.fullName} · {authorRecord.role}
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <FormSectionHeading
                icon={<CalendarClockIcon />}
                title="2. Publishing"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Branch"
                  htmlFor="notice-branch"
                  hint="Leave on all branches for a global notice."
                >
                  <Select
                    items={[
                      { value: "all", label: "All branches" },
                      ...noticeBranchFormOptions,
                    ]}
                    value={form.branchId}
                    onValueChange={(value) =>
                      update("branchId", value ?? "all")
                    }
                  >
                    <SelectTrigger id="notice-branch" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All branches</SelectItem>
                      {noticeBranchFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Publish at"
                  htmlFor="notice-publish-at"
                  hint="Blank keeps this notice as a draft."
                >
                  <Input
                    id="notice-publish-at"
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(event) =>
                      update("publishAt", event.target.value)
                    }
                  />
                </Field>

                <Field
                  label="Expires at"
                  htmlFor="notice-expires-at"
                  hint="Optional. Must be after the publish time."
                >
                  <Input
                    id="notice-expires-at"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(event) =>
                      update("expiresAt", event.target.value)
                    }
                  />
                </Field>

                <div className="flex flex-col gap-1.5">
                  <Label>Derived state</Label>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 text-sm">
                    <NoticeStatusBadge state={previewState} />
                    <span className="truncate text-xs text-muted-foreground">
                      {noticeStateDescriptions[previewState]}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <FormSectionHeading
                icon={<TargetIcon />}
                title="3. Audience targets"
                aside={
                  <span className="text-xs text-muted-foreground">
                    {form.targets.length}{" "}
                    {form.targets.length === 1 ? "target" : "targets"}
                  </span>
                }
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                <Select
                  items={noticeTargetTypeOptions}
                  value={targetType}
                  onValueChange={(value) =>
                    changeTargetType(
                      (value ?? "all") as NoticeTargetType
                    )
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Target type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {noticeTargetTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {targetType === "all" ? (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                    Every active student and guardian
                  </div>
                ) : (
                  <Select
                    items={refOptions}
                    value={targetRef}
                    onValueChange={(value) => setTargetRef(value ?? "")}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="Target reference"
                    >
                      <SelectValue placeholder="Select a target" />
                    </SelectTrigger>
                    <SelectContent>
                      {refOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addTarget}
                  disabled={targetType !== "all" && !targetRef}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add
                </Button>
              </div>

              {form.targets.length > 0 ? (
                <div className="flex flex-col divide-y rounded-lg border">
                  {form.targets.map((target) => (
                    <div
                      key={target.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full text-muted-foreground"
                        >
                          {noticeTargetTypeLabels[target.targetType]}
                        </Badge>
                        <span className="truncate text-sm">
                          {getNoticeTargetValueLabel(target)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeTarget(target.id)}
                        aria-label={`Remove ${getNoticeTargetLabel(target)} target`}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  <TargetIcon className="size-4 shrink-0" aria-hidden="true" />
                  Add at least one target before previewing.
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Choosing <span className="font-medium">Everyone</span> replaces
                specific targets. Specific targets can be combined, and the
                preview sums their estimated recipients without de-duplicating
                people who match more than one.
              </p>
            </section>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <CircleAlertIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                This editor only previews scheduling and targeting. No notice is
                published, no notification is sent, and nothing persists.
              </span>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2">
          {preview ? (
            <>
              <Button variant="outline" onClick={() => setPreview(false)}>
                Back to editor
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onSaved(
                    notice
                      ? `Edit preview for “${previewRecord.title}” closed. The notice was not changed or sent.`
                      : `Preview for “${previewRecord.title}” closed. The notice was not saved or sent.`
                  )
                }}
              >
                <EyeIcon data-icon="inline-start" />
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="notice-form">
                Preview notice (demo)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        <span>
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function FormSectionHeading({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}
