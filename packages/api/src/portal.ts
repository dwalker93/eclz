import type { AuthService } from "@workspace/auth";
import { guardian, student, studentGuardian } from "@workspace/db/schema";
import { contentPurchase } from "@workspace/db/schema";
import { canAccessStudent, ServiceError, type AttendanceService, type ContentService, type Db, type ExamService, type NoticeService, type PayoutService } from "@workspace/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import { requirePortalOf, requireReady, withPrincipal, type Env, type SessionConfig } from "./session";

export interface PortalDeps {
  db: Db;
  auth: AuthService;
  content: ContentService;
  notices: NoticeService;
  attendance: AttendanceService;
  exams: ExamService;
  payouts: PayoutService;
  session: SessionConfig;
}

/** Student portal at /student and parent portal at /parent. Who may see which student is decided by `canAccessStudent` (A1, I2). */
export function createPortalRoutes({ db, auth, content, notices, attendance, exams, payouts, session }: PortalDeps) {
  const student_ = new Hono<Env>();
  student_.use("*", withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, "student"));
  student_.get("/notices", async (c) => c.json({ notices: await notices.listForStudent(c.get("principal").identity.studentId!) }));
  student_.get("/content", async (c) => c.json(await content.listForStudent({ studentId: c.get("principal").identity.studentId! })));
  student_.get("/content/:id", async (c) =>
    c.json(await content.openContent({ studentId: c.get("principal").identity.studentId!, contentId: z.string().uuid().parse(c.req.param("id")) })),
  );

  student_.post("/content/:id/purchase", async (c) => {
    const b = await jsonBody(c, z.object({ branchId: z.string().uuid().optional() }));
    const r = await content.purchase({ contentId: z.string().uuid().parse(c.req.param("id")), studentId: c.get("principal").identity.studentId!, ...b });
    return c.json(r, 201);
  });
  student_.post("/purchases/:id/cancel", async (c) => {
    const purchaseId = z.string().uuid().parse(c.req.param("id"));
    const [p] = await db.select({ studentId: contentPurchase.studentId }).from(contentPurchase).where(eq(contentPurchase.id, purchaseId));
    if (!p || p.studentId !== c.get("principal").identity.studentId) throw new ServiceError("not_found", "Purchase not found.");
    return c.json({ purchase: await content.cancelPurchase({ purchaseId }) });
  });

  const me = (c: { get: (k: "principal") => { identity: { studentId: string | null } } }) => c.get("principal").identity.studentId!;
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const range = z.object({ courseId: z.string().uuid().optional(), from: day.optional(), to: day.optional() });

  student_.get("/attendance", async (c) => c.json(await attendance.studentSummary({ studentId: me(c), ...range.parse(c.req.query()) })));

  // exams: the student is always the signed-in student, so no one can sit or read another student's attempt
  student_.post("/exams/:id/attempts", async (c) => c.json(await exams.startAttempt({ examId: z.string().uuid().parse(c.req.param("id")), studentId: me(c) }), 201));
  student_.get("/attempts/:id", async (c) => c.json(await exams.getAttempt({ attemptId: z.string().uuid().parse(c.req.param("id")), studentId: me(c) })));
  student_.put("/attempts/:id/answers", async (c) => {
    const b = await jsonBody(c, z.object({ answers: z.array(z.object({ examQuestionId: z.string().uuid(), selectedOptionKey: z.string().min(1).max(2).nullable() })).min(1).max(500) }));
    return c.json(await exams.saveAnswers({ attemptId: z.string().uuid().parse(c.req.param("id")), studentId: me(c), answers: b.answers }));
  });
  student_.post("/attempts/:id/submit", async (c) => c.json(await exams.submitAttempt({ attemptId: z.string().uuid().parse(c.req.param("id")), studentId: me(c) })));
  student_.get("/exams/:id/result", async (c) => c.json(await exams.getResultForStudent({ examId: z.string().uuid().parse(c.req.param("id")), studentId: me(c) })));

  const parent = new Hono<Env>();
  parent.use("*", withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, "parent"));
  parent.get("/notices", async (c) => c.json({ notices: await notices.listForGuardian(c.get("principal").identity.guardianId!) }));
  parent.get("/children", async (c) => {
    const guardianId = c.get("principal").identity.guardianId!;
    const rows = await db
      .select({ id: student.id, studentNo: student.studentNo, fullName: student.fullName, status: student.status })
      .from(studentGuardian)
      .innerJoin(student, eq(student.id, studentGuardian.studentId))
      .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
      .where(eq(guardian.id, guardianId));
    return c.json({ children: rows });
  });
  parent.get("/children/:id/content", async (c) => {
    const studentId = z.string().uuid().parse(c.req.param("id"));
    if (!(await canAccessStudent(db, c.get("principal").userId, studentId))) throw new ServiceError("forbidden", "That is not your child.");
    return c.json(await content.listForStudent({ studentId }));
  });
  parent.get("/children/:id/attendance", async (c) => {
    const studentId = z.string().uuid().parse(c.req.param("id"));
    if (!(await canAccessStudent(db, c.get("principal").userId, studentId))) throw new ServiceError("forbidden", "That is not your child.");
    return c.json(await attendance.studentSummary({ studentId, ...range.parse(c.req.query()) }));
  });
  // lecturer statements: only their own, and only once approved (a draft is still the institute's working copy)
  const lecturerPayouts = new Hono<Env>();
  lecturerPayouts.use("*", withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, "lecturer"));
  lecturerPayouts.get("/", async (c) => {
    const lecturerId = c.get("principal").identity.lecturerId!;
    const rows = await payouts.listPayouts({ lecturerId });
    return c.json({ payouts: rows.filter((p) => p.status !== "draft") });
  });
  lecturerPayouts.get("/:id", async (c) => {
    const lecturerId = c.get("principal").identity.lecturerId!;
    const r = await payouts.getPayout({ payoutId: z.string().uuid().parse(c.req.param("id")) });
    if (r.payout.lecturerId !== lecturerId || r.payout.status === "draft") throw new ServiceError("not_found", "Payout not found.");
    return c.json(r);
  });
  return { student: student_, parent, lecturerPayouts };
}
