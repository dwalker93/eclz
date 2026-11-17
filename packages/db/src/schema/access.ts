import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { branch, user } from "./core";
import { createdAt, pk } from "./helpers";

export const role = pgTable("role", {
  id: pk(),
  name: text("name").notNull().unique(),
  description: text("description"),
  /** Built-in roles cannot be deleted. */
  isSystem: boolean("is_system").notNull().default(false),
});

export const permission = pgTable("permission", {
  id: pk(),
  /** e.g. payments.verify, attendance.mark, students.create, fees.override */
  code: text("code").notNull().unique(),
  description: text("description"),
});

export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id")
      .notNull()
      .references((): AnyPgColumn => role.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references((): AnyPgColumn => permission.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

/** A staff role for a user, for one branch or (branch_id null) for all branches. */
export const staffRoleAssignment = pgTable(
  "staff_role_assignment",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id),
    roleId: uuid("role_id")
      .notNull()
      .references((): AnyPgColumn => role.id),
    branchId: uuid("branch_id").references((): AnyPgColumn => branch.id),
  },
  (t) => [
    uniqueIndex("staff_role_all_branches_uq")
      .on(t.userId, t.roleId)
      .where(sql`${t.branchId} IS NULL`),
    uniqueIndex("staff_role_one_branch_uq")
      .on(t.userId, t.roleId, t.branchId)
      .where(sql`${t.branchId} IS NOT NULL`),
    index("staff_role_user_idx").on(t.userId),
  ],
);

/**
 * Append-only audit trail (invariants J3, J4). Update, delete and truncate are blocked by
 * triggers in the constraints migration. Also revoke UPDATE/DELETE/TRUNCATE on this table
 * from the application's database role.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: pk(),
    /** null for actions taken by scheduled jobs. */
    actorUserId: uuid("actor_user_id").references((): AnyPgColumn => user.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_actor_idx").on(t.actorUserId),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);
