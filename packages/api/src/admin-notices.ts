import type { NoticeService } from "@workspace/domain";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import type { Env } from "./session";

const uuid = z.string().uuid();
const when = z.string().datetime({ offset: true }).transform((s) => new Date(s));
const target = z.union([
  z.object({ type: z.literal("all") }).strict(),
  z.object({ type: z.enum(["role", "course", "grade", "student"]), id: uuid }).strict(),
]);

/**
 * Notices of the admin portal. Writing needs `notices.manage` in the notice's branch (an all-branches notice needs an all-branches role); the
 * branch of an existing notice comes from the record. `GET notices/mine` lists the notices aimed at the staff member's own roles.
 */
export function addNoticeRoutes(app: Hono<Env>, { notices }: { notices: NoticeService }) {
  app.post("/notices", async (c) => {
    const b = await jsonBody(
      c,
      z.object({ branchId: uuid.nullable(), title: z.string(), body: z.string(), publishAt: when.optional(), expiresAt: when.nullable().optional(), targets: z.array(target).max(50).optional() }).strict(),
    );
    return c.json({ notice: await notices.create({ actor: c.get("principal").userId, ...b }) }, 201);
  });
  app.get("/notices", async (c) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).optional(), offset: z.coerce.number().int().min(0).optional() }).parse(c.req.query());
    return c.json({ notices: await notices.listManaged({ actor: c.get("principal").userId, ...q }) });
  });
  app.get("/notices/mine", async (c) => c.json({ notices: await notices.listForStaff(c.get("principal").userId) }));
  app.get("/notices/:id", async (c) => c.json({ notice: await notices.get({ noticeId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId }) }));
  app.patch("/notices/:id", async (c) => {
    const b = await jsonBody(c, z.object({ title: z.string().optional(), body: z.string().optional(), expiresAt: when.nullable().optional() }).strict());
    return c.json({ notice: await notices.update({ noticeId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId, ...b }) });
  });
  app.delete("/notices/:id", async (c) => {
    await notices.remove({ noticeId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId });
    return c.json({ ok: true });
  });
}
