import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { branch, guardian, invoice, payment, paymentMethod, student, studentGuardian } from "@workspace/db/schema";
import { fromCents, toCents } from "@workspace/db/money";
import { branchScope } from "./authorization";
import { ServiceError } from "./errors";
import { loadOrganization, todayFor } from "./lookups";
import { type Db } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

export interface OverdueRow {
  invoiceId: string;
  studentId: string;
  studentNo: string;
  studentName: string;
  branchId: string;
  guardianName: string | null;
  guardianPhone: string | null;
  dueDate: string;
  daysOverdue: number;
  total: string;
  paid: string;
  outstanding: string;
}

export interface OverdueReport {
  asOf: string;
  count: number;
  outstanding: string;
  /** Outstanding money by how late it is: 1 to 30 days, 31 to 60, 61 or more. */
  aging: { "1-30": string; "31-60": string; "61+": string };
  byBranch: { branchId: string; branchName: string; count: number; outstanding: string }[];
  /** Oldest first. Paged; the totals above cover every overdue invoice in scope. */
  rows: OverdueRow[];
}

export interface CollectionsReport {
  from: string;
  to: string;
  collected: string;
  paymentCount: number;
  byBranch: { branchId: string; branchName: string; count: number; amount: string }[];
  byMethod: { type: string; label: string; count: number; amount: string }[];
  byDay: { date: string; count: number; amount: string }[];
  /** Slips waiting for a payment handler right now (not part of `collected`). */
  pendingVerification: { count: number; amount: string };
}

/**
 * The owner's reports (read-only). Both need `reports.read` and cover only the branches the caller holds it in (all branches with an
 * all-branches assignment). "Overdue" means an invoice still unpaid after its due date, whatever its stored status label says, so the report
 * is right even before the overdue job has run. "Collected" means payments verified in the period, by the date in the organization's time zone;
 * a payment that was later voided is not money held and is left out.
 */
export function createReportService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function scopeOf(actor: string, branchId?: string): Promise<string[] | "all"> {
    const scope = await branchScope(db, actor, "reports.read");
    if (scope !== "all" && scope.length === 0) throw new ServiceError("forbidden", "You do not have the reports.read permission.");
    if (!branchId) return scope;
    if (scope !== "all" && !scope.includes(branchId)) throw new ServiceError("forbidden", "You do not have the reports.read permission in that branch.");
    return [branchId];
  }

  return {
    async overdue(input: { actor: string; branchId?: string; limit?: number; offset?: number }): Promise<OverdueReport> {
      const scope = await scopeOf(input.actor, input.branchId);
      const asOf = await todayFor(db, now());
      const found = await db
        .select({
          invoiceId: invoice.id,
          studentId: student.id,
          studentNo: student.studentNo,
          studentName: student.fullName,
          branchId: invoice.branchId,
          dueDate: invoice.dueDate,
          total: invoice.total,
          paid: invoice.amountPaid,
        })
        .from(invoice)
        .innerJoin(student, eq(student.id, invoice.studentId))
        .where(and(inArray(invoice.status, ["pending", "partial", "overdue"]), lt(invoice.dueDate, asOf), scope === "all" ? undefined : inArray(invoice.branchId, scope)))
        .orderBy(asc(invoice.dueDate), asc(invoice.id));

      const aging = { "1-30": 0, "31-60": 0, "61+": 0 };
      const perBranch = new Map<string, { count: number; cents: number }>();
      let total = 0;
      const all = found.map((r) => {
        const cents = toCents(r.total) - toCents(r.paid);
        const days = dayNumber(asOf) - dayNumber(r.dueDate);
        total += cents;
        aging[days <= 30 ? "1-30" : days <= 60 ? "31-60" : "61+"] += cents;
        const b = perBranch.get(r.branchId) ?? { count: 0, cents: 0 };
        perBranch.set(r.branchId, { count: b.count + 1, cents: b.cents + cents });
        return { ...r, days, cents };
      });

      const page = all.slice(input.offset ?? 0, (input.offset ?? 0) + Math.min(input.limit ?? 50, 500));
      const kids = [...new Set(page.map((r) => r.studentId))];
      const parents = kids.length
        ? await db
            .select({ studentId: studentGuardian.studentId, name: guardian.fullName, phone: guardian.phone })
            .from(studentGuardian)
            .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
            .where(and(inArray(studentGuardian.studentId, kids), eq(studentGuardian.isPrimary, true)))
        : [];
      const branches = perBranch.size ? await db.select({ id: branch.id, name: branch.name }).from(branch).where(inArray(branch.id, [...perBranch.keys()])) : [];

      return {
        asOf,
        count: all.length,
        outstanding: fromCents(total),
        aging: { "1-30": fromCents(aging["1-30"]), "31-60": fromCents(aging["31-60"]), "61+": fromCents(aging["61+"]) },
        byBranch: [...perBranch.entries()]
          .map(([branchId, v]) => ({ branchId, branchName: branches.find((b) => b.id === branchId)?.name ?? "", count: v.count, outstanding: fromCents(v.cents) }))
          .sort((a, b) => toCents(b.outstanding) - toCents(a.outstanding)),
        rows: page.map((r) => {
          const g = parents.find((p) => p.studentId === r.studentId);
          return {
            invoiceId: r.invoiceId,
            studentId: r.studentId,
            studentNo: r.studentNo,
            studentName: r.studentName,
            branchId: r.branchId,
            guardianName: g?.name ?? null,
            guardianPhone: g?.phone ?? null,
            dueDate: r.dueDate,
            daysOverdue: r.days,
            total: r.total,
            paid: r.paid,
            outstanding: fromCents(r.cents),
          };
        }),
      };
    },

    /** Money verified between two local dates (inclusive, at most 366 days), by branch, payment method and day. */
    async collections(input: { actor: string; from: string; to: string; branchId?: string }): Promise<CollectionsReport> {
      if (!DAY.test(input.from) || !DAY.test(input.to) || input.from > input.to) throw new ServiceError("invalid_input", "Give a period as two dates, from on or before to.");
      if (dayNumber(input.to) - dayNumber(input.from) > 365) throw new ServiceError("invalid_input", "A period can be at most 366 days.");
      const scope = await scopeOf(input.actor, input.branchId);
      const tz = (await loadOrganization(db)).timezone;
      const local = sql<string>`to_char(timezone(${tz}, ${payment.verifiedAt}), 'YYYY-MM-DD')`;
      const inScope = scope === "all" ? undefined : inArray(payment.branchId, scope);
      const rows = await db
        .select({ amount: payment.amount, branchId: payment.branchId, branchName: branch.name, type: paymentMethod.type, label: paymentMethod.label, date: local })
        .from(payment)
        .innerJoin(branch, eq(branch.id, payment.branchId))
        .innerJoin(paymentMethod, eq(paymentMethod.id, payment.paymentMethodId))
        .where(and(eq(payment.status, "verified"), sql`${local} >= ${input.from} AND ${local} <= ${input.to}`, inScope))
        .orderBy(asc(local));
      const pend = await db
        .select({ amount: payment.amount })
        .from(payment)
        .where(and(eq(payment.status, "pending_verification"), inScope));

      const group = <K extends string>(key: (r: (typeof rows)[number]) => K) => {
        const m = new Map<K, { count: number; cents: number; r: (typeof rows)[number] }>();
        for (const r of rows) {
          const k = key(r);
          const g = m.get(k) ?? { count: 0, cents: 0, r };
          m.set(k, { count: g.count + 1, cents: g.cents + toCents(r.amount), r });
        }
        return [...m.values()];
      };
      return {
        from: input.from,
        to: input.to,
        collected: fromCents(rows.reduce((a, r) => a + toCents(r.amount), 0)),
        paymentCount: rows.length,
        byBranch: group((r) => r.branchId).map((g) => ({ branchId: g.r.branchId, branchName: g.r.branchName, count: g.count, amount: fromCents(g.cents) })).sort((a, b) => toCents(b.amount) - toCents(a.amount)),
        byMethod: group((r) => r.type + "|" + r.label).map((g) => ({ type: g.r.type, label: g.r.label, count: g.count, amount: fromCents(g.cents) })).sort((a, b) => toCents(b.amount) - toCents(a.amount)),
        byDay: group((r) => r.date).map((g) => ({ date: g.r.date, count: g.count, amount: fromCents(g.cents) })),
        pendingVerification: { count: pend.length, amount: fromCents(pend.reduce((a, r) => a + toCents(r.amount), 0)) },
      };
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
