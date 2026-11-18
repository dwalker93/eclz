import { COMMISSION_CALC_TYPES } from "@workspace/db/schema";
import type { CommissionRuleService } from "@workspace/domain";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import type { Env } from "./session";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * What the institute keeps from each lecturer. Institute-wide, so every route needs `commissions.manage` as an all-branches role. A rate is
 * never edited: end the old rule and add a new one.
 */
export function addCommissionRuleRoutes(app: Hono<Env>, { commissionRules }: { commissionRules: CommissionRuleService }) {
  app.get("/commission-rules", async (c) => {
    const q = z.object({ lecturerId: uuid.optional(), activeOn: day.optional() }).strict().parse(c.req.query());
    return c.json({ rules: await commissionRules.list({ actor: c.get("principal").userId, ...q }) });
  });
  app.post("/commission-rules", async (c) => {
    const b = await jsonBody(
      c,
      z
        .object({
          lecturerId: uuid,
          scope: z.union([z.object({ courseId: uuid }).strict(), z.object({ subjectId: uuid, gradeLevelId: uuid.optional() }).strict(), z.object({}).strict()]).optional(),
          calcType: z.enum(COMMISSION_CALC_TYPES),
          rate: z.string(),
          effectiveFrom: day,
          effectiveTo: day.nullable().optional(),
        })
        .strict(),
    );
    return c.json(await commissionRules.create({ actor: c.get("principal").userId, ...b }), 201);
  });
  app.post("/commission-rules/:id/end", async (c) => {
    const b = await jsonBody(c, z.object({ effectiveTo: day }).strict());
    return c.json({ rule: await commissionRules.end({ ruleId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId, effectiveTo: b.effectiveTo }) });
  });
  app.delete("/commission-rules/:id", async (c) => {
    await commissionRules.remove({ ruleId: uuid.parse(c.req.param("id")), actor: c.get("principal").userId });
    return c.json({ ok: true });
  });
}
