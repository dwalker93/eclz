"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { LockIcon } from "lucide-react"

import { isSensitiveKey, truncateAuditValue } from "@/lib/audit-log-data"

type AuditJsonViewProps = {
  value: Record<string, unknown> | null
  label: string
}

/**
 * Readable, syntax-styled JSON preview. Long strings are truncated unless the
 * viewer is expanded, and sensitive field names are marked as always masked.
 */
export function AuditJsonView({ value, label }: AuditJsonViewProps) {
  const [expanded, setExpanded] = useState(false)

  if (!value) {
    return (
      <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
        No {label.toLowerCase()} data was recorded.
      </div>
    )
  }

  const fieldCount = Object.keys(value).length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {fieldCount} {fieldCount === 1 ? "field" : "fields"}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? "Truncate long values" : "Show full values"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        <JsonNode value={value} expanded={expanded} depth={0} />
      </pre>
    </div>
  )
}

function indent(depth: number) {
  return "  ".repeat(depth)
}

function JsonNode({
  value,
  expanded,
  depth,
}: {
  value: unknown
  expanded: boolean
  depth: number
}) {
  if (value === null) {
    return <span className="text-muted-foreground">null</span>
  }

  if (typeof value === "string") {
    return (
      <span className="text-emerald-700 dark:text-emerald-400">
        &quot;{expanded ? value : truncateAuditValue(value, 64)}&quot;
      </span>
    )
  }

  if (typeof value === "number") {
    return (
      <span className="text-sky-700 tabular-nums dark:text-sky-400">
        {value}
      </span>
    )
  }

  if (typeof value === "boolean") {
    return (
      <span className="text-amber-700 dark:text-amber-400">
        {String(value)}
      </span>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">[]</span>
    }

    return (
      <span>
        {"[\n"}
        {value.map((item, index) => (
          <span key={index}>
            {indent(depth + 1)}
            <JsonNode value={item} expanded={expanded} depth={depth + 1} />
            {index < value.length - 1 ? ",\n" : "\n"}
          </span>
        ))}
        {indent(depth)}
        {"]"}
      </span>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)

    if (entries.length === 0) {
      return <span className="text-muted-foreground">{"{}"}</span>
    }

    return (
      <span>
        {"{\n"}
        {entries.map(([key, entry], index) => (
          <span key={key}>
            {indent(depth + 1)}
            {isSensitiveKey(key) ? (
              <LockIcon
                className="mr-0.5 inline size-3 align-[-1px] text-muted-foreground"
                aria-label="Sensitive field, values are always masked"
              />
            ) : null}
            <span className="text-violet-700 dark:text-violet-400">
              &quot;{key}&quot;
            </span>
            <span className="text-muted-foreground">: </span>
            <JsonNode value={entry} expanded={expanded} depth={depth + 1} />
            {index < entries.length - 1 ? ",\n" : "\n"}
          </span>
        ))}
        {indent(depth)}
        {"}"}
      </span>
    )
  }

  return <span className="text-muted-foreground">{String(value)}</span>
}
