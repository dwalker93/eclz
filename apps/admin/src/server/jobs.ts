import { createJobApp, MIN_JOB_SECRET_LENGTH } from "@workspace/api/jobs"
import { createDb } from "@workspace/db/client"
import { createAccessService, createNotificationService, createTextLkSms, type Db, type Providers } from "@workspace/domain"

export const JOB_BASE_PATH = "/api/internal/jobs"

/**
 * The scheduled jobs, built once per server instance from the environment:
 *   DATABASE_URL        the application database (pooled connection string)
 *   JOB_SECRET          bearer secret the Cloudflare cron Worker sends, 32 characters or more
 *   TEXT_LK_API_TOKEN, TEXT_LK_SENDER_ID   optional: turn on SMS through text.lk
 * Email and push have no provider wired yet, so queued email and push notifications are marked failed ("no provider") until one is added.
 */
export function createJobHandler(env: Record<string, string | undefined> = process.env) {
  const secret = env.JOB_SECRET
  const url = env.DATABASE_URL
  if (!secret || secret.length < MIN_JOB_SECRET_LENGTH) throw new Error(`JOB_SECRET must be set to at least ${MIN_JOB_SECRET_LENGTH} characters`)
  if (!url) throw new Error("DATABASE_URL must be set")
  const { db } = createDb(url)
  const providers: Providers = {}
  if (env.TEXT_LK_API_TOKEN && env.TEXT_LK_SENDER_ID) {
    providers.sms = createTextLkSms({ apiToken: env.TEXT_LK_API_TOKEN, senderId: env.TEXT_LK_SENDER_ID })
  }
  const access = createAccessService(db as unknown as Db)
  const notifications = createNotificationService(db as unknown as Db, { providers })
  const app = createJobApp({
    jobs: {
      dispatchQueued: (input) => notifications.dispatchQueued(input),
      runOverdueJob: () => access.runOverdueJob(),
      runDueSoonJob: () => notifications.runDueSoonJob(),
    },
    secret,
    basePath: JOB_BASE_PATH,
  })
  return (request: Request) => app.fetch(request)
}
