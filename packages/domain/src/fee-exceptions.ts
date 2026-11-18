import { and, eq } from "drizzle-orm";
import { enrollment, feeException, feeStructure } from "@workspace/db/schema";
import { writeAudit, isConstraintError } from "./audit";
import { loadOrganization, todayFor } from "./lookups";
import { ServiceError } from "./errors";
import { type Db } from "./types";

export interface CreateFeeException {
  enrollmentId: string;
  kind: "alternate_option" | "discount";
  alternateFeeStructureId?: string;
  discountType?: "percent" | "fixed";
  discountValue?: string;
  effectiveFrom: string;
  /** Exclusive end. */
  effectiveTo?: string | null;
  reason: string;
  createdBy: string;
}

export function createFeeExceptionService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();
  return {
    /** D15 to D22: needs the fee_exceptions module to be on. Ones already created keep applying if it is later switched off (D21). */
    async createFeeException(input: CreateFeeException) {
      if (!input.reason.trim()) throw new ServiceError("reason_required", "A reason is required.");
      return db.transaction(async (tx) => {
        const org = await loadOrganization(tx);
        if ((org.enabledModules as Record<string, boolean>)?.fee_exceptions !== true) {
          throw new ServiceError("module_disabled", "Fee exceptions are not switched on.");
        }
        const [enr] = await tx.select().from(enrollment).where(eq(enrollment.id, input.enrollmentId));
        if (!enr) throw new ServiceError("not_found", "Enrolment not found.");
        if (enr.status !== "active") throw new ServiceError("exception_invalid", "The enrolment is not active.");
        if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) {
          throw new ServiceError("exception_invalid", "The end date must be after the start date.");
        }
        if (input.kind === "alternate_option") {
          if (!input.alternateFeeStructureId || input.discountType || input.discountValue) {
            throw new ServiceError("exception_invalid", "An alternate option needs only the other fee option.");
          }
          const [alt] = await tx.select().from(feeStructure).where(eq(feeStructure.id, input.alternateFeeStructureId));
          if (!alt || alt.courseId !== enr.courseId || !alt.isActive) {
            throw new ServiceError("exception_invalid", "The alternate option must be an active option of the same class.");
          }
          if (alt.billingType !== "recurring") throw new ServiceError("exception_invalid", "The alternate option must be a recurring fee.");
        } else {
          if (!input.discountType || input.discountValue === undefined || input.alternateFeeStructureId) {
            throw new ServiceError("exception_invalid", "A discount needs a type and a value.");
          }
          const v = Number(input.discountValue);
          if (!(v > 0) || (input.discountType === "percent" && v > 100)) {
            throw new ServiceError("exception_invalid", "The discount value is out of range.");
          }
        }
        try {
          const [row] = await tx
            .insert(feeException)
            .values({
              enrollmentId: enr.id,
              courseId: enr.courseId,
              kind: input.kind,
              alternateFeeStructureId: input.alternateFeeStructureId ?? null,
              discountType: input.discountType ?? null,
              discountValue: input.discountValue ?? null,
              effectiveFrom: input.effectiveFrom,
              effectiveTo: input.effectiveTo ?? null,
              reason: input.reason.trim(),
              createdBy: input.createdBy,
            })
            .returning();
          await writeAudit(tx, { actor: input.createdBy, action: "fee_exception.create", entityType: "fee_exception", entityId: row!.id, after: row, reason: input.reason.trim() });
          return row!;
        } catch (err) {
          if (isConstraintError(err, "fee_exception_no_overlap")) {
            throw new ServiceError("exception_invalid", "Another exception of this kind already covers those dates.");
          }
          throw err;
        }
      });
    },

    /** Ends an exception (D18). Never deleted. Periods already invoiced are not changed. */
    async endFeeException(input: { exceptionId: string; endedBy: string; effectiveTo?: string }) {
      return db.transaction(async (tx) => {
        const today = input.effectiveTo ?? (await todayFor(tx, now()));
        const [ex] = await tx.select().from(feeException).where(eq(feeException.id, input.exceptionId)).for("update");
        if (!ex) throw new ServiceError("not_found", "Exception not found.");
        if (ex.effectiveTo && ex.effectiveTo <= today) throw new ServiceError("exception_invalid", "It has already ended.");
        if (today <= ex.effectiveFrom) throw new ServiceError("exception_invalid", "The end date must be after the start date.");
        const [row] = await tx.update(feeException).set({ effectiveTo: today, endedBy: input.endedBy }).where(and(eq(feeException.id, ex.id))).returning();
        await writeAudit(tx, { actor: input.endedBy, action: "fee_exception.end", entityType: "fee_exception", entityId: ex.id, before: { effectiveTo: ex.effectiveTo }, after: { effectiveTo: today } });
        return row!;
      });
    },
  };
}
export type FeeExceptionService = ReturnType<typeof createFeeExceptionService>;
