import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return String((e as Error).message);
  }
  return null;
};
const state = async (pg: PGlite) =>
  (await pg.query<{ conname: string; convalidated: boolean }>(`SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('notification_status_check','notification_unconfirmed_check') ORDER BY conname`)).rows;

describe("migrations 0032 and 0033: the unconfirmed notification status", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("existing rows survive, the new status is accepted only with a reason, and the checks are validated by the second migration", async () => {
    for (const t of tags.slice(0, tags.indexOf("0032_notification_unconfirmed"))) await apply(pg, t);
    const user = (await pg.query<{ id: string }>(`INSERT INTO "user" (email) VALUES ('n@example.com') RETURNING id`)).rows[0]!.id;
    const add = (status: string, error: string | null, key: string) =>
      pg.query(`INSERT INTO notification (user_id, channel, event, event_key, status, error, sent_at) VALUES ($1,'email','notice',$2,$3,$4,CASE WHEN $3 = 'sent' THEN now() END)`, [user, key, status, error]);
    await add("queued", null, "k1");
    await add("failed", "refused", "k2");
    expect(await failure(add("unconfirmed", "timed out", "k3"))).toMatch(/notification_status_check/);

    await apply(pg, "0032_notification_unconfirmed");
    expect(await state(pg)).toEqual([
      { conname: "notification_status_check", convalidated: false },
      { conname: "notification_unconfirmed_check", convalidated: false },
    ]);
    await add("unconfirmed", "timed out", "k3");
    expect(await failure(add("unconfirmed", null, "k4"))).toMatch(/notification_unconfirmed_check/);
    expect(await failure(add("bogus", "x", "k5"))).toMatch(/notification_status_check/);

    await apply(pg, "0033_validate_notification_unconfirmed");
    expect((await state(pg)).every((r) => r.convalidated)).toBe(true);
    expect((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM notification`)).rows[0]!.n).toBe(3);
  });
});
