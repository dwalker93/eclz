import { ServiceError, type ServiceErrorCode } from "@workspace/domain";
import type { Context } from "hono";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 413 | 429,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Status = 400 | 401 | 403 | 404 | 409 | 422 | 429;
/** Everything not listed is a broken business rule on a valid request: 422. */
const STATUS: Partial<Record<ServiceErrorCode, Status>> = {
  unauthenticated: 401,
  invalid_credentials: 401,
  forbidden: 403,
  module_disabled: 403,
  mfa_required: 403,
  mfa_setup_required: 403,
  password_setup_required: 403,
  rate_limited: 429,
  not_found: 404,
  invalid_input: 400,
  weak_password: 400,
  invalid_code: 400,
  last_root_admin: 409,
  already_purchased: 409,
  already_handed_over: 409,
  payment_not_pending: 409,
  guardian_linked: 409,
  
  phone_taken: 409,
  rule_overlap: 409,
  rule_in_use: 409,
};

const SQLSTATE = /^[0-9A-Z]{5}$/;

/** A failed database query: Drizzle's query error, or the driver's own error (a five-character SQLSTATE `code`), at any depth of the cause chain. */
function queryFailure(err: unknown): { name: string; code?: string; constraint?: string } | null {
  let e: unknown = err;
  for (let depth = 0; e && typeof e === "object" && depth < 6; depth++) {
    const o = e as { name?: unknown; code?: unknown; constraint?: unknown; query?: unknown; params?: unknown; cause?: unknown };
    const isDrizzle = o.name === "DrizzleQueryError" || ("query" in o && "params" in o);
    const isDriver = typeof o.code === "string" && SQLSTATE.test(o.code) && ("severity" in o || "routine" in o || "schema" in o || "table" in o || "constraint" in o);
    if (isDrizzle || isDriver) {
      // Take the SQLSTATE and constraint name from whichever level of the chain carries them.
      let code: string | undefined;
      let constraint: string | undefined;
      let x: unknown = err;
      for (let d = 0; x && typeof x === "object" && d < 6; d++) {
        const xo = x as { code?: unknown; constraint?: unknown; cause?: unknown };
        if (!code && typeof xo.code === "string" && SQLSTATE.test(xo.code)) code = xo.code;
        if (!constraint && typeof xo.constraint === "string") constraint = xo.constraint;
        x = xo.cause;
      }
      return { name: typeof o.name === "string" ? o.name : "Error", code, constraint };
    }
    e = o.cause;
  }
  return null;
}

/**
 * What the log gets for an unexpected error. A failed query's message carries the bound values (a student's name, birth date, NIC, phone and
 * email; a guardian's contact details) and its `cause` the raw database error with the same data, so for those only the error name, the SQLSTATE,
 * the constraint name and the request are logged: never the message, the parameters, the `detail` or the cause. Other errors are logged whole.
 */
export function describeUnexpected(err: unknown, c: Context): unknown {
  const q = queryFailure(err);
  if (!q) return err;
  return { kind: "database_error", ...q, method: c.req.method, path: c.req.path };
}

/** Maps any thrown error to a JSON `{ error: { code, message } }`. Unknown errors are logged and never leak details. */
export function onError(err: unknown, c: Context) {
  if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
  if (err instanceof ServiceError) return c.json({ error: { code: err.code, message: err.message } }, STATUS[err.code] ?? 422);
  if (err instanceof ZodError) {
    return c.json({ error: { code: "invalid_request", message: "Invalid request", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } }, 400);
  }
  console.error("unhandled error", describeUnexpected(err, c));
  return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
}

/** Largest JSON body a route accepts unless it asks for more: far above any normal form, far below anything that costs real memory. */
export const JSON_BODY_LIMIT = 64 * 1024;
/** For the few routes that take a batch of up to 500 entries with free-text fields (marks, attendance). */
export const LARGE_JSON_BODY_LIMIT = 512 * 1024;

const tooLarge = () => new HttpError(413, "payload_too_large", "Request body is too large");

/**
 * Reads the body as text, refusing more than `maxBytes` (413). A declared `Content-Length` over the limit is refused without reading anything;
 * because that header can be absent or wrong, the stream is also counted and cancelled the moment it passes the limit, so at most `maxBytes`
 * (plus one chunk) is ever held in memory.
 */
async function readTextLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = req.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) throw tooLarge();
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Parses a JSON body with a zod schema (invalid: 400, over `maxBytes`: 413, checked before parsing). An empty body counts as `{}`. */
export async function jsonBody<T>(c: Context, schema: ZodType<T>, maxBytes: number = JSON_BODY_LIMIT): Promise<T> {
  const text = await readTextLimited(c.req.raw, maxBytes);
  let raw: unknown = {};
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, "invalid_json", "Body must be valid JSON");
    }
  }
  return schema.parse(raw);
}
