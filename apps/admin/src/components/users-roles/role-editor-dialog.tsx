"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Switch } from "@workspace/ui/components/switch"
import { InfoIcon, LockIcon, ShieldCheckIcon } from "lucide-react"

import {
  PERMISSION_GROUPS,
  SYSTEM_ROLE_NOTE,
  type RoleRecord,
} from "@/lib/users-roles-data"

export type RoleDraft = {
  name: string
  description: string
  isSystem: boolean
  permissionCodes: string[]
}

type RoleEditorDialogProps = {
  open: boolean
  role: RoleRecord | null
  isCreating: boolean
  isEditor: boolean
  /** Names of users currently assigned, for the impact summary. */
  assignedUserNames: string[]
  existingNames: string[]
  onOpenChange: (open: boolean) => void
  onSave: (draft: RoleDraft, roleId: string | null) => void
}

type FormErrors = {
  name?: string
}

export function RoleEditorDialog({
  open,
  role,
  isCreating,
  isEditor,
  assignedUserNames,
  existingNames,
  onOpenChange,
  onSave,
}: RoleEditorDialogProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSystem, setIsSystem] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) return
    setName(role?.name ?? "")
    setDescription(role?.description ?? "")
    setIsSystem(role?.isSystem ?? false)
    setSelected(role?.permissionCodes ?? [])
    setErrors({})
  }, [open, role])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  function togglePermission(code: string, checked: boolean) {
    setSelected((previous) => {
      if (checked) {
        return previous.includes(code) ? previous : [...previous, code]
      }
      return previous.filter((item) => item !== code)
    })
  }

  function toggleGroup(codes: string[], checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous)
      for (const code of codes) {
        if (checked) next.add(code)
        else next.delete(code)
      }
      return [...next]
    })
  }

  function handleSubmit() {
    const nextErrors: FormErrors = {}
    const trimmedName = name.trim()
    const otherNames = existingNames.filter(
      (existing) => existing !== (role?.name ?? "").toLowerCase()
    )

    if (!trimmedName) {
      nextErrors.name = "Enter a role name."
    } else if (otherNames.includes(trimmedName.toLowerCase())) {
      nextErrors.name = "A role with this name already exists."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSave(
      {
        name: trimmedName,
        description: description.trim(),
        isSystem: role?.isSystem ?? isSystem,
        permissionCodes: selected,
      },
      role?.id ?? null
    )
  }

  const lockedName = !isCreating && isSystem

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={nameRef}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4" aria-hidden="true" />
            {isCreating ? "New role" : "Edit role"}
          </DialogTitle>
          <DialogDescription>
            A role groups permissions by code. Assign roles to users from the
            Assignments tab. This is a UI preview — nothing is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!isCreating && isSystem ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <LockIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>{SYSTEM_ROLE_NOTE}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">
              Role name
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="role-name"
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Lab Assistant"
              disabled={lockedName}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : lockedName ? (
              <p className="text-xs text-muted-foreground">
                Built-in role names cannot be changed.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Name is unique across all roles.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What can this role do?"
            />
          </div>

          {isCreating ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    Mark as built-in (system) role
                  </span>
                  <span className="text-xs text-muted-foreground">
                    System roles cannot be deleted later.
                  </span>
                </span>
                <Switch
                  checked={isSystem}
                  onCheckedChange={setIsSystem}
                  aria-label="Mark as a built-in role"
                />
              </label>
            </div>
          ) : null}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                Permissions
                <Badge variant="outline" className="rounded-full">
                  {selected.length} selected
                </Badge>
              </h3>
              <span className="text-xs text-muted-foreground">
                {isEditor
                  ? "Tick the permissions this role grants."
                  : "Read-only preview — permissions cannot be edited here."}
              </span>
            </div>
            {isEditor ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelected(
                      PERMISSION_GROUPS.flatMap((group) =>
                        group.permissions.map((permission) => permission.code)
                      )
                    )
                  }
                >
                  Select all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected([])}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {PERMISSION_GROUPS.map((group) => {
              const codes = group.permissions.map(
                (permission) => permission.code
              )
              const selectedInGroup = codes.filter((code) =>
                selectedSet.has(code)
              ).length
              const allSelected = selectedInGroup === codes.length

              return (
                <div key={group.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">
                        {group.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {group.description}
                      </span>
                    </div>
                    {isEditor ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {selectedInGroup}/{codes.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => toggleGroup(codes, !allSelected)}
                        >
                          {allSelected ? "Clear group" : "Select group"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {selectedInGroup}/{codes.length}
                      </span>
                    )}
                  </div>

                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {group.permissions.map((permission) => {
                      const checked = selectedSet.has(permission.code)

                      return (
                        <li key={permission.code}>
                          <label className="flex items-start gap-3 px-3 py-2.5">
                            <Checkbox
                              checked={checked}
                              disabled={!isEditor}
                              onCheckedChange={(value) =>
                                togglePermission(permission.code, value)
                              }
                              aria-label={permission.code}
                              className="mt-0.5"
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <code className="text-xs font-medium">
                                {permission.code}
                              </code>
                              <span className="text-xs text-muted-foreground">
                                {permission.description}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>

          {assignedUserNames.length > 0 ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Changing permissions affects {assignedUserNames.length}{" "}
                {assignedUserNames.length === 1 ? "user" : "users"}:{" "}
                {assignedUserNames.slice(0, 3).join(", ")}
                {assignedUserNames.length > 3
                  ? ` and ${assignedUserNames.length - 3} more`
                  : ""}
                .
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>No user is assigned to this role yet.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isCreating ? "Create role (demo)" : "Save role (demo)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
