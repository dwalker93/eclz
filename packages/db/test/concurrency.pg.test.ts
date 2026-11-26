/**
 * Concurrency tests that need a real PostgreSQL server (PGlite has one connection and cannot show a lock wait). They run only when
 * TEST_DATABASE_URL points at a server where the user may create databases, for example:
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres bun test test/concurrency.pg.test.ts
 * Each run creates its own database, applies every migration and drops it again.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { resetConnections } from "./pg-reset";

const url = process.env.TEST_DATABASE_URL;
const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);

type Conn = postgres.ReservedSql;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!url)("gateway guards under concurrent writes (real PostgreSQL)", () => {
  const dbName = `eclz_conc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let a: Conn;
  let b: Conn;
  let pidA = 0;
  let pidB = 0;
  let orgId = "";
  let branchId = "";
  let studentId = "";

  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const target = new URL(url!);
    target.pathname = `/${dbName}`;
    sql = postgres(target.toString(), { max: 6, onnotice: () => {} });
    for (const t of tags) await sql.unsafe(readFileSync(join(dir, `${t}.sql`), "utf8"));
    orgId = (await sql`INSERT INTO organization (name, type) VALUES ('Org', 'individual') RETURNING id`)[0]!.id;
    branchId = (await sql`INSERT INTO branch (organization_id, name) VALUES (${orgId}, 'Main') RETURNING id`)[0]!.id;
    studentId = (await sql`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Student', '2014-05-01') RETURNING id`)[0]!.id;
    a = await sql.reserve();
    b = await sql.reserve();
    pidA = (await a`SELECT pg_backend_pid() AS pid`)[0]!.pid;
    pidB = (await b`SELECT pg_backend_pid() AS pid`)[0]!.pid;
  });

  // A test that fails halfway must not leave a connection inside an aborted transaction for the next one.
  afterEach(() => resetConnections(sql, [{ conn: a, pid: pidA }, { conn: b, pid: pidB }]));

  afterAll(async () => {
    a?.release();
    b?.release();
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end({ timeout: 5 });
  });

  const method = async (type: string) =>
    (await sql`INSERT INTO payment_method (organization_id, type, label) VALUES (${orgId}, ${type}, ${type + Math.random()}) RETURNING id`)[0]!.id as string;
  const paymentOn = async (methodId: string) =>
    (await sql`INSERT INTO payment (student_id, branch_id, payment_method_id, amount) VALUES (${studentId}, ${branchId}, ${methodId}, 100) RETURNING id`)[0]!.id as string;
  const gatewayTx = (c: Conn, payment: string) =>
    c`INSERT INTO gateway_transaction (payment_id, provider, provider_ref) VALUES (${payment}, 'p', ${String(Math.random())})`;

  /** Waits until connection B is queued behind a lock, which is what proves the two writes were ordered. */
  const waitUntilBlocked = async (pid = pidB) => {
    for (let i = 0; i < 100; i++) {
      const [row] = await sql`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
      if (row?.wait_event_type === "Lock") return;
      await sleep(50);
    }
    throw new Error("the second write was never blocked behind the first");
  };
  const message = async (p: PromiseLike<unknown>) => {
    try {
      await p;
    } catch (e) {
      return String((e as Error).message);
    }
    return "";
  };

  test("a gateway insert in flight blocks the move of its payment to cash, and the move then fails", async () => {
    const gateway = await method("gateway");
    const cash = await method("cash");
    const payment = await paymentOn(gateway);
    await a`BEGIN`;
    await gatewayTx(a, payment); // not committed
    await b`BEGIN`;
    const move = message(b`UPDATE payment SET payment_method_id = ${cash} WHERE id = ${payment}`);
    await waitUntilBlocked();
    await a`COMMIT`;
    expect(await move).toMatch(/payment_gateway_method_guard/);
    await b`ROLLBACK`;
    expect((await sql`SELECT payment_method_id FROM payment WHERE id = ${payment}`)[0]!.payment_method_id).toBe(gateway);
  });

  test("a move of the payment to cash in flight blocks the gateway insert, and the insert then fails", async () => {
    const gateway = await method("gateway");
    const cash = await method("cash");
    const payment = await paymentOn(gateway);
    await b`BEGIN`;
    await b`UPDATE payment SET payment_method_id = ${cash} WHERE id = ${payment}`; // not committed, no gateway transaction yet
    await a`BEGIN`;
    const insert = message(gatewayTx(a, payment));
    await waitUntilBlocked(pidA);
    await b`COMMIT`;
    expect(await insert).toMatch(/gateway_transaction_guard/);
    await a`ROLLBACK`;
    expect((await sql`SELECT count(*)::int AS n FROM gateway_transaction WHERE payment_id = ${payment}`)[0]!.n).toBe(0);
  });

  test("a gateway insert in flight blocks the change of its method to cash, and the change then fails", async () => {
    const gateway = await method("gateway");
    const payment = await paymentOn(gateway);
    await a`BEGIN`;
    await gatewayTx(a, payment);
    await b`BEGIN`;
    const change = message(b`UPDATE payment_method SET type = 'cash' WHERE id = ${gateway}`);
    await waitUntilBlocked();
    await a`COMMIT`;
    expect(await change).toMatch(/payment_method_gateway_type_guard/);
    await b`ROLLBACK`;
    expect((await sql`SELECT type FROM payment_method WHERE id = ${gateway}`)[0]!.type).toBe("gateway");
  });

  test("a change of the method to cash in flight blocks the gateway insert, and the insert then fails", async () => {
    const gateway = await method("gateway");
    const payment = await paymentOn(gateway);
    await b`BEGIN`;
    await b`UPDATE payment_method SET type = 'cash' WHERE id = ${gateway}`; // not committed, no gateway transaction yet
    await a`BEGIN`;
    const insert = message(gatewayTx(a, payment));
    await waitUntilBlocked(pidA);
    await b`COMMIT`;
    expect(await insert).toMatch(/gateway_transaction_guard/);
    await a`ROLLBACK`;
    expect((await sql`SELECT type FROM payment_method WHERE id = ${gateway}`)[0]!.type).toBe("cash");
  });

  test("a move of a gateway payment to another gateway method in flight blocks that method becoming cash, and the change then fails", async () => {
    const first = await method("gateway");
    const second = await method("gateway");
    const payment = await paymentOn(first);
    await gatewayTx(sql as unknown as Conn, payment);
    await a`BEGIN`;
    await a`UPDATE payment SET payment_method_id = ${second} WHERE id = ${payment}`; // not committed
    await b`BEGIN`;
    const change = message(b`UPDATE payment_method SET type = 'cash' WHERE id = ${second}`);
    await waitUntilBlocked();
    await a`COMMIT`;
    expect(await change).toMatch(/payment_method_gateway_type_guard/);
    await b`ROLLBACK`;
    expect((await sql`SELECT type FROM payment_method WHERE id = ${second}`)[0]!.type).toBe("gateway");
  });

  test("a method becoming cash in flight blocks the move of a gateway payment onto it, and the move then fails", async () => {
    const first = await method("gateway");
    const second = await method("gateway");
    const payment = await paymentOn(first);
    await gatewayTx(sql as unknown as Conn, payment);
    await a`BEGIN`;
    await a`UPDATE payment_method SET type = 'cash' WHERE id = ${second}`; // not committed, nothing uses it yet
    await b`BEGIN`;
    const move = message(b`UPDATE payment SET payment_method_id = ${second} WHERE id = ${payment}`);
    await waitUntilBlocked();
    await a`COMMIT`;
    expect(await move).toMatch(/payment_gateway_method_guard/);
    await b`ROLLBACK`;
    expect((await sql`SELECT payment_method_id FROM payment WHERE id = ${payment}`)[0]!.payment_method_id).toBe(first);
  });

  test("with no gateway transaction involved, a payment moves between methods and a method changes type without waiting", async () => {
    const cash = await method("cash");
    const bank = await method("bank_transfer");
    const payment = await paymentOn(cash);
    await sql`UPDATE payment SET payment_method_id = ${bank} WHERE id = ${payment}`;
    await sql`UPDATE payment_method SET type = 'cash' WHERE id = ${bank}`;
    expect((await sql`SELECT payment_method_id FROM payment WHERE id = ${payment}`)[0]!.payment_method_id).toBe(bank);
  });

  test("a status update on an existing gateway transaction takes no payment lock, so it does not wait for a payment update", async () => {
    const gateway = await method("gateway");
    const payment = await paymentOn(gateway);
    const [gt] = await sql`INSERT INTO gateway_transaction (payment_id, provider, provider_ref) VALUES (${payment}, 'p', ${String(Math.random())}) RETURNING id`;
    await b`BEGIN`;
    await b`UPDATE payment SET amount = 101 WHERE id = ${payment}`; // holds the payment row
    await a`BEGIN`;
    await a`UPDATE gateway_transaction SET status = 'failed' WHERE id = ${gt!.id}`; // would hang if the guard locked the payment
    await a`COMMIT`;
    await b`COMMIT`;
    expect((await sql`SELECT status FROM gateway_transaction WHERE id = ${gt!.id}`)[0]!.status).toBe("failed");
  });
});

describe.skipIf(!url)("exam result writes against a mode change (real PostgreSQL)", () => {
  const dbName = `eclz_conc_exam_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let a: Conn;
  let b: Conn;
  let pidA = 0;
  let pidB = 0;
  let lecturerId = "";
  let studentId = "";

  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    const target = new URL(url!);
    target.pathname = `/${dbName}`;
    sql = postgres(target.toString(), { max: 4, onnotice: () => {} });
    for (const t of tags) await sql.unsafe(readFileSync(join(dir, `${t}.sql`), "utf8"));
    studentId = (await sql`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('S1', 'Student', '2014-05-01') RETURNING id`)[0]!.id;
    lecturerId = crypto.randomUUID();
    a = await sql.reserve();
    b = await sql.reserve();
    pidA = (await a`SELECT pg_backend_pid() AS pid`)[0]!.pid;
    pidB = (await b`SELECT pg_backend_pid() AS pid`)[0]!.pid;
  });

  // A test that fails halfway must not leave a connection inside an aborted transaction for the next one.
  afterEach(() => resetConnections(sql, [{ conn: a, pid: pidA }, { conn: b, pid: pidB }]));

  afterAll(async () => {
    a?.release();
    b?.release();
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end({ timeout: 5 });
  });

  /** A draft paper exam; the lecturer row is not what these tests are about, so the exam is made with the foreign keys off for that one insert. */
  const paperExam = async () => {
    const c = await sql.reserve();
    try {
      await c`SET session_replication_role = replica`;
      const [row] = await c`INSERT INTO exam (lecturer_id, title, mode, exam_date, max_marks) VALUES (${lecturerId}, 'Paper', 'paper', '2027-03-01', 100) RETURNING id`;
      return row!.id as string;
    } finally {
      // Restored even when the insert throws: the connection goes back to the pool and is reused.
      await c`SET session_replication_role = origin`.catch(() => undefined);
      c.release();
    }
  };
  const toOnline = (c: Conn, exam: string) =>
    c`UPDATE exam SET mode = 'online_mcq', opens_at = now() - interval '1 hour', closes_at = now() + interval '1 day', max_attempts = 1 WHERE id = ${exam}`;
  const manualResult = (c: Conn, exam: string) => c`INSERT INTO exam_result (exam_id, student_id, marks, source) VALUES (${exam}, ${studentId}, 50, 'manual')`;
  const blocked = async (pid: number) => {
    for (let i = 0; i < 100; i++) {
      const [row] = await sql`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}`;
      if (row?.wait_event_type === "Lock") return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("the second write was never blocked behind the first");
  };
  const message = async (p: PromiseLike<unknown>) => {
    try {
      await p;
    } catch (e) {
      return String((e as Error).message);
    }
    return "";
  };

  test("a manual result in flight blocks the change of its draft paper exam to online, and the change then fails", async () => {
    const exam = await paperExam();
    await a`BEGIN`;
    await manualResult(a, exam); // not committed
    await b`BEGIN`;
    const change = message(toOnline(b, exam));
    await blocked(pidB);
    await a`COMMIT`;
    expect(await change).toMatch(/exam_status_guard: the mode of an exam with results cannot change/);
    await b`ROLLBACK`;
    expect((await sql`SELECT mode FROM exam WHERE id = ${exam}`)[0]!.mode).toBe("paper");
  });

  test("a mode change to online in flight blocks the manual result, and the result then fails", async () => {
    const exam = await paperExam();
    await b`BEGIN`;
    await toOnline(b, exam); // not committed, no result yet
    await a`BEGIN`;
    const insert = message(manualResult(a, exam));
    await blocked(pidA);
    await b`COMMIT`;
    expect(await insert).toMatch(/exam_result_guard: an online exam result comes from an attempt/);
    await a`ROLLBACK`;
    expect((await sql`SELECT count(*)::int AS n FROM exam_result WHERE exam_id = ${exam}`)[0]!.n).toBe(0);
  });
});

