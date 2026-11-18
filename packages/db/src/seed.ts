import type { PgDatabase } from "drizzle-orm/pg-core";
import * as s from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPgDatabase = PgDatabase<any, any>;

/**
 * Starter permission codes for phase 1. This is a starting set to review, not a frozen list:
 * permissions are data, so add new ones with a seed or migration.
 */
export const STARTER_PERMISSIONS = [
  "branches.manage",
  "roles.manage",
  "audit.read",
  "students.read",
  "students.create",
  "students.update",
  "guardians.manage",
  "courses.manage",
  "enrollments.manage",
  "promotion.run",
  "attendance.read",
  "attendance.mark",
  "fees.manage",
  "fees.override",
  "invoices.read",
  "invoices.adjust",
  "payments.verify",
  "payments.record_cash",
  "receipts.void",
  "content.manage",
  "notices.manage",
  "notifications.manage",
  "lecturers.manage",
  "exams.manage",
  "exams.release",
  "payments.void",
  "payouts.manage",
  "commissions.manage",
  "content.handover",
  "reports.read",
] as const;

/** Built-in roles. Custom roles can be added later as data. root_admin gets every permission. */
export const STARTER_ROLES: Record<string, { description: string; permissions: readonly string[] | "all" }> = {
  root_admin: { description: "Owner or root administrator", permissions: "all" },
  student_counselor: {
    description: "Registers students and manages enrolments",
    permissions: [
      "students.read",
      "students.create",
      "students.update",
      "guardians.manage",
      "enrollments.manage",
      "attendance.read",
      "invoices.read",
      "notices.manage",
      "content.handover",
    ],
  },
  payment_handler: {
    description: "Verifies payments and records cash",
    permissions: ["students.read", "invoices.read", "invoices.adjust", "payments.verify", "payments.record_cash"],
  },
  attendance_marker: {
    description: "Marks attendance, including QR scans",
    permissions: ["students.read", "attendance.read", "attendance.mark"],
  },
  lecturer: {
    description: "Teacher. Always limited to their own courses, content and exams in application code (A5)",
    permissions: ["students.read", "attendance.read", "attendance.mark", "content.manage", "notices.manage", "exams.manage"],
  },
};

const GRADES: { name: string; stage: (typeof s.GRADE_STAGES)[number] }[] = Array.from({ length: 13 }, (_, i) => {
  const n = i + 1;
  const stage = n <= 5 ? "primary" : n <= 9 ? "junior" : n <= 11 ? "ordinary_level" : "advanced_level";
  return { name: `Grade ${n}`, stage };
});

export interface SeedOptions {
  organizationName: string;
  type: (typeof s.ORGANIZATION_TYPES)[number];
  defaultBranchName?: string;
  enabledModules?: Partial<Record<s.ModuleName, boolean>>;
  currency?: string;
  timezone?: string;
}

/**
 * Provisioning seed for one customer deployment: the single organization, its default branch,
 * the receipt counter, payment methods (bank transfer is the default), the starter permissions,
 * the built-in roles and grades 1 to 13. Run once, right after the migrations.
 */
export async function seedDefaults(db: AnyPgDatabase, opts: SeedOptions) {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(s.organization)
      .values({
        name: opts.organizationName,
        type: opts.type,
        enabledModules: opts.enabledModules ?? {},
        ...(opts.currency ? { currency: opts.currency } : {}),
        ...(opts.timezone ? { timezone: opts.timezone } : {}),
      })
      .returning();
    if (!org) throw new Error("organization insert failed");

    const [branch] = await tx
      .insert(s.branch)
      .values({
        organizationId: org.id,
        name: opts.defaultBranchName ?? "Main",
        isDefault: true,
      })
      .returning();
    if (!branch) throw new Error("branch insert failed");
    await tx.insert(s.receiptCounter).values({ branchId: branch.id });

    // J1: in-app is always on. Email, SMS and push stay off until the buyer needs them (module flags and keys).
    await tx.insert(s.notificationChannel).values([
      { organizationId: org.id, channel: "in_app", provider: "internal", isEnabled: true },
      { organizationId: org.id, channel: "email", isEnabled: false },
      { organizationId: org.id, channel: "sms", provider: "text.lk", isEnabled: false },
      { organizationId: org.id, channel: "push", provider: "web push", isEnabled: false },
    ]);

    await tx.insert(s.paymentMethod).values([
      { organizationId: org.id, type: "bank_transfer", label: "Bank transfer", isDefault: true },
      { organizationId: org.id, type: "cash", label: "Cash" },
    ]);

    // A migration may already have added a permission to this database (for example reports.read), so inserts skip existing codes.
    await tx
      .insert(s.permission)
      .values(STARTER_PERMISSIONS.map((code) => ({ code })))
      .onConflictDoNothing();
    const permissions = await tx.select().from(s.permission);
    const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

    for (const [name, def] of Object.entries(STARTER_ROLES)) {
      const [role] = await tx
        .insert(s.role)
        .values({ name, description: def.description, isSystem: true })
        .returning();
      if (!role) throw new Error(`role insert failed: ${name}`);
      const codes = def.permissions === "all" ? STARTER_PERMISSIONS : def.permissions;
      await tx.insert(s.rolePermission).values(
        codes.map((code) => {
          const permissionId = permissionIdByCode.get(code);
          if (!permissionId) throw new Error(`unknown permission: ${code}`);
          return { roleId: role.id, permissionId };
        }),
      );
    }

    await tx.insert(s.gradeLevel).values(GRADES.map((g, i) => ({ ...g, ordinal: i + 1 })));

    return { organizationId: org.id, defaultBranchId: branch.id };
  });
}
