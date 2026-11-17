"use client"

import { useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  BanIcon,
  BadgeCheckIcon,
  Building2Icon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LandmarkIcon,
  LockIcon,
  PlugZapIcon,
  PlusIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  StarIcon,
  WalletIcon,
  XIcon,
} from "lucide-react"

import { PaymentMethodLabel } from "@/components/payments/payment-method-label"
import {
  BankAccountDialog,
  type NewBankAccountInput,
} from "@/components/payment-methods/bank-account-dialog"
import { MethodEditDialog } from "@/components/payment-methods/method-edit-dialog"
import {
  bankAccounts,
  formatAccountNumber,
  getMethodUsageCount,
  getPaymentMethodUsageSummary,
  maskAccountNumber,
  paymentMethodDescriptions,
  paymentMethodSettings,
  type BankAccountSetting,
  type PaymentMethodSetting,
} from "@/lib/payment-methods-data"
import { branches } from "@/lib/students-data"

export function PaymentMethodsSettings() {
  const [methods, setMethods] = useState<PaymentMethodSetting[]>(
    paymentMethodSettings
  )
  const [accounts, setAccounts] =
    useState<BankAccountSetting[]>(bankAccounts)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingMethod, setEditingMethod] =
    useState<PaymentMethodSetting | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const summary = getPaymentMethodUsageSummary()
  const defaultMethod = methods.find((method) => method.isDefault)

  function toggleMethodActive(method: PaymentMethodSetting, checked: boolean) {
    setMethods((previous) =>
      previous.map((item) =>
        item.id === method.id ? { ...item, isActive: checked } : item
      )
    )
    setNotice(
      `${method.label} ${checked ? "enabled" : "disabled"} in this preview. Nothing was saved.`
    )
  }

  function setDefaultMethod(method: PaymentMethodSetting) {
    setMethods((previous) =>
      previous.map((item) => ({ ...item, isDefault: item.id === method.id }))
    )
    setNotice(
      `${method.label} set as the organization default in this preview. Nothing was saved.`
    )
  }

  function openEdit(method: PaymentMethodSetting) {
    setEditingMethod(method)
    setEditOpen(true)
  }

  function handleSaveMethod(next: {
    label: string
    isActive: boolean
    isDefault: boolean
  }) {
    if (!editingMethod) return

    const targetId = editingMethod.id

    setMethods((previous) =>
      previous.map((item) => {
        if (item.id === targetId) {
          return {
            ...item,
            label: next.label,
            isActive: next.isActive,
            isDefault: next.isDefault,
          }
        }

        return next.isDefault ? { ...item, isDefault: false } : item
      })
    )

    setEditOpen(false)
    setNotice(
      `${next.label} updated in this preview. Nothing was saved.`
    )
  }

  function handleAddAccount(input: NewBankAccountInput) {
    const branchName =
      branches.find((branch) => branch.id === input.branchId)?.name ?? "Branch"

    const account: BankAccountSetting = {
      id: `ba-new-${accounts.length + 1}-${Date.now()}`,
      branchId: input.branchId,
      branchName,
      bankName: input.bankName,
      bankBranchName: input.bankBranchName || "—",
      accountName: input.accountName,
      accountNumber: input.accountNumber,
      isActive: true,
      isPrimary: false,
    }

    setAccounts((previous) => [...previous, account])
    setAddOpen(false)
    setNotice(
      `${input.bankName} account added to ${branchName} in this preview. Nothing was saved.`
    )
  }

  const hasOtherDefault = methods.some(
    (method) => method.isDefault && method.id !== editingMethod?.id
  )

  return (
    <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Payment Methods
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              How the institute collects money, and the branch bank destinations
              students transfer to. Account numbers are masked by default. This
              is a settings preview with local sample data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {defaultMethod ? (
              <Badge variant="outline" className="rounded-full">
                <StarIcon aria-hidden="true" />
                Default: {defaultMethod.label}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-muted-foreground">
                No default method
              </Badge>
            )}
            <Button onClick={() => setAddOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Add bank account
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{notice}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<WalletIcon aria-hidden="true" />}
            value={String(summary.offered)}
            label="Offered methods"
            hint="Bank transfer, cash and gateway"
          />
          <SummaryCard
            icon={<BadgeCheckIcon aria-hidden="true" />}
            value={String(methods.filter((method) => method.isActive).length)}
            label="Enabled"
            hint="Available on payment capture"
          />
          <SummaryCard
            icon={<LandmarkIcon aria-hidden="true" />}
            value={String(accounts.length)}
            label="Bank destinations"
            hint={`Across ${summary.branchCount} branches`}
          />
          <SummaryCard
            icon={<Building2Icon aria-hidden="true" />}
            value={String(summary.activeBankAccounts)}
            label="Active accounts"
            hint="Accepting transfers now"
          />
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>Offered methods</CardTitle>
              <CardDescription>
                Organization-wide methods with an enabled and a single default
                flag. Method types are fixed by the schema.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              <LockIcon aria-hidden="true" />
              One default at a time
            </Badge>
          </CardHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                  Method
                </TableHead>
                <TableHead className="text-muted-foreground">Usage</TableHead>
                <TableHead className="text-muted-foreground">Default</TableHead>
                <TableHead className="text-muted-foreground">Enabled</TableHead>
                <TableHead className="w-12 pr-4 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell className="py-3 pl-4 sm:pl-6">
                    <div className="flex max-w-[320px] flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <PaymentMethodLabel method={method.type} />
                        <span className="font-medium">{method.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {paymentMethodDescriptions[method.type]}
                      </span>
                      {method.configSummary ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {method.configSummary}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    <span className="tabular-nums">
                      {getMethodUsageCount(method.type)}
                    </span>{" "}
                    sample payments
                  </TableCell>

                  <TableCell>
                    {method.isDefault ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                      >
                        <StarIcon aria-hidden="true" />
                        Default
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={method.isActive}
                        onCheckedChange={(checked) =>
                          toggleMethodActive(method, checked)
                        }
                        aria-label={`${method.isActive ? "Disable" : "Enable"} ${method.label}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {method.isActive ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="pr-4 text-right sm:pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${method.label}`}
                          />
                        }
                      >
                        <EllipsisVerticalIcon
                          className="size-4"
                          aria-hidden="true"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="truncate">
                          {method.label}
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openEdit(method)}>
                          <SquarePenIcon aria-hidden="true" />
                          Edit method
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!method.isActive || method.isDefault}
                          onClick={() => setDefaultMethod(method)}
                        >
                          <StarIcon aria-hidden="true" />
                          Set as default (demo)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            setNotice(
                              method.type === "gateway"
                                ? "Gateway provider settings live in Integrations. This is a placeholder — nothing is configured."
                                : `${paymentMethodDescriptions[method.type]}`
                            )
                          }
                        >
                          <InfoIcon aria-hidden="true" />
                          About this method
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle>Branch bank destinations</CardTitle>
              <CardDescription>
                Bank accounts students transfer to. Each account is scoped to one
                branch and stays hidden until revealed.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Add bank account
            </Button>
          </CardHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
                  Bank
                </TableHead>
                <TableHead className="text-muted-foreground">Branch</TableHead>
                <TableHead className="text-muted-foreground">
                  Account name
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Account number
                </TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const isRevealed = revealedId === account.id

                return (
                  <TableRow key={account.id}>
                    <TableCell className="py-3 pl-4 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
                          <LandmarkIcon aria-hidden="true" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{account.bankName}</span>
                          <span className="text-xs text-muted-foreground">
                            {account.bankBranchName}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2Icon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span>{account.branchName}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      {account.accountName}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {isRevealed
                            ? formatAccountNumber(account.accountNumber)
                            : maskAccountNumber(account.accountNumber)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setRevealedId(isRevealed ? null : account.id)
                          }
                          aria-label={
                            isRevealed
                              ? `Hide account number for ${account.bankName}`
                              : `Reveal account number for ${account.bankName}`
                          }
                        >
                          {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {account.isActive ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                          >
                            <BadgeCheckIcon aria-hidden="true" />
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full text-muted-foreground"
                          >
                            <BanIcon aria-hidden="true" />
                            Inactive
                          </Badge>
                        )}
                        {account.isPrimary ? (
                          <Badge variant="outline" className="rounded-full">
                            <StarIcon aria-hidden="true" />
                            Primary
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <PlugZapIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Gateway credentials live in Integrations
              </span>
              <span className="text-sm text-muted-foreground">
                The card gateway connects through a provider. This screen never
                requests, shows or stores provider secrets in plain text.
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setNotice(
                "Integrations is a separate settings page. Opening it from here is a placeholder in this demo."
              )
            }
          >
            <PlugZapIcon data-icon="inline-start" />
            Manage in Integrations (demo)
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="flex flex-col gap-1">
            <span className="flex items-start gap-1.5">
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Account numbers are masked by default and revealed only on demand.
              Secret credentials are never shown as text.
            </span>
            <span>
              Bank transfer is the organization default method and each bank
              destination is branch-scoped. Changes on this page are local
              previews only and are not saved.
            </span>
          </span>
        </div>
      </div>

      <MethodEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        method={editingMethod}
        hasOtherDefault={hasOtherDefault}
        onSave={handleSaveMethod}
      />

      <BankAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={handleAddAccount}
      />
    </main>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode
  value: string
  label: string
  hint: string
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span className="truncate text-2xl font-semibold tabular-nums">
          {value}
        </span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
