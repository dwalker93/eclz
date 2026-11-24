import { classSession, course } from "@workspace/db/schema";
import { branchScope, isCalendarDay, normalizeClockTime, requirePermission, requireStudent, ServiceError, type AttendanceService, type Db, type StudentService } from "@workspace/domain";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import type { Env } from "./session";

const uuid = z.string().uuid();
const day = z.string().refine(isCalendarDay, "Use a real calendar date like 2027-03-31.");
const time = z.string().refine((v) => normalizeClockTime(v) !== null, "Use a real time like 09:00 or 09:00:00.");

const entry = z.object({
  studentId: uuid,
  status: z.enum(["present", "late", "absent", "excused"]),
  attendedVia: z.enum(["physical", "online"]).optional(),
  note: z.string().max(300).optional(),
});

export interface AttendanceRouteDeps {
  db: Db;
  attendance: AttendanceService;
  students: StudentService;
}

/** Attendance of the admin portal. The branch is always the session's course's branch (I2). */
export function addAttendanceRoutes(app: Hono<Env>, { db, attendance, students }: AttendanceRouteDeps) {
  async function courseBranch(courseId: string): Promise<string> {
    const [c] = await db.select({ branchId: course.branchId }).from(course).where(eq(course.id, courseId));
    if (!c) throw new ServiceError("not_found", "Course not found.");
    return c.branchId;
  }
  async function sessionBranch(sessionId: string): Promise<string> {
    const [s] = await db.select({ courseId: classSession.courseId }).from(classSession).where(eq(classSession.id, sessionId));
    if (!s) throw new ServiceError("not_found", "Session not found.");
    return courseBranch(s.courseId);
  }

  app.post("/attendance/sessions", async (c) => {
    const user = c.get("principal").userId;
    const b = await jsonBody(
      c,
      z.object({
        courseId: uuid,
        sessionDate: day,
        startsAt: time,
        endsAt: time,
        intakeId: uuid.nullish(),
        topic: z.string().max(200).optional(),
        deliveryMode: z.enum(["physical", "online", "hybrid"]).optional(),
        meeting: z.object({ provider: z.enum(["zoom", "teams", "other"]), url: z.string().url().optional(), ref: z.string().max(200).optional() }).optional(),
      }),
    );
    await requirePermission(db, user, "attendance.mark", { branchId: await courseBranch(b.courseId) });
    return c.json({ session: await attendance.createSession(b) }, 201);
  });

  app.post("/attendance/sessions/:id/cancel", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, c.get("principal").userId, "attendance.mark", { branchId: await sessionBranch(id) });
    return c.json({ session: await attendance.cancelSession({ sessionId: id }) });
  });

  app.get("/attendance/sessions/:id/roster", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, c.get("principal").userId, "attendance.read", { branchId: await sessionBranch(id) });
    return c.json(await attendance.getRoster({ sessionId: id }));
  });

  app.post("/attendance/sessions/:id/mark", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "attendance.mark", { branchId: await sessionBranch(id) });
    const b = await jsonBody(c, z.object({ entries: z.array(entry).min(1).max(500) }));
    return c.json(await attendance.mark({ sessionId: id, entries: b.entries, actor: user }));
  });

  app.post("/attendance/sessions/:id/mark-remaining-absent", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "attendance.mark", { branchId: await sessionBranch(id) });
    return c.json(await attendance.markRemainingAbsent({ sessionId: id, actor: user }));
  });

  app.post("/attendance/sessions/:id/qr", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requirePermission(db, user, "attendance.mark", { branchId: await sessionBranch(id) });
    const b = await jsonBody(c, z.object({ qrToken: z.string().min(8).max(200), late: z.boolean().optional() }));
    return c.json(await attendance.markByQr({ sessionId: id, ...b, actor: user }));
  });

  app.get("/students/:id/attendance", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const user = c.get("principal").userId;
    await requireStudent(db, user, "attendance.read", id);
    const q = z.object({ courseId: uuid.optional(), from: day.optional(), to: day.optional() }).parse(c.req.query());
    // Attendance belongs to the course's branch (I1, I2), not to every branch the student is in: count only the caller's branches.
    return c.json(await attendance.studentSummary({ studentId: id, ...q, scope: await branchScope(db, user, "attendance.read") }));
  });

  app.post("/students/:id/rotate-qr", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    await requireStudent(db, c.get("principal").userId, "students.update", id);
    await students.get({ studentId: id, scope: "all" }); // existence check only; the caller was authorized above
    return c.json(await attendance.rotateQrToken({ studentId: id }));
  });
}
