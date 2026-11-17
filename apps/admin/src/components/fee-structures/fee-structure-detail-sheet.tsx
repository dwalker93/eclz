"use client"

import { useRef } from "react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  BadgeCheckIcon,
  CalendarClockIcon,
  InfoIcon,
  PencilIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react"

import {
  FeeBillingBadge,
  FeeStructureStatusBadge,
} from "@/components/fee-structures/fee-billing-badge"
import { courseKindLabels, formatLkr } from "@/lib/courses-data"
import {
  getCurrentRate,
  getFeeStructureStatus,
  overdueActionLabels,
  type FeeStructureRecord,
} from "@/lib/fee-structures-data"
import { formatDisplayDate, MOCK_TODAY } from "@/lib/students-data"

type FeeStructureDetailSheetProps = {
  structure: FeeStructureRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (structure: FeeStructureRecord) => void
}

export function FeeStructureDetailSheet({
  structure,
  open,
  onOpenChange,
  onEdit,
}: FeeStructureDetailSheetProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={headerRef}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {structure ? (
          <>
            <SheetHeader
              ref={headerRef}
              tabIndex={-1}
              className="border-b p-6 pr-14 outline-none"
            >
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
                {structure.name}
                {structure.isDefault ? (
                  <Badge variant="outline" className="rounded-full">
                    Default
                  </Badge>
                ) : null}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {structure.courseName} · {structure.branchName}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <FeeBillingBadge billingType={structure.billingType} />
                <FeeStructureStatusBadge
                  status={getFeeStructureStatus(structure)}
                />
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<ReceiptTextIcon />}
                  title="Structure overview"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-3">
                  <ProfileField label="Fee name" value={structure.name} />
                  <ProfileField label="Course" value={structure.courseName} />
                  <ProfileField
                    label="Kind"
                    value={courseKindLabels[structure.courseKind]}
                  />
                  <ProfileField label="Subject" value={structure.subjectName} />
                  <ProfileField label="Branch" value={structure.branchName} />
                  <ProfileField
                    label="Grades"
                    value={
                      structure.gradeNames.length > 0
                        ? structure.gradeNames.join(", ")
                        : "All grades (no grade link)"
                    }
                  />
                  <ProfileField
                    label="Intake"
                    value={structure.intakeName ?? "Not intake-specific"}
                  />
                  <ProfileField
                    label="Default"
                    value={
                      structure.isDefault
                        ? "Defaults onto new enrollments"
                        : "Optional structure"
                    }
                  />
                  <ProfileField
                    label="Created"
                    value={formatDisplayDate(structure.createdAt)}
                  />
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<WalletIcon />}
                  title="Billing"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      Current:{" "}
                      {(() => {
                        const rate = getCurrentRate(structure)
                        return rate ? formatLkr(rate.amount) : "No rate"
                      })()}
                    </Badge>
                  }
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                  <ProfileField
                    label="Billing type"
                    value={
                      structure.billingType === "recurring"
                        ? "Recurring fee"
                        : "One-time package"
                    }
                  />
                  <ProfileField
                    label="Frequency"
                    value={
                      structure.frequency
                        ? structure.frequency === "monthly"
                          ? "Monthly"
                          : "Per term"
                        : "Not applicable"
                    }
                  />
                  <ProfileField
                    label="Access duration"
                    value={
                      structure.billingType === "one_time_package"
                        ? structure.accessDurationMonths === null
                          ? "Lifetime access"
                          : `${structure.accessDurationMonths} months`
                        : "Follows the enrollment"
                    }
                  />
                  <ProfileField
                    label="Rates"
                    value={`${structure.rates.length} date-bounded ${
                      structure.rates.length === 1 ? "rate" : "rates"
                    }`}
                  />
                </dl>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<CalendarClockIcon />}
                  title="Grade rates"
                />
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Grade</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Amount
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Effective from
                        </th>
                        <th className="px-3 py-2 font-medium">Effective to</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {structure.rates.map((rate) => {
                        const isCurrent =
                          rate.effectiveFrom <= MOCK_TODAY &&
                          (rate.effectiveTo === null ||
                            MOCK_TODAY < rate.effectiveTo)

                        return (
                          <tr key={rate.id}>
                            <td className="px-3 py-2">
                              <span className="flex flex-wrap items-center gap-1.5">
                                {rate.gradeName ?? "All grades"}
                                {isCurrent ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400"
                                  >
                                    Current
                                  </Badge>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatLkr(rate.amount)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDisplayDate(rate.effectiveFrom)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {rate.effectiveTo
                                ? formatDisplayDate(rate.effectiveTo)
                                : "Open-ended"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rates are date-bounded: the “effective to” day is the first
                  day the next rate applies. Rates never overlap.
                </p>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<BadgeCheckIcon />}
                  title="Installment options"
                  aside={
                    <Badge variant="outline" className="rounded-full">
                      {structure.installmentOptions.length}
                    </Badge>
                  }
                />
                {structure.installmentOptions.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Option</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Count
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Down payment
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Interval
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Surcharge
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {structure.installmentOptions.map((option) => (
                          <tr key={option.id}>
                            <td className="px-3 py-2">
                              <span className="flex flex-wrap items-center gap-1.5">
                                {option.name}
                                {!option.isActive ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-muted-foreground"
                                  >
                                    Inactive
                                  </Badge>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {option.installmentCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {option.downPaymentPercent}%
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {option.intervalDays} days
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {option.surchargePercent}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Recurring fees do not offer installment plans. Installment
                      options only apply to one-time packages and are chosen
                      when the invoice is issued.
                    </span>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeading
                  icon={<TriangleAlertIcon />}
                  title="Overdue behavior"
                />
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
                  <ProfileField
                    label="Grace days"
                    value={
                      structure.overdueGraceDays === null
                        ? "Not configured"
                        : `${structure.overdueGraceDays} days`
                    }
                  />
                  <ProfileField
                    label="Action"
                    value={overdueActionLabels[structure.overdueAction]}
                  />
                </dl>
                <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <TriangleAlertIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Overdue behavior is a preview only. No reminder is sent and
                    no access is restricted from this page.
                  </span>
                </div>
              </section>

              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <InfoIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  A fee structure belongs to a course/class and defaults onto
                  new enrollments. Per-student alternatives and discounts live
                  on the optional Fee Exceptions module. No invoice, balance or
                  payment is calculated here.
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-popover p-4">
              <span className="text-xs text-muted-foreground">
                Sample fee structure · no changes are saved
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => onEdit(structure)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit structure (demo)
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

function ProfileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}
