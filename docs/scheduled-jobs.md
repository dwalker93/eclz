# Scheduled jobs

Nothing in the system runs by itself. Three jobs have to be called on a schedule, by a Cloudflare Cron Trigger that calls the admin app over HTTPS.

| Job | Schedule | What it does |
|---|---|---|
| `dispatch` | every minute | `notifications.dispatchQueued({ limit: 100 })`: sends queued SMS (email and push once a provider is wired) |
| `daily` | 00:30 UTC (06:00 in Sri Lanka) | `access.runOverdueJob()` then `notifications.runDueSoonJob()` |

## How it fits together

```
Cloudflare Cron Trigger -> apps/cron (Worker) -> POST {API_URL}/api/internal/jobs/{dispatch|daily}
                                                   Authorization: Bearer JOB_SECRET
                                                -> apps/admin route handler -> createJobApp (packages/api/src/jobs.ts) -> services
```

- The routes are not session routes. They need `Authorization: Bearer <JOB_SECRET>` (32 characters or more, compared in constant time); any other request is 401 with no detail. A missing or short secret stops the app from starting the handler (503 `not_configured`).
- `/dispatch` takes an optional `{ "limit": 1..500 }` (default 100). `/daily` runs both jobs even if the first fails and answers 500 if either failed, or if either returned with students it could not process (its `errors` list is not empty): nothing else retries those before the next day's run, so the scheduler must see a failure and repeat the call (safe, the jobs are idempotent). The answer then shows `ok: false` for that job and `errors` as a count. Answers contain counts only, never student ids or messages.
- Every job is safe to run twice or at the same time as itself: sending rows are leased (`sending` with `claimed_until`), and reminders are unique per item. A Worker retry, an overlap or a manual call does no harm.
- The Worker retries network errors, timeouts and 5xx up to three times (1 s and 3 s apart). A 401, 400 or 404 is final. It throws on failure, so the run shows as failed in Cloudflare.

## Setup

1. Admin app environment (Vercel project settings): `DATABASE_URL`, `JOB_SECRET`, and optionally `TEXT_LK_API_TOKEN` and `TEXT_LK_SENDER_ID` for SMS. Without a provider for a channel, its queued rows are marked failed with a "no provider" reason (use `retryFailed` after adding one).
2. Worker: `cd apps/cron && bunx wrangler deploy`, then `bunx wrangler secret put API_URL` (the admin app's address, for example `https://admin.example.com`) and `bunx wrangler secret put JOB_SECRET` (the same value as in step 1).
3. Check: in Cloudflare, open the Worker's Logs after a minute; a successful run shows no error. To test by hand: `curl -X POST -H "Authorization: Bearer $JOB_SECRET" https://admin.example.com/api/internal/jobs/dispatch`.

## Watch for

- Rows in status `unconfirmed`: a provider timed out or a dispatcher stopped mid-send, so the message may have been delivered. They are never re-sent automatically; settle them with `resolveUnconfirmed` (there is no admin screen for this yet).
- The `dispatch` answer's `lost` and `expired` counts. Both should normally be 0.
- The cron strings live in two places that must match: `apps/cron/wrangler.jsonc` and `SCHEDULES` in `apps/cron/src/index.ts` (a test checks this).
