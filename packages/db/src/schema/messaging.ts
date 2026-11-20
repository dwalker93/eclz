import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { course } from "./academics";
import { organization, user } from "./core";
import { createdAt, oneOf, pk, tstz } from "./helpers";

export const NOTIFICATION_CHANNELS = ["email", "sms", "push", "in_app"] as const;
export const NOTIFICATION_EVENTS = [
  "payment_submitted",
  "payment_verified",
  "payment_rejected",
  "receipt_issued",
  "installment_due",
  "installment_overdue",
  "attendance_marked",
  "class_reminder",
  "exam_published",
  "notice",
] as const;
export const NOTIFICATION_STATUSES = ["queued", "sent", "failed"] as const;

/**
 * Per-buyer channel switches (J1). In-app is always available. A disabled external channel creates
 * no notification rows and no send attempts, which the application enforces.
 */
export const notificationChannel = pgTable(
  "notification_channel",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references((): AnyPgColumn => organization.id),
    channel: text("channel").notNull(),
    /** smtp, resend, text.lk, web push ... */
    provider: text("provider"),
    isEnabled: boolean("is_enabled").notNull().default(false),
    /** Sender id, keys. Keep secrets in environment variables where possible. */
    config: jsonb("config"),
  },
  (t) => [
    unique("notification_channel_uq").on(t.organizationId, t.channel),
    oneOf("notification_channel_check", t.channel, NOTIFICATION_CHANNELS),
  ],
);

export const notificationTemplate = pgTable(
  "notification_template",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references((): AnyPgColumn => organization.id),
    event: text("event").notNull(),
    channel: text("channel").notNull(),
    subject: text("subject"),
    /** With placeholders, for example {{student_name}}. */
    body: text("body").notNull(),
  },
  (t) => [
    unique("notification_template_uq").on(t.organizationId, t.event, t.channel),
    oneOf("notification_template_event_check", t.event, NOTIFICATION_EVENTS),
    oneOf("notification_template_channel_check", t.channel, NOTIFICATION_CHANNELS),
  ],
);

/**
 * One row per (user, event_key, channel). event_key identifies the event and the thing that caused it (an invoice installment,
 * a payment, a session) so a retry cannot send twice (J2). Two events with the same event_key therefore share one row per user and channel,
 * so a key must be unique per event (the installment reminder uses `due:<invoice>:<seq>`). read_at tracks in-app reads.
 */
export const notification = pgTable(
  "notification",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id),
    templateId: uuid("template_id").references((): AnyPgColumn => notificationTemplate.id),
    channel: text("channel").notNull(),
    event: text("event").notNull(),
    eventKey: text("event_key").notNull(),
    payload: jsonb("payload"),
    status: text("status").notNull().default("queued"),
    sentAt: tstz("sent_at"),
    readAt: tstz("read_at"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("notification_channel_value_check", t.channel, NOTIFICATION_CHANNELS),
    oneOf("notification_event_check", t.event, NOTIFICATION_EVENTS),
    oneOf("notification_status_check", t.status, NOTIFICATION_STATUSES),
    check("notification_sent_check", sql`${t.status} <> 'sent' OR ${t.sentAt} IS NOT NULL`),
    check("notification_failed_check", sql`${t.status} <> 'failed' OR ${t.error} IS NOT NULL`),
    // J2
    uniqueIndex("notification_dedupe_uq").on(t.userId, t.eventKey, t.channel),
    index("notification_user_idx").on(t.userId, t.createdAt),
    index("notification_queue_idx").on(t.status).where(sql`${t.status} = 'queued'`),
  ],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id),
    endpoint: text("endpoint").notNull().unique(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscription_user_idx").on(t.userId)],
);

/** Direct messages between users (student, parent, lecturer, staff). Who may message whom is application policy. */
export const messageThread = pgTable(
  "message_thread",
  {
    id: pk(),
    subject: text("subject").notNull(),
    /** Optional context. */
    courseId: uuid("course_id").references((): AnyPgColumn => course.id),
    createdBy: uuid("created_by")
      .notNull()
      .references((): AnyPgColumn => user.id),
    createdAt: createdAt(),
  },
  (t) => [check("message_thread_subject_check", sql`length(btrim(${t.subject})) > 0`)],
);

export const threadParticipant = pgTable(
  "thread_participant",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references((): AnyPgColumn => messageThread.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id),
    lastReadAt: tstz("last_read_at"),
  },
  (t) => [primaryKey({ name: "thread_participant_pk", columns: [t.threadId, t.userId] }), index("thread_participant_user_idx").on(t.userId)],
);

export const message = pgTable(
  "message",
  {
    id: pk(),
    /** A thread owns its messages: deleting the thread deletes them (0015). Removing one participant who has posted is still refused. */
    threadId: uuid("thread_id")
      .notNull()
      .references((): AnyPgColumn => messageThread.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull(),
    body: text("body").notNull(),
    sentAt: tstz("sent_at").notNull().defaultNow(),
  },
  (t) => [
    // Only participants can post.
    foreignKey({
      name: "message_sender_participant_fk",
      columns: [t.threadId, t.senderId],
      foreignColumns: [threadParticipant.threadId, threadParticipant.userId],
    }),
    check("message_body_check", sql`length(btrim(${t.body})) > 0`),
    index("message_thread_idx").on(t.threadId, t.sentAt),
  ],
);
