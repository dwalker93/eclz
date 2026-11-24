import type { AuthService } from "@workspace/auth";
import { payment } from "@workspace/db/schema";
import {

  branchScope,
  requirePermission,
  ServiceError,
  type AccessControlService,
  type Db,
  type AttendanceService,
  type ContentService,
  type EnrollmentService,
  type ExamService,
  type CommissionRuleService,
  type FeeExceptionService,
  type GuardianService,
  type NoticeService,
  type ReportService,
  type PayoutService,
  type PromotionService,
  type PaymentService,
  type StudentService,
} from "@workspace/domain";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createContentRoutes } from "./content-routes";
import { addAttendanceRoutes } from "./admin-attendance";
import { addCommissionRuleRoutes } from "./admin-commission-rules";
import { addGuardianRoutes } from "./admin-guardians";
import { addMoneyRoutes } from "./admin-money";
import { addNoticeRoutes } from "./admin-notices";
import { addReportRoutes } from "./admin-reports";
import { addStudentRoutes } from "./admin-students";
import { createExamRoutes } from "./exam-routes";
import { jsonBody } from "./http";
import { requirePortalOf, requireReady, withPrincipal, type Env, type SessionConfig } from "./session";

export interface AdminDeps {
  db: Db;
  auth: AuthService;
  acl: AccessControlService;
  payments: PaymentService;
  content: ContentService;
  notices: NoticeService;
  reports: ReportService;
  guardians: GuardianService;
  commissionRules: CommissionRuleService;
  students: StudentService;
  enrollment: EnrollmentService;
  attendance: AttendanceService;
  exams: ExamService;
  feeExceptions: FeeExceptionService;
  promotion: PromotionService;
  payouts: PayoutService;
  session: SessionConfig;
}

const uuid = z.string().uuid();
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const allocation = z.object({ invoiceIds: z.array(uuid).optional(), allocations: z.array(z.object({ invoiceItemId: uuid, amount: money })).optional() });

/**
 * Admin portal routes, mounted at /admin. Every route needs a fully signed-in staff session, then checks the permission in the branch of the
 * thing it touches (I2): the branch is read from the record, never from the request.
 */
export function createAdminRoutes({ db, auth, acl, payments, content, notices, reports, guardians, commissionRules, students, enrollment, attendance, exams, feeExceptions, promotion, payouts, session }: AdminDeps) {
  const app = new Hono<Env>();
  app.use("*", withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, "admin"));

  async function paymentBranch(id: string): Promise<string> {
    const [p] = await db.select({ branchId: payment.branchId }).from(payment).where(eq(payment.id, id));
    if (!p) throw new ServiceError("not_found", "Payment not found.");
    return p.branchId;
  }

  // ---- payments

  /** Payments the caller may verify, newest first. `status` defaults to pending_verification. Scoped to the caller's branches (I2). */
  app.get("/payments", async (c) => {
    const user = c.get("principal").userId;
    const scope = await branchScope(db, user, "payments.verify");
    const status = z.enum(["pending_verification", "verified", "rejected", "voided"]).catch("pending_verification").parse(c.req.query("status"));
    if (scope !== "all" && scope.length === 0) throw new ServiceError("forbidden", "You do not have the payments.verify permission.");
    const rows = await db
      .select()
      .from(payment)
      .where(and(eq(payment.status, status), scope === "all" ? undefined : inArray(payment.branchId, scope)))
      .orderBy(desc(payment.submittedAt))
      .limit(100);
    return c.json({ payments: rows });
  });

  app.post("/payments/:id/verify", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "payments.verify", { branchId: await paymentBranch(id) });
    const b = await jsonBody(c, allocation);
    const ev = await payments.verifyPayment({ paymentId: id, verifiedBy: user, ...b });
    return c.json({ payment: ev.payment, receiptNo: ev.receipt.receiptNo });
  });

  app.post("/payments/:id/reject", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "payments.verify", { branchId: await paymentBranch(id) });
    const b = await jsonBody(c, z.object({ reason: z.string().min(3).max(500) }));
    return c.json({ payment: await payments.rejectPayment({ paymentId: id, rejectedBy: user, ...b }) });
  });

  app.post("/payments/:id/void", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "payments.void", { branchId: await paymentBranch(id) });
    const b = await jsonBody(c, z.object({ reason: z.string().min(3).max(500) }));
    await payments.voidPayment({ paymentId: id, voidedBy: user, ...b });
    return c.json({ ok: true });
  });

  app.post("/payments/cash", async (c) => {
    const user = c.get("principal").userId;
    const b = await jsonBody(c, z.object({ studentId: uuid, branchId: uuid, amount: money, paidOn: z.string().optional(), referenceNo: z.string().max(100).optional() }).and(allocation));
    await requirePermission(db, user, "payments.record_cash", { branchId: b.branchId });
    const ev = await payments.recordCashPayment({ ...b, recordedBy: user });
    return c.json({ payment: ev.payment, receiptNo: ev.receipt.receiptNo });
  });

  // ---- roles and users (organization-wide: an all-branches roles.manage assignment is needed)

  const roleBody = z.object({ userId: uuid, roleName: z.string().min(1).max(100), branchId: uuid.nullish() });

  app.post("/roles/assign", async (c) => {
    const user = c.get("principal").userId;
    await requirePermission(db, user, "roles.manage");
    const b = await jsonBody(c, roleBody);
    return c.json(await acl.assignRole({ ...b, actor: user }));
  });

  app.post("/roles/revoke", async (c) => {
    const user = c.get("principal").userId;
    await requirePermission(db, user, "roles.manage");
    const b = await jsonBody(c, roleBody);
    return c.json({ revoked: await acl.revokeRole({ ...b, actor: user }) });
  });

  app.post("/users/:id/status", async (c) => {
    const user = c.get("principal").userId;
    await requirePermission(db, user, "roles.manage");
    const b = await jsonBody(c, z.object({ status: z.enum(["active", "disabled"]), reason: z.string().max(500).optional() }));
    const row = await acl.setUserStatus({ userId: uuid.parse(c.req.param("id")), actor: user, ...b });
    // Disabling deletes the sessions in the same transaction (setUserStatus), so there is nothing to revoke afterwards.
    return c.json({ id: row.id, status: row.status });
  });

  app.post("/users/:id/reset-mfa", async (c) => {
    await auth.resetMfa({ userId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId });
    return c.json({ ok: true });
  });

  app.post("/guardians/:id/reset-password", async (c) => {
    await auth.resetParentPassword({ guardianId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId });
    return c.json({ ok: true });
  });

  addStudentRoutes(app, { db, students, enrollment });
  addAttendanceRoutes(app, { db, attendance, students });
  addMoneyRoutes(app, { db, feeExceptions, promotion, payouts });
  addNoticeRoutes(app, { notices });
  addReportRoutes(app, { reports });
  addGuardianRoutes(app, { guardians });
  addCommissionRuleRoutes(app, { commissionRules });
  app.route("/exams", createExamRoutes({ db, auth, exams, session }, "admin"));
  app.route("/content", createContentRoutes({ db, auth, content, session }, "admin"));
  return app;
}
