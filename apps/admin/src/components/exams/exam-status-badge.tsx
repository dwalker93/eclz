import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  FilePenLineIcon,
  LockIcon,
  SendIcon,
  ClipboardListIcon,
  FileTextIcon,
  type LucideIcon,
} from "lucide-react"

import {
  examModeLabels,
  examStatusLabels,
  type ExamMode,
  type ExamStatus,
} from "@/lib/exams-data"

const statusConfig: Record<
  ExamStatus,
  { icon: LucideIcon; className: string }
> = {
  draft: {
    icon: FilePenLineIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  published: {
    icon: SendIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  closed: {
    icon: LockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
}

export function ExamStatusBadge({
  status,
  className,
}: {
  status: ExamStatus
  className?: string
}) {
  const { icon: Icon, className: statusClassName } = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", statusClassName, className)}
    >
      <Icon aria-hidden="true" />
      {examStatusLabels[status]}
    </Badge>
  )
}

const modeConfig: Record<ExamMode, { icon: LucideIcon; className: string }> = {
  online_mcq: {
    icon: ClipboardListIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  paper: {
    icon: FileTextIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
}

export function ExamModeBadge({
  mode,
  className,
}: {
  mode: ExamMode
  className?: string
}) {
  const { icon: Icon, className: modeClassName } = modeConfig[mode]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full", modeClassName, className)}
    >
      <Icon aria-hidden="true" />
      {examModeLabels[mode]}
    </Badge>
  )
}
