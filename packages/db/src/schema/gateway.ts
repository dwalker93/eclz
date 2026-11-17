import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { payment } from "./billing";
import { createdAt, oneOf, pk, tstz } from "./helpers";

export const GATEWAY_STATUSES = ["initiated", "succeeded", "failed", "cancelled"] as const;

/**
 * An online payment attempt through the buyer's gateway. It uses the same payment row as every other method (phase 5, E14).
 * A callback is idempotent on (provider, provider_ref). A payment is verified and allocated by the same
 * transaction as any other payment (E3, E4), and the trigger below keeps this table to gateway payments.
 * raw_payload keeps the provider's last callback for support and reconciliation. Never store card data.
 */
export const gatewayTransaction = pgTable(
  "gateway_transaction",
  {
    id: pk(),
    paymentId: uuid("payment_id")
      .notNull()
      .references((): AnyPgColumn => payment.id),
    provider: text("provider").notNull(),
    /** The provider's reference. null until the provider returns one. */
    providerRef: text("provider_ref"),
    status: text("status").notNull().default("initiated"),
    rawPayload: jsonb("raw_payload"),
    createdAt: createdAt(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // E14
    unique("gateway_transaction_provider_ref_uq").on(t.provider, t.providerRef),
    oneOf("gateway_transaction_status_check", t.status, GATEWAY_STATUSES),
    check("gateway_transaction_provider_check", sql`length(btrim(${t.provider})) > 0`),
    check("gateway_transaction_ref_check", sql`${t.providerRef} IS NULL OR length(btrim(${t.providerRef})) > 0`),
    // A successful transaction names the provider's reference.
    check("gateway_transaction_succeeded_check", sql`${t.status} <> 'succeeded' OR ${t.providerRef} IS NOT NULL`),
    index("gateway_transaction_payment_idx").on(t.paymentId),
  ],
);
