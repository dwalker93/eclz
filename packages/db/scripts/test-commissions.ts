/**
 * Scenario tests for commission accrual and reversal on PGlite. Run with: bun run db:test:commissions
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/schema";
import { seedDefaults } from "../src/seed";
import {
  createCommissionService,
  createEnrollmentService,
  createInvoicingService,
  createPaymentService,
  hmacSigner,
  pickRule,
  splitByShare,
  type Db,
} from "../src/services";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite({ extensions: { btree_gist } });
const db = drizzle(pg, { schema }) as unknown as Db;

let passed = 0;
let failed = 0;
const failures: string[] = [];
async function ok(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    const m = String((e as Error).message).slice(0, 400);
    failures.push(`${name} ${m}`);
    console.log(`FAIL  ${name}  -> ${m}`);
  }
}
function eq<T>(actual: T, expected: T, what = "value") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}
type Row = Record<string, unknown>;
const q = async (text: string, params: unknown[] = []): Promise<Row[]> =>
  (await pg.query<Row>(text, params)).rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])),
  );
const id = async (text: string, params: unknown[] = []) => String((await q(text + " RETURNING id", params))[0]!.id);

// ---- pure
type RuleRow = typeof schema.commissionRule.$inferSelect;
const rule = (o: Partial<RuleRow> & { id: string }): RuleRow =>
  ({ lecturerId: "L", subjectId: null, gradeLevelId: null, courseId: null, calcType: "percent", commissionRate: "10.00", effectiveFrom: "2020-01-01", effectiveTo: null, createdAt: new Date(), ...o }) as RuleRow;
await ok("H4: the most specific rule in effect wins", async () => {
  const ctx = { courseId: "C", subjectId: "S", gradeLevelId: "G", date: "2027-03-10" };
  const rules = [
    rule({ id: "default" }),
    rule({ id: "subject", subjectId: "S" }),
    rule({ id: "subjectGrade", subjectId: "S", gradeLevelId: "G" }),
    rule({ id: "course", courseId: "C" }),
  ];
  eq(pickRule(rules, ctx)?.id, "course");
  eq(pickRule(rules.filter((r) => r.id !== "course"), ctx)?.id, "subjectGrade");
  eq(pickRule(rules.filter((r) => !["course", "subjectGrade"].includes(r.id)), ctx)?.id, "subject");
  eq(pickRule([rule({ id: "default" })], ctx)?.id, "default");
  eq(pickRule([rule({ id: "other", subjectId: "X" }), rule({ id: "othergrade", subjectId: "S", gradeLevelId: "H" })], ctx), null);
  eq(pickRule([rule({ id: "ended", effectiveTo: "2027-03-10" }), rule({ id: "future", effectiveFrom: "2027-03-11" })], ctx), null);
});
await ok("splitByShare adds back exactly", async () => {
  eq(splitByShare(10001, [50, 50]), [5001, 5000]);
  eq(splitByShare(10000, [60, 40]), [6000, 4000]);
  eq(splitByShare(100, [34, 33, 33]).reduce((s, x) => s + x, 0), 100);
  eq(splitByShare(500, [100]), [500]);
});

// ---- database
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
for (const e of journal.entries) await pg.exec(readFileSync(join(root, "drizzle", `${e.tag}.sql`), "utf8"));
await seedDefaults(db as never, { organizationName: "Test Institute", type: "institution" });
await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = jsonb_set(COALESCE(enabled_modules,'{}'::jsonb), '{commissions}', 'true')`);

const now = () => new Date("2027-03-10T10:00:00Z");
const commissions = createCommissionService({ now });
const pay = createPaymentService(db, { signer: hmacSigner("s"), now, hooks: commissions.hooks });
const enrol = createEnrollmentService(db, { now });
const inv = createInvoicingService(db, { now });

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const staff = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);
const g6 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal OFFSET 5 LIMIT 1`))[0]!.id);
const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/1.jpg', 'image/jpeg', 1000)`);
const bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'T', '1')`, [b1]);
let n = 0;
let ref = 0;
const lecturer = () => id(`INSERT INTO lecturer (full_name) VALUES ($1)`, [`Lecturer ${++n}`]);
const setRule = (lec: string, calc: string, rate: number, scope: { course?: string; subject?: string; grade?: string } = {}) =>
  id(`INSERT INTO commission_rule (lecturer_id, course_id, subject_id, grade_level_id, calc_type, commission_rate, effective_from) VALUES ($1,$2,$3,$4,$5,$6,'2020-01-01')`, [
    lec, scope.course ?? null, scope.subject ?? null, scope.grade ?? null, calc, rate,
  ]);

/** A self-paced package course taught by the given lecturers, with a 10 000.00 package and the student enrolled (one invoice). */
async function scenario(teachers: { lec: string; share: number }[], price = 10000) {
  const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'program','self_paced',false)`, [subj, b1, `Course ${++n}`]);
  for (const [i, t] of teachers.entries()) {
    await q(`INSERT INTO course_lecturer (course_id, lecturer_id, is_primary, share_percent) VALUES ($1,$2,$3,$4)`, [c, t.lec, i === 0, t.share]);
  }
  const f = await id(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type) VALUES ($1,$2,'Pkg',true,'one_time_package')`, [b1, c]);
  await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1,$2,'2020-01-01')`, [f, price]);
  const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`C${++n}`, `Student ${n}`]);
  await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1,$2,'2027-01-01')`, [s, g6]);
  const r = await enrol.enrollStudent({ studentId: s, courseId: c });
  const item = String((await q(`SELECT id FROM invoice_item WHERE invoice_id = $1`, [r.invoiceId]))[0]!.id);
  return { course: c, student: s, invoiceId: r.invoiceId!, item };
}
async function payIt(sc: { student: string; invoiceId: string }, amount: string) {
  const sub = await pay.submitPayment({ studentId: sc.student, branchId: b1, paymentMethodId: bankMethod, bankAccountId: bank, slipFileId: slip, amount, paidOn: "2027-03-10", referenceNo: `R${++ref}`, submittedBy: staff, invoiceIds: [sc.invoiceId] } as never);
  await pay.verifyPayment({ paymentId: sub.id, verifiedBy: staff });
  return sub.id as string;
}
const entries = (lec: string) => q(`SELECT * FROM commission_entry WHERE lecturer_id = $1 ORDER BY created_at, id`, [lec]);

await ok("H5: percent commission on a full payment, with the rule snapshotted", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 20);
  const sc = await scenario([{ lec, share: 100 }]);
  await payIt(sc, "10000");
  const e = await entries(lec);
  eq(e.length, 1);
  eq([e[0]!.base_amount, e[0]!.commission_amount, e[0]!.teacher_amount], ["10000.00", "2000.00", "8000.00"]);
  eq([e[0]!.calc_type_applied, e[0]!.rate_applied, e[0]!.share_percent_applied, e[0]!.basis_applied, e[0]!.status, e[0]!.capped], ["percent", "20.00", "100.00", "paid", "accrued", false]);
});
await ok("partial payments accrue in proportion", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  await payIt(sc, "2500");
  await payIt(sc, "7500");
  const e = await entries(lec);
  eq(e.map((x) => x.commission_amount), ["250.00", "750.00"]);
});
await ok("H2/H3: co-teachers each get their own entry, base split by share", async () => {
  const a = await lecturer(), b = await lecturer();
  await setRule(a, "percent", 10);
  await setRule(b, "percent", 30);
  const sc = await scenario([{ lec: a, share: 60 }, { lec: b, share: 40 }]);
  await payIt(sc, "10000");
  const ea = (await entries(a))[0]!, eb = (await entries(b))[0]!;
  eq([ea.base_amount, ea.commission_amount], ["6000.00", "600.00"]);
  eq([eb.base_amount, eb.commission_amount], ["4000.00", "1200.00"]);
  eq(ea.share_percent_applied, "60.00");
});
await ok("H4: a course rule overrides the lecturer default, and only for that course", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  await setRule(lec, "percent", 25, { course: sc.course });
  await payIt(sc, "10000");
  eq((await entries(lec))[0]!.commission_amount, "2500.00");
  const other = await scenario([{ lec, share: 100 }]);
  await payIt(other, "10000");
  eq((await entries(lec))[1]!.commission_amount, "1000.00");
});
await ok("H4: subject plus grade beats subject, using the grade billed on the item", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  await setRule(lec, "percent", 15, { subject: subj });
  await setRule(lec, "percent", 22, { subject: subj, grade: g6 });
  const sc = await scenario([{ lec, share: 100 }]);
  await q(`UPDATE invoice_item SET grade_level_id = $2 WHERE id = $1`, [sc.item, g6]);
  await payIt(sc, "10000");
  eq((await entries(lec))[0]!.commission_amount, "2200.00");
});
await ok("H5: fixed per student month accrues proportionally and totals exactly", async () => {
  const lec = await lecturer();
  await setRule(lec, "fixed_per_student_month", 1000);
  const sc = await scenario([{ lec, share: 100 }]);
  await payIt(sc, "3333");
  await payIt(sc, "3333");
  await payIt(sc, "3334");
  const e = await entries(lec);
  eq(e.map((x) => x.commission_amount), ["333.30", "333.30", "333.40"]);
  eq(e.reduce((s, x) => s + Number(x.commission_amount), 0).toFixed(2), "1000.00");
});
await ok("H5: fixed commission is split between co-teachers by share", async () => {
  const a = await lecturer(), b = await lecturer();
  await setRule(a, "fixed_per_student_month", 1000);
  await setRule(b, "fixed_per_student_month", 1000);
  const sc = await scenario([{ lec: a, share: 70 }, { lec: b, share: 30 }]);
  await payIt(sc, "10000");
  eq((await entries(a))[0]!.commission_amount, "700.00");
  eq((await entries(b))[0]!.commission_amount, "300.00");
});
await ok("H12: a fixed amount above the base is capped", async () => {
  const lec = await lecturer();
  await setRule(lec, "fixed_per_student_month", 20000);
  const sc = await scenario([{ lec, share: 100 }]);
  await payIt(sc, "10000");
  const e = (await entries(lec))[0]!;
  eq([e.commission_amount, e.teacher_amount, e.capped], ["10000.00", "0.00", true]);
});
await ok("H10: discounted fee follows the organization's basis (paid, then list)", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  await inv.addInvoiceLine({ invoiceId: sc.invoiceId, kind: "discount", amount: "-2000", appliesToItemId: sc.item, description: "d", createdBy: staff, reason: "r" });
  await payIt(sc, "8000");
  const paid = (await entries(lec))[0]!;
  eq([paid.base_amount, paid.commission_amount, paid.basis_applied], ["8000.00", "800.00", "paid"]);
  await q(`UPDATE organization SET discount_commission_basis = 'list'`);
  const sc2 = await scenario([{ lec, share: 100 }]);
  await inv.addInvoiceLine({ invoiceId: sc2.invoiceId, kind: "discount", amount: "-2000", appliesToItemId: sc2.item, description: "d", createdBy: staff, reason: "r" });
  await payIt(sc2, "8000");
  const list = (await entries(lec))[1]!;
  eq([list.base_amount, list.commission_amount, list.basis_applied], ["10000.00", "1000.00", "list"]);
  await q(`UPDATE organization SET discount_commission_basis = 'paid'`);
});
await ok("no rule means no entry, and a missing lecturer or the module off accrues nothing", async () => {
  const lec = await lecturer();
  const sc = await scenario([{ lec, share: 100 }]);
  await payIt(sc, "10000");
  eq((await entries(lec)).length, 0);
  await setRule(lec, "percent", 10);
  await q(`UPDATE organization SET enabled_modules = jsonb_set(enabled_modules, '{commissions}', 'false')`);
  const sc2 = await scenario([{ lec, share: 100 }]);
  await payIt(sc2, "10000");
  eq((await entries(lec)).length, 0);
  await q(`UPDATE organization SET enabled_modules = jsonb_set(enabled_modules, '{commissions}', 'true')`);
  const none = await scenario([]);
  await payIt(none, "10000");
});
await ok("accrual is idempotent per allocation and lecturer", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  await payIt(sc, "10000");
  const allocs = await q(`SELECT * FROM payment_allocation WHERE invoice_id = $1`, [sc.invoiceId]);
  const rows = allocs.map((a) => ({ id: a.id, invoiceItemId: a.invoice_item_id, amount: a.amount }));
  const again = await db.transaction((tx) => commissions.accrue(tx, { allocations: rows as never }));
  eq(again.created.length, 0);
  eq(again.skipped[0]!.reason, "already_accrued");
  eq((await entries(lec)).length, 1);
});
await ok("content and adjustment items accrue nothing", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  const adj = await inv.addInvoiceLine({ invoiceId: sc.invoiceId, kind: "adjustment", amount: "500", description: "Materials", createdBy: staff, reason: "r" });
  // pay only the adjustment line by explicit allocation of the whole invoice: fee 10000 + 500
  await payIt(sc, "10500");
  const e = await entries(lec);
  eq(e.length, 1);
  eq(e[0]!.base_amount, "10000.00");
  void adj;
});
await ok("H7: voiding a payment voids unsettled entries", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  const p = await payIt(sc, "10000");
  await pay.voidPayment({ paymentId: p, voidedBy: staff, reason: "bounced" });
  const e = await entries(lec);
  eq(e.map((x) => x.status), ["void"]);
  eq(e.length, 1);
  // paying again accrues afresh
  await payIt(sc, "10000");
  eq((await entries(lec)).map((x) => x.status), ["void", "accrued"]);
});
await ok("H7/H8: voiding after settlement adds one negative reversal entry", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  const p = await payIt(sc, "10000");
  const payout = await id(`INSERT INTO teacher_payout (lecturer_id, period_start, period_end, grossCollected, commission_total, net_payable) VALUES ($1,'2027-03-01','2027-04-01',0,0,0)`.replace("grossCollected", "gross_collected"), [lec]);
  await q(`UPDATE commission_entry SET status = 'settled', payout_id = $2 WHERE lecturer_id = $1`, [lec, payout]);
  await pay.voidPayment({ paymentId: p, voidedBy: staff, reason: "chargeback" });
  const e = await entries(lec);
  eq(e.length, 2);
  eq(e[0]!.status, "settled");
  eq([e[1]!.entry_type, e[1]!.base_amount, e[1]!.commission_amount, e[1]!.teacher_amount, e[1]!.status], ["reversal", "-10000.00", "-1000.00", "-9000.00", "accrued"]);
  eq(e[1]!.reverses_entry_id, e[0]!.id);
});
await ok("a failing accrual rolls back the verification", async () => {
  const lec = await lecturer();
  await setRule(lec, "percent", 10);
  const sc = await scenario([{ lec, share: 100 }]);
  const bad = createPaymentService(db, {
    signer: hmacSigner("s"),
    now,
    hooks: { afterVerify: async (tx, e) => { await commissions.accrue(tx, e); throw new Error("later hook failed"); } },
  });
  const sub = await bad.submitPayment({ studentId: sc.student, branchId: b1, paymentMethodId: bankMethod, bankAccountId: bank, slipFileId: slip, amount: "10000", paidOn: "2027-03-10", referenceNo: `R${++ref}`, submittedBy: staff, invoiceIds: [sc.invoiceId] } as never);
  let threw = false;
  try { await bad.verifyPayment({ paymentId: sub.id, verifiedBy: staff }); } catch { threw = true; }
  eq(threw, true);
  eq((await entries(lec)).length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
