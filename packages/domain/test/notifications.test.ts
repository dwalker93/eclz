/**
 * Notification queue, dispatcher and "due soon" reminders (J1, J2).
 */
import { afterAll, describe, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@workspace/db/schema";
import {
  composeMessage,
  createNotificationService,
  createTextLkSms,
  normalizeSriLankaPhone,
  renderTemplate,
  ProviderOutcomeUnknown,
  type EmailMessage,
  type PushMessage,
  type SmsMessage,
} from "../src";
import { eq, fails } from "./helpers";
import { createScenarioDb } from "./setup";

const { pg, db, q, id, close } = await createScenarioDb({ dateOnly: true });
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
  test("text.lk: a normal response still succeeds with the deadline signal attached", async () => {
    let signal: AbortSignal | null | undefined;
    const ok = createTextLkSms({
      apiToken: "t",
      senderId: "I",
      fetch: (async (_u: string, init: RequestInit) => {
        signal = init.signal;
        return new Response(JSON.stringify({ status: "success" }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await ok({ to: "1", body: "x" });
    eq(signal instanceof AbortSignal, true, "signal passed");
    eq(signal!.aborted, false, "not aborted by a prompt answer");
  });
  test("text.lk: a failure while reading the answer is an unknown outcome, an unreadable success answer is too, and a plain refusal stays an ordinary failure", async () => {
    const sms = (mk: () => Response) => createTextLkSms({ apiToken: "t", senderId: "I", fetch: (async () => mk()) as unknown as typeof fetch });
    const broken = () =>
      new Response(new ReadableStream({ start: (c) => c.error(new TypeError("terminated")) }), { status: 200 });
    const caught = async (send: () => Promise<void>) => send().then(() => null, (e: Error) => e);
    const cut = await caught(() => sms(broken)({ to: "1", body: "x" }));
    eq([cut instanceof ProviderOutcomeUnknown, /answer could not be read \(HTTP 200\)/.test(cut?.message ?? "")], [true, true], "body read failure after HTTP 200");
    const cutError = await caught(() => sms(() => new Response(new ReadableStream({ start: (c) => c.error(new TypeError("terminated")) }), { status: 502 }))({ to: "1", body: "x" }));
    eq(cutError instanceof ProviderOutcomeUnknown, true, "the answer could not be read, whatever the status: the request had reached the provider");
    const garbage = await caught(() => sms(() => new Response("<html>ok</html>", { status: 200 }))({ to: "1", body: "x" }));
    eq(garbage instanceof ProviderOutcomeUnknown, true, "a 200 whose body is not JSON");
    const refused = await caught(() => sms(() => new Response(JSON.stringify({ status: "error", message: "Invalid token" }), { status: 401 }))({ to: "1", body: "x" }));
    eq([refused instanceof ProviderOutcomeUnknown, refused?.message], [false, "text.lk: Invalid token"], "explicit refusal");
    const gateway = await caught(() => sms(() => new Response("Bad gateway", { status: 502 }))({ to: "1", body: "x" }));
    eq([gateway instanceof ProviderOutcomeUnknown, gateway?.message], [false, "text.lk: HTTP 502"], "an HTTP error with a non-JSON body");
    const declined = await caught(() => sms(() => new Response(JSON.stringify({ status: "error", message: "No balance" }), { status: 200 }))({ to: "1", body: "x" }));
    eq([declined instanceof ProviderOutcomeUnknown, declined?.message], [false, "text.lk: No balance"], "a 200 that says error");
  });
  test("text.lk: a request that never answers is aborted when the deadline expires, and the failure is a timeout (an unknown outcome)", async () => {
    let aborted = false;
    const hang = createTextLkSms({
      apiToken: "t",
      senderId: "I",
      timeoutMs: 30,
      // waits until the signal aborts, like a real fetch: a signal that never fires leaves it pending
      fetch: ((_u: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => {
            aborted = true;
            reject(init.signal!.reason);
          });
        })) as unknown as typeof fetch,
    });
    const outcome = await Promise.race([
      hang({ to: "1", body: "x" }).then(() => "resolved", (e: Error) => e.name),
      new Promise<string>((r) => setTimeout(() => r("still pending after 1s"), 1000)),
    ]);
    eq(outcome, "TimeoutError", "rejects with the abort reason");
    eq(aborted, true, "the request was aborted");
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
    await q(`DELETE FROM notification WHERE channel <> 'in_app' AND status IN ('queued','sending','failed','unconfirmed')`);
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
    eq(r, { attempted: 2, sent: 2, failed: 0, unconfirmed: 0, lost: 0, expired: 0 }, "result");
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

  const statusOf = async (userId: string, channel = "email") => {
    const r = (await q(`SELECT id, status, error FROM notification WHERE user_id = $1 AND channel = $2`, [userId, channel]))[0]!;
    return { id: String(r.id), status: String(r.status), error: r.error as string | null };
  };

  test("a provider that never answers does not hold the lock, and the row is unconfirmed, not failed: retryFailed leaves it alone", async () => {
    await drain();
    await setModules({ email: true });
    await setChannel("email", true);
    const slow = createNotificationService(db, { now, providerTimeoutMs: 30, providers: { email: () => new Promise<void>(() => {}) } });
    const p = await person();
    await queued(p, "2027-03-11");
    const r = await slow.dispatchQueued();
    eq([r.failed, r.unconfirmed], [0, 1], "counted as unconfirmed");
    const row = await statusOf(p.userId);
    eq(row.status, "unconfirmed", "status");
    eq(String(row.error).startsWith("provider did not answer"), true, "reason");
    eq(await slow.retryFailed(), 0, "retryFailed does not requeue it");
    eq((await statusOf(p.userId)).status, "unconfirmed", "still unconfirmed");
    eq((await slow.dispatchQueued()).attempted, 0, "dispatch does not pick it up");
  });

  test("a provider that answers after the deadline cannot be sent to twice through retryFailed", async () => {
    await drain();
    await setModules({ email: true });
    await setChannel("email", true);
    const delivered: string[] = [];
    const late = createNotificationService(db, {
      now,
      providerTimeoutMs: 20,
      providers: { email: async (m) => { await new Promise((r) => setTimeout(r, 80)); delivered.push(m.to); } },
    });
    const p = await person();
    await queued(p, "2027-03-11");
    await late.dispatchQueued();
    await new Promise((r) => setTimeout(r, 120));
    eq(delivered.length, 1, "the provider did accept it after the deadline");
    eq(await late.retryFailed(), 0, "and no retry path re-sends it");
    await late.dispatchQueued();
    eq(delivered.length, 1, "still one delivery");
  });

  test("a refusal is still a confirmed failure that retryFailed re-sends", async () => {
    await drain();
    await setModules({ email: true });
    await setChannel("email", true);
    let refuse = true;
    const svc2 = createNotificationService(db, { now, providers: { email: async () => { if (refuse) throw new Error("550 mailbox unavailable"); } } });
    const p = await person();
    await queued(p, "2027-03-11");
    eq((await svc2.dispatchQueued()).failed, 1, "failed");
    eq((await statusOf(p.userId)).status, "failed", "status");
    refuse = false;
    eq(await svc2.retryFailed(), 1, "requeued");
    eq((await svc2.dispatchQueued()).sent, 1, "sent");
  });

  test("retryUnconfirmed re-sends only for a provider declared idempotent, with the same key; otherwise an operator resolves the row", async () => {
    await drain();
    await setModules({ email: true });
    await setChannel("email", true);
    const keys: string[] = [];
    let hang = true;
    const providers = { email: async (_m: EmailMessage, ctx: { idempotencyKey: string }) => { keys.push(ctx.idempotencyKey); if (hang) await new Promise(() => {}); } };
    const plain = createNotificationService(db, { now, providerTimeoutMs: 20, providers });
    const p = await person();
    await queued(p, "2027-03-11");
    await plain.dispatchQueued();
    const row = await statusOf(p.userId);
    eq(row.status, "unconfirmed", "unconfirmed");
    eq(await plain.retryUnconfirmed(), 0, "not declared idempotent: nothing is requeued");
    eq((await statusOf(p.userId)).status, "unconfirmed", "still waiting for an operator");

    hang = false;
    const idem = createNotificationService(db, { now, providerTimeoutMs: 20, providers: { ...providers, idempotent: { email: true } } });
    eq(await idem.retryUnconfirmed(), 1, "declared idempotent: requeued");
    eq((await idem.dispatchQueued()).sent, 1, "sent");
    eq(keys, [row.id, row.id], "the same key both times");
  });

  test("resolveUnconfirmed records the operator's answer and works only on an unconfirmed row", async () => {
    await drain();
    await setModules({ email: true });
    await setChannel("email", true);
    const slow = createNotificationService(db, { now, providerTimeoutMs: 20, providers: { email: () => new Promise<void>(() => {}) } });
    const a = await person();
    const b = await person();
    await queued(a, "2027-03-11");
    await queued(b, "2027-03-11");
    await slow.dispatchQueued();
    const rowA = await statusOf(a.userId);
    const rowB = await statusOf(b.userId);
    await slow.resolveUnconfirmed({ id: rowA.id, outcome: "sent" });
    const doneA = (await q(`SELECT status, sent_at, error FROM notification WHERE id = $1`, [rowA.id]))[0]!;
    eq([doneA.status, doneA.sent_at !== null, doneA.error], ["sent", true, null], "delivered");
    await slow.resolveUnconfirmed({ id: rowB.id, outcome: "not_delivered" });
    eq((await statusOf(b.userId)).status, "failed", "not delivered becomes failed");
    eq(await slow.retryFailed(), 1, "and retryFailed may now send it");
    await fails("not_found", () => slow.resolveUnconfirmed({ id: rowA.id, outcome: "not_delivered" }));
  });

  test("push: a device that got it makes it sent; only timeouts leave it unconfirmed", async () => {
    await drain();
    await setModules({ web_push: true });
    await setChannel("push", true);
    const mk = async () => {
      const p = await person();
      // endpoints are unique, so each person's devices get their own; "a" ends the first device's endpoint, "b" the second
      await q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1,$2,'k1','a1'), ($1,$3,'k2','a2')`, [p.userId, `https://push/${p.userId}/a`, `https://push/${p.userId}/b`]);
      await queued(p, "2027-03-11");
      return p;
    };
    const mixed = await mk();
    const svcMixed = createNotificationService(db, { now, providerTimeoutMs: 20, providers: { push: async (m) => { if (m.subscription.endpoint.endsWith("a")) await new Promise(() => {}); } } });
    await svcMixed.dispatchQueued();
    eq((await statusOf(mixed.userId, "push")).status, "sent", "one device delivered");
    await drain();
    const hung = await mk();
    const svcHung = createNotificationService(db, { now, providerTimeoutMs: 20, providers: { push: async (m) => { if (m.subscription.endpoint.endsWith("a")) await new Promise(() => {}); throw new Error("410 gone"); } } });
    await svcHung.dispatchQueued();
    eq((await statusOf(hung.userId, "push")).status, "unconfirmed", "a timed-out device may still receive it");
    await drain();
    const refused = await mk();
    const svcRefused = createNotificationService(db, { now, providers: { push: async () => { throw new Error("410 gone"); } } });
    await svcRefused.dispatchQueued();
    eq((await statusOf(refused.userId, "push")).status, "failed", "all refused is a confirmed failure");
  });

  describe("claim and lease", () => {
    const row = async (userId: string, channel = "email") => (await q(`SELECT status, to_char(claimed_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS claimed_until, error, sent_at FROM notification WHERE user_id = $1 AND channel = $2`, [userId, channel]))[0]!;

    test("the row is `sending` with a lease while the provider is called, and the call runs outside any transaction", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const p = await person();
      await queued(p, "2027-03-11");
      let seen: Record<string, unknown> | undefined;
      // A query made from inside the provider call waits for any open transaction on the connection, so a send inside one would hang here.
      const probe = createNotificationService(db, { now, providers: { email: async () => void (seen = await row(p.userId)) } });
      const r = await probe.dispatchQueued();
      eq(r.sent, 1, "sent");
      eq(seen!.status, "sending", "claimed while sending");
      eq(seen!.claimed_until, "2027-03-10T10:01:00", "a 60 second lease");
      const done = await row(p.userId);
      eq([done.status, done.claimed_until, done.error, done.sent_at !== null], ["sent", null, null, true], "finished row has no lease");
    });

    test("each row is claimed when its own send starts, not when the run started", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const a = await person();
      const b = await person();
      await queued(a, "2027-03-11");
      await queued(b, "2027-03-11");
      let clock = new Date("2027-03-10T10:00:00Z");
      const leases: string[] = [];
      const timed = createNotificationService(db, {
        now: () => clock,
        providers: {
          email: async () => {
            leases.push(String((await q(`SELECT to_char(claimed_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS c FROM notification WHERE status = 'sending'`))[0]!.c));
            clock = new Date(clock.getTime() + 10_000);
          },
        },
      });
      eq((await timed.dispatchQueued()).sent, 2, "both sent");
      eq(leases, ["2027-03-10T10:01:00", "2027-03-10T10:01:10"], "second lease starts ten seconds later");
    });

    test("with a time budget, no row is claimed once a send could end after it; the rest stay queued", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const people = [await person(), await person(), await person(), await person()];
      for (const p of people) await queued(p, "2027-03-11");
      let clock = new Date("2027-03-10T10:00:00Z");
      let sends = 0;
      // Provider timeout 15 s + 3 s settle = 18 s kept back: with a 45 s budget a row may be claimed up to 27 s in. Each send takes 10 s: starts at 0, 10, 20; 30 is too late.
      const timed = createNotificationService(db, {
        now: () => clock,
        providers: { email: async () => void (sends++, (clock = new Date(clock.getTime() + 10_000))) },
      });
      const r = await timed.dispatchQueued({ budgetMs: 45_000 });
      eq([r.attempted, r.sent, sends], [3, 3, 3], "three sends fit");
      const left = await q(`SELECT count(*)::int AS n FROM notification WHERE status = 'queued' AND channel = 'email' AND user_id = ANY($1)`, [people.map((p) => p.userId)]);
      eq(left[0]!.n, 1, "one row still queued, not marked anything");
      eq((await timed.dispatchQueued()).attempted, 1, "without a budget the next run takes it");
    });

    test("with a time budget, a row's remaining push devices are not tried once another call could end after it", async () => {
      await drain();
      await setModules({ web_push: true });
      await setChannel("push", true);
      const p = await person();
      await q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1,$2,'k','a'), ($1,$3,'k','a'), ($1,$4,'k','a')`, [p.userId, `https://push/${p.userId}/1`, `https://push/${p.userId}/2`, `https://push/${p.userId}/3`]);
      await queued(p, "2027-03-11");
      let clock = new Date("2027-03-10T10:00:00Z");
      const tried: string[] = [];
      const timed = createNotificationService(db, {
        now: () => clock,
        providers: { push: async (m) => void (tried.push(m.subscription.endpoint.slice(-1)), (clock = new Date(clock.getTime() + 10_000))) },
      });
      // 35 s budget, 18 s kept back per call: the first device at 0 s, the second at 10 s (10 + 18 <= 35), a third at 20 s would end past it (20 + 18 > 35).
      await timed.dispatchQueued({ budgetMs: 35_000 });
      eq(tried.length, 2, "only two of the three devices are tried (their order is by id)");
      eq((await row(p.userId, "push")).status, "sent", "the devices that got it make it sent");
    });

    test("a budget must be a positive number", async () => {
      for (const budgetMs of [0, -5, Number.NaN]) {
        const e = await svc.dispatchQueued({ budgetMs }).catch((x: unknown) => x);
        eq((e as { code?: string }).code, "invalid_input", `budget ${budgetMs}`);
      }
    });

    test("a row left `sending` past its lease becomes unconfirmed, is not sent again, and one with a live lease is left alone", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const stale = await person();
      const live = await person();
      await queued(stale, "2027-03-11");
      await queued(live, "2027-03-11");
      await q(`UPDATE notification SET status = 'sending', claimed_until = '2027-03-10T09:59:59Z' WHERE user_id = $1 AND channel = 'email'`, [stale.userId]);
      await q(`UPDATE notification SET status = 'sending', claimed_until = '2027-03-10T10:00:30Z' WHERE user_id = $1 AND channel = 'email'`, [live.userId]);
      const before = sent.email.length;
      const r = await svc.dispatchQueued();
      eq([r.expired, r.attempted], [1, 0], "one expired, nothing sent");
      eq(sent.email.length, before, "the provider was not called");
      const s1 = await row(stale.userId);
      eq([s1.status, s1.claimed_until, String(s1.error).startsWith("dispatcher stopped")], ["unconfirmed", null, true], "stale row");
      eq((await row(live.userId)).status, "sending", "live lease untouched");
      eq(await svc.retryFailed(), 0, "retryFailed does not requeue it");
      eq((await svc.dispatchQueued()).expired, 0, "nothing more to expire");
      await svc.resolveUnconfirmed({ id: String((await q(`SELECT id FROM notification WHERE user_id = $1 AND channel = 'email'`, [stale.userId]))[0]!.id), outcome: "sent" });
      eq((await row(stale.userId)).status, "sent", "an operator can still settle it");
    });

    test("a result is recorded only while the row is still `sending`: a run whose lease was taken over does not overwrite it", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const p = await person();
      await queued(p, "2027-03-11");
      const swept = createNotificationService(db, {
        now,
        providers: {
          email: async () => {
            await q(`UPDATE notification SET status = 'unconfirmed', claimed_until = NULL, error = 'dispatcher stopped before the provider answered' WHERE user_id = $1 AND channel = 'email'`, [p.userId]);
          },
        },
      });
      const r = await swept.dispatchQueued();
      eq([r.sent, r.failed, r.unconfirmed, r.lost], [0, 0, 0, 1], "counted as lost");
      eq((await row(p.userId)).status, "unconfirmed", "the other run's state stands");
    });

    test("the completion update must match this run's own claim: a row reclaimed with a new lease is not overwritten by the older run", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const p = await person();
      await queued(p, "2027-03-11");
      const stale = createNotificationService(db, {
        now,
        providers: {
          email: async () => {
            // another run took the row over: still `sending`, but under a lease of its own
            await q(`UPDATE notification SET claimed_until = '2027-03-10T10:05:00Z' WHERE user_id = $1 AND channel = 'email'`, [p.userId]);
          },
        },
      });
      const r = await stale.dispatchQueued();
      eq([r.sent, r.failed, r.unconfirmed, r.lost], [0, 0, 0, 1], "counted as lost");
      const after = await row(p.userId);
      eq([after.status, after.claimed_until], ["sending", "2027-03-10T10:05:00"], "the newer claim's row is untouched");
    });

    test("email and sms calls are skipped when the lease could end before they finish, like push devices", async () => {
      await drain();
      await setModules({ email: true, sms: true });
      await setChannel("email", true);
      await setChannel("sms", true);
      const p = await person({ phone: "077 555 0101" });
      await queued(p, "2027-03-11");
      let clock = new Date("2027-03-10T10:00:00Z");
      const calls: string[] = [];
      // The user lookup runs after the claim and before the provider call; time passes there, so the lease is nearly over when the call would start.
      const logged = drizzle(pg, { schema, logger: { logQuery: (t: string) => { if (/from "user" where/.test(t)) clock = new Date(clock.getTime() + 59_000); } } }) as unknown as typeof db;
      const late = createNotificationService(logged, {
        now: () => clock,
        providerTimeoutMs: 5_000,
        providers: { email: async () => void calls.push("email"), sms: async () => void calls.push("sms") },
      });
      const r = await late.dispatchQueued();
      eq(calls, [], "no provider was called");
      eq([r.attempted, r.sent, r.failed, r.unconfirmed], [2, 0, 2, 0], "both rows are failed (not sent), so retryFailed may send them");
      const errs = (await q(`SELECT error FROM notification WHERE user_id = $1 AND channel IN ('email','sms') ORDER BY channel`, [p.userId])).map((x) => String(x.error));
      eq(errs.every((e) => /lease nearly over/.test(e)), true, "reason recorded");
    });

    test("a row that fails or times out also loses its lease", async () => {
      await drain();
      await setModules({ email: true });
      await setChannel("email", true);
      const f = await person();
      const t = await person();
      await queued(f, "2027-03-11");
      await queued(t, "2027-03-11");
      let call = 0;
      const mixed = createNotificationService(db, {
        now,
        providerTimeoutMs: 20,
        providers: { email: () => (++call === 1 ? Promise.reject(new Error("refused")) : new Promise<void>(() => {})) },
      });
      const r = await mixed.dispatchQueued();
      eq([r.failed, r.unconfirmed], [1, 1], "one each");
      eq((await q(`SELECT count(*)::int AS c FROM notification WHERE claimed_until IS NOT NULL`))[0]!.c, 0, "no lease left behind");
    });

    test("push stops trying devices when another call could outlast the lease; untried devices are not an unknown outcome", async () => {
      await drain();
      await setModules({ web_push: true });
      await setChannel("push", true);
      const p = await person();
      await q(`INSERT INTO push_subscription (user_id, endpoint, p256dh_key, auth_key) VALUES ($1,$2,'k1','a1'), ($1,$3,'k2','a2'), ($1,$4,'k3','a3')`, [p.userId, `https://push/${p.userId}/1`, `https://push/${p.userId}/2`, `https://push/${p.userId}/3`]);
      await queued(p, "2027-03-11");
      let clock = new Date("2027-03-10T10:00:00Z");
      let calls = 0;
      const slowRefusals = createNotificationService(db, {
        now: () => clock,
        providerTimeoutMs: 15_000,
        leaseMs: 60_000,
        providers: {
          push: async () => {
            calls++;
            clock = new Date(clock.getTime() + 40_000);
            throw new Error("refused");
          },
        },
      });
      const r = await slowRefusals.dispatchQueued();
      eq(calls, 2, "the third device is not tried: 80s in, a 15s call could end after the 60s lease");
      eq([r.failed, r.unconfirmed], [1, 0], "failed, not unconfirmed");
    });
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
    eq((await svc.listInApp({ userId: p.userId, limit: 1 })).map((x) => x.id), [list[0]!.id], "limit applied, newest first");
    eq((await svc.listInApp({ userId: p.userId, unreadOnly: true, limit: 1 })).map((x) => x.id), [list[1]!.id], "limit after unread filter");
    await fails("invalid_input", () => svc.listInApp({ userId: p.userId, limit: -1 }));
    await fails("invalid_input", () => svc.listInApp({ userId: p.userId, limit: 0 }));
    await fails("invalid_input", () => svc.listInApp({ userId: p.userId, limit: 1.5 }));
  });
});
