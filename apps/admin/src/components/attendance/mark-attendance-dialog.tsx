"use client"

import { useEffect, useMemo, useState } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  InfoIcon,
  QrCodeIcon,
  ScanLineIcon,
  UserRoundCheckIcon,
} from "lucide-react"

import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge"
import { formatTimeValue } from "@/lib/courses-data"
import {
  attendanceAttendedViaOptions,
  attendanceStatusOptions,
  QR_ATTENDANCE_MODULE_MOCK,
  summarizeAttendance,
  type AttendanceRosterEntry,
  type AttendanceSessionRecord,
  type AttendanceStatus,
  type AttendedVia,
} from "@/lib/attendance-data"
import { formatDisplayDate } from "@/lib/students-data"

export type AttendanceMarkDraft = {
  status: AttendanceStatus | null
  attendedVia: AttendedVia | null
}

type MarkAttendanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: AttendanceSessionRecord | null
  entries: AttendanceRosterEntry[]
  onApply: (marks: Record<string, AttendanceMarkDraft>) => void
}

function createDraft(
  entries: AttendanceRosterEntry[]
): Record<string, AttendanceMarkDraft> {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.studentId,
      { status: entry.status, attendedVia: entry.attendedVia },
    ])
  )
}

export function MarkAttendanceDialog({
  open,
  onOpenChange,
  session,
  entries,
  onApply,
}: MarkAttendanceDialogProps) {
  const [draft, setDraft] = useState<Record<string, AttendanceMarkDraft>>(() =>
    createDraft(entries)
  )

  useEffect(() => {
    if (open) {
      setDraft(createDraft(entries))
    }
  }, [open, entries])

  const summary = useMemo(
    () => summarizeAttendance(Object.values(draft)),
    [draft]
  )

  function update(studentId: string, patch: Partial<AttendanceMarkDraft>) {
    setDraft((previous) => ({
      ...previous,
      [studentId]: { ...previous[studentId]!, ...patch },
    }))
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDraft((previous) => {
      const existing = previous[studentId]!
      const attendedVia: AttendedVia | null =
        status === "absent" || status === "excused"
          ? null
          : (existing.attendedVia ?? "physical")

      return { ...previous, [studentId]: { status, attendedVia } }
    })
  }

  function markAll(status: AttendanceStatus) {
    setDraft((previous) =>
      Object.fromEntries(
        entries.map((entry) => [
          entry.studentId,
          {
            status,
            attendedVia:
              status === "absent" || status === "excused"
                ? null
                : (previous[entry.studentId]?.attendedVia ?? "physical"),
          },
        ])
      )
    )
  }

  function handleApply() {
    onApply(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCheckIcon className="size-4" aria-hidden="true" />
            Mark attendance
          </DialogTitle>
          <DialogDescription>
            {session
              ? `${session.topic} · ${formatDisplayDate(session.sessionDate)} · ${formatTimeValue(session.startsAt)} – ${formatTimeValue(session.endsAt)}`
              : "Select a session to mark attendance."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Quick set:
            </span>
            {attendanceStatusOptions.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                onClick={() => markAll(option.value)}
              >
                Mark all {option.label.toLowerCase()}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">{summary.present}</span> present
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">{summary.absent}</span> absent
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">{summary.late}</span> late
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">{summary.excused}</span> excused
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">{summary.unmarked}</span> not
              marked
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">
                No enrolled students for this session
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                The roster is built from active and completed enrollments on the
                selected course.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y rounded-lg border">
              {entries.map((entry) => {
                const value = draft[entry.studentId]!
                const viaDisabled =
                  value.status === null ||
                  value.status === "absent" ||
                  value.status === "excused"

                return (
                  <div
                    key={entry.studentId}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {entry.studentName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.studentNo}
                        {entry.gradeName ? ` · ${entry.gradeName}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        items={attendanceStatusOptions}
                        value={value.status}
                        onValueChange={(next) => {
                          if (next) setStatus(entry.studentId, next)
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-36"
                          aria-label={`Attendance status for ${entry.studentName}`}
                        >
                          <SelectValue placeholder="Not marked" />
                        </SelectTrigger>
                        <SelectContent>
                          {attendanceStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        items={attendanceAttendedViaOptions}
                        value={value.attendedVia}
                        onValueChange={(next) =>
                          update(entry.studentId, {
                            attendedVia: (next as AttendedVia | null) ?? null,
                          })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-32"
                          disabled={viaDisabled}
                          aria-label={`Attended via for ${entry.studentName}`}
                        >
                          <SelectValue placeholder="Attended via" />
                        </SelectTrigger>
                        <SelectContent>
                          {attendanceAttendedViaOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              These controls update this page only. No attendance record is
              written, and no parent or student is messaged.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2.5">
            <Badge variant="outline" className="gap-1.5 rounded-full text-xs">
              <QrCodeIcon aria-hidden="true" />
              {QR_ATTENDANCE_MODULE_MOCK.label}
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ScanLineIcon className="size-3.5" aria-hidden="true" />
              QR self check-in is an optional module. This demo marks records as
              manual only and never scans a code.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="mr-auto hidden items-center gap-2 sm:flex">
            <AttendanceStatusBadge status={null} className="text-xs" />
            <span className="text-xs text-muted-foreground">
              Unmarked rows stay blank until you set a status.
            </span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={entries.length === 0}>
            Apply (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
