import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));

describe("upgrade across 0006: existing content lines", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("content lines from before 0006 are kept as adjustments, cancelled ones too, and the constraints validate", async () => {
    const at = tags.indexOf("0006_phase4_tables");
    for (const t of tags.slice(0, at)) await apply(pg, t);

    const one = async (sql: string, p: unknown[] = []) => (await pg.query<{ id: string }>(sql, p)).rows[0]!.id;
    const org = await one(`INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`);
    const branch = await one(`INSERT INTO branch (organization_id, name) VALUES ($1, 'Main') RETURNING id`, [org]);
    const student = await one(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Old Student', '2014-05-01') RETURNING id`);
    const inv = await one(`INSERT INTO invoice (student_id, branch_id, due_date, subtotal, total) VALUES ($1, $2, CURRENT_DATE + 7, 500, 500) RETURNING id`, [student, branch]);
    await pg.query(`INSERT INTO invoice_item (invoice_id, kind, amount, description) VALUES ($1, 'content', 300, 'Workbook')`, [inv]);
    await pg.query(`INSERT INTO invoice_item (invoice_id, kind, amount, cancelled_at) VALUES ($1, 'content', 200, now())`, [inv]);

    for (const t of tags.slice(at)) await apply(pg, t);

    const rows = (await pg.query<{ kind: string; amount: string; description: string; cancelled: boolean }>(
      `SELECT kind, amount::text, description, cancelled_at IS NOT NULL AS cancelled FROM invoice_item WHERE invoice_id = $1 ORDER BY amount`, [inv])).rows;
    expect(rows).toEqual([
      { kind: "adjustment", amount: "200.00", description: "Content (migrated)", cancelled: true },
      { kind: "adjustment", amount: "300.00", description: "Content (migrated): Workbook", cancelled: false },
    ]);
    const c = (await pg.query<{ conname: string; convalidated: boolean }>(
      `SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('invoice_item_purchase_invoice_fk', 'invoice_item_content_fields_check')`)).rows;
    expect(c.length).toBe(2);
    expect(c.every((r) => r.convalidated)).toBe(true);
  });
});
