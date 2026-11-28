import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { describeUnexpected, HttpError, jsonBody, onError } from "./http";

/** The scheduled work, as the services expose it. */
export interface JobServices {
  dispatchQueued(input: { limit?: number; budgetMs?: number }): Promise<unknown>;
  runOverdueJob(): Promise<unknown>;
  runDueSoonJob(): Promise<unknown>;
}

export const MIN_JOB_SECRET_LENGTH = 32;
/** The most rows one dispatch call may try, so a single invocation stays inside a serverless time limit. */
export const MAX_DISPATCH_LIMIT = 500;
export const DEFAULT_DISPATCH_LIMIT = 100;
/**
 * Time one dispatch call may spend, below the admin route's 60 s `maxDuration` and the cron Worker's request timeout (`DISPATCH_TIMEOUT_MS`, 55 s). Sends are serial and a
 * provider call can take 15 s, so the dispatcher takes no new row once a send could end after this budget: the platform never cuts a send between acceptance
 * and the recording of its result, and the Worker never gives up on a call that is still working. Rows not reached stay queued for the next minute.
 */
export const DISPATCH_BUDGET_MS = 45_000;

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Counts and dates only: arrays (a failed student's id and reason, say) become their length, so nothing about a person reaches a scheduler's logs. */
export function summarize(result: unknown): Record<string, unknown> {
  if (typeof result !== "object" || result === null) return {};
  return Object.fromEntries(
    Object.entries(result as Record<string, unknown>).flatMap(([k, v]) => {
      if (Array.isArray(v)) return [[k, v.length]];
      if (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))) return [[k, v]];
      return [];
    }),
  );
}

/**
 * Endpoints for a scheduler (Cloudflare Cron Triggers, say), not for browsers or sessions: `POST /dispatch` sends queued notifications and
 * `POST /daily` runs the overdue job and the due-soon reminders. Both need `Authorization: Bearer <secret>`; anything else is 401 with no detail.
 * Every job is safe to run twice or at the same time as itself (rows are leased, reminders are unique per item), so a retry or an overlap is harmless.
 * The secret must be at least 32 characters, or this throws at start-up rather than guarding the routes with a guessable one.
 */
export function createJobRoutes(deps: { jobs: JobServices; secret: string }) {
  if (typeof deps.secret !== "string" || deps.secret.length < MIN_JOB_SECRET_LENGTH) {
    throw new Error(`the job secret must be at least ${MIN_JOB_SECRET_LENGTH} characters`);
  }
  const expected = digest(deps.secret);
  const app = new Hono();

  app.use("*", async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const m = /^Bearer (.+)$/.exec(header);
    // Both sides are hashed first, so the comparison is constant-time whatever the lengths.
    if (!m || !timingSafeEqual(digest(m[1]!), expected)) throw new HttpError(401, "unauthenticated", "Not signed in");
    await next();
  });

  app.post("/dispatch", async (c) => {
    const b = await jsonBody(c, z.object({ limit: z.number().int().min(1).max(MAX_DISPATCH_LIMIT).optional() }).strict());
    const result = await deps.jobs.dispatchQueued({ limit: b.limit ?? DEFAULT_DISPATCH_LIMIT, budgetMs: DISPATCH_BUDGET_MS });
    return c.json({ ok: true, dispatch: summarize(result) });
  });

  app.post("/daily", async (c) => {
    // One failing job must not stop the other: run both, report each, and answer 500 if either failed so the scheduler records a failure.
    // A job that returns normally but lists `errors` (a student whose reconcile or reminders failed) has not finished its work either, and nothing
    // else retries it before tomorrow's run, so that is a failure too: the Worker repeats the call (safe, the jobs are idempotent) and Cloudflare shows
    // the run as failed. The answer still carries the counts, and `errors` as a number, never the students or reasons.
    const out: Record<string, unknown> = {};
    let failed = false;
    for (const [name, run] of [
      ["overdue", () => deps.jobs.runOverdueJob()],
      ["dueSoon", () => deps.jobs.runDueSoonJob()],
    ] as const) {
      try {
        const result = await run();
        const unfinished = typeof result === "object" && result !== null && Array.isArray((result as { errors?: unknown }).errors) && (result as { errors: unknown[] }).errors.length > 0;
        if (unfinished) failed = true;
        out[name] = { ok: !unfinished, ...summarize(result) };
      } catch (e) {
        failed = true;
        console.error(`daily job ${name} failed`, describeUnexpected(e, c));
        out[name] = { ok: false };
      }
    }
    return c.json({ ok: !failed, ...out }, failed ? 500 : 200);
  });

  return app;
}

/**
 * The job routes as an app of their own, for a host that serves only them (a Next.js route handler, say): `createJobApp({ jobs, secret, basePath: "/api/internal/jobs" }).fetch(request)`.
 * Errors are mapped the same way as in `createApi`.
 */
export function createJobApp(deps: { jobs: JobServices; secret: string; basePath?: string }) {
  const app = new Hono().basePath(deps.basePath ?? "/");
  app.onError(onError);
  app.route("/", createJobRoutes({ jobs: deps.jobs, secret: deps.secret }));
  return app;
}
