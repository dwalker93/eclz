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
  (await pg.query<{ conname: string; convalidated: boolean }>(`SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('notification_status_check','notification_sending_check') ORDER BY conname`)).rows;

describe("migrations 0034 and 0035: the sending notification status and its lease", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("existing rows survive, `sending` needs a lease, the checks are validated by the second migration, and the lease index exists", async () => {
    for (const t of tags.slice(0, tags.indexOf("0034_notification_sending"))) await apply(pg, t);
    const user = (await pg.query<{ id: string }>(`INSERT INTO "user" (email) VALUES ('n@example.com') RETURNING id`)).rows[0]!.id;
    const add = (status: string, key: string) =>
      pg.query(
        `INSERT INTO notification (user_id, channel, event, event_key, status, error, sent_at) VALUES ($1,'email','notice',$2,$3,CASE WHEN $3 IN ('failed','unconfirmed') THEN 'x' END,CASE WHEN $3 = 'sent' THEN now() END)`,
        [user, key, status],
      );
    await add("queued", "k1");
    await add("unconfirmed", "k2");
    expect(await failure(add("sending", "k3"))).toMatch(/notification_status_check/);

    await apply(pg, "0034_notification_sending");
    expect(await state(pg)).toEqual([
      { conname: "notification_sending_check", convalidated: false },
      { conname: "notification_status_check", convalidated: false },
    ]);
    const lease = (status: string, claimed: string | null, key: string) =>
      pg.query(`INSERT INTO notification (user_id, channel, event, event_key, status, claimed_until) VALUES ($1,'email','notice',$2,$3,$4)`, [user, key, status, claimed]);
    await lease("sending", "2027-01-01T00:00:00Z", "k3");
    expect(await failure(lease("sending", null, "k4"))).toMatch(/notification_sending_check/);
    expect(await failure(lease("bogus", null, "k5"))).toMatch(/notification_status_check/);
    // Existing rows have no lease and are not sending.
    expect((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM notification WHERE claimed_until IS NULL`)).rows[0]!.n).toBe(2);

    await apply(pg, "0035_validate_notification_sending");
    expect((await state(pg)).every((r) => r.convalidated)).toBe(true);
    const idx = await pg.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE indexname = 'notification_sending_idx'`);
    expect(idx.rows[0]!.indexdef).toMatch(/claimed_until.*WHERE.*sending/);
    expect((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM notification`)).rows[0]!.n).toBe(3);
  });
});
