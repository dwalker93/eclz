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
const one = async (pg: PGlite, sql: string, p: unknown[] = []) => (await pg.query<{ id: string }>(sql, p)).rows[0]!.id;

/** A database as it was before 0013, with the rows the two tests need. */
async function before0013(pg: PGlite) {
  for (const t of tags.slice(0, tags.indexOf("0013_course_change_and_finite_money"))) await apply(pg, t);
  const org = await one(pg, `INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`);
  const branch = await one(pg, `INSERT INTO branch (organization_id, name) VALUES ($1, 'Main') RETURNING id`, [org]);
  return { branch };
}

describe("upgrade across 0013: existing data", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("an enrolment that already breaks C2 stops the upgrade with a message that says how to fix it, and the fix lets it run", async () => {
    const { branch } = await before0013(pg);
    const subject = await one(pg, `INSERT INTO subject (name) VALUES ('Maths') RETURNING id`);
    const course = await one(pg, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Was a class', 'class', 'scheduled') RETURNING id`, [subject, branch]);
    const student = await one(pg, `INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Old Student', '2014-05-01') RETURNING id`);
    const enrol = await one(pg, `INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2) RETURNING id`, [course, student]);
    // before 0013 nothing stops the course changing under its enrolment
    await pg.query(`UPDATE course SET kind = 'program' WHERE id = $1`, [course]);

    const message = await failure(apply(pg, "0013_course_change_and_finite_money"));
    expect(message).toMatch(/C2: 1 existing enrolment/);
    expect(message).toContain(enrol);
    expect(message).toMatch(/intake/);
    // the failed migration left nothing half-done
    expect((await pg.query(`SELECT 1 FROM pg_trigger WHERE tgname = 'course_intake_rule'`)).rows.length).toBe(0);

    const intake = await one(pg, `INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'Jan', '2027-01-01') RETURNING id`, [course]);
    await pg.query(`UPDATE enrollment SET intake_id = $1 WHERE id = $2`, [intake, enrol]);
    await apply(pg, "0013_course_change_and_finite_money");
    expect((await pg.query(`SELECT 1 FROM pg_trigger WHERE tgname = 'course_intake_rule'`)).rows.length).toBe(1);
  });
});

describe("upgrade across 0013 and 0025: a NaN already stored", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());

  test("0013 does not abort on it, new NaN is refused at once, 0025 lists the rows until they are corrected and then validates", async () => {
    const { branch } = await before0013(pg);
    const structure = await one(pg, `INSERT INTO fee_structure (branch_id, name, billing_type, frequency) VALUES ($1, 'Monthly', 'recurring', 'monthly') RETURNING id`, [branch]);
    const rate = await one(pg, `INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 'NaN', '2026-01-01') RETURNING id`, [structure]);

    const order = tags.slice(tags.indexOf("0013_course_change_and_finite_money"));
    for (const t of order.slice(0, order.indexOf("0025_validate_finite_money_checks"))) await apply(pg, t);

    // the checks exist, unvalidated; the old row is untouched and a new NaN is already refused
    const state = (await pg.query<{ validated: boolean }>(`SELECT convalidated AS validated FROM pg_constraint WHERE conname = 'fee_rate_amount_finite_check'`)).rows;
    expect(state).toEqual([{ validated: false }]);
    expect((await pg.query<{ amount: string }>(`SELECT amount::text FROM fee_rate WHERE id = $1`, [rate])).rows[0]!.amount).toBe("NaN");
    expect(await failure(pg.query(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 'NaN', '2027-01-01')`, [structure]))).toMatch(/finite_check/);

    // 0025 names the column and tells the operator what to do, and keeps failing until it is done
    const message = await failure(apply(pg, "0025_validate_finite_money_checks"));
    expect(message).toMatch(/fee_rate\.amount: 1 row/);
    expect(message).toMatch(/real value/);
    expect(message).toMatch(/Do not use 0/);
    expect(await failure(apply(pg, "0025_validate_finite_money_checks"))).toMatch(/fee_rate\.amount/);

    await pg.query(`UPDATE fee_rate SET amount = 4500 WHERE id = $1`, [rate]);
    await apply(pg, "0025_validate_finite_money_checks");
    const left = (await pg.query(`SELECT 1 FROM pg_constraint WHERE conname LIKE '%\\_finite\\_check' AND NOT convalidated`)).rows;
    expect(left.length).toBe(0);
  });
});
