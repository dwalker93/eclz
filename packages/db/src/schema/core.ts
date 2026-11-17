import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createdAt, oneOf, pk, tstz } from "./helpers";

export const ORGANIZATION_TYPES = ["individual", "institution"] as const;
export const OVERDUE_ACTIONS = ["none", "notify", "restrict", "notify_and_restrict"] as const;
export const COMMISSION_BASES = ["paid", "list"] as const;
export const USER_STATUSES = ["active", "disabled"] as const;

/** Module switches stored in organization.enabled_modules (all off unless true). */
export const MODULES = [
  "parent_portal",
  "lecturer_portal",
  "online_exams",
  "content_store",
  "commissions",
  "fee_exceptions",
  "qr_attendance",
  "gateway",
  "email",
  "sms",
  "web_push",
] as const;
export type ModuleName = (typeof MODULES)[number];

/**
 * Exactly one row per deployment (invariant A2). The singleton rule is a unique index
 * on a constant expression, created in the hand-written constraints migration.
 */
export const organization = pgTable(
  "organization",
  {
    id: pk(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    enabledModules: jsonb("enabled_modules")
      .$type<Partial<Record<ModuleName, boolean>>>()
      .notNull()
      .default({}),
    currency: text("currency").notNull().default("LKR"),
    timezone: text("timezone").notNull().default("Asia/Colombo"),
    guardianRequiredBelowAge: integer("guardian_required_below_age").notNull().default(16),
    signingKeyRef: text("signing_key_ref"),
    overdueGraceDays: integer("overdue_grace_days").notNull().default(7),
    overdueAction: text("overdue_action").notNull().default("notify"),
    discountCommissionBasis: text("discount_commission_basis").notNull().default("paid"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("organization_type_check", t.type, ORGANIZATION_TYPES),
    oneOf("organization_overdue_action_check", t.overdueAction, OVERDUE_ACTIONS),
    oneOf("organization_commission_basis_check", t.discountCommissionBasis, COMMISSION_BASES),
    check("organization_guardian_age_check", sql`${t.guardianRequiredBelowAge} >= 0`),
    check("organization_grace_days_check", sql`${t.overdueGraceDays} >= 0`),
  ],
);

export const branch = pgTable(
  "branch",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references((): AnyPgColumn => organization.id),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("branch_org_name_uq").on(t.organizationId, t.name),
    uniqueIndex("branch_one_default_uq").on(t.organizationId).where(sql`${t.isDefault}`),
  ],
);

/**
 * One login identity. A user can also be a lecturer, student and guardian at the same time
 * (invariant A1), through the profile tables that point back here.
 * Normalise email to lower case in the application before saving.
 */
export const user = pgTable(
  "user",
  {
    id: pk(),
    email: text("email").unique(),
    username: text("username").unique(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    status: text("status").notNull().default("active"),
    lastLoginAt: tstz("last_login_at"),
    createdAt: createdAt(),
  },
  (t) => [
    oneOf("user_status_check", t.status, USER_STATUSES),
    check("user_has_login_check", sql`${t.email} IS NOT NULL OR ${t.username} IS NOT NULL`),
  ],
);

/** Metadata for uploaded files (slips, receipts, notes). The bytes live in private storage. */
export const file = pgTable(
  "file",
  {
    id: pk(),
    uploadedBy: uuid("uploaded_by").references((): AnyPgColumn => user.id),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("file_size_check", sql`${t.sizeBytes} >= 0`),
    index("file_uploaded_by_idx").on(t.uploadedBy),
  ],
);
