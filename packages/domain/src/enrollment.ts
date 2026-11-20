import { and, asc, eq, sql } from "drizzle-orm";
import { course, courseGradeLevel, enrollment, feeStructure, installmentOption, intake, student, studentBranch } from "@workspace/db/schema";
import { writeAudit, isConstraintError } from "./audit";
import { addDays, addMonths, buildInstallmentSchedule, percentOf } from "./dates";
import { insertInvoice, type DraftItem } from "./invoicing";
import { gradeOn, rateFor, todayFor } from "./lookups";
import { toCents } from "@workspace/db/money";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

export interface EnrollInput {
  studentId: string;
  courseId: string;
  intakeId?: string | null;
  /** Leave out to use the class default (D1). */
  feeStructureId?: string | null;
  preferredMode?: "physical" | "online" | null;
  /** Packages only: an installment plan of the chosen fee structure (D10). */
  installmentOptionId?: string | null;
  /** C6: enrol a student whose grade is not on the course's list. Needs a reason and is audited. */
  gradeOverride?: { by: string; reason: string };
  promotedFromEnrollmentId?: string | null;
  billingGradeLevelId?: string | null;
  /** Due date offset of a package invoice without installments. Default 7 days. */
  dueAfterDays?: number;
  actorUserId?: string;
}

/**
 * D1, D12: the fee option for a new enrolment: the one given, else the default (an intake default first), else the only active one.
 * Returns null for a free course, one that has no fee structure at all (a free enrolment has no fee structure and is never invoiced).
 * A course that has fee structures but no usable default, or several to choose from, still needs a choice (`fee_structure_required`).
 */
export async function resolveFeeStructure(
  tx: Tx,
  c: { id: string },
  input: { feeStructureId?: string | null; intakeId?: string | null },
): Promise<typeof feeStructure.$inferSelect | null> {
  const forCourse = and(eq(feeStructure.courseId, c.id), eq(feeStructure.isActive, true));
  const usable = (s: typeof feeStructure.$inferSelect) => !s.intakeId || s.intakeId === (input.intakeId ?? null);
  if (input.feeStructureId) {
    const [s] = await tx.select().from(feeStructure).where(eq(feeStructure.id, input.feeStructureId));
    if (!s || s.courseId !== c.id || !s.isActive || !usable(s)) {
      throw new ServiceError("fee_structure_invalid", "That fee option does not belong to this course or intake, or is not active.");
    }
    return s;
  }
  const all = (await tx.select().from(feeStructure).where(forCourse).orderBy(asc(feeStructure.createdAt))).filter(usable);
  const defaults = all.filter((s) => s.isDefault);
  // An intake-specific default wins over the course-wide one.
  const pick = defaults.find((s) => s.intakeId) ?? defaults[0] ?? (all.length === 1 ? all[0] : undefined);
  if (pick) return pick;
  // No fee structure of any kind (active or not, for any intake): the course is free.
  const [anyStructure] = await tx.select({ id: feeStructure.id }).from(feeStructure).where(eq(feeStructure.courseId, c.id)).limit(1);
  if (!anyStructure) return null;
  throw new ServiceError("fee_structure_required", "Choose a fee option: this course has no default.");
}

/**
 * B7: the student belongs to the course's branch. The first branch they get is the primary one.
 * Locks the student row first, so two concurrent writers for one student (different courses, so different course locks) cannot both see no
 * membership and both insert a primary one. The conflict target is the (student, branch) pair, so only a repeat of the same membership is skipped
 * and a primary-index conflict would still raise.
 */
export async function ensureStudentBranch(tx: Tx, studentId: string, branchId: string, joinedOn: string) {
  await tx.select({ id: student.id }).from(student).where(eq(student.id, studentId)).for("update");
  const [anyBranch] = await tx.select({ b: studentBranch.branchId }).from(studentBranch).where(eq(studentBranch.studentId, studentId));
  await tx.insert(studentBranch).values({ studentId, branchId, isPrimary: !anyBranch, joinedOn })
    .onConflictDoNothing({ target: [studentBranch.studentId, studentBranch.branchId] });
}

export function createEnrollmentService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  return {
    /**
     * C1 to C6, C10, D1, D12, B7: enrols a student. Locks the course row so capacity cannot be oversold, resolves the fee option,
     * sets access dates, and for a one-time package issues its invoice (with installments and surcharge when a plan is chosen).
     */
    async enrollStudent(input: EnrollInput) {
      if (input.gradeOverride && !input.gradeOverride.reason.trim()) throw new ServiceError("reason_required", "An override needs a reason.");
      return db.transaction(async (tx) => {
        const today = await todayFor(tx, now());
        const [c] = await tx.select().from(course).where(eq(course.id, input.courseId)).for("update");
        if (!c) throw new ServiceError("not_found", "Course not found.");
        if (c.status !== "active") throw new ServiceError("course_not_open", "This course is not open for enrolment.");
        const [s] = await tx.select().from(student).where(eq(student.id, input.studentId));
        if (!s) throw new ServiceError("not_found", "Student not found.");
        if (s.status !== "active") throw new ServiceError("student_not_eligible", "Only active students can be enrolled.");

        // C2/C3: the intake rules follow the course type.
        let it: typeof intake.$inferSelect | undefined;
        if (c.kind === "program" && c.learningMode === "scheduled") {
          if (!input.intakeId) throw new ServiceError("intake_invalid", "A scheduled program needs an intake.");
          [it] = await tx.select().from(intake).where(and(eq(intake.id, input.intakeId), eq(intake.courseId, c.id)));
          if (!it) throw new ServiceError("intake_invalid", "That intake does not belong to this program.");
          if (it.status !== "open") throw new ServiceError("intake_invalid", "That intake is not open for enrolment.");
        } else if (input.intakeId) {
          throw new ServiceError("intake_invalid", "This course does not use intakes.");
        }

        // C4: one active place per (student, course, intake).
        const dup = await tx
          .select({ id: enrollment.id })
          .from(enrollment)
          .where(
            and(
              eq(enrollment.studentId, s.id),
              eq(enrollment.courseId, c.id),
              eq(enrollment.status, "active"),
              it ? eq(enrollment.intakeId, it.id) : sql`${enrollment.intakeId} IS NULL`,
            ),
          );
        if (dup.length > 0) throw new ServiceError("duplicate_enrollment", "The student is already enrolled here.");

        // C5: capacity of the course and of the intake, counted under the course lock.
        const count = async (intakeId?: string) => {
          const [r] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(enrollment)
            .where(and(eq(enrollment.courseId, c.id), eq(enrollment.status, "active"), intakeId ? eq(enrollment.intakeId, intakeId) : sql`true`));
          return r!.n;
        };
        // The course-wide limit applies only to an enrolment without an intake; with an intake, the intake's own capacity decides.
        if (!it && c.capacity !== null && (await count()) >= c.capacity) throw new ServiceError("capacity_full", "This course is full.");
        if (it?.capacity != null && (await count(it.id)) >= it.capacity) throw new ServiceError("capacity_full", "This intake is full.");

        // C6: grade eligibility.
        const allowed = await tx.select({ id: courseGradeLevel.gradeLevelId }).from(courseGradeLevel).where(eq(courseGradeLevel.courseId, c.id));
        const grade = await gradeOn(tx, s.id, today);
        if (allowed.length > 0 && !(grade && allowed.some((a) => a.id === grade))) {
          if (!input.gradeOverride) throw new ServiceError("grade_not_allowed", "The student's grade is not one this course serves.");
          await writeAudit(tx, {
            actor: input.gradeOverride.by,
            action: "enrollment.grade_override",
            entityType: "student",
            entityId: s.id,
            after: { courseId: c.id, grade },
            reason: input.gradeOverride.reason.trim(),
          });
        }

        const structure = await resolveFeeStructure(tx, c, input);
        const isPackage = structure?.billingType === "one_time_package";
        if (input.installmentOptionId && !isPackage) {
          throw new ServiceError("invalid_input", "Installments are only for one-time packages.");
        }
        const accessEnds = structure && isPackage && structure.accessDurationMonths ? addMonths(today, structure.accessDurationMonths) : null;

        const [enr] = await tx
          .insert(enrollment)
          .values({
            courseId: c.id,
            studentId: s.id,
            intakeId: it?.id ?? null,
            feeStructureId: structure?.id ?? null,
            billingGradeLevelId: input.billingGradeLevelId ?? null,
            preferredMode: input.preferredMode ?? null,
            promotedFromEnrollmentId: input.promotedFromEnrollmentId ?? null,
            enrolledOn: today,
            accessStartsOn: today,
            accessEndsOn: accessEnds,
          })
          .returning()
          .catch((err) => {
            if (isConstraintError(err, "enrollment_one_active_no_intake_uq") || isConstraintError(err, "enrollment_one_active_per_intake_uq")) {
              throw new ServiceError("duplicate_enrollment", "The student is already enrolled here.");
            }
            throw err;
          });

        await ensureStudentBranch(tx, s.id, c.branchId, today);

        let invoiceId: string | null = null;
        if (structure && isPackage) {
          const billingGrade = enr!.billingGradeLevelId ?? grade;
          const rate = await rateFor(tx, structure.id, billingGrade, today);
          if (rate === null) throw new ServiceError("rate_missing", `No fee rate for ${structure.name} today. The enrolment was not created.`);
          const base = toCents(rate);
          const items: DraftItem[] = [
            { kind: "package_fee", cents: base, enrollmentId: enr!.id, feeStructureId: structure.id, gradeLevelId: billingGrade, description: structure.name },
          ];
          let schedule;
          let due = addDays(today, input.dueAfterDays ?? 7);
          if (input.installmentOptionId) {
            const [plan] = await tx.select().from(installmentOption).where(eq(installmentOption.id, input.installmentOptionId));
            if (!plan || plan.feeStructureId !== structure.id || !plan.isActive) {
              throw new ServiceError("invalid_input", "That installment plan does not belong to this fee option or is not active.");
            }
            const surcharge = percentOf(base, plan.surchargePercent);
            if (surcharge > 0) items.push({ kind: "adjustment", cents: surcharge, description: `${plan.name} surcharge`, enrollmentId: enr!.id });
            try {
              schedule = buildInstallmentSchedule({
                total: base + surcharge,
                count: plan.installmentCount,
                downPaymentPercent: plan.downPaymentPercent,
                intervalDays: plan.intervalDays,
                issuedOn: today,
              });
            } catch (e) {
              throw new ServiceError("invalid_input", (e as Error).message);
            }
            due = schedule[schedule.length - 1]!.dueDate;
          }
          const created = await insertInvoice(tx, {
            studentId: s.id,
            branchId: c.branchId,
            issuedOn: today,
            dueDate: due,
            items,
            installmentOptionId: input.installmentOptionId ?? null,
            installments: schedule,
          });
          invoiceId = created.invoice.id;
        }
        if (input.actorUserId) {
          await writeAudit(tx, { actor: input.actorUserId, action: "enrollment.create", entityType: "enrollment", entityId: enr!.id, after: { courseId: c.id, studentId: s.id } });
        }
        return { enrollment: enr!, invoiceId };
      });
    },

    /** C7: ends an enrolment. Access stops today, history and invoices stay. */
    async dropEnrollment(input: { enrollmentId: string; actorUserId?: string; reason?: string }) {
      return db.transaction(async (tx) => {
        const today = await todayFor(tx, now());
        const [enr] = await tx.select().from(enrollment).where(eq(enrollment.id, input.enrollmentId)).for("update");
        if (!enr) throw new ServiceError("not_found", "Enrolment not found.");
        if (enr.status !== "active") throw new ServiceError("invalid_input", "Only an active enrolment can be dropped.");
        const ends = today > enr.accessStartsOn ? today : addDays(enr.accessStartsOn, 1);
        const keep = enr.accessEndsOn && enr.accessEndsOn < ends ? enr.accessEndsOn : ends;
        const [row] = await tx
          .update(enrollment)
          .set({ status: "dropped", endReason: "dropped", accessEndsOn: keep })
          .where(eq(enrollment.id, enr.id))
          .returning();
        if (input.actorUserId) {
          await writeAudit(tx, {
            actor: input.actorUserId,
            action: "enrollment.drop",
            entityType: "enrollment",
            entityId: enr.id,
            before: { status: enr.status },
            after: { status: "dropped" },
            reason: input.reason,
          });
        }
        return row!;
      });
    },
  };
}
export type EnrollmentService = ReturnType<typeof createEnrollmentService>;
