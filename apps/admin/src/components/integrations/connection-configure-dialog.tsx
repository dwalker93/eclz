"use client"

import { useEffect, useRef, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { InfoIcon, LockIcon, SettingsIcon } from "lucide-react"

import { IntegrationStateBadge } from "@/components/integrations/integration-state-badge"
import {
  NO_SECRET_NOTE,
  type ConfigField,
  type CredentialRef,
  type IntegrationState,
} from "@/lib/integrations-data"

export type ConnectionConfigureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  provider: string | null
  state: IntegrationState
  moduleLabel: string | null
  credentials: CredentialRef[]
  config: ConfigField[]
  /** Called with the connection title when the demo save button is pressed. */
  onSave: (title: string) => void
}

export function ConnectionConfigureDialog({
  open,
  onOpenChange,
  title,
  description,
  provider,
  state,
  moduleLabel,
  credentials,
  config,
  onSave,
}: ConnectionConfigureDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setValues(
      Object.fromEntries(config.map((field) => [field.label, field.value]))
    )
  }, [open, config])

  function update(label: string, value: string) {
    setValues((previous) => ({ ...previous, [label]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={firstFieldRef}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-4" aria-hidden="true" />
            Configure {title.toLowerCase()}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationStateBadge state={state} />
            {provider ? (
              <Badge variant="outline" className="rounded-full">
                {provider}
              </Badge>
            ) : null}
            {moduleLabel ? (
              <Badge variant="secondary" className="rounded-full">
                {moduleLabel}
              </Badge>
            ) : null}
          </div>

          {config.length > 0 ? (
            <div className="flex flex-col gap-4">
              {config.map((field, index) => (
                <div key={field.label} className="flex flex-col gap-1.5">
                  <Label htmlFor={`config-${field.label}`}>{field.label}</Label>
                  <Input
                    id={`config-${field.label}`}
                    ref={index === 0 ? firstFieldRef : undefined}
                    value={values[field.label] ?? field.value}
                    onChange={(event) =>
                      update(field.label, event.target.value)
                    }
                  />
                  {field.hint ? (
                    <p className="text-xs text-muted-foreground">
                      {field.hint}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {credentials.length > 0 ? (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <LockIcon className="size-3.5" aria-hidden="true" />
                  Credentials (masked)
                </span>
                {credentials.map((credential) => (
                  <div key={credential.label} className="flex flex-col gap-1.5">
                    <Label htmlFor={`secret-${credential.label}`}>
                      {credential.label}
                    </Label>
                    <Input
                      id={`secret-${credential.label}`}
                      value={credential.maskedValue}
                      readOnly
                      disabled
                      className="font-mono"
                      aria-describedby={`secret-hint-${credential.label}`}
                    />
                    <p
                      id={`secret-hint-${credential.label}`}
                      className="text-xs text-muted-foreground"
                    >
                      {credential.hint}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{NO_SECRET_NOTE}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(title)}>Save changes (demo)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
