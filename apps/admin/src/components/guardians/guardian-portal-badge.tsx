import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { Link2Icon, Link2OffIcon } from "lucide-react"

import type { GuardianRecord } from "@/lib/guardians-data"

export function GuardianPortalBadge({
  guardian,
  className,
}: {
  guardian: GuardianRecord
  className?: string
}) {
  const enabled = guardian.portalEnabled

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full",
        enabled
          ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      {enabled ? (
        <Link2Icon aria-hidden="true" />
      ) : (
        <Link2OffIcon aria-hidden="true" />
      )}
      {enabled ? "Portal enabled" : "Portal off"}
    </Badge>
  )
}
