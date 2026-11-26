/**
 * Overlapping migration runs against a real PostgreSQL server (PGlite has one connection and cannot overlap). Runs only when TEST_DATABASE_URL is set,
 * like concurrency.pg.test.ts. Each run creates its own database and drops it again.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { migrateEachInOwnTransaction, type MigrationConnection, type Run } from "../src/migrate";

const url = process.env.TEST_DATABASE_URL;

function folder(migrations: [string, string][]) {
  const dir = mkdtempSync(join(tmpdir(), "migrate-lock-"));
  mkdirSync(join(dir, "meta"));
  writeFileSync(
    join(dir, "meta/_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries: migrations.map(([tag], idx) => ({ idx, version: "7", when: 1_700_000_000_000 + idx * 1000, tag, breakpoints: true })) }),
  );
  for (const [tag, sql] of migrations) writeFileSync(join(dir, `${tag}.sql`), sql);
  return dir;
}

describe.skipIf(!url)("two overlapping runners (real PostgreSQL)", () => {
  const dbName = `eclz_mig_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let target = "";
  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const u = new URL(url!);
    u.pathname = `/${dbName}`;
    target = u.toString();
  });
  afterAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end({ timeout: 5 });
  });

  // The same wiring scripts/migrate.ts uses: one connection per runner.
  const runnerOn = (client: postgres.Sql): MigrationConnection => {
    const on = (q: postgres.Sql | postgres.TransactionSql): Run => async (statement, params) => [...(await q.unsafe(statement, (params ?? []) as never[]))] as Record<string, unknown>[];
    return { run: on(client), transaction: async (fn) => void (await client.begin(async (tx) => void (await fn(on(tx))))) };
  };

  test("both finish without error, every migration is applied and recorded once, and the first one's slow statement was not run twice", async () => {
    // not idempotent: a second application fails on CREATE TABLE or doubles the row; the sleep makes the two runners overlap
    const dir = folder([
      ["0000_create", `CREATE TABLE once (n int);--> statement-breakpoint\nSELECT pg_sleep(1.5);`],
      ["0001_seed", `INSERT INTO once VALUES (1);`],
    ]);
    const c1 = postgres(target, { max: 1, onnotice: () => {} });
    const c2 = postgres(target, { max: 1, onnotice: () => {} });
    try {
      const [x, y] = await Promise.all([migrateEachInOwnTransaction(runnerOn(c1), dir), migrateEachInOwnTransaction(runnerOn(c2), dir)]);
      expect(x + y).toBe(2);
      expect((await c1`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)[0]!.n).toBe(2);
      expect((await c1`SELECT count(*)::int AS n FROM once`)[0]!.n).toBe(1);
    } finally {
      await c1.end({ timeout: 5 });
      await c2.end({ timeout: 5 });
    }
  });
});
