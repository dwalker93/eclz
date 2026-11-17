import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { SearchIcon } from "lucide-react"

import {
  paymentBranchFilterOptions,
  paymentMethodFilterOptions,
  paymentStudentFilterOptions,
} from "@/lib/payments-data"

type PaymentFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  branch: string
  onBranchChange: (value: string) => void
  method: string
  onMethodChange: (value: string) => void
  student: string
  onStudentChange: (value: string) => void
  submittedFrom: string
  onSubmittedFromChange: (value: string) => void
  submittedTo: string
  onSubmittedToChange: (value: string) => void
  hasActiveFilters: boolean
  onReset: () => void
}

export function PaymentFilters({
  search,
  onSearchChange,
  branch,
  onBranchChange,
  method,
  onMethodChange,
  student,
  onStudentChange,
  submittedFrom,
  onSubmittedFromChange,
  submittedTo,
  onSubmittedToChange,
  hasActiveFilters,
  onReset,
}: PaymentFiltersProps) {
  return (
    <Card className="gap-0 py-4">
      <div className="flex flex-col gap-3 px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Filters</span>
            <span className="text-xs text-muted-foreground">
              Narrow the current status tab by branch, method, student or
              submitted date.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            Reset
          </Button>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search reference, student, gateway ref or invoice"
              aria-label="Search payments"
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="payments-submitted-from"
                className="text-xs text-muted-foreground"
              >
                Submitted from
              </Label>
              <Input
                id="payments-submitted-from"
                type="date"
                value={submittedFrom}
                onChange={(event) => onSubmittedFromChange(event.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="payments-submitted-to"
                className="text-xs text-muted-foreground"
              >
                Submitted to
              </Label>
              <Input
                id="payments-submitted-to"
                type="date"
                value={submittedTo}
                onChange={(event) => onSubmittedToChange(event.target.value)}
                className="w-full sm:w-40"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            items={paymentBranchFilterOptions}
            value={branch}
            onValueChange={(value) => onBranchChange(value ?? "all")}
          >
            <SelectTrigger className="w-full" aria-label="Filter by branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentBranchFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={paymentMethodFilterOptions}
            value={method}
            onValueChange={(value) => onMethodChange(value ?? "all")}
          >
            <SelectTrigger className="w-full" aria-label="Filter by method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={paymentStudentFilterOptions}
            value={student}
            onValueChange={(value) => onStudentChange(value ?? "all")}
          >
            <SelectTrigger className="w-full" aria-label="Filter by student">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentStudentFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  )
}
