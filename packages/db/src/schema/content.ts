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
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { course } from "./academics";
import { branch, file } from "./core";
import { createdAt, money, oneOf, pk } from "./helpers";
import { lecturer } from "./people";

export const CONTENT_KINDS = ["recording", "file", "physical_book"] as const;
export const CONTENT_ACCESS_TYPES = ["course", "free_registered", "paid"] as const;
export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;

/** Recordings (YouTube links), notes, books. Paid purchases arrive in phase 4. */
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
