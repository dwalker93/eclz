import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BellIcon,
  BellRingIcon,
  CheckCircle2Icon,
  Clock3Icon,
  MailIcon,
  MessageSquareIcon,
  XCircleIcon,
} from "lucide-react"

import {
  notificationChannelLabels,
  notificationStatusLabels,
  type NotificationChannel,
  type NotificationStatus,
} from "@/lib/notifications-data"

const channelConfig: Record<
  NotificationChannel,
  { icon: typeof MailIcon; className: string }
> = {
  in_app: {
    icon: BellIcon,
    className: "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  email: {
    icon: MailIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  sms: {
    icon: MessageSquareIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  push: {
    icon: BellRingIcon,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
}

const statusConfig: Record<
  NotificationStatus,
  { icon: typeof CheckCircle2Icon; className: string }
> = {
  queued: {
    icon: Clock3Icon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  sent: {
    icon: CheckCircle2Icon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  failed: {
    icon: XCircleIcon,
    className:
      "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/40",
  },
}

export function NotificationChannelBadge({
  channel,
  className,
}: {
  channel: NotificationChannel
  className?: string
}) {
  const config = channelConfig[channel]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", config.className, className)}
    >
      <Icon aria-hidden="true" />
      {notificationChannelLabels[channel]}
    </Badge>
  )
}

export function NotificationStatusBadge({
  status,
  className,
}: {
  status: NotificationStatus
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
      {notificationStatusLabels[status]}
    </Badge>
  )
}
