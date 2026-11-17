import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  CoinsIcon,
  PercentIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react"

import {
  commissionCalcTypeLabels,
  commissionRuleStatusLabels,
  commissionScopeLabels,
  getCommissionScope,
  type CommissionCalcType,
  type CommissionRuleRecord,
  type CommissionRuleStatus,
  type CommissionScopeKind,
} from "@/lib/commissions-data"

const calcTypeConfig: Record<
  CommissionCalcType,
  { icon: LucideIcon; className: string }
> = {
  percent: {
    icon: PercentIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  fixed_per_student_month: {
    icon: CoinsIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

export function CommissionCalcTypeBadge({
  calcType,
  className,
}: {
  calcType: CommissionCalcType
  className?: string
}) {
  const { icon: Icon, className: typeClassName } = calcTypeConfig[calcType]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", typeClassName, className)}
    >
      <Icon aria-hidden="true" />
      {commissionCalcTypeLabels[calcType]}
    </Badge>
  )
}

const scopeClassName: Record<CommissionScopeKind, string> = {
  course:
    "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  subject_grade:
    "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  subject: "border-border bg-muted text-muted-foreground",
  default: "border-border bg-muted text-muted-foreground",
}

export function CommissionScopeBadge({
  rule,
  showDetail = false,
  className,
}: {
  rule: CommissionRuleRecord
  showDetail?: boolean
  className?: string
}) {
  const scope = getCommissionScope(rule)

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", scopeClassName[scope.kind], className)}
    >
      <TargetIcon aria-hidden="true" />
      {showDetail ? scope.detail : commissionScopeLabels[scope.kind]}
    </Badge>
  )
}

const statusConfig: Record<
  CommissionRuleStatus,
  { className: string }
> = {
  active: {
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  scheduled: {
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  ended: {
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function CommissionStatusBadge({
  status,
  className,
}: {
  status: CommissionRuleStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", statusConfig[status].className, className)}
    >
      {commissionRuleStatusLabels[status]}
    </Badge>
  )
}
