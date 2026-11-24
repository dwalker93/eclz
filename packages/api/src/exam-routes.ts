import type { AuthService } from "@workspace/auth";
import { exam } from "@workspace/db/schema";
import { examResultScope, isCalendarDay, requireModule, requireResource, ServiceError, type Db, type ExamService, type Resource } from "@workspace/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import { requirePortalOf, requireReady, withPrincipal, type Env, type SessionConfig } from "./session";

const uuid = z.string().uuid();
const marks = z.union([z.string().regex(/^\d{1,6}(\.\d{1,2})?$/), z.number().min(0).max(100000)]);
// Marks that must be above zero (a question's marks, total marks, a weight): the database refuses zero, so it is a 400 here rather than a 500.
const positiveMarks = marks.refine((v) => Number(v) > 0, "Must be above zero.");
const day = z.string().refine(isCalendarDay, "Use a real calendar date like 2027-03-31.");

// A timestamp string with an explicit zone (Z or an offset). z.coerce.date() would turn null into 1970-01-01 and a bare number or a zone-less
// string into a date in the server's zone.
const instant = z.string().datetime({ offset: true }).transform((v) => new Date(v));

const questionBody = z.object({
  body: z.string().min(1).max(2000),
  options: z.array(z.object({ body: z.string().min(1).max(500), isCorrect: z.boolean() })).min(2).max(26),
  defaultMarks: positiveMarks.optional(),
  explanation: z.string().max(2000).optional(),
  imageFileId: uuid.optional(),
});

const examBody = z.object({
  lecturerId: uuid.optional(),
  title: z.string().min(1).max(200),
  mode: z.enum(["online_mcq", "paper"]),
  courseIds: z.array(uuid).min(1).max(20),
  examDate: day.optional(),
  maxMarks: positiveMarks.optional(),
  weight: positiveMarks.optional(),
  opensAt: instant.optional(),
  closesAt: instant.optional(),
  timeLimitMinutes: z.number().int().min(1).max(1440).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  attemptScoring: z.enum(["best", "latest"]).optional(),
  shuffleQuestions: z.boolean().optional(),
  lockAnswers: z.boolean().optional(),
  resultsVisibility: z.enum(["immediate", "after_release", "manual"]).optional(),
});

export interface ExamRouteDeps {
  db: Db;
  auth: AuthService;
  exams: ExamService;
  session: SessionConfig;
}

/**
 * Exam authoring and marking. Mounted twice: at /lecturer for the lecturer portal and at /admin/exams for staff. The routes are the same
 * because the rule is the same (A5, I2): the caller must own the question or exam, or be staff with the permission in the exam's branch.
 * Questions belong to their lecturer; a root administrator can change them too.
 */
export function createExamRoutes({ db, auth, exams, session }: ExamRouteDeps, portal: "lecturer" | "admin") {
  const app = new Hono<Env>();
  // Only the exam and question paths: this app is mounted at /lecturer, whose other children (content, payouts) bring their own guard, so a
  // wildcard here would load the session and identity a second time on every one of their requests.
  const guard = [withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, portal)] as const;
  // The module check comes after sign-in and the portal, but before any guard that looks a resource up: with the module off every exam route is
  // 403 module_disabled, never a 404 for a missing exam. The service keeps its own gate for callers that do not come through HTTP.
  const moduleOn = async (_c: unknown, next: () => Promise<void>) => {
    await requireModule(db, "online_exams");
    await next();
  };
  for (const path of ["/questions/*", "/exams/*"]) app.use(path, ...guard, moduleOn);

  async function need(userId: string, code: "exams.manage" | "exams.release", r: Resource) {
    await requireResource(db, userId, code, r);
  }
  const examId = (c: { req: { param: (n: string) => string } }) => uuid.parse(c.req.param("id"));

  app.post("/questions", async (c) => {
    const p = c.get("principal");
    const b = await jsonBody(c, questionBody.extend({ lecturerId: uuid.optional() }));
    const lecturerId = portal === "lecturer" ? p.identity.lecturerId : b.lecturerId;
    if (!lecturerId) throw new ServiceError("invalid_input", "Say which lecturer the question belongs to.");
    const { lecturerId: _drop, ...rest } = b;
    return c.json({ question: await exams.createQuestion({ ...rest, lecturerId, actor: p.userId }) }, 201);
  });

  app.put("/questions/:id", async (c) => {
    const p = c.get("principal");
    const b = await jsonBody(c, questionBody);
    return c.json({ question: await exams.updateQuestion({ ...b, questionId: uuid.parse(c.req.param("id")), actor: p.userId }) });
  });

  app.post("/exams", async (c) => {
    const p = c.get("principal");
    const b = await jsonBody(c, examBody);
    const lecturerId = portal === "lecturer" ? p.identity.lecturerId : b.lecturerId;
    if (!lecturerId) throw new ServiceError("invalid_input", "Say which lecturer the exam belongs to.");
    for (const courseId of b.courseIds) await need(p.userId, "exams.manage", { type: "course", id: courseId });
    const { lecturerId: _drop, ...rest } = b;
    return c.json({ exam: await exams.createExam({ ...rest, lecturerId }) }, 201);
  });

  app.put("/exams/:id/questions", async (c) => {
    const id = examId(c);
    await need(c.get("principal").userId, "exams.manage", { type: "exam", id });
    const b = await jsonBody(c, z.object({ questions: z.array(z.object({ questionId: uuid, marks: positiveMarks.optional() })).max(500) }));
    return c.json(await exams.setQuestions({ examId: id, ...b }));
  });

  app.post("/exams/:id/publish", async (c) => {
    const id = examId(c);
    await need(c.get("principal").userId, "exams.manage", { type: "exam", id });
    return c.json({ exam: await exams.publishExam({ examId: id }) });
  });

  app.post("/exams/:id/close", async (c) => {
    const id = examId(c);
    await need(c.get("principal").userId, "exams.manage", { type: "exam", id });
    return c.json({ exam: await exams.closeExam({ examId: id }) });
  });

  app.post("/exams/:id/marks", async (c) => {
    const p = c.get("principal");
    const id = examId(c);
    await need(p.userId, "exams.manage", { type: "exam", id });
    const b = await jsonBody(
      c,
      z.object({ entries: z.array(z.object({ studentId: uuid, marks, grade: z.string().max(10).optional(), remarks: z.string().max(300).optional() })).min(1).max(500), reason: z.string().max(300).optional() }),
    );
    // A manager of one branch of a shared exam may only enter marks for results recorded in that branch; the owner and all-branches staff are unrestricted.
    const scope = await examResultScope(db, p.userId, "exams.manage", id);
    return c.json(await exams.enterMarks({ examId: id, entries: b.entries, actor: p.userId, reason: b.reason, ...(scope === "all" ? {} : { branchIds: scope }) }));
  });

  app.post("/exams/:id/release", async (c) => {
    const id = examId(c);
    await need(c.get("principal").userId, "exams.release", { type: "exam", id });
    return c.json(await exams.releaseResults({ examId: id }));
  });

  app.get("/exams/:id/results", async (c) => {
    const id = examId(c);
    await need(c.get("principal").userId, "exams.manage", { type: "exam", id });
    const [e] = await db.select({ id: exam.id }).from(exam).where(eq(exam.id, id));
    if (!e) throw new ServiceError("not_found", "Exam not found.");
    // Rows and aggregates both come from the results in the caller's branches; the owner and all-branches staff see every result.
    const scope = await examResultScope(db, c.get("principal").userId, "exams.manage", id);
    return c.json(await exams.getResults({ examId: id, ...(scope === "all" ? {} : { branchIds: scope }) }));
  });

  return app;
}
