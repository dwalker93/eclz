import type { ReactNode } from "react"

import { Card, CardHeader } from "@workspace/ui/components/card"
import {
  BadgeCheckIcon,
  BanknoteIcon,
  ClockIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { formatLkr } from "@/lib/courses-data"
import { getPaymentUsage } from "@/lib/payments-data"

type PaymentUsage = ReturnType<typeof getPaymentUsage>

export function PaymentSummary({ usage }: { usage: PaymentUsage }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        icon={<ClockIcon aria-hidden="true" />}
        value={usage.pending}
        label="Pending verification"
        hint={`${formatLkr(usage.pendingAmount)} awaiting review`}
      />
      <SummaryCard
        icon={<BadgeCheckIcon aria-hidden="true" />}
        value={usage.verified}
        label="Verified"
        hint={`${formatLkr(usage.verifiedAmount)} verified across the register`}
      />
      <SummaryCard
        icon={<BanknoteIcon aria-hidden="true" />}
        value={usage.cashRecorded}
        label="Cash at front desk"
        hint={`${formatLkr(usage.cashAmount)} recorded as verified`}
      />
      <SummaryCard
        icon={<TriangleAlertIcon aria-hidden="true" />}
        value={usage.attention}
        label="Rejected / voided"
        hint={`${formatLkr(usage.attentionAmount)} not counted as paid`}
      />
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode
  value: number
  label: string
  hint: string
}) {
  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardHeader>
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </Card>
  )
}
