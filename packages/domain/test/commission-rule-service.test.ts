/** Commission rule management: scopes, overlap, ending, removal, warnings, authorization. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createCommissionRuleService, createPaymentService, hmacSigner } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

const rules = createCommissionRuleService(db, { now: () => new Date("2027-03-10T10:00:00Z") });
const acl = createAccessControlService(db);
let n = 0;
const newUser = () => id(`INSERT INTO "user" (email, status) VALUES ($1, 'active')`, [`c${++n}@example.com`]);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const root = await newUser();
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });
await q(`INSERT INTO role (name, description) VALUES ('rule_editor', 'custom')`);
await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'rule_editor' AND p.code = 'commissions.manage'`);
const branchEditor = await newUser();
await acl.assignRole({ userId: branchEditor, roleName: "rule_editor", branchId: b1, actor: root });

const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Rule Teacher')`);
const lec2 = await id(`INSERT INTO lecturer (full_name) VALUES ('Other Teacher')`);
const lec3 = await id(`INSERT INTO lecturer (full_name) VALUES ('Third Teacher')`);
const sci = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const mat = await id(`INSERT INTO subject (name) VALUES ('Maths')`);
const g6 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal LIMIT 1`))[0]!.id);
const c1 = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1,$2,'G6 Science','class','scheduled')`, [sci, b1]);
await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2), ($1,$3)`, [c1, lec, lec3]);
const fee = await id(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1,$2,'Monthly','recurring','monthly')`, [b1, c1]);
await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 1000, '2027-01-01')`, [fee]);
const base = { actor: root, lecturerId: lec, calcType: "percent" as const, rate: "20", effectiveFrom: "2027-01-01" };

describe("creating rules", () => {
  test("the four scopes; the rate is stored with two decimals", async () => {
    const d = await rules.create({ ...base });
    eq([d.rule.commissionRate, d.rule.courseId, d.rule.subjectId, d.warnings], ["20.00", null, null, []]);
    eq((await rules.create({ ...base, scope: { subjectId: sci } })).rule.subjectId, sci);
    eq((await rules.create({ ...base, scope: { subjectId: sci, gradeLevelId: g6 } })).rule.gradeLevelId, g6);
    eq((await rules.create({ ...base, scope: { courseId: c1 }, rate: "12.5" })).rule.commissionRate, "12.50");
    eq((await q(`SELECT action FROM audit_log WHERE action = 'commission_rule.create'`)).length, 4);
  });

  test("overlapping dates in the same scope are refused; other scopes, lecturers and later dates are fine", async () => {
    await fails("rule_overlap", () => rules.create({ ...base }));
    await fails("rule_overlap", () => rules.create({ ...base, effectiveFrom: "2030-01-01" })); // the open rule runs forever
    eq((await rules.create({ ...base, scope: { subjectId: mat } })).rule.subjectId, mat);
    eq((await rules.create({ ...base, lecturerId: lec2 })).rule.lecturerId, lec2);
    const closed = await rules.create({ ...base, lecturerId: lec2, scope: { subjectId: sci }, effectiveFrom: "2026-01-01", effectiveTo: "2027-01-01" });
    eq(closed.rule.effectiveTo, "2027-01-01");
    eq((await rules.create({ ...base, lecturerId: lec2, scope: { subjectId: sci }, effectiveFrom: "2027-01-01" })).rule.effectiveFrom, "2027-01-01"); // starts the day the other ended
    await fails("rule_overlap", () => rules.create({ ...base, lecturerId: lec2, scope: { subjectId: sci }, effectiveFrom: "2026-06-01", effectiveTo: "2027-02-01" }));
  });

  test("input is validated", async () => {
    const bad = (over: object) => fails("invalid_input", () => rules.create({ ...base, lecturerId: lec2, scope: { subjectId: mat }, effectiveFrom: "2031-01-01", ...over } as never));
    await bad({ rate: "101" });
    await bad({ rate: "-1" });
    await bad({ rate: "abc" });
    await bad({ rate: "1.234" });
    await bad({ calcType: "flat" });
    await bad({ effectiveFrom: "1 Jan" });
    await bad({ effectiveTo: "2031-01-01" });
    await bad({ effectiveTo: "2030-01-01" });
    await bad({ scope: { gradeLevelId: g6 } });
    await bad({ scope: { courseId: c1, subjectId: sci } });
    await bad({ scope: { courseId: "00000000-0000-4000-8000-000000000000" } });
    await bad({ scope: { subjectId: "00000000-0000-4000-8000-000000000000" } });
    await bad({ lecturerId: "00000000-0000-4000-8000-000000000000" });
  });

  test("a fixed amount above the lowest current fee gets a warning, a smaller one does not", async () => {
    const fixed = { ...base, lecturerId: lec3, calcType: "fixed_per_student_month" as const, scope: { courseId: c1 }, effectiveFrom: "2028-01-01", effectiveTo: "2028-06-01" };
    eq((await rules.create({ ...fixed, rate: "1500" })).warnings.length, 1);
    eq((await rules.create({ ...fixed, rate: "100", effectiveFrom: "2028-06-01", effectiveTo: "2028-09-01" })).warnings, []);
    eq((await rules.create({ ...fixed, scope: { subjectId: sci }, rate: "1500", effectiveFrom: "2029-01-01", effectiveTo: "2029-02-01" })).warnings.length, 1);
  });

  test("only an all-branches commissions.manage may write or read rules", async () => {
    await fails("forbidden", () => rules.create({ ...base, actor: branchEditor, scope: { subjectId: mat }, effectiveFrom: "2040-01-01" }));
    await fails("forbidden", () => rules.list({ actor: branchEditor }));
    await fails("forbidden", () => rules.end({ ruleId: "00000000-0000-4000-8000-000000000000", actor: branchEditor, effectiveTo: "2030-01-01" }));
    await fails("forbidden", () => rules.remove({ ruleId: "00000000-0000-4000-8000-000000000000", actor: branchEditor }));
  });
});

describe("ending, removing and listing", () => {
  test("end closes or shortens, never extends; list filters by lecturer and day", async () => {
    const r = (await rules.create({ ...base, lecturerId: lec2, scope: { subjectId: mat }, effectiveFrom: "2035-01-01" })).rule;
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "2035-01-01" }));
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "x" }));
    eq((await rules.end({ ruleId: r.id, actor: root, effectiveTo: "2036-01-01" })).effectiveTo, "2036-01-01");
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "2037-01-01" }));
    eq((await rules.end({ ruleId: r.id, actor: root, effectiveTo: "2035-06-01" })).effectiveTo, "2035-06-01");
    await fails("not_found", () => rules.end({ ruleId: "00000000-0000-4000-8000-000000000000", actor: root, effectiveTo: "2036-01-01" }));
    // now the same scope can start again after it
    eq((await rules.create({ ...base, lecturerId: lec2, scope: { subjectId: mat }, effectiveFrom: "2035-06-01" })).rule.effectiveTo, null);

    const mine = await rules.list({ actor: root, lecturerId: lec });
    eq(mine.every((x) => x.lecturerId === lec), true);
    const on = await rules.list({ actor: root, lecturerId: lec2, activeOn: "2026-06-01" });
    eq(on.map((x) => x.effectiveFrom), ["2026-01-01"]);
    await fails("invalid_input", () => rules.list({ actor: root, activeOn: "tomorrow" }));
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at, id`, [r.id])).map((a) => a.action).filter((a) => a === "commission_rule.end").length, 2);
  });

  test("a rule no earning used can be removed; a used one cannot", async () => {
    const spare = (await rules.create({ ...base, lecturerId: lec3, scope: { subjectId: sci }, effectiveFrom: "2050-01-01" })).rule;
    await rules.remove({ ruleId: spare.id, actor: root });
    await fails("not_found", () => rules.remove({ ruleId: spare.id, actor: root }));
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1`, [spare.id])).map((a) => a.action).sort(), ["commission_rule.create", "commission_rule.remove"]);

    // an earning that used a rule: pay for a fee line, then record an entry against the rule
    const used = (await rules.create({ ...base, lecturerId: lec3, scope: { subjectId: mat }, effectiveFrom: "2027-01-01" })).rule;
    const staff = await newUser();
    const st = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('CR1','Payer','2010-01-01')`);
    const enr = await id(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1,$2,$3)`, [c1, st, fee]);
    const inv = await id(`INSERT INTO invoice (student_id, branch_id, issued_on, due_date, subtotal, total) VALUES ($1,$2,'2027-01-01','2027-02-01',100,100)`, [st, b1]);
    await q(`INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id) VALUES ($1,'package_fee',100,$2,$3)`, [inv, enr, fee]);
    const pay = createPaymentService(db, { signer: hmacSigner("s") });
    const ev = await pay.recordCashPayment({ studentId: st, branchId: b1, amount: "100.00", recordedBy: staff, invoiceIds: [inv] });
    const alloc = String((await q(`SELECT id FROM payment_allocation WHERE payment_id = $1`, [ev.payment.id]))[0]!.id);
    await q(`INSERT INTO commission_entry (payment_allocation_id, rule_id, lecturer_id, entry_type, calc_type_applied, rate_applied, share_percent_applied, basis_applied, base_amount, commission_amount, teacher_amount) VALUES ($1,$2,$3,'accrual','percent',20,100,'paid',100,20,80)`, [alloc, used.id, lec3]);
    await fails("rule_in_use", () => rules.remove({ ruleId: used.id, actor: root }));
    eq((await rules.end({ ruleId: used.id, actor: root, effectiveTo: "2027-06-01" })).effectiveTo, "2027-06-01"); // ending is fine
  });
});
