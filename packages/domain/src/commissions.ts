import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { commissionEntry, commissionRule, course, courseLecturer, enrollment, invoiceItem, paymentAllocation } from "@workspace/db/schema";
import { linkedTotals } from "./allocation";
import { percentOf } from "./dates";
import { loadOrganization, todayFor } from "./lookups";
import { fromCents, toCents } from "@workspace/db/money";
import type { VerifiedEvent, VoidedEvent } from "./payments";
import type { Tx } from "./types";

type Rule = typeof commissionRule.$inferSelect;

export interface RuleContext {
  courseId: string;
  subjectId: string;
  gradeLevelId: string | null;
  date: string;
}

/**
 * H4: the most specific rule in effect on the date wins. Course, then subject plus grade, then subject alone, then the lecturer default.
 * Overlaps of equal specificity cannot exist (exclusion constraint), so at most one rule matches each level.
 */
export function pickRule(rules: Rule[], ctx: RuleContext): Rule | null {
  const inEffect = rules.filter((r) => r.effectiveFrom <= ctx.date && (!r.effectiveTo || r.effectiveTo > ctx.date));
  const level = (r: Rule): number => {
    if (r.courseId) return r.courseId === ctx.courseId ? 4 : 0;
    if (r.subjectId && r.gradeLevelId) return r.subjectId === ctx.subjectId && r.gradeLevelId === ctx.gradeLevelId ? 3 : 0;
    if (r.subjectId) return r.subjectId === ctx.subjectId ? 2 : 0;
    return 1;
  };
  let best: Rule | null = null;
  let bestLevel = 0;
  for (const r of inEffect) {
    const l = level(r);
    if (l > bestLevel) {
      best = r;
      bestLevel = l;
    }
  }
  return best;
}

/** Splits `cents` by share percentages, largest remainder first, so equal shares summing to 100 add back to exactly `cents`. */
export function splitByShare(cents: number, shares: number[]): number[] {
  const total = shares.reduce((s, x) => s + x, 0);
  if (total <= 0) return shares.map(() => 0);
  const raw = shares.map((s) => (cents * s) / 100);
  const floors = raw.map(Math.floor);
  let left = Math.round(cents * Math.min(total, 100) / 100) - floors.reduce((s, x) => s + x, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    floors[o.i]!++;
    left--;
  }
  return floors;
}

export interface AccrualSummary {
  created: { entryId: string; lecturerId: string; base: string; commission: string; capped: boolean }[];
  /** Allocations that accrued nothing, with the reason, so an admin can find gaps (for example a missing rule). */
  skipped: { allocationId: string; lecturerId?: string; reason: "module_off" | "not_a_fee_item" | "no_lecturer" | "no_rule" | "no_net_amount" | "already_accrued" }[];
}

export interface ReversalSummary {
  voided: string[];
  reversed: { entryId: string; reversalId: string }[];
}

export function createCommissionService(opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function accrue(tx: Tx, event: Pick<VerifiedEvent, "allocations">): Promise<AccrualSummary> {
    const summary: AccrualSummary = { created: [], skipped: [] };
    const org = await loadOrganization(tx);
    if ((org.enabledModules as Record<string, boolean>)?.commissions !== true) {
      for (const a of event.allocations) summary.skipped.push({ allocationId: a.id, reason: "module_off" });
      return summary; // H9
    }
    const date = await todayFor(tx, now());

    for (const alloc of event.allocations) {
      const [item] = await tx.select().from(invoiceItem).where(eq(invoiceItem.id, alloc.invoiceItemId));
      if (!item || !["recurring_fee", "package_fee"].includes(item.kind) || !item.enrollmentId) {
        summary.skipped.push({ allocationId: alloc.id, reason: "not_a_fee_item" }); // H11
        continue;
      }
      const [enr] = await tx.select().from(enrollment).where(eq(enrollment.id, item.enrollmentId));
      const lecturers = await tx.select().from(courseLecturer).where(eq(courseLecturer.courseId, enr!.courseId));
      if (lecturers.length === 0) {
        summary.skipped.push({ allocationId: alloc.id, reason: "no_lecturer" });
        continue;
      }
      const [courseRow] = await tx.select({ subjectId: course.subjectId }).from(course).where(eq(course.id, enr!.courseId));

      // Net amount of the item after the discounts and reductions that apply to it.
      const list = toCents(item.amount);
      const invoiceLines = await tx
        .select({ id: invoiceItem.id, amount: invoiceItem.amount, appliesToItemId: invoiceItem.appliesToItemId })
        .from(invoiceItem)
        .where(and(eq(invoiceItem.invoiceId, item.invoiceId), isNull(invoiceItem.cancelledAt)));
      const net = list + (linkedTotals(invoiceLines.map((l) => ({ id: l.id, cents: toCents(l.amount), appliesToItemId: l.appliesToItemId }))).get(item.id) ?? 0);
      const allocated = toCents(alloc.amount);
      if (net <= 0) {
        summary.skipped.push({ allocationId: alloc.id, reason: "no_net_amount" });
        continue;
      }
      // H10: under `list` the institute absorbs the discount, so the allocation is scaled up to the list price.
      const adjusted = org.discountCommissionBasis === "list" ? Math.round((allocated * list) / net) : allocated;
      const bases = splitByShare(adjusted, lecturers.map((l) => Number(l.sharePercent)));

      const [cum] = await tx
        .select({ total: sql<string>`coalesce(sum(${paymentAllocation.amount}), 0)::text` })
        .from(paymentAllocation)
        .where(and(eq(paymentAllocation.invoiceItemId, item.id), isNull(paymentAllocation.reversedAt)));
      const itemFullyAllocated = toCents(cum!.total) >= net;

      for (const [idx, lec] of lecturers.entries()) {
        const existing = await tx
          .select({ id: commissionEntry.id })
          .from(commissionEntry)
          .where(
            and(
              eq(commissionEntry.paymentAllocationId, alloc.id),
              eq(commissionEntry.lecturerId, lec.lecturerId),
              eq(commissionEntry.entryType, "accrual"),
              ne(commissionEntry.status, "void"),
            ),
          );
        if (existing.length > 0) {
          summary.skipped.push({ allocationId: alloc.id, lecturerId: lec.lecturerId, reason: "already_accrued" });
          continue;
        }
        const rules = await tx.select().from(commissionRule).where(eq(commissionRule.lecturerId, lec.lecturerId));
        const rule = pickRule(rules, { courseId: enr!.courseId, subjectId: courseRow!.subjectId, gradeLevelId: item.gradeLevelId, date });
        if (!rule) {
          summary.skipped.push({ allocationId: alloc.id, lecturerId: lec.lecturerId, reason: "no_rule" });
          continue;
        }
        const base = bases[idx]!;
        let commission: number;
        if (rule.calcType === "percent") {
          commission = percentOf(base, rule.commissionRate); // H5
        } else {
          // H5: a fixed amount per student per month, split by share, accrued in proportion to what is paid.
          const entitled = Math.round((toCents(rule.commissionRate) * Number(lec.sharePercent)) / 100);
          const [prior] = await tx
            .select({ total: sql<string>`coalesce(sum(${commissionEntry.commissionAmount}), 0)::text` })
            .from(commissionEntry)
            .innerJoin(paymentAllocation, eq(paymentAllocation.id, commissionEntry.paymentAllocationId))
            .where(
              and(
                eq(paymentAllocation.invoiceItemId, item.id),
                eq(commissionEntry.lecturerId, lec.lecturerId),
                ne(commissionEntry.status, "void"),
              ),
            );
          const remaining = Math.max(entitled - toCents(prior!.total), 0);
          const proportional = Math.round((entitled * allocated) / net);
          // The last payment of the item takes whatever remains, so rounding never loses or adds a cent.
          commission = itemFullyAllocated ? remaining : Math.min(proportional, remaining);
        }
        // H12: never more than the base.
        const capped = commission > base;
        if (capped) commission = base;

        const [row] = await tx
          .insert(commissionEntry)
          .values({
            paymentAllocationId: alloc.id,
            ruleId: rule.id,
            lecturerId: lec.lecturerId,
            entryType: "accrual",
            calcTypeApplied: rule.calcType,
            rateApplied: rule.commissionRate,
            sharePercentApplied: lec.sharePercent,
            basisApplied: org.discountCommissionBasis,
            capped,
            baseAmount: fromCents(base),
            commissionAmount: fromCents(commission),
            teacherAmount: fromCents(base - commission),
          })
          .returning();
        summary.created.push({ entryId: row!.id, lecturerId: lec.lecturerId, base: row!.baseAmount, commission: row!.commissionAmount, capped });
      }
    }
    return summary;
  }

  /**
   * H7: voiding a payment. Unsettled accruals become `void`. Settled ones get a negative reversal entry that the next payout deducts.
   * Runs whether or not the module is still on, so earlier accruals are always unwound.
   */
  async function reverse(tx: Tx, event: Pick<VoidedEvent, "reversedAllocations">): Promise<ReversalSummary> {
    const summary: ReversalSummary = { voided: [], reversed: [] };
    const ids = event.reversedAllocations.map((a) => a.id);
    if (ids.length === 0) return summary;
    const entries = await tx
      .select()
      .from(commissionEntry)
      .where(and(inArray(commissionEntry.paymentAllocationId, ids), eq(commissionEntry.entryType, "accrual"), ne(commissionEntry.status, "void")));
    for (const e of entries) {
      if (e.status === "accrued") {
        await tx.update(commissionEntry).set({ status: "void" }).where(eq(commissionEntry.id, e.id));
        summary.voided.push(e.id);
        continue;
      }
      const [done] = await tx.select({ id: commissionEntry.id }).from(commissionEntry).where(eq(commissionEntry.reversesEntryId, e.id));
      if (done) continue;
      const [rev] = await tx
        .insert(commissionEntry)
        .values({
          paymentAllocationId: e.paymentAllocationId,
          ruleId: e.ruleId,
          lecturerId: e.lecturerId,
          reversesEntryId: e.id,
          entryType: "reversal",
          calcTypeApplied: e.calcTypeApplied,
          rateApplied: e.rateApplied,
          sharePercentApplied: e.sharePercentApplied,
          basisApplied: e.basisApplied,
          capped: e.capped,
          baseAmount: fromCents(-toCents(e.baseAmount)),
          commissionAmount: fromCents(-toCents(e.commissionAmount)),
          teacherAmount: fromCents(-toCents(e.teacherAmount)),
        })
        .returning();
      summary.reversed.push({ entryId: e.id, reversalId: rev!.id });
    }
    return summary;
  }

  return {
    accrue,
    reverse,
    /** Pass as `hooks` to createPaymentService so accrual runs inside the verification transaction. */
    hooks: {
      afterVerify: async (tx: Tx, event: VerifiedEvent) => void (await accrue(tx, event)),
      afterVoid: async (tx: Tx, event: VoidedEvent) => void (await reverse(tx, event)),
    },
  };
}
export type CommissionService = ReturnType<typeof createCommissionService>;

/** Runs several hook sets in order inside the same transaction. */
export function combineHooks(
  ...sets: { afterVerify?: (tx: Tx, e: VerifiedEvent) => Promise<void>; afterVoid?: (tx: Tx, e: VoidedEvent) => Promise<void> }[]
) {
  return {
    afterVerify: async (tx: Tx, e: VerifiedEvent) => {
      for (const s of sets) await s.afterVerify?.(tx, e);
    },
    afterVoid: async (tx: Tx, e: VoidedEvent) => {
      for (const s of sets) await s.afterVoid?.(tx, e);
    },
  };
}
