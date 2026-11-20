"use client"

import { useState } from "react"

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
import { Separator } from "@workspace/ui/components/separator"
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCheckIcon,
  InfoIcon,
  MegaphoneIcon,
  SearchXIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import { NoticeAudienceBadge } from "@/components/portal-status-badge"
import {
  initialReadLecturerNoticeIds,
  LECTURER_NOTICE_AUDIENCE_LABELS,
  lecturer,
  lecturerNoticeAudienceFilterOptions,
  lecturerNotices,
  type LecturerNotice,
  type LecturerNoticeAudience,
} from "@/lib/lecturer-portal-data"
import {
  formatDateTime,
  formatDisplayDate,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

type AudienceFilter = LecturerNoticeAudience | "any"

export function LecturerNotices() {
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("any")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [readNoticeIds, setReadNoticeIds] = useState(
    () => new Set<string>(initialReadLecturerNoticeIds)
  )
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null)

  const unreadCount = lecturerNotices.filter(
    (notice) => !readNoticeIds.has(notice.id)
  ).length

  const visibleNotices = lecturerNotices.filter((notice) => {
    if (audienceFilter !== "any" && notice.audienceType !== audienceFilter) {
      return false
    }

    if (unreadOnly && readNoticeIds.has(notice.id)) {
      return false
    }

    return true
  })

  const selectedNotice =
    lecturerNotices.find((notice) => notice.id === selectedNoticeId) ?? null

  function openNotice(noticeId: string) {
    setSelectedNoticeId(noticeId)
    setReadNoticeIds((current) => {
      const next = new Set(current)
      next.add(noticeId)
      return next
    })
  }

  function markAllRead() {
    setReadNoticeIds(
      (current) => new Set([...current, ...lecturerNotices.map((n) => n.id)])
    )
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Notices"
          description="Announcements shared with you, the Colombo branch and your courses. Sample notices only — read and unread state is local to this preview."
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
                <CalendarDaysIcon aria-hidden="true" />
                {formatDisplayDate(MOCK_TODAY)}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
                Mark all as read
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <UserRoundIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            {lecturer.fullName}
          </span>
          <span className="text-muted-foreground">
            Lecturer no. {lecturer.lecturerNo}
          </span>
          <span className="text-muted-foreground">
            {lecturer.designation} · {lecturer.branch} branch
          </span>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <MegaphoneIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Notice board
            </CardTitle>
            <CardDescription>
              {unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? "notice" : "notices"} for you.`
                : "You are up to date with every notice."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Filter notices</span>
              <span className="text-xs text-muted-foreground">
                Notices reach you through the branch office or one of your
                courses.
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                items={lecturerNoticeAudienceFilterOptions}
                value={audienceFilter}
                onValueChange={(value) =>
                  setAudienceFilter((value ?? "any") as AudienceFilter)
                }
              >
                <SelectTrigger
                  className="w-full sm:w-52"
                  aria-label="Filter notices by audience"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lecturerNoticeAudienceFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={unreadOnly ? "default" : "outline"}
                size="sm"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly((current) => !current)}
              >
                Unread only
              </Button>
            </div>
          </CardContent>
        </Card>

        {visibleNotices.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<SearchXIcon className="size-5" aria-hidden="true" />}
              title="No notices match this view"
              description="Try another audience, or turn off the unread-only filter. Contact the Academic Office if you expected an announcement here."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleNotices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                isUnread={!readNoticeIds.has(notice.id)}
                onOpen={() => openNotice(notice.id)}
              />
            ))}
          </div>
        )}

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <ShieldCheckIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This page is limited to notices targeted to {lecturer.fullName},
              the {lecturer.branch} branch and your own courses. Lecturer notice
              authoring permission is not defined, so notices are read-only here
              — no announcement is composed, sent or published. The notice
              record has no read field, so unread state is only local
              presentation and nothing is stored.
            </p>
          </CardContent>
        </Card>
      </div>

      <NoticeDetailDialog
        notice={selectedNotice}
        onOpenChange={(open) => {
          if (!open) setSelectedNoticeId(null)
        }}
      />
    </main>
  )
}

function NoticeCard({
  notice,
  isUnread,
  onOpen,
}: {
  notice: LecturerNotice
  isUnread: boolean
  onOpen: () => void
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-start gap-2 text-base">
              {isUnread ? (
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  aria-label="Unread notice"
                />
              ) : null}
              <span className="min-w-0">{notice.title}</span>
            </CardTitle>
            <CardDescription>
              {notice.author} · published{" "}
              {formatDisplayDate(notice.publishedAt)}
            </CardDescription>
          </div>
          <NoticeAudienceBadge
            audienceType={notice.audienceType}
            label={LECTURER_NOTICE_AUDIENCE_LABELS[notice.audienceType]}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{notice.excerpt}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MegaphoneIcon className="size-3.5" aria-hidden="true" />
            {notice.audienceLabel}
          </span>
          {notice.courseName ? (
            <span className="inline-flex items-center gap-1.5">
              <BookOpenIcon className="size-3.5" aria-hidden="true" />
              {notice.courseName}
            </span>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
        <span className="text-xs text-muted-foreground">
          {isUnread ? "Unread — open to mark as read" : "Read"}
        </span>
        <Button variant="outline" size="xs" onClick={onOpen}>
          Read notice
        </Button>
      </CardFooter>
    </Card>
  )
}

function NoticeDetailDialog({
  notice,
  onOpenChange,
}: {
  notice: LecturerNotice | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={notice !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {notice ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <NoticeAudienceBadge
                  audienceType={notice.audienceType}
                  label={LECTURER_NOTICE_AUDIENCE_LABELS[notice.audienceType]}
                />
              </div>
              <DialogTitle className="text-lg">{notice.title}</DialogTitle>
              <DialogDescription>
                {notice.author} · published {formatDateTime(notice.publishedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {lecturer.fullName}
              </span>
              <span>Lecturer no. {lecturer.lecturerNo}</span>
              <span>{lecturer.branch} branch</span>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Audience" value={notice.audienceLabel} />
              {notice.courseName ? (
                <DetailField label="Course" value={notice.courseName} />
              ) : null}
              <DetailField
                label="Published"
                value={formatDisplayDate(notice.publishedAt)}
              />
            </dl>

            <Separator />

            <p className="text-sm leading-relaxed whitespace-pre-line">
              {notice.body}
            </p>

            <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Notices are read-only for lecturers in this demo. Authoring,
              sending and publishing are unavailable, and replying belongs in
              Messages as a local preview.
            </p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
