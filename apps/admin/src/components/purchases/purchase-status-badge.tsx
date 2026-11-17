import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BanIcon,
  BookOpenIcon,
  ClockIcon,
  GlobeIcon,
  LockIcon,
  PackageCheckIcon,
  PackageOpenIcon,
  type LucideIcon,
} from "lucide-react"

import {
  purchaseChannelLabels,
  purchaseStatusLabels,
  type PurchaseChannel,
  type PurchaseStatus,
} from "@/lib/purchases-data"

type Config = { icon: LucideIcon; className: string }

const channelConfig: Record<PurchaseChannel, Config> = {
  online: {
    icon: GlobeIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  physical: {
    icon: BookOpenIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
}

const statusConfig: Record<PurchaseStatus, Config> = {
  pending: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  paid: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  cancelled: {
    icon: BanIcon,
    className:
      "border-red-600/20 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-400",
  },
}

const handoverConfig: Record<"done" | "pending" | "blocked" | "na", Config> = {
  done: {
    icon: PackageCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  pending: {
    icon: PackageOpenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  blocked: {
    icon: LockIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  na: {
    icon: BookOpenIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

function StatusBadge({
  config,
  label,
  className,
}: {
  config: Config
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

export function PurchaseChannelBadge({
  channel,
  className,
}: {
  channel: PurchaseChannel
  className?: string
}) {
  return (
    <StatusBadge
      config={channelConfig[channel]}
      label={purchaseChannelLabels[channel]}
      className={className}
    />
  )
}

export function PurchaseStatusBadge({
  status,
  className,
}: {
  status: PurchaseStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={statusConfig[status]}
      label={purchaseStatusLabels[status]}
      className={className}
    />
  )
}

export function HandoverBadge({
  state,
  className,
}: {
  state: "done" | "pending" | "blocked" | "na"
  className?: string
}) {
  const label =
    state === "done"
      ? "Handed over"
      : state === "pending"
        ? "Handover pending"
        : state === "blocked"
          ? "Handover locked"
          : "Not a physical book"

  return (
    <StatusBadge
      config={handoverConfig[state]}
      label={label}
      className={className}
    />
  )
}
