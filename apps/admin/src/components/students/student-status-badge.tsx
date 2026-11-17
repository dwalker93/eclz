import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import { STATUS_LABELS, type StudentStatus } from "@/lib/students-data"

const styles: Record<StudentStatus, string> = {
  active:
    "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  suspended:
    "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  alumni: "border-border bg-muted text-muted-foreground",
}

export function StudentStatusBadge({
  status,
  className,
}: {
  status: StudentStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", styles[status], className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "active" && "bg-emerald-600 dark:bg-emerald-400"
        )}
      />
      {STATUS_LABELS[status]}
    </Badge>
  )
}
