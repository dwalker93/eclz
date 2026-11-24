import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "./core";
import { createdAt, pk, tstz } from "./helpers";

/**
 * A signed-in browser or device. Only a SHA-256 hash of the session token is stored, so a leaked table cannot be used to sign in.
 * `mfa_verified_at` is set after the second step; staff sessions without it do not open the admin portal.
 */
export const authSession = pgTable(
  "auth_session",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
    expiresAt: tstz("expires_at").notNull(),
    lastSeenAt: tstz("last_seen_at").notNull().defaultNow(),
    mfaVerifiedAt: tstz("mfa_verified_at"),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("auth_session_user_idx").on(t.userId), index("auth_session_expires_idx").on(t.expiresAt)],
);

/** Authenticator-app (TOTP) setup of a user. Pending until `enabled_at` is set. The secret is stored encrypted; recovery codes as hashes. */
export const userTwoFactor = pgTable("user_two_factor", {
  userId: uuid("user_id")
    .primaryKey()
    .references((): AnyPgColumn => user.id),
  secretCipher: text("secret_cipher").notNull(),
  enabledAt: tstz("enabled_at"),
  recoveryHashes: jsonb("recovery_hashes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  /** The newest 30-second TOTP step already accepted. A code for this step or an older one is refused, so each code works once (RFC 6238). */
  lastUsedStep: bigint("last_used_step", { mode: "number" }),
  createdAt: createdAt(),
});

/** Fixed-window counters for sign-in, first-login and code attempts, kept in the database so they work across servers. */
export const authRateLimit = pgTable(
  "auth_rate_limit",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: tstz("window_start").notNull(),
  },
  (t) => [check("auth_rate_limit_count_check", sql`${t.count} >= 0`)],
);
