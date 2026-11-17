"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { LandmarkIcon } from "lucide-react"

import { branches } from "@/lib/students-data"
import { maskAccountNumber } from "@/lib/payment-methods-data"

export type NewBankAccountInput = {
  branchId: string
  bankName: string
  bankBranchName: string
  accountName: string
  accountNumber: string
}

type BankAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (input: NewBankAccountInput) => void
}

type FormState = {
  branchId: string
  bankName: string
  bankBranchName: string
  accountName: string
  accountNumber: string
}

type FormErrors = {
  branchId?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
}

const emptyForm: FormState = {
  branchId: "",
  bankName: "",
  bankBranchName: "",
  accountName: "Eclz Institute (Pvt) Ltd",
  accountNumber: "",
}

export function BankAccountDialog({
  open,
  onOpenChange,
  onAdd,
}: BankAccountDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    setForm(emptyForm)
    setErrors({})
  }, [open])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    const digits = form.accountNumber.replace(/\D/g, "")

    if (!form.branchId) {
      nextErrors.branchId = "Select the branch this account belongs to."
    }

    if (!form.bankName.trim()) {
      nextErrors.bankName = "A bank name is required."
    }

    if (!form.accountName.trim()) {
      nextErrors.accountName = "An account name is required."
    }

    if (digits.length < 6) {
      nextErrors.accountNumber =
        "Enter the full account number (at least 6 digits). It is masked by default."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onAdd({
      branchId: form.branchId,
      bankName: form.bankName.trim(),
      bankBranchName: form.bankBranchName.trim(),
      accountName: form.accountName.trim(),
      accountNumber: digits,
    })
  }

  const digits = form.accountNumber.replace(/\D/g, "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LandmarkIcon className="size-4" aria-hidden="true" />
            Add bank account
          </DialogTitle>
          <DialogDescription>
            Bank destinations are branch-scoped. This is a UI preview — nothing
            is saved.
          </DialogDescription>
        </DialogHeader>

        <form
          id="bank-account-form"
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-branch">Branch</Label>
            <Select
              items={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              value={form.branchId || null}
              onValueChange={(value) => update("branchId", value ?? "")}
            >
              <SelectTrigger
                id="bank-branch"
                className="w-full"
                aria-invalid={errors.branchId ? true : undefined}
                aria-describedby={errors.branchId ? "bank-branch-error" : undefined}
              >
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branchId ? (
              <p id="bank-branch-error" className="text-xs text-destructive">
                {errors.branchId}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Each account is scoped to a single branch.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bank-name">Bank name</Label>
              <Input
                id="bank-name"
                value={form.bankName}
                onChange={(event) => update("bankName", event.target.value)}
                placeholder="e.g. Sampath Bank"
                aria-invalid={errors.bankName ? true : undefined}
                aria-describedby={errors.bankName ? "bank-name-error" : undefined}
              />
              {errors.bankName ? (
                <p id="bank-name-error" className="text-xs text-destructive">
                  {errors.bankName}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bank-branch-name">
                Bank branch
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="bank-branch-name"
                value={form.bankBranchName}
                onChange={(event) =>
                  update("bankBranchName", event.target.value)
                }
                placeholder="e.g. Colombo 07"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-account-name">Account name</Label>
            <Input
              id="bank-account-name"
              value={form.accountName}
              onChange={(event) => update("accountName", event.target.value)}
              placeholder="Account holder name"
              aria-invalid={errors.accountName ? true : undefined}
              aria-describedby={
                errors.accountName ? "bank-account-name-error" : undefined
              }
            />
            {errors.accountName ? (
              <p
                id="bank-account-name-error"
                className="text-xs text-destructive"
              >
                {errors.accountName}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-account-number">Account number</Label>
            <Input
              id="bank-account-number"
              value={form.accountNumber}
              onChange={(event) => update("accountNumber", event.target.value)}
              placeholder="Digits only"
              inputMode="numeric"
              aria-invalid={errors.accountNumber ? true : undefined}
              aria-describedby={
                errors.accountNumber ? "bank-account-number-error" : undefined
              }
            />
            {errors.accountNumber ? (
              <p
                id="bank-account-number-error"
                className="text-xs text-destructive"
              >
                {errors.accountNumber}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Shown as{" "}
                <span className="font-mono">
                  {digits.length >= 4
                    ? maskAccountNumber(digits)
                    : "•••• •••• 0000"}
                </span>{" "}
                until revealed.
              </p>
            )}
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="bank-account-form">
            Add account (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
