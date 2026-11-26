/**
 * Applies the pending migrations, each in its own transaction (see src/migrate.ts for why). `bun run db:migrate` runs this.
 * DATABASE_URL (or DATABASE_URL_DIRECT) is read from the environment of the deployment; never commit it.
 */
import { resolve } from "node:path";
import postgres from "postgres";
import { migrateEachInOwnTransaction, migrationUrl, type Run } from "../src/migrate";

// A direct (not pooled) connection is the right one for migrations, so a non-empty DATABASE_URL_DIRECT wins; an empty one counts as unset.
const url = migrationUrl(process.env);
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const runOn = (q: postgres.Sql | postgres.TransactionSql): Run => async (statement, params) => [...(await q.unsafe(statement, (params ?? []) as never[]))] as Record<string, unknown>[];

try {
  const applied = await migrateEachInOwnTransaction(
    { run: runOn(client), transaction: async (fn) => void (await client.begin(async (tx) => void (await fn(runOn(tx))))) },
    resolve(import.meta.dir, "../drizzle"),
  );
  console.log(applied === 0 ? "No pending migrations." : `Applied ${applied} migration(s), each in its own transaction.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
