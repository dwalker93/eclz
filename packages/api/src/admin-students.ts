import { course, enrollment, invoice, invoiceItem, STUDENT_STATUSES } from "@workspace/db/schema";
import { branchScope, requirePermission, requireStudent, ServiceError, type Db, type EnrollmentService, type StudentService } from "@workspace/domain";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import type { Env } from "./session";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max = 200) => z.string().trim().max(max);

const guardianBody = z.object({
  fullName: text().min(1),
  phone: text(30).min(5),
  address: text(300),
  relationship: text(50).optional(),
  isPrimary: z.boolean().optional(),
  nic: text(30).optional(),
  email: z.string().email().max(200).optional(),
});

const registerBody = z.object({
  branchId: uuid,
  fullName: text().min(1),
  dateOfBirth: day,
  gradeLevelId: uuid.optional(),
  gender: text(20).optional(),
  schoolName: text().optional(),
  nic: text(30).optional(),
  contactEmail: z.string().email().max(200).optional(),
  contactPhone: text(30).optional(),
  login: z.object({ email: z.string().email().max(200).optional(), username: text(60).min(3).optional() }).optional(),
  guardians: z.array(guardianBody).max(5).optional(),
});

const updateBody = z.object({
  fullName: text().min(1).optional(),
  dateOfBirth: day.optional(),
  gender: text(20).nullable().optional(),
  schoolName: text().nullable().optional(),
  nic: text(30).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional(),
  contactPhone: text(30).nullable().optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
});

const enrollBody = z.object({
  studentId: uuid,
  courseId: uuid,
  intakeId: uuid.nullish(),
  feeStructureId: uuid.nullish(),
  preferredMode: z.enum(["physical", "online"]).nullish(),
  installmentOptionId: uuid.nullish(),
  dueAfterDays: z.number().int().min(0).max(365).optional(),
});

export interface StudentRouteDeps {
  db: Db;
  students: StudentService;
  enrollment: EnrollmentService;
}

/** Students, enrolments and invoices of the admin portal. Registered on the guarded /admin app. */
export function addStudentRoutes(app: Hono<Env>, { db, students, enrollment: enrolling }: StudentRouteDeps) {
  async function courseBranch(courseId: string): Promise<string> {
    const [c] = await db.select({ branchId: course.branchId }).from(course).where(eq(course.id, courseId));
    if (!c) throw new ServiceError("not_found", "Course not found.");
    return c.branchId;
  }

  // ---- students

  app.post("/students", async (c) => {
    const user = c.get("principal").userId;
    const b = await jsonBody(c, registerBody);
    await requirePermission(db, user, "students.create", { branchId: b.branchId });
    const r = await students.register(b);
    return c.json({ student: r.student, guardians: r.guardians }, 201);
  });

  app.get("/students", async (c) => {
    const scope = await branchScope(db, c.get("principal").userId, "students.read");
    if (scope !== "all" && scope.length === 0) throw new ServiceError("forbidden", "You do not have the students.read permission.");
    const q = z.object({ q: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(200).optional(), offset: z.coerce.number().int().min(0).optional() }).parse(c.req.query());
    return c.json({ students: await students.list({ scope, search: q.q, limit: q.limit, offset: q.offset }) });
  });

  app.get("/students/:id", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    await requireStudent(db, c.get("principal").userId, "students.read", id);
    return c.json(await students.get({ studentId: id }));
  });

  app.patch("/students/:id", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    await requireStudent(db, user, "students.update", id);
    const b = await jsonBody(c, updateBody);
    return c.json({ student: await students.update({ studentId: id, actor: user, ...b }) });
  });

  // ---- enrolments (the branch is the course's)

  app.post("/enrollments", async (c) => {
    const user = c.get("principal").userId;
    const b = await jsonBody(c, enrollBody);
    await requirePermission(db, user, "enrollments.manage", { branchId: await courseBranch(b.courseId) });
    return c.json(await enrolling.enrollStudent({ ...b, actorUserId: user }), 201);
  });

  app.post("/enrollments/:id/drop", async (c) => {
    const user = c.get("principal").userId;
    const id = uuid.parse(c.req.param("id"));
    const [e] = await db.select({ courseId: enrollment.courseId }).from(enrollment).where(eq(enrollment.id, id));
    if (!e) throw new ServiceError("not_found", "Enrolment not found.");
    await requirePermission(db, user, "enrollments.manage", { branchId: await courseBranch(e.courseId) });
    const b = await jsonBody(c, z.object({ reason: text(500).optional() }));
    return c.json({ enrollment: await enrolling.dropEnrollment({ enrollmentId: id, actorUserId: user, reason: b.reason }) });
  });

  // ---- invoices (read only; the branch of each invoice is checked)

  app.get("/students/:id/invoices", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const scope = await branchScope(db, c.get("principal").userId, "invoices.read");
    if (scope !== "all" && scope.length === 0) throw new ServiceError("forbidden", "You do not have the invoices.read permission.");
    const rows = await db
      .select()
      .from(invoice)
      .where(and(eq(invoice.studentId, id), scope === "all" ? undefined : inArray(invoice.branchId, scope)))
      .orderBy(desc(invoice.issuedOn), desc(invoice.createdAt));
    return c.json({ invoices: rows });
  });

  app.get("/invoices/:id", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const [inv] = await db.select().from(invoice).where(eq(invoice.id, id));
    if (!inv) throw new ServiceError("not_found", "Invoice not found.");
    await requirePermission(db, c.get("principal").userId, "invoices.read", { branchId: inv.branchId });
    const items = await db.select().from(invoiceItem).where(eq(invoiceItem.invoiceId, id)).orderBy(asc(invoiceItem.createdAt), asc(invoiceItem.id));
    return c.json({ invoice: inv, items });
  });
}
