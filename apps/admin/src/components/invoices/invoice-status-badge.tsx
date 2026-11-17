import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  BanIcon,
  CircleDollarSignIcon,
  ClockIcon,
  FileTextIcon,
  PackageIcon,
  PercentIcon,
  RepeatIcon,
  TriangleAlertIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import {
  installmentStatusLabels,
  invoiceItemKindLabels,
  invoiceStatusLabels,
  paymentStatusLabels,
  type InstallmentStatus,
  type InvoiceItemKind,
  type InvoiceStatus,
  type PaymentStatus,
} from "@/lib/invoices-data"

type BadgeConfig = {
  icon: LucideIcon
  className: string
}

const invoiceStatusConfig: Record<InvoiceStatus, BadgeConfig> = {
  pending: {
    icon: ClockIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  partial: {
    icon: CircleDollarSignIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paid: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  overdue: {
    icon: TriangleAlertIcon,
    className:
      "border-red-600/20 bg-red-500/10 text-red-700 dark:border-red-400/20 dark:text-red-400",
  },
  waived: {
    icon: PercentIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  cancelled: {
    icon: BanIcon,
    className:
      "border-border bg-muted/60 text-muted-foreground line-through decoration-muted-foreground/50",
  },
}

const installmentStatusConfig: Record<InstallmentStatus, BadgeConfig> = {
  pending: invoiceStatusConfig.pending,
  partial: invoiceStatusConfig.partial,
  paid: invoiceStatusConfig.paid,
  overdue: invoiceStatusConfig.overdue,
}

const paymentStatusConfig: Record<PaymentStatus, BadgeConfig> = {
  pending_verification: invoiceStatusConfig.pending,
  verified: invoiceStatusConfig.paid,
  rejected: invoiceStatusConfig.overdue,
  voided: {
    icon: BanIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

const itemKindConfig: Record<InvoiceItemKind, BadgeConfig> = {
  recurring_fee: {
    icon: RepeatIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  package_fee: {
    icon: PackageIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  content: {
    icon: FileTextIcon,
    className:
      "border-indigo-600/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/20 dark:text-indigo-400",
  },
  adjustment: {
    icon: WrenchIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  discount: {
    icon: PercentIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
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

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={invoiceStatusConfig[status]}
      label={invoiceStatusLabels[status]}
      className={className}
    />
  )
}

export function InstallmentStatusBadge({
  status,
  className,
}: {
  status: InstallmentStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={installmentStatusConfig[status]}
      label={installmentStatusLabels[status]}
      className={className}
    />
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

export function InvoiceItemKindBadge({
  kind,
  className,
}: {
  kind: InvoiceItemKind
  className?: string
}) {
  return (
    <StatusBadge
      config={itemKindConfig[kind]}
      label={invoiceItemKindLabels[kind]}
      className={className}
    />
  )
}
