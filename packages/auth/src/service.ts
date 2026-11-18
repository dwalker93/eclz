import { and, eq, lt, ne } from "drizzle-orm";
import { authRateLimit, authSession, guardian, user, userTwoFactor } from "@workspace/db/schema";
import {
  authorizeAnywhere,
  createAccessControlService,
  isRootAdmin,
  normalizeSriLankaPhone,
  resolveIdentity,
  ServiceError,
  writeAudit,
  type Db,
  type Identity,
} from "@workspace/domain";
import { decrypt, encrypt, newToken, sha256 } from "./crypto";
import { burnTime, checkPassword, hashPassword, verifyPassword } from "./password";
import { clear, hit } from "./rate-limit";
import { newTotpSecret, otpauthUri, verifyTotp } from "./totp";

export interface AuthOptions {
  /** Server secret (at least 16 characters) that protects stored authenticator secrets. Keep it in the environment, never in the repository. */
  secretKey: string;
  now?: () => Date;
  issuer?: string;
  /** Session length for staff (admin portal). */
  staffSessionHours?: number;
  /** Session length for everyone else. */
  sessionDays?: number;
}

export type Restriction = "set_password" | "mfa" | "mfa_setup" | null;

/** Who is calling. `portals` are all false while a `restriction` is open, so a half-signed-in session opens nothing. */
export interface Principal {
  userId: string;
  sessionId: string;
  identity: Identity;
  portals: Identity["portals"];
  /** set_password: first parent login. mfa: enter the authenticator code. mfa_setup: staff must enrol an authenticator first. */
  restriction: Restriction;
}

export interface SignedIn {
  token: string;
  expiresAt: Date;
  principal: Principal;
}

const MINUTE = 60_000;
const SIGN_IN_ID = { limit: 10, windowMs: 15 * MINUTE };
const SIGN_IN_IP = { limit: 60, windowMs: 15 * MINUTE };
const FIRST_PHONE = { limit: 5, windowMs: 15 * MINUTE };
const FIRST_IP = { limit: 30, windowMs: 15 * MINUTE };
const CODE_TRIES = { limit: 8, windowMs: 10 * MINUTE };
const PASSWORD_TRIES = { limit: 10, windowMs: 15 * MINUTE };

const RECOVERY_CODES = 8;
const recoveryNormal = (c: string) => c.toLowerCase().replace(/[\s-]/g, "");
function newRecoveryCode(): string {
  const raw = newToken(8).toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(10, "x").slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function createAuthService(db: Db, opts: AuthOptions) {
  if (opts.secretKey.length < 16) throw new Error("secretKey must be at least 16 characters.");
  const now = () => (opts.now ?? (() => new Date()))();
  const acl = createAccessControlService(db);
  const issuer = opts.issuer ?? "Student Management";

  const bad = () => new ServiceError("invalid_credentials", "Wrong sign-in details.");
  const noSession = () => new ServiceError("unauthenticated", "Please sign in.");

  async function createSession(userId: string, identity: Identity, meta: { ip?: string | null; userAgent?: string | null }, mfaVerified = false): Promise<{ token: string; expiresAt: Date }> {
    const token = newToken();
    const hours = identity.portals.admin ? (opts.staffSessionHours ?? 12) : (opts.sessionDays ?? 30) * 24;
    const expiresAt = new Date(now().getTime() + hours * 3_600_000);
    await db.insert(authSession).values({
      userId,
      tokenHash: sha256(token),
      expiresAt,
      lastSeenAt: now(),
      mfaVerifiedAt: mfaVerified ? now() : null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    });
    await db.update(user).set({ lastLoginAt: now() }).where(eq(user.id, userId));
    return { token, expiresAt };
  }

  async function sessionRow(token: string) {
    const [s] = await db.select().from(authSession).where(eq(authSession.tokenHash, sha256(token)));
    if (!s || s.expiresAt <= now()) return null;
    return s;
  }

  async function buildPrincipal(s: typeof authSession.$inferSelect): Promise<Principal | null> {
    const identity = await resolveIdentity(db, s.userId);
    if (!identity?.active) return null;
    const [tf] = await db.select({ enabledAt: userTwoFactor.enabledAt }).from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId));
    const enrolled = !!tf?.enabledAt;
    const mfaRequired = identity.portals.admin || enrolled;
    const restriction: Restriction = identity.needsPasswordSetup ? "set_password" : mfaRequired && !s.mfaVerifiedAt ? (enrolled ? "mfa" : "mfa_setup") : null;
    const closed = { admin: false, lecturer: false, student: false, parent: false };
    return { userId: s.userId, sessionId: s.id, identity, portals: restriction ? closed : identity.portals, restriction };
  }

  /** A session that exists and belongs to an active user, whatever its restriction. */
  async function openSession(token: string) {
    const s = await sessionRow(token);
    if (!s) throw noSession();
    const principal = await buildPrincipal(s);
    if (!principal) throw noSession();
    return { s, principal };
  }

  async function findByIdentifier(raw: string) {
    const id = raw.trim();
    if (!id || id.length > 200) return null;
    let rows;
    if (id.includes("@")) rows = await db.select().from(user).where(eq(user.email, id.toLowerCase()));
    else if (/^[\d\s+()-]{9,}$/.test(id)) {
      const phone = normalizeSriLankaPhone(id);
      if (!phone) return null;
      rows = await db.select().from(user).where(eq(user.phone, phone));
      rows = rows.filter((r) => r.status === "active" && r.passwordHash);
      if (rows.length !== 1) return null;
    } else rows = await db.select().from(user).where(eq(user.username, id));
    return rows[0] ?? null;
  }

  async function revokeOthers(userId: string, keepSessionId: string) {
    await db.delete(authSession).where(and(eq(authSession.userId, userId), ne(authSession.id, keepSessionId)));
  }

  function checkCode(secretCipher: string, code: string): boolean {
    return verifyTotp(decrypt(opts.secretKey, secretCipher), code, now()) !== null;
  }

  return {
    // ---- sign in

    /**
     * Email, username or (parent accounts) phone plus password. Every failure looks the same (`invalid_credentials`) and costs the same time.
     * Attempts are limited per identifier and per address. Staff and anyone with an authenticator get a session that opens nothing until
     * `verifyMfa` (or enrolment) is done: see `principal.restriction`.
     */
    async signIn(input: { identifier: string; password: string; ip?: string | null; userAgent?: string | null }): Promise<SignedIn> {
      const idKey = `signin:id:${input.identifier.trim().toLowerCase().slice(0, 200)}`;
      if (input.ip) await hit(db, `signin:ip:${input.ip}`, SIGN_IN_IP, now());
      await hit(db, idKey, SIGN_IN_ID, now());
      const u = await findByIdentifier(input.identifier);
      if (!u?.passwordHash || u.status !== "active") {
        await burnTime(input.password);
        throw bad();
      }
      if (!(await verifyPassword(input.password, u.passwordHash))) throw bad();
      await clear(db, idKey);
      const identity = (await resolveIdentity(db, u.id))!;
      const { token, expiresAt } = await createSession(u.id, identity, input);
      const [s] = await db.select().from(authSession).where(eq(authSession.tokenHash, sha256(token)));
      return { token, expiresAt, principal: (await buildPrincipal(s!))! };
    },

    /**
     * A parent's first sign-in with the phone number alone, possible only while the account has no password. The session it gives is
     * restricted to `set_password`: it opens nothing else until `setPassword` is done.
     */
    async firstLogin(input: { phone: string; ip?: string | null; userAgent?: string | null }): Promise<SignedIn> {
      const phone = normalizeSriLankaPhone(input.phone);
      if (input.ip) await hit(db, `first:ip:${input.ip}`, FIRST_IP, now());
      await hit(db, `first:phone:${phone ?? input.phone.replace(/\D/g, "").slice(0, 20)}`, FIRST_PHONE, now());
      const found = await acl.findFirstLoginUser({ phone: input.phone });
      if (!found) throw bad();
      const identity = (await resolveIdentity(db, found.userId))!;
      const { token, expiresAt } = await createSession(found.userId, identity, input);
      const [s] = await db.select().from(authSession).where(eq(authSession.tokenHash, sha256(token)));
      return { token, expiresAt, principal: (await buildPrincipal(s!))! };
    },

    /** Who is behind this token, or `unauthenticated`. Check `principal.restriction` and `principal.portals` before serving anything. */
    async authenticate(token: string | null | undefined): Promise<Principal> {
      if (!token) throw noSession();
      const { s, principal } = await openSession(token);
      if (now().getTime() - s.lastSeenAt.getTime() > MINUTE) await db.update(authSession).set({ lastSeenAt: now() }).where(eq(authSession.id, s.id));
      return principal;
    },

    async signOut(token: string): Promise<void> {
      await db.delete(authSession).where(eq(authSession.tokenHash, sha256(token)));
    },

    async signOutEverywhere(userId: string): Promise<void> {
      await db.delete(authSession).where(eq(authSession.userId, userId));
    },

    // ---- passwords

    /** Ends the first parent login: saves the first password, signs out every other session of the account. */
    async setPassword(input: { token: string; newPassword: string }): Promise<Principal> {
      const { s, principal } = await openSession(input.token);
      if (principal.restriction !== "set_password") throw new ServiceError("forbidden", "A password is already set.");
      checkPassword(input.newPassword);
      await acl.setInitialPassword({ userId: s.userId, passwordHash: await hashPassword(input.newPassword) });
      await revokeOthers(s.userId, s.id);
      return (await buildPrincipal(s))!;
    },

    /** Needs the current password. Signs out the account's other sessions. Audited (J3). */
    async changePassword(input: { token: string; currentPassword: string; newPassword: string }): Promise<void> {
      const { s, principal } = await openSession(input.token);
      if (principal.restriction === "set_password") throw new ServiceError("password_setup_required", "Set a password first.");
      await hit(db, `pw:${s.userId}`, PASSWORD_TRIES, now());
      const [u] = await db.select().from(user).where(eq(user.id, s.userId));
      if (!u?.passwordHash || !(await verifyPassword(input.currentPassword, u.passwordHash))) throw bad();
      checkPassword(input.newPassword);
      const passwordHash = await hashPassword(input.newPassword);
      await db.transaction(async (tx) => {
        await tx.update(user).set({ passwordHash }).where(eq(user.id, u.id));
        await writeAudit(tx, { actor: u.id, action: "user.password_changed", entityType: "user", entityId: u.id });
      });
      await revokeOthers(u.id, s.id);
    },

    /**
     * A parent forgot the password: staff with `guardians.manage` clear it, every session ends, and the parent signs in again with the
     * phone number and sets a new one. Refused for anyone who is also staff or a lecturer, whose accounts must never fall back to phone-only entry. Audited (J3).
     */
    async resetParentPassword(input: { guardianId: string; actor: string }): Promise<void> {
      if (!(await authorizeAnywhere(db, input.actor, "guardians.manage"))) throw new ServiceError("forbidden", "You may not reset parent passwords.");
      await db.transaction(async (tx) => {
        const [g] = await tx.select({ userId: guardian.userId }).from(guardian).where(eq(guardian.id, input.guardianId));
        if (!g?.userId) throw new ServiceError("not_found", "That parent has no login.");
        const identity = await resolveIdentity(tx, g.userId);
        if (!identity) throw new ServiceError("not_found", "That parent has no login.");
        if (identity.staffAssignments.length > 0 || identity.lecturerId) throw new ServiceError("forbidden", "This account is also staff or a lecturer; reset it another way.");
        await tx.update(user).set({ passwordHash: null }).where(eq(user.id, g.userId));
        await tx.delete(authSession).where(eq(authSession.userId, g.userId));
        await writeAudit(tx, { actor: input.actor, action: "user.password_reset", entityType: "user", entityId: g.userId });
      });
    },

    // ---- second step (authenticator app)

    /** Step 1 of enrolment: a fresh secret and the otpauth link to show as a QR code. Replaces an unconfirmed attempt. */
    async beginMfaEnrollment(input: { token: string }): Promise<{ secret: string; uri: string }> {
      const { s, principal } = await openSession(input.token);
      if (principal.restriction === "set_password") throw new ServiceError("password_setup_required", "Set a password first.");
      const [existing] = await db.select({ enabledAt: userTwoFactor.enabledAt }).from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId));
      if (existing?.enabledAt) throw new ServiceError("forbidden", "Two-step sign-in is already on.");
      const secret = newTotpSecret();
      const secretCipher = encrypt(opts.secretKey, secret);
      await db
        .insert(userTwoFactor)
        .values({ userId: s.userId, secretCipher })
        .onConflictDoUpdate({ target: userTwoFactor.userId, set: { secretCipher, recoveryHashes: [], createdAt: now() } });
      const [u] = await db.select({ email: user.email, username: user.username }).from(user).where(eq(user.id, s.userId));
      return { secret, uri: otpauthUri({ secret, account: u?.email ?? u?.username ?? s.userId, issuer }) };
    },

    /** Step 2: the first code from the app turns it on and returns the recovery codes. Show them once. This session counts as verified. Audited (J3). */
    async confirmMfaEnrollment(input: { token: string; code: string }): Promise<{ recoveryCodes: string[] }> {
      const { s } = await openSession(input.token);
      await hit(db, `code:${s.userId}`, CODE_TRIES, now());
      const [tf] = await db.select().from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId));
      if (!tf || tf.enabledAt) throw new ServiceError("forbidden", "Start the setup first.");
      if (!checkCode(tf.secretCipher, input.code)) throw new ServiceError("invalid_code", "That code is wrong or expired.");
      const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
      await db.transaction(async (tx) => {
        await tx.update(userTwoFactor).set({ enabledAt: now(), recoveryHashes: codes.map((c) => sha256(recoveryNormal(c))) }).where(eq(userTwoFactor.userId, s.userId));
        await tx.update(authSession).set({ mfaVerifiedAt: now() }).where(eq(authSession.id, s.id));
        await writeAudit(tx, { actor: s.userId, action: "user.mfa_enabled", entityType: "user", entityId: s.userId });
      });
      await clear(db, `code:${s.userId}`);
      return { recoveryCodes: codes };
    },

    /** Finishes sign-in with an authenticator code or a one-time recovery code (each works once). */
    async verifyMfa(input: { token: string; code: string }): Promise<Principal> {
      const { s } = await openSession(input.token);
      await hit(db, `code:${s.userId}`, CODE_TRIES, now());
      const ok = await db.transaction(async (tx) => {
        const [tf] = await tx.select().from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId)).for("update");
        if (!tf?.enabledAt) throw new ServiceError("mfa_setup_required", "Set up two-step sign-in first.");
        if (checkCode(tf.secretCipher, input.code)) return true;
        const hash = sha256(recoveryNormal(input.code));
        if (!tf.recoveryHashes.includes(hash)) return false;
        await tx.update(userTwoFactor).set({ recoveryHashes: tf.recoveryHashes.filter((h) => h !== hash) }).where(eq(userTwoFactor.userId, s.userId));
        return true;
      });
      if (!ok) throw new ServiceError("invalid_code", "That code is wrong or expired.");
      await db.update(authSession).set({ mfaVerifiedAt: now() }).where(eq(authSession.id, s.id));
      await clear(db, `code:${s.userId}`);
      return (await buildPrincipal({ ...s, mfaVerifiedAt: now() }))!;
    },

    /**
     * Lost phone: a root administrator removes another user's authenticator and signs them out; they must enrol a new one at the next
     * sign-in. A root administrator cannot do this to themselves. Audited (J3).
     */
    async resetMfa(input: { userId: string; actor: string }): Promise<void> {
      if (input.userId === input.actor) throw new ServiceError("forbidden", "Ask another root administrator to reset your two-step sign-in.");
      if (!(await isRootAdmin(db, input.actor))) throw new ServiceError("forbidden", "Only a root administrator can reset two-step sign-in.");
      await db.transaction(async (tx) => {
        const removed = await tx.delete(userTwoFactor).where(eq(userTwoFactor.userId, input.userId)).returning({ id: userTwoFactor.userId });
        if (removed.length === 0) throw new ServiceError("not_found", "That user has no two-step sign-in.");
        await tx.delete(authSession).where(eq(authSession.userId, input.userId));
        await writeAudit(tx, { actor: input.actor, action: "user.mfa_reset", entityType: "user", entityId: input.userId });
      });
    },

    // ---- guards for the API layer

    /** Throws the right error while the session is half signed in (password to set, code to enter, authenticator to enrol). */
    assertReady(principal: Principal): void {
      if (principal.restriction === "set_password") throw new ServiceError("password_setup_required", "Set a password first.");
      if (principal.restriction === "mfa") throw new ServiceError("mfa_required", "Enter your authenticator code.");
      if (principal.restriction === "mfa_setup") throw new ServiceError("mfa_setup_required", "Set up two-step sign-in first.");
    },

    requirePortal(principal: Principal, portal: keyof Identity["portals"]): void {
      this.assertReady(principal);
      if (!principal.portals[portal]) throw new ServiceError("forbidden", "You cannot use this portal.");
    },

    /** Housekeeping job: deletes expired sessions and old rate-limit counters. Returns how many sessions went. */
    async purgeExpired(): Promise<number> {
      const gone = await db.delete(authSession).where(lt(authSession.expiresAt, now())).returning({ id: authSession.id });
      await db.delete(authRateLimit).where(lt(authRateLimit.windowStart, new Date(now().getTime() - 24 * 3_600_000)));
      return gone.length;
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
