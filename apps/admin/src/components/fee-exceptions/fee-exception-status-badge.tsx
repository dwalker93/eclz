import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArchiveIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  PercentIcon,
  RepeatIcon,
  type LucideIcon,
} from "lucide-react"

import {
  feeExceptionKindLabels,
  feeExceptionStatusLabels,
  type FeeExceptionKind,
  type FeeExceptionStatus,
} from "@/lib/fee-exceptions-data"

const statusConfig: Record<
  FeeExceptionStatus,
  { icon: LucideIcon; className: string }
> = {
  active: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  scheduled: {
    icon: CalendarClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  ended: {
    icon: ArchiveIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function FeeExceptionStatusBadge({
  status,
  className,
}: {
  status: FeeExceptionStatus
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", statusClassName, className)}
    >
      <Icon aria-hidden="true" />
      {feeExceptionStatusLabels[status]}
    </Badge>
  )
}

const kindConfig: Record<
  FeeExceptionKind,
  { icon: LucideIcon; className: string }
> = {
  alternate_option: {
    icon: RepeatIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  discount: {
    icon: PercentIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
}

export function FeeExceptionKindBadge({
  kind,
  className,
}: {
  kind: FeeExceptionKind
  className?: string
}) {
  const { icon: Icon, className: kindClassName } = kindConfig[kind]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", kindClassName, className)}
    >
      <Icon aria-hidden="true" />
      {feeExceptionKindLabels[kind]}
    </Badge>
  )
}
