import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BanIcon,
  CalendarClockIcon,
  FilePenIcon,
  MegaphoneIcon,
} from "lucide-react"

import {
  noticeStateLabels,
  type NoticeState,
} from "@/lib/notices-data"

const stateConfig: Record<
  NoticeState,
  { icon: typeof FilePenIcon; className: string }
> = {
  draft: {
    icon: FilePenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  scheduled: {
    icon: CalendarClockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  published: {
    icon: MegaphoneIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  expired: {
    icon: BanIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function NoticeStatusBadge({
  state,
  className,
}: {
  state: NoticeState
  className?: string
}) {
  const config = stateConfig[state]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", config.className, className)}
    >
      <Icon aria-hidden="true" />
      {noticeStateLabels[state]}
    </Badge>
  )
}
