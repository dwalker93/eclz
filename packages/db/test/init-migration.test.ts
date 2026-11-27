import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { migrateEachInOwnTransaction, type MigrationConnection } from "../src/migrate";

const connection = (pg: PGlite): MigrationConnection => ({
  run: async (statement, params) => (await pg.query<Record<string, unknown>>(statement, params ?? [])).rows,
  transaction: async (fn) => void (await pg.transaction(async (tx) => fn(async (statement, params) => (await tx.query<Record<string, unknown>>(statement, params ?? [])).rows))),
});
const drizzleFolder = resolve(import.meta.dir, "../drizzle");

describe("0000_init lands in schema public whatever the search_path says", () => {
  const dbs: PGlite[] = [];
  afterEach(async () => {
    for (const d of dbs.splice(0)) await d.close();
  });
  const fresh = () => {
    const pg = new PGlite({ extensions: { btree_gist } });
    dbs.push(pg);
    return pg;
  };
  const tablesIn = async (pg: PGlite, schema: string) =>
    (await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [schema])).rows[0]!.n;

  test("with a role search_path that points at another schema, every table is still created in public and the other schema stays empty", async () => {
    const pg = fresh();
    await pg.exec(`CREATE SCHEMA tenant_x; SET search_path = tenant_x, public`);
    expect(await migrateEachInOwnTransaction(connection(pg), drizzleFolder)).toBe(1);
    expect(await tablesIn(pg, "tenant_x")).toBe(0);
    expect(await tablesIn(pg, "public")).toBeGreaterThan(60);
    expect((await pg.query(`SELECT to_regclass('public.organization') AS t`)).rows[0]).toEqual({ t: "organization" });
    // functions and triggers went to public too
    expect((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'tenant_x'`)).rows[0]!.n).toBe(0);
  });

  test("a search_path that names no schema at all works too", async () => {
    const pg = fresh();
    await pg.exec(`SET search_path = nowhere`);
    await migrateEachInOwnTransaction(connection(pg), drizzleFolder);
    expect(await tablesIn(pg, "public")).toBeGreaterThan(60);
  });

  test("when public cannot take the objects the migration fails and is not recorded, so it never reports success without public.organization", async () => {
    const pg = fresh();
    await pg.exec(`DROP SCHEMA public CASCADE`);
    await expect(migrateEachInOwnTransaction(connection(pg), drizzleFolder)).rejects.toThrow();
    expect((await pg.query(`SELECT to_regclass('drizzle.__drizzle_migrations') AS t`)).rows[0]).toEqual({ t: "drizzle.__drizzle_migrations" });
    expect((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)).rows[0]!.n).toBe(0);
  });

  test("the closing check fails the migration when the objects landed elsewhere, even if the pin were missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "init-nopin-"));
    cpSync(drizzleFolder, dir, { recursive: true });
    const file = join(dir, "0000_init.sql");
    const sql = readFileSync(file, "utf8");
    expect(sql).toContain("SET search_path = public;");
    writeFileSync(file, sql.replace("SET search_path = public;", "SELECT 1;"));
    const pg = fresh();
    await pg.exec(`CREATE SCHEMA tenant_x; SET search_path = tenant_x`);
    await expect(migrateEachInOwnTransaction(connection(pg), dir)).rejects.toThrow(/not created in schema public/);
    expect(await tablesIn(pg, "tenant_x")).toBe(0); // rolled back whole
  });
});
