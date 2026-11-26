/**
 * The row-lock facts the exam close/start protocol relies on, on a real PostgreSQL server (PGlite has one connection and cannot show a wait).
 * Runs only when TEST_DATABASE_URL is set. closeExam takes FOR NO KEY UPDATE on the exam row, startAttempt takes FOR UPDATE; the domain test
 * `exams.test.ts` pins which statement each one runs. The child row inserted here (exam_course) takes the same FOR KEY SHARE on the exam row that an
 * exam_result insert does when a save finishes an expired attempt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { resetConnections } from "./pg-reset";

const url = process.env.TEST_DATABASE_URL;
const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!url)("exam row locks (real PostgreSQL)", () => {
  const dbName = `eclz_examlock_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let examId = "";
  let courseId = "";
  const children: string[] = [];

  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const target = new URL(url!);
    target.pathname = `/${dbName}`;
    sql = postgres(target.toString(), { max: 8, onnotice: () => {} });
    for (const t of tags) await sql.unsafe(readFileSync(join(dir, `${t}.sql`), "utf8"));
    const org = (await sql`INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`)[0]!.id;
    const branch = (await sql`INSERT INTO branch (organization_id, name) VALUES (${org}, 'Main') RETURNING id`)[0]!.id;
    const subject = (await sql`INSERT INTO subject (name) VALUES ('Maths') RETURNING id`)[0]!.id;
    const lecturer = (await sql`INSERT INTO lecturer (full_name) VALUES ('Lec') RETURNING id`)[0]!.id;
    examId = (await sql`INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks, status) VALUES (${lecturer}, 'E', 'paper', '2027-03-10', 100, 'draft') RETURNING id`)[0]!.id;
    await sql`UPDATE exam SET status = 'published' WHERE id = ${examId}`;
    courseId = (await sql`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES (${subject}, ${branch}, 'C', 'class', 'scheduled') RETURNING id`)[0]!.id;
    // a second course per child insert, so each test inserts a fresh (exam, course) pair
    for (let i = 0; i < 3; i++) children.push((await sql`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES (${subject}, ${branch}, ${`C${i}`}, 'class', 'scheduled') RETURNING id`)[0]!.id);
  });
  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end({ timeout: 5 });
  });

  /** Whether `work` finished within `ms`; the lock holder is left to the caller to release. */
  const finishesWithin = (work: Promise<unknown>, ms: number) => Promise.race([work.then(() => true), sleep(ms).then(() => false)]);

  test("FOR NO KEY UPDATE on the exam does not block an insert that references it, so close and a save that finishes an attempt cannot wait on each other", async () => {
    const closer = await sql.reserve();
    const saver = await sql.reserve();
    const pids = [(await closer`SELECT pg_backend_pid() AS pid`)[0]!.pid as number, (await saver`SELECT pg_backend_pid() AS pid`)[0]!.pid as number];
    try {
      await closer`BEGIN`;
      await closer`SELECT id FROM exam WHERE id = ${examId} FOR NO KEY UPDATE`;
      await saver`BEGIN`;
      const insert = saver`INSERT INTO exam_course (exam_id, course_id) VALUES (${examId}, ${children[0]!})`;
      expect(await finishesWithin(insert, 1000)).toBe(true);
      await saver`COMMIT`;
      await closer`COMMIT`;
    } finally {
      await resetConnections(sql, [{ conn: closer, pid: pids[0]! }, { conn: saver, pid: pids[1]! }]);
      closer.release();
      saver.release();
    }
  });

  test("FOR UPDATE on the exam does block it (the cycle the change removes), and a second start-style FOR UPDATE waits behind a close's NO KEY UPDATE", async () => {
    const holder = await sql.reserve();
    const waiter = await sql.reserve();
    const pids = [(await holder`SELECT pg_backend_pid() AS pid`)[0]!.pid as number, (await waiter`SELECT pg_backend_pid() AS pid`)[0]!.pid as number];
    try {
      await holder`BEGIN`;
      await holder`SELECT id FROM exam WHERE id = ${examId} FOR UPDATE`;
      await waiter`BEGIN`;
      const insert = waiter`INSERT INTO exam_course (exam_id, course_id) VALUES (${examId}, ${children[1]!})`;
      expect(await finishesWithin(insert.then(() => undefined, () => undefined), 700)).toBe(false);
      await holder`COMMIT`;
      await insert;
      await waiter`COMMIT`;

      const closer = holder;
      const starter = waiter;
      await closer`BEGIN`;
      await closer`SELECT id FROM exam WHERE id = ${examId} FOR NO KEY UPDATE`;
      await starter`BEGIN`;
      const start = starter`SELECT id FROM exam WHERE id = ${examId} FOR UPDATE`;
      expect(await finishesWithin(start.then(() => undefined, () => undefined), 700)).toBe(false);
      await closer`COMMIT`;
      await start;
      await starter`COMMIT`;
    } finally {
      await resetConnections(sql, [{ conn: holder, pid: pids[0]! }, { conn: waiter, pid: pids[1]! }]);
      holder.release();
      waiter.release();
    }
  });
});
