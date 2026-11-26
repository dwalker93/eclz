import { readMigrationFiles } from "drizzle-orm/migrator";

/** Runs one SQL statement and returns its rows. */
export type Run = (statement: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export interface MigrationConnection {
  run: Run;
  /** Runs `fn` in one transaction: committed when it returns, rolled back when it throws. */
  transaction(fn: (run: Run) => Promise<void>): Promise<void>;
}

const SCHEMA = "drizzle";
const TABLE = "__drizzle_migrations";
const LOCK_NAME = "workspace-db-migrate";

/**
 * Applies every pending migration, each in its own transaction, and returns how many it applied.
 *
 * `drizzle-kit migrate` (and drizzle-orm's `migrate`) put every pending migration in ONE transaction, so a `NOT VALID` constraint and the
 * `VALIDATE CONSTRAINT` in a later file all run before anything commits, and the validation scan runs under the lock the addition took.
 * Here each file commits before the next one starts, which is the boundary the validation migrations (0017, 0021, 0023, 0025, 0026, 0027) rely on.
 * The price: a run that stops part way leaves the earlier migrations applied (and recorded), so fix the failing one and run again; it carries on from there.
 * The history table is the same one drizzle uses, so the two runners can follow each other.
 */
export async function migrateEachInOwnTransaction(conn: MigrationConnection, migrationsFolder: string): Promise<number> {
  // Overlapping runs (two deploys, a retry while the first is still going) must not apply the same migration twice, and the history table has no unique key to
  // refuse the second row. Every transaction below first takes this lock, which is released at its commit or rollback (so it also works behind a pooler that
  // does not keep a session), and only then reads the history. The second runner waits, then sees the first one's rows and skips what is already applied.
  // The lock is per migration, not per run, so a long run does not hold it between files. drizzle's own migrator does not take it; do not run both at once.
  const lock = (run: Run) => run(`SELECT pg_advisory_xact_lock(hashtextextended('${LOCK_NAME}', 0))`);
  await conn.transaction(async (run) => {
    await lock(run);
    await run(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    await run(`CREATE TABLE IF NOT EXISTS "${SCHEMA}"."${TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  });
  let applied = 0;
  for (const migration of readMigrationFiles({ migrationsFolder })) {
    await conn.transaction(async (run) => {
      await lock(run);
      // Read after the lock, so a run that finished while this one waited is seen.
      const [last] = await run(`SELECT created_at FROM "${SCHEMA}"."${TABLE}" ORDER BY created_at DESC LIMIT 1`);
      if (last && Number(last.created_at) >= migration.folderMillis) return;
      for (const statement of migration.sql) await run(statement);
      await run(`INSERT INTO "${SCHEMA}"."${TABLE}" ("hash", "created_at") VALUES ($1, $2)`, [migration.hash, migration.folderMillis]);
      applied++;
    });
  }
  return applied;
}

/**
 * The connection string migrations use: a direct (not pooled) connection is the right one, so a non-empty DATABASE_URL_DIRECT wins. A variable that is
 * empty or only spaces counts as unset, because a deployment that blanks the direct URL still has a valid DATABASE_URL.
 */
export function migrationUrl(env: Record<string, string | undefined>): string | undefined {
  return env.DATABASE_URL_DIRECT?.trim() || env.DATABASE_URL?.trim() || undefined;
}
