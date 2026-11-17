import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { branch, user } from "./core";
import { createdAt, day, oneOf, pk } from "./helpers";

export const STUDENT_STATUSES = ["active", "alumni", "suspended"] as const;
export const GRADE_STAGES = ["primary", "junior", "ordinary_level", "advanced_level"] as const;

/** Profile of a teacher. Kept even when the lecturer portal is off (invariant A4). */
export const lecturer = pgTable(
  "lecturer",
  {
    id: pk(),
    userId: uuid("user_id")
      .unique()
      .references((): AnyPgColumn => user.id),
    fullName: text("full_name").notNull(),
    qualification: text("qualification"),
    bio: text("bio"),
    portalEnabled: boolean("portal_enabled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check("lecturer_portal_needs_user_check", sql`NOT ${t.portalEnabled} OR ${t.userId} IS NOT NULL`),
  ],
);

export const lecturerBranch = pgTable(
  "lecturer_branch",
  {
    lecturerId: uuid("lecturer_id")
      .notNull()
      .references((): AnyPgColumn => lecturer.id),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
  },
  (t) => [primaryKey({ columns: [t.lecturerId, t.branchId] })],
);

export const student = pgTable(
  "student",
  {
    id: pk(),
    /** null until the student is invited to the portal. */
    userId: uuid("user_id")
      .unique()
      .references((): AnyPgColumn => user.id),
    studentNo: text("student_no").notNull().unique(),
    fullName: text("full_name").notNull(),
    /** Age is always calculated from this. */
    dateOfBirth: day("date_of_birth").notNull(),
    gender: text("gender"),
    schoolName: text("school_name"),
    nic: text("nic"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    /** Value printed as a QR code on the student card. Rotate if a card is lost. */
    qrToken: text("qr_token")
      .notNull()
      .unique()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [oneOf("student_status_check", t.status, STUDENT_STATUSES)],
);

export const studentBranch = pgTable(
  "student_branch",
  {
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    branchId: uuid("branch_id")
      .notNull()
      .references((): AnyPgColumn => branch.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    joinedOn: day("joined_on").notNull().default(sql`CURRENT_DATE`),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.branchId] }),
    uniqueIndex("student_branch_one_primary_uq").on(t.studentId).where(sql`${t.isPrimary}`),
  ],
);

export const gradeLevel = pgTable(
  "grade_level",
  {
    id: pk(),
    name: text("name").notNull().unique(),
    stage: text("stage").notNull(),
    /** Orders grades and drives promotion to the next grade. */
    ordinal: integer("ordinal").notNull().unique(),
  },
  (t) => [oneOf("grade_level_stage_check", t.stage, GRADE_STAGES)],
);

export const guardian = pgTable("guardian", {
  id: pk(),
  userId: uuid("user_id")
    .unique()
    .references((): AnyPgColumn => user.id),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  address: text("address"),
  nic: text("nic"),
  email: text("email"),
  /** Login needs the parent_portal module as well. */
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  createdAt: createdAt(),
});

export const studentGuardian = pgTable(
  "student_guardian",
  {
    studentId: uuid("student_id")
      .notNull()
      .references((): AnyPgColumn => student.id),
    guardianId: uuid("guardian_id")
      .notNull()
      .references((): AnyPgColumn => guardian.id),
    relationship: text("relationship"),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.guardianId] }),
    uniqueIndex("student_guardian_one_primary_uq").on(t.studentId).where(sql`${t.isPrimary}`),
  ],
);
