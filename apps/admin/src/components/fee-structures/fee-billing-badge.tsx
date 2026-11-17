import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArchiveIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  PackageIcon,
  RepeatIcon,
  type LucideIcon,
} from "lucide-react"

import {
  feeBillingTypeLabels,
  feeStructureStatusLabels,
  type FeeStructureStatus,
} from "@/lib/fee-structures-data"
import type { FeeBillingType } from "@/lib/courses-data"

const billingConfig: Record<
  FeeBillingType,
  { icon: LucideIcon; className: string }
> = {
  recurring: {
    icon: RepeatIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  one_time_package: {
    icon: PackageIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
}

export function FeeBillingBadge({
  billingType,
  className,
}: {
  billingType: FeeBillingType
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = billingConfig[billingType]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", statusClassName, className)}
    >
      <Icon aria-hidden="true" />
      {feeBillingTypeLabels[billingType]}
    </Badge>
  )
}

const statusConfig: Record<
  FeeStructureStatus,
  { icon: LucideIcon; className: string }
> = {
  active: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  inactive: {
    icon: ArchiveIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  scheduled: {
    icon: CalendarClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

export function FeeStructureStatusBadge({
  status,
  className,
}: {
  status: FeeStructureStatus
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", statusClassName, className)}
    >
      <Icon aria-hidden="true" />
      {feeStructureStatusLabels[status]}
    </Badge>
  )
}
