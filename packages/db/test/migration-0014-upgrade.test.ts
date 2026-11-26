import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));
const one = async (pg: PGlite, sql: string, p: unknown[] = []) => (await pg.query<{ id: string }>(sql, p)).rows[0]!.id;
const NAMES = ["invoice_item_exception_enrollment_fk", "invoice_item_exception_enrollment_check"];
const validated = async (pg: PGlite) =>
  (await pg.query<{ conname: string; convalidated: boolean }>(`SELECT conname, convalidated FROM pg_constraint WHERE conname = ANY($1) ORDER BY conname`, [NAMES])).rows;

describe("upgrade across 0014 and 0026: discount lines from before the exception key", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());
  // A fixture that fails between SET ... replica and the reset must not leave the next test running without foreign keys and triggers.
  afterEach(() => pg.exec(`SET session_replication_role = DEFAULT`));

  test("0014 adds both constraints unvalidated, still refuses new bad rows, and 0026 validates them after the backfill", async () => {
    const at = tags.indexOf("0014_discount_exception_enrollment");
    for (const t of tags.slice(0, at)) await apply(pg, t);

    const org = await one(pg, `INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`);
    const branch = await one(pg, `INSERT INTO branch (organization_id, name) VALUES ($1, 'Main') RETURNING id`, [org]);
    const student = await one(pg, `INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Old Student', '2014-05-01') RETURNING id`);
    const inv = await one(pg, `INSERT INTO invoice (student_id, branch_id, due_date, subtotal, discount_total, total) VALUES ($1, $2, CURRENT_DATE + 7, 500, 100, 400) RETURNING id`, [student, branch]);
    const subject = await one(pg, `INSERT INTO subject (name) VALUES ('Maths') RETURNING id`);
    const course = await one(pg, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Class', 'class', 'scheduled') RETURNING id`, [subject, branch]);
    const enrol = await one(pg, `INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2) RETURNING id`, [course, student]);
    // the exception's author is not what this test is about
    await pg.exec(`SET session_replication_role = replica`);
    const exception = await one(pg, `INSERT INTO fee_exception (enrollment_id, course_id, kind, discount_type, discount_value, effective_from, reason, created_by) VALUES ($1, $2, 'discount', 'fixed', 100, '2026-01-01', 'Hardship', $3) RETURNING id`, [enrol, course, crypto.randomUUID()]);
    const fee = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id) VALUES ($1, 'adjustment', 500, $2) RETURNING id`, [inv, enrol]);
    const legacy = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, applies_to_item_id) VALUES ($1, 'discount', -100, $2, $3) RETURNING id`, [inv, exception, fee]);
    await pg.exec(`SET session_replication_role = origin`);

    await apply(pg, tags[at]!);
    // both are in force for new rows but have not scanned the existing ones yet
    expect(await validated(pg)).toEqual(NAMES.slice().sort().map((conname) => ({ conname, convalidated: false })));
    expect((await pg.query<{ enrollment_id: string }>(`SELECT enrollment_id FROM invoice_item WHERE id = $1`, [legacy])).rows[0]!.enrollment_id).toBe(enrol);
    await expect(pg.query(`INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, applies_to_item_id) VALUES ($1, 'discount', -5, $2, $3)`, [inv, exception, fee])).rejects.toThrow(/invoice_item_exception_enrollment_check/);

    for (const t of tags.slice(at + 1)) await apply(pg, t);
    expect(await validated(pg)).toEqual(NAMES.slice().sort().map((conname) => ({ conname, convalidated: true })));
  });
});

describe("upgrade across 0014: a legacy discount linked across enrolments", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());
  // A fixture that fails between SET ... replica and the reset must not leave the next test running without foreign keys and triggers.
  afterEach(() => pg.exec(`SET session_replication_role = DEFAULT`));

  test("0014 stops and lists the discount whose enrolment differs from the item it reduces, and runs once they match", async () => {
    const at = tags.indexOf("0014_discount_exception_enrollment");
    for (const t of tags.slice(0, at)) await apply(pg, t);
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
    await pg.exec(`SET session_replication_role = origin`);
    const feeA = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id) VALUES ($1, 'adjustment', 500, $2) RETURNING id`, [inv, enrolA]);
    const feeB = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id) VALUES ($1, 'adjustment', 500, $2) RETURNING id`, [inv, enrolB]);
    const good = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, applies_to_item_id) VALUES ($1, 'discount', -100, $2, $3) RETURNING id`, [inv, exception, feeA]);
    const bad = await one(pg, `INSERT INTO invoice_item (invoice_id, kind, amount, fee_exception_id, applies_to_item_id) VALUES ($1, 'discount', -100, $2, $3) RETURNING id`, [inv, exception, feeB]);

    let message = "";
    try {
      await apply(pg, tags[at]!);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/D19: 1 existing discount line/);
    expect(message).toContain(bad);
    expect(message).not.toContain(good);
    // the failed migration left nothing half-done, the backfill included
    expect((await pg.query(`SELECT 1 FROM pg_constraint WHERE conname = 'invoice_item_exception_enrollment_fk'`)).rows.length).toBe(0);
    expect((await pg.query<{ enrollment_id: string | null }>(`SELECT enrollment_id FROM invoice_item WHERE id = $1`, [bad])).rows[0]!.enrollment_id).toBeNull();

    await pg.query(`UPDATE invoice_item SET applies_to_item_id = $1 WHERE id = $2`, [feeA, bad]);
    for (const t of tags.slice(at)) await apply(pg, t);
    expect((await pg.query<{ enrollment_id: string }>(`SELECT enrollment_id FROM invoice_item WHERE id = ANY($1) ORDER BY id`, [[good, bad]])).rows.every((r) => r.enrollment_id === enrolA)).toBe(true);
  });
});

describe("0014 and a prebuilt invoice_item_applies_to_idx", () => {
  const IDX = "invoice_item_applies_to_idx";
  const before = async (prebuilt?: string) => {
    const pg = new PGlite({ extensions: { btree_gist } });
    const at = tags.indexOf("0014_discount_exception_enrollment");
    for (const t of tags.slice(0, at)) await apply(pg, t);
    if (prebuilt) await pg.exec(prebuilt);
    return { pg, at };
  };
  const count = async (pg: PGlite) => (await pg.query(`SELECT 1 FROM pg_indexes WHERE indexname = '${IDX}'`)).rows.length;

  test("an operator-built matching index is kept and the migration succeeds; with none, the migration builds it", async () => {
    const built = await before(`CREATE INDEX ${IDX} ON invoice_item USING btree (applies_to_item_id)`);
    await apply(built.pg, tags[built.at]!);
    expect(await count(built.pg)).toBe(1);
    await built.pg.close();
    const none = await before();
    await apply(none.pg, tags[none.at]!);
    expect(await count(none.pg)).toBe(1);
    await none.pg.close();
  });

  test("an index of that name that is on other columns, partial, or unique stops the migration with the repair, and a retry after dropping it works", async () => {
    for (const prebuilt of [`CREATE INDEX ${IDX} ON invoice_item USING btree (invoice_id)`, `CREATE INDEX ${IDX} ON invoice_item USING btree (applies_to_item_id) WHERE kind = 'discount'`, `CREATE UNIQUE INDEX ${IDX} ON invoice_item USING btree (applies_to_item_id)`]) {
      const { pg, at } = await before(prebuilt);
      let msg = "";
      try {
        await apply(pg, tags[at]!);
      } catch (e) {
        msg = (e as Error).message;
      }
      expect(msg).toMatch(/invoice_item_applies_to_idx already exists but is not a valid btree index/);
      expect(msg).toMatch(/CREATE INDEX CONCURRENTLY/);
      // the failed migration rolled back whole; once the index is dropped it runs
      await pg.exec(`DROP INDEX ${IDX}`);
      await apply(pg, tags[at]!);
      expect(await count(pg)).toBe(1);
      await pg.close();
    }
  });
});

