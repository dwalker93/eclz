import type { MiddlewareHandler } from "hono";
import { HttpError } from "./http";

/**
 * The serialized origin of a URL-like string (scheme and host lower-case, a default port dropped, a non-default port kept), or null when it is
 * not an http(s) origin. A path, query, fragment or credentials make an entry invalid: an origin is only scheme, host and port.
 */
function originOf(value: string): string | null {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return null;
  return u.origin;
}

/** The request's Origin header in the same form as the configured entries (null for `null`, junk or a non-http origin: never allowed). */
const norm = (o: string) => originOf(o);

function allowedSet(trusted: readonly string[] | undefined) {
  if (!trusted || trusted.length === 0) throw new Error("trustedOrigins must list at least one origin (CSRF guard)");
  // Every entry must be a real origin, or the API would start with a guard that refuses all browser writes: say which entry is wrong.
  return new Set(
    trusted.map((entry, i) => {
      const o = typeof entry === "string" ? originOf(entry) : null;
      if (o === null) throw new Error(`trustedOrigins[${i}] (${JSON.stringify(entry)}) is not a valid http(s) origin; use scheme, host and optional port, like https://admin.example.com`);
      return o;
    }),
  );
}

/**
 * CSRF guard for cookie sessions. A state-changing request from a browser must come from one of our own origins. With an Origin header it
 * must be a trusted one. Without one, the browser's Sec-Fetch-Site decides: `same-origin` and `none` (the user's own navigation) pass, and any
 * other value (`same-site`, from an untrusted sibling subdomain whose requests still carry SameSite=Lax cookies, or `cross-site`) is refused.
 * With neither header (curl, server to server) the request passes only if it carries no session cookie, since a browser would have sent one
 * of the two. An empty list, or an entry that is not an http(s) origin, throws at start-up: skipping the guard silently would be worse.
 */
export const requireTrustedOrigin = (trusted: readonly string[] | undefined, opts: { cookieName?: string } = {}): MiddlewareHandler => {
  const allowed = allowedSet(trusted);
  const cookieName = opts.cookieName ?? "sms_session";
  const hasSessionCookie = (header: string | undefined) => (header ?? "").split(";").some((p) => p.trim().startsWith(`${cookieName}=`));
  return async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") return next();
    const origin = c.req.header("origin");
    if (origin !== undefined) {
      const o = norm(origin);
      if (o === null || !allowed.has(o)) throw new HttpError(403, "bad_origin", "Request origin is not allowed");
    } else {
      const site = c.req.header("sec-fetch-site");
      if (site !== undefined) {
        if (site !== "same-origin" && site !== "none") throw new HttpError(403, "bad_origin", "Cross-site request refused");
      } else if (hasSessionCookie(c.req.header("cookie"))) {
        throw new HttpError(403, "bad_origin", "A request with a session cookie must say where it comes from");
      }
    }
    await next();
  };
};

const CORS_METHODS = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";

/**
 * CORS for the same origins the CSRF guard trusts, matched with the same normalization, with credentials (the session is a cookie). A trusted
 * origin gets its preflight answered (204) and the matching headers on every real response, errors included; any other origin gets no CORS
 * headers, so the browser blocks it. Mount it before `requireTrustedOrigin`. Not needed when the web app reaches the API through a same-origin proxy.
 */
export const trustedCors = (trusted: readonly string[] | undefined): MiddlewareHandler => {
  const allowed = allowedSet(trusted);
  return async (c, next) => {
    const origin = c.req.header("origin");
    const o = origin === undefined ? null : norm(origin);
    const ok = o !== null && allowed.has(o);
    const decorate = () => {
      c.header("Vary", "Origin", { append: true });
      if (ok) {
        c.header("Access-Control-Allow-Origin", origin!);
        c.header("Access-Control-Allow-Credentials", "true");
      }
    };
    if (c.req.method === "OPTIONS" && c.req.header("access-control-request-method") !== undefined) {
      decorate();
      if (ok) {
        c.header("Access-Control-Allow-Methods", CORS_METHODS);
        c.header("Access-Control-Allow-Headers", c.req.header("access-control-request-headers") ?? "content-type");
        c.header("Access-Control-Max-Age", "600");
      }
      return c.body(null, 204);
    }
    await next();
    decorate();
  };
};
