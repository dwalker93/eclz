import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { commissionEntry, file, lecturer, teacherPayout } from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { addDays, isCalendarDay, localDate } from "./dates";
import { loadOrganization, todayFor } from "./lookups";
import { fromCents, toCents } from "@workspace/db/money";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

type EntryRow = typeof commissionEntry.$inferSelect;
type PayoutRow = typeof teacherPayout.$inferSelect;


export interface PayoutTotals {
  /** Sum of the entries' base, in cents. */
  gross: number;
  /** Sum of the entries' commission (kept by the institute), in cents. */
  commission: number;
  /** Sum of the entries' teacher amount (owed to the teacher), in cents. */
  net: number;
  entryCount: number;
}

export type PayoutBlocker = "no_entries" | "net_not_positive";

/** Adds up entries (accruals and negative reversals) into payout totals. Pure. */
export function summarizeEntries(rows: Pick<EntryRow, "baseAmount" | "commissionAmount" | "teacherAmount">[]): PayoutTotals {
  let gross = 0;
  let commission = 0;
  let net = 0;
  for (const r of rows) {
    gross += toCents(r.baseAmount);
    commission += toCents(r.commissionAmount);
    net += toCents(r.teacherAmount);
  }
  return { gross, commission, net, entryCount: rows.length };
}

/**
 * H8: why a set of entries cannot become a payout yet, or null when it can. A payout needs a positive net. Gross and commission are signed sums
 * (a reversal can make either negative while the net stays positive), so only the net decides.
 */
export function payoutBlocker(t: PayoutTotals): PayoutBlocker | null {
  if (t.entryCount === 0) return "no_entries";
  if (t.net <= 0) return "net_not_positive";
  return null;
}

const money = (t: PayoutTotals) => ({ gross: fromCents(t.gross), commission: fromCents(t.commission), net: fromCents(t.net) });

export type CreatePayoutResult =
  | { status: "created"; payout: PayoutRow; entryIds: string[] }
  | { status: "carried_forward"; reason: PayoutBlocker; entryCount: number; gross: string; commission: string; net: string };

export interface CreatePayoutInput {
  lecturerId: string;
  /** Exclusive. Accrued entries created before the start of this day (organization time zone) are included. */
  periodEnd: string;
  /** Defaults to the end of the lecturer's previous payout, or the day of the oldest included entry. */
  periodStart?: string;
  createdBy: string;
}

export interface PreviewPayout {
  lecturerId: string;
  periodEnd: string | null;
  entryCount: number;
  gross: string;
  commission: string;
  net: string;
  /** Null when a payout could be created from these entries now. */
  blocker: PayoutBlocker | null;
}

async function requireCommissions(tx: Tx) {
  const org = await loadOrganization(tx);
  if ((org.enabledModules as Record<string, boolean>)?.commissions !== true) {
    throw new ServiceError("module_disabled", "Commissions are not switched on."); // H9
  }
  return org;
}

/** Accrued entries of a lecturer that no payout has taken yet, created before the end day. Carried-forward entries are therefore included. */
function eligibleWhere(lecturerId: string, periodEnd: string | null, timeZone: string) {
  const base = and(eq(commissionEntry.lecturerId, lecturerId), eq(commissionEntry.status, "accrued"), isNull(commissionEntry.payoutId));
  if (!periodEnd) return base;
  return and(base, sql`${commissionEntry.createdAt} < ((${periodEnd}::date)::timestamp AT TIME ZONE ${timeZone})`);
}

async function entriesOf(tx: Tx, payoutId: string): Promise<EntryRow[]> {
  return tx.select().from(commissionEntry).where(eq(commissionEntry.payoutId, payoutId)).orderBy(asc(commissionEntry.createdAt), asc(commissionEntry.id));
}

async function lockPayout(tx: Tx, payoutId: string): Promise<PayoutRow> {
  const [p] = await tx.select().from(teacherPayout).where(eq(teacherPayout.id, payoutId)).for("update");
  if (!p) throw new ServiceError("not_found", "Payout not found.");
  return p;
}

/** Re-adds a payout's entries and checks them against its cached totals (the transaction check the design asks for in H8). */
async function assertTotalsMatch(tx: Tx, payoutId: string) {
  const [p] = await tx.select().from(teacherPayout).where(eq(teacherPayout.id, payoutId));
  const t = summarizeEntries(await entriesOf(tx, payoutId));
  if (toCents(p!.grossCollected) !== t.gross || toCents(p!.commissionTotal) !== t.commission || toCents(p!.netPayable) !== t.net) {
    throw new Error(`payout ${payoutId} totals do not match its entries`);
  }
}

/**
 * Takes the negative reversals of a draft payout's own entries into the payout, then rebuilds its totals from its entries (H7, H8).
 * Throws payout_nothing_to_pay when what remains cannot be paid, which rolls the transaction back and leaves the draft as it was.
 */
async function refreshDraftTotals(tx: Tx, payout: PayoutRow): Promise<{ payout: PayoutRow; pulledReversals: number }> {
  const own = await entriesOf(tx, payout.id);
  const accrualIds = own.filter((e) => e.entryType === "accrual").map((e) => e.id);
  let pulled = 0;
  if (accrualIds.length > 0) {
    const pending = await tx
      .select({ id: commissionEntry.id })
      .from(commissionEntry)
      .where(
        and(
          inArray(commissionEntry.reversesEntryId, accrualIds),
          eq(commissionEntry.status, "accrued"),
          isNull(commissionEntry.payoutId),
          eq(commissionEntry.lecturerId, payout.lecturerId),
        ),
      )
      .for("update");
    if (pending.length > 0) {
      await tx
        .update(commissionEntry)
        .set({ status: "settled", payoutId: payout.id })
        .where(inArray(commissionEntry.id, pending.map((r) => r.id)));
      pulled = pending.length;
    }
  }
  const totals = summarizeEntries(await entriesOf(tx, payout.id));
  if (payoutBlocker(totals)) {
    throw new ServiceError(
      "payout_nothing_to_pay",
      "After a payment was voided there is nothing left to pay in this draft. Discard it and create a new one.",
    );
  }
  const [row] = await tx
    .update(teacherPayout)
    .set({ grossCollected: fromCents(totals.gross), commissionTotal: fromCents(totals.commission), netPayable: fromCents(totals.net) })
    .where(eq(teacherPayout.id, payout.id))
    .returning();
  await assertTotalsMatch(tx, payout.id);
  return { payout: row!, pulledReversals: pulled };
}

export function createPayoutService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  return {
    /**
     * H8, H9: a read-only look at what a payout would hold now. Use it for a "pending commission" screen.
     * Without `periodEnd` it covers every accrued entry of the lecturer.
     */
    async previewPayout(input: { lecturerId: string; periodEnd?: string | null }): Promise<PreviewPayout> {
      if (input.periodEnd && !isCalendarDay(input.periodEnd)) throw new ServiceError("invalid_input", "Dates must be real calendar days like 2027-03-31.");
      return db.transaction(async (tx) => {
        const org = await requireCommissions(tx);
        const rows = await tx.select().from(commissionEntry).where(eligibleWhere(input.lecturerId, input.periodEnd ?? null, org.timezone));
        const t = summarizeEntries(rows);
        return { lecturerId: input.lecturerId, periodEnd: input.periodEnd ?? null, entryCount: t.entryCount, ...money(t), blocker: payoutBlocker(t) };
      });
    },

    /**
     * H8: creates a draft payout from the lecturer's accrued entries (accruals and negative reversals) and marks them settled.
     * A payout is created only when the net is positive. Otherwise nothing is created and the entries stay accrued, so they carry
     * forward into the next payout (`status: "carried_forward"`). Entries from before the period start are included for the same reason.
     * Two payouts of one lecturer cannot have overlapping periods.
     */
    async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
      if (!isCalendarDay(input.periodEnd) || (input.periodStart && !isCalendarDay(input.periodStart))) {
        throw new ServiceError("invalid_input", "Dates must be real calendar days like 2027-03-31.");
      }
      return db.transaction(async (tx) => {
        const org = await requireCommissions(tx);
        const today = await todayFor(tx, now());
        if (input.periodEnd > addDays(today, 1)) {
          throw new ServiceError("payout_period_invalid", "A payout cannot cover days that have not happened yet.");
        }
        // One payout is built per lecturer at a time.
        const [lec] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.id, input.lecturerId)).for("update");
        if (!lec) throw new ServiceError("not_found", "Lecturer not found.");

        const rows = await tx
          .select()
          .from(commissionEntry)
          .where(eligibleWhere(input.lecturerId, input.periodEnd, org.timezone))
          .orderBy(asc(commissionEntry.createdAt), asc(commissionEntry.id))
          .for("update");
        const totals = summarizeEntries(rows);
        const blocker = payoutBlocker(totals);
        if (blocker) return { status: "carried_forward", reason: blocker, entryCount: totals.entryCount, ...money(totals) };

        let periodStart = input.periodStart;
        if (!periodStart) {
          const [prev] = await tx
            .select({ periodEnd: teacherPayout.periodEnd })
            .from(teacherPayout)
            .where(and(eq(teacherPayout.lecturerId, input.lecturerId), sql`${teacherPayout.periodEnd} <= ${input.periodEnd}`))
            .orderBy(desc(teacherPayout.periodEnd))
            .limit(1);
          periodStart = prev?.periodEnd ?? rows.map((r) => localDate(r.createdAt, org.timezone)).sort()[0]!;
        }
        if (periodStart >= input.periodEnd) {
          throw new ServiceError("payout_period_invalid", "The period must end after it starts. An earlier payout may already cover those days.");
        }
        const overlapping = await tx
          .select({ id: teacherPayout.id })
          .from(teacherPayout)
          .where(and(eq(teacherPayout.lecturerId, input.lecturerId), lt(teacherPayout.periodStart, input.periodEnd), gt(teacherPayout.periodEnd, periodStart)))
          .limit(1);
        if (overlapping.length > 0) {
          throw new ServiceError("payout_period_invalid", "This lecturer already has a payout covering part of those days.");
        }

        const [payout] = await tx
          .insert(teacherPayout)
          .values({
            lecturerId: input.lecturerId,
            periodStart,
            periodEnd: input.periodEnd,
            grossCollected: fromCents(totals.gross),
            commissionTotal: fromCents(totals.commission),
            netPayable: fromCents(totals.net),
          })
          .returning();
        const ids = rows.map((r) => r.id);
        await tx.update(commissionEntry).set({ status: "settled", payoutId: payout!.id }).where(inArray(commissionEntry.id, ids));
        await assertTotalsMatch(tx, payout!.id);
        await writeAudit(tx, {
          actor: input.createdBy,
          action: "payout.create",
          entityType: "teacher_payout",
          entityId: payout!.id,
          after: { ...payout, entryCount: ids.length },
        });
        return { status: "created", payout: payout!, entryIds: ids };
      });
    },

    /**
     * Rebuilds a draft's totals after payments were voided (H7, H8). Reversals of the draft's own entries join it, which takes those entries out of the payout.
     * Approval does this itself, so call it only to refresh a screen. Fails with payout_nothing_to_pay when nothing payable is left.
     */
    async refreshDraft(input: { payoutId: string }) {
      return db.transaction(async (tx) => {
        await requireCommissions(tx);
        const p = await lockPayout(tx, input.payoutId);
        if (p.status !== "draft") throw new ServiceError("payout_not_draft", "Only a draft payout can be refreshed.");
        return refreshDraftTotals(tx, p);
      });
    },

    /**
     * H8, J3: approves a draft. The totals are rebuilt first, and are fixed from here on: a payment voided later adds a reversal that is deducted
     * from the lecturer's next payout, never from this one, so the amount approved is the amount to transfer.
     */
    async approvePayout(input: { payoutId: string; approvedBy: string }) {
      return db.transaction(async (tx) => {
        await requireCommissions(tx);
        const p = await lockPayout(tx, input.payoutId);
        if (p.status !== "draft") throw new ServiceError("payout_not_draft", "Only a draft payout can be approved.");
        const { payout: fresh, pulledReversals } = await refreshDraftTotals(tx, p);
        const [row] = await tx
          .update(teacherPayout)
          .set({ status: "approved", approvedBy: input.approvedBy })
          .where(eq(teacherPayout.id, p.id))
          .returning();
        await writeAudit(tx, {
          actor: input.approvedBy,
          action: "payout.approve",
          entityType: "teacher_payout",
          entityId: p.id,
          before: { status: p.status, netPayable: p.netPayable },
          after: { status: row!.status, netPayable: fresh.netPayable, pulledReversals },
        });
        return { payout: row!, pulledReversals };
      });
    },

    /** H8, J3: records the transfer. The payout becomes immutable. A reference (for example the bank transfer number) is required. */
    async markPaid(input: { payoutId: string; paidBy: string; paymentReference: string; paidOn?: string | null; proofFileId?: string | null }) {
      const reference = input.paymentReference.trim();
      if (!reference) throw new ServiceError("invalid_input", "A payment reference is required.");
      if (input.paidOn && !isCalendarDay(input.paidOn)) throw new ServiceError("invalid_input", "Dates must be real calendar days like 2027-03-31.");
      return db.transaction(async (tx) => {
        await requireCommissions(tx);
        const p = await lockPayout(tx, input.payoutId);
        if (p.status !== "approved") throw new ServiceError("payout_not_approved", "Only an approved payout can be marked as paid.");
        const today = await todayFor(tx, now());
        const paidOn = input.paidOn ?? today;
        if (paidOn > today) throw new ServiceError("invalid_input", "The paid date cannot be in the future.");
        if (input.proofFileId) {
          const [f] = await tx.select({ id: file.id }).from(file).where(eq(file.id, input.proofFileId));
          if (!f) throw new ServiceError("not_found", "Proof file not found.");
        }
        const [row] = await tx
          .update(teacherPayout)
          .set({ status: "paid", paidOn, paymentReference: reference, proofFileId: input.proofFileId ?? null })
          .where(eq(teacherPayout.id, p.id))
          .returning();
        await writeAudit(tx, {
          actor: input.paidBy,
          action: "payout.pay",
          entityType: "teacher_payout",
          entityId: p.id,
          before: { status: p.status },
          after: { status: "paid", paidOn, paymentReference: reference, netPayable: p.netPayable },
        });
        return row!;
      });
    },

    /**
     * Throws a draft payout away: its entries go back to accrued and join the next payout. Only a draft can be discarded (the database
     * refuses to delete an approved or paid payout).
     */
    async discardDraft(input: { payoutId: string; discardedBy: string; reason?: string }) {
      return db.transaction(async (tx) => {
        await requireCommissions(tx);
        const p = await lockPayout(tx, input.payoutId);
        if (p.status !== "draft") throw new ServiceError("payout_not_draft", "Only a draft payout can be discarded.");
        const released = await tx
          .update(commissionEntry)
          .set({ status: "accrued", payoutId: null })
          .where(eq(commissionEntry.payoutId, p.id))
          .returning({ id: commissionEntry.id });
        await tx.delete(teacherPayout).where(eq(teacherPayout.id, p.id));
        await writeAudit(tx, {
          actor: input.discardedBy,
          action: "payout.discard",
          entityType: "teacher_payout",
          entityId: p.id,
          before: { ...p, entryCount: released.length },
          reason: input.reason?.trim() || undefined,
        });
        return { releasedEntryIds: released.map((r) => r.id) };
      });
    },

    /** One payout with its entries, for the payout screen and the teacher's statement. */
    async getPayout(input: { payoutId: string }) {
      return db.transaction(async (tx) => {
        await requireCommissions(tx);
        const [payout] = await tx.select().from(teacherPayout).where(eq(teacherPayout.id, input.payoutId));
        if (!payout) throw new ServiceError("not_found", "Payout not found.");
        return { payout, entries: await entriesOf(tx, payout.id) };
      });
    },

    async listPayouts(input: { lecturerId?: string; status?: PayoutRow["status"] } = {}) {
      return db.transaction(async (tx) => {
        await requireCommissions(tx);
        const conds = [input.lecturerId ? eq(teacherPayout.lecturerId, input.lecturerId) : undefined, input.status ? eq(teacherPayout.status, input.status) : undefined].filter(
          (c): c is NonNullable<typeof c> => c !== undefined,
        );
        return tx
          .select()
          .from(teacherPayout)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(teacherPayout.periodEnd), desc(teacherPayout.createdAt));
      });
    },
  };
}
export type PayoutService = ReturnType<typeof createPayoutService>;
