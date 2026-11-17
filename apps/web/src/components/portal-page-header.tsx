import type { ReactNode } from "react"

export function PortalPageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string
  description: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {meta ? (
          <div className="flex flex-wrap items-center gap-2">{meta}</div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
