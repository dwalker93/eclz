import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
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
export async function activeChannels(tx: Tx, org: OrgRow): Promise<string[]> {
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

/** Each sender throws on failure; the message becomes the notification's error. A missing provider fails its rows with a clear reason. */
export interface Providers {
  email?: (m: EmailMessage) => Promise<void>;
  sms?: (m: SmsMessage) => Promise<void>;
  push?: (m: PushMessage) => Promise<void>;
}

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
export function createTextLkSms(opts: { apiToken: string; senderId: string; fetch?: typeof fetch }): NonNullable<Providers["sms"]> {
  const doFetch = opts.fetch ?? fetch;
  return async ({ to, body }) => {
    const res = await doFetch("https://app.text.lk/api/v3/sms/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ recipient: to, sender_id: opts.senderId, type: "plain", message: body }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as { status?: string; message?: string } | null;
    if (!res.ok || json?.status !== "success") throw new Error(`text.lk: ${json?.message ?? `HTTP ${res.status}`}`);
  };
}

// ---- dispatcher

export interface DispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  /** Rows another worker held at the time; they are left for that worker. */
  skipped: number;
}

const shortError = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300) || "send failed";

export function createNotificationService(db: Db, opts: { now?: () => Date; providers?: Providers; providerTimeoutMs?: number } = {}) {
  const timeoutMs = opts.providerTimeoutMs ?? PROVIDER_TIMEOUT_MS;
  const now = () => (opts.now ?? (() => new Date()))();
  const providers = opts.providers ?? {};

  /** Bounds any provider call (email, sms, push) so a silent gateway cannot hold the row lock and connection. */
  async function withTimeout<T>(call: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`provider timed out after ${timeoutMs} ms`)), timeoutMs);
    });
    try {
      return await Promise.race([call, limit]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendOne(tx: Tx, row: typeof notification.$inferSelect, org: OrgRow): Promise<void> {
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
      await withTimeout(providers.email({ to: u.email, subject: msg.subject, body: msg.body }));
    } else if (row.channel === "sms") {
      const to = u.phone ? normalizeSriLankaPhone(u.phone) : null;
      if (!to) throw new Error(u.phone ? "invalid phone number" : "no phone number");
      if (!providers.sms) throw new Error("no sms provider configured");
      await withTimeout(providers.sms({ to, body: msg.body }));
    } else {
      const subs = await tx.select().from(pushSubscription).where(eq(pushSubscription.userId, row.userId)).orderBy(asc(pushSubscription.id));
      if (subs.length === 0) throw new Error("no push subscription");
      if (!providers.push) throw new Error("no push provider configured");
      let delivered = 0;
      let last = "";
      for (const s of subs) {
        try {
          await withTimeout(providers.push({ subscription: { endpoint: s.endpoint, p256dhKey: s.p256dhKey, authKey: s.authKey }, title: msg.subject, body: msg.body }));
          delivered++;
        } catch (e) {
          last = shortError(e);
        }
      }
      if (delivered === 0) throw new Error(last);
    }
  }

  return {
    /**
     * Sends queued external notifications, oldest first. Each row runs in its own transaction under a row lock that skips rows
     * another worker holds, so two dispatchers never send the same row. A row ends `sent` (with `sent_at`) or `failed` (with the reason);
     * a failed row is not retried by itself, use `retryFailed`. Safe to run on a timer.
     */
    async dispatchQueued(input: { limit?: number } = {}): Promise<DispatchResult> {
      const limit = input.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1) throw new ServiceError("invalid_input", "limit must be a positive whole number.");
      const ids = (
        await db
          .select({ id: notification.id })
          .from(notification)
          .where(and(eq(notification.status, "queued"), ne(notification.channel, "in_app")))
          .orderBy(asc(notification.createdAt), asc(notification.id))
          .limit(limit)
      ).map((r) => r.id);

      const result: DispatchResult = { attempted: 0, sent: 0, failed: 0, skipped: 0 };
      for (const id of ids) {
        await db.transaction(async (tx) => {
          const [row] = await tx.select().from(notification).where(eq(notification.id, id)).for("update", { skipLocked: true });
          if (!row || row.status !== "queued") {
            result.skipped++;
            return;
          }
          result.attempted++;
          const org = await loadOrganization(tx);
          try {
            await sendOne(tx, row, org);
            await tx.update(notification).set({ status: "sent", sentAt: now(), error: null }).where(eq(notification.id, id));
            result.sent++;
          } catch (e) {
            await tx.update(notification).set({ status: "failed", error: shortError(e) }).where(eq(notification.id, id));
            result.failed++;
          }
        });
      }
      return result;
    },

    /** Puts failed external rows back in the queue (for example after fixing a provider key). Returns how many. */
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
