import { course, enrollment, feeException } from "@workspace/db/schema";
import { isCalendarDay, requirePermission, ServiceError, type Db, type FeeExceptionService, type PayoutService, type PromotionService } from "@workspace/domain";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import type { Env } from "./session";

const uuid = z.string().uuid();
const day = z.string().refine(isCalendarDay, "Use a real calendar date like 2027-03-31.");
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const reason = z.string().trim().min(3).max(500);

export interface MoneyRouteDeps {
  db: Db;
  feeExceptions: FeeExceptionService;
  promotion: PromotionService;
  payouts: PayoutService;
}

/**
 * Fee exceptions, yearly promotion and teacher payouts of the admin portal. Fee exceptions use the branch of their course. Promotion and
 * payouts span the whole institute (every student and every branch's commission), so they need an all-branches assignment (I2).
 */
export function addMoneyRoutes(app: Hono<Env>, { db, feeExceptions, promotion, payouts }: MoneyRouteDeps) {
  async function enrollmentBranch(enrollmentId: string): Promise<string> {
    const [r] = await db.select({ branchId: course.branchId }).from(enrollment).innerJoin(course, eq(course.id, enrollment.courseId)).where(eq(enrollment.id, enrollmentId));
    if (!r) throw new ServiceError("not_found", "Enrolment not found.");
    return r.branchId;
  }
  const orgWide = (c: { get: (k: "principal") => { userId: string } }, code: "promotion.run" | "payouts.manage") => requirePermission(db, c.get("principal").userId, code);

  // ---- fee exceptions

  app.post("/fee-exceptions", async (c) => {
    const user = c.get("principal").userId;
    const b = await jsonBody(
      c,
      z.object({
        enrollmentId: uuid,
        kind: z.enum(["alternate_option", "discount"]),
        alternateFeeStructureId: uuid.optional(),
        discountType: z.enum(["percent", "fixed"]).optional(),
        discountValue: money.optional(),
        effectiveFrom: day,
        effectiveTo: day.nullish(),
        reason,
      }),
    );
    await requirePermission(db, user, "fees.override", { branchId: await enrollmentBranch(b.enrollmentId) });
    return c.json({ exception: await feeExceptions.createFeeException({ ...b, createdBy: user }) }, 201);
  });

  app.post("/fee-exceptions/:id/end", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    const [ex] = await db.select({ enrollmentId: feeException.enrollmentId }).from(feeException).where(eq(feeException.id, id));
    if (!ex) throw new ServiceError("not_found", "Exception not found.");
    await requirePermission(db, user, "fees.override", { branchId: await enrollmentBranch(ex.enrollmentId) });
    const b = await jsonBody(c, z.object({ effectiveTo: day.optional() }));
    return c.json({ exception: await feeExceptions.endFeeException({ exceptionId: id, endedBy: user, effectiveTo: b.effectiveTo }) });
  });

  // ---- promotion

  app.post("/promotion/runs", async (c) => {
    await orgWide(c, "promotion.run");
    const b = await jsonBody(c, z.object({ effectiveDate: day.optional(), note: z.string().max(300).optional() }));
    return c.json(await promotion.createDraft({ ...b, performedBy: c.get("principal").userId }), 201);
  });

  app.get("/promotion/runs/:id", async (c) => {
    await orgWide(c, "promotion.run");
    return c.json(await promotion.getRun({ runId: uuid.parse(c.req.param("id")) }));
  });

  app.put("/promotion/runs/:id/items/:itemId", async (c) => {
    await orgWide(c, "promotion.run");
    const b = await jsonBody(c, z.object({ decision: z.enum(["move", "stay", "skip", "needs_review"]), toCourseId: uuid.nullish(), note: z.string().max(300).nullish() }));
    return c.json({ item: await promotion.updateItem({ runId: uuid.parse(c.req.param("id")), itemId: uuid.parse(c.req.param("itemId")), ...b }) });
  });

  app.put("/promotion/runs/:id/effective-date", async (c) => {
    await orgWide(c, "promotion.run");
    const b = await jsonBody(c, z.object({ effectiveDate: day }));
    return c.json({ run: await promotion.setEffectiveDate({ runId: uuid.parse(c.req.param("id")), ...b }) });
  });

  app.post("/promotion/runs/:id/discard", async (c) => {
    await orgWide(c, "promotion.run");
    return c.json({ run: await promotion.discardDraft({ runId: uuid.parse(c.req.param("id")), discardedBy: c.get("principal").userId }) });
  });

  app.post("/promotion/runs/:id/confirm", async (c) => {
    await orgWide(c, "promotion.run");
    const r = await promotion.confirm({ runId: uuid.parse(c.req.param("id")), confirmedBy: c.get("principal").userId });
    return c.json(r, r.status === "blocked" ? 409 : 200);
  });

  app.post("/enrollments/:id/clear-billing-grade", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "fees.override", { branchId: await enrollmentBranch(id) });
    const b = await jsonBody(c, z.object({ reason, fromDate: day.optional() }));
    return c.json(await promotion.clearBillingGrade({ enrollmentId: id, clearedBy: user, ...b }));
  });

  // ---- payouts

  app.get("/payouts/preview", async (c) => {
    await orgWide(c, "payouts.manage");
    const q = z.object({ lecturerId: uuid, periodEnd: day.optional() }).parse(c.req.query());
    return c.json(await payouts.previewPayout(q));
  });

  app.get("/payouts", async (c) => {
    await orgWide(c, "payouts.manage");
    const q = z.object({ lecturerId: uuid.optional(), status: z.enum(["draft", "approved", "paid"]).optional() }).parse(c.req.query());
    return c.json({ payouts: await payouts.listPayouts(q) });
  });

  app.get("/payouts/:id", async (c) => {
    await orgWide(c, "payouts.manage");
    return c.json(await payouts.getPayout({ payoutId: uuid.parse(c.req.param("id")) }));
  });

  app.post("/payouts", async (c) => {
    await orgWide(c, "payouts.manage");
    const b = await jsonBody(c, z.object({ lecturerId: uuid, periodEnd: day, periodStart: day.optional() }));
    const r = await payouts.createPayout({ ...b, createdBy: c.get("principal").userId });
    return c.json(r, r.status === "created" ? 201 : 200);
  });

  app.post("/payouts/:id/refresh", async (c) => {
    await orgWide(c, "payouts.manage");
    return c.json(await payouts.refreshDraft({ payoutId: uuid.parse(c.req.param("id")) }));
  });

  app.post("/payouts/:id/approve", async (c) => {
    await orgWide(c, "payouts.manage");
    // Same top-level shape as refresh: { payout, pulledReversals }.
    return c.json(await payouts.approvePayout({ payoutId: uuid.parse(c.req.param("id")), approvedBy: c.get("principal").userId }));
  });

  app.post("/payouts/:id/paid", async (c) => {
    await orgWide(c, "payouts.manage");
    const b = await jsonBody(c, z.object({ paymentReference: z.string().trim().min(1).max(100), paidOn: day.nullish(), proofFileId: uuid.nullish() }));
    return c.json({ payout: await payouts.markPaid({ payoutId: uuid.parse(c.req.param("id")), paidBy: c.get("principal").userId, ...b }) });
  });

  app.post("/payouts/:id/discard", async (c) => {
    await orgWide(c, "payouts.manage");
    const b = await jsonBody(c, z.object({ reason: z.string().max(300).optional() }));
    return c.json(await payouts.discardDraft({ payoutId: uuid.parse(c.req.param("id")), discardedBy: c.get("principal").userId, ...b }));
  });
}
