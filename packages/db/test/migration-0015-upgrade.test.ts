import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));
const one = async (pg: PGlite, sql: string, p: unknown[] = []) => (await pg.query<{ id: string }>(sql, p)).rows[0]!.id;
const FK = "message_thread_id_message_thread_id_fk";
const state = async (pg: PGlite) => (await pg.query<{ convalidated: boolean }>(`SELECT convalidated FROM pg_constraint WHERE conname = $1`, [FK])).rows;

describe("upgrade across 0015 and 0027: messages that already exist", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("0015 adds the thread key unvalidated but cascading, and 0027 validates it with the existing messages kept", async () => {
    const at = tags.indexOf("0015_message_thread_cascade");
    for (const t of tags.slice(0, at)) await apply(pg, t);
    const user = await one(pg, `INSERT INTO "user" (username) VALUES ('u1') RETURNING id`);
    const thread = await one(pg, `INSERT INTO message_thread (subject, created_by) VALUES ('Hello', $1) RETURNING id`, [user]);
    await pg.query(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2)`, [thread, user]);
    await pg.query(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'Old message')`, [thread, user]);

    await apply(pg, tags[at]!);
    expect(await state(pg)).toEqual([{ convalidated: false }]);
    // new writes are checked at once, and deleting a thread still removes its messages
    const other = await one(pg, `INSERT INTO message_thread (subject, created_by) VALUES ('Bye', $1) RETURNING id`, [user]);
    await pg.query(`INSERT INTO thread_participant (thread_id, user_id) VALUES ($1, $2)`, [other, user]);
    await pg.query(`INSERT INTO message (thread_id, sender_id, body) VALUES ($1, $2, 'New message')`, [other, user]);
    await pg.query(`DELETE FROM message_thread WHERE id = $1`, [other]);
    expect((await pg.query(`SELECT 1 FROM message WHERE thread_id = $1`, [other])).rows.length).toBe(0);

    for (const t of tags.slice(at + 1)) await apply(pg, t);
    expect(await state(pg)).toEqual([{ convalidated: true }]);
    expect((await pg.query<{ body: string }>(`SELECT body FROM message WHERE thread_id = $1`, [thread])).rows).toEqual([{ body: "Old message" }]);
  });
});
