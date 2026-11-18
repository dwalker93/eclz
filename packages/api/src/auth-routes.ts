import type { AuthService } from "@workspace/auth";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "./http";
import { clearSessionCookie, clientIp, sessionToken, setSessionCookie, summary, withPrincipal, type Env, type SessionConfig } from "./session";
import { HttpError } from "./http";

const code = z.string().min(6).max(20);

/** Sign-in steps. Mounted at /auth. Everything here works with a half signed-in session; nothing else does. */
export function createAuthRoutes(auth: AuthService, cfg: SessionConfig) {
  const app = new Hono<Env>();
  const needToken = (c: Parameters<typeof sessionToken>[0]) => {
    const t = sessionToken(c, cfg);
    if (!t) throw new HttpError(401, "unauthenticated", "Please sign in.");
    return t;
  };
  const meta = (c: Parameters<typeof sessionToken>[0]) => ({ ip: clientIp(c, cfg), userAgent: c.req.header("user-agent") ?? null });

  app.post("/sign-in", async (c) => {
    const b = await jsonBody(c, z.object({ identifier: z.string().min(1).max(200), password: z.string().min(1).max(200) }));
    const r = await auth.signIn({ ...b, ...meta(c) });
    setSessionCookie(c, cfg, r.token, r.expiresAt);
    return c.json(summary(r.principal));
  });

  app.post("/first-login", async (c) => {
    const b = await jsonBody(c, z.object({ phone: z.string().min(5).max(30) }));
    const r = await auth.firstLogin({ ...b, ...meta(c) });
    setSessionCookie(c, cfg, r.token, r.expiresAt);
    return c.json(summary(r.principal));
  });

  app.post("/set-password", async (c) => {
    const b = await jsonBody(c, z.object({ newPassword: z.string().max(200) }));
    return c.json(summary(await auth.setPassword({ token: needToken(c), ...b })));
  });

  app.post("/mfa/verify", async (c) => {
    const b = await jsonBody(c, z.object({ code }));
    return c.json(summary(await auth.verifyMfa({ token: needToken(c), ...b })));
  });
  app.post("/mfa/begin", async (c) => c.json(await auth.beginMfaEnrollment({ token: needToken(c) })));
  app.post("/mfa/confirm", async (c) => {
    const b = await jsonBody(c, z.object({ code }));
    return c.json(await auth.confirmMfaEnrollment({ token: needToken(c), ...b }));
  });

  app.post("/change-password", async (c) => {
    const b = await jsonBody(c, z.object({ currentPassword: z.string().max(200), newPassword: z.string().max(200) }));
    await auth.changePassword({ token: needToken(c), ...b });
    return c.json({ ok: true });
  });

  app.post("/sign-out", async (c) => {
    const t = sessionToken(c, cfg);
    if (t) await auth.signOut(t);
    clearSessionCookie(c, cfg);
    return c.json({ ok: true });
  });

  app.get("/me", withPrincipal(auth, cfg), (c) => c.json(summary(c.get("principal"))));
  return app;
}
