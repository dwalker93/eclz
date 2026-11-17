/**
 * Pure payment arithmetic: no database. Everything is in integer cents.
 */

export interface ItemWeight {
  id: string;
  /** The item's net outstanding amount in cents (D23). */
  weight: number;
}

/**
 * Splits `amount` across items pro rata to their weights with largest-remainder rounding to the cent (E7).
 * The result never gives an item more than its weight when amount <= sum of weights. Ties go to the earlier item.
 */
export function splitProRata(amount: number, items: ItemWeight[]): { id: string; cents: number }[] {
  const live = items.filter((i) => i.weight > 0);
  const total = live.reduce((s, i) => s + i.weight, 0);
  if (amount < 0) throw new Error("amount must not be negative");
  if (amount > total) throw new Error("amount exceeds the total weight");
  if (amount === 0 || total === 0) return [];
  const A = BigInt(amount);
  const T = BigInt(total);
  const parts = live.map((i, index) => {
    const exact = A * BigInt(i.weight);
    return { id: i.id, index, cents: Number(exact / T), remainder: exact % T };
  });
  let left = amount - parts.reduce((s, p) => s + p.cents, 0);
  const byRemainder = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const p of byRemainder) {
    if (left <= 0) break;
    p.cents += 1;
    left -= 1;
  }
  return parts.filter((p) => p.cents > 0).map((p) => ({ id: p.id, cents: p.cents }));
}

export interface PlanInvoice {
  invoiceId: string;
  issuedOn: string;
  dueDate: string;
  items: ItemWeight[];
}

export interface PlannedAllocation {
  invoiceId: string;
  invoiceItemId: string;
  cents: number;
}

/**
 * The default split (E7): fill the selected invoices oldest due date first (then issue date, then id), and inside an invoice
 * split the money across payable items pro rata to their net outstanding. Returns what could not be placed, which must be zero
 * for a payment to be verified (E4).
 */
export function planAllocation(amount: number, invoices: PlanInvoice[]): { allocations: PlannedAllocation[]; unallocated: number } {
  const ordered = [...invoices].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.issuedOn.localeCompare(b.issuedOn) || a.invoiceId.localeCompare(b.invoiceId),
  );
  let remaining = amount;
  const allocations: PlannedAllocation[] = [];
  for (const inv of ordered) {
    if (remaining <= 0) break;
    const outstanding = inv.items.reduce((s, i) => s + Math.max(i.weight, 0), 0);
    const take = Math.min(remaining, outstanding);
    if (take <= 0) continue;
    for (const part of splitProRata(take, inv.items)) {
      allocations.push({ invoiceId: inv.invoiceId, invoiceItemId: part.id, cents: part.cents });
    }
    remaining -= take;
  }
  return { allocations, unallocated: remaining };
}

/** E16: applies the invoice's total allocated amount to its installments in sequence order. */
export function waterfall(installmentAmounts: number[], paid: number): number[] {
  let left = paid;
  return installmentAmounts.map((amount) => {
    const part = Math.max(Math.min(left, amount), 0);
    left -= part;
    return part;
  });
}

export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue" | "waived" | "cancelled";

/**
 * Cache status after allocations change. Cancelled and waived invoices never change here. An invoice that was overdue
 * and is still unpaid stays overdue, because the overdue job owns that transition (grace days, C9). The job also turns
 * it back to pending or partial after a void if the due date is no longer passed.
 */
export function deriveInvoiceStatus(previous: InvoiceStatus, total: number, paid: number): InvoiceStatus {
  if (previous === "cancelled" || previous === "waived") return previous;
  if (paid >= total) return "paid";
  if (previous === "overdue") return "overdue";
  return paid > 0 ? "partial" : "pending";
}

export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue";

export function deriveInstallmentStatus(previous: InstallmentStatus, amount: number, paid: number): InstallmentStatus {
  if (paid >= amount) return "paid";
  if (previous === "overdue") return "overdue";
  return paid > 0 ? "partial" : "pending";
}
