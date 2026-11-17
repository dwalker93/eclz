import { and, eq, isNull, lte, or, gt, sql } from "drizzle-orm";
import { feeRate, organization, studentLevel } from "../schema";
import type { Tx } from "./types";
import { localDate } from "./dates";

export async function loadOrganization(tx: Tx) {
  const [org] = await tx.select().from(organization);
  if (!org) throw new Error("organization is not set up");
  return org;
}

export async function todayFor(tx: Tx, now: Date): Promise<string> {
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
