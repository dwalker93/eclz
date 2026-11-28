import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { migrateEachInOwnTransaction, migrationUrl, type MigrationConnection } from "../src/migrate";

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
    const dir = resolve(import.meta.dir, "../drizzle");
    const journalLength = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: unknown[] }).entries.length;
    const applied = await migrateEachInOwnTransaction(connection(pg), dir);
    expect(applied).toBe(journalLength);
    expect(await recorded(pg)).toBe(journalLength);
    const rows = (await pg.query<{ convalidated: boolean }>(`SELECT convalidated FROM pg_constraint WHERE conname IN ('invoice_item_exception_enrollment_fk', 'message_thread_id_message_thread_id_fk')`)).rows;
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.convalidated)).toBe(true);
  });
});

describe("migrateEachInOwnTransaction: lock order", () => {
  test("every transaction takes the migration lock before it reads the history, and the history is read inside the transaction", async () => {
    const pg = new PGlite();
    const log: string[] = [];
    const record = (tag: string, run: Parameters<MigrationConnection["transaction"]>[0] extends (r: infer R) => unknown ? R : never) =>
      (async (statement: string, params?: unknown[]) => {
        log.push(`${tag}:${statement.replace(/\s+/g, " ").slice(0, 40)}`);
        return run(statement, params);
      }) as typeof run;
    const base = connection(pg);
    const conn: MigrationConnection = {
      run: record("outside", base.run),
      transaction: (fn) => base.transaction((run) => fn(record("tx", run))),
    };
    try {
      await migrateEachInOwnTransaction(conn, folder([["0000_a", `CREATE TABLE a (id int);`], ["0001_b", `CREATE TABLE b (id int);`]]));
      const reads = log.map((l, i) => [l, i] as const).filter(([l]) => l.includes("SELECT created_at"));
      expect(reads.length).toBe(2);
      for (const [l, i] of reads) {
        expect(l.startsWith("tx:")).toBe(true);
        expect(log[i - 1]).toContain("pg_advisory_xact_lock");
      }
      expect(log.some((l) => l.startsWith("outside:"))).toBe(false);
    } finally {
      await pg.close();
    }
  });
});

describe("the repository's migration journal", () => {
  const dir = resolve(import.meta.dir, "../drizzle");
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { idx: number; when: number; tag: string }[] };

  test("is numbered 0, 1, 2 ... with a file for each tag, and its times strictly increase", () => {
    // The runner skips every migration that is not newer than the last one applied, so a time that does not increase would be skipped without a word.
    journal.entries.forEach((e, n) => {
      expect(e.idx).toBe(n);
      expect(e.tag.startsWith(String(n).padStart(4, "0") + "_")).toBe(true);
      expect(readFileSync(join(dir, `${e.tag}.sql`), "utf8").length).toBeGreaterThan(0);
      if (n > 0) expect(e.when).toBeGreaterThan(journal.entries[n - 1]!.when);
    });
  });

  test("0000_init is dated just after the head of the history it replaced, and not in the future", () => {
    // 1795161269844 was the last migration time of the 37-migration chain. Later generated migrations carry the clock time of their own generation, so they sort after it.
    expect(journal.entries[0]!.tag).toBe("0000_init");
    expect(journal.entries[0]!.when).toBe(1795161269845);
    expect(journal.entries[0]!.when).toBeLessThan(Date.now());
  });
});

describe("migrationUrl", () => {
  test("a non-empty direct URL wins; an empty or blank one counts as unset", () => {
    expect(migrationUrl({ DATABASE_URL_DIRECT: "postgres://direct", DATABASE_URL: "postgres://pooled" })).toBe("postgres://direct");
    expect(migrationUrl({ DATABASE_URL: "postgres://pooled" })).toBe("postgres://pooled");
    expect(migrationUrl({ DATABASE_URL_DIRECT: "", DATABASE_URL: "postgres://pooled" })).toBe("postgres://pooled");
    expect(migrationUrl({ DATABASE_URL_DIRECT: "   ", DATABASE_URL: "postgres://pooled" })).toBe("postgres://pooled");
    expect(migrationUrl({ DATABASE_URL_DIRECT: "postgres://direct", DATABASE_URL: "" })).toBe("postgres://direct");
    expect(migrationUrl({ DATABASE_URL_DIRECT: "", DATABASE_URL: "" })).toBeUndefined();
    expect(migrationUrl({})).toBeUndefined();
  });
});
