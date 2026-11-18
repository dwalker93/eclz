/** Owner's reports: overdue and collections, branch scope, time zone, voids. */
import { afterAll, describe, test } from "bun:test";
import { createAccessControlService, createPaymentService, createReportService, hmacSigner } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});
await q(`UPDATE organization SET timezone = 'Asia/Colombo'`);

let clock = new Date("2027-03-10T10:00:00Z"); // 15:30 on 10 March in Colombo
const reports = createReportService(db, { now: () => clock });
const pay = createPaymentService(db, { signer: hmacSigner("s"), now: () => clock });
const acl = createAccessControlService(db);
let n = 0;
const newUser = () => id(`INSERT INTO "user" (email, status) VALUES ($1, 'active')`, [`r${++n}@example.com`]);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const root = await newUser();
await acl.assignRole({ userId: root, roleName: "root_admin", actor: root });
await q(`INSERT INTO role (name, description) VALUES ('report_viewer', 'custom')`);
await q(`INSERT INTO role_permission (role_id, permission_id) SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'report_viewer' AND p.code = 'reports.read'`);
const viewer1 = await newUser();
await acl.assignRole({ userId: viewer1, roleName: "report_viewer", branchId: b1, actor: root });
const handler = await newUser();
await acl.assignRole({ userId: handler, roleName: "payment_handler", branchId: b1, actor: root });

const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const mkStudent = (no: string, name: string) => id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [no, name]);
const sA = await mkStudent("R1", "Anna");
const sB = await mkStudent("R2", "Bimal");
const sC = await mkStudent("R3", "Chamari");
const gid = await id(`INSERT INTO guardian (full_name, phone) VALUES ('Anna Mum', '94771110000')`);
await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [sA, gid]);
const course = (b: string) => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode) VALUES ($1,$2,$3,'class','scheduled')`, [subj, b, `C${++n}`]);
const feeFor = (b: string, c: string) => id(`INSERT INTO fee_structure (branch_id, course_id, name, billing_type) VALUES ($1,$2,'Package','one_time_package')`, [b, c]);
const c1 = await course(b1);
const c2 = await course(b2);
const f1 = await feeFor(b1, c1);
const f2 = await feeFor(b2, c2);
const enrol = (c: string, s: string, f: string) => id(`INSERT INTO enrollment (course_id, student_id, fee_structure_id) VALUES ($1,$2,$3)`, [c, s, f]);
const eA = await enrol(c1, sA, f1);
const eB = await enrol(c1, sB, f1);
const eC = await enrol(c2, sC, f2);

/** An invoice with one fee line, so a payment can be allocated to it. */
async function invoice(student: string, b: string, due: string, total: number, o: { paid?: number; status?: string; enrollment?: string; fee?: string } = {}) {
  const inv = await id(`INSERT INTO invoice (student_id, branch_id, issued_on, due_date, subtotal, total, amount_paid, status) VALUES ($1,$2,'2026-01-01',$3,$4,$4,$5,$6)`, [student, b, due, total, o.paid ?? 0, o.status ?? "pending"]);
  if (o.enrollment) await q(`INSERT INTO invoice_item (invoice_id, kind, amount, enrollment_id, fee_structure_id) VALUES ($1,'package_fee',$2,$3,$4)`, [inv, total, o.enrollment, o.fee]);
  return inv;
}
const cash = async (student: string, b: string, amount: string, invoiceId: string, at: string) => {
  clock = new Date(at);
  return pay.recordCashPayment({ studentId: student, branchId: b, amount, recordedBy: handler, invoiceIds: [invoiceId] });
};

describe("overdue report", () => {
  test("lists unpaid invoices past their due date, with aging, branch totals and the parent's phone", async () => {
    await invoice(sA, b1, "2027-03-05", 1000); // 5 days late
    await invoice(sB, b1, "2027-01-20", 2000, { paid: 500, status: "partial" }); // 49 days late, 1500 owed
    await invoice(sB, b1, "2026-12-01", 600, { status: "overdue" }); // 99 days
    await invoice(sA, b1, "2027-03-10", 700); // due today: not late yet
    await invoice(sA, b1, "2027-01-01", 800, { paid: 800, status: "paid" });
    await invoice(sA, b1, "2027-01-01", 900, { status: "cancelled" });
    await invoice(sC, b2, "2027-03-01", 300); // 9 days, other branch

    const all = await reports.overdue({ actor: root });
    eq([all.asOf, all.count, all.outstanding], ["2027-03-10", 4, "3400.00"]);
    eq(all.aging, { "1-30": "1300.00", "31-60": "1500.00", "61+": "600.00" });
    eq(all.byBranch.map((b) => [b.branchName, b.count, b.outstanding]), [["Main", 3, "3100.00"], ["Kandy", 1, "300.00"]].map((r) => r) as never);
    eq(all.rows.map((r) => [r.studentNo, r.dueDate, r.daysOverdue, r.outstanding]), [
      ["R2", "2026-12-01", 99, "600.00"],
      ["R2", "2027-01-20", 49, "1500.00"],
      ["R3", "2027-03-01", 9, "300.00"],
      ["R1", "2027-03-05", 5, "1000.00"],
    ]);
    eq([all.rows[3]!.guardianName, all.rows[3]!.guardianPhone, all.rows[0]!.guardianPhone], ["Anna Mum", "94771110000", null]);
  });

  test("scope, branch filter and paging", async () => {
    const mine = await reports.overdue({ actor: viewer1 });
    eq([mine.count, mine.outstanding, mine.byBranch.length], [3, "3100.00", 1]);
    await fails("forbidden", () => reports.overdue({ actor: viewer1, branchId: b2 }));
    eq((await reports.overdue({ actor: root, branchId: b2 })).count, 1);
    const page = await reports.overdue({ actor: root, limit: 2, offset: 1 });
    eq([page.count, page.rows.length, page.outstanding], [4, 2, "3400.00"]);
    await fails("forbidden", () => reports.overdue({ actor: handler }));
    const stranger = await newUser();
    await fails("forbidden", () => reports.overdue({ actor: stranger }));
  });

  test("a payment that settles an invoice takes it off the list", async () => {
    const inv = await invoice(sA, b1, "2027-02-01", 400, { enrollment: eA, fee: f1 });
    eq((await reports.overdue({ actor: root })).count, 5);
    await cash(sA, b1, "400.00", inv, "2027-03-10T10:00:00Z");
    eq((await reports.overdue({ actor: root })).count, 4);
  });
});

describe("collections report", () => {
  test("totals verified money by branch, method and local day; leaves out voids; shows pending slips", async () => {
    const i1 = await invoice(sA, b1, "2027-04-01", 400, { enrollment: eA, fee: f1 });
    const i2 = await invoice(sB, b1, "2027-04-01", 600, { enrollment: eB, fee: f1 });
    const i3 = await invoice(sC, b2, "2027-04-01", 250, { enrollment: eC, fee: f2 });
    const i4 = await invoice(sA, b1, "2027-04-01", 100, { enrollment: eA, fee: f1 });
    await cash(sA, b1, "400.00", i1, "2027-03-09T20:00:00Z"); // 01:30 on the 10th in Colombo
    await cash(sB, b1, "600.00", i2, "2027-03-10T05:00:00Z");
    await cash(sC, b2, "250.00", i3, "2027-03-10T06:00:00Z");
    const p4 = await cash(sA, b1, "100.00", i4, "2027-03-12T05:00:00Z");
    await pay.voidPayment({ paymentId: p4.payment.id, voidedBy: root, reason: "entered twice" });

    const day = await reports.collections({ actor: root, from: "2027-03-10", to: "2027-03-10" });
    eq([day.collected, day.paymentCount], ["1650.00", 4]); // includes the 400 settled in the overdue test
    eq(day.byBranch.map((b) => [b.branchName, b.amount]), [["Main", "1400.00"], ["Kandy", "250.00"]]);
    eq(day.byMethod, [{ type: "cash", label: "Cash", count: 4, amount: "1650.00" }]);
    eq(day.byDay, [{ date: "2027-03-10", count: 4, amount: "1650.00" }]);
    eq((await reports.collections({ actor: root, from: "2027-03-09", to: "2027-03-09" })).collected, "0.00");
    const wide = await reports.collections({ actor: root, from: "2027-03-01", to: "2027-03-31" });
    eq([wide.collected, wide.paymentCount], ["1650.00", 4]);
  });

  test("pending slips, scope, and bad periods", async () => {
    clock = new Date("2027-03-10T10:00:00Z");
    const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('s/1.jpg','image/jpeg',10)`);
    const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1,'BOC','T','1')`, [b1]);
    const method = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
    await pay.submitPayment({ studentId: sA, branchId: b1, paymentMethodId: method, bankAccountId: bank, slipFileId: slip, amount: "150.00", referenceNo: "REF1", submittedBy: handler });
    const all = await reports.collections({ actor: root, from: "2027-03-10", to: "2027-03-10" });
    eq(all.pendingVerification, { count: 1, amount: "150.00" });
    const mine = await reports.collections({ actor: viewer1, from: "2027-03-10", to: "2027-03-10" });
    eq([mine.collected, mine.byBranch.length], ["1400.00", 1]);
    await fails("forbidden", () => reports.collections({ actor: viewer1, from: "2027-03-10", to: "2027-03-10", branchId: b2 }));
    await fails("forbidden", () => reports.collections({ actor: handler, from: "2027-03-10", to: "2027-03-10" }));
    await fails("invalid_input", () => reports.collections({ actor: root, from: "2027-03-11", to: "2027-03-10" }));
    await fails("invalid_input", () => reports.collections({ actor: root, from: "2027-03-1", to: "2027-03-10" }));
    await fails("invalid_input", () => reports.collections({ actor: root, from: "2026-01-01", to: "2027-03-10" }));
  });
});

describe("aging buckets", () => {
  test("30 days late is still in the first bucket, 31 and 60 in the second, 61 in the third", async () => {
    clock = new Date("2027-03-10T10:00:00Z");
    const before = (await reports.overdue({ actor: root })).aging;
    for (const due of ["2027-02-08", "2027-02-07", "2027-01-09", "2027-01-08"]) await invoice(sA, b1, due, 10);
    const after = (await reports.overdue({ actor: root })).aging;
    const diff = (k: "1-30" | "31-60" | "61+") => (Number(after[k]) - Number(before[k])).toFixed(2);
    eq([diff("1-30"), diff("31-60"), diff("61+")], ["10.00", "20.00", "10.00"]);
  });
});
