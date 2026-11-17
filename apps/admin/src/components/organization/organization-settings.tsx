"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import {
  Building2Icon,
  CheckCheckIcon,
  CircleAlertIcon,
  InfoIcon,
  KeyRoundIcon,
  RotateCcwIcon,
  SaveIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  WalletIcon,
} from "lucide-react"

import {
  ORGANIZATION_MODULE_COUNT,
  ORGANIZATION_MODULE_GROUPS,
  commissionBasisHints,
  commissionBasisOptions,
  currencyOptions,
  getEnabledModuleCount,
  organization,
  organizationTypeOptions,
  overdueActionHints,
  overdueActionOptions,
  timezoneOptions,
  type CommissionBasis,
  type ModuleName,
  type OrganizationType,
  type OverdueAction,
} from "@/lib/organization-data"
import { formatDisplayDate } from "@/lib/students-data"

type FormState = {
  name: string
  type: OrganizationType
  currency: string
  timezone: string
  guardianRequiredBelowAge: string
  overdueGraceDays: string
  overdueAction: OverdueAction
  discountCommissionBasis: CommissionBasis
  enabledModules: Record<ModuleName, boolean>
}

type FormErrors = {
  name?: string
  guardianRequiredBelowAge?: string
  overdueGraceDays?: string
}

function toForm(): FormState {
  return {
    name: organization.name,
    type: organization.type,
    currency: organization.currency,
    timezone: organization.timezone,
    guardianRequiredBelowAge: String(organization.guardianRequiredBelowAge),
    overdueGraceDays: String(organization.overdueGraceDays),
    overdueAction: organization.overdueAction,
    discountCommissionBasis: organization.discountCommissionBasis,
    enabledModules: { ...organization.enabledModules },
  }
}

export function OrganizationSettings() {
  const [form, setForm] = useState<FormState>(toForm)
  const [saved, setSaved] = useState<FormState>(toForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [notice, setNotice] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved]
  )
  const enabledCount = getEnabledModuleCount(form.enabledModules)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function toggleModule(name: ModuleName, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      enabledModules: { ...previous.enabledModules, [name]: checked },
    }))
  }

  function handleSave() {
    const nextErrors: FormErrors = {}
    const guardianAge = Number(form.guardianRequiredBelowAge)
    const graceDays = Number(form.overdueGraceDays)

    if (!form.name.trim()) {
      nextErrors.name = "Enter the organization name."
    }
    if (
      form.guardianRequiredBelowAge.trim() === "" ||
      !Number.isInteger(guardianAge) ||
      guardianAge < 0
    ) {
      nextErrors.guardianRequiredBelowAge =
        "Enter a whole number of years (0 or more)."
    }
    if (
      form.overdueGraceDays.trim() === "" ||
      !Number.isInteger(graceDays) ||
      graceDays < 0
    ) {
      nextErrors.overdueGraceDays = "Enter a whole number of days (0 or more)."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setNotice(null)
      return
    }

    setErrors({})
    setSaved({
      ...form,
      name: form.name.trim(),
      guardianRequiredBelowAge: String(guardianAge),
      overdueGraceDays: String(graceDays),
    })
    setForm((previous) => ({
      ...previous,
      name: form.name.trim(),
      guardianRequiredBelowAge: String(guardianAge),
      overdueGraceDays: String(graceDays),
    }))
    setNotice(
      "Organization settings applied in this preview. Local demo only — nothing was saved."
    )
  }

  function handleReset() {
    setForm(saved)
    setErrors({})
    setNotice("Unsaved changes discarded in this preview.")
  }

  return (
    <main className="mx-auto size-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Organization
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Settings for the single <code>organization</code> row.
              Organization type, currency, timezone, student and billing rules,
              and the module switches are shown here. Nothing on this page is
              saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDirty ? (
              <Badge
                variant="outline"
                className="rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
              >
                <CircleAlertIcon aria-hidden="true" />
                Unsaved changes
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full">
                <CheckCheckIcon aria-hidden="true" />
                No unsaved changes
              </Badge>
            )}
            <Button variant="outline" onClick={handleReset} disabled={!isDirty}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!isDirty}>
              <SaveIcon data-icon="inline-start" />
              Save settings (demo)
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm"
          >
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>{notice}</span>
          </div>
        ) : null}

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <Building2Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              General
            </CardTitle>
            <CardDescription>
              Identity, locale and the signing key reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-4 py-5 sm:px-6">
            <FormField
              label="Organization name"
              htmlFor="org-name"
              required
              error={errors.name}
            >
              <Input
                id="org-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                aria-invalid={errors.name ? true : undefined}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Type" htmlFor="org-type">
                <Select
                  items={organizationTypeOptions}
                  value={form.type}
                  onValueChange={(value) =>
                    update("type", (value ?? "institution") as OrganizationType)
                  }
                >
                  <SelectTrigger id="org-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Currency"
                htmlFor="org-currency"
                hint="Single-currency deployment in this demo."
              >
                <Select
                  items={currencyOptions}
                  value={form.currency}
                  onValueChange={(value) => update("currency", value ?? "LKR")}
                >
                  <SelectTrigger id="org-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Timezone" htmlFor="org-timezone">
                <Select
                  items={timezoneOptions}
                  value={form.timezone}
                  onValueChange={(value) =>
                    update("timezone", value ?? "Asia/Colombo")
                  }
                >
                  <SelectTrigger id="org-timezone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="flex flex-col gap-1.5">
                <Label>Created</Label>
                <div className="flex h-9 items-center rounded-md border border-input px-2.5 text-sm text-muted-foreground">
                  {formatDisplayDate(organization.createdAt)}
                </div>
                <p className="text-xs text-muted-foreground">
                  The organization row is created once per deployment.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <KeyRoundIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    Signing key reference
                    <Badge
                      variant="outline"
                      className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                    >
                      <ShieldCheckIcon aria-hidden="true" />
                      Configured
                    </Badge>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {organization.signingKeyRef ?? "Not configured"}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                <KeyRoundIcon data-icon="inline-start" />
                Rotate key (demo)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Only a masked reference is shown. The signing key itself is never
              displayed or entered here.
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <WalletIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Student &amp; billing rules
            </CardTitle>
            <CardDescription>
              Guardian requirement, overdue behaviour and the discount
              commission basis.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-4 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Guardian required below age"
                htmlFor="org-guardian-age"
                required
                error={errors.guardianRequiredBelowAge}
                hint="Students younger than this need a guardian on file."
              >
                <Input
                  id="org-guardian-age"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={form.guardianRequiredBelowAge}
                  onChange={(event) =>
                    update("guardianRequiredBelowAge", event.target.value)
                  }
                  aria-invalid={
                    errors.guardianRequiredBelowAge ? true : undefined
                  }
                />
              </FormField>

              <FormField
                label="Overdue grace days"
                htmlFor="org-grace-days"
                required
                error={errors.overdueGraceDays}
                hint="Days after the due date before an invoice is overdue."
              >
                <Input
                  id="org-grace-days"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={form.overdueGraceDays}
                  onChange={(event) =>
                    update("overdueGraceDays", event.target.value)
                  }
                  aria-invalid={errors.overdueGraceDays ? true : undefined}
                />
              </FormField>

              <FormField
                label="Overdue action"
                htmlFor="org-overdue-action"
                hint={overdueActionHints[form.overdueAction]}
              >
                <Select
                  items={overdueActionOptions}
                  value={form.overdueAction}
                  onValueChange={(value) =>
                    update("overdueAction", (value ?? "none") as OverdueAction)
                  }
                >
                  <SelectTrigger id="org-overdue-action" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {overdueActionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Discount commission basis"
                htmlFor="org-commission-basis"
                hint={commissionBasisHints[form.discountCommissionBasis]}
              >
                <Select
                  items={commissionBasisOptions}
                  value={form.discountCommissionBasis}
                  onValueChange={(value) =>
                    update(
                      "discountCommissionBasis",
                      (value ?? "paid") as CommissionBasis
                    )
                  }
                >
                  <SelectTrigger id="org-commission-basis" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commissionBasisOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontalIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Modules
              </CardTitle>
              <CardDescription>
                Optional features gated by <code>enabled_modules</code>.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              {enabledCount} of {ORGANIZATION_MODULE_COUNT} on
            </Badge>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 px-4 py-5 sm:px-6">
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                A switch gates its screens and stops new use of the feature.
                Turning a module off does not delete its existing records.
              </span>
            </div>

            {ORGANIZATION_MODULE_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Settings2Icon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.description}
                  </span>
                </div>
                <ul className="divide-y rounded-lg border">
                  {group.modules.map((module) => {
                    const checked = form.enabledModules[module.name]
                    return (
                      <li
                        key={module.name}
                        className="flex items-start justify-between gap-4 px-3 py-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {module.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {module.description}
                          </span>
                          <span className="text-xs text-muted-foreground/80">
                            {module.effect}
                          </span>
                        </div>
                        <Switch
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleModule(module.name, value)
                          }
                          aria-label={`Enable the ${module.label} module`}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <CircleAlertIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            Demo only. These settings are sample data; saving changes the local
            preview and writes nothing to a database.
          </span>
        </div>
      </div>
    </main>
  )
}

function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
