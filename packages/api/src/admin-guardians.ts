import type { GuardianService } from "@workspace/domain";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import type { Env } from "./session";

const uuid = z.string().uuid();

/**
 * Guardians after registration. All need `guardians.manage`: student-level routes in the student's branches, guardian-level routes in any
 * branch of any of the guardian's children (the service checks both from the records, never from the request).
 */
export function addGuardianRoutes(app: Hono<Env>, { guardians }: { guardians: GuardianService }) {
  app.patch("/guardians/:id", async (c) => {
    const b = await jsonBody(c, z.object({ fullName: z.string().optional(), address: z.string().nullable().optional(), nic: z.string().nullable().optional(), email: z.string().nullable().optional() }).strict());
    return c.json({ guardian: await guardians.update({ guardianId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId, ...b }) });
  });
  app.post("/guardians/:id/phone", async (c) => {
    const b = await jsonBody(c, z.object({ phone: z.string() }).strict());
    return c.json({ guardian: await guardians.changePhone({ guardianId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId, phone: b.phone }) });
  });
  app.post("/students/:id/guardians", async (c) => {
    const b = await jsonBody(
      c,
      z.object({ fullName: z.string(), phone: z.string(), address: z.string().nullable().optional(), nic: z.string().nullable().optional(), email: z.string().nullable().optional(), relationship: z.string().nullable().optional(), isPrimary: z.boolean().optional() }).strict(),
    );
    return c.json({ link: await guardians.link({ studentId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId, ...b }) }, 201);
  });
  app.patch("/students/:id/guardians/:guardianId", async (c) => {
    const b = await jsonBody(c, z.object({ relationship: z.string().nullable().optional(), isPrimary: z.literal(true).optional() }).strict());
    return c.json({ link: await guardians.updateLink({ studentId: uuid.parse(c.req.param("id")), guardianId: uuid.parse(c.req.param("guardianId")), actor: c.get("principal").userId, ...b }) });
  });
  app.delete("/students/:id/guardians/:guardianId", async (c) => {
    await guardians.unlink({ studentId: uuid.parse(c.req.param("id")), guardianId: uuid.parse(c.req.param("guardianId")), actor: c.get("principal").userId });
    return c.json({ ok: true });
  });
}
