import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BadgeCheckIcon, BanIcon } from "lucide-react"

import { receiptStatusLabels, type ReceiptStatus } from "@/lib/receipts-data"

const statusConfig: Record<
  ReceiptStatus,
  { icon: typeof BadgeCheckIcon; className: string }
> = {
  issued: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  void: {
    icon: BanIcon,
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
}

export function ReceiptStatusBadge({
  status,
  className,
}: {
  status: ReceiptStatus
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
      {receiptStatusLabels[status]}
    </Badge>
  )
}
