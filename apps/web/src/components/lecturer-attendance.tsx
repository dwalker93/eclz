"use client"

import { useMemo, useState } from "react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
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
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import {
  BanIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleCheckIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  ClockIcon,
  InfoIcon,
  MapPinIcon,
  MonitorIcon,
  QrCodeIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  UserRoundCheckIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ClassSessionStatusBadge,
  DeliveryModeBadge,
} from "@/components/portal-status-badge"
import {
  getLecturerAttendanceRoster,
  getLecturerAttendanceSessions,
  getLecturerCourseAttendance,
  getLecturerCourseById,
  getLecturerCourseClassLabel,
  getLecturerCourseTermLabel,
  lecturer,
  lecturerAttendanceSummary,
  lecturerCourses,
  lecturerModules,
  type LecturerSession,
} from "@/lib/lecturer-portal-data"
import {
  ATTENDANCE_STATUS_LABELS,
  CLASS_SESSION_STATUS_LABELS,
  formatDisplayDate,
  formatShortDate,
  formatTimeRange,
  MOCK_TODAY,
  type AttendanceStatus,
} from "@/lib/student-portal-data"

type AttendanceMark = {
  status: AttendanceStatus | null
  attendedVia: "Physical" | "Online"
  markedVia: "Manual" | "QR" | null
}

type SessionMarks = Record<string, AttendanceMark>

const attendanceStatusOptions: Array<{
  value: "unmarked" | AttendanceStatus
  label: string
}> = [
  { value: "unmarked", label: "Not marked" },
  { value: "present", label: ATTENDANCE_STATUS_LABELS.present },
  { value: "late", label: ATTENDANCE_STATUS_LABELS.late },
  { value: "absent", label: ATTENDANCE_STATUS_LABELS.absent },
  { value: "excused", label: ATTENDANCE_STATUS_LABELS.excused },
]

function createInitialMarks(session: LecturerSession): SessionMarks {
  const roster = getLecturerAttendanceRoster(session.courseId)

  return Object.fromEntries(
    roster.map((student) => {
      const mark: AttendanceMark =
        session.status === "held"
          ? {
              status: student.lastStatus,
              attendedVia: student.lastAttendedVia,
              markedVia: student.lastMarkedVia,
            }
          : {
              status: null,
              attendedVia:
                session.deliveryMode === "Online"
                  ? "Online"
                  : student.lastAttendedVia,
              markedVia: null,
            }

      return [student.id, mark]
    })
  ) as SessionMarks
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function getTermRateClasses(rate: number) {
  if (rate < 70) {
    return "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30"
  }

  if (rate < lecturerAttendanceSummary.targetRate) {
    return "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
  }

  return "border-border bg-muted/60 text-muted-foreground"
}

export function LecturerAttendance() {
  const activeCourses = lecturerCourses.filter(
    (course) => course.status === "active"
  )
  const initialCourse = activeCourses[0]

  const [selectedCourseId, setSelectedCourseId] = useState(
    initialCourse?.id ?? ""
  )
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    if (!initialCourse) return ""
    return getLecturerAttendanceSessions(initialCourse.id)[0]?.id ?? ""
  })
  const [marksBySession, setMarksBySession] = useState<
    Record<string, SessionMarks>
  >({})
  const [qrEnabled, setQrEnabled] = useState<boolean>(
    lecturerModules.qrAttendance
  )

  const courseOptions = activeCourses.map((course) => ({
    value: course.id,
    label: `${course.name} · ${course.branch}`,
  }))

  const sessions = getLecturerAttendanceSessions(selectedCourseId)
  const sessionOptions = sessions.map((session) => ({
    value: session.id,
    label: `${formatShortDate(session.date)} · ${formatTimeRange(
      session.startsAt,
      session.endsAt
    )} · ${CLASS_SESSION_STATUS_LABELS[session.status]}`,
  }))
  const selectedCourse = getLecturerCourseById(selectedCourseId)
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0]
  const roster = selectedSession
    ? getLecturerAttendanceRoster(selectedSession.courseId)
    : []
  const courseAttendance = selectedCourseId
    ? getLecturerCourseAttendance(selectedCourseId)
    : null

  const initialMarks = useMemo(
    () => (selectedSession ? createInitialMarks(selectedSession) : {}),
    [selectedSession]
  )
  const marks = selectedSession
    ? (marksBySession[selectedSession.id] ?? initialMarks)
    : {}
  const hasLocalState = selectedSession
    ? Boolean(marksBySession[selectedSession.id])
    : false

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    }

    for (const student of roster) {
      const status = marks[student.id]?.status
      if (!status) continue
      counts[status] += 1
    }

    const marked = Object.values(counts).reduce(
      (total, count) => total + count,
      0
    )

    return {
      ...counts,
      marked,
      unmarked: Math.max(roster.length - marked, 0),
      rate:
        marked === 0
          ? 0
          : Math.round(((counts.present + counts.late) / marked) * 100),
    }
  }, [marks, roster])

  const localChanges = useMemo(() => {
    if (!selectedSession || !marksBySession[selectedSession.id]) return 0

    return roster.reduce((total, student) => {
      const current = marks[student.id]
      const initial = initialMarks[student.id]

      if (!current || !initial) return total

      const changed =
        current.status !== initial.status ||
        current.attendedVia !== initial.attendedVia ||
        current.markedVia !== initial.markedVia

      return changed ? total + 1 : total
    }, 0)
  }, [initialMarks, marks, marksBySession, roster, selectedSession])

  function updateMark(studentId: string, patch: Partial<AttendanceMark>) {
    if (!selectedSession) return

    setMarksBySession((current) => {
      const base = current[selectedSession.id] ?? initialMarks
      const existing = base[studentId] ?? {
        status: null,
        attendedVia: "Physical",
        markedVia: null,
      }

      return {
        ...current,
        [selectedSession.id]: {
          ...base,
          [studentId]: { ...existing, ...patch },
        },
      }
    })
  }

  function applyBulk(status: AttendanceStatus | null) {
    if (!selectedSession) return

    setMarksBySession((current) => {
      const base = current[selectedSession.id] ?? initialMarks
      const next = roster.reduce<SessionMarks>((result, student) => {
        const existing = base[student.id] ?? {
          status: null,
          attendedVia: "Physical",
          markedVia: null,
        }

        result[student.id] = {
          ...existing,
          status,
          markedVia: status === null ? null : "Manual",
        }
        return result
      }, {})

      return { ...current, [selectedSession.id]: next }
    })
  }

  function resetSessionMarks() {
    if (!selectedSession) return

    setMarksBySession((current) => {
      const next = { ...current }
      delete next[selectedSession.id]
      return next
    })
  }

  function handleCourseChange(value: string | null) {
    const courseId = value ?? ""
    setSelectedCourseId(courseId)
    setSelectedSessionId(getLecturerAttendanceSessions(courseId)[0]?.id ?? "")
  }

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Attendance"
          description="Review and mark attendance for students in your own classes. All marks, bulk actions and resets are local demo changes — nothing is saved or sent."
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
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <CalendarDaysIcon aria-hidden="true" />
              {formatDisplayDate(MOCK_TODAY)}
            </Badge>
          }
        />

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Class &amp; session
                </CardTitle>
                <CardDescription>
                  Choose one of your assigned courses and a held or upcoming
                  session.
                </CardDescription>
              </div>
              {courseAttendance ? (
                <Badge variant="outline" className="rounded-full">
                  Course attendance this term {courseAttendance.rate}%
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="lecturer-attendance-course"
                className="text-xs font-medium text-muted-foreground"
              >
                Course
              </label>
              <Select
                items={courseOptions}
                value={selectedCourseId}
                onValueChange={handleCourseChange}
              >
                <SelectTrigger
                  id="lecturer-attendance-course"
                  className="w-full"
                  aria-label="Choose an assigned course"
                >
                  <BookOpenIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="lecturer-attendance-session"
                className="text-xs font-medium text-muted-foreground"
              >
                Session
              </label>
              <Select
                items={sessionOptions}
                value={selectedSession?.id ?? ""}
                onValueChange={(value) => setSelectedSessionId(value ?? "")}
                disabled={sessionOptions.length === 0}
              >
                <SelectTrigger
                  id="lecturer-attendance-session"
                  className="w-full"
                  aria-label="Choose a class session"
                >
                  <CalendarDaysIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sessionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          {selectedCourse && selectedSession ? (
            <CardFooter className="flex flex-col items-start gap-3 border-t px-4 py-4 text-xs text-muted-foreground sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <ClassSessionStatusBadge status={selectedSession.status} />
                <DeliveryModeBadge mode={selectedSession.deliveryMode} />
                <Badge variant="outline" className="rounded-full">
                  {getLecturerCourseClassLabel(selectedCourse)}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {getLecturerCourseTermLabel(selectedCourse)}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">
                {selectedSession.topic}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                  {formatShortDate(selectedSession.date)} ·{" "}
                  {formatTimeRange(
                    selectedSession.startsAt,
                    selectedSession.endsAt
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-3.5" aria-hidden="true" />
                  {selectedSession.branch} · {selectedSession.room}
                </span>
              </div>
            </CardFooter>
          ) : null}
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheckIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Session summary
                </CardTitle>
                <CardDescription>
                  {selectedCourse?.name ?? "No course selected"}
                  {selectedSession
                    ? ` · ${formatDisplayDate(selectedSession.date)}`
                    : ""}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full">
                {summary.marked} of {roster.length} marked
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <Progress value={summary.rate} className="gap-2">
              <ProgressLabel className="text-xs text-muted-foreground">
                Demo session attendance
              </ProgressLabel>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {summary.rate}%
              </span>
            </Progress>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryTile
                icon={CircleCheckIcon}
                label="Present"
                value={summary.present}
                tone="emerald"
              />
              <SummaryTile
                icon={ClockIcon}
                label="Late"
                value={summary.late}
                tone="amber"
              />
              <SummaryTile
                icon={CircleXIcon}
                label="Absent"
                value={summary.absent}
                tone="red"
              />
              <SummaryTile
                icon={ShieldCheckIcon}
                label="Excused"
                value={summary.excused}
                tone="sky"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <span>
                Course target{" "}
                <span className="font-medium text-foreground">
                  {lecturerAttendanceSummary.targetRate}%
                </span>
              </span>
              <span className="text-muted-foreground">
                {summary.unmarked} unmarked in this session
              </span>
            </div>
          </CardContent>
          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            {selectedSession?.status === "scheduled"
              ? "This session has not been marked yet. The roster below lets you preview local marking only."
              : "Sample marks from the latest held session are shown. Changes below are local to this preview."}
          </CardFooter>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Class roster
                </CardTitle>
                <CardDescription>
                  {selectedCourse
                    ? `${selectedCourse.name} · ${getLecturerCourseClassLabel(
                        selectedCourse
                      )} · ${roster.length} enrolled`
                    : "Choose a course to review attendance."}
                </CardDescription>
              </div>
              <Badge
                variant={localChanges > 0 ? "secondary" : "outline"}
                className="rounded-full"
              >
                {localChanges > 0
                  ? `${localChanges} local change${localChanges === 1 ? "" : "s"}`
                  : "No local changes"}
              </Badge>
            </div>
          </CardHeader>

          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
            <span className="text-xs font-medium text-muted-foreground">
              Bulk mark
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => applyBulk("present")}
              disabled={roster.length === 0}
            >
              <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
              Mark all present
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => applyBulk("absent")}
              disabled={roster.length === 0}
            >
              <CircleXIcon data-icon="inline-start" aria-hidden="true" />
              Mark all absent
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => applyBulk(null)}
              disabled={roster.length === 0}
            >
              Clear marks
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={resetSessionMarks}
              disabled={!hasLocalState}
            >
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              Reset demo changes
            </Button>
          </div>

          {roster.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="size-5" aria-hidden="true" />}
              title="No students in this class"
              description="Enrolled students for the selected course will appear here. Contact the Academic Office if the roster looks incomplete."
            />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_80px_160px_120px_100px] items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:px-6 md:grid">
                <span>Student</span>
                <span>Term</span>
                <span>Status</span>
                <span>Mode</span>
                <span>Marked</span>
              </div>
              <ul className="divide-y">
                {roster.map((student) => {
                  const mark = marks[student.id] ?? {
                    status: null,
                    attendedVia:
                      selectedSession?.deliveryMode === "Online"
                        ? "Online"
                        : "Physical",
                    markedVia: null,
                  }

                  return (
                    <li
                      key={student.id}
                      className="grid gap-3 px-4 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_80px_160px_120px_100px] md:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(student.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className="truncate text-sm font-medium">
                            {student.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.studentNo}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:block">
                        <span className="text-xs text-muted-foreground md:hidden">
                          Term
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full tabular-nums",
                            getTermRateClasses(student.termAttendanceRate)
                          )}
                        >
                          {student.termAttendanceRate}%
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-1.5 md:block">
                        <span className="text-xs text-muted-foreground md:hidden">
                          Status
                        </span>
                        <Select
                          items={attendanceStatusOptions}
                          value={mark.status ?? "unmarked"}
                          onValueChange={(value) => {
                            const next = value ?? "unmarked"
                            updateMark(student.id, {
                              status:
                                next === "unmarked"
                                  ? null
                                  : (next as AttendanceStatus),
                              markedVia: next === "unmarked" ? null : "Manual",
                            })
                          }}
                        >
                          <SelectTrigger
                            className="w-full md:w-[150px]"
                            aria-label={`Attendance status for ${student.fullName}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {attendanceStatusOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2 md:block">
                        <span className="text-xs text-muted-foreground md:hidden">
                          Mode
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 rounded-full",
                            mark.attendedVia === "Online"
                              ? "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400"
                              : "border-border bg-muted/60 text-muted-foreground"
                          )}
                        >
                          {mark.attendedVia === "Online" ? (
                            <MonitorIcon aria-hidden="true" />
                          ) : (
                            <MapPinIcon aria-hidden="true" />
                          )}
                          {mark.attendedVia}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 md:block">
                        <span className="text-xs text-muted-foreground md:hidden">
                          Marked
                        </span>
                        {mark.markedVia ? (
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-border bg-muted/60 text-muted-foreground"
                          >
                            {mark.markedVia === "QR" ? (
                              <QrCodeIcon aria-hidden="true" />
                            ) : (
                              <UserRoundCheckIcon aria-hidden="true" />
                            )}
                            {mark.markedVia}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not marked
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
            Only students in {selectedCourse?.name ?? "the selected course"} are
            shown. Local demo changes are not saved, submitted or sent.
          </CardFooter>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="flex items-center gap-2">
                    <QrCodeIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    QR attendance
                  </CardTitle>
                  <CardDescription>
                    Session check-in placeholder
                  </CardDescription>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={qrEnabled}
                    onCheckedChange={(checked) =>
                      setQrEnabled(Boolean(checked))
                    }
                    aria-label="Toggle QR attendance module demo state"
                  />
                  Module demo
                </label>
              </div>
            </CardHeader>
            {qrEnabled ? (
              <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <QrCodeIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">
                      QR check-in placeholder
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No camera, QR token or scanning is connected.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  <QrCodeIcon data-icon="inline-start" aria-hidden="true" />
                  Scan QR code
                </Button>
                <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                  In a live deployment, a session-specific QR could mark
                  attendance. Raw QR tokens are never shown to lecturers in this
                  preview.
                </p>
              </CardContent>
            ) : (
              <CardContent className="p-4 sm:p-6">
                <EmptyState
                  icon={<BanIcon className="size-5" aria-hidden="true" />}
                  title="QR attendance unavailable"
                  description="The QR attendance module is disabled in this demo state. Manual marking can still be previewed below."
                />
              </CardContent>
            )}
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Placeholder only. No scanning, check-in or persistence is
              implemented.
            </CardFooter>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-4 py-4 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <InfoIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Demo boundaries
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-4 text-xs leading-relaxed text-muted-foreground sm:p-6">
              <p>
                Only students enrolled in the selected course are shown. Other
                courses and other lecturers&apos; classes are not included.
              </p>
              <p>
                Status changes, bulk marking and resets stay in this page&apos;s
                local state. Nothing is saved, submitted or sent.
              </p>
              <p>
                Manual and QR markings are sample values. Real scanning,
                attendance persistence and notifications are not implemented.
              </p>
            </CardContent>
            <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
              Local mock UI only.
            </CardFooter>
          </Card>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Attendance is limited to {lecturer.fullName}&apos;s assigned
              courses. The roster, term percentages and session marks are local
              sample data, not live calculations. No attendance record is
              created, updated or sent from this page.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
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
  tone: "emerald" | "amber" | "red" | "sky"
}) {
  const toneClasses = {
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
    red: "border-destructive/15 bg-destructive/5 text-destructive",
    sky: "border-sky-600/15 bg-sky-500/5 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
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
