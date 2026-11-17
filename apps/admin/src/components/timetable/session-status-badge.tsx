import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BadgeCheckIcon, BanIcon, CalendarClockIcon } from "lucide-react"

import type { CourseSessionRecord } from "@/lib/courses-data"

const config: Record<
  CourseSessionRecord["status"],
  { label: string; icon: typeof CalendarClockIcon; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    icon: CalendarClockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  held: {
    label: "Held",
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: BanIcon,
    className:
      "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  },
}

export function SessionStatusBadge({
  status,
  className,
}: {
  status: CourseSessionRecord["status"]
  className?: string
}) {
  const { label, icon: Icon, className: statusClassName } = config[status]

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
