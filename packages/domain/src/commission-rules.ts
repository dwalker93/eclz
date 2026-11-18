import { and, asc, eq, inArray, isNull, gt, lte, or, sql } from "drizzle-orm";
import { COMMISSION_CALC_TYPES, commissionEntry, commissionRule, course, courseLecturer, feeRate, feeStructure, gradeLevel, lecturer, subject } from "@workspace/db/schema";
import { fromCents, toCents } from "@workspace/db/money";
import { writeAudit } from "./audit";
import { requirePermission } from "./authorization";
import { ServiceError } from "./errors";
import { todayFor } from "./lookups";
import { type Db, type Tx } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d+(\.\d{1,2})?$/;

export type CommissionRuleScope = { courseId: string } | { subjectId: string; gradeLevelId?: string } | Record<string, never>;

function isExclusionViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e.code ?? e.cause?.code) === "23P01";
}

/**
 * What the institute keeps from each lecturer (H1, H4). Rules are institute-wide, so every change needs `commissions.manage` as an all-branches
 * role. A rule has one of four scopes (course; subject and grade; subject; the lecturer's default), and rules of the same scope never overlap in
 * dates. A rate is never edited: end the old rule and add a new one, so past earnings keep the rule they were calculated with (H6).
 * Rules can be prepared while the commissions module is off; only accrual and payouts need it (H9).
 */
export function createCommissionRuleService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  /** H12: a fixed amount above the lowest current fee of the courses it covers is allowed, with a warning. */
  async function fixedRateWarning(q: Tx | Db, lecturerId: string, scope: { courseId?: string; subjectId?: string }, rate: number, today: string) {
    const courseIds = scope.courseId
      ? [scope.courseId]
      : (
          await q
            .select({ id: course.id })
            .from(courseLecturer)
            .innerJoin(course, eq(course.id, courseLecturer.courseId))
            .where(and(eq(courseLecturer.lecturerId, lecturerId), scope.subjectId ? eq(course.subjectId, scope.subjectId) : undefined))
        ).map((c) => c.id);
    if (courseIds.length === 0) return [];
    const [low] = await q
      .select({ amount: sql<string>`min(${feeRate.amount})` })
      .from(feeRate)
      .innerJoin(feeStructure, eq(feeStructure.id, feeRate.feeStructureId))
      .where(and(inArray(feeStructure.courseId, courseIds), eq(feeStructure.isActive, true), lte(feeRate.effectiveFrom, today), or(isNull(feeRate.effectiveTo), gt(feeRate.effectiveTo, today))));
    if (low?.amount && rate > toCents(low.amount)) return [`The fixed amount is more than the lowest current fee (${low.amount}) of the course(s) it covers; the commission will be capped at what is collected.`];
    return [];
  }

  return {
    async create(input: { actor: string; lecturerId: string; scope?: CommissionRuleScope; calcType: (typeof COMMISSION_CALC_TYPES)[number]; rate: string; effectiveFrom: string; effectiveTo?: string | null }) {
      await requirePermission(db, input.actor, "commissions.manage", { branchId: null });
      if (!(COMMISSION_CALC_TYPES as readonly string[]).includes(input.calcType)) throw new ServiceError("invalid_input", "Unknown calculation type.");
      if (!MONEY.test(input.rate)) throw new ServiceError("invalid_input", "The rate must be a number with at most two decimals.");
      const rateCents = toCents(input.rate);
      if (input.calcType === "percent" && rateCents > 10_000) throw new ServiceError("invalid_input", "A percent rate is between 0 and 100.");
      if (!DAY.test(input.effectiveFrom) || (input.effectiveTo != null && !DAY.test(input.effectiveTo))) throw new ServiceError("invalid_input", "Dates look like 2027-01-31.");
      if (input.effectiveTo != null && input.effectiveTo <= input.effectiveFrom) throw new ServiceError("invalid_input", "The end date must be after the start date (it is the first day the rule no longer applies).");
      const scope = (input.scope ?? {}) as { courseId?: string; subjectId?: string; gradeLevelId?: string };
      if (scope.courseId && (scope.subjectId || scope.gradeLevelId)) throw new ServiceError("invalid_input", "A course rule cannot also name a subject or grade.");
      if (scope.gradeLevelId && !scope.subjectId) throw new ServiceError("invalid_input", "A grade needs a subject.");

      try {
        return await db.transaction(async (tx) => {
          const [l] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.id, input.lecturerId));
          if (!l) throw new ServiceError("invalid_input", "Lecturer not found.");
          if (scope.courseId && !(await tx.select({ id: course.id }).from(course).where(eq(course.id, scope.courseId)))[0]) throw new ServiceError("invalid_input", "Course not found.");
          if (scope.subjectId && !(await tx.select({ id: subject.id }).from(subject).where(eq(subject.id, scope.subjectId)))[0]) throw new ServiceError("invalid_input", "Subject not found.");
          if (scope.gradeLevelId && !(await tx.select({ id: gradeLevel.id }).from(gradeLevel).where(eq(gradeLevel.id, scope.gradeLevelId)))[0]) throw new ServiceError("invalid_input", "Grade not found.");
          const clash = await tx
            .select({ id: commissionRule.id })
            .from(commissionRule)
            .where(
              and(
                eq(commissionRule.lecturerId, input.lecturerId),
                scope.courseId ? eq(commissionRule.courseId, scope.courseId) : isNull(commissionRule.courseId),
                scope.subjectId ? eq(commissionRule.subjectId, scope.subjectId) : isNull(commissionRule.subjectId),
                scope.gradeLevelId ? eq(commissionRule.gradeLevelId, scope.gradeLevelId) : isNull(commissionRule.gradeLevelId),
                input.effectiveTo ? sql`${commissionRule.effectiveFrom} < ${input.effectiveTo}` : undefined,
                or(isNull(commissionRule.effectiveTo), gt(commissionRule.effectiveTo, input.effectiveFrom)),
              ),
            )
            .limit(1);
          if (clash.length) throw new ServiceError("rule_overlap", "A rule with the same scope already covers some of these dates. End it first.");
          const [rule] = await tx
            .insert(commissionRule)
            .values({ lecturerId: input.lecturerId, courseId: scope.courseId ?? null, subjectId: scope.subjectId ?? null, gradeLevelId: scope.gradeLevelId ?? null, calcType: input.calcType, commissionRate: fromCents(rateCents), effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null })
            .returning();
          const warnings = input.calcType === "fixed_per_student_month" ? await fixedRateWarning(tx, input.lecturerId, scope, rateCents, await todayFor(tx, now())) : [];
          await writeAudit(tx, { actor: input.actor, action: "commission_rule.create", entityType: "commission_rule", entityId: rule!.id, after: { lecturerId: input.lecturerId, scope, calcType: input.calcType, rate: rule!.commissionRate, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null } });
          return { rule: rule!, warnings };
        });
      } catch (err) {
        if (isExclusionViolation(err)) throw new ServiceError("rule_overlap", "A rule with the same scope already covers some of these dates. End it first.");
        throw err;
      }
    },

    /** Sets the first day a rule no longer applies. It can close an open rule or shorten one, never extend it. */
    async end(input: { ruleId: string; actor: string; effectiveTo: string }) {
      await requirePermission(db, input.actor, "commissions.manage", { branchId: null });
      if (!DAY.test(input.effectiveTo)) throw new ServiceError("invalid_input", "Dates look like 2027-01-31.");
      return db.transaction(async (tx) => {
        const [cur] = await tx.select().from(commissionRule).where(eq(commissionRule.id, input.ruleId));
        if (!cur) throw new ServiceError("not_found", "Commission rule not found.");
        if (input.effectiveTo <= cur.effectiveFrom) throw new ServiceError("invalid_input", "The end date must be after the rule's start date.");
        if (cur.effectiveTo && input.effectiveTo >= cur.effectiveTo) throw new ServiceError("invalid_input", "A rule can only be shortened, not extended.");
        const [row] = await tx.update(commissionRule).set({ effectiveTo: input.effectiveTo }).where(eq(commissionRule.id, cur.id)).returning();
        await writeAudit(tx, { actor: input.actor, action: "commission_rule.end", entityType: "commission_rule", entityId: cur.id, before: { effectiveTo: cur.effectiveTo }, after: { effectiveTo: input.effectiveTo } });
        return row!;
      });
    },

    /** Deletes a rule that no earning has used. A used rule is ended instead, so history keeps its rule. */
    async remove(input: { ruleId: string; actor: string }) {
      await requirePermission(db, input.actor, "commissions.manage", { branchId: null });
      await db.transaction(async (tx) => {
        const [cur] = await tx.select().from(commissionRule).where(eq(commissionRule.id, input.ruleId));
        if (!cur) throw new ServiceError("not_found", "Commission rule not found.");
        const [used] = await tx.select({ id: commissionEntry.id }).from(commissionEntry).where(eq(commissionEntry.ruleId, cur.id)).limit(1);
        if (used) throw new ServiceError("rule_in_use", "Earnings were calculated with this rule. End it instead of deleting it.");
        await tx.delete(commissionRule).where(eq(commissionRule.id, cur.id));
        await writeAudit(tx, { actor: input.actor, action: "commission_rule.remove", entityType: "commission_rule", entityId: cur.id, before: { lecturerId: cur.lecturerId, courseId: cur.courseId, subjectId: cur.subjectId, gradeLevelId: cur.gradeLevelId, calcType: cur.calcType, rate: cur.commissionRate, effectiveFrom: cur.effectiveFrom, effectiveTo: cur.effectiveTo } });
      });
    },

    /** Rules, newest first. `activeOn` keeps only those that apply on that day. */
    async list(input: { actor: string; lecturerId?: string; activeOn?: string }) {
      await requirePermission(db, input.actor, "commissions.manage", { branchId: null });
      if (input.activeOn && !DAY.test(input.activeOn)) throw new ServiceError("invalid_input", "Dates look like 2027-01-31.");
      return db
        .select()
        .from(commissionRule)
        .where(
          and(
            input.lecturerId ? eq(commissionRule.lecturerId, input.lecturerId) : undefined,
            input.activeOn ? and(lte(commissionRule.effectiveFrom, input.activeOn), or(isNull(commissionRule.effectiveTo), gt(commissionRule.effectiveTo, input.activeOn))) : undefined,
          ),
        )
        .orderBy(asc(commissionRule.lecturerId), sql`${commissionRule.effectiveFrom} desc`, asc(commissionRule.id));
    },
  };
}

export type CommissionRuleService = ReturnType<typeof createCommissionRuleService>;
