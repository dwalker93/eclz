import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  auditLog,
  bankAccount,
  invoice,
  invoiceItem,
  payment,
  paymentAllocation,
  paymentMethod,
  receipt,
} from "@workspace/db/schema";
import { planAllocation, type PlannedAllocation } from "./allocation";
import { refreshInvoiceCaches } from "./invoices";
import { todayFor } from "./lookups";
import { fromCents, toCents } from "@workspace/db/money";
import { issueReceipt, type IssueReceiptOptions, type ReceiptSigner } from "./receipts";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

type PaymentRow = typeof payment.$inferSelect;
type ReceiptRow = typeof receipt.$inferSelect;
type AllocationRow = typeof paymentAllocation.$inferSelect;

const PAYABLE_KINDS = ["recurring_fee", "package_fee", "content", "adjustment"] as const;
const OPEN_INVOICE_STATUSES = ["pending", "partial", "overdue"] as const;

export interface VerifiedEvent {
  payment: PaymentRow;
  allocations: AllocationRow[];
  receipt: ReceiptRow;
}
export interface VoidedEvent {
  payment: PaymentRow;
  reversedAllocations: AllocationRow[];
}

export interface PaymentServiceOptions {
  signer: ReceiptSigner;
  /** Later services (commission accrual, access re-evaluation) join the same transaction here. */
  hooks?: {
    afterVerify?: (tx: Tx, event: VerifiedEvent) => Promise<void>;
    afterVoid?: (tx: Tx, event: VoidedEvent) => Promise<void>;
  };
  now?: () => Date;
  formatReceiptNo?: IssueReceiptOptions["formatReceiptNo"];
  /** Bank transfers must carry a slip image as proof. Default true. */
  requireSlip?: boolean;
}

export interface SubmitPaymentInput {
  studentId: string;
  branchId: string;
  paymentMethodId: string;
  bankAccountId?: string | null;
  slipFileId?: string | null;
  /** Money as a string with up to two decimals, for example "1500.00". */
  amount: string;
  paidOn?: string | null;
  referenceNo?: string | null;
  submittedBy: string;
}

/** Either explicit item lines, or the invoices to fill (default split), or neither (every open invoice of the student and branch). */
export interface AllocationChoice {
  invoiceIds?: string[];
  allocations?: { invoiceItemId: string; amount: string }[];
}

export interface VerifyPaymentInput extends AllocationChoice {
  paymentId: string;
  verifiedBy: string;
}
export interface RecordCashInput extends AllocationChoice {
  studentId: string;
  branchId: string;
  amount: string;
  recordedBy: string;
  paidOn?: string | null;
  referenceNo?: string | null;
}
export interface RejectPaymentInput {
  paymentId: string;
  rejectedBy: string;
  reason: string;
}
export interface VoidPaymentInput {
  paymentId: string;
  voidedBy: string;
  reason: string;
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = err as { code?: string; constraint_name?: string; constraint?: string; message?: string; cause?: unknown };
  const inner = (e.cause ?? {}) as { code?: string; constraint?: string; constraint_name?: string; message?: string };
  const code = e.code ?? inner.code;
  const name = e.constraint_name ?? e.constraint ?? inner.constraint_name ?? inner.constraint;
  return code === "23505" && (name === constraint || `${e.message ?? ""} ${inner.message ?? ""}`.includes(constraint));
}

async function audit(
  tx: Tx,
  actor: string,
  action: string,
  paymentId: string,
  before: unknown,
  after: unknown,
  reason?: string,
) {
  await tx.insert(auditLog).values({
    actorUserId: actor,
    action,
    entityType: "payment",
    entityId: paymentId,
    beforeData: before ?? null,
    afterData: after ?? null,
    reason: reason ?? null,
  });
}

async function lockPayment(tx: Tx, paymentId: string): Promise<PaymentRow> {
  const [p] = await tx.select().from(payment).where(eq(payment.id, paymentId)).for("update");
  if (!p) throw new ServiceError("not_found", "Payment not found.");
  return p;
}

interface OpenItem {
  invoiceId: string;
  itemId: string;
  outstanding: number;
}

/**
 * Locks the chosen invoices (in id order, so two verifications cannot deadlock) and computes each payable item's net
 * outstanding amount (D23): amount plus the items that apply to it, minus its active allocations (E5).
 */
async function loadOpenItems(tx: Tx, p: PaymentRow, invoiceIds: string[] | undefined) {
  const filter = invoiceIds
    ? and(eq(invoice.studentId, p.studentId), eq(invoice.branchId, p.branchId), inArray(invoice.id, invoiceIds))
    : and(
        eq(invoice.studentId, p.studentId),
        eq(invoice.branchId, p.branchId),
        inArray(invoice.status, [...OPEN_INVOICE_STATUSES]),
      );
  const invoices = invoiceIds && invoiceIds.length === 0 ? [] : await tx.select().from(invoice).where(filter).orderBy(asc(invoice.id)).for("update");
  if (invoiceIds) {
    const found = new Set(invoices.map((i) => i.id));
    const missing = invoiceIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new ServiceError("invoice_not_payable", "An invoice does not exist or belongs to another student or branch.");
    }
  }
  for (const inv of invoices) {
    if (!(OPEN_INVOICE_STATUSES as readonly string[]).includes(inv.status)) {
      throw new ServiceError("invoice_not_payable", `Invoice ${inv.id} is ${inv.status} and cannot take payments.`);
    }
  }
  if (invoices.length === 0) return { invoices, items: [] as OpenItem[] };

  const ids = invoices.map((i) => i.id);
  const items = await tx
    .select()
    .from(invoiceItem)
    .where(and(inArray(invoiceItem.invoiceId, ids), isNull(invoiceItem.cancelledAt)));
  const allocated = await tx
    .select({ itemId: paymentAllocation.invoiceItemId, total: sql<string>`sum(${paymentAllocation.amount})::text` })
    .from(paymentAllocation)
    .where(and(inArray(paymentAllocation.invoiceId, ids), isNull(paymentAllocation.reversedAt)))
    .groupBy(paymentAllocation.invoiceItemId);
  const paidBy = new Map(allocated.map((a) => [a.itemId, toCents(a.total)]));

  const applied = new Map<string, number>();
  for (const it of items) {
    if (it.appliesToItemId) applied.set(it.appliesToItemId, (applied.get(it.appliesToItemId) ?? 0) + toCents(it.amount));
  }
  const open: OpenItem[] = [];
  for (const it of items) {
    const payable = (PAYABLE_KINDS as readonly string[]).includes(it.kind) && toCents(it.amount) > 0;
    if (!payable) continue;
    const net = toCents(it.amount) + (applied.get(it.id) ?? 0);
    const outstanding = net - (paidBy.get(it.id) ?? 0);
    if (outstanding > 0) open.push({ invoiceId: it.invoiceId, itemId: it.id, outstanding });
  }
  return { invoices, items: open };
}

/** E3, E4, E5, E7: lock, allocate, verify, refresh caches, issue the receipt, audit. One transaction. */
async function verifyInTx(
  tx: Tx,
  p: PaymentRow,
  choice: AllocationChoice,
  actor: string,
  opts: PaymentServiceOptions,
  auditAction: string,
): Promise<VerifiedEvent> {
  if (p.status !== "pending_verification") {
    throw new ServiceError("payment_not_pending", `Payment is ${p.status}, so it cannot be verified.`);
  }
  const now = (opts.now ?? (() => new Date()))();
  const amount = toCents(p.amount);

  let invoiceIds = choice.invoiceIds;
  if (choice.allocations && choice.allocations.length > 0) {
    const itemIds = choice.allocations.map((a) => a.invoiceItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new ServiceError("invalid_input", "An invoice item appears twice in the allocation.");
    }
    const rows = await tx.select().from(invoiceItem).where(inArray(invoiceItem.id, itemIds));
    if (rows.length !== itemIds.length) throw new ServiceError("item_not_payable", "An invoice item does not exist.");
    invoiceIds = [...new Set(rows.map((r) => r.invoiceId))];
  }

  const { invoices: lockedInvoices, items } = await loadOpenItems(tx, p, invoiceIds);
  const outstandingOf = new Map(items.map((i) => [i.itemId, i]));
  let plan: PlannedAllocation[];

  if (choice.allocations && choice.allocations.length > 0) {
    plan = choice.allocations.map((a) => {
      const cents = toCents(a.amount);
      const item = outstandingOf.get(a.invoiceItemId);
      if (cents <= 0) throw new ServiceError("invalid_input", "Allocation amounts must be positive.");
      if (!item) throw new ServiceError("item_not_payable", "An invoice item has nothing left to pay.");
      if (cents > item.outstanding) {
        throw new ServiceError(
          "allocation_exceeds_outstanding",
          `Item ${a.invoiceItemId} has only ${fromCents(item.outstanding)} outstanding.`,
        );
      }
      return { invoiceId: item.invoiceId, invoiceItemId: item.itemId, cents };
    });
    const total = plan.reduce((s, a) => s + a.cents, 0);
    if (total !== amount) {
      throw new ServiceError(
        "allocation_mismatch",
        `Allocations total ${fromCents(total)} but the payment is ${fromCents(amount)}.`,
      );
    }
  } else {
    const byInvoice = new Map<string, OpenItem[]>();
    for (const it of items) byInvoice.set(it.invoiceId, [...(byInvoice.get(it.invoiceId) ?? []), it]);
    const result = planAllocation(
      amount,
      lockedInvoices.map((inv) => ({
        invoiceId: inv.id,
        issuedOn: inv.issuedOn,
        dueDate: inv.dueDate,
        items: (byInvoice.get(inv.id) ?? []).map((i) => ({ id: i.itemId, weight: i.outstanding })),
      })),
    );
    if (result.unallocated > 0) {
      throw new ServiceError(
        "allocation_mismatch",
        `${fromCents(result.unallocated)} of this payment has no invoice to pay. Advance payments are not allowed, so fix the amount, add invoices, or reject it.`,
      );
    }
    plan = result.allocations;
  }

  // E3: the payment turns verified first, then its allocation lines are written. The deferred trigger checks at commit.
  const [verified] = await tx
    .update(payment)
    .set({ status: "verified", verifiedBy: actor, verifiedAt: now })
    .where(eq(payment.id, p.id))
    .returning();
  const allocations = await tx
    .insert(paymentAllocation)
    .values(
      plan.map((a) => ({
        paymentId: p.id,
        studentId: p.studentId,
        invoiceId: a.invoiceId,
        invoiceItemId: a.invoiceItemId,
        amount: fromCents(a.cents),
      })),
    )
    .returning();

  for (const id of [...new Set(plan.map((a) => a.invoiceId))].sort()) await refreshInvoiceCaches(tx, id);

  const rcpt = await issueReceipt(tx, p.id, p.branchId, { signer: opts.signer, now, formatReceiptNo: opts.formatReceiptNo });
  await audit(
    tx,
    actor,
    auditAction,
    p.id,
    { status: p.status },
    { status: "verified", amount: p.amount, receiptNo: rcpt.receiptNo, allocations: allocations.map((a) => ({ item: a.invoiceItemId, amount: a.amount })) },
  );
  const event = { payment: verified!, allocations, receipt: rcpt };
  await opts.hooks?.afterVerify?.(tx, event);
  return event;
}

export function createPaymentService(db: Db, opts: PaymentServiceOptions) {
  const now = () => (opts.now ?? (() => new Date()))();

  return {
    /** A student or staff member submits a bank transfer (or starts a gateway payment). It waits for verification. */
    async submitPayment(input: SubmitPaymentInput): Promise<PaymentRow> {
      const cents = (() => {
        try {
          return toCents(input.amount);
        } catch {
          throw new ServiceError("invalid_input", "The amount is not a valid money value.");
        }
      })();
      if (cents <= 0) throw new ServiceError("invalid_input", "The amount must be positive.");
      return db.transaction(async (tx) => {
        const [method] = await tx.select().from(paymentMethod).where(eq(paymentMethod.id, input.paymentMethodId));
        if (!method || !method.isActive) throw new ServiceError("payment_method_invalid", "This payment method is not available.");
        if (method.type === "cash") {
          throw new ServiceError("payment_method_invalid", "Cash is recorded by staff, not submitted.");
        }
        if (method.type === "bank_transfer") {
          if (!input.bankAccountId) throw new ServiceError("bank_account_invalid", "Choose the bank account you paid into.");
          const [acct] = await tx.select().from(bankAccount).where(eq(bankAccount.id, input.bankAccountId));
          if (!acct || !acct.isActive || acct.branchId !== input.branchId) {
            throw new ServiceError("bank_account_invalid", "This bank account is not available for this branch.");
          }
          if ((opts.requireSlip ?? true) && !input.slipFileId) {
            throw new ServiceError("slip_required", "Upload the payment slip as proof.");
          }
        }
        try {
          const [row] = await tx
            .insert(payment)
            .values({
              studentId: input.studentId,
              branchId: input.branchId,
              paymentMethodId: input.paymentMethodId,
              bankAccountId: input.bankAccountId ?? null,
              slipFileId: input.slipFileId ?? null,
              amount: fromCents(cents),
              paidOn: input.paidOn ?? null,
              referenceNo: input.referenceNo?.trim() || null,
              submittedBy: input.submittedBy,
            })
            .returning();
          return row!;
        } catch (err) {
          if (isUniqueViolation(err, "payment_bank_reference_uq")) {
            throw new ServiceError("duplicate_reference", "This bank reference was already used on this account.");
          }
          throw err;
        }
      });
    },

    /** E3 to E7, E12, E13: verify and allocate in one transaction, then issue the receipt. */
    verifyPayment(input: VerifyPaymentInput): Promise<VerifiedEvent> {
      return db.transaction(async (tx) => {
        const p = await lockPayment(tx, input.paymentId);
        return verifyInTx(tx, p, input, input.verifiedBy, opts, "payment.verify");
      });
    },

    /** E11: staff record cash. The payment is created already verified and gets its receipt immediately. */
    recordCashPayment(input: RecordCashInput): Promise<VerifiedEvent> {
      const cents = toCents(input.amount);
      if (cents <= 0) throw new ServiceError("invalid_input", "The amount must be positive.");
      return db.transaction(async (tx) => {
        const [method] = await tx
          .select()
          .from(paymentMethod)
          .where(and(eq(paymentMethod.type, "cash"), eq(paymentMethod.isActive, true)));
        if (!method) throw new ServiceError("payment_method_invalid", "Cash payments are not enabled.");
        const [row] = await tx
          .insert(payment)
          .values({
            studentId: input.studentId,
            branchId: input.branchId,
            paymentMethodId: method.id,
            amount: fromCents(cents),
            paidOn: input.paidOn ?? (await todayFor(tx, now())),
            referenceNo: input.referenceNo?.trim() || null,
            submittedBy: input.recordedBy,
          })
          .returning();
        return verifyInTx(tx, row!, input, input.recordedBy, opts, "payment.record_cash");
      });
    },

    /** E8: a pending payment is rejected with a reason. Nothing is allocated. */
    rejectPayment(input: RejectPaymentInput): Promise<PaymentRow> {
      if (!input.reason.trim()) throw new ServiceError("reason_required", "A rejection reason is required.");
      return db.transaction(async (tx) => {
        const p = await lockPayment(tx, input.paymentId);
        if (p.status !== "pending_verification") {
          throw new ServiceError("payment_not_pending", `Payment is ${p.status}, so it cannot be rejected.`);
        }
        const [row] = await tx
          .update(payment)
          .set({ status: "rejected", rejectionReason: input.reason.trim() })
          .where(eq(payment.id, p.id))
          .returning();
        await audit(tx, input.rejectedBy, "payment.reject", p.id, { status: p.status }, { status: "rejected" }, input.reason.trim());
        return row!;
      });
    },

    /** E9: void a verified payment. Allocations are reversed (kept), caches recomputed, the receipt voided, and the audit log written. */
    voidPayment(input: VoidPaymentInput): Promise<VoidedEvent> {
      if (!input.reason.trim()) throw new ServiceError("reason_required", "A void reason is required.");
      return db.transaction(async (tx) => {
        const p = await lockPayment(tx, input.paymentId);
        if (p.status !== "verified") {
          throw new ServiceError("payment_not_verified", `Payment is ${p.status}, so it cannot be voided.`);
        }
        const at = now();
        const active = await tx
          .select()
          .from(paymentAllocation)
          .where(and(eq(paymentAllocation.paymentId, p.id), isNull(paymentAllocation.reversedAt)));
        const invoiceIds = [...new Set(active.map((a) => a.invoiceId))].sort();
        if (invoiceIds.length > 0) {
          await tx.select().from(invoice).where(inArray(invoice.id, invoiceIds)).orderBy(asc(invoice.id)).for("update");
        }
        const reversedAllocations =
          active.length === 0
            ? []
            : await tx
                .update(paymentAllocation)
                .set({ reversedAt: at })
                .where(and(eq(paymentAllocation.paymentId, p.id), isNull(paymentAllocation.reversedAt)))
                .returning();
        const [row] = await tx
          .update(payment)
          .set({ status: "voided", voidReason: input.reason.trim(), voidedBy: input.voidedBy, voidedAt: at })
          .where(eq(payment.id, p.id))
          .returning();
        await tx.update(receipt).set({ status: "void" }).where(and(eq(receipt.paymentId, p.id), eq(receipt.status, "issued")));
        for (const id of invoiceIds) await refreshInvoiceCaches(tx, id);
        await audit(tx, input.voidedBy, "payment.void", p.id, { status: "verified" }, { status: "voided" }, input.reason.trim());
        const event = { payment: row!, reversedAllocations };
        await opts.hooks?.afterVoid?.(tx, event);
        return event;
      });
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
