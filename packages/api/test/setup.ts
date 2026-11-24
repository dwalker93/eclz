import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import { seedDefaults } from "@workspace/db/seed";
import type { Db } from "@workspace/domain";

export type Row = Record<string, unknown>;

const migrations = resolve(import.meta.dir, "../../db/drizzle");

/**
 * An in-process PostgreSQL (PGlite) with every migration of @workspace/db applied and the provisioning seed run
 * (one institution, default branch, 13 grades, starter roles). Each test file creates its own, so files never share state.
 * Close it in `afterAll`. If setup itself fails, the database is closed here and the original error is thrown.
 *
 * `dateOnly` turns every Date in a raw query result into "YYYY-MM-DD", which is what most scenario tests compare against.
 */
export async function createScenarioDb(opts: { dateOnly?: boolean; migrationsDir?: string } = {}) {
  const pg = new PGlite({ extensions: { btree_gist } });
  const dir = opts.migrationsDir ?? migrations;
  const db = drizzle(pg, { schema }) as unknown as Db;
  try {
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
    for (const e of journal.entries) await pg.exec(readFileSync(join(dir, `${e.tag}.sql`), "utf8"));
    await seedDefaults(db, { organizationName: "Test Institute", type: "institution" });
  } catch (err) {
    // The caller never receives `close`, so its afterAll cannot run: close here and keep the original error.
    await pg.close().catch(() => {});
    throw err;
  }
  const q = async (text: string, params: unknown[] = []): Promise<Row[]> => {
    const rows = (await pg.query<Row>(text, params)).rows;
    if (!opts.dateOnly) return rows;
    return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])));
  };
  /** Inserts and returns the new row's id. */
  const id = async (text: string, params: unknown[] = []): Promise<string> => String((await q(text + " RETURNING id", params))[0]!.id);
  return { pg, db, q, id, close: () => pg.close() };
}
