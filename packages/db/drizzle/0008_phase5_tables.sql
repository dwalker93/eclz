CREATE TABLE "gateway_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'initiated' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_transaction_provider_ref_uq" UNIQUE("provider","provider_ref"),
	CONSTRAINT "gateway_transaction_status_check" CHECK ("gateway_transaction"."status" IN ('initiated', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "gateway_transaction_provider_check" CHECK (length(btrim("gateway_transaction"."provider")) > 0),
	CONSTRAINT "gateway_transaction_ref_check" CHECK ("gateway_transaction"."provider_ref" IS NULL OR length(btrim("gateway_transaction"."provider_ref")) > 0),
	CONSTRAINT "gateway_transaction_succeeded_check" CHECK ("gateway_transaction"."status" <> 'succeeded' OR "gateway_transaction"."provider_ref" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "gateway_transaction" ADD CONSTRAINT "gateway_transaction_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gateway_transaction_payment_idx" ON "gateway_transaction" USING btree ("payment_id");