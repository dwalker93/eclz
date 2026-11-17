import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { branch, user } from "./core";
import { oneOf, pk, tstz } from "./helpers";

export const NOTICE_TARGET_TYPES = ["all", "role", "course", "grade", "student"] as const;

export const notice = pgTable(
  "notice",
  {
    id: pk(),
    authorId: uuid("author_id")
      .notNull()
      .references((): AnyPgColumn => user.id),
    /** null = all branches. */
    branchId: uuid("branch_id").references((): AnyPgColumn => branch.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    publishedAt: tstz("published_at").notNull().defaultNow(),
    /** null = no expiry. */
    expiresAt: tstz("expires_at"),
  },
  (t) => [
    check("notice_expiry_check", sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.publishedAt}`),
    index("notice_published_idx").on(t.publishedAt),
  ],
);

export const noticeTarget = pgTable(
  "notice_target",
  {
    id: pk(),
    noticeId: uuid("notice_id")
      .notNull()
      .references((): AnyPgColumn => notice.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    /** Role, course, grade or student id. null when the target is everyone. */
    targetId: uuid("target_id"),
  },
  (t) => [
    oneOf("notice_target_type_check", t.targetType, NOTICE_TARGET_TYPES),
    check("notice_target_id_check", sql`(${t.targetType} = 'all') = (${t.targetId} IS NULL)`),
    index("notice_target_notice_idx").on(t.noticeId),
  ],
);
