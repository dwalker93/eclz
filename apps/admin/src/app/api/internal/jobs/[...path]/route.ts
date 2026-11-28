import { createJobHandler } from "@/server/jobs"

// Called by the Cloudflare cron Worker (apps/cron) with `Authorization: Bearer <JOB_SECRET>`. Never cached, never prerendered.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// Dispatch is serial and stops taking rows after DISPATCH_BUDGET_MS (45 s, packages/api/src/jobs.ts), so a send in progress still ends and is recorded inside this
// limit; the cron Worker waits longer (55 s) than that. If the host does not enforce maxDuration, the budget still holds.
export const maxDuration = 60

let handler: ReturnType<typeof createJobHandler> | undefined

export async function POST(request: Request): Promise<Response> {
  try {
    handler ??= createJobHandler()
  } catch (e) {
    // Missing configuration: say so in the log, answer with nothing useful to a caller.
    console.error("job endpoint is not configured", e instanceof Error ? e.message : e)
    return Response.json({ error: { code: "not_configured", message: "Not available" } }, { status: 503 })
  }
  return handler(request)
}
