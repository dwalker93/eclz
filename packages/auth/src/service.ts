import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { authRateLimit, authSession, guardian, user, userTwoFactor } from "@workspace/db/schema";
import {
  authorizeAnywhere,
  canonicalUuid,
  guardianInScope,
  createAccessControlService,
  isRootAdmin,
  normalizeSriLankaPhone,
  firstLoginStillValidIn,
  resolveIdentity,
  ServiceError,
  setInitialPasswordIn,
  writeAudit,
  type Db,
  type Identity,
  type Tx,
} from "@workspace/domain";
import { decrypt, encrypt, newToken, sha256 } from "./crypto";
import { burnTime, checkPassword, hashPassword, verifyPassword } from "./password";
import { clear, hit } from "./rate-limit";
import { newTotpSecret, otpauthUri, verifyTotp } from "./totp";

type Q = Db | Tx;
type UserRow = typeof user.$inferSelect;
const PHONE_LIKE = /^[\d\s+()-]{9,}$/;
/** How many password checks a failed sign-in costs: findCandidates can return two accounts only for a phone-like identifier. */
const passwordCheckBudget = (identifier: string) => (PHONE_LIKE.test(identifier.trim()) ? 2 : 1);

/**
 * The sign-in counter key. Phone numbers are canonical, so `0771234567` and `077 1234567` share one counter, the same canonical form the
 * lookup uses. Emails are case-insensitive; a username keeps its case because username lookup is case-sensitive.
 */
export function signInKey(raw: string): string {
  const id = raw.trim().slice(0, 200);
  if (id.includes("@")) return `signin:id:${id.toLowerCase()}`;
  if (PHONE_LIKE.test(id)) return `signin:id:phone:${normalizeSriLankaPhone(id) ?? id.replace(/\D/g, "")}`;
  return `signin:id:user:${id}`;
}

/** The failure counter of one account, shared by every identifier that reaches it. */
const accountSignInKey = (userId: string) => `signin:acct:${userId}`;

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

function assertReadyPrincipal(principal: Principal): void {
  if (principal.restriction === "set_password") throw new ServiceError("password_setup_required", "Set a password first.");
  if (principal.restriction === "mfa") throw new ServiceError("mfa_required", "Enter your authenticator code.");
  if (principal.restriction === "mfa_setup") throw new ServiceError("mfa_setup_required", "Set up two-step sign-in first.");
}

export function createAuthService(db: Db, opts: AuthOptions) {
  if (opts.secretKey.length < 16) throw new Error("secretKey must be at least 16 characters.");
  const now = () => (opts.now ?? (() => new Date()))();
  const acl = createAccessControlService(db);
  const issuer = opts.issuer ?? "Student Management";

  const bad = () => new ServiceError("invalid_credentials", "Wrong sign-in details.");
  const noSession = () => new ServiceError("unauthenticated", "Please sign in.");

  /**
   * Issues a session under a lock on the user row, the same lock every credential change takes (set or change password, disable). The
   * authentication condition is checked again inside the lock: the account must still be active and still hold the password hash the
   * caller verified (`null` for a first login). If a credential change got in between, no session is issued. A first login (`firstLoginPhone`, the
   * normalized number it signed in with) also repeats the lookup's conditions here, because the lookup ran before the lock: the account must still have
   * that phone and still be an active, passwordless guardian account with the portal on and no staff or lecturer role.
   */
  async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null }, expectHash: string | null, firstLoginPhone?: string): Promise<SignedIn> {
    const token = newToken();
    return db.transaction(async (tx) => {
      const [u] = await tx.select().from(user).where(eq(user.id, userId)).for("update");
      if (!u || u.status !== "active" || u.passwordHash !== expectHash) throw bad();
      const identity = await resolveIdentity(tx, userId);
      if (!identity?.active) throw bad();
      if (expectHash === null && !(firstLoginPhone && (await firstLoginStillValidIn(tx, userId, firstLoginPhone)))) throw bad();
      const hours = identity.portals.admin ? (opts.staffSessionHours ?? 12) : (opts.sessionDays ?? 30) * 24;
      const expiresAt = new Date(now().getTime() + hours * 3_600_000);
      const [s] = await tx
        .insert(authSession)
        .values({ userId, tokenHash: sha256(token), expiresAt, lastSeenAt: now(), mfaVerifiedAt: null, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null })
        .returning();
      await tx.update(user).set({ lastLoginAt: now() }).where(eq(user.id, userId));
      return { token, expiresAt, principal: (await buildPrincipal(tx, s!))! };
    });
  }

  async function sessionRow(token: string) {
    const [s] = await db.select().from(authSession).where(eq(authSession.tokenHash, sha256(token)));
    if (!s || s.expiresAt <= now()) return null;
    return s;
  }

  async function buildPrincipal(q: Q, s: typeof authSession.$inferSelect): Promise<Principal | null> {
    const identity = await resolveIdentity(q, s.userId);
    if (!identity?.active) return null;
    const [tf] = await q.select({ enabledAt: userTwoFactor.enabledAt }).from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId));
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
    const principal = await buildPrincipal(db, s);
    if (!principal) throw noSession();
    return { s, principal };
  }

  /**
   * Every account the identifier can name. An email names one. A phone-looking identifier names the one active parent account with that
   * phone and a password, and also the account whose username is exactly that text (a numeric username is legal), so both are tried.
   */
  async function findCandidates(raw: string): Promise<UserRow[]> {
    const id = raw.trim();
    if (!id || id.length > 200) return [];
    if (id.includes("@")) return db.select().from(user).where(eq(user.email, id.toLowerCase()));
    const out: UserRow[] = [];
    if (PHONE_LIKE.test(id)) {
      const phone = normalizeSriLankaPhone(id);
      if (phone) {
        const rows = (await db.select().from(user).where(eq(user.phone, phone))).filter((r) => r.status === "active" && r.passwordHash);
        if (rows.length === 1) out.push(rows[0]!);
      }
    }
    for (const r of await db.select().from(user).where(eq(user.username, id))) if (!out.some((o) => o.id === r.id)) out.push(r);
    return out;
  }

  async function revokeOthers(q: Q, userId: string, keepSessionId: string) {
    await q.delete(authSession).where(and(eq(authSession.userId, userId), ne(authSession.id, keepSessionId)));
  }

  /**
   * Locks the user row and confirms the caller's session still exists and has not expired, so a credential change cannot outlive the session that asked
   * for it: not one deleted, and not one that ran out while the operation was hashing or waiting (the row stays until `purgeExpired` removes it).
   */
  async function lockUserAndSession(tx: Tx, userId: string, sessionId: string) {
    const [u] = await tx.select().from(user).where(eq(user.id, userId)).for("update");
    const [alive] = await tx.select({ id: authSession.id, expiresAt: authSession.expiresAt }).from(authSession).where(eq(authSession.id, sessionId));
    if (!u || !alive || alive.expiresAt <= now()) throw noSession();
    return u;
  }

  async function markSessionVerified(tx: Tx, sessionId: string) {
    const rows = await tx.update(authSession).set({ mfaVerifiedAt: now() }).where(eq(authSession.id, sessionId)).returning({ id: authSession.id });
    if (rows.length === 0) throw noSession();
  }

  return {
    // ---- sign in

    /**
     * Email, username or (parent accounts) phone plus password. Every failure looks the same (`invalid_credentials`) and costs the same time.
     * Attempts are limited per identifier and per address. Staff and anyone with an authenticator get a session that opens nothing until
     * `verifyMfa` (or enrolment) is done: see `principal.restriction`.
     */
    async signIn(input: { identifier: string; password: string; ip?: string | null; userAgent?: string | null }): Promise<SignedIn> {
      const idKey = signInKey(input.identifier);
      if (input.ip) await hit(db, `signin:ip:${input.ip}`, SIGN_IN_IP, now());
      await hit(db, idKey, SIGN_IN_ID, now());
      let matched: UserRow | null = null;
      let tried = 0;
      let throttled = false;
      const usable = (await findCandidates(input.identifier)).filter((c) => c.passwordHash && c.status === "active");
      for (const c of usable) {
        // Each account has its own failure count, whatever the identifier that reached it. An identifier can name two accounts (a numeric username and a
        // phone account), and one identifier, or a different one for the same account (email, username, phone), has its own input counter above; neither a
        // sign-in to one account nor another spelling can reset or dodge the count of the account that is being guessed. A locked account is skipped, so it
        // cannot stop the owner of the other account from signing in.
        try {
          await hit(db, accountSignInKey(c.id), SIGN_IN_ID, now());
        } catch (e) {
          if (e instanceof ServiceError && e.code === "rate_limited") {
            throttled = true;
            continue;
          }
          throw e;
        }
        tried++;
        if (await verifyPassword(input.password, c.passwordHash!)) {
          matched = c;
          break;
        }
      }
      if (!matched) {
        if (throttled) throw new ServiceError("rate_limited", "Too many attempts. Try again later.");
        // A failure costs the same password work whatever the identifier matched: an identifier that can name two accounts (a phone number and a numeric
        // username) always costs two checks, any other costs one. Unused checks are made against a throwaway hash.
        for (let i = tried; i < passwordCheckBudget(input.identifier); i++) await burnTime(input.password);
        throw bad();
      }
      const signedIn = await createSession(matched.id, input, matched.passwordHash);
      await clear(db, accountSignInKey(matched.id));
      // The input counter is cleared only when the identifier named this one account; for an identifier that names two, a success proves nothing about the other.
      if (usable.length === 1) await clear(db, idKey);
      return signedIn;
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
      if (!found || !phone) throw bad();
      return createSession(found.userId, input, null, phone);
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
      const passwordHash = await hashPassword(input.newPassword);
      // The password, its audit row and the end of every other session commit together or not at all.
      await db.transaction(async (tx) => {
        await lockUserAndSession(tx, s.userId, s.id);
        await setInitialPasswordIn(tx, { userId: s.userId, passwordHash });
        await revokeOthers(tx, s.userId, s.id);
      });
      return (await buildPrincipal(db, s))!;
    },

    /** Needs the current password. Signs out the account's other sessions. Audited (J3). */
    async changePassword(input: { token: string; currentPassword: string; newPassword: string }): Promise<void> {
      const { s, principal } = await openSession(input.token);
      // A credential change needs a session that is fully signed in: not one still waiting for a first password, an authenticator code or an enrolment.
      assertReadyPrincipal(principal);
      await hit(db, `pw:${s.userId}`, PASSWORD_TRIES, now());
      const [u] = await db.select().from(user).where(eq(user.id, s.userId));
      if (!u?.passwordHash || !(await verifyPassword(input.currentPassword, u.passwordHash))) throw bad();
      checkPassword(input.newPassword);
      const passwordHash = await hashPassword(input.newPassword);
      await db.transaction(async (tx) => {
        const cur = await lockUserAndSession(tx, u.id, s.id);
        // The password verified above must still be the current one, or two changes could both pass on the old password.
        if (cur.passwordHash !== u.passwordHash) throw bad();
        await tx.update(user).set({ passwordHash }).where(eq(user.id, u.id));
        await writeAudit(tx, { actor: u.id, action: "user.password_changed", entityType: "user", entityId: u.id });
        await revokeOthers(tx, u.id, s.id);
      });
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
        // The same guardian rule as profile and phone updates: all-branches staff, or staff who manage a branch of one of the parent's
        // children. A parent with no student in a branch can only be reset by an all-branches holder.
        if (!(await guardianInScope(tx, input.actor, input.guardianId))) throw new ServiceError("forbidden", "You may not reset this parent: none of their students is in your branches.");
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
      const secret = newTotpSecret();
      const secretCipher = encrypt(opts.secretKey, secret);
      // One conditional write: it replaces an unconfirmed attempt but never an enabled authenticator, whatever runs beside it.
      const written = await db
        .insert(userTwoFactor)
        .values({ userId: s.userId, secretCipher })
        .onConflictDoUpdate({ target: userTwoFactor.userId, set: { secretCipher, recoveryHashes: [], lastUsedStep: null, createdAt: now() }, setWhere: isNull(userTwoFactor.enabledAt) })
        .returning({ userId: userTwoFactor.userId });
      if (written.length === 0) throw new ServiceError("forbidden", "Two-step sign-in is already on.");
      const [u] = await db.select({ email: user.email, username: user.username }).from(user).where(eq(user.id, s.userId));
      return { secret, uri: otpauthUri({ secret, account: u?.email ?? u?.username ?? s.userId, issuer }) };
    },

    /** Step 2: the first code from the app turns it on and returns the recovery codes. Show them once. This session counts as verified. Audited (J3). */
    async confirmMfaEnrollment(input: { token: string; code: string }): Promise<{ recoveryCodes: string[] }> {
      const { s } = await openSession(input.token);
      await hit(db, `code:${s.userId}`, CODE_TRIES, now());
      const [tf] = await db.select().from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId));
      if (!tf || tf.enabledAt) throw new ServiceError("forbidden", "Start the setup first.");
      const step = verifyTotp(decrypt(opts.secretKey, tf.secretCipher), input.code, now());
      if (step === null) throw new ServiceError("invalid_code", "That code is wrong or expired.");
      const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
      await db.transaction(async (tx) => {
        // Enables the exact secret whose code was checked; if the secret was replaced or already enabled meanwhile, nothing is enabled.
        const enabled = await tx
          .update(userTwoFactor)
          .set({ enabledAt: now(), recoveryHashes: codes.map((c) => sha256(recoveryNormal(c))), lastUsedStep: step })
          .where(and(eq(userTwoFactor.userId, s.userId), isNull(userTwoFactor.enabledAt), eq(userTwoFactor.secretCipher, tf.secretCipher)))
          .returning({ userId: userTwoFactor.userId });
        if (enabled.length === 0) throw new ServiceError("forbidden", "The setup changed. Start it again.");
        await markSessionVerified(tx, s.id);
        await writeAudit(tx, { actor: s.userId, action: "user.mfa_enabled", entityType: "user", entityId: s.userId });
        // The counter is cleared in the same transaction: a failure here rolls the enrolment back too, never reports a failure for one that committed.
        await clear(tx, `code:${s.userId}`);
      });
      return { recoveryCodes: codes };
    },

    /** Finishes sign-in with an authenticator code or a one-time recovery code (each works once). */
    async verifyMfa(input: { token: string; code: string }): Promise<Principal> {
      const { s } = await openSession(input.token);
      await hit(db, `code:${s.userId}`, CODE_TRIES, now());
      // Code use, recovery-code use and the session's verified mark commit together: a failure leaves the code available for a retry.
      const ok = await db.transaction(async (tx) => {
        const [tf] = await tx.select().from(userTwoFactor).where(eq(userTwoFactor.userId, s.userId)).for("update");
        if (!tf?.enabledAt) throw new ServiceError("mfa_setup_required", "Set up two-step sign-in first.");
        const step = verifyTotp(decrypt(opts.secretKey, tf.secretCipher), input.code, now());
        if (step !== null) {
          // Each 30-second step is accepted once (RFC 6238): a code for a step already used, or an older one, is refused.
          if (tf.lastUsedStep !== null && step <= tf.lastUsedStep) return false;
          await tx.update(userTwoFactor).set({ lastUsedStep: step }).where(eq(userTwoFactor.userId, s.userId));
        } else {
          const hash = sha256(recoveryNormal(input.code));
          if (!tf.recoveryHashes.includes(hash)) return false;
          await tx.update(userTwoFactor).set({ recoveryHashes: tf.recoveryHashes.filter((h) => h !== hash) }).where(eq(userTwoFactor.userId, s.userId));
        }
        await markSessionVerified(tx, s.id);
        // Cleared in the same transaction as the code's use: if the clearing fails, the code is not consumed and a retry with it can still finish.
        await clear(tx, `code:${s.userId}`);
        return true;
      });
      if (!ok) throw new ServiceError("invalid_code", "That code is wrong or expired.");
      return (await buildPrincipal(db, { ...s, mfaVerifiedAt: now() }))!;
    },

    /**
     * Lost phone: a root administrator removes another user's authenticator and signs them out; they must enrol a new one at the next
     * sign-in. A root administrator cannot do this to themselves. Audited (J3).
     */
    async resetMfa(input: { userId: string; actor: string }): Promise<void> {
      // Both ids in one spelling first: the database reads upper-case and braced uuids as the same account, a string comparison does not.
      input = { userId: canonicalUuid(input.userId), actor: canonicalUuid(input.actor) };
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
      assertReadyPrincipal(principal);
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
