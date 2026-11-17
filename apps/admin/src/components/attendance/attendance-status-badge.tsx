import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"

import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceStatus,
} from "@/lib/attendance-data"

const statusConfig: Record<
  AttendanceStatus,
  { icon: LucideIcon; className: string }
> = {
  present: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  absent: {
    icon: CircleXIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
  late: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  excused: {
    icon: ShieldCheckIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
}

const unmarkedConfig = {
  icon: CircleDashedIcon,
  className: "border-dashed text-muted-foreground",
}

export function AttendanceStatusBadge({
  status,
  className,
}: {
  /** null shows the “Not marked” state used by scheduled sessions. */
  status: AttendanceStatus | null
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = status
    ? statusConfig[status]
    : unmarkedConfig

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", statusClassName, className)}
    >
      <Icon aria-hidden="true" />
      {status ? ATTENDANCE_STATUS_LABELS[status] : "Not marked"}
    </Badge>
  )
}
