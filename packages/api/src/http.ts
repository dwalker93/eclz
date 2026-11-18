import { ServiceError, type ServiceErrorCode } from "@workspace/domain";
import type { Context } from "hono";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 429,
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

/** Maps any thrown error to a JSON `{ error: { code, message } }`. Unknown errors are logged and never leak details. */
export function onError(err: unknown, c: Context) {
  if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
  if (err instanceof ServiceError) return c.json({ error: { code: err.code, message: err.message } }, STATUS[err.code] ?? 422);
  if (err instanceof ZodError) {
    return c.json({ error: { code: "invalid_request", message: "Invalid request", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } }, 400);
  }
  console.error("unhandled error", err);
  return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
}

/** Parses a JSON body with a zod schema (invalid: 400). An empty body counts as `{}`. */
export async function jsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  const text = await c.req.text();
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
