"use client"

import { useEffect, useMemo, useState } from "react"

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
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { UserPlusIcon } from "lucide-react"

import {
  ALL_BRANCHES_VALUE,
  assignmentBranchOptions,
  type RoleRecord,
  type StaffRoleAssignment,
  type UserRecord,
} from "@/lib/users-roles-data"

export type AssignmentDraft = {
  userId: string
  roleId: string
  branchId: string | null
}

type AssignmentDialogProps = {
  open: boolean
  assignment: StaffRoleAssignment | null
  isCreating: boolean
  users: UserRecord[]
  roles: RoleRecord[]
  /** Every current assignment, for duplicate detection. */
  existing: StaffRoleAssignment[]
  onOpenChange: (open: boolean) => void
  onSave: (draft: AssignmentDraft, assignmentId: string | null) => void
}

type FormErrors = {
  user?: string
  role?: string
  duplicate?: string
}

export function AssignmentDialog({
  open,
  assignment,
  isCreating,
  users,
  roles,
  existing,
  onOpenChange,
  onSave,
}: AssignmentDialogProps) {
  const [userId, setUserId] = useState("")
  const [roleId, setRoleId] = useState("")
  const [branchId, setBranchId] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    if (!open) return
    setUserId(assignment?.userId ?? "")
    setRoleId(assignment?.roleId ?? "")
    setBranchId(assignment?.branchId ?? null)
    setErrors({})
  }, [open, assignment])

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: `${user.fullName} · ${user.email}`,
      })),
    [users]
  )

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.id, label: role.name })),
    [roles]
  )

  const branchValue = branchId ?? ALL_BRANCHES_VALUE

  function handleSubmit() {
    const nextErrors: FormErrors = {}

    if (!userId) nextErrors.user = "Choose a user."
    if (!roleId) nextErrors.role = "Choose a role."

    if (!nextErrors.user && !nextErrors.role) {
      const clash = existing.find(
        (item) =>
          item.id !== assignment?.id &&
          item.userId === userId &&
          item.roleId === roleId &&
          (item.branchId ?? null) === (branchId ?? null)
      )

      if (clash) {
        nextErrors.duplicate =
          branchId === null
            ? "This user already has this role for all branches."
            : "This user already has this role for the selected branch."
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSave({ userId, roleId, branchId }, assignment?.id ?? null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlusIcon className="size-4" aria-hidden="true" />
            {isCreating ? "New assignment" : "Edit assignment"}
          </DialogTitle>
          <DialogDescription>
            A staff role assignment gives a user a role for one branch, or for
            all branches when no branch is chosen. UI preview — nothing is
            saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-user">
              User
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Select
              items={userOptions}
              value={userId}
              onValueChange={(value) => setUserId(value ?? "")}
            >
              <SelectTrigger
                id="assignment-user"
                className="w-full"
                disabled={!isCreating}
                aria-invalid={errors.user ? true : undefined}
              >
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {userOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.user ? (
              <p className="text-xs text-destructive">{errors.user}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Portal logins (lecturers, guardians, students) can also hold a
                staff role.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-role">
              Role
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Select
              items={roleOptions}
              value={roleId}
              onValueChange={(value) => setRoleId(value ?? "")}
            >
              <SelectTrigger
                id="assignment-role"
                className="w-full"
                disabled={!isCreating}
                aria-invalid={errors.role ? true : undefined}
              >
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role ? (
              <p className="text-xs text-destructive">{errors.role}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignment-branch">Branch scope</Label>
            <Select
              items={assignmentBranchOptions}
              value={branchValue}
              onValueChange={(value) =>
                setBranchId(
                  !value || value === ALL_BRANCHES_VALUE ? null : value
                )
              }
            >
              <SelectTrigger id="assignment-branch" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignmentBranchOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {branchId === null ? (
                <>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/20 bg-primary/10 text-primary"
                  >
                    All branches
                  </Badge>
                  The role applies everywhere, with no branch restriction.
                </>
              ) : (
                <>
                  <Badge variant="outline" className="rounded-full">
                    One branch
                  </Badge>
                  The role applies only to the selected branch.
                </>
              )}
            </p>
            {errors.duplicate ? (
              <p className="text-xs text-destructive">{errors.duplicate}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isCreating ? "Add assignment (demo)" : "Save assignment (demo)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
