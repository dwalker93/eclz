import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BanIcon, BadgeCheckIcon, FilePenIcon } from "lucide-react"

import type { PromotionRunStatus } from "@/lib/promotions-data"

const statusConfig: Record<
  PromotionRunStatus,
  { label: string; icon: typeof FilePenIcon; className: string }
> = {
  draft: {
    label: "Draft",
    icon: FilePenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  confirmed: {
    label: "Confirmed",
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  discarded: {
    label: "Discarded",
    icon: BanIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function PromotionStatusBadge({
  status,
  className,
}: {
  status: PromotionRunStatus
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
      {config.label}
    </Badge>
  )
}
