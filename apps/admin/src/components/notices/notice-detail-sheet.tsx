"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  CalendarClockIcon,
  InfoIcon,
  MegaphoneIcon,
  PencilIcon,
  TargetIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react"

import { NoticeStatusBadge } from "@/components/notices/notice-status-badge"
import {
  countNoticeTargetRecipients,
  describeRecipientCount,
  estimateNoticeRecipients,
  formatNoticeTimestamp,
  getNoticeAudienceLabels,
  getNoticeAuthor,
  getNoticeBranchLabel,
  getNoticeState,
  getNoticeTargetValueLabel,
  noticeStateLabels,
  noticeTargetTypeLabels,
  type NoticeRecord,
} from "@/lib/notices-data"
import { formatDisplayDate } from "@/lib/students-data"

type NoticeDetailSheetProps = {
  notice: NoticeRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (notice: NoticeRecord) => void
}

export function NoticeDetailSheet({
  notice,
  open,
  onOpenChange,
  onEdit,
}: NoticeDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        {notice ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {notice.title}
                <NoticeStatusBadge state={getNoticeState(notice)} />
              </SheetTitle>
              <SheetDescription>
                {getNoticeAuthor(notice).fullName} ·{" "}
                {getNoticeBranchLabel(notice)} · created{" "}
                {formatDisplayDate(notice.createdAt.slice(0, 10))}
              </SheetDescription>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {getNoticeAudienceLabels(notice).map((label, index) => (
                  <Badge
                    key={`${label}-${index}`}
                    variant="outline"
                    className="rounded-full"
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <StateBanner notice={notice} />

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<MegaphoneIcon />}
                  title="Recipient preview"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      Body shown to the audience
                    </span>
                  }
                />
                <article className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MegaphoneIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <h2 className="text-base font-semibold">{notice.title}</h2>
                      <span className="text-xs text-muted-foreground">
                        {getNoticeAuthor(notice).fullName} ·{" "}
                        {getNoticeBranchLabel(notice)}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-sm whitespace-pre-line text-foreground">
                    {notice.body}
                  </div>
                </article>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CalendarClockIcon />}
                  title="Publishing window"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField
                    label="Publish"
                    value={
                      notice.publishedAt
                        ? formatNoticeTimestamp(notice.publishedAt)
                        : "Not published (draft)"
                    }
                  />
                  <ProfileField
                    label="Expires"
                    value={
                      notice.expiresAt
                        ? formatNoticeTimestamp(notice.expiresAt)
                        : "No expiry"
                    }
                  />
                  <ProfileField
                    label="Branch"
                    value={getNoticeBranchLabel(notice)}
                  />
                  <ProfileField
                    label="Author"
                    value={`${getNoticeAuthor(notice).fullName} · ${getNoticeAuthor(notice).role}`}
                  />
                  <ProfileField
                    label="Created"
                    value={formatNoticeTimestamp(notice.createdAt)}
                  />
                  <ProfileField
                    label="Display state"
                    value={noticeStateLabels[getNoticeState(notice)]}
                  />
                </dl>
                <p className="text-xs text-muted-foreground">
                  Draft, scheduled, published and expired are derived for
                  display from the publish and expiry timestamps.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<TargetIcon />}
                  title="Recipient targeting"
                  aside={
                    <span className="text-xs text-muted-foreground">
                      {describeRecipientCount(
                        estimateNoticeRecipients(notice)
                      )}
                    </span>
                  }
                />
                {notice.targets.length > 0 ? (
                  <div className="flex flex-col divide-y rounded-lg border">
                    {notice.targets.map((target) => (
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
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
                    <UsersRoundIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">
                      No audience targets
                    </span>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Add at least one target before this notice can be
                      published.
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Recipient counts are estimated from local sample data and
                    are not de-duplicated across targets. This demo does not
                    publish or send the notice.
                  </span>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserRoundIcon className="size-3.5" aria-hidden="true" />
                Sample notice · no send action
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    onEdit(notice)
                  }}
                >
                  <PencilIcon data-icon="inline-start" />
                  Edit notice (preview)
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function StateBanner({ notice }: { notice: NoticeRecord }) {
  const state = getNoticeState(notice)

  if (state === "draft") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
        <InfoIcon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          Draft — only visible in this admin preview. Setting a publish time
          schedules it; it is never sent from this demo.
        </span>
      </div>
    )
  }

  if (state === "scheduled") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-sky-600/20 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-800 dark:text-sky-300">
        <CalendarClockIcon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          Scheduled for{" "}
          {notice.publishedAt
            ? formatNoticeTimestamp(notice.publishedAt)
            : "a future date"}
          . It is not visible to recipients yet.
        </span>
      </div>
    )
  }

  if (state === "expired") {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        <InfoIcon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          Expired
          {notice.expiresAt
            ? ` on ${formatNoticeTimestamp(notice.expiresAt)}`
            : ""}
          . Recipients no longer see this notice.
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
      <MegaphoneIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Published
        {notice.publishedAt
          ? ` on ${formatNoticeTimestamp(notice.publishedAt)}`
          : ""}
        . Visible to the audience below until its expiry date.
      </span>
    </div>
  )
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

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}
