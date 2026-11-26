import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  enrollment,
  feeStructure,
  invoice,
  invoiceInstallment,
  invoiceItem,
} from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { addDays } from "./dates";
import { loadOrganization, lockStudent, todayFor } from "./lookups";
import { queueNotifications, resolveRecipients } from "./notifications";
import { fromCents, toCents } from "@workspace/db/money";
import type { VerifiedEvent, VoidedEvent } from "./payments";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

type EnrollmentRow = typeof enrollment.$inferSelect;
type OrgRow = Awaited<ReturnType<typeof loadOrganization>>;

// ---- C8: effective access

export type AccessDenial = "not_active" | "not_started" | "ended" | "restricted";

/**
 * C8: effective access. The one place that decides it, so every route, job and notification asks the same question.
 * `status` must be active or completed, today must be inside the access window (end exclusive), and the billing overlay must be clear.
 */
export function accessState(
  enr: Pick<EnrollmentRow, "status" | "accessStartsOn" | "accessEndsOn" | "accessStatus">,
  today: string,
): { allowed: true } | { allowed: false; reason: AccessDenial } {
  if (enr.status !== "active" && enr.status !== "completed") return { allowed: false, reason: "not_active" };
  if (enr.accessStartsOn > today) return { allowed: false, reason: "not_started" };
  if (enr.accessEndsOn && today >= enr.accessEndsOn) return { allowed: false, reason: "ended" };
  if (enr.accessStatus !== "active") return { allowed: false, reason: "restricted" };
  return { allowed: true };
}

export const hasAccess = (enr: Parameters<typeof accessState>[0], today: string): boolean => accessState(enr, today).allowed;

// ---- C9: overdue rules

export interface OverdueSettings {
  graceDays: number;
  action: "none" | "notify" | "restrict" | "notify_and_restrict";
  notify: boolean;
  restrict: boolean;
}

/** The fee option's own grace days and action win, field by field. Anything it leaves empty comes from the organization. */
export function resolveOverdueSettings(
  org: { overdueGraceDays: number; overdueAction: string },
  fee?: { overdueGraceDays: number | null; overdueAction: string | null } | null,
): OverdueSettings {
  const action = (fee?.overdueAction ?? org.overdueAction) as OverdueSettings["action"];
  return {
    graceDays: fee?.overdueGraceDays ?? org.overdueGraceDays,
    action,
    notify: action === "notify" || action === "notify_and_restrict",
    restrict: action === "restrict" || action === "notify_and_restrict",
  };
}

/** First day on which a due date counts as past its grace period. Grace days are whole days after the due date. */
export const overdueFrom = (dueDate: string, graceDays: number) => addDays(dueDate, graceDays + 1);

export interface InvoiceDue {
  dueDate: string;
  total: string;
  amountPaid: string;
  installments: { seq: number; dueDate: string; amount: string; amountPaid: string }[];
}

export interface OverdueEvaluation {
  overdue: boolean;
  installments: { seq: number; overdue: boolean }[];
}

/**
 * C9: an invoice is overdue when money is still owed and the due date is past grace. With installments the test is per installment:
 * any unpaid installment past its own due date plus grace makes the invoice overdue. A part-paid item is still unpaid, so it stays overdue.
 */
export function evaluateOverdue(inv: InvoiceDue, graceDays: number, today: string): OverdueEvaluation {
  const settled = toCents(inv.amountPaid) >= toCents(inv.total);
  if (settled) return { overdue: false, installments: inv.installments.map((i) => ({ seq: i.seq, overdue: false })) };
  if (inv.installments.length === 0) return { overdue: today >= overdueFrom(inv.dueDate, graceDays), installments: [] };
  const installments = inv.installments.map((i) => ({
    seq: i.seq,
    overdue: toCents(i.amountPaid) < toCents(i.amount) && today >= overdueFrom(i.dueDate, graceDays),
  }));
  return { overdue: installments.some((i) => i.overdue), installments };
}

// ---- reconcile one student

export interface ReconcileSummary {
  markedOverdue: string[];
  clearedOverdue: string[];
  restricted: string[];
  restored: string[];
  notifications: number;
}

const FEE_KINDS = ["recurring_fee", "package_fee"] as const;
interface OverdueNote {
  eventKey: string;
  payload: Record<string, unknown>;
}

/** J1, J2: one notification per recipient, channel and overdue item. Disabled external channels create no rows, and retrying the enqueue creates no second row. */
async function queueOverdueNotifications(tx: Tx, org: OrgRow, studentId: string, notes: OverdueNote[], at: Date): Promise<number> {
  if (notes.length === 0) return 0;
  const { userIds, studentName } = await resolveRecipients(tx, org, studentId);
  return queueNotifications(tx, org, {
    event: "installment_overdue",
    userIds,
    items: notes.map((n) => ({ eventKey: n.eventKey, payload: { studentName, ...n.payload } })),
    at,
  });
}

/**
 * C9: brings one student's overdue state in line with the rules, in the caller's transaction. It
 *  - marks invoices and installments `overdue`, or puts them back to pending or partial when they no longer are (A void can do that),
 *  - restricts the enrolments on an overdue invoice when its action includes restrict, and clears the restriction of an enrolment when no
 *    past-grace unpaid invoice that restricts it remains (a part-paid overdue invoice keeps it),
 *  - queues overdue notifications when its action includes notify,
 *  - writes an audit row for every restrict and restore (J3).
 * The grace days and action come from the earliest fee line's fee option, else the organization. An invoice that mixes classes with
 * different settings follows its earliest fee line. Invoices without a fee line with an enrolment (content only) get the status and the notification, and restrict nothing.
 * Run it daily for everyone (`runOverdueJob`) and after anything that changes what a student owes (the payment hooks do this for payments).
 */
export async function reconcileStudent(
  tx: Tx,
  studentId: string,
  ctx: { today: string; org: OrgRow; actor: string | null; at: Date },
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { markedOverdue: [], clearedOverdue: [], restricted: [], restored: [], notifications: 0 };
  // The student lock comes before any invoice lock, the same order payment verify and void and invoice changes use. It also holds the student's
  // payments and invoices still while the enrolments are read below, so the restore decision cannot rest on invoice state that a void has since changed.
  await lockStudent(tx, studentId);
  const invoices = await tx
    .select()
    .from(invoice)
    .where(and(eq(invoice.studentId, studentId), inArray(invoice.status, ["pending", "partial", "overdue"])))
    .orderBy(asc(invoice.id))
    .for("update");

  const toRestrict = new Set<string>();
  const notes: OverdueNote[] = [];

  for (const inv of invoices) {
    const feeLines = await tx
      .select()
      .from(invoiceItem)
      .where(and(eq(invoiceItem.invoiceId, inv.id), inArray(invoiceItem.kind, [...FEE_KINDS]), isNull(invoiceItem.cancelledAt)))
      .orderBy(asc(invoiceItem.createdAt), asc(invoiceItem.id));
    const firstOption = feeLines.find((l) => l.feeStructureId)?.feeStructureId;
    const [option] = firstOption ? await tx.select().from(feeStructure).where(eq(feeStructure.id, firstOption)) : [];
    const settings = resolveOverdueSettings(ctx.org, option);

    const installments = await tx.select().from(invoiceInstallment).where(eq(invoiceInstallment.invoiceId, inv.id)).orderBy(asc(invoiceInstallment.seq));
    const ev = evaluateOverdue(
      { dueDate: inv.dueDate, total: inv.total, amountPaid: inv.amountPaid, installments: installments.map((i) => ({ seq: i.seq, dueDate: i.dueDate, amount: i.amount, amountPaid: i.amountPaid })) },
      settings.graceDays,
      ctx.today,
    );

    for (const inst of installments) {
      if (toCents(inst.amountPaid) >= toCents(inst.amount)) continue; // paid stays paid
      const target = ev.installments.find((e) => e.seq === inst.seq)!.overdue ? "overdue" : toCents(inst.amountPaid) > 0 ? "partial" : "pending";
      if (inst.status !== target) await tx.update(invoiceInstallment).set({ status: target }).where(eq(invoiceInstallment.id, inst.id));
    }
    const target = ev.overdue ? "overdue" : toCents(inv.amountPaid) > 0 ? "partial" : "pending";
    if (inv.status !== target) {
      await tx.update(invoice).set({ status: target }).where(eq(invoice.id, inv.id));
      (ev.overdue ? summary.markedOverdue : summary.clearedOverdue).push(inv.id);
    }
    if (!ev.overdue) continue;

    if (settings.restrict) for (const l of feeLines) if (l.enrollmentId) toRestrict.add(l.enrollmentId);
    if (settings.notify) {
      const owed = (cents: number) => fromCents(cents);
      if (installments.length === 0) {
        notes.push({
          eventKey: `overdue:${inv.id}:0`,
          payload: { invoiceId: inv.id, dueDate: inv.dueDate, amountDue: owed(toCents(inv.total) - toCents(inv.amountPaid)), graceDays: settings.graceDays },
        });
      } else {
        for (const inst of installments) {
          if (!ev.installments.find((e) => e.seq === inst.seq)!.overdue) continue;
          notes.push({
            eventKey: `overdue:${inv.id}:${inst.seq}`,
            payload: { invoiceId: inv.id, installmentSeq: inst.seq, dueDate: inst.dueDate, amountDue: owed(toCents(inst.amount) - toCents(inst.amountPaid)), graceDays: settings.graceDays },
          });
        }
      }
    }
  }

  const enrolments = await tx
    .select()
    .from(enrollment)
    .where(and(eq(enrollment.studentId, studentId), inArray(enrollment.status, ["active", "completed"])))
    .orderBy(asc(enrollment.id));
  for (const e of enrolments) {
    const should = toRestrict.has(e.id);
    if (should && e.accessStatus === "active") {
      await tx.update(enrollment).set({ accessStatus: "restricted" }).where(eq(enrollment.id, e.id));
      await writeAudit(tx, { actor: ctx.actor, action: "access.restrict", entityType: "enrollment", entityId: e.id, before: { accessStatus: "active" }, after: { accessStatus: "restricted" }, reason: "overdue payment" });
      summary.restricted.push(e.id);
    } else if (!should && e.accessStatus === "restricted") {
      await tx.update(enrollment).set({ accessStatus: "active" }).where(eq(enrollment.id, e.id));
      await writeAudit(tx, { actor: ctx.actor, action: "access.restore", entityType: "enrollment", entityId: e.id, before: { accessStatus: "restricted" }, after: { accessStatus: "active" }, reason: "no overdue payment remains" });
      summary.restored.push(e.id);
    }
  }
  summary.notifications = await queueOverdueNotifications(tx, ctx.org, studentId, notes, ctx.at);
  return summary;
}

// ---- service

export interface OverdueJobResult {
  date: string;
  students: number;
  markedOverdue: number;
  clearedOverdue: number;
  restricted: number;
  restored: number;
  notifications: number;
  /** A student whose run failed is skipped and reported, so one bad record never stops the rest. */
  errors: { studentId: string; message: string }[];
}

export function createAccessService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function recheck(tx: Tx, studentId: string, actor: string | null) {
    const org = await loadOrganization(tx);
    return reconcileStudent(tx, studentId, { today: await todayFor(tx, now()), org, actor, at: now() });
  }

  return {
    /** C8 for one enrolment, on today's date in the organization's time zone. */
    async getAccess(input: { enrollmentId: string }) {
      return db.transaction(async (tx) => {
        const [enr] = await tx.select().from(enrollment).where(eq(enrollment.id, input.enrollmentId));
        if (!enr) throw new ServiceError("not_found", "Enrolment not found.");
        return accessState(enr, await todayFor(tx, now()));
      });
    },

    /**
     * C9 daily job: every student with an unpaid invoice or a restricted enrolment is reconciled in a transaction of their own.
     * Safe to run twice (notifications are unique per recipient, channel and item).
     */
    async runOverdueJob(): Promise<OverdueJobResult> {
      const { today, ids } = await db.transaction(async (tx) => {
        const owing = await tx.selectDistinct({ id: invoice.studentId }).from(invoice).where(inArray(invoice.status, ["pending", "partial", "overdue"]));
        const restricted = await tx.selectDistinct({ id: enrollment.studentId }).from(enrollment).where(eq(enrollment.accessStatus, "restricted"));
        return { today: await todayFor(tx, now()), ids: [...new Set([...owing, ...restricted].map((r) => r.id))].sort() };
      });
      const result: OverdueJobResult = { date: today, students: ids.length, markedOverdue: 0, clearedOverdue: 0, restricted: 0, restored: 0, notifications: 0, errors: [] };
      for (const studentId of ids) {
        try {
          const s = await db.transaction((tx) => recheck(tx, studentId, null));
          result.markedOverdue += s.markedOverdue.length;
          result.clearedOverdue += s.clearedOverdue.length;
          result.restricted += s.restricted.length;
          result.restored += s.restored.length;
          result.notifications += s.notifications;
        } catch (err) {
          result.errors.push({ studentId, message: String((err as Error).message).slice(0, 300) });
        }
      }
      return result;
    },

    /**
     * The same reconcile for one student, in the caller's transaction. Call it after a change to what a student owes (invoice cancel or adjustment).
     *
     * LOCK ORDER (the contract for callers): the student is locked before any of their invoices, everywhere (payment verify and void, invoice changes,
     * this reconcile, the overdue job). `recheckStudent` locks the student itself, but only when it runs: a caller that has already locked or changed an
     * invoice in the same transaction took the invoice first, and if the overdue job holds the student and waits for that invoice, each waits for the
     * other and PostgreSQL aborts one. So a caller that changes an invoice must lock the student first. Use `changeThenRecheck`, which does that, or call
     * `lockStudent` before the first invoice read or write and `recheckStudent` after.
     */
    recheckStudent: recheck,

    /** Locks the student (FOR NO KEY UPDATE) for the rest of the transaction. Call it before touching any of the student's invoices; taking it again is free. */
    lockStudent: (tx: Tx, studentId: string) => lockStudent(tx, studentId),

    /**
     * Locks the student, runs `change` (the caller's invoice cancel or adjustment, in the same transaction), then reconciles the student. The order is the
     * one described at `recheckStudent`, so the change cannot cross the overdue job. Returns what `change` returned and the reconcile summary.
     */
    async changeThenRecheck<T>(tx: Tx, input: { studentId: string; actor: string | null }, change: () => Promise<T>): Promise<{ result: T; summary: ReconcileSummary }> {
      await lockStudent(tx, input.studentId);
      const result = await change();
      return { result, summary: await recheck(tx, input.studentId, input.actor) };
    },

    /**
     * C9: pass as `hooks` (through `combineHooks`) to createPaymentService. A verified payment clears the restriction in the same transaction when
     * nothing past grace is left unpaid. A void re-checks too, so an invoice that is unpaid again and past grace is overdue and restricted at once.
     */
    hooks: {
      afterVerify: async (tx: Tx, event: VerifiedEvent) => void (await recheck(tx, event.payment.studentId, event.payment.verifiedBy ?? null)),
      afterVoid: async (tx: Tx, event: VoidedEvent) => void (await recheck(tx, event.payment.studentId, event.payment.voidedBy ?? null)),
    },
  };
}
export type AccessService = ReturnType<typeof createAccessService>;
