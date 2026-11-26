import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const NEW = "0031_clear_sessions_of_disabled_users";
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));

describe("migration 0031: sessions of accounts that are disabled", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("removes the sessions of disabled users and leaves everyone else's", async () => {
    for (const t of tags.slice(0, tags.indexOf(NEW))) await apply(pg, t);
    const user = async (email: string, status: string) =>
      (await pg.query<{ id: string }>(`INSERT INTO "user" (email, status) VALUES ($1, $2) RETURNING id`, [email, status])).rows[0]!.id;
    const session = (userId: string, hash: string) =>
      pg.query(`INSERT INTO auth_session (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')`, [userId, hash]);
    const off = await user("off@example.com", "disabled");
    const on = await user("on@example.com", "active");
    await session(off, "h1");
    await session(off, "h2");
    await session(on, "h3");

    await apply(pg, NEW);
    const left = (await pg.query<{ user_id: string }>(`SELECT user_id FROM auth_session`)).rows.map((r) => r.user_id);
    expect(left).toEqual([on]);
  });
});
