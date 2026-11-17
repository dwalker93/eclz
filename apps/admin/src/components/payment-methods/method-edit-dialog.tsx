"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

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
import { Switch } from "@workspace/ui/components/switch"
import { CircleAlertIcon, CreditCardIcon, LockIcon } from "lucide-react"

import { PaymentMethodLabel } from "@/components/payments/payment-method-label"
import {
  paymentMethodDescriptions,
  type PaymentMethodSetting,
} from "@/lib/payment-methods-data"

type MethodEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: PaymentMethodSetting | null
  /** Another method is currently the organization default. */
  hasOtherDefault: boolean
  onSave: (next: {
    label: string
    isActive: boolean
    isDefault: boolean
  }) => void
}

export function MethodEditDialog({
  open,
  onOpenChange,
  method,
  hasOtherDefault,
  onSave,
}: MethodEditDialogProps) {
  const [label, setLabel] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!method) return

    setLabel(method.label)
    setIsActive(method.isActive)
    setIsDefault(method.isDefault)
    setError(null)
  }, [open, method])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!label.trim()) {
      setError("A label is required.")
      return
    }

    setError(null)
    onSave({ label: label.trim(), isActive, isDefault })
  }

  const isGateway = method?.type === "gateway"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-4" aria-hidden="true" />
            Edit payment method
          </DialogTitle>
          <DialogDescription>
            Update the label and flags for this method. This is a UI preview —
            nothing is saved.
          </DialogDescription>
        </DialogHeader>

        {method ? (
          <form
            id="method-edit-form"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method-label">Display label</Label>
              <Input
                id="method-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Bank transfer"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "method-label-error" : undefined}
              />
              {error ? (
                <p id="method-label-error" className="text-xs text-destructive">
                  {error}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The label students and staff see. The method type
                  ({method.type.replace("_", " ")}) never changes.
                </p>
              )}
            </div>

            <Label
              htmlFor="method-active-toggle"
              className="flex items-start justify-between gap-4 rounded-lg border p-3 font-normal"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Enabled</span>
                <span className="text-xs text-muted-foreground">
                  Disabled methods are hidden from payment capture but keep their
                  history.
                </span>
              </span>
              <Switch
                id="method-active-toggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </Label>

            <Label
              htmlFor="method-default-toggle"
              className="flex items-start justify-between gap-4 rounded-lg border p-3 font-normal"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Organization default
                </span>
                <span className="text-xs text-muted-foreground">
                  {hasOtherDefault && !isDefault
                    ? "Setting this default clears the current default method."
                    : "Only one method can be the default at a time."}
                </span>
              </span>
              <Switch
                id="method-default-toggle"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </Label>

            {isGateway ? (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LockIcon className="size-4" aria-hidden="true" />
                  Gateway provider
                </div>
                <p className="text-xs text-muted-foreground">
                  {paymentMethodDescriptions.gateway}
                </p>
                <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    API credentials
                  </span>
                  <Badge variant="outline" className="rounded-full font-mono">
                    •••••••• managed in Integrations
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Secrets are never requested or shown here.
                </p>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <CircleAlertIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Changes apply to this local preview only. No configuration is
                saved and no provider is contacted.
              </span>
            </div>
          </form>
        ) : null}

        <DialogFooter className="gap-2">
          <span className="mr-auto hidden sm:block">
            {method ? <PaymentMethodLabel method={method.type} /> : null}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="method-edit-form"
            disabled={!method}
          >
            Apply changes (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
