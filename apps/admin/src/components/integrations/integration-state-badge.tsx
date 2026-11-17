import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheckIcon,
  CircleSlashIcon,
  PlugZapIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"

import {
  getIntegrationStateLabel,
  type IntegrationState,
} from "@/lib/integrations-data"

const config: Record<
  IntegrationState,
  { icon: LucideIcon; className: string }
> = {
  connected: {
    icon: BadgeCheckIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  attention: {
    icon: TriangleAlertIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
  disabled: {
    icon: CircleSlashIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  not_configured: {
    icon: PlugZapIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
}

export function IntegrationStateBadge({
  state,
  className,
}: {
  state: IntegrationState
  className?: string
}) {
  const { icon: Icon, className: stateClassName } = config[state]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", stateClassName, className)}
    >
      <Icon aria-hidden="true" />
      {getIntegrationStateLabel(state)}
    </Badge>
  )
}
