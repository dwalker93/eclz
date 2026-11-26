import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));
const one = async (pg: PGlite, sql: string, p: unknown[] = []) => (await pg.query<{ id: string }>(sql, p)).rows[0]!.id;
const message = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return String((e as Error).message);
  }
  return "";
};
const def = async (pg: PGlite) => String((await pg.query<{ d: string }>(`SELECT pg_get_functiondef('invoice_item_check_discount_enrollment'::regproc) AS d`)).rows[0]!.d);
const indexes = async (pg: PGlite) => (await pg.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'invoice_item_applies_to_idx'`)).rows.length;
const triggers = async (pg: PGlite) => (await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'invoice_item_discount_enrollment'`)).rows[0]!.n;

/** The state of a database that ran the earlier 0014: the unlocked trigger body and no applies_to index. */
async function olderDatabase(pg: PGlite) {
  const at = tags.indexOf("0029_discount_enrollment_forward");
  expect(at).toBeGreaterThan(0);
  for (const t of tags.slice(0, at)) await apply(pg, t);
  await pg.exec(`DROP INDEX invoice_item_applies_to_idx`);
  await pg.exec(`CREATE OR REPLACE FUNCTION invoice_item_check_discount_enrollment() RETURNS trigger AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM invoice_item d JOIN invoice_item t ON t.id = d.applies_to_item_id
                 WHERE d.kind = 'discount' AND d.enrollment_id IS NOT NULL AND (d.id = NEW.id OR d.applies_to_item_id = NEW.id) AND t.enrollment_id IS DISTINCT FROM d.enrollment_id) THEN
        RAISE EXCEPTION 'D19: a discount must carry the same enrolment as the item it reduces' USING ERRCODE = 'check_violation';
      END IF;
      RETURN NULL;
    END $$ LANGUAGE plpgsql`);
  const org = await one(pg, `INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`);
  const branch = await one(pg, `INSERT INTO branch (organization_id, name) VALUES ($1, 'Main') RETURNING id`, [org]);
  const student = await one(pg, `INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Old Student', '2014-05-01') RETURNING id`);
  const subject = await one(pg, `INSERT INTO subject (name) VALUES ('Maths') RETURNING id`);
  const courseA = await one(pg, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'A', 'class', 'scheduled') RETURNING id`, [subject, branch]);
  const courseB = await one(pg, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'B', 'class', 'scheduled') RETURNING id`, [subject, branch]);
  const enrolA = await one(pg, `INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2) RETURNING id`, [courseA, student]);
  const enrolB = await one(pg, `INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2) RETURNING id`, [courseB, student]);
  const inv = await one(pg, `INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, CURRENT_DATE + 7, 1000, 200, 800) RETURNING id`, [student, branch]);
  await pg.exec(`SET session_replication_role = replica`);
  const exception = await one(pg, `INSERT INTO fee_exception (enrollment_id, course_id, kind, discount_type, discount_value, effective_from, reason, created_by) VALUES ($1, $2, 'discount', 'fixed', 100, '2026-01-01', 'Hardship', $3) RETURNING id`, [enrolA, courseA, crypto.randomUUID()]);
  const feeA = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id) VALUES ($1, 'adjustment', 500, $2) RETURNING id`, [inv, enrolA]);
  const feeB = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id) VALUES ($1, 'adjustment', 500, $2) RETURNING id`, [inv, enrolB]);
  const good = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, applies_to_item_id, enrollment_id) VALUES ($1, 'discount', -100, $2, $3, $4) RETURNING id`, [inv, exception, feeA, enrolA]);
  const crossed = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, applies_to_item_id, enrollment_id) VALUES ($1, 'discount', -100, $2, $3, $4) RETURNING id`, [inv, exception, feeB, enrolA]);
  await pg.exec(`SET session_replication_role = origin`);
  return { at, feeA, good, crossed };
}

describe("upgrade across 0029: a database that already ran the earlier 0014", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());
  // A fixture that fails between SET ... replica and the reset must not leave the next test running without foreign keys and triggers.
  afterEach(() => pg.exec(`SET session_replication_role = DEFAULT`));

  test("0029 stops on a discount whose enrolment differs from the item it reduces, names only that one, and installs the lock and index once it is reconciled", async () => {
    const { at, feeA, good, crossed } = await olderDatabase(pg);
    expect(await def(pg)).not.toMatch(/FOR SHARE/i);
    expect(await indexes(pg)).toBe(0);
    const trig = await triggers(pg);

    const msg = await message(apply(pg, tags[at]!));
    expect(msg).toMatch(/D19: 1 existing discount line/);
    expect(msg).toContain(crossed);
    expect(msg).not.toContain(good);
    // a failed 0029 leaves the old state: nothing half-installed
    expect(await def(pg)).not.toMatch(/FOR SHARE/i);
    expect(await indexes(pg)).toBe(0);

    await pg.query(`UPDATE invoice_item SET applies_to_item_id = $1 WHERE id = $2`, [feeA, crossed]);
    await apply(pg, tags[at]!);
    expect(await def(pg)).toMatch(/"?id"? IN \(NEW\."?id"?, NEW\."?applies_to_item_id"?\)\s+ORDER BY "?id"?\s+FOR SHARE/i);
    expect(await indexes(pg)).toBe(1);
    expect(await triggers(pg)).toBe(trig);
    expect(readFileSync(join(dir, `${tags[at]}.sql`), "utf8")).not.toMatch(/CREATE TRIGGER|DROP TRIGGER/i);
  });

  test("with matching discounts and a prebuilt valid index it changes nothing but the trigger body", async () => {
    const other = new PGlite({ extensions: { btree_gist } });
    try {
      const { at, feeA, crossed } = await olderDatabase(other);
      await other.query(`UPDATE invoice_item SET applies_to_item_id = $1 WHERE id = $2`, [feeA, crossed]);
      await other.exec(`CREATE INDEX invoice_item_applies_to_idx ON invoice_item USING btree (applies_to_item_id)`);
      await apply(other, tags[at]!);
      expect(await indexes(other)).toBe(1);
      expect(await def(other)).toMatch(/FOR SHARE/i);
    } finally {
      await other.close();
    }
  });
});
