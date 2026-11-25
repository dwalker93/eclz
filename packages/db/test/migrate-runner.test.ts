import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { migrateEachInOwnTransaction, type MigrationConnection } from "../src/migrate";

const connection = (pg: PGlite): MigrationConnection => ({
  run: async (statement, params) => (await pg.query<Record<string, unknown>>(statement, params ?? [])).rows,
  transaction: async (fn) => void (await pg.transaction(async (tx) => fn(async (statement, params) => (await tx.query<Record<string, unknown>>(statement, params ?? [])).rows))),
});

/** A folder with the given migrations (name, sql) in order, laid out the way drizzle-kit writes it. */
function folder(migrations: [string, string][]) {
  const dir = mkdtempSync(join(tmpdir(), "migrate-runner-"));
  mkdirSync(join(dir, "meta"));
  writeFileSync(
    join(dir, "meta/_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries: migrations.map(([tag], idx) => ({ idx, version: "7", when: 1_700_000_000_000 + idx * 1000, tag, breakpoints: true })) }),
  );
  for (const [tag, sql] of migrations) writeFileSync(join(dir, `${tag}.sql`), sql);
  return dir;
}
const recorded = async (pg: PGlite) => (await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)).rows[0]!.n;

describe("migrateEachInOwnTransaction", () => {
  const dbs: PGlite[] = [];
  const fresh = () => {
    const pg = new PGlite();
    dbs.push(pg);
    return pg;
  };
  afterAll(async () => {
    for (const pg of dbs) await pg.close();
  });

  test("each migration commits before the next starts: a failing third one leaves the first two applied and recorded, and nothing of itself", async () => {
    const pg = fresh();
    const dir = folder([
      ["0000_add", `CREATE TABLE t (id int);--> statement-breakpoint\nALTER TABLE t ADD CONSTRAINT t_pos CHECK (id > 0) NOT VALID;`],
      ["0001_validate", `ALTER TABLE t VALIDATE CONSTRAINT t_pos;`],
      ["0002_broken", `CREATE TABLE half_done (id int);--> statement-breakpoint\nSELECT * FROM does_not_exist;`],
    ]);
    await expect(migrateEachInOwnTransaction(connection(pg), dir)).rejects.toThrow(/does_not_exist/);
    expect(await recorded(pg)).toBe(2);
    expect((await pg.query(`SELECT 1 FROM pg_constraint WHERE conname = 't_pos' AND convalidated`)).rows.length).toBe(1);
    expect((await pg.query(`SELECT to_regclass('half_done') AS r`)).rows[0]).toEqual({ r: null });
  });

  test("a rerun carries on from the failed migration once it is fixed, and a further rerun does nothing", async () => {
    const pg = fresh();
    const first = folder([["0000_a", `CREATE TABLE a (id int);`], ["0001_b", `SELECT * FROM missing;`]]);
    await expect(migrateEachInOwnTransaction(connection(pg), first)).rejects.toThrow();
    expect(await recorded(pg)).toBe(1);
    const fixed = folder([["0000_a", `CREATE TABLE a (id int);`], ["0001_b", `CREATE TABLE b (id int);`]]);
    expect(await migrateEachInOwnTransaction(connection(pg), fixed)).toBe(1);
    expect(await migrateEachInOwnTransaction(connection(pg), fixed)).toBe(0);
    expect(await recorded(pg)).toBe(2);
  });

  test("the repository's own migrations apply through it and leave the exception and thread constraints validated", async () => {
    const pg = new PGlite({ extensions: { btree_gist: (await import("@electric-sql/pglite/contrib/btree_gist")).btree_gist } });
    dbs.push(pg);
    const applied = await migrateEachInOwnTransaction(connection(pg), resolve(import.meta.dir, "../drizzle"));
    expect(applied).toBeGreaterThan(20);
    const rows = (await pg.query<{ convalidated: boolean }>(`SELECT convalidated FROM pg_constraint WHERE conname IN ('invoice_item_exception_enrollment_fk', 'message_thread_id_message_thread_id_fk')`)).rows;
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.convalidated)).toBe(true);
  });
});
