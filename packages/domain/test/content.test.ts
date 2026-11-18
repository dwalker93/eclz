/**
 * Content: recordings, files and books, who can open them, purchases and handover (F rules).
 */
import { afterAll, describe, test } from "bun:test";
import { createContentService, createPaymentService, decideContentAccess, hmacSigner } from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET timezone = 'UTC', enabled_modules = '{"content_store": true}'::jsonb`);
const now = () => new Date("2027-03-10T10:00:00Z");
const content = createContentService(db, { now });
const pay = createPaymentService(db, { signer: hmacSigner("s"), now, hooks: content.hooks });

const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const b2 = await id(`INSERT INTO branch (organization_id, name) VALUES ((SELECT id FROM organization), 'Kandy')`);
const staff = await id(`INSERT INTO "user" (email) VALUES ('staff@example.com')`);
const lec = await id(`INSERT INTO lecturer (full_name) VALUES ('Mr Silva')`);
const subj = await id(`INSERT INTO subject (name) VALUES ('Science')`);
const slip = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('slips/1.jpg', 'image/jpeg', 1000)`);
const notes = await id(`INSERT INTO file (storage_key, mime_type, size_bytes) VALUES ('notes/1.pdf', 'application/pdf', 5000)`);
const bankMethod = String((await q(`SELECT id FROM payment_method WHERE type = 'bank_transfer'`))[0]!.id);
const bank = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'T', '1')`, [b1]);
const bank2 = await id(`INSERT INTO bank_account (branch_id, bank_name, account_name, account_number) VALUES ($1, 'BOC', 'K', '2')`, [b2]);

let n = 0;
let ref = 0;
const newCourse = (branchId = b1) => id(`INSERT INTO course (subject_id, branch_id, name, kind, learning_mode, attendance_enabled) VALUES ($1,$2,$3,'class','scheduled',false)`, [subj, branchId, `Class ${++n}`]);
async function newStudent(opts: { branches?: string[]; course?: string; access?: { status?: string; accessStatus?: string; starts?: string; ends?: string | null } } = {}) {
  const studentId = await id(`INSERT INTO student (student_no, full_name, date_of_birth) VALUES ($1,$2,'2014-05-01')`, [`C${++n}`, `Student ${n}`]);
  for (const [i, b] of (opts.branches ?? []).entries()) await q(`INSERT INTO student_branch (student_id, branch_id, is_primary) VALUES ($1,$2,$3)`, [studentId, b, i === 0]);
  if (opts.course) {
    const a = opts.access ?? {};
    await q(`INSERT INTO enrollment (course_id, student_id, status, access_status, access_starts_on, access_ends_on) VALUES ($1,$2,$3,$4,$5,$6)`, [
      opts.course, studentId, a.status ?? "active", a.accessStatus ?? "active", a.starts ?? "2027-01-01", a.ends ?? null,
    ]);
  }
  return studentId;
}
const recording = (over: Partial<Parameters<typeof content.createItem>[0]> = {}) =>
  content.createItem({ lecturerId: lec, kind: "recording", title: `Lesson ${++n}`, externalUrl: "https://youtu.be/abc", ...over });
const publish = async <T extends { id: string }>(item: T) => (await content.setStatus({ contentId: item.id, status: "published" }), item);
async function payFull(studentId: string, invoiceId: string, branchId = b1, amount?: string) {
  const [inv] = await q(`SELECT total FROM invoice WHERE id = $1`, [invoiceId]);
  const sub = await pay.submitPayment({ studentId, branchId, paymentMethodId: bankMethod, bankAccountId: branchId === b1 ? bank : bank2, slipFileId: slip, amount: amount ?? String(inv!.total), paidOn: "2027-03-10", referenceNo: `R${++ref}`, submittedBy: staff, invoiceIds: [invoiceId] } as never);
  await pay.verifyPayment({ paymentId: sub.id, verifiedBy: staff });
  return sub.id as string;
}
const statusOf = async (purchaseId: string) => String((await q(`SELECT status FROM content_purchase WHERE id = $1`, [purchaseId]))[0]!.status);

describe("F3 decision (pure)", () => {
  const base = { kind: "recording" as const, status: "published", purchasePaid: false, viaCourse: false, freeInStudentBranch: false };
  test("each way in, and the order of reasons", () => {
    eq(decideContentAccess({ ...base, viaCourse: true }), { allowed: true, via: "course" }, "course");
    eq(decideContentAccess({ ...base, freeInStudentBranch: true }), { allowed: true, via: "free_registered" }, "free");
    eq(decideContentAccess({ ...base, purchasePaid: true }), { allowed: true, via: "purchase" }, "purchase wins");
    eq(decideContentAccess({ ...base, purchasePaid: true, viaCourse: true }), { allowed: true, via: "purchase" }, "purchase first");
    eq(decideContentAccess(base), { allowed: false, reason: "no_access" }, "nothing");
    eq(decideContentAccess({ ...base, status: "draft", viaCourse: true }), { allowed: false, reason: "not_published" }, "draft");
    eq(decideContentAccess({ ...base, status: "archived", purchasePaid: true }), { allowed: true, via: "purchase" }, "archived but owned (F4)");
    eq(decideContentAccess({ ...base, kind: "physical_book", purchasePaid: true }), { allowed: false, reason: "not_viewable" }, "book");
  });
});

describe("creating items (F1, F2)", () => {
  test("kind rules", async () => {
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "recording", title: "x" }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "recording", title: "x", externalUrl: "ftp://x" }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "recording", title: "x", externalUrl: "not a url" }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "recording", title: "x", externalUrl: "https://a.b", fileId: notes }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "file", title: "x" }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "file", title: "x", fileId: notes, externalUrl: "https://a.b" }));
    await fails("not_found", () => content.createItem({ lecturerId: lec, kind: "file", title: "x", fileId: "00000000-0000-0000-0000-000000000000" }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "physical_book", title: "x", externalUrl: "https://a.b", accessType: "paid", price: 5, branchIds: [b1] }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "physical_book", title: "x" }));
    await fails("content_invalid", () => content.createItem({ lecturerId: lec, kind: "recording", title: " ", externalUrl: "https://a.b" }));
  });
  test("price and listing rules", async () => {
    await fails("content_invalid", () => recording({ accessType: "paid", branchIds: [b1] }));
    await fails("content_invalid", () => recording({ accessType: "paid", price: 0, branchIds: [b1] }));
    await fails("content_invalid", () => recording({ accessType: "course", price: 100 }));
    await fails("content_invalid", () => recording({ accessType: "paid", price: 100 }));
    await fails("content_invalid", () => recording({ accessType: "free_registered" }));
    await fails("not_found", () => recording({ accessType: "free_registered", branchIds: ["00000000-0000-0000-0000-000000000000"] }));
    const ok = await recording({ accessType: "paid", price: "250", branchIds: [b1] });
    eq([ok.price, ok.status], ["250.00", "draft"], "created as a draft");
  });
  test("status moves and price edits", async () => {
    const item = await recording({ accessType: "paid", price: 100, branchIds: [b1] });
    await fails("content_invalid", () => content.setStatus({ contentId: item.id, status: "archived" }));
    await content.setStatus({ contentId: item.id, status: "published" });
    await content.setStatus({ contentId: item.id, status: "archived" });
    await content.setStatus({ contentId: item.id, status: "published" });
    eq((await content.updateItem({ contentId: item.id, price: 120, title: "Renamed" })).price, "120.00", "new price");
    await fails("content_invalid", () => content.updateItem({ contentId: item.id, price: 0 }));
    const free = await recording();
    await fails("content_invalid", () => content.updateItem({ contentId: free.id, price: 10 }));
    eq((await content.addBranches({ contentId: item.id, branchIds: [b2, b1] })).sort(), [b1, b2].sort(), "listed in both");
  });
});

describe("who can open what (F3)", () => {
  test("through a course: effective access only", async () => {
    const c = await newCourse();
    const item = await publish(await recording());
    await content.attachToCourse({ courseId: c, contentId: item.id });
    const ok = await newStudent({ course: c });
    const restricted = await newStudent({ course: c, access: { accessStatus: "restricted" } });
    const ended = await newStudent({ course: c, access: { ends: "2027-03-10" } });
    const future = await newStudent({ course: c, access: { starts: "2027-03-11" } });
    const dropped = await newStudent({ course: c, access: { status: "dropped" } });
    const outsider = await newStudent({ branches: [b1] });
    const can = async (s: string) => (await content.canViewContent({ studentId: s, contentId: item.id })).allowed;
    eq([await can(ok), await can(restricted), await can(ended), await can(future), await can(dropped), await can(outsider)], [true, false, false, false, false, false], "matrix");
    const opened = await content.openContent({ studentId: ok, contentId: item.id });
    eq([opened.externalUrl, opened.via], ["https://youtu.be/abc", "course"], "link and way in");
    await fails("content_not_accessible", () => content.openContent({ studentId: restricted, contentId: item.id }));
  });

  test("free for registered students of a listed branch", async () => {
    const item = await publish(await recording({ accessType: "free_registered", branchIds: [b1] }));
    const inB1 = await newStudent({ branches: [b1] });
    const inB2 = await newStudent({ branches: [b2] });
    const nobody = await newStudent();
    eq((await content.canViewContent({ studentId: inB1, contentId: item.id })), { allowed: true, via: "free_registered" }, "listed branch");
    eq((await content.canViewContent({ studentId: inB2, contentId: item.id })).allowed, false, "other branch");
    eq((await content.canViewContent({ studentId: nobody, contentId: item.id })).allowed, false, "no branch");
  });

  test("drafts and archived items close for course and free access; books cannot be opened", async () => {
    const c = await newCourse();
    const s = await newStudent({ course: c, branches: [b1] });
    const draft = await recording({ accessType: "free_registered", branchIds: [b1] });
    await content.attachToCourse({ courseId: c, contentId: draft.id });
    eq(await content.canViewContent({ studentId: s, contentId: draft.id }), { allowed: false, reason: "not_published" }, "draft");
    await content.setStatus({ contentId: draft.id, status: "published" });
    eq((await content.canViewContent({ studentId: s, contentId: draft.id })).allowed, true, "published");
    await content.setStatus({ contentId: draft.id, status: "archived" });
    eq((await content.canViewContent({ studentId: s, contentId: draft.id })).allowed, false, "archived");
    const book = await publish(await content.createItem({ lecturerId: lec, kind: "physical_book", title: "Workbook", accessType: "paid", price: 900, branchIds: [b1] }));
    eq(await content.canViewContent({ studentId: s, contentId: book.id }), { allowed: false, reason: "not_viewable" }, "book");
  });

  test("a file item opens with its file id", async () => {
    const c = await newCourse();
    const s = await newStudent({ course: c });
    const f = await publish(await content.createItem({ lecturerId: lec, kind: "file", title: "Notes", fileId: notes }));
    await content.attachToCourse({ courseId: c, contentId: f.id });
    eq((await content.openContent({ studentId: s, contentId: f.id })).fileId, notes, "file");
  });

  test("course list keeps section order, hides drafts, and says what the student can open", async () => {
    const c = await newCourse();
    const s = await newStudent({ course: c });
    const sec1 = await content.createSection({ courseId: c, title: "Week 1", position: 1 });
    const sec2 = await content.createSection({ courseId: c, title: "Week 2", position: 2 });
    const a = await publish(await recording({ title: "A" }));
    const b = await publish(await recording({ title: "B" }));
    const d = await recording({ title: "Draft" });
    const paid = await publish(await recording({ title: "Paid extra", accessType: "paid", price: 50, branchIds: [b1] }));
    await content.attachToCourse({ courseId: c, contentId: b.id, sectionId: sec2.id, position: 1 });
    await content.attachToCourse({ courseId: c, contentId: a.id, sectionId: sec1.id, position: 1 });
    await content.attachToCourse({ courseId: c, contentId: d.id, sectionId: sec1.id, position: 2 });
    await content.attachToCourse({ courseId: c, contentId: paid.id });
    const list = await content.listCourseContent({ courseId: c, studentId: s });
    eq(list.map((x) => [x.title, x.section]), [["Paid extra", null], ["A", "Week 1"], ["B", "Week 2"]], "order without the draft");
    eq(list.every((x) => x.canOpen), true, "course access opens items attached to the course");
    const otherCourse = await newCourse();
    await fails("content_invalid", () => content.attachToCourse({ courseId: otherCourse, contentId: a.id, sectionId: sec1.id }));
    eq(await content.detachFromCourse({ courseId: c, contentId: paid.id }), 1, "detached");
  });
});

describe("purchases (F4, F5)", () => {
  async function onSale(price: number | string = 500, branchIds = [b1]) {
    return publish(await recording({ accessType: "paid", price, branchIds }));
  }

  test("a purchase is pending with its invoice and grants nothing until paid; payment makes it permanent", async () => {
    const item = await onSale(500);
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    eq([r.purchase.status, r.purchase.price, r.purchase.channel, r.existing], ["pending", "500.00", "online", false], "pending purchase");
    const [inv] = await q(`SELECT total, status, branch_id, issued_on, due_date FROM invoice WHERE id = $1`, [r.invoiceId]);
    eq([inv!.total, inv!.status, inv!.branch_id, inv!.issued_on, inv!.due_date], ["500.00", "pending", b1, "2027-03-10", "2027-03-17"], "invoice");
    const [it] = await q(`SELECT kind, amount, content_purchase_id FROM invoice_item WHERE invoice_id = $1`, [r.invoiceId]);
    eq([it!.kind, it!.amount, it!.content_purchase_id], ["content", "500.00", r.purchase.id], "content line");
    eq((await q(`SELECT invoice_id FROM content_purchase WHERE id = $1`, [r.purchase.id]))[0]!.invoice_id, r.invoiceId, "linked both ways");
    await fails("content_not_accessible", () => content.openContent({ studentId: s, contentId: item.id }));

    await payFull(s, r.invoiceId, b1, "200");
    eq(await statusOf(r.purchase.id), "pending", "partial payment grants nothing");
    await fails("content_not_accessible", () => content.openContent({ studentId: s, contentId: item.id }));
    await payFull(s, r.invoiceId, b1, "300");
    eq(await statusOf(r.purchase.id), "paid", "fully paid");
    eq((await content.openContent({ studentId: s, contentId: item.id })).via, "purchase", "owner opens it");

    // permanent: archiving the item later does not take it away (F4)
    await content.setStatus({ contentId: item.id, status: "archived" });
    eq((await content.canViewContent({ studentId: s, contentId: item.id })).allowed, true, "still opens");
  });

  test("F5: a second purchase of the same item is refused when paid, and returns the open one when pending", async () => {
    const item = await onSale(100);
    const s = await newStudent({ branches: [b1] });
    const first = await content.purchase({ contentId: item.id, studentId: s });
    const again = await content.purchase({ contentId: item.id, studentId: s });
    eq([again.existing, again.purchase.id, again.invoiceId], [true, first.purchase.id, first.invoiceId], "same pending purchase");
    eq((await q(`SELECT count(*)::int AS c FROM invoice WHERE student_id = $1`, [s]))[0]!.c, 1, "one invoice");
    await payFull(s, first.invoiceId);
    await fails("already_purchased", () => content.purchase({ contentId: item.id, studentId: s }));
  });

  test("only items on sale can be bought", async () => {
    const s = await newStudent({ branches: [b1] });
    const draft = await recording({ accessType: "paid", price: 10, branchIds: [b1] });
    const free = await publish(await recording({ accessType: "free_registered", branchIds: [b1] }));
    const courseOnly = await publish(await recording());
    await fails("content_invalid", () => content.purchase({ contentId: draft.id, studentId: s }));
    await fails("content_invalid", () => content.purchase({ contentId: free.id, studentId: s }));
    await fails("content_invalid", () => content.purchase({ contentId: courseOnly.id, studentId: s }));
    await fails("not_found", () => content.purchase({ contentId: "00000000-0000-0000-0000-000000000000", studentId: s }));
    const sale = await onSale(10);
    await fails("not_found", () => content.purchase({ contentId: sale.id, studentId: "00000000-0000-0000-0000-000000000000" }));
  });

  test("branch choice (D13): must be listed; derived from the student when unambiguous; asked for otherwise", async () => {
    const shared = await onSale(80, [b1, b2]);
    const sOnlyB2 = await newStudent({ branches: [b2] });
    const r1 = await content.purchase({ contentId: shared.id, studentId: sOnlyB2 });
    eq(r1.purchase.branchId, b2, "the student's own branch");
    const sNone = await newStudent();
    await fails("content_invalid", () => content.purchase({ contentId: shared.id, studentId: sNone }));
    const r2 = await content.purchase({ contentId: shared.id, studentId: sNone, branchId: b1 });
    eq((await q(`SELECT branch_id FROM invoice WHERE id = $1`, [r2.invoiceId]))[0]!.branch_id, b1, "invoice follows the purchase branch");
    const onlyB1 = await onSale(60, [b1]);
    await fails("content_invalid", () => content.purchase({ contentId: onlyB1.id, studentId: sNone, branchId: b2 }));
    const r3 = await content.purchase({ contentId: onlyB1.id, studentId: sNone });
    eq(r3.purchase.branchId, b1, "the only listed branch");
  });

  test("the purchase keeps the price it was bought at", async () => {
    const item = await onSale(100);
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    await content.updateItem({ contentId: item.id, price: 999 });
    eq((await q(`SELECT price FROM content_purchase WHERE id = $1`, [r.purchase.id]))[0]!.price, "100.00", "unchanged");
    eq((await q(`SELECT total FROM invoice WHERE id = $1`, [r.invoiceId]))[0]!.total, "100.00", "invoice unchanged");
  });

  test("voiding the payment takes a digital purchase back to pending and closes access", async () => {
    const item = await onSale(100);
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    const paymentId = await payFull(s, r.invoiceId);
    eq(await statusOf(r.purchase.id), "paid", "paid");
    await pay.voidPayment({ paymentId, voidedBy: staff, reason: "bounced" });
    eq(await statusOf(r.purchase.id), "pending", "back to pending");
    await fails("content_not_accessible", () => content.openContent({ studentId: s, contentId: item.id }));
    await payFull(s, r.invoiceId);
    eq(await statusOf(r.purchase.id), "paid", "paid again after a new payment");
  });

  test("cancelling: pending only, unpaid only; the item can be bought again afterwards", async () => {
    const item = await onSale(100);
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    const c = await content.cancelPurchase({ purchaseId: r.purchase.id });
    eq(c.status, "cancelled", "cancelled");
    eq((await q(`SELECT status FROM invoice WHERE id = $1`, [r.invoiceId]))[0]!.status, "cancelled", "invoice cancelled");
    eq((await content.cancelPurchase({ purchaseId: r.purchase.id })).status, "cancelled", "idempotent");
    const again = await content.purchase({ contentId: item.id, studentId: s });
    eq([again.existing, again.invoiceId !== r.invoiceId], [false, true], "bought again with a new invoice");
    await payFull(s, again.invoiceId);
    await fails("content_invalid", () => content.cancelPurchase({ purchaseId: again.purchase.id }));
    const partial = await onSale(100);
    const s2 = await newStudent({ branches: [b1] });
    const p2 = await content.purchase({ contentId: partial.id, studentId: s2 });
    await payFull(s2, p2.invoiceId, b1, "40");
    await fails("content_invalid", () => content.cancelPurchase({ purchaseId: p2.purchase.id }));
  });

  test("the student's library: open items, the store, and purchases", async () => {
    const c = await newCourse();
    const s = await newStudent({ branches: [b1], course: c });
    const viaCourse = await publish(await recording({ title: "From course" }));
    await content.attachToCourse({ courseId: c, contentId: viaCourse.id });
    const free = await publish(await recording({ title: "Free one", accessType: "free_registered", branchIds: [b1] }));
    const bought = await onSale(100);
    const forSale = await publish(await recording({ title: "For sale", accessType: "paid", price: 75, branchIds: [b1] }));
    const otherBranch = await publish(await recording({ title: "Elsewhere", accessType: "paid", price: 75, branchIds: [b2] }));
    const r = await content.purchase({ contentId: bought.id, studentId: s });
    await payFull(s, r.invoiceId);
    const lib = await content.listForStudent({ studentId: s });
    const via = new Map(lib.available.map((x) => [x.contentId, x.via]));
    eq([via.get(viaCourse.id), via.get(free.id), via.get(bought.id)], ["course", "free_registered", "purchase"], "available");
    eq(via.has(forSale.id) || via.has(otherBranch.id), false, "unbought items are not available");
    const inStore = new Map(lib.store.map((x) => [x.contentId, x]));
    eq([inStore.has(forSale.id), inStore.has(otherBranch.id), inStore.has(bought.id), inStore.has(free.id)], [true, false, false, false], "store: unbought, sold in the student's branches only");
    eq(inStore.get(forSale.id)!.price, "75.00", "store price");
    eq(lib.purchases.map((p) => p.contentId), [bought.id], "purchases");
    eq(JSON.stringify(lib).includes("youtu.be"), false, "no links in the listing");
  });
});

describe("physical books (F6)", () => {
  async function book() {
    return publish(await content.createItem({ lecturerId: lec, kind: "physical_book", title: `Book ${++n}`, accessType: "paid", price: 900, branchIds: [b1] }));
  }

  test("payment and handover are separate events", async () => {
    const item = await book();
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    eq(r.purchase.channel, "physical", "physical channel");
    await fails("purchase_not_paid", () => content.handOver({ purchaseId: r.purchase.id, handedOverBy: staff }));
    await payFull(s, r.invoiceId);
    eq((await content.pendingHandovers({ branchId: b1 })).map((x) => x.purchase.id).includes(r.purchase.id), true, "waiting for handover");
    const done = await content.handOver({ purchaseId: r.purchase.id, handedOverBy: staff });
    eq([done.handedOverBy, done.handedOverAt !== null], [staff, true], "recorded");
    await fails("already_handed_over", () => content.handOver({ purchaseId: r.purchase.id, handedOverBy: staff }));
    eq((await content.pendingHandovers({ branchId: b1 })).map((x) => x.purchase.id).includes(r.purchase.id), false, "no longer waiting");
    await fails("not_found", () => content.handOver({ purchaseId: "00000000-0000-0000-0000-000000000000", handedOverBy: staff }));
  });

  test("a digital purchase is never handed over", async () => {
    const item = await publish(await recording({ accessType: "paid", price: 10, branchIds: [b1] }));
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    await payFull(s, r.invoiceId);
    await fails("content_invalid", () => content.handOver({ purchaseId: r.purchase.id, handedOverBy: staff }));
  });

  test("voiding a payment after handover keeps the purchase paid, for staff to resolve", async () => {
    const item = await book();
    const s = await newStudent({ branches: [b1] });
    const r = await content.purchase({ contentId: item.id, studentId: s });
    const paymentId = await payFull(s, r.invoiceId);
    await content.handOver({ purchaseId: r.purchase.id, handedOverBy: staff });
    await pay.voidPayment({ paymentId, voidedBy: staff, reason: "bounced" });
    eq(await statusOf(r.purchase.id), "paid", "kept");
    eq((await q(`SELECT status FROM invoice WHERE id = $1`, [r.invoiceId]))[0]!.status, "pending", "the invoice shows the money is owed again");
  });
});
