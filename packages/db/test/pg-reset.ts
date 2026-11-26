import type postgres from "postgres";

/**
 * Puts reserved connections back in a usable state after a test, whether it passed or failed halfway: any statement still running or waiting on a lock is
 * cancelled (from another connection, using the pids read before the test), then each connection rolls back. A failed statement leaves a transaction aborted,
 * and a statement queued behind a lock would make a plain ROLLBACK on the same connection wait for it, so cancelling comes first. A ROLLBACK outside a
 * transaction is harmless.
 */
export async function resetConnections(sql: postgres.Sql, conns: { conn: postgres.ReservedSql; pid: number }[]): Promise<void> {
  const pids = conns.map((c) => c.pid);
  await sql`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE pid = ANY(${pids}::int[]) AND state = 'active' AND pid <> pg_backend_pid()`;
  await Promise.allSettled(conns.map(({ conn }) => conn`ROLLBACK`));
}
