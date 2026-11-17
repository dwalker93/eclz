import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArchiveIcon,
  BadgeCheckIcon,
  FilePenIcon,
  LockIcon,
} from "lucide-react"

import {
  courseStatusLabels,
  intakeStatusLabels,
  type CourseStatus,
  type IntakeStatus,
} from "@/lib/courses-data"

const statusConfig: Record<
  CourseStatus,
  { icon: typeof FilePenIcon; className: string }
> = {
  draft: {
    icon: FilePenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  active: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  closed: {
    icon: LockIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  archived: {
    icon: ArchiveIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

export function CourseStatusBadge({
  status,
  className,
}: {
  status: CourseStatus
  className?: string
}) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", config.className, className)}
    >
      <Icon aria-hidden="true" />
      {courseStatusLabels[status]}
    </Badge>
  )
}

const intakeConfig: Record<IntakeStatus, string> = {
  open:
    "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  running:
    "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  closed: "border-border bg-muted text-muted-foreground",
}

export function IntakeStatusBadge({
  status,
  className,
}: {
  status: IntakeStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", intakeConfig[status], className)}
    >
      {intakeStatusLabels[status]}
    </Badge>
  )
}
