import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "../schema";

/** Any Drizzle Postgres database over the schema: postgres-js in production, PGlite in tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type ServiceErrorCode =
  | "invalid_input"
  | "not_found"
  | "payment_not_pending"
  | "payment_not_verified"
  | "payment_method_invalid"
  | "bank_account_invalid"
  | "slip_required"
  | "duplicate_reference"
  | "invoice_not_payable"
  | "item_not_payable"
  | "allocation_exceeds_outstanding"
  | "allocation_mismatch"
  | "reason_required"
  | "student_not_eligible"
  | "course_not_open"
  | "capacity_full"
  | "duplicate_enrollment"
  | "intake_invalid"
  | "grade_not_allowed"
  | "fee_structure_required"
  | "fee_structure_invalid"
  | "rate_missing"
  | "module_disabled"
  | "invoice_not_adjustable"
  | "total_below_paid"
  | "invoice_has_payments"
  | "exception_invalid"
  | "promotion_not_draft"
  | "promotion_unresolved"
  | "promotion_date_invalid"
  | "promotion_stale"
  | "payout_not_draft"
  | "payout_not_approved"
  | "payout_period_invalid"
  | "payout_nothing_to_pay";

/** A rule of the business was broken. The message is safe to show to staff. */
export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
