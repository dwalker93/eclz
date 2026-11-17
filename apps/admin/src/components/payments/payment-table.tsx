import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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
  CheckCircle2Icon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react"

import { PaymentMethodLabel } from "@/components/payments/payment-method-label"
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge"
import type { PaymentAction } from "@/components/payments/payment-action-dialogs"
import { formatLkr } from "@/lib/courses-data"
import { paymentStatusLabels } from "@/lib/invoices-data"
import {
  getTargetInvoiceNumbers,
  type PaymentRecord,
} from "@/lib/payments-data"
import { formatDateTime } from "@/lib/students-data"

type PaymentTableProps = {
  payments: PaymentRecord[]
  onView: (payment: PaymentRecord) => void
  onCopy: (payment: PaymentRecord) => void
  onAction: (action: PaymentAction, payment: PaymentRecord) => void
}

export function PaymentTable({
  payments,
  onView,
  onCopy,
  onAction,
}: PaymentTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 pl-4 text-muted-foreground sm:pl-6">
            Submitted
          </TableHead>
          <TableHead className="text-muted-foreground">Student</TableHead>
          <TableHead className="text-muted-foreground">Branch</TableHead>
          <TableHead className="text-muted-foreground">Method</TableHead>
          <TableHead className="text-muted-foreground">
            Reference / provider ref
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Amount
          </TableHead>
          <TableHead className="text-muted-foreground">
            Target invoices
          </TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="w-12 pr-4 text-right sm:pr-6">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => {
          const invoiceNumbers = getTargetInvoiceNumbers(payment)
          const activeAllocations = payment.allocations.filter(
            (allocation) => !allocation.reversedAt
          ).length
          const allocationCountLabel =
            activeAllocations === 1 ? "allocation" : "allocations"
          const allocationHint =
            activeAllocations > 0
              ? payment.status === "pending_verification"
                ? `${activeAllocations} proposed ${allocationCountLabel}`
                : `${activeAllocations} ${allocationCountLabel}`
              : payment.status === "rejected"
                ? "No allocation"
                : payment.status === "voided"
                  ? "Allocations reversed"
                  : "Not allocated"

          return (
            <TableRow key={payment.id}>
              <TableCell className="py-3 pl-4 sm:pl-6">
                <div className="flex flex-col gap-0.5">
                  <span>{formatDateTime(payment.submittedAt)}</span>
                  <span className="text-xs text-muted-foreground">
                    {payment.submittedVia}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-[200px] truncate font-medium">
                  {payment.studentName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {payment.studentNo}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {payment.branchName}
              </TableCell>
              <TableCell>
                <PaymentMethodLabel method={payment.method} />
                {payment.source === "cashier" ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Recorded at desk
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onView(payment)}
                  className="w-fit font-medium text-card-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {payment.referenceNo ?? payment.id}
                </button>
                <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                  {payment.gatewayTransaction
                    ? `${payment.gatewayTransaction.provider} · ${payment.gatewayTransaction.providerRef}`
                    : payment.bankAccount
                      ? `${payment.bankAccount.bankName} ${payment.bankAccount.maskedNumber}`
                      : "Cash voucher"}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatLkr(payment.amount)}
              </TableCell>
              <TableCell>
                <div className="flex max-w-[220px] flex-col gap-0.5">
                  {invoiceNumbers.length > 0 ? (
                    invoiceNumbers.slice(0, 2).map((invoiceNo) => (
                      <span key={invoiceNo} className="text-xs font-medium">
                        {invoiceNo}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No invoice target
                    </span>
                  )}
                  {invoiceNumbers.length > 2 ? (
                    <span className="text-xs text-muted-foreground">
                      +{invoiceNumbers.length - 2} more
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {allocationHint}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={payment.status} />
              </TableCell>
              <TableCell className="pr-4 text-right sm:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${payment.referenceNo ?? payment.id}`}
                      />
                    }
                  >
                    <EllipsisVerticalIcon
                      className="size-4"
                      aria-hidden="true"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        {paymentStatusLabels[payment.status]}
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(payment)}>
                        <EyeIcon aria-hidden="true" />
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopy(payment)}>
                        <CopyIcon aria-hidden="true" />
                        Copy reference
                      </DropdownMenuItem>
                      {payment.status === "pending_verification" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onAction("verify", payment)}
                          >
                            <CheckCircle2Icon aria-hidden="true" />
                            Verify payment
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onAction("reject", payment)}
                          >
                            <XCircleIcon aria-hidden="true" />
                            Reject payment
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {payment.status === "verified" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onAction("allocation", payment)}
                          >
                            <WrenchIcon aria-hidden="true" />
                            Adjust allocation
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onAction("void", payment)}
                          >
                            <BanIcon aria-hidden="true" />
                            Void payment
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
