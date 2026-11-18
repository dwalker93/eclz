import type { ReportService } from "@workspace/domain";
import type { Hono } from "hono";
import { z } from "zod";
import type { Env } from "./session";

const uuid = z.string().uuid();

/** The owner's reports. Both need `reports.read` and cover only the branches the caller holds it in. */
export function addReportRoutes(app: Hono<Env>, { reports }: { reports: ReportService }) {
  app.get("/reports/overdue", async (c) => {
    const q = z.object({ branchId: uuid.optional(), limit: z.coerce.number().int().min(1).max(500).optional(), offset: z.coerce.number().int().min(0).optional() }).strict().parse(c.req.query());
    return c.json({ report: await reports.overdue({ actor: c.get("principal").userId, ...q }) });
  });
  app.get("/reports/collections", async (c) => {
    const q = z.object({ from: z.string(), to: z.string(), branchId: uuid.optional() }).strict().parse(c.req.query());
    return c.json({ report: await reports.collections({ actor: c.get("principal").userId, ...q }) });
  });
}
