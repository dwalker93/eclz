import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const NEW = "0030_course_intake_forward";
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
const def = async (pg: PGlite) => (await pg.query<{ d: string }>(`SELECT pg_get_functiondef('enrollment_check_intake'::regproc) AS d`)).rows[0]!.d;
const triggers = async (pg: PGlite) => (await pg.query<{ tgname: string }>(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`)).rows.map((r) => r.tgname);

/** The enrolment trigger function as the first release of 0013 wrote it: no course lock. */
const OLD_FUNCTION = `
CREATE OR REPLACE FUNCTION "enrollment_check_intake"() RETURNS trigger AS $$
DECLARE c_kind text; c_mode text;
BEGIN
  SELECT "kind", "learning_mode" INTO c_kind, c_mode FROM "course" WHERE "id" = NEW."course_id";
  IF c_kind = 'class' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a class enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'scheduled' AND NEW."intake_id" IS NULL THEN
    RAISE EXCEPTION 'C2: a scheduled program enrolment requires an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'self_paced' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a self-paced program enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;`;

/** A database that ran the earlier 0013 and everything up to the step before 0030. */
async function olderDatabase(pg: PGlite) {
  for (const t of tags.slice(0, tags.indexOf(NEW))) await apply(pg, t);
  await pg.exec(OLD_FUNCTION);
  const org = await one(pg, `INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`);
  const branch = await one(pg, `INSERT INTO branch (organization_id, name) VALUES ($1, 'Main') RETURNING id`, [org]);
  const subject = await one(pg, `INSERT INTO subject (name) VALUES ('Maths') RETURNING id`);
  const student = await one(pg, `INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Old Student', '2014-05-01') RETURNING id`);
  return { branch, subject, student };
}

describe("migration 0030: databases that ran the earlier 0013", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());
  // A fixture that fails between SET ... replica and the reset must not leave the next test running without foreign keys and triggers.
  afterEach(() => pg.exec(`SET session_replication_role = DEFAULT`));

  test("an enrolment that already breaks the intake rule stops it, names only that enrolment, and the repair lets it install the lock", async () => {
    const { branch, subject, student } = await olderDatabase(pg);
    const program = await one(pg, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Program', 'program', 'scheduled') RETURNING id`, [subject, branch]);
    const cls = await one(pg, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Class', 'class', 'scheduled') RETURNING id`, [subject, branch]);
    const intake = await one(pg, `INSERT INTO intake (course_id, name, starts_on) VALUES ($1, 'Jan', '2027-01-01') RETURNING id`, [program]);
    const student2 = await one(pg, `INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S2', 'Second', '2014-06-01') RETURNING id`);
    const good = await one(pg, `INSERT INTO enrollment (course_id, student_id, intake_id) VALUES ($1, $2, $3) RETURNING id`, [program, student2, intake]);
    const goodClass = await one(pg, `INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2) RETURNING id`, [cls, student]);
    // the stranded row: a scheduled program enrolment with no intake, which is what the first 0013 let through
    await pg.exec(`SET session_replication_role = replica`);
    const bad = await one(pg, `INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2) RETURNING id`, [program, student]);
    await pg.exec(`SET session_replication_role = DEFAULT`);

    const before = { fn: await def(pg), triggers: await triggers(pg) };
    expect(before.fn).not.toMatch(/FOR SHARE/);

    const message = await failure(apply(pg, NEW));
    expect(message).toMatch(/C2: 1 existing enrolment/);
    expect(message).toContain(bad);
    expect(message).not.toContain(good);
    expect(message).not.toContain(goodClass);
    expect(message).toMatch(/intake/);
    // the failed migration changed nothing
    expect(await def(pg)).toBe(before.fn);

    await pg.query(`UPDATE enrollment SET intake_id = $1 WHERE id = $2`, [intake, bad]);
    await apply(pg, NEW);
    expect(await def(pg)).toMatch(/FOR SHARE/);
    // no trigger was created or dropped: the ones 0013 installed are the ones left
    expect(await triggers(pg)).toEqual(before.triggers);
    // and the rule still holds
    expect(await failure(pg.query(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [program, await one(pg, `INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S3', 'Third', '2014-07-01') RETURNING id`)]))).toMatch(/requires an intake/);
  });

  test("a database with matching data upgrades without a stop", async () => {
    const pg2 = new PGlite({ extensions: { btree_gist } });
    try {
      const { branch, subject, student } = await olderDatabase(pg2);
      const cls = await one(pg2, `INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1, $2, 'Class', 'class', 'scheduled') RETURNING id`, [subject, branch]);
      await pg2.query(`INSERT INTO enrollment (course_id, student_id) VALUES ($1, $2)`, [cls, student]);
      await apply(pg2, NEW);
      expect(await def(pg2)).toMatch(/FOR SHARE/);
      // running it again changes nothing
      await apply(pg2, NEW);
    } finally {
      await pg2.close();
    }
  });
});
