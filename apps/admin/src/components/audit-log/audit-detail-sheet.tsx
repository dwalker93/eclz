import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  CircleAlertIcon,
  ClipboardCopyIcon,
  CpuIcon,
  FingerprintIcon,
  InfoIcon,
  ScrollTextIcon,
  UserRoundIcon,
} from "lucide-react"

import { AuditJsonView } from "@/components/audit-log/audit-json-view"
import {
  countAuditFields,
  getEntityTypeLabel,
  type AuditRecord,
} from "@/lib/audit-log-data"
import { formatDateTime } from "@/lib/students-data"

type AuditDetailSheetProps = {
  record: AuditRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotice: (message: string) => void
}

export function AuditDetailSheet({
  record,
  open,
  onOpenChange,
  onNotice,
}: AuditDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-2xl"
      >
        {record ? (
          <>
            <SheetHeader className="border-b p-6 pr-14">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full">
                    <ScrollTextIcon aria-hidden="true" />
                    {getEntityTypeLabel(record.entityType)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(record.at)}
                  </span>
                </div>
                <SheetTitle className="font-mono text-lg">
                  {record.action}
                </SheetTitle>
                <SheetDescription>{record.entityLabel}</SheetDescription>
                <div className="flex flex-wrap items-center gap-1.5">
                  {record.actor.isSystem ? (
                    <Badge variant="secondary" className="rounded-full">
                      <CpuIcon data-icon="inline-start" />
                      System
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      <UserRoundIcon data-icon="inline-start" />
                      {record.actor.name}
                    </Badge>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  This register is append-only. Records cannot be edited or
                  deleted, and this page makes no changes.
                </span>
              </div>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<FingerprintIcon aria-hidden="true" />}
                  title="Record"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Field label="Timestamp" value={formatDateTime(record.at)} />
                  <Field
                    label="Actor"
                    value={record.actor.isSystem ? "System" : record.actor.name}
                  />
                  <Field label="Action" value={record.action} mono />
                  <Field
                    label="Entity type"
                    value={getEntityTypeLabel(record.entityType)}
                  />
                  <Field label="Entity label" value={record.entityLabel} />
                  <Field label="Entity ID" value={record.entityId} mono />
                </dl>

                <div className="flex flex-col gap-1 rounded-lg border p-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <CircleAlertIcon className="size-3.5" aria-hidden="true" />
                    Reason
                  </span>
                  <span className="text-sm">
                    {record.reason ?? "No reason recorded."}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    onNotice(
                      `Record ${record.id} would be copied to the clipboard. Local demo only — nothing was copied.`
                    )
                  }
                >
                  <ClipboardCopyIcon data-icon="inline-start" />
                  Copy record ID (demo)
                </Button>
              </section>

              <Separator />

              <section className="flex flex-col gap-4">
                <SectionHeading
                  icon={<ScrollTextIcon aria-hidden="true" />}
                  title="Change detail"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {countAuditFields(record.before) +
                        countAuditFields(record.after)}{" "}
                      fields
                    </Badge>
                  }
                />

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Before</span>
                  <AuditJsonView value={record.before} label="before" />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">After</span>
                  <AuditJsonView value={record.after} label="after" />
                </div>

                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <InfoIcon
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  Sensitive values are stored already masked in these sample
                  records. Passwords, signing keys, card numbers and NIC values
                  are never shown.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-popover p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SectionHeading({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          mono ? "font-mono text-sm break-words" : "text-sm break-words"
        }
      >
        {value}
      </dd>
    </div>
  )
}
