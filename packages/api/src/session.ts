import type { AuthService, Principal } from "@workspace/auth";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export interface Env {
  Variables: { principal: Principal };
}

export interface SessionConfig {
  cookieName: string;
  /** false only for local http development. */
  secureCookie: boolean;
  /** Read the client address from X-Forwarded-For. Turn on only behind a proxy you control. */
  trustProxy: boolean;
}

export const setSessionCookie = (c: Context, cfg: SessionConfig, token: string, expiresAt: Date) =>
  setCookie(c, cfg.cookieName, token, { httpOnly: true, secure: cfg.secureCookie, sameSite: "Lax", path: "/", expires: expiresAt });

export const clearSessionCookie = (c: Context, cfg: SessionConfig) => deleteCookie(c, cfg.cookieName, { path: "/", secure: cfg.secureCookie });

export const sessionToken = (c: Context, cfg: SessionConfig) => getCookie(c, cfg.cookieName) ?? null;

export function clientIp(c: Context, cfg: SessionConfig): string | null {
  if (!cfg.trustProxy) return null;
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** Puts the principal on the context, or answers 401. The session may still be half signed in (see `restriction`). */
export const withPrincipal = (auth: AuthService, cfg: SessionConfig): MiddlewareHandler<Env> => async (c, next) => {
  c.set("principal", await auth.authenticate(sessionToken(c, cfg)));
  await next();
};

/** For everything except the sign-in steps: password set, code entered, authenticator enrolled. */
export const requireReady = (auth: AuthService): MiddlewareHandler<Env> => async (c, next) => {
  auth.assertReady(c.get("principal"));
  await next();
};

export const requirePortalOf = (auth: AuthService, portal: keyof Principal["portals"]): MiddlewareHandler<Env> => async (c, next) => {
  auth.requirePortal(c.get("principal"), portal);
  await next();
};

export const summary = (p: Principal) => ({
  userId: p.userId,
  restriction: p.restriction,
  portals: p.portals,
  needsPasswordSetup: p.identity.needsPasswordSetup,
});
