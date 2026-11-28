import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  academicTerm,
  contentPurchase,
  course,
  enrollment,
  feeException,
  feeStructure,
  invoice,
  invoiceInstallment,
  invoiceItem,
  paymentAllocation,
  student,
} from "@workspace/db/schema";
import { writeAudit, isConstraintError } from "./audit";
import {
  addDays,
  discountCents,
  monthlyPeriods,
  respreadInstallments,
  type Period,
  type ScheduledInstallment,
} from "./dates";
import { refreshInvoiceCaches } from "./invoices";
import { gradeOn, loadOrganization, rateFor, todayFor } from "./lookups";
import { fromCents, toCents } from "@workspace/db/money";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

export interface DraftItem {
  kind: "recurring_fee" | "package_fee" | "content" | "adjustment" | "discount";
  cents: number;
  description?: string;
  enrollmentId?: string;
  feeStructureId?: string;
  gradeLevelId?: string | null;
  periodStart?: string;
  periodEnd?: string;
  /** Index of the earlier draft item this discount or negative adjustment applies to (D23). */
  appliesToIndex?: number;
  feeExceptionId?: string;
  /** Content items point at the purchase they bill (D13). */
  contentPurchaseId?: string;
}

/**
 * Inserts an invoice with its final totals (D8), then its items, then its installments. Totals: total is the sum of all signed items,
 * discount_total minus the sum of discount items, subtotal = total + discount_total. A zero total is stored as `waived` (D9, D19).
 */
export async function insertInvoice(
  tx: Tx,
  o: {
    studentId: string;
    branchId: string;
    issuedOn: string;
    dueDate: string;
    items: DraftItem[];
    installmentOptionId?: string | null;
    installments?: ScheduledInstallment[];
    /** Runs after the invoice row exists and before its items, for links the items' foreign keys need (a content purchase's invoice). */
    afterHeader?: (invoiceId: string) => Promise<void>;
  },
) {
  const total = o.items.reduce((s, i) => s + i.cents, 0);
  const discountTotal = -o.items.filter((i) => i.kind === "discount").reduce((s, i) => s + i.cents, 0);
  const [inv] = await tx
    .insert(invoice)
    .values({
      studentId: o.studentId,
      branchId: o.branchId,
      issuedOn: o.issuedOn,
      dueDate: o.dueDate,
      installmentOptionId: o.installmentOptionId ?? null,
      subtotal: fromCents(total + discountTotal),
      discountTotal: fromCents(discountTotal),
      total: fromCents(total),
      status: total === 0 ? "waived" : "pending",
    })
    .returning();
  await o.afterHeader?.(inv!.id);
  const ids: string[] = [];
  for (const it of o.items) {
    const [row] = await tx
      .insert(invoiceItem)
      .values({
        invoiceId: inv!.id,
        kind: it.kind,
        description: it.description ?? null,
        amount: fromCents(it.cents),
        enrollmentId: it.enrollmentId ?? null,
        feeStructureId: it.feeStructureId ?? null,
        gradeLevelId: it.gradeLevelId ?? null,
        periodStart: it.periodStart ?? null,
        periodEnd: it.periodEnd ?? null,
        appliesToItemId: it.appliesToIndex === undefined ? null : ids[it.appliesToIndex]!,
        feeExceptionId: it.feeExceptionId ?? null,
        contentPurchaseId: it.contentPurchaseId ?? null,
      })
      .returning();
    ids.push(row!.id);
  }
  if (o.installments?.length) {
    await tx
      .insert(invoiceInstallment)
      .values(o.installments.map((i) => ({ invoiceId: inv!.id, seq: i.seq, dueDate: i.dueDate, amount: fromCents(i.cents) })));
  }
  return { invoice: inv!, itemIds: ids };
}

/** The enrolments recurring invoices may be generated for: active, or completed by a promotion. */
function billableEnrollment() {
  return or(eq(enrollment.status, "active"), and(eq(enrollment.status, "completed"), eq(enrollment.endReason, "promoted")))!;
}

/**
 * Removes the planned fee lines that are no longer billable and, with each, the discount line linked to it, then renumbers the links between lines.
 * `drop` is asked about fee lines only.
 */
function pruneDraft(items: DraftItem[], drop: (fee: DraftItem) => boolean): DraftItem[] {
  const keepFee = items.map((i) => i.kind !== "recurring_fee" || !drop(i));
  const keep = items.map((i, k) => (i.appliesToIndex !== undefined ? keepFee[i.appliesToIndex]! : keepFee[k]!));
  const newIndex = new Map<number, number>();
  const next: DraftItem[] = [];
  items.forEach((i, k) => {
    if (!keep[k]) return;
    newIndex.set(k, next.length);
    next.push({ ...i, appliesToIndex: i.appliesToIndex === undefined ? undefined : newIndex.get(i.appliesToIndex) });
  });
  return next;
}

export interface GenerateOptions {
  branchId?: string;
  enrollmentIds?: string[];
  /** Days after the period start that the invoice is due. Never earlier than the issue date. Default 7. */
  dueAfterDays?: number;
  /** Bill a period this many days before it starts. Default 0. */
  leadDays?: number;
  /** Most periods one enrolment can catch up in one run, oldest first. Default 12. */
  maxPeriodsPerEnrollment?: number;
}

export interface GenerationReport {
  asOf: string;
  invoicesCreated: { invoiceId: string; studentId: string; branchId: string; periodStarts: string[] }[];
  alreadyInvoiced: number;
  /** D6: nothing is billed for these, and an admin should be alerted. */
  failures: { enrollmentId: string; periodStart: string | null; code: string; message: string }[];
}

type DraftGroup = { studentId: string; branchId: string; dueDate: string; items: DraftItem[]; periodStarts: string[] };

export function createInvoicingService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function activeException(tx: Tx, enrollmentId: string, kind: "alternate_option" | "discount", date: string) {
    const rows = await tx
      .select()
      .from(feeException)
      .where(
        and(
          eq(feeException.enrollmentId, enrollmentId),
          eq(feeException.kind, kind),
          sql`${feeException.effectiveFrom} <= ${date} AND (${feeException.effectiveTo} IS NULL OR ${feeException.effectiveTo} > ${date})`,
        ),
      );
    return rows[0] ?? null;
  }

  return {
    /**
     * D7, D6, D17 to D20, D24: creates the recurring fee invoices that are due. Idempotent: periods that already have an active
     * recurring item are skipped, so it is safe to run daily or twice. One invoice per student, branch and due date.
     */
    async generateRecurringInvoices(g: GenerateOptions = {}): Promise<GenerationReport> {
      const dueAfter = g.dueAfterDays ?? 7;
      const lead = g.leadDays ?? 0;
      const maxPeriods = g.maxPeriodsPerEnrollment ?? 12;
      const failures: GenerationReport["failures"] = [];
      let alreadyInvoiced = 0;

      const { today, groups } = await db.transaction(async (tx) => {
        const today = await todayFor(tx, now());
        const upTo = addDays(today, lead);
        // Active enrolments, and completed ones only when the completion was a promotion (the old class is billed up to its access end). Dropped, transferred and
        // course-ended enrolments are never billed here, whatever their access end says.
        const conds = [billableEnrollment(), sql`${enrollment.feeStructureId} IS NOT NULL`, eq(feeStructure.billingType, "recurring")];
        if (g.branchId) conds.push(eq(course.branchId, g.branchId));
        if (g.enrollmentIds) {
          if (g.enrollmentIds.length === 0) return { today, groups: new Map<string, DraftGroup>() };
          conds.push(inArray(enrollment.id, g.enrollmentIds));
        }
        const rows = await tx
          .select({ enr: enrollment, course, structure: feeStructure })
          .from(enrollment)
          .innerJoin(course, eq(course.id, enrollment.courseId))
          .innerJoin(feeStructure, eq(feeStructure.id, enrollment.feeStructureId))
          .where(and(...conds))
          .orderBy(asc(enrollment.id));

        const groups = new Map<string, DraftGroup>();
        for (const { enr, course: c, structure } of rows) {
          let periods: Period[];
          if (structure.frequency === "per_term") {
            if (!c.termId) {
              failures.push({ enrollmentId: enr.id, periodStart: null, code: "invalid_input", message: "A per-term fee needs the course to have a term." });
              continue;
            }
            const [term] = await tx.select().from(academicTerm).where(eq(academicTerm.id, c.termId));
            periods = term ? [{ start: term.startsOn, end: addDays(term.endsOn, 1) }] : [];
            periods = periods.filter((p) => p.start <= upTo);
          } else {
            periods = monthlyPeriods(enr.accessStartsOn, upTo);
          }
          periods = periods.filter((p) => !enr.accessEndsOn || p.start < enr.accessEndsOn);
          if (periods.length === 0) continue;

          const billed = await tx
            .select({ periodStart: invoiceItem.periodStart })
            .from(invoiceItem)
            .where(and(eq(invoiceItem.enrollmentId, enr.id), eq(invoiceItem.kind, "recurring_fee"), isNull(invoiceItem.cancelledAt)));
          const billedSet = new Set(billed.map((b) => b.periodStart));
          const missing = periods.filter((p) => !billedSet.has(p.start));
          alreadyInvoiced += periods.length - missing.length;

          for (const period of missing.slice(0, maxPeriods)) {
            // D20: an active alternate option replaces the structure for this period.
            const alt = await activeException(tx, enr.id, "alternate_option", period.start);
            let used = structure;
            if (alt?.alternateFeeStructureId) {
              const [s] = await tx.select().from(feeStructure).where(eq(feeStructure.id, alt.alternateFeeStructureId));
              if (s) used = s;
            }
            if (used.billingType !== "recurring") {
              failures.push({ enrollmentId: enr.id, periodStart: period.start, code: "fee_structure_invalid", message: "The alternate fee option is not a recurring fee." });
              continue;
            }
            if (used.frequency !== structure.frequency) {
              failures.push({ enrollmentId: enr.id, periodStart: period.start, code: "fee_structure_invalid", message: "The alternate fee option bills on a different cycle than the enrolled option. Nothing was billed." });
              continue;
            }
            const gradeId = enr.billingGradeLevelId ?? (await gradeOn(tx, enr.studentId, period.start));
            const rate = await rateFor(tx, used.id, gradeId, period.start);
            if (rate === null) {
              failures.push({ enrollmentId: enr.id, periodStart: period.start, code: "rate_missing", message: `No fee rate for ${used.name} on ${period.start}. Nothing was billed.` });
              continue;
            }
            const base = toCents(rate);
            const due = [addDays(period.start, dueAfter), today].sort().reverse()[0]!;
            const key = `${enr.studentId}|${c.branchId}|${due}`;
            const grp = groups.get(key) ?? { studentId: enr.studentId, branchId: c.branchId, dueDate: due, items: [], periodStarts: [] };
            const feeIndex = grp.items.length;
            grp.items.push({
              kind: "recurring_fee",
              cents: base,
              enrollmentId: enr.id,
              feeStructureId: used.id,
              gradeLevelId: gradeId,
              periodStart: period.start,
              periodEnd: period.end,
            });
            // D19: a discount is its own negative line, linked to the fee line and the exception.
            const disc = await activeException(tx, enr.id, "discount", period.start);
            if (disc?.discountType && disc.discountValue !== null) {
              const off = discountCents(base, disc.discountType as "percent" | "fixed", disc.discountValue);
              if (off > 0) {
                grp.items.push({ kind: "discount", cents: -off, description: `Discount: ${disc.reason}`, appliesToIndex: feeIndex, enrollmentId: enr.id, feeExceptionId: disc.id });
              }
            }
            grp.periodStarts.push(period.start);
            groups.set(key, grp);
          }
        }
        return { today, groups };
      });

      const invoicesCreated: GenerationReport["invoicesCreated"] = [];
      for (const grp of groups.values()) {
        let items = grp.items;
        // Another run may bill some of this group's periods first. The group's transaction then rolls back whole, so drop the periods that are now
        // billed (counting them as already invoiced) and insert the rest, instead of treating the whole group as billed.
        for (let attempt = 0; ; attempt++) {
          try {
            const done = await db.transaction(async (tx) => {
              // The plan was made in an earlier transaction. An enrolment may have ended since (a promotion confirmed, a drop, a new access end), so each
              // planned period is checked against the enrolment as it is now, and its rows are locked FOR SHARE so they cannot change before the insert commits.
              const ids = [...new Set(items.filter((i) => i.kind === "recurring_fee").map((i) => i.enrollmentId!))].sort();
              const current = new Map(
                (await tx.select().from(enrollment).where(and(inArray(enrollment.id, ids), billableEnrollment())).orderBy(asc(enrollment.id)).for("share")).map((e) => [e.id, e]),
              );
              // Rows of enrolments that are no longer billable are not in `current`, and the lock above does not cover them: they stay excluded either way.
              const live = pruneDraft(items, (fee) => {
                const e = current.get(fee.enrollmentId!);
                return !e || (e.accessEndsOn !== null && fee.periodStart! >= e.accessEndsOn);
              });
              if (live.length === 0) return null;
              const created = await insertInvoice(tx, { studentId: grp.studentId, branchId: grp.branchId, issuedOn: today, dueDate: grp.dueDate, items: live });
              return { created, live };
            });
            if (!done) break;
            invoicesCreated.push({
              invoiceId: done.created.invoice.id,
              studentId: grp.studentId,
              branchId: grp.branchId,
              periodStarts: done.live.filter((i) => i.kind === "recurring_fee").map((i) => i.periodStart!),
            });
            break;
          } catch (err) {
            if (!isConstraintError(err, "invoice_item_recurring_uq") || attempt >= 3) throw err;
            const billed = await db
              .select({ enrollmentId: invoiceItem.enrollmentId, periodStart: invoiceItem.periodStart })
              .from(invoiceItem)
              .where(
                and(
                  inArray(invoiceItem.enrollmentId, [...new Set(items.filter((i) => i.kind === "recurring_fee").map((i) => i.enrollmentId!))]),
                  eq(invoiceItem.kind, "recurring_fee"),
                  isNull(invoiceItem.cancelledAt),
                ),
              );
            const billedKeys = new Set(billed.map((b) => `${b.enrollmentId}|${b.periodStart}`));
            const dropped = items.filter((i) => i.kind === "recurring_fee" && billedKeys.has(`${i.enrollmentId}|${i.periodStart}`)).length;
            if (dropped === 0) throw err; // nothing explains the conflict: do not loop
            alreadyInvoiced += dropped;
            // A discount goes with its fee line, and the links between lines are renumbered.
            const next = pruneDraft(items, (fee) => billedKeys.has(`${fee.enrollmentId}|${fee.periodStart}`));
            if (next.length === 0) break;
            items = next;
          }
        }
      }
      return { asOf: today, invoicesCreated, alreadyInvoiced, failures };
    },

    /**
     * D8, D23, D25, D26: adds an adjustment or discount line to an issued invoice. Existing lines never change. Unpaid installments are
     * re-spread so they still add up to the total, and a change that would put the total below what is already paid is refused.
     */
    async addInvoiceLine(input: {
      invoiceId: string;
      kind: "adjustment" | "discount";
      /** Signed money string. Discounts are negative. */
      amount: string;
      appliesToItemId?: string | null;
      description: string;
      createdBy: string;
      reason: string;
    }) {
      if (!input.reason.trim()) throw new ServiceError("reason_required", "A reason is required.");
      const cents = toCents(input.amount);
      if (cents === 0) throw new ServiceError("invalid_input", "The amount cannot be zero.");
      if (input.kind === "discount" && cents > 0) throw new ServiceError("invalid_input", "A discount must be a negative amount.");
      if (cents < 0 && !input.appliesToItemId) {
        throw new ServiceError("invalid_input", "A discount or negative adjustment must name the item it applies to.");
      }
      return db.transaction(async (tx) => {
        const [inv] = await tx.select().from(invoice).where(eq(invoice.id, input.invoiceId)).for("update");
        if (!inv) throw new ServiceError("not_found", "Invoice not found.");
        if (inv.status === "cancelled") throw new ServiceError("invoice_not_adjustable", "A cancelled invoice cannot be changed.");
        const items = await tx.select().from(invoiceItem).where(and(eq(invoiceItem.invoiceId, inv.id), isNull(invoiceItem.cancelledAt)));

        if (input.appliesToItemId) {
          const target = items.find((i) => i.id === input.appliesToItemId);
          const payable = target && ["recurring_fee", "package_fee", "content", "adjustment"].includes(target.kind) && toCents(target.amount) > 0;
          if (!target || !payable) throw new ServiceError("invalid_input", "The item it applies to is not on this invoice or cannot be reduced.");
          const applied = items.filter((i) => i.appliesToItemId === target.id).reduce((s, i) => s + toCents(i.amount), 0);
          const [alloc] = await tx
            .select({ total: sql<string>`coalesce(sum(${paymentAllocation.amount}), 0)::text` })
            .from(paymentAllocation)
            .where(and(eq(paymentAllocation.invoiceItemId, target.id), isNull(paymentAllocation.reversedAt)));
          const netAfter = toCents(target.amount) + applied + cents;
          if (netAfter < 0) throw new ServiceError("invalid_input", "The reduction is larger than the item's amount.");
          if (netAfter < toCents(alloc!.total)) {
            throw new ServiceError("total_below_paid", "That would put the item below the amount already paid on it.");
          }
        }
        const newTotal = items.reduce((s, i) => s + toCents(i.amount), 0) + cents;
        if (newTotal < toCents(inv.amountPaid)) {
          throw new ServiceError("total_below_paid", "That would put the invoice total below what has already been paid.");
        }

        const [line] = await tx
          .insert(invoiceItem)
          .values({
            invoiceId: inv.id,
            kind: input.kind,
            description: input.description,
            amount: fromCents(cents),
            appliesToItemId: input.appliesToItemId ?? null,
          })
          .returning();

        const all = [...items, line!];
        const total = all.reduce((s, i) => s + toCents(i.amount), 0);
        const discountTotal = -all.filter((i) => i.kind === "discount").reduce((s, i) => s + toCents(i.amount), 0);
        const status = total === 0 ? "waived" : inv.status === "waived" ? "pending" : inv.status;
        await tx
          .update(invoice)
          .set({ subtotal: fromCents(total + discountTotal), discountTotal: fromCents(discountTotal), total: fromCents(total), status })
          .where(eq(invoice.id, inv.id));

        // D25: paid installments stay as they are, and the unpaid ones share what remains.
        const installments = await tx.select().from(invoiceInstallment).where(eq(invoiceInstallment.invoiceId, inv.id)).orderBy(asc(invoiceInstallment.seq));
        if (installments.length > 0) {
          const settled = installments.filter((i) => toCents(i.amountPaid) >= toCents(i.amount));
          const open = installments.filter((i) => toCents(i.amountPaid) < toCents(i.amount));
          const remaining = total - settled.reduce((s, i) => s + toCents(i.amount), 0);
          if (remaining < 0) throw new ServiceError("total_below_paid", "That would put the total below the installments already paid.");
          if (open.length === 0 && remaining > 0) {
            // Every installment is paid and the invoice grew: the new balance gets its own installment, so the schedule still adds up to the total.
            const last = installments[installments.length - 1]!;
            const today = await todayFor(tx, now());
            const due = [last.dueDate, addDays(today, 7)].sort().reverse()[0]!;
            await tx.insert(invoiceInstallment).values({ invoiceId: inv.id, seq: last.seq + 1, dueDate: due, amount: fromCents(remaining) });
          }
          if (open.length > 0) {
            if (remaining === 0) {
              await tx.delete(invoiceInstallment).where(inArray(invoiceInstallment.id, open.map((i) => i.id)));
            } else {
              if (remaining < open.length) throw new ServiceError("invalid_input", "The remaining amount is too small to spread over the unpaid installments.");
              const parts = respreadInstallments(remaining, open.length);
              for (const [index, inst] of open.entries()) {
                await tx.update(invoiceInstallment).set({ amount: fromCents(parts[index]!), amountPaid: "0" }).where(eq(invoiceInstallment.id, inst.id));
              }
            }
          }
        }
        await refreshInvoiceCaches(tx, inv.id);
        await writeAudit(tx, {
          actor: input.createdBy,
          action: `invoice.add_${input.kind}`,
          entityType: "invoice",
          entityId: inv.id,
          before: { total: inv.total },
          after: { total: fromCents(total), line: { id: line!.id, amount: line!.amount } },
          reason: input.reason.trim(),
        });
        const [updated] = await tx.select().from(invoice).where(eq(invoice.id, inv.id));
        return { invoice: updated!, line: line! };
      });
    },

    /**
     * D26: cancels an invoice that has no active payments. Its items are stamped cancelled (so recurring periods can be regenerated),
     * and pending content purchases on it are cancelled too.
     */
    async cancelInvoice(input: { invoiceId: string; cancelledBy: string; reason: string }) {
      if (!input.reason.trim()) throw new ServiceError("reason_required", "A reason is required.");
      return db.transaction(async (tx) => {
        const [inv] = await tx.select().from(invoice).where(eq(invoice.id, input.invoiceId)).for("update");
        if (!inv) throw new ServiceError("not_found", "Invoice not found.");
        if (inv.status === "cancelled") return inv;
        const [active] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(paymentAllocation)
          .where(and(eq(paymentAllocation.invoiceId, inv.id), isNull(paymentAllocation.reversedAt)));
        if (active!.n > 0) throw new ServiceError("invoice_has_payments", "An invoice with payments cannot be cancelled. Adjust it instead.");
        const at = now();
        const items = await tx
          .update(invoiceItem)
          .set({ cancelledAt: at })
          .where(and(eq(invoiceItem.invoiceId, inv.id), isNull(invoiceItem.cancelledAt)))
          .returning();
        const purchaseIds = items.map((i) => i.contentPurchaseId).filter((x): x is string => !!x);
        if (purchaseIds.length > 0) {
          await tx.update(contentPurchase).set({ status: "cancelled" }).where(and(inArray(contentPurchase.id, purchaseIds), eq(contentPurchase.status, "pending")));
        }
        const [row] = await tx.update(invoice).set({ status: "cancelled" }).where(eq(invoice.id, inv.id)).returning();
        await writeAudit(tx, {
          actor: input.cancelledBy,
          action: "invoice.cancel",
          entityType: "invoice",
          entityId: inv.id,
          before: { status: inv.status },
          after: { status: "cancelled" },
          reason: input.reason.trim(),
        });
        return row!;
      });
    },
  };
}

export type InvoicingService = ReturnType<typeof createInvoicingService>;
