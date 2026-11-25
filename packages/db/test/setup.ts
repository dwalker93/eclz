import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/schema";

export type Row = Record<string, unknown>;

const migrations = resolve(import.meta.dir, "../drizzle");

/**
 * An in-process PostgreSQL (PGlite) with every migration applied, in journal order. Each test file creates its own,
 * so files never share state. Close it in `afterAll`.
 */
export async function createTestDb() {
  const pg = new PGlite({ extensions: { btree_gist } });
  try {
    const journal = JSON.parse(readFileSync(join(migrations, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
    for (const e of journal.entries) await pg.exec(readFileSync(join(migrations, `${e.tag}.sql`), "utf8"));
  } catch (err) {
    // The caller never receives `close`, so close here and keep the original error.
    await pg.close().catch(() => {});
    throw err;
  }
  const db = drizzle(pg, { schema });
  /** Raw SQL, rows as returned by the driver. */
  const q = async (text: string, params: unknown[] = []): Promise<Row[]> => (await pg.query<Row>(text, params)).rows;
  /** Inserts and returns the new row's id. */
  const id = async (text: string, params: unknown[] = []): Promise<string> => String((await q(text + " RETURNING id", params))[0]!.id);
  return { pg, db, q, id, close: () => pg.close() };
}
