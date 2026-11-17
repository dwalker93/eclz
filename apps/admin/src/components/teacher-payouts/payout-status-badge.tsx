import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BanknoteIcon, BadgeCheckIcon, FilePenIcon } from "lucide-react"

import {
  payoutStatusLabels,
  type PayoutStatus,
} from "@/lib/teacher-payouts-data"

const statusConfig: Record<
  PayoutStatus,
  { icon: typeof FilePenIcon; className: string }
> = {
  draft: {
    icon: FilePenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  approved: {
    icon: BadgeCheckIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paid: {
    icon: BanknoteIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
}

export function PayoutStatusBadge({
  status,
  className,
}: {
  status: PayoutStatus
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
      {payoutStatusLabels[status]}
    </Badge>
  )
}
