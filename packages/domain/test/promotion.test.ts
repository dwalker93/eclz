/**
 * Yearly promotion: draft, confirm, stay, blocked moves, billing from the effective date (B and C rules).
 */
import { afterAll, describe, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import {
  createEnrollmentService,
  createInvoicingService,
  createPromotionService,
  ServiceError,
} from "../src";
import { eq } from "./helpers";
import { createScenarioDb } from "./setup";

const { pg, db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

const codeOf = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return "none";
  } catch (e) {
    return e instanceof ServiceError ? e.code : `error:${(e as Error).message}`;
  }
};

await q(`UPDATE organization SET timezone = 'UTC'`);

let clock = new Date("2027-03-10T10:00:00Z");

const now = () => clock;

const enrol = createEnrollmentService(db, { now });

const inv = createInvoicingService(db, { now });

const promo = createPromotionService(db, { now });

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);

const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);

const staff = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);

const grade = async (ord: number) => String((await q(`SELECT id FROM grade_level WHERE ordinal = $1`, [ord]))[0]!.id);

const [g6, g7, g8, g13] = [await grade(6), await grade(7), await grade(8), await grade(13)];

const science = await id(`INSERT INTO subject (name) VALUES ('Science')`);

const maths = await id(`INSERT INTO subject (name) VALUES ('Maths')`);

let n = 0;

async function classes(grades: string[], o: { subject?: string; branch?: string; capacity?: Record<string, number> } = {}) {
  const subject = o.subject ?? science;
  const branch = o.branch ?? b1;
  const group = await id(`INSERT INTO course_group (branch_id, subject_id, name) VALUES ($1,$2,$3)`, [branch, subject, `Group ${++n}`]);
  const out: Record<string, { course: string; fee: string }> = {};
  for (const g of grades) {
    const c = await id(`INSERT INTO course (subject_id, branch_id, name, kind, course_group_id, capacity) VALUES ($1,$2,$3,'class',$4,$5)`, [subject, branch, `Class ${++n}`, group, o.capacity?.[g] ?? null]);
    await q(`INSERT INTO course_grade_level (course_id, grade_level_id) VALUES ($1,$2)`, [c, g]);
    const fee = await id(`INSERT INTO fee_structure (branch_id, course_id, name, is_default, billing_type, frequency) VALUES ($1,$2,'Monthly',true,'recurring','monthly')`, [branch, c]);
    const ord = Number((await q(`SELECT ordinal FROM grade_level WHERE id = $1`, [g]))[0]!.ordinal);
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1,$2,$3,'2020-01-01')`, [fee, g, 1000 + ord]);
    out[g] = { course: c, fee };
  }
  return out;
}

let fresh: string[] = [];

async function draft(o: { effectiveDate?: string } = {}) {
  const d = await promo.createDraft({ performedBy: staff, ...o });
  await q(`UPDATE promotion_item SET decision = 'skip', to_course_id = NULL WHERE promotion_run_id = $1 AND student_id <> ALL($2::uuid[])`, [d.runId, fresh]);
  fresh = [];
  return d;
}

async function pupil(level: string | null) {
  const s = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`P${++n}`, `Pupil ${n}`]);
  if (level) await q(`INSERT INTO student_level (student_id, grade_level_id, from_date) VALUES ($1,$2,'2027-01-01')`, [s, level]);
  fresh.push(s);
  return s;
}

const levels = (s: string) => q(`SELECT grade_level_id, from_date, to_date, reason FROM student_level WHERE student_id = $1 ORDER BY from_date`, [s]);

const items = (run: string) => q(`SELECT * FROM promotion_item WHERE promotion_run_id = $1`, [run]);

const itemOf = async (run: string, s: string) => (await q(`SELECT * FROM promotion_item WHERE promotion_run_id = $1 AND student_id = $2`, [run, s]))[0]!;

const sub = async (run: string, students: string[]) => (await items(run)).filter((i) => students.includes(String(i.student_id)));

describe("Yearly promotion", () => {
  test("C12: draft proposes the next grade's class, and flags highest grade, no match, and no enrolment", async () => {
    const cls = await classes([g6, g7]);
    const a = await pupil(g6);
    await enrol.enrollStudent({ studentId: a, courseId: cls[g6]!.course });
    const top = await pupil(g13);
    const bare = await pupil(g6);
    const lone = await classes([g8]);
    const b = await pupil(g8);
    await enrol.enrollStudent({ studentId: b, courseId: lone[g8]!.course });
    const ungraded = await pupil(null);
    const d = await promo.createDraft({ performedBy: staff });
    fresh = [];
    eq(d.effectiveDate, "2027-04-01");
    const ia = await itemOf(d.runId, a);
    eq([ia.decision, ia.to_course_id], ["move", cls[g7]!.course]);
    eq((await itemOf(d.runId, top)).decision, "skip");
    eq((await itemOf(d.runId, bare)).decision, "stay");
    eq((await itemOf(d.runId, b)).decision, "needs_review");
    eq((await q(`SELECT count(*)::int n FROM promotion_item WHERE student_id = $1`, [ungraded]))[0]!.n, 0);
    eq(await codeOf(async () => promo.confirm({ runId: d.runId, confirmedBy: staff })), "promotion_unresolved");
    const view = await promo.getRun({ runId: d.runId });
    const nameOfA = String((await q(`SELECT full_name FROM student WHERE id = $1`, [a]))[0]!.full_name);
    const itemA = view.items.find((i) => i.studentId === a);
    eq([view.run.status, itemA?.decision, itemA?.studentName], ["draft", "move", nameOfA], "the item carries the student's own name");
    for (const decision of ["move", "stay", "skip", "needs_review"] as const) {
      eq(view.byDecision[decision], view.items.filter((i) => i.decision === decision).length, `the ${decision} count is exactly the ${decision} items`);
    }
    eq(Object.values(view.byDecision).reduce((x, y) => x + y, 0), view.items.length, "every item is counted once");
    eq(await codeOf(async () => promo.getRun({ runId: "00000000-0000-0000-0000-000000000000" })), "not_found");
    await promo.discardDraft({ runId: d.runId, discardedBy: staff });
    eq(await codeOf(async () => promo.confirm({ runId: d.runId, confirmedBy: staff })), "promotion_not_draft");
    eq((await levels(a)).length, 1);
  });
  test("C13/B5/B7: confirm moves the student, advances the grade and keeps history", async () => {
    const cls = await classes([g6, g7], { branch: b2 });
    const s = await pupil(g6);
    const old = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    const r = await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq(r.status, "confirmed");
    const lv = await levels(s);
    eq(lv.map((x) => [x.grade_level_id, x.from_date, x.to_date, x.reason]), [[g6, "2027-01-01", "2027-04-01", "admission"], [g7, "2027-04-01", null, "promotion"]]);
    const o = (await q(`SELECT status, end_reason, access_ends_on FROM enrollment WHERE id = $1`, [old.id]))[0]!;
    eq([o.status, o.end_reason, o.access_ends_on], ["completed", "promoted", "2027-04-01"]);
    const nw = (await q(`SELECT * FROM enrollment WHERE student_id = $1 AND status = 'active'`, [s]))[0]!;
    eq([nw.course_id, nw.promoted_from_enrollment_id, nw.access_starts_on, nw.enrolled_on, nw.fee_structure_id], [cls[g7]!.course, old.id, "2027-04-01", "2027-04-01", cls[g7]!.fee]);
    eq((await itemOf(d.runId, s)).to_enrollment_id, nw.id);
    eq((await q(`SELECT status FROM promotion_run WHERE id = $1`, [d.runId]))[0]!.status, "confirmed");
    eq((await q(`SELECT count(*)::int n FROM audit_log WHERE action = 'promotion.confirm' AND entity_id = $1`, [d.runId]))[0]!.n, 1);
    eq((await q(`SELECT count(*)::int n FROM student_branch WHERE student_id = $1 AND branch_id = $2`, [s, b2]))[0]!.n, 1);
    eq(await codeOf(async () => promo.confirm({ runId: d.runId, confirmedBy: staff })), "promotion_not_draft");
  });
  test("C14: the new class bills from the effective date, the old one stops, no month twice", async () => {
    const cls = await classes([g6, g7]);
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    await inv.generateRecurringInvoices({}); // March billed on the old enrolment
    const d = await draft();
    await promo.confirm({ runId: d.runId, confirmedBy: staff });
    clock = new Date("2027-04-02T10:00:00Z");
    await inv.generateRecurringInvoices({});
    const rows = await q(
      `SELECT c.id AS course_id, ii.period_start, ii.amount FROM invoice_item ii JOIN enrollment e ON e.id = ii.enrollment_id JOIN course c ON c.id = e.course_id WHERE e.student_id = $1 AND ii.kind = 'recurring_fee' ORDER BY ii.period_start`,
      [s],
    );
    eq(rows.map((r) => [r.course_id, r.period_start, r.amount]), [[cls[g6]!.course, "2027-03-01", "1006.00"], [cls[g7]!.course, "2027-04-01", "1007.00"]]);
    clock = new Date("2027-03-10T10:00:00Z");
  });
  test("B8: stay advances the grade and pins the billing grade to the old one", async () => {
    const cls = await classes([g6]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    const it = await itemOf(d.runId, s);
    eq(it.decision, "needs_review");
    await promo.updateItem({ runId: d.runId, itemId: String(it.id), decision: "stay" });
    await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq((await levels(s)).map((x) => x.grade_level_id), [g6, g7]);
    const row = (await q(`SELECT billing_grade_level_id, status FROM enrollment WHERE id = $1`, [e.id]))[0]!;
    eq([row.billing_grade_level_id, row.status], [g6, "active"]);
    clock = new Date("2027-04-02T10:00:00Z");
    await inv.generateRecurringInvoices({ enrollmentIds: [e.id] });
    eq((await q(`SELECT amount FROM invoice_item WHERE enrollment_id = $1 ORDER BY period_start DESC LIMIT 1`, [e.id]))[0]!.amount, "1006.00");
    clock = new Date("2027-03-10T10:00:00Z");
  });
  test("B8: clearing a pin needs a reason and a rate for the current grade", async () => {
    const cls = await classes([g6]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    await promo.updateItem({ runId: d.runId, itemId: String((await itemOf(d.runId, s)).id), decision: "stay" });
    await promo.confirm({ runId: d.runId, confirmedBy: staff });
    clock = new Date("2027-04-02T10:00:00Z");
    eq(await codeOf(async () => promo.clearBillingGrade({ enrollmentId: e.id, clearedBy: staff, reason: " " })), "reason_required");
    eq(await codeOf(async () => promo.clearBillingGrade({ enrollmentId: e.id, clearedBy: staff, reason: "Rates updated" })), "rate_missing");
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1,$2,1500,'2027-04-01')`, [cls[g6]!.fee, g7]);
    const cleared = await promo.clearBillingGrade({ enrollmentId: e.id, clearedBy: staff, reason: "Rates updated" });
    eq(cleared.billingGradeLevelId, null);
    eq(await codeOf(async () => promo.clearBillingGrade({ enrollmentId: e.id, clearedBy: staff, reason: "again" })), "invalid_input");
    eq((await q(`SELECT count(*)::int n FROM audit_log WHERE action = 'enrollment.clear_billing_grade'`))[0]!.n, 1);
    clock = new Date("2027-03-10T10:00:00Z");
  });
  test("B6/B8: a student whose items are all skip does not advance", async () => {
    const cls = await classes([g6, g7]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    await promo.updateItem({ runId: d.runId, itemId: String((await itemOf(d.runId, s)).id), decision: "skip" });
    await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq((await levels(s)).length, 1);
    eq((await q(`SELECT status FROM enrollment WHERE id = $1`, [e.id]))[0]!.status, "active");
  });
  test("C15: a full target blocks the move, changes nothing, and flags the item", async () => {
    const cls = await classes([g6, g7], { capacity: { [g7]: 1 } });
    const sitting = await pupil(g7);
    await enrol.enrollStudent({ studentId: sitting, courseId: cls[g7]!.course });
    const s = await pupil(g6);
    const old = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    // the g7 student has no g8 class, so that item needs review: send it to stay so the run can confirm
    await promo.updateItem({ runId: d.runId, itemId: String((await itemOf(d.runId, sitting)).id), decision: "skip" });
    const r = await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq(r.status, "blocked");
    eq(r.status === "blocked" ? r.flagged.map((f) => [f.studentId, f.reason]) : null, [[s, "capacity_full"]]);
    eq((await levels(s)).length, 1);
    eq((await q(`SELECT status FROM enrollment WHERE id = $1`, [old.id]))[0]!.status, "active");
    eq((await q(`SELECT status FROM promotion_run WHERE id = $1`, [d.runId]))[0]!.status, "draft");
    const it = await itemOf(d.runId, s);
    eq(it.decision, "needs_review");
    // raise capacity, put the item back to move, and it goes through
    await q(`UPDATE course SET capacity = 2 WHERE id = $1`, [cls[g7]!.course]);
    await promo.updateItem({ runId: d.runId, itemId: String(it.id), decision: "move", toCourseId: cls[g7]!.course });
    eq((await promo.confirm({ runId: d.runId, confirmedBy: staff })).status, "confirmed");
  });
  test("C15: seats freed by students moving up in the same run count", async () => {
    const cls = await classes([g6, g7, g8], { capacity: { [g7]: 1 } });
    const up = await pupil(g7);
    await enrol.enrollStudent({ studentId: up, courseId: cls[g7]!.course });
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    const d = await draft();
    const r = await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq(r.status, "confirmed");
    eq((await q(`SELECT count(*)::int n FROM enrollment WHERE course_id = $1 AND status = 'active'`, [cls[g7]!.course]))[0]!.n, 1);
    eq((await q(`SELECT count(*)::int n FROM enrollment WHERE course_id = $1 AND status = 'active'`, [cls[g8]!.course]))[0]!.n, 1);
  });
  test("a target class with no fee option is flagged, not half-applied", async () => {
    const cls = await classes([g6, g7]);
    await q(`UPDATE fee_structure SET is_default = false, is_active = false WHERE id = $1`, [cls[g7]!.fee]);
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    const d = await draft();
    const r = await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq(r.status, "blocked");
    eq((await levels(s)).length, 1);
  });
  test("C14: an effective date inside an already invoiced period is refused", async () => {
    const cls = await classes([g6, g7]);
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    await inv.generateRecurringInvoices({}); // bills March (period to 2027-04-01)
    const d = await draft({ effectiveDate: "2027-03-15" });
    eq(await codeOf(async () => promo.confirm({ runId: d.runId, confirmedBy: staff })), "promotion_date_invalid");
    await promo.setEffectiveDate({ runId: d.runId, effectiveDate: "2027-04-01" });
    eq((await promo.confirm({ runId: d.runId, confirmedBy: staff })).status, "confirmed");
  });
  test("item edits are checked and only allowed on a draft", async () => {
    const cls = await classes([g6, g7]);
    const other = await classes([g7], { subject: maths });
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    const bare = await pupil(g6);
    const d = await draft();
    const it = String((await itemOf(d.runId, s)).id);
    eq(await codeOf(async () => promo.updateItem({ runId: d.runId, itemId: it, decision: "move", toCourseId: other[g7]!.course })), "invalid_input");
    eq(await codeOf(async () => promo.updateItem({ runId: d.runId, itemId: it, decision: "move" })), "invalid_input");
    eq(await codeOf(async () => promo.updateItem({ runId: d.runId, itemId: it, decision: "move", toCourseId: cls[g6]!.course })), "invalid_input");
    eq(await codeOf(async () => promo.updateItem({ runId: d.runId, itemId: String((await itemOf(d.runId, bare)).id), decision: "move", toCourseId: cls[g7]!.course })), "invalid_input");
    await promo.discardDraft({ runId: d.runId, discardedBy: staff });
    eq(await codeOf(async () => promo.updateItem({ runId: d.runId, itemId: it, decision: "skip" })), "promotion_not_draft");
    eq(await codeOf(async () => promo.setEffectiveDate({ runId: d.runId, effectiveDate: "2027-05-01" })), "promotion_not_draft");
  });
  test("C6: a target class must serve the grade the student is promoted to", async () => {
    const cls = await classes([g6, g7]);
    const far = await classes([g8]);
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    const d = await draft();
    const it = String((await itemOf(d.runId, s)).id);
    eq(await codeOf(async () => promo.updateItem({ runId: d.runId, itemId: it, decision: "move", toCourseId: far[g8]!.course })), "invalid_input");
    // a class with no grade list serves any grade
    const open = await classes([g7]);
    await q(`DELETE FROM course_grade_level WHERE course_id = $1`, [open[g7]!.course]);
    eq((await promo.updateItem({ runId: d.runId, itemId: it, decision: "move", toCourseId: open[g7]!.course })).decision, "move");
    // an item forced onto a class that does not serve the grade is flagged at confirmation and nothing changes
    await q(`UPDATE promotion_item SET to_course_id = $2 WHERE id = $1`, [it, far[g8]!.course]);
    const r = await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq(r.status, "blocked");
    eq(r.status === "blocked" ? r.flagged.map((f) => f.reason) : [], ["grade_not_allowed"]);
    eq((await levels(s)).length, 1);
  });
  test("confirm locks the students (sorted) before the source enrolments, the order reconcileStudent uses", async () => {
    const cls = await classes([g6, g7], { branch: b2 });
    const s1 = await pupil(g6);
    const s2 = await pupil(g6);
    await enrol.enrollStudent({ studentId: s1, courseId: cls[g6]!.course });
    await enrol.enrollStudent({ studentId: s2, courseId: cls[g6]!.course });
    const d = await draft();
    const log: { text: string; params: unknown[] }[] = [];
    const logged = createPromotionService(drizzle(pg, { schema, logger: { logQuery: (text: string, params: unknown[]) => void log.push({ text, params }) } }) as unknown as typeof db, { now });
    await logged.confirm({ runId: d.runId, confirmedBy: staff });
    const studentLocks = log.map((l, i) => ({ ...l, i })).filter((l) => /from "student" where/.test(l.text) && /for no key update/.test(l.text));
    const enrolmentLock = log.findIndex((l) => /from "enrollment" where/.test(l.text) && /for update/.test(l.text));
    eq(enrolmentLock >= 0, true, "the source enrolments were locked");
    const before = studentLocks.filter((l) => l.i < enrolmentLock).map((l) => String(l.params[0]));
    eq(before, [s1, s2].sort(), "both students locked, in id order, before the enrolments");
  });
  test("C14: an old enrolment ended by promotion is still billed for its unbilled months before the effective date", async () => {
    const cls = await classes([g6, g7]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft(); // effective 2027-04-01, confirmed on March 10 before March was invoiced
    await promo.confirm({ runId: d.runId, confirmedBy: staff });
    await inv.generateRecurringInvoices({});
    clock = new Date("2027-04-02T10:00:00Z");
    await inv.generateRecurringInvoices({});
    const rows = await q(
      `SELECT e.course_id, ii.period_start FROM invoice_item ii JOIN enrollment e ON e.id = ii.enrollment_id WHERE e.student_id = $1 AND ii.kind = 'recurring_fee' ORDER BY ii.period_start`,
      [s],
    );
    eq(rows.map((r) => [r.course_id, r.period_start]), [[cls[g6]!.course, "2027-03-01"], [cls[g7]!.course, "2027-04-01"]]);
    eq((await q(`SELECT status FROM enrollment WHERE id = $1`, [e.id]))[0]!.status, "completed");
    clock = new Date("2027-03-10T10:00:00Z");
  });
  test("C14: a prepared invoice is re-checked against the enrolment before it is inserted", async () => {
    const cls = await classes([g6]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    await q(`UPDATE enrollment SET access_starts_on = '2027-01-01', enrolled_on = '2027-01-01' WHERE id = $1`, [e.id]);
    let calls = 0;
    const racing = new Proxy(db, {
      get(t, k, r) {
        if (k !== "transaction") return Reflect.get(t, k, r);
        return async (...a: unknown[]) => {
          // the planning transaction has run; a promotion now ends the enrolment on March 1
          if (++calls === 2) await q(`UPDATE enrollment SET status = 'completed', end_reason = 'promoted', access_ends_on = '2027-03-01' WHERE id = $1`, [e.id]);
          return (t.transaction as (...x: unknown[]) => unknown).apply(t, a);
        };
      },
    });
    const rep = await createInvoicingService(racing, { now }).generateRecurringInvoices({ enrollmentIds: [e.id] });
    eq(rep.invoicesCreated.map((x) => x.periodStarts), [["2027-01-01", "2027-02-01"]]);
    eq((await q(`SELECT period_start FROM invoice_item WHERE enrollment_id = $1 ORDER BY period_start`, [e.id])).map((r) => r.period_start), ["2027-01-01", "2027-02-01"]);
  });
  test("a one-time package target is flagged, not turned into an enrolment without its invoice", async () => {
    const cls = await classes([g6, g7]);
    await q(`UPDATE fee_structure SET billing_type = 'one_time_package', frequency = NULL, access_duration_months = 6 WHERE id = $1`, [cls[g7]!.fee]);
    const s = await pupil(g6);
    await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
    const d = await draft();
    const r = await promo.confirm({ runId: d.runId, confirmedBy: staff });
    eq(r.status, "blocked");
    eq(r.status === "blocked" ? r.flagged.map((f) => f.reason) : [], ["fee_structure_invalid"]);
    eq((await levels(s)).length, 1);
  });
  test("a flag is written only if the run is still a draft and the item is still the move that failed", async () => {
    const blockedRun = async (before: () => Promise<void>, runIdOf: { id?: string }) => {
      const cls = await classes([g6, g7]);
      await q(`UPDATE fee_structure SET is_default = false, is_active = false WHERE id = $1`, [cls[g7]!.fee]);
      const s = await pupil(g6);
      await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course });
      const d = await draft();
      runIdOf.id = d.runId;
      let calls = 0;
      const racing = new Proxy(db, {
        get(t, k, r) {
          if (k !== "transaction") return Reflect.get(t, k, r);
          return async (...a: unknown[]) => {
            if (++calls === 2) await before(); // between the failed attempt and the flag write
            return (t.transaction as (...x: unknown[]) => unknown).apply(t, a);
          };
        },
      });
      return { svc: createPromotionService(racing, { now }), runId: d.runId, student: s };
    };
    // a newer decision (stay) is kept
    const a: { id?: string } = {};
    const one = await blockedRun(async () => { await q(`UPDATE promotion_item SET decision = 'stay', to_course_id = NULL WHERE promotion_run_id = $1 AND decision = 'move'`, [a.id]); }, a);
    const r1 = await one.svc.confirm({ runId: one.runId, confirmedBy: staff });
    eq(r1.status === "blocked" ? r1.flagged.length : -1, 0);
    eq((await itemOf(one.runId, one.student)).decision, "stay");
    // a run confirmed in between is left alone
    const b: { id?: string } = {};
    const two = await blockedRun(async () => { await q(`UPDATE promotion_run SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [b.id]); }, b);
    eq(await codeOf(async () => two.svc.confirm({ runId: two.runId, confirmedBy: staff })), "promotion_not_draft");
    eq((await itemOf(two.runId, two.student)).decision, "move");
  });
  test("B8: clearing a pin checks every month it affects, not only the caller's date", async () => {
    const cls = await classes([g6]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    await promo.updateItem({ runId: d.runId, itemId: String((await itemOf(d.runId, s)).id), decision: "stay" });
    await promo.confirm({ runId: d.runId, confirmedBy: staff });
    clock = new Date("2027-04-02T10:00:00Z");
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from) VALUES ($1,$2,1500,'2027-05-01')`, [cls[g6]!.fee, g7]);
    // the Grade 7 rate starts on May 1, but the pin would be cleared now and April would have no rate
    eq(await codeOf(async () => promo.clearBillingGrade({ enrollmentId: e.id, clearedBy: staff, reason: "r", fromDate: "2027-05-01" })), "rate_missing");
    eq((await q(`SELECT billing_grade_level_id FROM enrollment WHERE id = $1`, [e.id]))[0]!.billing_grade_level_id, g6);
    // rates for April and for June onward, nothing for May: today and the caller's date both have one, May does not
    await q(`DELETE FROM fee_rate WHERE fee_structure_id = $1 AND grade_level_id = $2`, [cls[g6]!.fee, g7]);
    await q(`INSERT INTO fee_rate (fee_structure_id, grade_level_id, amount, effective_from, effective_to) VALUES ($1,$2,1500,'2027-04-01','2027-05-01'), ($1,$2,1600,'2027-06-01',NULL)`, [cls[g6]!.fee, g7]);
    eq(await codeOf(async () => promo.clearBillingGrade({ enrollmentId: e.id, clearedBy: staff, reason: "r", fromDate: "2027-06-01" })), "rate_missing");
    clock = new Date("2027-03-10T10:00:00Z");
  });
  test("a draft goes stale when an enrolment was dropped meanwhile", async () => {
    const cls = await classes([g6, g7]);
    const s = await pupil(g6);
    const e = (await enrol.enrollStudent({ studentId: s, courseId: cls[g6]!.course })).enrollment;
    const d = await draft();
    await enrol.dropEnrollment({ enrollmentId: e.id });
    eq(await codeOf(async () => promo.confirm({ runId: d.runId, confirmedBy: staff })), "promotion_stale");
  });
});

describe("getRun reads one snapshot", () => {
  test("header and items are read in one repeatable-read transaction", async () => {
    const d = await promo.createDraft({ performedBy: staff });
    const sqls: string[] = [];
    const spy = (target: any): any =>
      new Proxy(target, {
        get(t, k) {
          const v = t[k];
          if (k === "query") return (text: string, ...a: unknown[]) => (sqls.push(String(text)), t.query(text, ...a));
          if (k === "transaction") return (cb: (tx: unknown) => unknown) => t.transaction((tx: unknown) => cb(spy(tx)));
          return typeof v === "function" ? v.bind(t) : v;
        },
      });
    const spied = createPromotionService(drizzle(spy(pg), { schema }) as unknown as typeof db, { now });
    const view = await spied.getRun({ runId: d.runId });
    eq(view.run.id, d.runId, "run");
    const iso = sqls.findIndex((t) => /set transaction isolation level repeatable read/i.test(t));
    const head = sqls.findIndex((t) => /from "promotion_run"/i.test(t));
    const rows = sqls.findIndex((t) => /from "promotion_item"/i.test(t));
    eq([iso >= 0, iso < head, head < rows], [true, true, true], "isolation set before both reads");
    await promo.discardDraft({ runId: d.runId, discardedBy: staff });
  });

  test("a run with no items is an empty list, a missing run is not_found", async () => {
    const empty = await id(`INSERT INTO promotion_run (performed_by, status, effective_date) VALUES ($1, 'discarded', '2027-04-01')`, [staff]);
    const view = await promo.getRun({ runId: empty });
    eq([view.items, view.byDecision], [[], { move: 0, stay: 0, skip: 0, needs_review: 0 }]);
    eq(await codeOf(async () => promo.getRun({ runId: "00000000-0000-0000-0000-000000000000" })), "not_found");
  });
});
