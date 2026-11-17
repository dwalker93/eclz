"use client"

import { useEffect, useState } from "react"

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
import { CircleAlertIcon, InfoIcon, PackageCheckIcon } from "lucide-react"

import { PurchaseChannelBadge } from "@/components/purchases/purchase-status-badge"
import { formatLkr } from "@/lib/courses-data"
import {
  PURCHASE_MOCK_NOW,
  handoverStaff,
  purchaseStaffFormOptions,
  type ContentPurchaseRecord,
} from "@/lib/purchases-data"
import { formatDateTime, getInitials } from "@/lib/students-data"

type PurchaseHandoverDialogProps = {
  open: boolean
  purchase: ContentPurchaseRecord | null
  onOpenChange: (open: boolean) => void
  onConfirm: (
    purchase: ContentPurchaseRecord,
    staffId: string,
    staffName: string,
    date: string
  ) => void
}

export function PurchaseHandoverDialog({
  open,
  purchase,
  onOpenChange,
  onConfirm,
}: PurchaseHandoverDialogProps) {
  const [staffId, setStaffId] = useState("")
  const [date, setDate] = useState(PURCHASE_MOCK_NOW.slice(0, 10))
  const [errors, setErrors] = useState<{ staff?: string; date?: string }>({})

  useEffect(() => {
    if (!open) return
    setStaffId("")
    setErrors({})
    setDate(PURCHASE_MOCK_NOW.slice(0, 10))
  }, [open, purchase])

  function handleConfirm() {
    if (!purchase) return
    const nextErrors: { staff?: string; date?: string } = {}
    const staff = handoverStaffOption(staffId)

    if (!staff) nextErrors.staff = "Choose the staff member handing over."
    if (!date) {
      nextErrors.date = "Enter the handover date."
    } else if (date < purchase.purchasedAt.slice(0, 10)) {
      nextErrors.date = "The handover date cannot be before the purchase date."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    onConfirm(purchase, staffId, staff!.name, date)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheckIcon className="size-4" aria-hidden="true" />
            Hand over book
          </DialogTitle>
          <DialogDescription>
            Record who handed the physical book over and when. This is a
            handover preview only.
          </DialogDescription>
        </DialogHeader>

        {purchase ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <span className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {getInitials(purchase.studentName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">
                    {purchase.studentName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {purchase.studentNo} · {purchase.branchName}
                  </span>
                </span>
              </span>
              <PurchaseChannelBadge channel={purchase.channel} />
            </div>

            <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
              <span className="text-sm font-medium">
                {purchase.contentTitle}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatLkr(purchase.price)} · purchased{" "}
                {formatDateTime(purchase.purchasedAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="handover-staff">
                  Handed over by
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Select
                  items={purchaseStaffFormOptions}
                  value={staffId}
                  onValueChange={(value) => setStaffId(value ?? "")}
                >
                  <SelectTrigger
                    id="handover-staff"
                    className="w-full"
                    aria-invalid={errors.staff ? true : undefined}
                  >
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseStaffFormOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.staff ? (
                  <p className="text-xs text-destructive">{errors.staff}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="handover-date">
                  Handover date
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id="handover-date"
                  type="date"
                  value={date}
                  min={purchase.purchasedAt.slice(0, 10)}
                  onChange={(event) => setDate(event.target.value)}
                  aria-invalid={errors.date ? true : undefined}
                />
                {errors.date ? (
                  <p className="text-xs text-destructive">{errors.date}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Only a paid physical book can be handed over. Handover records a
                staff member and date; it does not change the payment or access
                state.
              </span>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-600/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <CircleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                Local demo only. The handover and staff/date are not saved.
              </span>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!purchase}>
            Confirm handover (demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function handoverStaffOption(staffId: string) {
  return handoverStaff.find((staff) => staff.id === staffId)
}
