import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArchiveIcon,
  BookOpenIcon,
  CreditCardIcon,
  FilePenLineIcon,
  FileTextIcon,
  GraduationCapIcon,
  SendIcon,
  UnlockIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"

import {
  contentAccessLabels,
  contentKindLabels,
  contentStatusLabels,
  type ContentAccessType,
  type ContentKind,
  type ContentStatus,
} from "@/lib/content-data"

type Config = { icon: LucideIcon; className: string }

const kindConfig: Record<ContentKind, Config> = {
  recording: {
    icon: VideoIcon,
    className:
      "border-violet-600/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:text-violet-400",
  },
  file: {
    icon: FileTextIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  physical_book: {
    icon: BookOpenIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
  },
}

const accessConfig: Record<ContentAccessType, Config> = {
  course: {
    icon: GraduationCapIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  free_registered: {
    icon: UnlockIcon,
    className:
      "border-sky-600/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:text-sky-400",
  },
  paid: {
    icon: CreditCardIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
}

const statusConfig: Record<ContentStatus, Config> = {
  draft: {
    icon: FilePenLineIcon,
    className: "border-border bg-muted text-muted-foreground",
  },
  published: {
    icon: SendIcon,
    className:
      "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400",
  },
  archived: {
    icon: ArchiveIcon,
    className:
      "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400",
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

export function ContentKindBadge({
  kind,
  className,
}: {
  kind: ContentKind
  className?: string
}) {
  return (
    <StatusBadge
      config={kindConfig[kind]}
      label={contentKindLabels[kind]}
      className={className}
    />
  )
}

export function ContentAccessBadge({
  accessType,
  className,
}: {
  accessType: ContentAccessType
  className?: string
}) {
  return (
    <StatusBadge
      config={accessConfig[accessType]}
      label={contentAccessLabels[accessType]}
      className={className}
    />
  )
}

export function ContentStatusBadge({
  status,
  className,
}: {
  status: ContentStatus
  className?: string
}) {
  return (
    <StatusBadge
      config={statusConfig[status]}
      label={contentStatusLabels[status]}
      className={className}
    />
  )
}
