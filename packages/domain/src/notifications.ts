import { and, asc, desc, eq, inArray, isNull, lte, ne } from "drizzle-orm";
import {
  guardian,
  invoice,
  invoiceInstallment,
  NOTIFICATION_EVENTS,
  notification,
  notificationChannel,
  notificationTemplate,
  pushSubscription,
  student,
  studentGuardian,
  user,
} from "@workspace/db/schema";
import { fromCents, toCents } from "@workspace/db/money";
import { addDays } from "./dates";
import { loadOrganization, todayFor } from "./lookups";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

type OrgRow = Awaited<ReturnType<typeof loadOrganization>>;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

const EXTERNAL: { channel: "email" | "sms" | "push"; module: "email" | "sms" | "web_push" }[] = [
  { channel: "email", module: "email" },
  { channel: "sms", module: "sms" },
  { channel: "push", module: "web_push" },
];

const moduleOn = (org: OrgRow, name: string) => ((org.enabledModules ?? {}) as Record<string, boolean | undefined>)[name] === true;

// ---- queueing (J1, J2)

/** The student's own user plus guardians with portal access (only when the parent portal module is on). Sorted, so runs are repeatable. */
export async function resolveRecipients(tx: Tx, org: OrgRow, studentId: string): Promise<{ userIds: string[]; studentName: string | null }> {
  const [stu] = await tx.select().from(student).where(eq(student.id, studentId));
  const ids = new Set<string>();
  if (stu?.userId) ids.add(stu.userId);
  if (moduleOn(org, "parent_portal")) {
    const guardians = await tx
      .select({ userId: guardian.userId })
      .from(studentGuardian)
      .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
      .where(and(eq(studentGuardian.studentId, studentId), eq(guardian.portalEnabled, true)));
    for (const g of guardians) if (g.userId) ids.add(g.userId);
  }
  return { userIds: [...ids].sort(), studentName: stu?.fullName ?? null };
}

/** Guardians with portal access only (when the parent portal module is on). For events meant for parents, not for the student. */
export async function resolveGuardianRecipients(tx: Tx, org: OrgRow, studentId: string): Promise<{ userIds: string[]; studentName: string | null }> {
  const [stu] = await tx.select().from(student).where(eq(student.id, studentId));
  if (!moduleOn(org, "parent_portal")) return { userIds: [], studentName: stu?.fullName ?? null };
  const guardians = await tx
    .select({ userId: guardian.userId })
    .from(studentGuardian)
    .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
    .where(and(eq(studentGuardian.studentId, studentId), eq(guardian.portalEnabled, true)));
  return { userIds: [...new Set(guardians.flatMap((g) => (g.userId ? [g.userId] : [])))].sort(), studentName: stu?.fullName ?? null };
}

/** J1: in-app always, plus each external channel whose module flag and channel switch are both on. */
export async function activeChannels(tx: Tx | Db, org: OrgRow): Promise<string[]> {
  const channels: string[] = ["in_app"];
  const enabled = await tx
    .select()
    .from(notificationChannel)
    .where(and(eq(notificationChannel.organizationId, org.id), eq(notificationChannel.isEnabled, true)));
  for (const ext of EXTERNAL) {
    if (moduleOn(org, ext.module) && enabled.some((c) => c.channel === ext.channel)) channels.push(ext.channel);
  }
  return channels;
}

export interface QueueItem {
  /** Identifies the thing that caused it, so retrying the enqueue does not create a second row (J2). It does not make delivery exactly once. */
  eventKey: string;
  payload: Record<string, unknown>;
}

/**
 * J1, J2: one notification per recipient, channel and item. In-app rows are created as sent (the row is the message),
 * external rows as queued for the dispatcher. Returns how many rows were created.
 */
export async function queueNotifications(
  tx: Tx,
  org: OrgRow,
  input: { event: NotificationEvent; userIds: string[]; items: QueueItem[]; at: Date },
): Promise<number> {
  if (input.userIds.length === 0 || input.items.length === 0) return 0;
  const channels = await activeChannels(tx, org);
  const templates = await tx
    .select()
    .from(notificationTemplate)
    .where(and(eq(notificationTemplate.organizationId, org.id), eq(notificationTemplate.event, input.event)));
  let created = 0;
  for (const userId of [...input.userIds].sort()) {
    for (const channel of channels) {
      for (const item of input.items) {
        const rows = await tx
          .insert(notification)
          .values({
            userId,
            templateId: templates.find((t) => t.channel === channel)?.id ?? null,
            channel,
            event: input.event,
            eventKey: item.eventKey,
            payload: item.payload,
            status: channel === "in_app" ? "sent" : "queued",
            sentAt: channel === "in_app" ? input.at : null,
          })
          .onConflictDoNothing()
          .returning({ id: notification.id });
        created += rows.length;
      }
    }
  }
  return created;
}

// ---- rendering

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Fills {{placeholders}} from the payload. `{{student_name}}` and `{{studentName}}` both read `studentName`. A missing value becomes empty text. */
export function renderTemplate(text: string, payload: Record<string, unknown> | null | undefined): string {
  const data = payload ?? {};
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = data[key] ?? data[camel(key)];
    return v === undefined || v === null ? "" : String(v);
  });
}

const DEFAULT_TEXT: Partial<Record<NotificationEvent, { subject: string; body: string }>> = {
  installment_due: {
    subject: "Payment due soon",
    body: "Payment of {{amountDue}} for {{studentName}} is due on {{dueDate}}.",
  },
  attendance_marked: {
    subject: "Absent from class",
    body: "{{studentName}} was marked absent from {{courseName}} on {{sessionDate}}.",
  },
  exam_published: {
    subject: "New exam",
    body: "{{examTitle}} is open from {{opensAt}} to {{closesAt}}.",
  },
  installment_overdue: {
    subject: "Payment overdue",
    body: "Payment of {{amountDue}} for {{studentName}} was due on {{dueDate}} and is overdue.",
  },
};

export function composeMessage(
  event: string,
  payload: Record<string, unknown> | null,
  template?: { subject: string | null; body: string } | null,
): { subject: string; body: string } {
  const fallback = DEFAULT_TEXT[event as NotificationEvent] ?? { subject: "Notification", body: "You have a new notification." };
  return {
    subject: renderTemplate(template?.subject ?? fallback.subject, payload),
    body: renderTemplate(template?.body ?? fallback.body, payload),
  };
}

// ---- providers

export interface EmailMessage { to: string; subject: string; body: string }
export interface SmsMessage { to: string; body: string }
export interface PushMessage { subscription: { endpoint: string; p256dhKey: string; authKey: string }; title: string; body: string }

/** Passed to every send. The key is the notification's id: stable across retries of the same row, so a provider that supports one can refuse a duplicate. */
export interface SendContext { idempotencyKey: string }

/**
 * Each sender throws on failure; the message becomes the notification's error. A missing provider fails its rows with a clear reason.
 * A sender throws `ProviderOutcomeUnknown` when it cannot tell whether the provider accepted the message (a timeout, a connection cut after the request went
 * out); any other error means the provider refused it or never got it.
 * `idempotent` names the channels whose sender passes `ctx.idempotencyKey` to a provider that refuses a second message with the same key. Only those
 * channels may re-send an `unconfirmed` row (`retryUnconfirmed`); none is assumed.
 */
export interface Providers {
  email?: (m: EmailMessage, ctx: SendContext) => Promise<void>;
  sms?: (m: SmsMessage, ctx: SendContext) => Promise<void>;
  push?: (m: PushMessage, ctx: SendContext) => Promise<void>;
  idempotent?: { email?: boolean; sms?: boolean; push?: boolean };
}

/** The send may or may not have reached the recipient: the row becomes `unconfirmed`, not `failed`, because sending it again could duplicate it. */
export class ProviderOutcomeUnknown extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderOutcomeUnknown";
  }
}
const isUnknownOutcome = (e: unknown) => e instanceof ProviderOutcomeUnknown || (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"));

/** Sri Lankan numbers as text.lk wants them: country code, no plus or spaces. 0771234567 becomes 94771234567. */
export function normalizeSriLankaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  let out: string;
  if (/^94\d{9}$/.test(digits)) out = digits;
  else if (/^0\d{9}$/.test(digits)) out = `94${digits.slice(1)}`;
  else if (/^\d{9}$/.test(digits)) out = `94${digits}`;
  else return null;
  return out;
}

/** How long one provider call may take before the row is failed. The call runs inside the row-locked transaction, so it must be bounded. */
export const PROVIDER_TIMEOUT_MS = 15_000;

/** text.lk v3 plain SMS (POST app.text.lk/api/v3/sms/send, bearer token). `fetch` is injectable for tests. */
export function createTextLkSms(opts: { apiToken: string; senderId: string; fetch?: typeof fetch; timeoutMs?: number }): (m: SmsMessage, ctx?: SendContext) => Promise<void> {
  const doFetch = opts.fetch ?? fetch;
  return async ({ to, body }) => {
    const res = await doFetch("https://app.text.lk/api/v3/sms/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ recipient: to, sender_id: opts.senderId, type: "plain", message: body }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? PROVIDER_TIMEOUT_MS),
    });
    // The request reached text.lk, so a failure while reading the answer does not say whether the message was accepted: it is an unknown outcome (the row
    // becomes `unconfirmed`), not a failure, and it is worded apart from a refusal. A timeout or abort while reading is already recognised as such.
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      if (isUnknownOutcome(e)) throw e;
      throw new ProviderOutcomeUnknown(`text.lk: the answer could not be read (HTTP ${res.status}): ${shortError(e)}`);
    }
    let json: { status?: string; message?: string } | null = null;
    try {
      json = JSON.parse(text) as { status?: string; message?: string } | null;
    } catch {
      json = null;
    }
    // An unreadable answer to a request that returned success is ambiguous too; an unreadable error answer is a plain refusal by its HTTP status.
    if (res.ok && json === null) throw new ProviderOutcomeUnknown(`text.lk: HTTP ${res.status} with an answer that is not JSON; the message may have been accepted`);
    if (!res.ok || json?.status !== "success") throw new Error(`text.lk: ${json?.message ?? `HTTP ${res.status}`}`);
  };
}

// ---- dispatcher

export interface DispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  /** Rows whose provider call timed out: the message may still arrive, so they wait for `resolveUnconfirmed` or `retryUnconfirmed`. Not counted in `failed`. */
  unconfirmed: number;
  /** Rows this run sent whose lease had already run out, so another run had marked them `unconfirmed`: the outcome could not be recorded and is left to `resolveUnconfirmed`. */
  lost: number;
  /** Rows found `sending` with an expired lease (a dispatcher stopped mid-send) and moved to `unconfirmed`. */
  expired: number;
}

/** How long a dispatcher owns a row it is sending. It must outlast the slowest send: one provider timeout for email and sms, and for push every device that is still tried. */
export const DISPATCH_LEASE_MS = 60_000;

const shortError = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300) || "send failed";

export function createNotificationService(db: Db, opts: { now?: () => Date; providers?: Providers; providerTimeoutMs?: number; leaseMs?: number } = {}) {
  const timeoutMs = opts.providerTimeoutMs ?? PROVIDER_TIMEOUT_MS;
  const leaseMs = Math.max(opts.leaseMs ?? DISPATCH_LEASE_MS, timeoutMs + 1000);
  const now = () => (opts.now ?? (() => new Date()))();
  const providers = opts.providers ?? {};

  /** Bounds any provider call (email, sms, push) so a silent gateway cannot keep a send (and its lease) open for long. */
  async function withTimeout<T>(call: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ProviderOutcomeUnknown(`provider did not answer within ${timeoutMs} ms; the message may still be delivered`)), timeoutMs);
    });
    // The call keeps running after the deadline; a late rejection must not surface as an unhandled one.
    call.catch(() => undefined);
    try {
      return await Promise.race([call, limit]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Before a provider call: refuses to start one that could still be running when the lease ends (the call is skipped, so nothing was sent). Push checks the same before each device. */
  function assertLeaseLeft(deadline: number) {
    if (now().getTime() + timeoutMs >= deadline) throw new Error("lease nearly over; message not sent");
  }

  async function sendOne(tx: Tx | Db, row: typeof notification.$inferSelect, org: OrgRow, deadline: number): Promise<void> {
    const ext = EXTERNAL.find((e) => e.channel === row.channel);
    if (!ext) throw new Error("not an external channel");
    // J1: a channel switched off after queueing is not attempted.
    if (!(await activeChannels(tx, org)).includes(row.channel)) throw new Error("channel disabled");
    const [u] = await tx.select().from(user).where(eq(user.id, row.userId));
    if (!u || u.status !== "active") throw new Error("user inactive");
    const [tpl] = row.templateId ? await tx.select().from(notificationTemplate).where(eq(notificationTemplate.id, row.templateId)) : [];
    const payload = (row.payload ?? null) as Record<string, unknown> | null;
    const msg = composeMessage(row.event, payload, tpl);

    if (row.channel === "email") {
      if (!u.email) throw new Error("no email address");
      if (!providers.email) throw new Error("no email provider configured");
      assertLeaseLeft(deadline);
      await withTimeout(providers.email({ to: u.email, subject: msg.subject, body: msg.body }, { idempotencyKey: row.id }));
    } else if (row.channel === "sms") {
      const to = u.phone ? normalizeSriLankaPhone(u.phone) : null;
      if (!to) throw new Error(u.phone ? "invalid phone number" : "no phone number");
      if (!providers.sms) throw new Error("no sms provider configured");
      assertLeaseLeft(deadline);
      await withTimeout(providers.sms({ to, body: msg.body }, { idempotencyKey: row.id }));
    } else {
      const subs = await tx.select().from(pushSubscription).where(eq(pushSubscription.userId, row.userId)).orderBy(asc(pushSubscription.id));
      if (subs.length === 0) throw new Error("no push subscription");
      if (!providers.push) throw new Error("no push provider configured");
      let delivered = 0;
      let last: unknown = "";
      let unknown = false;
      for (const s of subs) {
        // Stop while a further call could still end after the lease: a device not tried is not a device that may have received it.
        if (now().getTime() + timeoutMs >= deadline) {
          last = new Error("lease nearly over; remaining devices not tried");
          break;
        }
        try {
          await withTimeout(providers.push({ subscription: { endpoint: s.endpoint, p256dhKey: s.p256dhKey, authKey: s.authKey }, title: msg.subject, body: msg.body }, { idempotencyKey: `${row.id}:${s.id}` }));
          delivered++;
        } catch (e) {
          last = e;
          if (isUnknownOutcome(e)) unknown = true;
        }
      }
      // One device that got it is a delivery. With none confirmed, a timed-out device may still receive it, so the outcome is unknown, not failed.
      if (delivered === 0) throw unknown ? new ProviderOutcomeUnknown(shortError(last)) : new Error(shortError(last));
    }
  }

  return {
    /**
     * Sends queued external notifications, oldest first, without holding a transaction or a row lock across a provider call.
     * Each row is claimed in a short transaction (`FOR UPDATE SKIP LOCKED`, status `sending`, lease until `claimed_until`), sent outside any
     * transaction, then finished with an update that only applies while the row is still `sending`. Two dispatchers never claim the same row.
     * A row ends `sent` (with `sent_at`) or `failed` (with the reason); a failed row is not retried by itself, use `retryFailed`. A call that times out
     * ends `unconfirmed` instead: the provider may still deliver it, so it is never re-sent by `retryFailed`.
     * A row left `sending` past its lease (the dispatcher stopped mid-send) is moved to `unconfirmed` at the start of the next run, never back to `queued`,
     * for the same reason. Safe to run on a timer.
     */
    async dispatchQueued(input: { limit?: number } = {}): Promise<DispatchResult> {
      const limit = input.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1) throw new ServiceError("invalid_input", "limit must be a positive whole number.");
      const result: DispatchResult = { attempted: 0, sent: 0, failed: 0, unconfirmed: 0, lost: 0, expired: 0 };

      const expired = await db
        .update(notification)
        .set({ status: "unconfirmed", claimedUntil: null, error: "dispatcher stopped before the provider answered; the message may have been delivered" })
        .where(and(eq(notification.status, "sending"), lte(notification.claimedUntil, now())))
        .returning({ id: notification.id });
      result.expired = expired.length;

      for (let n = 0; n < limit; n++) {
        // Claim one row at a time so its lease starts when its send starts, not when a batch was picked.
        const claimed = await db.transaction(async (tx) => {
          const [next] = await tx
            .select({ id: notification.id })
            .from(notification)
            .where(and(eq(notification.status, "queued"), ne(notification.channel, "in_app")))
            .orderBy(asc(notification.createdAt), asc(notification.id))
            .limit(1)
            .for("update", { skipLocked: true });
          if (!next) return null;
          const claimedUntil = new Date(now().getTime() + leaseMs);
          const [row] = await tx.update(notification).set({ status: "sending", claimedUntil }).where(eq(notification.id, next.id)).returning();
          return row ?? null;
        });
        if (!claimed) break;
        result.attempted++;

        // Everything from here runs outside any transaction.
        let outcome: "sent" | "failed" | "unconfirmed";
        let error: string | null = null;
        try {
          const org = await loadOrganization(db);
          await sendOne(db, claimed, org, claimed.claimedUntil!.getTime());
          outcome = "sent";
        } catch (e) {
          outcome = isUnknownOutcome(e) ? "unconfirmed" : "failed";
          error = shortError(e);
        }
        const set =
          outcome === "sent" ? { status: "sent", sentAt: now(), error: null, claimedUntil: null } : { status: outcome, error, claimedUntil: null };
        const done = await db.update(notification).set(set).where(and(eq(notification.id, claimed.id), eq(notification.status, "sending"), eq(notification.claimedUntil, claimed.claimedUntil!))).returning({ id: notification.id });
        // The claim itself must still be the active one: if the lease expired and the row was reclaimed since (a new lease timestamp), this run's answer matches
        // nothing and the row counts as lost, like one that was already marked unconfirmed.
        if (done.length === 0) result.lost++;
        else result[outcome]++;
      }
      return result;
    },

    /**
     * Puts `unconfirmed` rows back in the queue, only for channels whose provider is declared `idempotent` (it refuses a second message with the same key).
     * For any other channel the row stays unconfirmed until an operator checks the provider and calls `resolveUnconfirmed`. Returns how many.
     */
    async retryUnconfirmed(input: { event?: NotificationEvent } = {}): Promise<number> {
      const channels = EXTERNAL.map((e) => e.channel).filter((c) => providers.idempotent?.[c as "email" | "sms" | "push"] === true);
      if (channels.length === 0) return 0;
      const rows = await db
        .update(notification)
        .set({ status: "queued", error: null })
        .where(and(eq(notification.status, "unconfirmed"), inArray(notification.channel, channels), input.event ? eq(notification.event, input.event) : undefined))
        .returning({ id: notification.id });
      return rows.length;
    },

    /** An operator's answer for one unconfirmed row after checking the provider's log: it was delivered (`sent`) or it was not (`failed`, which `retryFailed` may then send). */
    async resolveUnconfirmed(input: { id: string; outcome: "sent" | "not_delivered" }): Promise<void> {
      const set = input.outcome === "sent" ? { status: "sent", sentAt: now(), error: null } : { status: "failed", error: "confirmed not delivered by an operator" };
      const rows = await db.update(notification).set(set).where(and(eq(notification.id, input.id), eq(notification.status, "unconfirmed"))).returning({ id: notification.id });
      if (rows.length === 0) throw new ServiceError("not_found", "No unconfirmed notification with that id.");
    },

    /** Puts failed external rows back in the queue (for example after fixing a provider key). Returns how many. Unconfirmed rows are not touched. */
    async retryFailed(input: { event?: NotificationEvent } = {}): Promise<number> {
      const rows = await db
        .update(notification)
        .set({ status: "queued", error: null })
        .where(and(eq(notification.status, "failed"), ne(notification.channel, "in_app"), input.event ? eq(notification.event, input.event) : undefined))
        .returning({ id: notification.id });
      return rows.length;
    },

    /** The user's in-app notifications, newest first. */
    async listInApp(input: { userId: string; unreadOnly?: boolean; limit?: number }) {
      const limit = input.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1) throw new ServiceError("invalid_input", "limit must be a positive whole number.");
      const rows = await db
        .select()
        .from(notification)
        .where(and(eq(notification.userId, input.userId), eq(notification.channel, "in_app"), input.unreadOnly ? isNull(notification.readAt) : undefined))
        .orderBy(desc(notification.createdAt), desc(notification.id))
        .limit(limit);
      return rows.map((r) => ({ ...r, message: composeMessage(r.event, r.payload as Record<string, unknown> | null) }));
    },

    /** Marks in-app notifications read for their owner only. Already read ones keep their first read time. */
    async markRead(input: { userId: string; ids: string[] }): Promise<number> {
      if (input.ids.length === 0) return 0;
      const at = now();
      const rows = await db
        .update(notification)
        .set({ readAt: at })
        .where(and(eq(notification.userId, input.userId), eq(notification.channel, "in_app"), inArray(notification.id, input.ids), isNull(notification.readAt)))
        .returning({ id: notification.id });
      return rows.length;
    },

    /**
     * "Due soon" reminders (`installment_due`): every unpaid installment, or unpaid invoice without installments, whose due date falls from
     * today up to `leadDays` days ahead (default 3, both ends inclusive). One notification per recipient, channel and item, whatever the number
     * of runs (event key `due:<invoiceId>:<seq>`, or `due:<invoiceId>`). Cancelled, waived and fully paid invoices are skipped. Run daily.
     */
    async runDueSoonJob(input: { leadDays?: number } = {}) {
      const leadDays = input.leadDays ?? 3;
      if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 60) throw new ServiceError("invalid_input", "leadDays must be a whole number from 0 to 60.");
      const { today, ids } = await db.transaction(async (tx) => {
        const t = await todayFor(tx, now());
        const rows = await tx.selectDistinct({ id: invoice.studentId }).from(invoice).where(inArray(invoice.status, ["pending", "partial", "overdue"]));
        return { today: t, ids: rows.map((r) => r.id).sort() };
      });
      const until = addDays(today, leadDays);
      const result = { date: today, students: 0, reminders: 0, notifications: 0, errors: [] as { studentId: string; message: string }[] };
      for (const studentId of ids) {
        try {
          const n = await db.transaction(async (tx) => {
            const org = await loadOrganization(tx);
            const invoices = await tx
              .select()
              .from(invoice)
              .where(and(eq(invoice.studentId, studentId), inArray(invoice.status, ["pending", "partial", "overdue"])))
              .orderBy(asc(invoice.id));
            const items: QueueItem[] = [];
            for (const inv of invoices) {
              const insts = await tx.select().from(invoiceInstallment).where(eq(invoiceInstallment.invoiceId, inv.id)).orderBy(asc(invoiceInstallment.seq));
              if (insts.length === 0) {
                const owed = toCents(inv.total) - toCents(inv.amountPaid);
                if (owed > 0 && inv.dueDate >= today && inv.dueDate <= until) {
                  items.push({ eventKey: `due:${inv.id}`, payload: { invoiceId: inv.id, dueDate: inv.dueDate, amountDue: fromCents(owed) } });
                }
              } else {
                for (const i of insts) {
                  const owed = toCents(i.amount) - toCents(i.amountPaid);
                  if (owed > 0 && i.dueDate >= today && i.dueDate <= until) {
                    items.push({ eventKey: `due:${inv.id}:${i.seq}`, payload: { invoiceId: inv.id, seq: i.seq, dueDate: i.dueDate, amountDue: fromCents(owed) } });
                  }
                }
              }
            }
            if (items.length === 0) return { reminders: 0, created: 0 };
            const { userIds, studentName } = await resolveRecipients(tx, org, studentId);
            const created = await queueNotifications(tx, org, {
              event: "installment_due",
              userIds,
              items: items.map((x) => ({ ...x, payload: { studentName, ...x.payload } })),
              at: now(),
            });
            return { reminders: items.length, created };
          });
          result.students++;
          result.reminders += n.reminders;
          result.notifications += n.created;
        } catch (err) {
          result.errors.push({ studentId, message: shortError(err) });
        }
      }
      return result;
    },
  };
}
