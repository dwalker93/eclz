import { asc, eq, sql } from "drizzle-orm";
import { invoice, invoiceInstallment, paymentAllocation } from "../schema";
import { deriveInstallmentStatus, deriveInvoiceStatus, waterfall, type InstallmentStatus, type InvoiceStatus } from "./allocation";
import { fromCents, toCents } from "./money";
import type { Tx } from "./types";

/**
 * E1, E16: re-derives an invoice's cached amount_paid and status, and its installments' balances and statuses,
 * from the active allocations. Call it in the same transaction as any allocation change, with the invoice row locked.
 */
export async function refreshInvoiceCaches(tx: Tx, invoiceId: string): Promise<void> {
  const [inv] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId));
  if (!inv) throw new Error(`invoice ${invoiceId} not found`);
  const [sum] = await tx
    .select({ paid: sql<string>`coalesce(sum(${paymentAllocation.amount}), 0)::text` })
    .from(paymentAllocation)
    .where(sql`${paymentAllocation.invoiceId} = ${invoiceId} AND ${paymentAllocation.reversedAt} IS NULL`);
  const paid = toCents(sum!.paid);
  const status = deriveInvoiceStatus(inv.status as InvoiceStatus, toCents(inv.total), paid);
  await tx.update(invoice).set({ amountPaid: fromCents(paid), status }).where(eq(invoice.id, invoiceId));

  const installments = await tx
    .select()
    .from(invoiceInstallment)
    .where(eq(invoiceInstallment.invoiceId, invoiceId))
    .orderBy(asc(invoiceInstallment.seq));
  if (installments.length === 0) return;
  const parts = waterfall(installments.map((i) => toCents(i.amount)), paid);
  for (const [index, inst] of installments.entries()) {
    const part = parts[index]!;
    await tx
      .update(invoiceInstallment)
      .set({
        amountPaid: fromCents(part),
        status: deriveInstallmentStatus(inst.status as InstallmentStatus, toCents(inst.amount), part),
      })
      .where(eq(invoiceInstallment.id, inst.id));
  }
}
