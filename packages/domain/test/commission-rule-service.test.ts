/** Commission rule management: scopes, overlap, ending, removal, warnings, authorization. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createCommissionRuleService, createPaymentService, hmacSigner } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET enabled_modules = COALESCE(enabled_modules, '{}'::jsonb) || '{"commissions": true}'::jsonb`);
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
// Lecturers owned by single tests, so those tests build their own rules and neither depend on, nor disturb, the rest of the file.
const lecOv1 = await id(`INSERT INTO lecturer (full_name) VALUES ('Overlap Teacher One')`);
const lecOv2 = await id(`INSERT INTO lecturer (full_name) VALUES ('Overlap Teacher Two')`);
const lecLs = await id(`INSERT INTO lecturer (full_name) VALUES ('Listing Teacher')`);
const lecUs = await id(`INSERT INTO lecturer (full_name) VALUES ('Removal Teacher')`);
const lecFs = await id(`INSERT INTO lecturer (full_name) VALUES ('Scopes Teacher')`);
const lecDt = await id(`INSERT INTO lecturer (full_name) VALUES ('Dates Teacher')`);
const sci = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const mat = await id(`INSERT INTO subject (name) VALUES ('Maths')`);
const g6 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal LIMIT 1`))[0]!.id);
const c1 = await id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1,$2,'G6 Science','class','scheduled')`, [sci, b1]);
await q(`INSERT INTO course_lecturer (course_id, lecturer_id) VALUES ($1,$2), ($1,$3), ($1,$4)`, [c1, lec, lec3, lecUs]);
const fee = await id(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1,$2,'Monthly','recurring','monthly')`, [b1, c1]);
await q(`INSERT INTO fee_rate (fee_structure_id, amount, effective_from) VALUES ($1, 1000, '2027-01-01')`, [fee]);
const base = { actor: root, lecturerId: lec, calcType: "percent" as const, rate: "20", effectiveFrom: "2027-01-01" };

describe("creating rules", () => {
  test("the four scopes; the rate is stored with two decimals", async () => {
    const four = { ...base, lecturerId: lecFs }; // a lecturer of its own: nothing else in the file writes rules for it
    const d = await rules.create({ ...four });
    eq([d.rule.commissionRate, d.rule.courseId, d.rule.subjectId, d.warnings], ["20.00", null, null, []]);
    const made = [d.rule.id];
    const next = await rules.create({ ...four, scope: { subjectId: sci } });
    eq(next.rule.subjectId, sci);
    made.push(next.rule.id);
    const graded = await rules.create({ ...four, scope: { subjectId: sci, gradeLevelId: g6 } });
    eq(graded.rule.gradeLevelId, g6);
    made.push(graded.rule.id);
    const byCourse = await rules.create({ ...four, scope: { courseId: c1 }, rate: "12.5" });
    eq(byCourse.rule.commissionRate, "12.50");
    made.push(byCourse.rule.id);
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE action = 'commission_rule.create' AND entity_id = ANY($1::uuid[])`, [made]))[0]!.c, 4);
  });

  test("overlapping dates in the same scope are refused; other scopes, lecturers and later dates are fine", async () => {
    const ov = { ...base, lecturerId: lecOv1 };
    await rules.create({ ...ov }); // the open rule the refusals below run into
    await fails("rule_overlap", () => rules.create({ ...ov }));
    await fails("rule_overlap", () => rules.create({ ...ov, effectiveFrom: "2030-01-01" })); // the open rule runs forever
    eq((await rules.create({ ...ov, scope: { subjectId: mat } })).rule.subjectId, mat);
    eq((await rules.create({ ...ov, lecturerId: lecOv2 })).rule.lecturerId, lecOv2);
    const closed = await rules.create({ ...ov, lecturerId: lecOv2, scope: { subjectId: sci }, effectiveFrom: "2026-01-01", effectiveTo: "2027-01-01" });
    eq(closed.rule.effectiveTo, "2027-01-01");
    eq((await rules.create({ ...ov, lecturerId: lecOv2, scope: { subjectId: sci }, effectiveFrom: "2027-01-01" })).rule.effectiveFrom, "2027-01-01"); // starts the day the other ended
    await fails("rule_overlap", () => rules.create({ ...ov, lecturerId: lecOv2, scope: { subjectId: sci }, effectiveFrom: "2026-06-01", effectiveTo: "2027-02-01" }));
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
    const ls = { ...base, lecturerId: lecLs };
    await rules.create({ ...ls, scope: { subjectId: sci }, effectiveFrom: "2026-01-01", effectiveTo: "2027-01-01" }); // the closed rule the listing below filters by day
    const r = (await rules.create({ ...ls, scope: { subjectId: mat }, effectiveFrom: "2035-01-01" })).rule;
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "2035-01-01" }));
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "x" }));
    eq((await rules.end({ ruleId: r.id, actor: root, effectiveTo: "2036-01-01" })).effectiveTo, "2036-01-01");
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "2037-01-01" }));
    eq((await rules.end({ ruleId: r.id, actor: root, effectiveTo: "2035-06-01" })).effectiveTo, "2035-06-01");
    await fails("not_found", () => rules.end({ ruleId: "00000000-0000-4000-8000-000000000000", actor: root, effectiveTo: "2036-01-01" }));
    // now the same scope can start again after it
    eq((await rules.create({ ...ls, scope: { subjectId: mat }, effectiveFrom: "2035-06-01" })).rule.effectiveTo, null);

    const mine = await rules.list({ actor: root, lecturerId: lecLs });
    eq([mine.length, mine.every((x) => x.lecturerId === lecLs)], [3, true], "the lecturer's three rules, nobody else's");
    const on = await rules.list({ actor: root, lecturerId: lecLs, activeOn: "2026-06-01" });
    eq(on.map((x) => x.effectiveFrom), ["2026-01-01"]);
    await fails("invalid_input", () => rules.list({ actor: root, activeOn: "tomorrow" }));
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY created_at, id`, [r.id])).map((a) => a.action).filter((a) => a === "commission_rule.end").length, 2);
  });

  test("a rule no earning used can be removed; a used one cannot", async () => {
    const spare = (await rules.create({ ...base, lecturerId: lecUs, scope: { subjectId: sci }, effectiveFrom: "2050-01-01" })).rule;
    await rules.remove({ ruleId: spare.id, actor: root });
    await fails("not_found", () => rules.remove({ ruleId: spare.id, actor: root }));
    eq((await q(`SELECT action FROM audit_log WHERE entity_id = $1`, [spare.id])).map((a) => a.action).sort(), ["commission_rule.create", "commission_rule.remove"]);

    // an earning that used a rule: pay for a fee line, then record an entry against the rule
    const used = (await rules.create({ ...base, lecturerId: lecUs, scope: { subjectId: mat }, effectiveFrom: "2027-01-01" })).rule;
    const staff = await newUser();
    const st = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ('CR1','Payer','2010-01-01')`);
    const enr = await id(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1,$2,$3)`, [c1, st, fee]);
    const inv = await id(`INSERT INTO invoice (student_id, branch_id, issued_on, due_date, subtotal, total) VALUES ($1,$2,'2027-01-01','2027-02-01',100,100)`, [st, b1]);
    await q(`INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id) VALUES ($1,'package_fee',100,$2,$3)`, [inv, enr, fee]);
    const pay = createPaymentService(db, { signer: hmacSigner("s") });
    const ev = await pay.recordCashPayment({ studentId: st, branchId: b1, amount: "100.00", recordedBy: staff, invoiceIds: [inv] });
    const alloc = String((await q(`SELECT id FROM payment_allocation WHERE payment_id = $1`, [ev.payment.id]))[0]!.id);
    await q(`INSERT INTO commission_entry (payment_allocation_id, rule_id, lecturer_id, entry_type, calc_type_applied, rate_applied, share_percent_applied, basis_applied, base_amount, commission_amount, teacher_amount) VALUES ($1,$2,$3,'accrual','percent',20,100,'paid',100,20,80)`, [alloc, used.id, lecUs]);
    await fails("rule_in_use", () => rules.remove({ ruleId: used.id, actor: root }));
    eq((await rules.end({ ruleId: used.id, actor: root, effectiveTo: "2027-06-01" })).effectiveTo, "2027-06-01"); // ending is fine
  });
});

// ---- review hardening

/** The same db, but `hook` runs just before the first transaction starts: a rival write landing between a check and a write. */
function withBefore(hook: () => Promise<void>): typeof db {
  let fired = false;
  return new Proxy(db, {
    get(t, prop) {
      const v = Reflect.get(t, prop, t);
      if (prop === "transaction") {
        return async (...args: unknown[]) => {
          if (!fired) {
            fired = true;
            await hook();
          }
          return (v as (...a: unknown[]) => unknown).apply(t, args);
        };
      }
      return typeof v === "function" ? v.bind(t) : v;
    },
  }) as typeof db;
}
const racing = (hook: () => Promise<void>) => createCommissionRuleService(withBefore(hook), { now: () => new Date("2027-03-10T10:00:00Z") });
const lecA = await id(`INSERT INTO lecturer (full_name) VALUES ('Hardening A')`);
const lecB = await id(`INSERT INTO lecturer (full_name) VALUES ('Hardening B')`);
const DEAD = "00000000-0000-4000-8000-000000000000";

describe("rule input limits", () => {
  test("dates must be real calendar days on create, end and list", async () => {
    for (const bad of ["2027-02-31", "2027-13-01", "2027-00-10"]) {
      await fails("invalid_input", () => rules.create({ ...base, lecturerId: lecDt, scope: { subjectId: mat }, effectiveFrom: bad }));
      await fails("invalid_input", () => rules.create({ ...base, lecturerId: lecDt, scope: { subjectId: mat }, effectiveFrom: "2061-01-01", effectiveTo: bad }));
      await fails("invalid_input", () => rules.end({ ruleId: DEAD, actor: root, effectiveTo: bad }));
      await fails("invalid_input", () => rules.list({ actor: root, activeOn: bad }));
    }
    const r = (await rules.create({ ...base, lecturerId: lecDt, scope: { subjectId: mat }, effectiveFrom: "2062-01-01" })).rule;
    await fails("invalid_input", () => rules.end({ ruleId: r.id, actor: root, effectiveTo: "2062-02-30" }));
    eq((await rules.end({ ruleId: r.id, actor: root, effectiveTo: "2064-02-29" })).effectiveTo, "2064-02-29", "a real leap day passes");
  });

  test("a fixed rate that cannot be stored is invalid_input; zero and fractions still work", async () => {
    const fixed = { ...base, lecturerId: lecA, calcType: "fixed_per_student_month" as const, scope: { subjectId: mat }, effectiveFrom: "2065-01-01" };
    await fails("invalid_input", () => rules.create({ ...fixed, rate: "9".repeat(310) }));
    await fails("invalid_input", () => rules.create({ ...fixed, rate: "10000000000.00" }));
    eq((await rules.create({ ...fixed, rate: "9999999999.99", effectiveTo: "2065-02-01" })).rule.commissionRate, "9999999999.99", "the largest storable rate");
    eq((await rules.create({ ...fixed, rate: "0", effectiveFrom: "2066-01-01", effectiveTo: "2066-02-01" })).rule.commissionRate, "0.00");
    eq((await rules.create({ ...fixed, rate: "12.5", effectiveFrom: "2067-01-01", effectiveTo: "2067-02-01" })).rule.commissionRate, "12.50");
  });
});

describe("fixed-rate warning", () => {
  test("names the commission base, and a grade rule ignores other grades' fees", async () => {
    const w = (await rules.create({ ...base, lecturerId: lec3, calcType: "fixed_per_student_month", rate: "1500", scope: { courseId: c1 }, effectiveFrom: "2068-01-01", effectiveTo: "2068-02-01" })).warnings;
    eq(w.length, 1);
    eq(w[0]!.includes("commission base"), true, "states the cap as the base");
    eq(w[0]!.includes("capped at what is collected"), false);

    const g7 = String((await q(`SELECT id FROM grade_level ORDER BY ordinal OFFSET 1 LIMIT 1`))[0]!.id);
    const fs2 = await id(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type, frequency) VALUES ($1,$2,'Grade rates','recurring','monthly')`, [b1, c1]);
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1,$2,500,'2027-01-01'), ($1,$3,1000,'2027-01-01')`, [fs2, g7, g6]);
    await q(`UPDATE fee_structure SET is_active = false WHERE id = $1`, [fee]); // only the grade rates remain: Grade 7 costs 500, Grade 6 costs 1000
    try {
      const grade6 = { ...base, lecturerId: lec3, calcType: "fixed_per_student_month" as const, rate: "750", scope: { subjectId: sci, gradeLevelId: g6 }, effectiveFrom: "2069-01-01", effectiveTo: "2069-02-01" };
      eq((await rules.create(grade6)).warnings, [], "Grade 7's lower fee is not this rule's business");
      eq((await rules.create({ ...grade6, scope: { subjectId: sci }, effectiveFrom: "2070-01-01", effectiveTo: "2070-02-01" })).warnings.length, 1, "without a grade the broader search stays");
      eq((await rules.create({ ...grade6, rate: "1200", effectiveFrom: "2071-01-01", effectiveTo: "2071-02-01" })).warnings.length, 1, "still warns when this grade's own fee is lower");
    } finally {
      await q(`UPDATE fee_structure SET is_active = true WHERE id = $1`, [fee]);
      await q(`UPDATE fee_structure SET is_active = false WHERE id = $1`, [fs2]);
    }
  });
});

describe("rule changes under contention", () => {
  test("a second end validates against the first one's end date", async () => {
    const r = (await rules.create({ ...base, lecturerId: lecA, scope: { subjectId: mat }, effectiveFrom: "2072-01-01" })).rule;
    const rival = racing(async () => void (await rules.end({ ruleId: r.id, actor: root, effectiveTo: "2072-06-01" })));
    await fails("invalid_input", () => rival.end({ ruleId: r.id, actor: root, effectiveTo: "2072-07-01" }));
    eq((await q(`SELECT effective_to::text AS d FROM commission_rule WHERE id = $1`, [r.id]))[0]!.d, "2072-06-01");
    eq((await q(`SELECT before_data->>'effectiveTo' AS b FROM audit_log WHERE entity_id = $1 AND action = 'commission_rule.end'`, [r.id])).map((x) => x.b), [null], "one end audited, with the right prior value");
  });

  const trigger = async (name: string, body: string, run: () => Promise<void>) => {
    await q(`CREATE FUNCTION ${name}() RETURNS trigger AS $$ BEGIN ${body} END $$ LANGUAGE plpgsql`);
    await q(`CREATE TRIGGER ${name} BEFORE DELETE ON commission_rule FOR EACH ROW EXECUTE FUNCTION ${name}()`);
    try {
      await run();
    } finally {
      await q(`DROP TRIGGER ${name} ON commission_rule`);
      await q(`DROP FUNCTION ${name}()`);
    }
  };

  test("an accrual that commits before the delete gives rule_in_use; other database errors pass through", async () => {
    const r = (await rules.create({ ...base, lecturerId: lecB, scope: { subjectId: mat }, effectiveFrom: "2073-01-01" })).rule;
    await trigger("fk_by_entry", `RAISE EXCEPTION 'fk' USING ERRCODE = '23503', CONSTRAINT = 'commission_entry_rule_lecturer_fk'; RETURN OLD;`, () => fails("rule_in_use", () => rules.remove({ ruleId: r.id, actor: root })));
    await trigger("fk_other", `RAISE EXCEPTION 'fk' USING ERRCODE = '23503', CONSTRAINT = 'some_other_fk'; RETURN OLD;`, async () => {
      let err: unknown;
      await rules.remove({ ruleId: r.id, actor: root }).catch((e) => (err = e));
      eq(err instanceof Error && err.name !== "ServiceError", true, "unrelated violation unchanged");
    });
    eq((await q(`SELECT count(*)::int AS c FROM commission_rule WHERE id = $1`, [r.id]))[0]!.c, 1, "still there");
  });

  test("a delete that finds no row is not_found and writes no audit entry", async () => {
    const r = (await rules.create({ ...base, lecturerId: lecA, scope: { subjectId: sci }, effectiveFrom: "2074-01-01" })).rule;
    await trigger("skip_delete", `RETURN NULL;`, () => fails("not_found", () => rules.remove({ ruleId: r.id, actor: root })));
    eq((await q(`SELECT count(*)::int AS c FROM audit_log WHERE entity_id = $1 AND action = 'commission_rule.remove'`, [r.id]))[0]!.c, 0, "no removal audited");
  });
});

describe("module gate", () => {
  test("every rule method answers module_disabled while commissions is off, and works again when it is on", async () => {
    const lecG = await id(`INSERT INTO lecturer (full_name) VALUES ('Gate Teacher')`);
    const made = await rules.create({ actor: root, lecturerId: lecG, calcType: "percent", rate: "10", effectiveFrom: "2030-01-01" });
    const before = Number((await q(`SELECT count(*)::int AS c FROM commission_rule`))[0]!.c);
    await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"commissions": false}'::jsonb`);
    try {
      await fails("module_disabled", () => rules.create({ actor: root, lecturerId: lecG, calcType: "percent", rate: "10", effectiveFrom: "2031-01-01" }));
      await fails("module_disabled", () => rules.list({ actor: root }));
      await fails("module_disabled", () => rules.end({ actor: root, ruleId: made.rule.id, effectiveTo: "2030-06-01" }));
      await fails("module_disabled", () => rules.remove({ actor: root, ruleId: made.rule.id }));
      eq(Number((await q(`SELECT count(*)::int AS c FROM commission_rule`))[0]!.c), before, "nothing written while off");
    } finally {
      await q(`UPDATE organization SET enabled_modules = enabled_modules || '{"commissions": true}'::jsonb`);
    }
    eq((await rules.list({ actor: root, lecturerId: lecG })).length, 1);
    await rules.remove({ actor: root, ruleId: made.rule.id });
  });
});
