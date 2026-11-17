"use client"

import { useEffect, useRef, useState } from "react"

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
import { InfoIcon, MapPinIcon } from "lucide-react"

import type { BranchRecord } from "@/lib/branches-data"

export type BranchDraft = {
  name: string
  address: string | null
  phone: string | null
  isDefault: boolean
  isActive: boolean
}

type FormState = {
  name: string
  address: string
  phone: string
  isDefault: boolean
  isActive: boolean
}

type FormErrors = {
  name?: string
  phone?: string
  isDefault?: string
}

type BranchFormDialogProps = {
  open: boolean
  branch: BranchRecord | null
  isCreating: boolean
  /** Branch names (lower-case) that already exist, for uniqueness checks. */
  existingNames: string[]
  onOpenChange: (open: boolean) => void
  onSave: (draft: BranchDraft, branchId: string | null) => void
}

function createEmptyForm(branch: BranchRecord | null): FormState {
  return {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    isDefault: branch?.isDefault ?? false,
    isActive: branch?.isActive ?? true,
  }
}

export function BranchFormDialog({
  open,
  branch,
  isCreating,
  existingNames,
  onOpenChange,
  onSave,
}: BranchFormDialogProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<FormState>(() => createEmptyForm(branch))
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) return
    setForm(createEmptyForm(branch))
    setErrors({})
  }, [open, branch])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit() {
    const nextErrors: FormErrors = {}
    const name = form.name.trim()
    const otherNames = existingNames.filter(
      (existing) => existing !== (branch?.name ?? "").toLowerCase()
    )

    if (!name) {
      nextErrors.name = "Enter a branch name."
    } else if (otherNames.includes(name.toLowerCase())) {
      nextErrors.name = "A branch with this name already exists."
    }

    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 9) {
      nextErrors.phone = "Enter a valid phone number, or leave it blank."
    }

    if (form.isDefault && !form.isActive) {
      nextErrors.isDefault = "The default branch must stay active."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSave(
      {
        name,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        isDefault: form.isDefault,
        isActive: form.isActive,
      },
      branch?.id ?? null
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={nameRef}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="size-4" aria-hidden="true" />
            {isCreating ? "Add branch" : "Edit branch"}
          </DialogTitle>
          <DialogDescription>
            Branches scope courses, students, invoices, payments, receipts and
            bank accounts. This is a UI preview — nothing is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-name">
              Branch name
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="branch-name"
              ref={nameRef}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Matara"
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Name is unique within the organization.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-address">Address</Label>
            <Input
              id="branch-address"
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="Street, city"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-phone">Phone</Label>
            <Input
              id="branch-phone"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+94 11 234 5600"
              inputMode="tel"
              aria-invalid={errors.phone ? true : undefined}
            />
            {errors.phone ? (
              <p className="text-xs text-destructive">{errors.phone}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Default branch</span>
                <span className="text-xs text-muted-foreground">
                  Only one branch is the default. It must stay active.
                </span>
              </span>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(checked) => {
                  update("isDefault", checked)
                  if (checked) update("isActive", true)
                }}
                aria-label="Mark as the default branch"
              />
            </label>
            {errors.isDefault ? (
              <p className="text-xs text-destructive">{errors.isDefault}</p>
            ) : null}

            <label className="flex items-center justify-between gap-3 border-t pt-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Active</span>
                <span className="text-xs text-muted-foreground">
                  Inactive branches stay in the directory but drop out of
                  selection lists.
                </span>
              </span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => update("isActive", checked)}
                aria-label="Mark the branch active"
              />
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              A branch with linked records is never deleted. Turn it inactive to
              retire it while keeping its history.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isCreating ? "Add branch (demo)" : "Save changes (demo)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
