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

/**
 * The address the per-address sign-in limit counts. Forwarded headers are read only with `trustProxy` (a proxy you control that overwrites them).
 * Otherwise, and when such a proxy sent none, it is the peer address the server adapter handed to `fetch` (see `withPeerAddress`), so a direct
 * Bun setup keeps the limit; with neither, there is no address and only the identifier limit applies.
 */
export function clientIp(c: Context, cfg: SessionConfig): string | null {
  if (cfg.trustProxy) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  const peer = (c.env as { peerAddress?: unknown } | undefined)?.peerAddress;
  return typeof peer === "string" && peer ? peer : null;
}

/**
 * For `Bun.serve` without a proxy: `Bun.serve({ fetch: withPeerAddress(api) })`. The socket's peer address goes to the app as `c.env.peerAddress`,
 * never from a request header, so it cannot be forged by the client.
 */
export function withPeerAddress(app: { fetch: (req: Request, env?: unknown) => Response | Promise<Response> }) {
  return (req: Request, server: { requestIP(req: Request): { address: string } | null }) => app.fetch(req, { peerAddress: server.requestIP(req)?.address ?? null });
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
