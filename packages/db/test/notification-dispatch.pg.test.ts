/**
 * The notification dispatcher on a real PostgreSQL server (PGlite has one connection, so it cannot show two dispatchers or a lock).
 * Runs only when TEST_DATABASE_URL is set. Pins what the claim/lease design promises: two dispatchers never send the same row, and while a
 * provider is being called the row is not locked and no transaction is open.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createNotificationService, type Db } from "../../domain/src";
import * as schema from "../src/schema";
import { seedDefaults } from "../src/seed";

const url = process.env.TEST_DATABASE_URL;
const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!url)("notification dispatch (real PostgreSQL)", () => {
  const dbName = `eclz_notify_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let db: Db;
  let orgId = "";

  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const target = new URL(url!);
    target.pathname = `/${dbName}`;
    sql = postgres(target.toString(), { max: 10, onnotice: () => {} });
    for (const t of tags) await sql.unsafe(readFileSync(join(dir, `${t}.sql`), "utf8"));
    db = drizzle(sql, { schema }) as unknown as Db;
    await seedDefaults(db, { organizationName: "Test Institute", type: "institution" });
    orgId = (await sql`SELECT id FROM organization`)[0]!.id as string;
    await sql`UPDATE organization SET enabled_modules = ${JSON.stringify({ email: true })}::jsonb`;
    await sql`INSERT INTO notification_channel (organization_id, channel, is_enabled) VALUES (${orgId}, 'email', true) ON CONFLICT (organization_id, channel) DO UPDATE SET is_enabled = true`;
  });
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end({ timeout: 5 });
  });

  async function queue(count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const email = `p${Date.now()}_${i}_${Math.floor(Math.random() * 1e6)}@example.com`;
      const u = (await sql`INSERT INTO "user" (email) VALUES (${email}) RETURNING id`)[0]!.id as string;
      ids.push((await sql`INSERT INTO notification (user_id, channel, event, event_key, status) VALUES (${u}, 'email', 'notice', ${`k${i}`}, 'queued') RETURNING id`)[0]!.id as string);
    }
    return ids;
  }

  test("two dispatchers running at once send every row exactly once", async () => {
    await sql`DELETE FROM notification`;
    const ids = await queue(12);
    const keys: string[] = [];
    const providers = {
      email: async (_m: unknown, ctx: { idempotencyKey: string }) => {
        keys.push(ctx.idempotencyKey);
        await sleep(15);
      },
    };
    const a = createNotificationService(db, { providers });
    const b = createNotificationService(db, { providers });
    const [ra, rb] = await Promise.all([a.dispatchQueued(), b.dispatchQueued()]);
    expect(ra.sent + rb.sent).toBe(12);
    expect(ra.sent).toBeGreaterThan(0);
    expect(rb.sent).toBeGreaterThan(0);
    expect([...keys].sort()).toEqual([...ids].sort());
    const left = await sql`SELECT count(*)::int AS c FROM notification WHERE status <> 'sent' OR claimed_until IS NOT NULL`;
    expect(left[0]!.c).toBe(0);
  });

  test("while the provider is being called the row is not locked and no transaction is open", async () => {
    await sql`DELETE FROM notification`;
    const [id] = await queue(1);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let entered!: () => void;
    const inside = new Promise<void>((r) => (entered = r));
    const svc = createNotificationService(db, {
      providers: {
        email: async () => {
          entered();
          await gate;
        },
      },
    });
    const run = svc.dispatchQueued();
    await inside;
    try {
      const probe = await sql.reserve();
      try {
        await probe`BEGIN`;
        // NOWAIT fails at once with 55P03 if anything still holds a lock on the row.
        const locked = await probe`SELECT status FROM notification WHERE id = ${id!} FOR UPDATE NOWAIT`;
        expect(locked[0]!.status).toBe("sending");
        await probe`ROLLBACK`;
      } finally {
        probe.release();
      }
      const idle = await sql`SELECT count(*)::int AS c FROM pg_stat_activity WHERE datname = ${dbName} AND state LIKE 'idle in transaction%'`;
      expect(idle[0]!.c).toBe(0);
    } finally {
      release();
    }
    expect((await run).sent).toBe(1);
    expect((await sql`SELECT status FROM notification WHERE id = ${id!}`)[0]!.status).toBe("sent");
  });
  test("a row another connection holds a lock on is skipped, not waited for", async () => {
    await sql`DELETE FROM notification`;
    const [first, second] = await queue(2);
    // The oldest row first: created_at is the order the dispatcher claims in.
    await sql`UPDATE notification SET created_at = now() - interval '1 hour' WHERE id = ${first!}`;
    const holder = await sql.reserve();
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM notification WHERE id = ${first!} FOR UPDATE`;
      const svc = createNotificationService(db, { providers: { email: async () => {} } });
      const done = await Promise.race([svc.dispatchQueued({ limit: 1 }).then((r) => r), sleep(3000).then(() => "waited" as const)]);
      expect(done).not.toBe("waited");
      expect((await sql`SELECT status FROM notification WHERE id = ${second!}`)[0]!.status).toBe("sent");
      expect((await sql`SELECT status FROM notification WHERE id = ${first!}`)[0]!.status).toBe("queued");
      await holder`ROLLBACK`;
    } finally {
      holder.release();
    }
  });
});
