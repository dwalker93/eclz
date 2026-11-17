import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  CircleDashedIcon,
  ClockIcon,
  FilePenIcon,
  LockIcon,
  PencilIcon,
  RepeatIcon,
  TriangleAlertIcon,
  UploadIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import {
  attemptStatusLabels,
  examStatusLabels,
  releaseStateLabels,
  resultSourceLabels,
  type AttemptStatus,
  type ExamStatus,
  type ReleaseState,
  type ResultSource,
} from "@/lib/results-data"

type StatusConfig = {
  icon: LucideIcon
  className: string
}

const examStatusConfig: Record<ExamStatus, StatusConfig> = {
  draft: {
    icon: FilePenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  published: {
    icon: ClockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  closed: {
    icon: LockIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

const attemptStatusConfig: Record<AttemptStatus, StatusConfig> = {
  in_progress: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  submitted: {
    icon: UploadIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  graded: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  expired: {
    icon: TriangleAlertIcon,
    className:
      "border-red-600/20 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-400",
  },
}

const sourceConfig: Record<ResultSource, StatusConfig> = {
  attempt: {
    icon: RepeatIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  manual: {
    icon: PencilIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  manual_override: {
    icon: WrenchIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

const releaseStateConfig: Record<ReleaseState, StatusConfig> = {
  released: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  provisional: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  not_entered: {
    icon: CircleDashedIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

function StatusBadge({
  config,
  label,
  className,
}: {
  config: StatusConfig
  label: string
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = config

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", statusClassName, className)}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function ExamStatusBadge({
  status,
  className,
}: {
  status: ExamStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={examStatusConfig[status]}
      label={examStatusLabels[status]}
      className={className}
    />
  )
}

export function AttemptStatusBadge({
  status,
  className,
}: {
  status: AttemptStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={attemptStatusConfig[status]}
      label={attemptStatusLabels[status]}
      className={className}
    />
  )
}

export function ResultSourceBadge({
  source,
  className,
}: {
  source: ResultSource
  className?: string
}) {
  return (
    <StatusBadge
      config={sourceConfig[source]}
      label={resultSourceLabels[source]}
      className={className}
    />
  )
}

export function ReleaseStateBadge({
  state,
  className,
}: {
  state: ReleaseState
  className?: string
}) {
  return (
    <StatusBadge
      config={releaseStateConfig[state]}
      label={releaseStateLabels[state]}
      className={className}
    />
  )
}
