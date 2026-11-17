import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import { stageLabel, type GradeStage } from "@/lib/students-data"

const styles: Record<GradeStage, string> = {
  primary:
    "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  junior:
    "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  ordinary_level:
    "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  advanced_level:
    "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
}

export function GradeStageBadge({
  stage,
  className,
}: {
  stage: GradeStage
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", styles[stage], className)}
    >
      {stageLabel(stage)}
    </Badge>
  )
}
