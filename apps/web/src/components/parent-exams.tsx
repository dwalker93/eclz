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
import { cn } from "@workspace/ui/lib/utils"
import {
  AlertTriangleIcon,
  AwardIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ClockIcon,
  FileCheck2Icon,
  InfoIcon,
  ListChecksIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { useParentChild } from "@/components/parent-child-context"
import { PortalPageHeader } from "@/components/portal-page-header"
import {
  ExamModeBadge,
  ExamResultStateBadge,
} from "@/components/portal-status-badge"
import {
  type ParentChild,
  type ParentChildAssessment,
} from "@/lib/parent-portal-data"
import {
  formatDisplayDate,
  formatTime,
  formatTimeRange,
  MOCK_TODAY,
  portalModules,
} from "@/lib/student-portal-data"

type AssessmentPhase = "upcoming" | "awaiting" | "provisional" | "released"

const phaseLabels: Record<AssessmentPhase, string> = {
  upcoming: "Upcoming",
  awaiting: "Awaiting results",
  provisional: "Provisional",
  released: "Released",
}

const phaseGroups: Array<{
  phase: AssessmentPhase
  title: string
  description: string
}> = [
  {
    phase: "upcoming",
    title: "Upcoming assessments",
    description: "Scheduled papers and online exam windows.",
  },
  {
    phase: "awaiting",
    title: "Awaiting results",
    description: "Sittings where the institute has not released marks yet.",
  },
  {
    phase: "provisional",
    title: "Provisional results",
    description: "Marks that may still change after moderation.",
  },
  {
    phase: "released",
    title: "Released results",
    description: "Final marks and remarks released by the institute.",
  },
]

/**
 * A provisional result is visible but still subject to moderation. Everything
 * else with a pending result is either upcoming or already sat and awaiting
 * release, decided by the mock clock rather than the browser clock.
 */
function getAssessmentPhase(
  assessment: ParentChildAssessment
): AssessmentPhase {
  if (assessment.result.state === "released") return "released"
  if (assessment.result.state === "provisional") return "provisional"

  const closesOn = assessment.endDate ?? assessment.date
  return closesOn >= MOCK_TODAY ? "upcoming" : "awaiting"
}

function sortAssessments(
  assessments: ParentChildAssessment[],
  phase: AssessmentPhase
) {
  return [...assessments].sort((first, second) => {
    const firstDate = first.result.releasedOn ?? first.date
    const secondDate = second.result.releasedOn ?? second.date

    return phase === "upcoming"
      ? firstDate.localeCompare(secondDate)
      : secondDate.localeCompare(firstDate)
  })
}

function getScheduleLabel(assessment: ParentChildAssessment) {
  if (assessment.mode === "paper") {
    return `${formatDisplayDate(assessment.date)} · ${formatTimeRange(
      assessment.startsAt,
      assessment.endsAt
    )}`
  }

  return `${formatDisplayDate(assessment.date)}, ${formatTime(
    assessment.startsAt
  )} – ${formatDisplayDate(
    assessment.endDate ?? assessment.date
  )}, ${formatTime(assessment.endsAt)}`
}

export function ParentExams() {
  const { children: linkedChildren, selectedChild } = useParentChild()
  const [phaseFilter, setPhaseFilter] = useState<"all" | AssessmentPhase>("all")

  const assessments = selectedChild?.assessments ?? []
  const onlineExamsEnabled = portalModules.onlineExams

  // The header selector changes the child without remounting this page, so a
  // phase filter must not carry over to a sibling's assessments.
  useEffect(() => {
    setPhaseFilter("all")
  }, [selectedChild?.id])

  const phaseCounts = assessments.reduce<Record<AssessmentPhase, number>>(
    (counts, assessment) => {
      counts[getAssessmentPhase(assessment)] += 1
      return counts
    },
    { upcoming: 0, awaiting: 0, provisional: 0, released: 0 }
  )

  const visibleGroups = phaseGroups
    .filter((group) => phaseFilter === "all" || phaseFilter === group.phase)
    .map((group) => ({
      ...group,
      items: sortAssessments(
        assessments.filter(
          (assessment) => getAssessmentPhase(assessment) === group.phase
        ),
        group.phase
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title="Exams & Results"
          description="Exam schedule and released results for the child selected in the header. Marks and grades appear only when the institute makes them visible. This parent view is read-only."
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

        {linkedChildren.length === 0 ? (
          <Card className="gap-0 py-0">
            <EmptyState
              icon={<UsersRoundIcon className="size-5" aria-hidden="true" />}
              title="No linked children"
              description="No student is linked to this guardian record, so there are no exams or results to show. Contact the branch office if a child is missing from your account."
            />
          </Card>
        ) : (
          <>
            {selectedChild ? (
              assessments.length === 0 ? (
                <Card className="gap-0 py-0">
                  <EmptyState
                    icon={<AwardIcon className="size-5" aria-hidden="true" />}
                    title="No assessments recorded"
                    description={`No exam or result is recorded for ${selectedChild.preferredName}. Contact the branch office if you expected an assessment to appear here.`}
                  />
                </Card>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <h2
                        aria-live="polite"
                        className="text-lg font-semibold tracking-tight"
                      >
                        Exams and results for {selectedChild.fullName}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedChild.studentNo} · {selectedChild.grade} ·{" "}
                        {selectedChild.branch} branch
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1.5 rounded-full">
                      <ShieldCheckIcon aria-hidden="true" />
                      Read-only
                    </Badge>
                  </div>

                  <Card className="gap-0 py-0">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-0.5">
                        <CardTitle className="flex items-center gap-2">
                          <AwardIcon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          Assessment overview
                        </CardTitle>
                        <CardDescription>
                          {selectedChild.preferredName}&apos;s scheduled exams
                          and results in one place.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {assessments.length}{" "}
                        {assessments.length === 1
                          ? "assessment"
                          : "assessments"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <SummaryTile
                          icon={CalendarClockIcon}
                          label="Upcoming"
                          value={phaseCounts.upcoming}
                          tone="sky"
                        />
                        <SummaryTile
                          icon={ClockIcon}
                          label="Awaiting results"
                          value={phaseCounts.awaiting}
                          tone="amber"
                        />
                        <SummaryTile
                          icon={AlertTriangleIcon}
                          label="Provisional"
                          value={phaseCounts.provisional}
                          tone="amber"
                        />
                        <SummaryTile
                          icon={AwardIcon}
                          label="Released"
                          value={phaseCounts.released}
                          tone="emerald"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                      Counts follow the current release state. Provisional marks
                      are visible but may change after moderation; pending marks
                      stay hidden until release.
                    </CardFooter>
                  </Card>

                  <Card className="gap-0 py-0">
                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                      <CardTitle className="flex items-center gap-2">
                        <ListChecksIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Filter assessments
                      </CardTitle>
                      <CardDescription>
                        Show every assessment or one release state at a time.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 p-4 sm:p-6">
                      <Button
                        size="sm"
                        variant={
                          phaseFilter === "all" ? "secondary" : "outline"
                        }
                        aria-pressed={phaseFilter === "all"}
                        onClick={() => setPhaseFilter("all")}
                      >
                        All
                        <Badge variant="outline" className="rounded-full">
                          {assessments.length}
                        </Badge>
                      </Button>
                      {phaseGroups.map((group) => (
                        <Button
                          key={group.phase}
                          size="sm"
                          variant={
                            phaseFilter === group.phase
                              ? "secondary"
                              : "outline"
                          }
                          aria-pressed={phaseFilter === group.phase}
                          disabled={phaseCounts[group.phase] === 0}
                          onClick={() => setPhaseFilter(group.phase)}
                        >
                          {phaseLabels[group.phase]}
                          <Badge variant="outline" className="rounded-full">
                            {phaseCounts[group.phase]}
                          </Badge>
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  {visibleGroups.map((group) => (
                    <section
                      key={group.phase}
                      aria-labelledby={`parent-exams-${group.phase}`}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <h3
                            id={`parent-exams-${group.phase}`}
                            className="text-lg font-semibold tracking-tight"
                          >
                            {group.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {group.items.length}{" "}
                          {group.items.length === 1
                            ? "assessment"
                            : "assessments"}
                        </Badge>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {group.items.map((assessment) => (
                          <AssessmentCard
                            key={assessment.id}
                            assessment={assessment}
                            child={selectedChild}
                            onlineExamsEnabled={onlineExamsEnabled}
                          />
                        ))}
                      </div>
                    </section>
                  ))}

                  <Card className="gap-0 py-0">
                    <CardContent className="flex items-start gap-3 p-4 sm:p-6">
                      <InfoIcon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        These assessments belong only to{" "}
                        {selectedChild.fullName}. Parents cannot start, answer,
                        submit or attempt an exam, and correct answers are never
                        shown. Sibling exams and results are never combined on
                        this page. All records use local sample data.
                      </p>
                    </CardContent>
                  </Card>
                </>
              )
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

function AssessmentCard({
  assessment,
  child,
  onlineExamsEnabled,
}: {
  assessment: ParentChildAssessment
  child: ParentChild
  onlineExamsEnabled: boolean
}) {
  const phase = getAssessmentPhase(assessment)
  const { result } = assessment
  const isOnline = assessment.mode === "online_mcq"
  const showsMarks =
    result.state === "released" || result.state === "provisional"
  const onlineUnavailable = isOnline && !onlineExamsEnabled && !showsMarks
  const isProvisional = result.state === "provisional"

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ExamModeBadge mode={assessment.mode} />
          <ExamResultStateBadge state={result.state} />
          <Badge variant="outline" className="rounded-full">
            {phaseLabels[phase]}
          </Badge>
        </div>
        <CardTitle className="mt-1 text-base leading-snug">
          {assessment.title}
        </CardTitle>
        <CardDescription className="text-xs">
          {assessment.courseName} · {assessment.subject}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid gap-2.5">
          <AssessmentFact
            icon={CalendarDaysIcon}
            label={isOnline ? "Online window" : "Exam date"}
            value={getScheduleLabel(assessment)}
          />
          <AssessmentFact
            icon={ClockIcon}
            label="Duration"
            value={`${assessment.durationMinutes} minutes`}
          />
          {isOnline ? (
            <AssessmentFact
              icon={ListChecksIcon}
              label="Format"
              value="Online multiple-choice · parent view only"
            />
          ) : (
            <AssessmentFact
              icon={MapPinIcon}
              label="Venue"
              value={assessment.venue ?? "Venue to be confirmed"}
            />
          )}
          <AssessmentFact
            icon={AwardIcon}
            label="Total marks"
            value={`${assessment.maxMarks} marks`}
          />
          <AssessmentFact
            icon={ShieldCheckIcon}
            label="Results visibility"
            value={assessment.resultsVisibility}
          />
          {result.releasedOn ? (
            <AssessmentFact
              icon={FileCheck2Icon}
              label={isProvisional ? "Provisional on" : "Released on"}
              value={formatDisplayDate(result.releasedOn)}
            />
          ) : null}
        </dl>

        {showsMarks ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Marks
                </p>
                <p className="text-2xl leading-none font-semibold tabular-nums">
                  {result.marks ?? "—"}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {result.maxMarks}
                  </span>
                </p>
              </div>
              <div className="flex flex-col gap-0.5 text-right">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Grade
                </p>
                <p className="text-2xl leading-none font-semibold">
                  {result.grade ?? "—"}
                </p>
              </div>
            </div>

            {result.remarks ? (
              <div className="mt-3 border-t pt-2.5">
                <p className="text-[11px] text-muted-foreground">Remarks</p>
                <p className="mt-0.5 text-sm leading-relaxed">
                  {result.remarks}
                </p>
              </div>
            ) : null}

            {isProvisional ? (
              <p className="mt-2.5 rounded-md border border-amber-600/20 bg-amber-500/5 p-2 text-xs text-amber-700 dark:border-amber-400/20 dark:text-amber-400">
                Provisional — marks and grade may change after moderation.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {phase === "upcoming"
              ? "Marks and grade appear here after the exam is completed and the institute releases the result."
              : "This sitting has taken place, but the result has not been released. Marks stay hidden until release."}{" "}
            Visibility: {assessment.resultsVisibility.toLowerCase()}.
          </p>
        )}

        {onlineUnavailable ? (
          <p className="rounded-lg border border-amber-600/20 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-muted-foreground">
            Online exams are currently disabled for this institute. Paper exams
            and released results remain available.
          </p>
        ) : assessment.note ? (
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {assessment.note}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
          Read-only parent view for {child.preferredName}
        </span>
      </CardFooter>
    </Card>
  )
}

function AssessmentFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-[11px] leading-tight text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm wrap-break-word">{value}</dd>
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
  tone: "emerald" | "amber" | "sky"
}) {
  const toneClasses = {
    emerald:
      "border-emerald-600/15 bg-emerald-500/5 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
    amber:
      "border-amber-600/15 bg-amber-500/5 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
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
