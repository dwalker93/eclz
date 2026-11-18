import type { AuthService } from "@workspace/auth";
import { exam } from "@workspace/db/schema";
import { requireResource, ServiceError, type Db, type ExamService, type Resource } from "@workspace/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import { requirePortalOf, requireReady, withPrincipal, type Env, type SessionConfig } from "./session";

const uuid = z.string().uuid();
const marks = z.union([z.string().regex(/^\d{1,6}(\.\d{1,2})?$/), z.number().min(0).max(100000)]);

const questionBody = z.object({
  body: z.string().min(1).max(2000),
  options: z.array(z.object({ body: z.string().min(1).max(500), isCorrect: z.boolean() })).min(2).max(26),
  defaultMarks: marks.optional(),
  explanation: z.string().max(2000).optional(),
  imageFileId: uuid.optional(),
});

const examBody = z.object({
  lecturerId: uuid.optional(),
  title: z.string().min(1).max(200),
  mode: z.enum(["online_mcq", "paper"]),
  courseIds: z.array(uuid).min(1).max(20),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxMarks: marks.optional(),
  weight: marks.optional(),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
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
  app.use("*", withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, portal));

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
    const b = await jsonBody(c, z.object({ questions: z.array(z.object({ questionId: uuid, marks: marks.optional() })).max(500) }));
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
    return c.json(await exams.enterMarks({ examId: id, entries: b.entries, actor: p.userId, reason: b.reason }));
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
    return c.json(await exams.getResults({ examId: id }));
  });

  return app;
}
