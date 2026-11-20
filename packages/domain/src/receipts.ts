import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { branch, payment, paymentAllocation, receipt, receiptCounter } from "@workspace/db/schema";
import type { Db, Tx } from "./types";

/** Signs and checks receipt hashes (v1 signing). Keys stay in the secret store, never in the database. */
export interface ReceiptSigner {
  sign(contentHash: string): string | Promise<string>;
  verify(contentHash: string, signature: string): boolean | Promise<boolean>;
}

/** HMAC-SHA256 signer for a shared secret. Use it when the verify page runs inside the same deployment. */
export function hmacSigner(secret: string): ReceiptSigner {
  const mac = (hash: string) => createHmac("sha256", secret).update(hash).digest("hex");
  return {
    sign: (hash) => mac(hash),
    verify: (hash, signature) => {
      const a = Buffer.from(mac(hash));
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}

export interface ReceiptPayload {
  v: 1;
  receiptNo: string;
  branchId: string;
  paymentId: string;
  studentId: string;
  amount: string;
  verifiedAt: string;
  allocations: { invoiceId: string; invoiceItemId: string; amount: string }[];
}

/** The exact text that is hashed. Field order is fixed so the same data always gives the same hash. */
export function canonicalize(p: ReceiptPayload): string {
  return JSON.stringify([
    p.v,
    p.receiptNo,
    p.branchId,
    p.paymentId,
    p.studentId,
    p.amount,
    p.verifiedAt,
    p.allocations.map((a) => [a.invoiceId, a.invoiceItemId, a.amount]),
  ]);
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

async function buildPayload(tx: Tx | Db, paymentId: string, receiptNo: string): Promise<ReceiptPayload> {
  const [p] = await tx.select().from(payment).where(eq(payment.id, paymentId));
  if (!p || !p.verifiedAt) throw new Error("payment is not verified");
  const rows = await tx
    .select()
    .from(paymentAllocation)
    .where(and(eq(paymentAllocation.paymentId, paymentId), isNull(paymentAllocation.reversedAt)));
  rows.sort((a, b) => a.invoiceId.localeCompare(b.invoiceId) || a.invoiceItemId.localeCompare(b.invoiceItemId));
  return {
    v: 1,
    receiptNo,
    branchId: p.branchId,
    paymentId: p.id,
    studentId: p.studentId,
    amount: p.amount,
    verifiedAt: p.verifiedAt.toISOString(),
    allocations: rows.map((r) => ({ invoiceId: r.invoiceId, invoiceItemId: r.invoiceItemId, amount: r.amount })),
  };
}

export interface IssueReceiptOptions {
  signer: ReceiptSigner;
  now: Date;
  /** Default: the counter, zero padded to six digits. */
  formatReceiptNo?: (n: number, branchName: string) => string;
}

/** E12, E13: takes the next number from the branch counter inside the caller's transaction and signs the receipt. */
export async function issueReceipt(tx: Tx, paymentId: string, branchId: string, opts: IssueReceiptOptions) {
  await tx.insert(receiptCounter).values({ branchId }).onConflictDoNothing();
  const [counter] = await tx
    .update(receiptCounter)
    .set({ lastNumber: sql`${receiptCounter.lastNumber} + 1` })
    .where(eq(receiptCounter.branchId, branchId))
    .returning();
  const [b] = await tx.select().from(branch).where(eq(branch.id, branchId));
  const n = counter!.lastNumber;
  const receiptNo = (opts.formatReceiptNo ?? ((x) => String(x).padStart(6, "0")))(n, b?.name ?? "");
  const payload = await buildPayload(tx, paymentId, receiptNo);
  const contentHash = sha256(canonicalize(payload));
  const signature = await opts.signer.sign(contentHash);
  const [row] = await tx
    .insert(receipt)
    .values({
      paymentId,
      branchId,
      receiptNo,
      verificationCode: randomBytes(18).toString("base64url"),
      contentHash,
      signature,
      signedAt: opts.now,
    })
    .returning();
  return row!;
}

export type ReceiptCheck =
  | { valid: true; receiptNo: string; branchId: string; amount: string; verifiedAt: string; issuedAt: Date }
  | { valid: false; reason: "not_found" | "void" | "tampered" | "bad_signature" };

/**
 * The public verify page: rebuilds the receipt data from the database, compares the hash with the stored one,
 * and checks the signature. A voided receipt is reported as void.
 */
export async function verifyReceipt(db: Db, verificationCode: string, signer: ReceiptSigner): Promise<ReceiptCheck> {
  const [r] = await db.select().from(receipt).where(eq(receipt.verificationCode, verificationCode));
  if (!r) return { valid: false, reason: "not_found" };
  if (r.status !== "issued") return { valid: false, reason: "void" };
  const payload = await buildPayload(db, r.paymentId, r.receiptNo);
  if (sha256(canonicalize(payload)) !== r.contentHash) return { valid: false, reason: "tampered" };
  if (!(await signer.verify(r.contentHash, r.signature))) return { valid: false, reason: "bad_signature" };
  // The branch on the receipt row is not part of the signed data unless it matches the payload's, which comes from the payment.
  if (r.branchId !== payload.branchId) return { valid: false, reason: "tampered" };
  return { valid: true, receiptNo: r.receiptNo, branchId: r.branchId, amount: payload.amount, verifiedAt: payload.verifiedAt, issuedAt: r.issuedAt };
}
