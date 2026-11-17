"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  ArrowDownIcon,
  CoinsIcon,
  InfoIcon,
  ListOrderedIcon,
  ScaleIcon,
  SparklesIcon,
  SquarePenIcon,
  TargetIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  CommissionCalcTypeBadge,
  CommissionScopeBadge,
  CommissionStatusBadge,
} from "@/components/commission-rules/commission-rule-badge"
import {
  commissionBasisHints,
  commissionBasisLabels,
  commissionBasisMock,
  commissionCalcTypeLabels,
  commissionScopeHints,
  commissionScopeLabels,
  commissionScopePrecedence,
  estimateCommission,
  findOverlappingRules,
  formatCommissionPeriod,
  formatCommissionRate,
  formatCommissionRateShort,
  getCommissionRuleStatus,
  getCommissionScope,
  type CommissionRuleRecord,
} from "@/lib/commissions-data"
import { formatLkr } from "@/lib/courses-data"
import { MOCK_TODAY } from "@/lib/students-data"

type CommissionBasis = keyof typeof commissionBasisLabels

type CommissionRuleDetailSheetProps = {
  rule: CommissionRuleRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (rule: CommissionRuleRecord) => void
  onNotice: (message: string) => void
}

export function CommissionRuleDetailSheet({
  rule,
  open,
  onOpenChange,
  onEdit,
  onNotice,
}: CommissionRuleDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [basis, setBasis] = useState<CommissionBasis>(commissionBasisMock)

  useEffect(() => {
    if (open) setBasis(commissionBasisMock)
  }, [open, rule])

  const scope = rule ? getCommissionScope(rule) : null
  const status = rule ? getCommissionRuleStatus(rule) : null
  const overlaps = rule ? findOverlappingRules(rule) : []
  const estimate = rule ? estimateCommission(rule, 25000, 12) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {rule && scope && status && estimate ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                <ScaleIcon className="size-5" aria-hidden="true" />
                {rule.lecturerName}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <CommissionScopeBadge rule={rule} />
                <CommissionCalcTypeBadge calcType={rule.calcType} />
                <CommissionStatusBadge status={status} />
                <span className="tabular-nums">
                  {formatCommissionRate(rule)}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              {overlaps.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <TriangleAlertIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Possible overlap</span>
                    <span>
                      This rule shares a scope and dates with{" "}
                      {overlaps.length}{" "}
                      {overlaps.length === 1 ? "other rule" : "other rules"} for
                      the same lecturer. The schema blocks this with an exclusion
                      constraint.
                    </span>
                  </div>
                </div>
              ) : null}

              <section className="flex flex-col gap-3">
                <SectionHeading icon={<InfoIcon />} title="Overview" />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                  <DetailField
                    label="Lecturer"
                    value={
                      <span className="flex items-center gap-1.5">
                        <UserRoundIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {rule.lecturerName}
                      </span>
                    }
                  />
                  <DetailField
                    label="Scope"
                    value={<CommissionScopeBadge rule={rule} />}
                  />
                  <DetailField
                    label="Applies to"
                    value={scope.detail}
                  />
                  <DetailField
                    label="Calculation"
                    value={commissionCalcTypeLabels[rule.calcType]}
                  />
                  <DetailField
                    label="Rate"
                    value={formatCommissionRate(rule)}
                  />
                  <DetailField
                    label="Status as of today"
                    value={<CommissionStatusBadge status={status} />}
                  />
                  <DetailField
                    label="Effective period"
                    value={formatCommissionPeriod(rule)}
                  />
                  <DetailField
                    label="Created on"
                    value={rule.createdAt}
                  />
                </dl>
                <p className="text-xs text-muted-foreground">
                  Status is measured against the mock date {MOCK_TODAY}. The end
                  date is exclusive, so a rule ending on a date stops applying
                  from that date.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ListOrderedIcon />}
                  title="Specificity precedence"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      Most specific wins
                    </Badge>
                  }
                />
                <ol className="flex flex-col divide-y rounded-lg border">
                  {commissionScopePrecedence.map((kind, index) => {
                    const isCurrent = kind === scope.kind

                    return (
                      <li
                        key={kind}
                        className={
                          isCurrent
                            ? "flex items-start gap-3 bg-primary/5 p-3"
                            : "flex items-start gap-3 p-3"
                        }
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                          {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {commissionScopeLabels[kind]}
                            {isCurrent ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-primary/30 bg-primary/10 text-primary"
                              >
                                This rule
                              </Badge>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {commissionScopeHints[kind]}
                          </span>
                        </div>
                        {index < commissionScopePrecedence.length - 1 ? (
                          <ArrowDownIcon
                            className="mt-1 size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
                <p className="text-xs text-muted-foreground">
                  Resolution is course → subject + grade → subject → lecturer
                  default. A rule at a higher step overrides the ones below it
                  for the courses it covers.
                </p>
              </section>

              {overlaps.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <SectionHeading
                    icon={<TriangleAlertIcon />}
                    title="Overlapping rules"
                    aside={
                      <span className="text-xs text-muted-foreground">
                        {overlaps.length}{" "}
                        {overlaps.length === 1 ? "rule" : "rules"}
                      </span>
                    }
                  />
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {overlaps.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm font-medium tabular-nums">
                            {formatCommissionRateShort(item)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCommissionPeriod(item)}
                          </span>
                        </div>
                        <CommissionCalcTypeBadge calcType={item.calcType} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Two rules for the same lecturer and scope may not be in effect
                    at the same time. Resolve by adjusting one rule&apos;s scope
                    or end date.
                  </p>
                </section>
              ) : (
                <section className="flex flex-col gap-3">
                  <SectionHeading icon={<TargetIcon />} title="Overlap check" />
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
                    No other rule for this lecturer targets the same scope with
                    overlapping dates.
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CoinsIcon />}
                  title="Commission basis"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      Organization setting
                    </Badge>
                  }
                />
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    The base a commission is calculated on is a single
                    organization-wide setting. It is shown here for context and is
                    shared by every rule.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="commission-basis">Basis</Label>
                    <Select
                      items={[
                        {
                          value: "paid",
                          label: commissionBasisLabels.paid,
                        },
                        {
                          value: "list",
                          label: commissionBasisLabels.list,
                        },
                      ]}
                      value={basis}
                      onValueChange={(value) => {
                        const next = (value ?? "paid") as CommissionBasis
                        setBasis(next)
                        onNotice(
                          `Basis switched to “${commissionBasisLabels[next]}” in this preview. The organization setting is not saved.`
                        )
                      }}
                    >
                      <SelectTrigger id="commission-basis" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">
                          {commissionBasisLabels.paid}
                        </SelectItem>
                        <SelectItem value="list">
                          {commissionBasisLabels.list}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {commissionBasisHints[basis]}
                    </p>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<SparklesIcon />}
                  title="Illustrative estimate"
                  aside={
                    <Badge
                      variant="outline"
                      className="rounded-full border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:text-amber-400"
                    >
                      Not a calculation
                    </Badge>
                  }
                />
                <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">
                    A sample of a {formatLkr(estimate.base)} base with 12
                    students, only to show how the rate behaves.
                  </p>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        Institute keeps
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatLkr(estimate.commission)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        Teacher receives
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatLkr(estimate.teacher)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        Capped at base
                      </span>
                      <span className="text-sm font-semibold">
                        {estimate.capped ? "Yes" : "No"}
                      </span>
                    </div>
                  </dl>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real commission entries snapshot the rule, rate, share and
                  basis at accrual time, so later rule edits never change past
                  earnings. No accrual or payout is computed on this page.
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample rule · no changes are saved
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => onEdit(rule)}>
                  <SquarePenIcon data-icon="inline-start" />
                  Edit rule (demo)
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
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

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}