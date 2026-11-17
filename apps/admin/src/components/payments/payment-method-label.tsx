import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  BanknoteIcon,
  CreditCardIcon,
  LandmarkIcon,
  type LucideIcon,
} from "lucide-react"

import {
  paymentMethodLabels,
  type PaymentMethodType,
} from "@/lib/payments-data"

const methodIcons: Record<PaymentMethodType, LucideIcon> = {
  bank_transfer: LandmarkIcon,
  cash: BanknoteIcon,
  gateway: CreditCardIcon,
}

export function PaymentMethodLabel({
  method,
  className,
}: {
  method: PaymentMethodType
  className?: string
}) {
  const Icon = methodIcons[method]

  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full", className)}>
      <Icon aria-hidden="true" />
      {paymentMethodLabels[method]}
    </Badge>
  )
}
