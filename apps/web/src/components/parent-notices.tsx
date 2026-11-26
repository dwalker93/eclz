"use client"

import { useEffect, useState } from "react"

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
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import {
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  FilterIcon,
  InfoIcon,
  MegaphoneIcon,
  RotateCcwIcon,
  SearchXIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  NoticeExpiredBadge,
  ParentNoticeAudienceBadge,
} from "@/components/portal-status-badge"
import {
  isParentNoticeExpired,
  parentNotices,
  type ParentChild,
  type ParentNotice,
} from "@/lib/parent-portal-data"
import {
  formatDateTime,
  formatDisplayDate,
  MOCK_TODAY,
} from "@/lib/student-portal-data"

/**
 * The children a notice concerns, restricted to this guardian's linked children.
 * A notice never references a student outside the guardian record.
 */
function relevantChildren(notice: ParentNotice, children: ParentChild[]) {
  return children.filter((child) => notice.childIds.includes(child.id))
}

/**
 * Short, human label for why the notice reached this guardian. Guardian-wide and
 * branch notices apply to every linked child; grade, course and child notices
 * name the children they concern.
 */
function relevanceLabel(notice: ParentNotice, children: ParentChild[]) {
  if (
    notice.audienceType === "all" ||
    notice.audienceType === "guardian" ||
    notice.audienceType === "branch"
  ) {
    return children.length > 1 ? "All your children" : "Your child"
  }

  const names = relevantChildren(notice, children).map(
    (child) => child.preferredName
  )

  return names.length > 0 ? names.join(" & ") : "Your family"
}

export function ParentNotices() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null)

  // The header selector changes the child without remounting this page, so the
  // date filters and any open detail must reset when the child changes.
  useEffect(() => {
    setFromDate("")
    setToDate("")
    setSelectedNoticeId(null)
  }, [selectedChild?.id])

  // The header child selector scopes this page, so only notices that concern the
  // selected child are shown. Guardian-wide, branch and "everyone" notices
  // concern every linked child and appear for whichever child is selected.
  const childNotices = selectedChild
    ? parentNotices.filter((notice) =>
        notice.childIds.includes(selectedChild.id)
      )
    : []

  const hasFilters = fromDate !== "" || toDate !== ""
  const invalidDateRange = fromDate !== "" && toDate !== "" && fromDate > toDate

  const visibleNotices = childNotices
    .filter((notice) => {
      const publishedDate = notice.publishedAt.slice(0, 10)

      if (fromDate !== "" && publishedDate < fromDate) {
        return false
      }

      if (toDate !== "" && publishedDate > toDate) {
        return false
      }

      return true
    })
    .sort((first, second) =>
      second.publishedAt.localeCompare(first.publishedAt)
    )

  const selectedNotice =
    childNotices.find((notice) => notice.id === selectedNoticeId) ?? null

  function clearFilters() {
    setFromDate("")
    setToDate("")
  }

  const filterSummary =
    fromDate !== "" || toDate !== ""
      ? `${fromDate !== "" ? formatDisplayDate(fromDate) : "start"} – ${
          toDate !== "" ? formatDisplayDate(toDate) : "today"
        }`
      : "all dates"

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Notices"
          description="Announcements for the child selected in the header: guardian-wide, branch, grade, course and child notices that make them relevant. Filter by publish date — detail is read-only."
          meta={
            <>
              <Badge variant="secondary" className="rounded-full">
                Parent portal
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {linkedChildren.length} linked{" "}
                {linkedChildren.length === 1 ? "child" : "children"}
              </Badge>
              {selectedChild ? (
                <Badge variant="outline" className="rounded-full">
                  Viewing {selectedChild.preferredName}
                </Badge>
              ) : null}
            </>
          }
          actions={
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        {!selectedChild ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no notices to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <UserRoundIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {selectedChild?.fullName}
              </span>
              <span className="text-muted-foreground">
                Student no. {selectedChild?.studentNo}
              </span>
              <span className="text-muted-foreground">
                {selectedChild?.grade} · {selectedChild?.branch} branch
              </span>
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full sm:ml-auto"
              >
                <ShieldCheckIcon aria-hidden="true" />
                Read-only
              </Badge>
            </div>

            <Card className="gap-0 py-0">
              <CardHeader className="border-b px-4 py-4 sm:px-6">
                <CardTitle className="flex items-center gap-2">
                  <FilterIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Filter by date
                </CardTitle>
                <CardDescription>
                  Narrow {selectedChild.preferredName}&apos;s notices by the
                  date they were published. The header selector changes which
                  child this page shows.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="parent-notices-from-date"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Published from
                  </label>
                  <Input
                    id="parent-notices-from-date"
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="parent-notices-to-date"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Published to
                  </label>
                  <Input
                    id="parent-notices-to-date"
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  className="w-full lg:w-auto"
                >
                  <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                  Clear
                </Button>
              </CardContent>
              {invalidDateRange ? (
                <CardFooter className="border-t px-4 py-3 text-xs text-destructive sm:px-6">
                  The published-from date must be on or before the published-to
                  date.
                </CardFooter>
              ) : null}
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-6">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <MegaphoneIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Notice board
                  </CardTitle>
                  <CardDescription>
                    {hasFilters
                      ? `Filtered view · ${filterSummary}`
                      : `All notices for ${selectedChild.preferredName} · ${childNotices.length} total`}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {visibleNotices.length} shown
                </Badge>
              </CardHeader>

              {visibleNotices.length === 0 ? (
                <EmptyState
                  icon={<SearchXIcon className="size-5" aria-hidden="true" />}
                  title="No notices match this view"
                  description="Try another date range. Clear the filters to see every notice for the selected child."
                />
              ) : (
                <ul className="flex flex-col gap-4 p-4 sm:p-6">
                  {visibleNotices.map((notice) => (
                    <NoticeCard
                      key={notice.id}
                      notice={notice}
                      children={linkedChildren}
                      onOpen={() => setSelectedNoticeId(notice.id)}
                    />
                  ))}
                </ul>
              )}

              <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                Notices are read-only. Replying is done through Messages, and no
                announcement is published, edited or acknowledged here.
              </CardFooter>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  These notices concern your guardian record and the child
                  selected in the header. The notice record has no read or
                  priority field, so none is shown and nothing is stored. Every
                  notice here either applies to {selectedChild.preferredName} or
                  to all of your linked children.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <NoticeDetailDialog
        notice={selectedNotice}
        children={linkedChildren}
        onOpenChange={(open) => {
          if (!open) setSelectedNoticeId(null)
        }}
      />
    </main>
  )
}

function NoticeCard({
  notice,
  children,
  onOpen,
}: {
  notice: ParentNotice
  children: ParentChild[]
  onOpen: () => void
}) {
  const expired = isParentNoticeExpired(notice)
  const relevance = relevanceLabel(notice, children)

  return (
    <li>
      <Card className={cn("gap-0 py-0", expired && "opacity-75")}>
        <CardHeader className="border-b px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-base">{notice.title}</CardTitle>
              <CardDescription>
                {notice.author} · published{" "}
                {formatDisplayDate(notice.publishedAt)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ParentNoticeAudienceBadge audienceType={notice.audienceType} />
              {expired ? <NoticeExpiredBadge /> : null}
            </div>
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
            <span className="inline-flex items-center gap-1.5">
              <UsersRoundIcon className="size-3.5" aria-hidden="true" />
              Relevant to {relevance}
            </span>
            {notice.expiresAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
                {expired ? "Expired" : "Expires"}{" "}
                {formatDisplayDate(notice.expiresAt)}
              </span>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <Button variant="outline" size="xs" onClick={onOpen}>
            Read notice
          </Button>
        </CardFooter>
      </Card>
    </li>
  )
}

function NoticeDetailDialog({
  notice,
  children,
  onOpenChange,
}: {
  notice: ParentNotice | null
  children: ParentChild[]
  onOpenChange: (open: boolean) => void
}) {
  const expired = notice ? isParentNoticeExpired(notice) : false
  const relevance = notice ? relevanceLabel(notice, children) : ""

  return (
    <Dialog open={notice !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {notice ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <ParentNoticeAudienceBadge audienceType={notice.audienceType} />
                {expired ? <NoticeExpiredBadge /> : null}
              </div>
              <DialogTitle className="text-lg">{notice.title}</DialogTitle>
              <DialogDescription>
                {notice.author} · published {formatDateTime(notice.publishedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <UsersRoundIcon className="size-3.5" aria-hidden="true" />
                Relevant to {relevance}
              </span>
              <span>{notice.audienceLabel}</span>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Audience" value={notice.audienceLabel} />
              <DetailField label="Relevant to" value={relevance} />
              {notice.courseName ? (
                <DetailField label="Course" value={notice.courseName} />
              ) : null}
              <DetailField
                label="Published"
                value={formatDisplayDate(notice.publishedAt)}
              />
              {notice.expiresAt ? (
                <DetailField
                  label={expired ? "Expired on" : "Expires"}
                  value={formatDisplayDate(notice.expiresAt)}
                />
              ) : null}
            </dl>

            <Separator />

            <p className="text-sm leading-relaxed whitespace-pre-line">
              {notice.body}
            </p>

            <p className="rounded-lg border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
              Notices are read-only. Replying is done through Messages, and this
              detail shows only the children linked to your account.
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
