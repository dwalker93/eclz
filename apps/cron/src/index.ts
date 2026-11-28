/** What a Cloudflare Worker passes to `scheduled`, as far as this file uses it (so no Cloudflare type package is needed). */
export interface ScheduledController {
  cron: string;
  scheduledTime: number;
}
export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}
export interface Env {
  /** Base address of the admin app, for example https://admin.example.com (no path). */
  API_URL: string;
  /** Bearer secret shared with the admin app (32 characters or more). */
  JOB_SECRET: string;
}

/** The cron strings in wrangler.jsonc and the job each one runs. */
export const SCHEDULES = {
  "* * * * *": "dispatch",
  "30 0 * * *": "daily",
} as const;
export type JobName = (typeof SCHEDULES)[keyof typeof SCHEDULES];

export const JOB_PATH = "/api/internal/jobs";
const ATTEMPTS = 3;
const TIMEOUT_MS = 25_000;
/** Longer for dispatch: the admin app works for up to 45 s (its dispatch budget), and abandoning the call earlier could cut a send between the provider's acceptance and the recording of its result. */
const TIMEOUT_BY_JOB: Record<JobName, number> = { dispatch: 55_000, daily: TIMEOUT_MS };
const RETRY_DELAYS_MS = [1000, 3000];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function jobFor(cron: string): JobName {
  const job = (SCHEDULES as Record<string, JobName | undefined>)[cron];
  if (!job) throw new Error(`no job is set for the cron schedule "${cron}"; keep SCHEDULES and wrangler.jsonc in step`);
  return job;
}

/** The job address, or an error that says which variable is wrong (never printing the secret). */
export function jobUrl(env: Env, job: JobName): string {
  if (typeof env.JOB_SECRET !== "string" || env.JOB_SECRET.length < 32) throw new Error("JOB_SECRET is missing or shorter than 32 characters");
  let base: URL;
  try {
    base = new URL(env.API_URL);
  } catch {
    throw new Error("API_URL is missing or is not a valid address");
  }
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !(local && base.protocol === "http:")) throw new Error("API_URL must be an https address");
  return `${base.origin}${JOB_PATH}/${job}`;
}

/**
 * Calls one job endpoint. Network errors, timeouts and 5xx answers are tried up to three times (1 s and 3 s apart); any other failure (401: wrong secret,
 * 400, 404) is final, since repeating it cannot help. Throws on failure so Cloudflare records the run as failed. Safe to repeat: the jobs are idempotent.
 */
export async function runJob(job: JobName, env: Env, opts: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; timeoutMs?: number } = {}): Promise<void> {
  const url = jobUrl(env, job);
  const doFetch = opts.fetch ?? fetch;
  const wait = opts.sleep ?? sleep;
  let lastError = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${env.JOB_SECRET}`, "content-type": "application/json" },
        body: "{}",
        // Cloudflare Workers do not implement "error"; "manual" hands back the 3xx answer itself, which the status check below rejects (never followed, so the secret is not forwarded).
        redirect: "manual",
        signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_BY_JOB[job]),
      });
      if (res.ok) return;
      lastError = `answered ${res.status}`;
      if (res.status < 500) throw new Error(`${job} job ${lastError}`);
    } catch (e) {
      if (e instanceof Error && /^\w+ job answered \d{3}$/.test(e.message)) throw e;
      lastError = e instanceof Error ? e.name : "failed";
    }
    if (attempt < ATTEMPTS) await wait(RETRY_DELAYS_MS[attempt - 1]!);
  }
  throw new Error(`${job} job failed after ${ATTEMPTS} attempts (${lastError})`);
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: WorkerContext): Promise<void> {
    ctx.waitUntil(runJob(jobFor(controller.cron), env));
  },
};
