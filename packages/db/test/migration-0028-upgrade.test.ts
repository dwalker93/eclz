import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));
const def = async (pg: PGlite, fn: string) => String((await pg.query<{ d: string }>(`SELECT pg_get_functiondef('${fn}'::regproc) AS d`)).rows[0]!.d);
const triggers = async (pg: PGlite) =>
  (await pg.query<{ tgname: string }>(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('exam_result_guard','payment_gateway_method_guard','payment_method_gateway_type_guard','gateway_transaction_guard') ORDER BY tgname`)).rows.map((r) => r.tgname);

describe("upgrade across 0028: a database that already ran 0016 and 0019", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("the old guard bodies are replaced by 0028 and the triggers that call them are neither dropped nor duplicated", async () => {
    const at = tags.indexOf("0028_guard_locking");
    expect(at).toBeGreaterThan(0);
    for (const t of tags.slice(0, at)) await apply(pg, t);
    // what a database that applied the earlier 0016 and 0019 holds
    expect(await def(pg, "exam_result_guard")).not.toMatch(/FOR SHARE/i);
    expect(await def(pg, "gateway_transaction_guard")).not.toMatch(/FOR SHARE/i);
    expect(await def(pg, "payment_gateway_method_guard")).not.toMatch(/FOR SHARE/i);
    const before = await triggers(pg);
    expect(before.length).toBeGreaterThanOrEqual(3);

    await apply(pg, tags[at]!);
    expect(await def(pg, "exam_result_guard")).toMatch(/FROM exam WHERE id = NEW\.exam_id FOR SHARE/i);
    expect(await def(pg, "gateway_transaction_guard")).toMatch(/FOR SHARE OF pm/i);
    expect(await def(pg, "payment_gateway_method_guard")).toMatch(/FROM payment_method WHERE id = NEW\.payment_method_id FOR SHARE/i);
    expect(await triggers(pg)).toEqual(before);
    // and the migration only replaces functions
    expect(readFileSync(join(dir, `${tags[at]}.sql`), "utf8")).not.toMatch(/CREATE TRIGGER|DROP TRIGGER/i);
  });
});
