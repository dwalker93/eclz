import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BanIcon,
  BadgeCheckIcon,
  ClockIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"

import {
  gatewayStatusLabels,
  paymentStatusLabels,
  type GatewayStatus,
  type PaymentStatus,
} from "@/lib/payments-data"

type BadgeConfig = {
  icon: LucideIcon
  className: string
}

const paymentStatusConfig: Record<PaymentStatus, BadgeConfig> = {
  pending_verification: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  verified: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  rejected: {
    icon: TriangleAlertIcon,
    className:
      "border-red-600/20 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-400",
  },
  voided: {
    icon: BanIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

const gatewayStatusConfig: Record<GatewayStatus, BadgeConfig> = {
  initiated: paymentStatusConfig.pending_verification,
  succeeded: paymentStatusConfig.verified,
  failed: paymentStatusConfig.rejected,
  cancelled: paymentStatusConfig.voided,
}

function StatusBadge({
  config,
  label,
  className,
}: {
  config: BadgeConfig
  label: string
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = config

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

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={paymentStatusConfig[status]}
      label={paymentStatusLabels[status]}
      className={className}
    />
  )
}

export function GatewayStatusBadge({
  status,
  className,
}: {
  status: GatewayStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={gatewayStatusConfig[status]}
      label={gatewayStatusLabels[status]}
      className={className}
    />
  )
}
