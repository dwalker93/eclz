import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  course,
  courseGradeLevel,
  courseLecturer,
  enrollment,
  gradeLevel,
  invoiceItem,
  promotionItem,
  promotionRun,
  student,
  studentLevel,
} from "@workspace/db/schema";
import { writeAudit } from "./audit";
import { ensureStudentBranch, resolveFeeStructure } from "./enrollment";
import { gradeOn, rateFor, todayFor } from "./lookups";
import { nextMonthStart } from "./dates";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

type Decision = "move" | "stay" | "skip" | "needs_review";

export interface DraftSummary {
  runId: string;
  effectiveDate: string;
  students: number;
  items: number;
  byDecision: Record<Decision, number>;
}

export interface FlaggedItem {
  itemId: string;
  studentId: string;
  reason: "capacity_full" | "duplicate_enrollment" | "fee_structure_required" | "fee_structure_invalid";
  message: string;
}

export type ConfirmResult =
  | { status: "confirmed"; runId: string; studentsAdvanced: number; moved: number; stayed: number; skipped: number }
  | { status: "blocked"; runId: string; flagged: FlaggedItem[] };

class Blocked extends Error {
  constructor(public flagged: FlaggedItem[]) {
    super("promotion blocked");
  }
}

const BLOCKING_CODES = ["capacity_full", "duplicate_enrollment", "fee_structure_required", "fee_structure_invalid"] as const;

export function createPromotionService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function loadDraft(tx: Tx, runId: string, lock = false) {
    const q = tx.select().from(promotionRun).where(eq(promotionRun.id, runId));
    const [run] = lock ? await q.for("update") : await q;
    if (!run) throw new ServiceError("not_found", "Promotion run not found.");
    if (run.status !== "draft") throw new ServiceError("promotion_not_draft", `This run is ${run.status}.`);
    return run;
  }

  return {
    /**
     * B6, C12: builds a draft. One item per active class enrolment of each student who has a grade, or one item with no enrolment
     * for a student who has none. Nothing changes until `confirm`. The effective date defaults to the first day of the next month (C14).
     */
    async createDraft(input: { performedBy: string; effectiveDate?: string; note?: string }): Promise<DraftSummary> {
      return db.transaction(async (tx) => {
        const today = await todayFor(tx, now());
        const effectiveDate = input.effectiveDate ?? nextMonthStart(today);
        const grades = await tx.select().from(gradeLevel).orderBy(asc(gradeLevel.ordinal));
        const byOrdinal = new Map(grades.map((g) => [g.ordinal, g]));
        const gradeById = new Map(grades.map((g) => [g.id, g]));

        const levels = await tx
          .select({ studentId: studentLevel.studentId, gradeLevelId: studentLevel.gradeLevelId })
          .from(studentLevel)
          .innerJoin(student, eq(student.id, studentLevel.studentId))
          .where(and(isNull(studentLevel.toDate), eq(student.status, "active")));

        const enrolments = await tx
          .select({ enr: enrollment, course })
          .from(enrollment)
          .innerJoin(course, eq(course.id, enrollment.courseId))
          .where(and(eq(enrollment.status, "active"), eq(course.kind, "class")));
        const enrByStudent = new Map<string, typeof enrolments>();
        for (const e of enrolments) enrByStudent.set(e.enr.studentId, [...(enrByStudent.get(e.enr.studentId) ?? []), e]);

        const classes = await tx.select().from(course).where(and(eq(course.kind, "class"), eq(course.status, "active")));
        const gradeRows = await tx.select().from(courseGradeLevel);
        const gradeSet = new Map<string, Set<string>>();
        for (const r of gradeRows) gradeSet.set(r.courseId, (gradeSet.get(r.courseId) ?? new Set()).add(r.gradeLevelId));
        const primaries = await tx.select().from(courseLecturer).where(eq(courseLecturer.isPrimary, true));
        const primaryOf = new Map(primaries.map((p) => [p.courseId, p.lecturerId]));

        const [run] = await tx
          .insert(promotionRun)
          .values({ performedBy: input.performedBy, effectiveDate, note: input.note ?? null })
          .returning();

        const items: (typeof promotionItem.$inferInsert)[] = [];
        for (const lv of levels) {
          const current = gradeById.get(lv.gradeLevelId)!;
          const next = byOrdinal.get(current.ordinal + 1);
          const mine = enrByStudent.get(lv.studentId) ?? [];
          if (!next) {
            if (mine.length === 0) items.push({ promotionRunId: run!.id, studentId: lv.studentId, decision: "skip", note: "Highest grade" });
            for (const e of mine) items.push({ promotionRunId: run!.id, studentId: lv.studentId, fromEnrollmentId: e.enr.id, decision: "skip", note: "Highest grade" });
            continue;
          }
          if (mine.length === 0) {
            items.push({ promotionRunId: run!.id, studentId: lv.studentId, decision: "stay", note: "No class enrolment: grade only" });
            continue;
          }
          for (const e of mine) {
            const c = e.course;
            const candidates = classes.filter((t) => {
              if (t.id === c.id || !gradeSet.get(t.id)?.has(next.id)) return false;
              if (c.courseGroupId) return t.courseGroupId === c.courseGroupId;
              return (
                t.subjectId === c.subjectId &&
                t.branchId === c.branchId &&
                primaryOf.get(t.id) === primaryOf.get(c.id) &&
                (t.batchLabel ?? null) === (c.batchLabel ?? null)
              );
            });
            if (candidates.length === 1) {
              items.push({ promotionRunId: run!.id, studentId: lv.studentId, fromEnrollmentId: e.enr.id, toCourseId: candidates[0]!.id, decision: "move" });
            } else {
              items.push({
                promotionRunId: run!.id,
                studentId: lv.studentId,
                fromEnrollmentId: e.enr.id,
                decision: "needs_review",
                note: candidates.length === 0 ? `No class found for ${next.name}` : `Several classes match ${next.name}`,
              });
            }
          }
        }
        for (let i = 0; i < items.length; i += 500) await tx.insert(promotionItem).values(items.slice(i, i + 500));
        const byDecision: Record<Decision, number> = { move: 0, stay: 0, skip: 0, needs_review: 0 };
        for (const it of items) byDecision[it.decision as Decision]++;
        return { runId: run!.id, effectiveDate, students: levels.length, items: items.length, byDecision };
      });
    },

    /** B6: the admin changes one item. `move` needs a target class of the same subject (I3). */
    async updateItem(input: { runId: string; itemId: string; decision: Decision; toCourseId?: string | null; note?: string | null }) {
      return db.transaction(async (tx) => {
        await loadDraft(tx, input.runId, true);
        const [item] = await tx.select().from(promotionItem).where(and(eq(promotionItem.id, input.itemId), eq(promotionItem.promotionRunId, input.runId)));
        if (!item) throw new ServiceError("not_found", "Promotion item not found.");
        if (input.decision === "move") {
          if (!item.fromEnrollmentId) throw new ServiceError("invalid_input", "There is no enrolment to move.");
          if (!input.toCourseId) throw new ServiceError("invalid_input", "Choose the class to move to.");
          const [from] = await tx.select({ courseId: enrollment.courseId }).from(enrollment).where(eq(enrollment.id, item.fromEnrollmentId));
          const [src] = await tx.select().from(course).where(eq(course.id, from!.courseId));
          const [target] = await tx.select().from(course).where(eq(course.id, input.toCourseId));
          if (!target || target.kind !== "class" || target.status !== "active") throw new ServiceError("invalid_input", "The target must be an active class.");
          if (target.id === src!.id) throw new ServiceError("invalid_input", "That is the class the student is already in.");
          if (target.subjectId !== src!.subjectId) throw new ServiceError("invalid_input", "The target class must be the same subject.");
        } else if (input.decision === "stay" && !item.fromEnrollmentId) {
          // grade-only item: fine
        }
        const [row] = await tx
          .update(promotionItem)
          .set({
            decision: input.decision,
            toCourseId: input.decision === "move" ? input.toCourseId! : null,
            note: input.note === undefined ? item.note : input.note,
          })
          .where(eq(promotionItem.id, item.id))
          .returning();
        return row!;
      });
    },

    async setEffectiveDate(input: { runId: string; effectiveDate: string }) {
      return db.transaction(async (tx) => {
        await loadDraft(tx, input.runId, true);
        const [row] = await tx.update(promotionRun).set({ effectiveDate: input.effectiveDate }).where(eq(promotionRun.id, input.runId)).returning();
        return row!;
      });
    },

    /** B8: a draft can be discarded and has no effect. */
    async discardDraft(input: { runId: string; discardedBy: string }) {
      return db.transaction(async (tx) => {
        await loadDraft(tx, input.runId, true);
        const [row] = await tx.update(promotionRun).set({ status: "discarded" }).where(eq(promotionRun.id, input.runId)).returning();
        await writeAudit(tx, { actor: input.discardedBy, action: "promotion.discard", entityType: "promotion_run", entityId: input.runId });
        return row!;
      });
    },

    /**
     * B6, B8, C13 to C15: applies the run once, in one transaction. Students whose items are all `skip` are untouched. Everyone else gets
     * a new grade from the effective date, and each item is applied: a move completes the old enrolment and opens one in the target class,
     * a stay pins the billing grade to the grade before promotion. A move into a full class, a class the student is already in, or a class
     * with no fee option is not applied: nothing changes, those items are flagged `needs_review`, and the result lists them.
     */
    async confirm(input: { runId: string; confirmedBy: string }): Promise<ConfirmResult> {
      try {
        return await db.transaction(async (tx): Promise<ConfirmResult> => {
          const run = await loadDraft(tx, input.runId, true);
          const eff = run.effectiveDate;
          const items = await tx.select().from(promotionItem).where(eq(promotionItem.promotionRunId, run.id)).orderBy(asc(promotionItem.id));
          if (items.some((i) => i.decision === "needs_review")) {
            throw new ServiceError("promotion_unresolved", "Some items still need review. Decide each one before confirming.");
          }

          // C14: no enrolment that leaves its class may have been invoiced past the effective date.
          const leaving = items.filter((i) => i.decision === "move" && i.fromEnrollmentId).map((i) => i.fromEnrollmentId!);
          const fromRows = items.some((i) => i.fromEnrollmentId)
            ? await tx.select().from(enrollment).where(inArray(enrollment.id, items.filter((i) => i.fromEnrollmentId).map((i) => i.fromEnrollmentId!)))
            : [];
          const enrById = new Map(fromRows.map((e) => [e.id, e]));
          for (const i of items) {
            if (i.decision === "skip") continue;
            const e = i.fromEnrollmentId ? enrById.get(i.fromEnrollmentId) : null;
            if (i.fromEnrollmentId && (!e || e.status !== "active")) {
              throw new ServiceError("promotion_stale", "An enrolment in this draft is no longer active. Discard it and build a new draft.");
            }
          }
          if (leaving.length > 0) {
            for (const id of leaving) {
              const e = enrById.get(id)!;
              if (eff <= e.accessStartsOn) throw new ServiceError("promotion_date_invalid", "The effective date must be after the old enrolment started.");
            }
            const billed = await tx
              .select({ enrollmentId: invoiceItem.enrollmentId })
              .from(invoiceItem)
              .where(and(inArray(invoiceItem.enrollmentId, leaving), eq(invoiceItem.kind, "recurring_fee"), isNull(invoiceItem.cancelledAt), sql`${invoiceItem.periodEnd} > ${eff}`));
            if (billed.length > 0) {
              throw new ServiceError("promotion_date_invalid", "A period after the effective date is already invoiced for a class being left. Choose a later date or cancel that invoice.");
            }
          }

          // Group items by student, and advance each student who has at least one item that is not skip.
          const byStudent = new Map<string, typeof items>();
          for (const i of items) byStudent.set(i.studentId, [...(byStudent.get(i.studentId) ?? []), i]);
          const grades = await tx.select().from(gradeLevel);
          const byOrdinal = new Map(grades.map((g) => [g.ordinal, g]));
          const gradeById = new Map(grades.map((g) => [g.id, g]));
          const previousGrade = new Map<string, string>();
          let studentsAdvanced = 0;
          for (const [studentId, list] of byStudent) {
            if (list.every((i) => i.decision === "skip")) continue;
            const [cur] = await tx.select().from(studentLevel).where(and(eq(studentLevel.studentId, studentId), isNull(studentLevel.toDate))).for("update");
            const next = cur ? byOrdinal.get(gradeById.get(cur.gradeLevelId)!.ordinal + 1) : undefined;
            if (!cur || !next) throw new ServiceError("promotion_stale", "A student in this draft has no next grade any more. Discard it and build a new draft.");
            if (cur.fromDate >= eff) throw new ServiceError("promotion_date_invalid", "The effective date must be after the student's current grade started.");
            await tx.update(studentLevel).set({ toDate: eff }).where(eq(studentLevel.id, cur.id));
            await tx.insert(studentLevel).values({ studentId, gradeLevelId: next.id, promotionRunId: run.id, fromDate: eff, reason: "promotion" });
            previousGrade.set(studentId, cur.gradeLevelId);
            studentsAdvanced++;
          }

          // Phase A: end every old enrolment that moves, so seats it frees count for the classes behind it.
          for (const i of items) {
            if (i.decision !== "move" || !i.fromEnrollmentId) continue;
            const e = enrById.get(i.fromEnrollmentId)!;
            await tx
              .update(enrollment)
              .set({ status: "completed", endReason: "promoted", accessEndsOn: e.accessEndsOn && e.accessEndsOn < eff ? e.accessEndsOn : eff })
              .where(eq(enrollment.id, e.id));
          }

          // Phase B: open the new enrolments, collecting every item that cannot be placed (C15).
          const flagged: FlaggedItem[] = [];
          let moved = 0;
          let stayed = 0;
          let skipped = 0;
          const targets = [...new Set(items.filter((i) => i.decision === "move").map((i) => i.toCourseId!))].sort();
          const locked = new Map<string, typeof course.$inferSelect>();
          for (const id of targets) {
            const [c] = await tx.select().from(course).where(eq(course.id, id)).for("update");
            if (c) locked.set(id, c);
          }
          for (const i of items) {
            if (i.decision === "skip") {
              skipped++;
              continue;
            }
            if (i.decision === "stay") {
              stayed++;
              if (i.fromEnrollmentId) {
                const e = enrById.get(i.fromEnrollmentId)!;
                const pin = previousGrade.get(i.studentId);
                if (pin && !e.billingGradeLevelId) await tx.update(enrollment).set({ billingGradeLevelId: pin }).where(eq(enrollment.id, e.id));
              }
              continue;
            }
            const old = enrById.get(i.fromEnrollmentId!)!;
            const target = locked.get(i.toCourseId!);
            try {
              await tx.transaction(async (sp) => {
                if (!target || target.status !== "active") throw new ServiceError("fee_structure_invalid", "The target class is not open.");
                if (target.capacity !== null) {
                  const [n] = await sp
                    .select({ n: sql<number>`count(*)::int` })
                    .from(enrollment)
                    .where(and(eq(enrollment.courseId, target.id), eq(enrollment.status, "active")));
                  if (n!.n >= target.capacity) throw new ServiceError("capacity_full", "The target class is full.");
                }
                const [dup] = await sp
                  .select({ id: enrollment.id })
                  .from(enrollment)
                  .where(and(eq(enrollment.studentId, i.studentId), eq(enrollment.courseId, target.id), eq(enrollment.status, "active")));
                if (dup) throw new ServiceError("duplicate_enrollment", "The student is already in the target class.");
                const structure = await resolveFeeStructure(sp, target, {});
                const [created] = await sp
                  .insert(enrollment)
                  .values({
                    courseId: target.id,
                    studentId: i.studentId,
                    feeStructureId: structure.id,
                    preferredMode: old.preferredMode,
                    promotedFromEnrollmentId: old.id,
                    enrolledOn: eff,
                    accessStartsOn: eff,
                  })
                  .returning();
                await ensureStudentBranch(sp, i.studentId, target.branchId, eff);
                await sp.update(promotionItem).set({ toEnrollmentId: created!.id }).where(eq(promotionItem.id, i.id));
              });
              moved++;
            } catch (err) {
              if (err instanceof ServiceError && (BLOCKING_CODES as readonly string[]).includes(err.code)) {
                flagged.push({ itemId: i.id, studentId: i.studentId, reason: err.code as FlaggedItem["reason"], message: err.message });
              } else throw err;
            }
          }
          if (flagged.length > 0) throw new Blocked(flagged); // rolls everything back

          await tx.update(promotionRun).set({ status: "confirmed", confirmedAt: now() }).where(eq(promotionRun.id, run.id));
          await writeAudit(tx, {
            actor: input.confirmedBy,
            action: "promotion.confirm",
            entityType: "promotion_run",
            entityId: run.id,
            after: { effectiveDate: eff, studentsAdvanced, moved, stayed, skipped },
          });
          return { status: "confirmed", runId: run.id, studentsAdvanced, moved, stayed, skipped };
        });
      } catch (err) {
        if (!(err instanceof Blocked)) throw err;
        // The failed attempt changed nothing. Flag the items so the admin can fix them, then confirm again.
        await db.transaction(async (tx) => {
          for (const f of err.flagged) await tx.update(promotionItem).set({ decision: "needs_review", note: f.message }).where(eq(promotionItem.id, f.itemId));
        });
        return { status: "blocked", runId: input.runId, flagged: err.flagged };
      }
    },

    /**
     * B8: clears a pinned billing grade so the enrolment bills at the student's current grade. Refused if the class has no rate
     * for that grade (or an all-grades rate) on the date, so billing never fails because of a cleared pin.
     */
    async clearBillingGrade(input: { enrollmentId: string; clearedBy: string; reason: string; fromDate?: string }) {
      if (!input.reason.trim()) throw new ServiceError("reason_required", "A reason is required.");
      return db.transaction(async (tx) => {
        const [enr] = await tx.select().from(enrollment).where(eq(enrollment.id, input.enrollmentId)).for("update");
        if (!enr) throw new ServiceError("not_found", "Enrolment not found.");
        if (!enr.billingGradeLevelId) throw new ServiceError("invalid_input", "This enrolment has no pinned billing grade.");
        if (!enr.feeStructureId) throw new ServiceError("fee_structure_required", "This enrolment has no fee option.");
        const date = input.fromDate ?? (await todayFor(tx, now()));
        const grade = await gradeOn(tx, enr.studentId, date);
        const rate = await rateFor(tx, enr.feeStructureId, grade, date);
        if (rate === null) {
          throw new ServiceError("rate_missing", "The class has no fee rate for the student's current grade. Add the rate, give a fee exception, or move the student first.");
        }
        const [row] = await tx.update(enrollment).set({ billingGradeLevelId: null }).where(eq(enrollment.id, enr.id)).returning();
        await writeAudit(tx, {
          actor: input.clearedBy,
          action: "enrollment.clear_billing_grade",
          entityType: "enrollment",
          entityId: enr.id,
          before: { billingGradeLevelId: enr.billingGradeLevelId },
          after: { billingGradeLevelId: null },
          reason: input.reason.trim(),
        });
        return row!;
      });
    },
  };
}
export type PromotionService = ReturnType<typeof createPromotionService>;
