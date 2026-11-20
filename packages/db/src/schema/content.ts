import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { course } from "./academics";
import { branch, file, user } from "./core";
import { invoice } from "./billing";
import { createdAt, money, oneOf, pk, tstz } from "./helpers";
import { lecturer, student } from "./people";

export const CONTENT_KINDS = ["recording", "file", "physical_book"] as const;
export const CONTENT_ACCESS_TYPES = ["course", "free_registered", "paid"] as const;
export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export const PURCHASE_CHANNELS = ["online", "physical"] as const;
export const PURCHASE_STATUSES = ["pending", "paid", "cancelled"] as const;

/** Recordings (YouTube links), notes, books. Paid items are bought through content_purchase. */
export const contentItem = pgTable(
  "content_item",
  {
    id: pk(),
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** YouTube link for recordings. */
    externalUrl: text("external_url"),
    fileId: uuid("file_id").references((): AnyPgColumn => file.id),
    accessType: text("access_type").notNull().default("course"),
    price: money("price"),
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("content_item_kind_check", t.kind, CONTENT_KINDS),
    oneOf("content_item_access_type_check", t.accessType, CONTENT_ACCESS_TYPES),
    oneOf("content_item_status_check", t.status, CONTENT_STATUSES),
    // F1
    check(
      "content_item_kind_fields_check",
      sql`(${t.kind} = 'recording' AND ${t.externalUrl} IS NOT NULL AND ${t.fileId} IS NULL) OR (${t.kind} = 'file' AND ${t.fileId} IS NOT NULL) OR (${t.kind} = 'physical_book' AND ${t.externalUrl} IS NULL AND ${t.fileId} IS NULL)`,
    ),
    // F2
    check(
      "content_item_paid_price_check",
      sql`${t.accessType} <> 'paid' OR (${t.price} IS NOT NULL AND ${t.price} > 0)`,
    ),
    index("content_item_lecturer_idx").on(t.lecturerId),
  ],
);

/** Branches where a content item is listed. Shared content is listed in several. */
export const contentBranch = pgTable(
  "content_branch",
  {
    contentId: uuid("content_id")
      .notNull()
      .references((): AnyPgColumn => contentItem.id),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.branchId] })],
);

export const courseSection = pgTable(
  "course_section",
  {
    id: pk(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [unique("course_section_id_course_uq").on(t.id, t.courseId), index("course_section_course_idx").on(t.courseId)],
);

export const courseContent = pgTable(
  "course_content",
  {
    id: pk(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => course.id),
    sectionId: uuid("section_id"),
    contentId: uuid("content_id")
      .notNull()
      .references((): AnyPgColumn => contentItem.id),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    // A section must belong to the same course.
    foreignKey({
      name: "course_content_section_course_fk",
      columns: [t.sectionId, t.courseId],
      foreignColumns: [courseSection.id, courseSection.courseId],
    }),
    unique("course_content_course_content_uq").on(t.courseId, t.contentId),
  ],
);

/**
 * A student's purchase of a paid content item. It goes through the normal invoice, slip and receipt flow:
 * the purchase points at an invoice, and the invoice has one content item pointing back (D13).
 * The branch must be one the item is listed in, and it is the invoice's branch.
 */
export const contentPurchase = pgTable(
  "content_purchase",
  {
    id: pk(),
    contentId: uuid("content_id")
      .notNull()
      .references((): AnyPgColumn => contentItem.id),
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    invoiceId: uuid("invoice_id"),
    /** Branch chosen at purchase. Invoice, bank account and receipt follow it. */
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    channel: text("channel").notNull(),
    /** The price at purchase time. */
    price: money("price").notNull(),
    status: text("status").notNull().default("pending"),
    purchasedAt: tstz("purchased_at").notNull().defaultNow(),
    /** Physical items only, and only after payment (F6). */
    handedOverAt: tstz("handed_over_at"),
    handedOverBy: uuid("handed_over_by").references((): AnyPgColumn => user.id),
  },
  (t) => [
    unique("content_purchase_id_invoice_uq").on(t.id, t.invoiceId),
    // D13: the branch is one the item is listed in.
    foreignKey({
      name: "content_purchase_listed_branch_fk",
      columns: [t.contentId, t.branchId],
      foreignColumns: [contentBranch.contentId, contentBranch.branchId],
    }),
    // The invoice belongs to the same student and branch.
    foreignKey({
      name: "content_purchase_invoice_student_fk",
      columns: [t.invoiceId, t.studentId],
      foreignColumns: [invoice.id, invoice.studentId],
    }),
    foreignKey({
      name: "content_purchase_invoice_branch_fk",
      columns: [t.invoiceId, t.branchId],
      foreignColumns: [invoice.id, invoice.branchId],
    }),
    oneOf("content_purchase_channel_check", t.channel, PURCHASE_CHANNELS),
    oneOf("content_purchase_status_check", t.status, PURCHASE_STATUSES),
    check("content_purchase_price_check", sql`${t.price} > 0`),
    // A purchase is paid only through its invoice, so a paid row always has one (billing record).
    check("content_purchase_paid_invoice_check", sql`${t.status} <> 'paid' OR ${t.invoiceId} IS NOT NULL`),
    // F6: handover needs a paid physical purchase and records who handed it over.
    check(
      "content_purchase_handover_check",
      sql`(${t.handedOverAt} IS NULL AND ${t.handedOverBy} IS NULL) OR (${t.handedOverAt} IS NOT NULL AND ${t.handedOverBy} IS NOT NULL AND ${t.status} = 'paid' AND ${t.channel} = 'physical')`,
    ),
    // F5: no two pending or paid purchases of the same item by one student.
    uniqueIndex("content_purchase_active_uq")
      .on(t.contentId, t.studentId)
      .where(sql`${t.status} IN ('pending', 'paid')`),
    index("content_purchase_student_idx").on(t.studentId),
  ],
);
