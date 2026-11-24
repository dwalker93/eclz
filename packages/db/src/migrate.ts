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
  await conn.run(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
  await conn.run(`CREATE TABLE IF NOT EXISTS "${SCHEMA}"."${TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const [last] = await conn.run(`SELECT created_at FROM "${SCHEMA}"."${TABLE}" ORDER BY created_at DESC LIMIT 1`);
  let applied = 0;
  for (const migration of readMigrationFiles({ migrationsFolder })) {
    if (last && Number(last.created_at) >= migration.folderMillis) continue;
    await conn.transaction(async (run) => {
      for (const statement of migration.sql) await run(statement);
      await run(`INSERT INTO "${SCHEMA}"."${TABLE}" ("hash", "created_at") VALUES ($1, $2)`, [migration.hash, migration.folderMillis]);
    });
    applied++;
  }
  return applied;
}
