import { createJobHandler } from "@/server/jobs"

// Called by the Cloudflare cron Worker (apps/cron) with `Authorization: Bearer <JOB_SECRET>`. Never cached, never prerendered.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// One dispatch call tries at most 500 rows; give it room on a slow provider.
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
