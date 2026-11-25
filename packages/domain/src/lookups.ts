import { and, eq, isNull, lte, or, gt, sql } from "drizzle-orm";
import { feeRate, invoice, organization, student, studentLevel } from "@workspace/db/schema";
import type { Db, Tx } from "./types";
import { localDate } from "./dates";

export async function loadOrganization(tx: Tx | Db) {
  const [org] = await tx.select().from(organization);
  if (!org) throw new Error("organization is not set up");
  return org;
}

export async function todayFor(tx: Tx | Db, now: Date): Promise<string> {
  return localDate(now, (await loadOrganization(tx)).timezone);
}

/** B5: the student's grade on a date, or null when they have none then. */
export async function gradeOn(tx: Tx, studentId: string, date: string): Promise<string | null> {
  const [row] = await tx
    .select({ gradeLevelId: studentLevel.gradeLevelId })
    .from(studentLevel)
    .where(
      and(
        eq(studentLevel.studentId, studentId),
        lte(studentLevel.fromDate, date),
        or(isNull(studentLevel.toDate), gt(studentLevel.toDate, date)),
      ),
    );
  return row?.gradeLevelId ?? null;
}

/**
 * D6: the rate for the grade effective on the date, else the all-grades rate, else null. The caller treats null as a failure
 * and never bills zero.
 */
export async function rateFor(tx: Tx, feeStructureId: string, gradeLevelId: string | null, date: string): Promise<string | null> {
  const effective = and(
    eq(feeRate.feeStructureId, feeStructureId),
    lte(feeRate.effectiveFrom, date),
    or(isNull(feeRate.effectiveTo), gt(feeRate.effectiveTo, date)),
  );
  if (gradeLevelId) {
    const [row] = await tx.select({ amount: feeRate.amount }).from(feeRate).where(and(effective, eq(feeRate.gradeLevelId, gradeLevelId)));
    if (row) return row.amount;
  }
  const [any] = await tx.select({ amount: feeRate.amount }).from(feeRate).where(and(effective, isNull(feeRate.gradeLevelId)));
  return any?.amount ?? null;
}

export const sqlCount = sql<number>`count(*)::int`;

/**
 * One lock order for everything that changes or reads what a student owes: the student row first, then the student's invoice rows (in id order).
 * Payment verify and void, invoice adjust and cancel, the overdue reconcile and the enrolment's branch membership all take this lock before any
 * invoice row, so two of them can never each hold an invoice the other waits for. NO KEY UPDATE conflicts with itself but not with the key-share
 * locks that foreign keys take when rows referring to the student are inserted. The lock is held until the transaction ends, and taking it
 * again in the same transaction costs nothing.
 */
export async function lockStudent(tx: Tx, studentId: string): Promise<void> {
  await tx.select({ id: student.id }).from(student).where(eq(student.id, studentId)).for("no key update");
}

/** Locks an invoice row after its student, the order described at lockStudent. Returns the locked row, or undefined when there is none. */
export async function lockInvoice(tx: Tx, invoiceId: string) {
  const [probe] = await tx.select({ studentId: invoice.studentId }).from(invoice).where(eq(invoice.id, invoiceId));
  if (!probe) return undefined;
  await lockStudent(tx, probe.studentId);
  const [locked] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId)).for("update");
  return locked;
}
