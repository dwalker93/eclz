/**
 * Notification queue, dispatcher and "due soon" reminders (J1, J2).
 */
import { afterAll, describe, test } from "bun:test";
import {
  composeMessage,
  createNotificationService,
  createTextLkSms,
  normalizeSriLankaPhone,
  renderTemplate,
  type EmailMessage,
  type PushMessage,
  type SmsMessage,
} from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { db, q, id, close } = await createScenarioDb({ dateOnly: true });
afterAll(async () => {
  await close();
});

await q(`UPDATE organization SET timezone = 'UTC'`);
const org = String((await q(`SELECT id FROM organization`))[0]!.id);
const b1 = String((await q(`SELECT id FROM branch LIMIT 1`))[0]!.id);
const now = () => new Date("2027-03-10T10:00:00Z");

const sent = { email: [] as EmailMessage[], sms: [] as SmsMessage[], push: [] as PushMessage[] };
let smsFails = false;
const svc = createNotificationService(db, {
  now,
  providers: {
    email: async (m) => void sent.email.push(m),
    sms: async (m) => {
      if (smsFails) throw new Error("gateway down");
      sent.sms.push(m);
    },
    push: async (m) => void sent.push.push(m),
  },
});

let n = 0;
async function setModules(modules: Record<string, boolean>) {
  await q(`UPDATE organization SET enabled_modules = $1::jsonb`, [JSON.stringify(modules)]);
}
async function setChannel(channel: string, on: boolean) {
  await q(
    `INSERT INTO notification_channel (organization_id, channel, is_enabled) VALUES ($1,$2,$3) ON CONFLICT (organization_id, channel) DO UPDATE SET is_enabled = $3`,
    [org, channel, on],
  );
}
async function person(opts: { phone?: string | null; email?: string | null } = {}) {
  const email = opts.email === undefined ? `u${++n}@example.com` : opts.email;
  const userId = await id(`INSERT INTO "user" (email, phone) VALUES ($1,$2)`, [email, opts.phone ?? null]);
  const studentId = await id(`INSERT INTO student (user_id, student_no, full_name, date_of_birth) VALUES ($1,$2,$3,'2014-05-01')`, [userId, `N${++n}`, `Student ${n}`]);
  return { userId, studentId };
}
async function invoiceFor(studentId: string, dueDate: string, total: number, paid = 0, status = "pending") {
  return id(`INSERT INTO invoice (student_id, branch_id, issued_on, due_date, subtotal, total, amount_paid, status) VALUES ($1,$2,'2027-01-01',$3,$4,$4,$5,$6)`, [
    studentId, b1, dueDate, total, paid, status,
  ]);
}
const rows = (userId: string, event = "installment_due") =>
  q(`SELECT channel, status, event_key, payload FROM notification WHERE user_id = $1 AND event = $2 ORDER BY channel, event_key`, [userId, event]);

describe("pure helpers", () => {
  test("renderTemplate reads snake_case and camelCase, and blanks missing values", () => {
    eq(renderTemplate("Hi {{student_name}}, pay {{ amountDue }} by {{dueDate}}{{x}}.", { studentName: "Nimal", amountDue: "50.00", dueDate: "2027-03-12" }), "Hi Nimal, pay 50.00 by 2027-03-12.", "render");
  });
  test("composeMessage uses the template when given, else the default text", () => {
    eq(composeMessage("installment_due", { studentName: "A", amountDue: "1.00", dueDate: "d" }).body, "Payment of 1.00 for A is due on d.", "default");
    eq(composeMessage("installment_due", { studentName: "A" }, { subject: "S {{student_name}}", body: "B" }), { subject: "S A", body: "B" }, "template");
  });
  test("normalizeSriLankaPhone", () => {
    eq(normalizeSriLankaPhone("077 123 4567"), "94771234567", "local");
    eq(normalizeSriLankaPhone("+94 77 123 4567"), "94771234567", "international");
    eq(normalizeSriLankaPhone("771234567"), "94771234567", "no zero");
    eq(normalizeSriLankaPhone("12345"), null, "invalid");
  });
  test("text.lk sender posts the v3 request and fails on an error response", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = createTextLkSms({
      apiToken: "tok",
      senderId: "Inst",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ status: "success", data: {} }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await ok({ to: "94771234567", body: "hello" });
    eq(calls[0]!.url, "https://app.text.lk/api/v3/sms/send", "url");
    eq((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer tok", "auth");
    eq(JSON.parse(String(calls[0]!.init.body)), { recipient: "94771234567", sender_id: "Inst", type: "plain", message: "hello" }, "body");
    const bad = createTextLkSms({
      apiToken: "t",
      senderId: "I",
      fetch: (async () => new Response(JSON.stringify({ status: "error", message: "Invalid token" }), { status: 401 })) as unknown as typeof fetch,
    });
    let msg = "";
    await bad({ to: "1", body: "x" }).catch((e) => (msg = e.message));
    eq(msg, "text.lk: Invalid token", "error");
  });
});

describe("due soon reminders", () => {
  test("window is today through lead days; past, far and settled items are skipped", async () => {
    await setModules({});
    const p = await person();
    await invoiceFor(p.studentId, "2027-03-10", 10000); // today: in
    const soon = await invoiceFor(p.studentId, "2027-03-13", 8000, 3000, "partial"); // last day of window: in, 5000 left
    await invoiceFor(p.studentId, "2027-03-14", 7000); // one day too far
    await invoiceFor(p.studentId, "2027-03-09", 6000); // yesterday: overdue territory, not "soon"
    await invoiceFor(p.studentId, "2027-03-11", 5000, 5000, "paid"); // settled
    await invoiceFor(p.studentId, "2027-03-11", 5000, 0, "cancelled");
    const r = await svc.runDueSoonJob();
    eq(r.date, "2027-03-10", "date");
    eq(r.reminders, 2, "reminders");
    const got = await rows(p.userId);
    eq(got.length, 2, "rows");
    eq(got.every((x) => x.channel === "in_app" && x.status === "sent"), true, "in-app sent");
    const mine = got.find((x) => x.event_key === `due:${soon}`)!;
    eq(Number((mine.payload as { amountDue: string }).amountDue), 5000, "amount left");
    eq((mine.payload as { studentName: string }).studentName.startsWith("Student"), true, "student name");
  });

  test("a second run, or a run on a later day, creates nothing new for the same item (J2)", async () => {
    const p = await person();
    await invoiceFor(p.studentId, "2027-03-12", 4000);
    eq((await svc.runDueSoonJob()).notifications, 1, "first");
    eq((await svc.runDueSoonJob()).notifications, 0, "second");
    const later = createNotificationService(db, { now: () => new Date("2027-03-11T10:00:00Z") });
    await later.runDueSoonJob(); // other students' items may enter the window, this one must not repeat
    eq((await rows(p.userId)).length, 1, "rows");
  });

  test("installments are reminded one by one with the amount still owed", async () => {
    const p = await person();
    const inv = await invoiceFor(p.studentId, "2027-06-01", 10000);
    await q(`INSERT INTO invoice_installment (invoice_id, seq, due_date, amount, amount_paid) VALUES ($1,1,'2027-03-11',5000,2000), ($1,2,'2027-03-12',3000,3000), ($1,3,'2027-06-01',2000,0)`, [inv]);
    await svc.runDueSoonJob();
    const got = await rows(p.userId);
    eq(got.map((x) => x.event_key), [`due:${inv}:1`], "only installment 1");
    eq(Number((got[0]!.payload as { amountDue: string }).amountDue), 3000, "owed");
  });

  test("guardians are included only when the parent portal is on; external channels need module and switch (J1)", async () => {
    const p = await person();
    const gUser = await id(`INSERT INTO "user" (email) VALUES ($1)`, [`g${++n}@example.com`]);
    const g = await id(`INSERT INTO guardian (user_id, full_name, portal_enabled) VALUES ($1,'Parent',true)`, [gUser]);
    await q(`INSERT INTO student_guardian (student_id, guardian_id, is_primary) VALUES ($1,$2,true)`, [p.studentId, g]);
    const inv = await invoiceFor(p.studentId, "2027-03-11", 1000);
    await setModules({ sms: true });
    await setChannel("sms", false);
    await svc.runDueSoonJob();
    eq((await rows(gUser)).length, 0, "portal off, no guardian rows");
    eq((await rows(p.userId)).map((x) => x.channel), ["in_app"], "sms switch off");

    await q(`DELETE FROM notification WHERE event_key = $1`, [`due:${inv}`]);
    await setModules({ sms: true, parent_portal: true });
    await setChannel("sms", true);
    await svc.runDueSoonJob();
    eq((await rows(gUser)).map((x) => `${x.channel}:${x.status}`), ["in_app:sent", "sms:queued"], "guardian rows");
    eq((await rows(p.userId)).map((x) => `${x.channel}:${x.status}`), ["in_app:sent", "sms:queued"], "student rows");
  });

  test("lead days are validated", async () => {
    await fails("invalid_input", () => svc.runDueSoonJob({ leadDays: -1 }));
    await fails("invalid_input", () => svc.runDueSoonJob({ leadDays: 1.5 }));
  });
});

describe("dispatcher", () => {
  async function queued(p: { userId: string; studentId: string }, due: string) {
    // Earlier tests' invoices would be re-queued on channels switched on since; keep each test to its own student.
    await q(`UPDATE invoice SET status = 'cancelled' WHERE student_id <> $1 AND status <> 'cancelled'`, [p.studentId]);
    await invoiceFor(p.studentId, due, 2500);
    await svc.runDueSoonJob();
  }
  const drain = async () => {
    await q(`DELETE FROM notification WHERE channel <> 'in_app' AND status IN ('queued','failed')`);
  };

  test("sends queued SMS with the rendered template and marks the row sent", async () => {
    await drain();
    await setModules({ sms: true, email: true });
    await setChannel("sms", true);
    await setChannel("email", true);
    await q(`INSERT INTO notification_template (organization_id, event, channel, subject, body) VALUES ($1,'installment_due','sms',NULL,'{{student_name}}: pay {{amountDue}} by {{dueDate}}')`, [org]);
    const p = await person({ phone: "077 111 2222" });
    await queued(p, "2027-03-12");
    const r = await svc.dispatchQueued();
    eq(r, { attempted: 2, sent: 2, failed: 0, skipped: 0 }, "result");
    eq(sent.sms.length, 1, "one sms");
    eq(sent.sms[0]!.to, "94771112222", "normalised number");
    eq(sent.sms[0]!.body.includes("pay 2500"), true, "rendered body");
    eq(sent.email.at(-1)!.to.endsWith("@example.com"), true, "email sent");
    const [row] = await q(`SELECT status, sent_at, error FROM notification WHERE user_id = $1 AND channel = 'sms'`, [p.userId]);
    eq([row!.status, row!.sent_at !== null, row!.error], ["sent", true, null], "row");
    eq((await svc.dispatchQueued()).attempted, 0, "nothing left");
  });

  test("a row that cannot be delivered fails with a reason, and other rows still go out", async () => {
    await drain();
    const noPhone = await person({ phone: null });
    const badPhone = await person({ phone: "12345" });
    const good = await person({ phone: "0712223333" });
    for (const p of [noPhone, badPhone, good]) await queued(p, "2027-03-12");
    const r = await svc.dispatchQueued();
    eq([r.attempted, r.sent, r.failed], [6, 4, 2], "result");
    const err = (u: string) => q(`SELECT status, error, sent_at FROM notification WHERE user_id = $1 AND channel = 'sms'`, [u]);
    eq((await err(noPhone.userId))[0]!.error, "no phone number", "no phone");
    eq((await err(badPhone.userId))[0]!.error, "invalid phone number", "bad phone");
    eq((await err(good.userId))[0]!.status, "sent", "good");
  });

  test("a provider error is stored on the row, and retryFailed queues it again", async () => {
    await drain();
    const p = await person({ phone: "0714445555" });
    await queued(p, "2027-03-11");
    smsFails = true;
    const r1 = await svc.dispatchQueued();
    eq([r1.sent, r1.failed], [1, 1], "email sent, sms failed");
    const [row] = await q(`SELECT status, error FROM notification WHERE user_id = $1 AND channel = 'sms'`, [p.userId]);
    eq([row!.status, row!.error], ["failed", "gateway down"], "stored error");
    eq((await svc.dispatchQueued()).attempted, 0, "failed rows are not retried by themselves");
    smsFails = false;
    await q(`UPDATE notification SET status = 'failed', error = 'x' WHERE status = 'queued'`);
    const back = await svc.retryFailed({ event: "installment_due" });
    eq(back >= 1, true, "re-queued");
    const r2 = await svc.dispatchQueued();
    eq(r2.failed, 0, "no failures now");
    eq((await q(`SELECT status FROM notification WHERE user_id = $1 AND channel = 'sms'`, [p.userId]))[0]!.status, "sent", "sent on retry");
  });

  test("a channel switched off after queueing is not attempted (J1)", async () => {
    await drain();
    const p = await person({ phone: "0716667777" });
    await queued(p, "2027-03-11");
    await setChannel("sms", false);
    const before = sent.sms.length;
    await svc.dispatchQueued();
    eq(sent.sms.length, before, "no sms sent");
    const [row] = await q(`SELECT status, error FROM notification WHERE user_id = $1 AND channel = 'sms'`, [p.userId]);
    eq([row!.status, row!.error], ["failed", "channel disabled"], "row");
    await setChannel("sms", true);
  });

  test("push goes to every subscription, and fails when there is none or all fail", async () => {
    await drain();
    await setModules({ web_push: true });
    await setChannel("push", true);
    const withSubs = await person();
    await q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1,'https://push/a','k1','a1'), ($1,'https://push/b','k2','a2')`, [withSubs.userId]);
    const without = await person();
    await queued(withSubs, "2027-03-11");
    await queued(without, "2027-03-11");
    const before = sent.push.length;
    const r = await svc.dispatchQueued();
    eq([r.sent, r.failed], [1, 1], "result");
    eq(sent.push.length - before, 2, "two pushes");
    eq((await q(`SELECT error FROM notification WHERE user_id = $1 AND channel = 'push'`, [without.userId]))[0]!.error, "no push subscription", "none");
  });

  test("a missing provider fails the row with a clear reason", async () => {
    await drain();
    await setModules({ email: true });
    await setChannel("email", true);
    const bare = createNotificationService(db, { now });
    const p = await person();
    await queued(p, "2027-03-11");
    const r = await bare.dispatchQueued();
    eq(r.failed >= 1, true, "failed");
    eq((await q(`SELECT error FROM notification WHERE user_id = $1 AND channel = 'email'`, [p.userId]))[0]!.error, "no email provider configured", "reason");
  });

  test("an inactive user is not sent to", async () => {
    await drain();
    const p = await person();
    await queued(p, "2027-03-11");
    await q(`UPDATE "user" SET status = 'disabled' WHERE id = $1`, [p.userId]);
    await svc.dispatchQueued();
    eq((await q(`SELECT error FROM notification WHERE user_id = $1 AND channel = 'email'`, [p.userId]))[0]!.error, "user inactive", "reason");
  });

  test("limit is validated and respected", async () => {
    await fails("invalid_input", () => svc.dispatchQueued({ limit: 0 }));
    await drain();
    await setModules({ email: true });
    for (let i = 0; i < 3; i++) await queued(await person(), "2027-03-11");
    const r = await svc.dispatchQueued({ limit: 2 });
    eq(r.attempted, 2, "two attempted");
    eq((await q(`SELECT count(*)::int AS c FROM notification WHERE status = 'queued' AND channel <> 'in_app'`))[0]!.c, 1, "one left");
  });
});

describe("in-app inbox", () => {
  test("lists newest first, filters unread, and only the owner can mark read", async () => {
    await setModules({});
    const p = await person();
    const other = await person();
    await invoiceFor(p.studentId, "2027-03-11", 1000);
    await invoiceFor(p.studentId, "2027-03-12", 2000);
    await svc.runDueSoonJob();
    const list = await svc.listInApp({ userId: p.userId });
    eq(list.length, 2, "two");
    eq(list[0]!.message.body.includes("due on"), true, "message");
    eq(await svc.markRead({ userId: other.userId, ids: [list[0]!.id] }), 0, "not the owner");
    eq(await svc.markRead({ userId: p.userId, ids: [list[0]!.id] }), 1, "owner");
    eq(await svc.markRead({ userId: p.userId, ids: [list[0]!.id] }), 0, "already read");
    eq((await svc.listInApp({ userId: p.userId, unreadOnly: true })).map((x) => x.id), [list[1]!.id], "unread");
  });
});
