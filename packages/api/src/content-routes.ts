import type { AuthService } from "@workspace/auth";
import { contentPurchase, course, courseLecturer } from "@workspace/db/schema";
import { branchScope, requireContentWide, requireLecturerPermission, requirePermission, requireResource, ServiceError, type ContentService, type Db } from "@workspace/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import { requirePortalOf, requireReady, withPrincipal, type Env, type SessionConfig } from "./session";

const uuid = z.string().uuid();
const price = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);

const createBody = z.object({
  lecturerId: uuid.optional(),
  kind: z.enum(["recording", "file", "physical_book"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  externalUrl: z.string().url().max(500).optional(),
  fileId: uuid.optional(),
  accessType: z.enum(["course", "free_registered", "paid"]).optional(),
  price: price.optional(),
  branchIds: z.array(uuid).max(50).optional(),
});

export interface ContentRouteDeps {
  db: Db;
  auth: AuthService;
  content: ContentService;
  session: SessionConfig;
}

/**
 * Content management (recordings, files, books, course sections). Mounted at /lecturer/content and /admin/content with the same checks:
 * the owner, or staff holding `content.manage` in the right branch (A5, I2). A lecturer may list their content only in branches where they
 * teach a course; staff need the permission in every branch they list it in, or an all-branches role when it is listed nowhere.
 */
export function createContentRoutes({ db, auth, content, session }: ContentRouteDeps, portal: "lecturer" | "admin") {
  const app = new Hono<Env>();
  app.use("*", withPrincipal(auth, session), requireReady(auth), requirePortalOf(auth, portal));
  const id = (c: { req: { param: (n: string) => string } }, name = "id") => uuid.parse(c.req.param(name));

  async function checkBranches(c: { get: (k: "principal") => { userId: string; identity: { lecturerId: string | null } } }, branchIds: string[]) {
    const p = c.get("principal");
    if (portal === "admin") {
      if (branchIds.length === 0) await requirePermission(db, p.userId, "content.manage");
      for (const branchId of branchIds) await requirePermission(db, p.userId, "content.manage", { branchId });
      return;
    }
    const taught = await db
      .select({ branchId: course.branchId })
      .from(courseLecturer)
      .innerJoin(course, eq(course.id, courseLecturer.courseId))
      .where(eq(courseLecturer.lecturerId, p.identity.lecturerId!));
    const ok = new Set(taught.map((t) => t.branchId));
    for (const b of branchIds) if (!ok.has(b)) throw new ServiceError("forbidden", "You can list content only in branches where you teach.");
  }

  app.post("/items", async (c) => {
    const p = c.get("principal");
    const b = await jsonBody(c, createBody);
    const lecturerId = portal === "lecturer" ? p.identity.lecturerId : b.lecturerId;
    if (!lecturerId) throw new ServiceError("invalid_input", "Say which lecturer the content belongs to.");
    // A lecturer needs the lecturer role's content.manage even for an unlisted item: otherwise they could create what the resource guard then stops them editing.
    if (portal === "lecturer") await requireLecturerPermission(db, p.userId, "content.manage");
    await checkBranches(c, b.branchIds ?? []);
    const { lecturerId: _drop, ...rest } = b;
    return c.json({ item: await content.createItem({ ...rest, lecturerId }) }, 201);
  });

  app.post("/items/:id/branches", async (c) => {
    const contentId = id(c);
    await requireResource(db, c.get("principal").userId, "content.manage", { type: "content", id: contentId });
    const b = await jsonBody(c, z.object({ branchIds: z.array(uuid).min(1).max(50) }));
    await checkBranches(c, b.branchIds);
    return c.json({ branches: await content.addBranches({ contentId, ...b }) });
  });

  app.patch("/items/:id", async (c) => {
    const contentId = id(c);
    await requireContentWide(db, c.get("principal").userId, "content.manage", contentId);
    const b = await jsonBody(c, z.object({ title: z.string().trim().min(1).max(200).optional(), description: z.string().max(2000).nullable().optional(), price: price.optional() }));
    return c.json({ item: await content.updateItem({ contentId, ...b }) });
  });

  app.post("/items/:id/status", async (c) => {
    const contentId = id(c);
    await requireContentWide(db, c.get("principal").userId, "content.manage", contentId);
    const b = await jsonBody(c, z.object({ status: z.enum(["published", "archived"]) }));
    return c.json({ item: await content.setStatus({ contentId, ...b }) });
  });

  // ---- course layout

  app.post("/courses/:courseId/sections", async (c) => {
    const courseId = id(c, "courseId");
    await requireResource(db, c.get("principal").userId, "content.manage", { type: "course", id: courseId });
    const b = await jsonBody(c, z.object({ title: z.string().trim().min(1).max(200), position: z.number().int().min(0).max(1000).optional() }));
    return c.json({ section: await content.createSection({ courseId, ...b }) }, 201);
  });

  app.post("/courses/:courseId/content", async (c) => {
    const user = c.get("principal").userId;
    const courseId = id(c, "courseId");
    const b = await jsonBody(c, z.object({ contentId: uuid, sectionId: uuid.nullable().optional(), position: z.number().int().min(0).max(1000).optional() }));
    await requireResource(db, user, "content.manage", { type: "course", id: courseId });
    await requireResource(db, user, "content.manage", { type: "content", id: b.contentId });
    return c.json({ link: await content.attachToCourse({ courseId, ...b }) }, 201);
  });

  app.delete("/courses/:courseId/content/:contentId", async (c) => {
    const user = c.get("principal").userId;
    const courseId = id(c, "courseId");
    const contentId = id(c, "contentId");
    // The same two checks as attaching: a co-teacher of the course cannot remove another lecturer's item from it.
    await requireResource(db, user, "content.manage", { type: "course", id: courseId });
    await requireResource(db, user, "content.manage", { type: "content", id: contentId });
    await content.detachFromCourse({ courseId, contentId });
    return c.json({ ok: true });
  });

  // ---- purchases and handover: staff only

  if (portal === "admin") {
    async function purchaseBranch(purchaseId: string): Promise<string> {
      const [p] = await db.select({ branchId: contentPurchase.branchId }).from(contentPurchase).where(eq(contentPurchase.id, purchaseId));
      if (!p) throw new ServiceError("not_found", "Purchase not found.");
      return p.branchId;
    }

    app.get("/handovers", async (c) => {
      const scope = await branchScope(db, c.get("principal").userId, "content.handover");
      if (scope !== "all" && scope.length === 0) throw new ServiceError("forbidden", "You do not have the content.handover permission.");
      // The branch filter runs in the query, so a scoped request never loads other branches' rows.
      return c.json({ handovers: await content.pendingHandovers(scope === "all" ? {} : { branchIds: scope }) });
    });

    app.post("/purchases/:id/hand-over", async (c) => {
      const user = c.get("principal").userId;
      const purchaseId = id(c);
      await requirePermission(db, user, "content.handover", { branchId: await purchaseBranch(purchaseId) });
      return c.json({ purchase: await content.handOver({ purchaseId, handedOverBy: user }) });
    });

    app.post("/purchases/:id/cancel", async (c) => {
      const purchaseId = id(c);
      await requirePermission(db, c.get("principal").userId, "content.handover", { branchId: await purchaseBranch(purchaseId) });
      return c.json({ purchase: await content.cancelPurchase({ purchaseId }) });
    });
  }

  return app;
}
