import { eq, sql } from "drizzle-orm";
import { authRateLimit } from "@workspace/db/schema";
import { ServiceError, type Db, type Tx } from "@workspace/domain";

/**
 * Fixed-window counter shared by every server through the database. Each call counts one attempt and throws `rate_limited` once the
 * window already holds `limit` attempts. One atomic upsert, so concurrent attempts cannot slip past the count.
 */
export async function hit(db: Db, key: string, rule: { limit: number; windowMs: number }, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - rule.windowMs);
  const [row] = await db
    .insert(authRateLimit)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: authRateLimit.key,
      set: {
        count: sql`CASE WHEN ${authRateLimit.windowStart} <= ${cutoff.toISOString()}::timestamptz THEN 1 ELSE ${authRateLimit.count} + 1 END`,
        windowStart: sql`CASE WHEN ${authRateLimit.windowStart} <= ${cutoff.toISOString()}::timestamptz THEN ${now.toISOString()}::timestamptz ELSE ${authRateLimit.windowStart} END`,
      },
    })
    .returning({ count: authRateLimit.count });
  if (row!.count > rule.limit) throw new ServiceError("rate_limited", "Too many attempts. Try again later.");
}

/** Resets a counter. Takes a transaction too, so a reset can commit or roll back together with the step that earned it. */
export async function clear(db: Db | Tx, key: string): Promise<void> {
  await db.delete(authRateLimit).where(eq(authRateLimit.key, key));
}
