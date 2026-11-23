-- Moved to the top by hand: the content_purchase foreign keys below depend on this unique constraint.
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_id_branch_uq" UNIQUE("id","branch_id");--> statement-breakpoint
CREATE TABLE "content_purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"invoice_id" uuid,
	"branch_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handed_over_at" timestamp with time zone,
	"handed_over_by" uuid,
	CONSTRAINT "content_purchase_id_invoice_uq" UNIQUE("id","invoice_id"),
	CONSTRAINT "content_purchase_channel_check" CHECK ("content_purchase"."channel" IN ('online', 'physical')),
	CONSTRAINT "content_purchase_status_check" CHECK ("content_purchase"."status" IN ('pending', 'paid', 'cancelled')),
	CONSTRAINT "content_purchase_price_check" CHECK ("content_purchase"."price" > 0),
	CONSTRAINT "content_purchase_handover_check" CHECK (("content_purchase"."handed_over_at" IS NULL AND "content_purchase"."handed_over_by" IS NULL) OR ("content_purchase"."handed_over_at" IS NOT NULL AND "content_purchase"."handed_over_by" IS NOT NULL AND "content_purchase"."status" = 'paid' AND "content_purchase"."channel" = 'physical'))
);
--> statement-breakpoint
CREATE TABLE "commission_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_allocation_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"payout_id" uuid,
	"reverses_entry_id" uuid,
	"entry_type" text NOT NULL,
	"calc_type_applied" text NOT NULL,
	"rate_applied" numeric(12, 2) NOT NULL,
	"share_percent_applied" numeric(5, 2) NOT NULL,
	"basis_applied" text NOT NULL,
	"capped" boolean DEFAULT false NOT NULL,
	"base_amount" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"teacher_amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_entry_type_check" CHECK ("commission_entry"."entry_type" IN ('accrual', 'reversal')),
	CONSTRAINT "commission_entry_status_check" CHECK ("commission_entry"."status" IN ('accrued', 'settled', 'void')),
	CONSTRAINT "commission_entry_calc_type_check" CHECK ("commission_entry"."calc_type_applied" IN ('percent', 'fixed_per_student_month')),
	CONSTRAINT "commission_entry_basis_check" CHECK ("commission_entry"."basis_applied" IN ('paid', 'list')),
	CONSTRAINT "commission_entry_share_check" CHECK ("commission_entry"."share_percent_applied" >= 0 AND "commission_entry"."share_percent_applied" <= 100),
	CONSTRAINT "commission_entry_rate_check" CHECK ("commission_entry"."rate_applied" >= 0),
	CONSTRAINT "commission_entry_split_check" CHECK ("commission_entry"."teacher_amount" = "commission_entry"."base_amount" - "commission_entry"."commission_amount"),
	CONSTRAINT "commission_entry_type_amounts_check" CHECK (("commission_entry"."entry_type" = 'accrual' AND "commission_entry"."reverses_entry_id" IS NULL AND "commission_entry"."base_amount" >= 0 AND "commission_entry"."commission_amount" >= 0 AND "commission_entry"."commission_amount" <= "commission_entry"."base_amount") OR ("commission_entry"."entry_type" = 'reversal' AND "commission_entry"."reverses_entry_id" IS NOT NULL AND "commission_entry"."base_amount" <= 0 AND "commission_entry"."commission_amount" <= 0 AND "commission_entry"."commission_amount" >= "commission_entry"."base_amount")),
	CONSTRAINT "commission_entry_payout_check" CHECK (("commission_entry"."status" = 'settled') = ("commission_entry"."payout_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "commission_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"subject_id" uuid,
	"grade_level_id" uuid,
	"course_id" uuid,
	"calc_type" text NOT NULL,
	"commission_rate" numeric(12, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_rule_id_lecturer_uq" UNIQUE("id","lecturer_id"),
	CONSTRAINT "commission_rule_calc_type_check" CHECK ("commission_rule"."calc_type" IN ('percent', 'fixed_per_student_month')),
	CONSTRAINT "commission_rule_rate_check" CHECK ("commission_rule"."commission_rate" >= 0 AND ("commission_rule"."calc_type" <> 'percent' OR "commission_rule"."commission_rate" <= 100)),
	CONSTRAINT "commission_rule_dates_check" CHECK ("commission_rule"."effective_to" IS NULL OR "commission_rule"."effective_to" > "commission_rule"."effective_from"),
	CONSTRAINT "commission_rule_scope_check" CHECK (("commission_rule"."course_id" IS NOT NULL AND "commission_rule"."subject_id" IS NULL AND "commission_rule"."grade_level_id" IS NULL) OR ("commission_rule"."course_id" IS NULL AND ("commission_rule"."grade_level_id" IS NULL OR "commission_rule"."subject_id" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "teacher_payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_collected" numeric(12, 2) NOT NULL,
	"commission_total" numeric(12, 2) NOT NULL,
	"net_payable" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paid_on" date,
	"payment_reference" text,
	"proof_file_id" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_payout_id_lecturer_uq" UNIQUE("id","lecturer_id"),
	CONSTRAINT "teacher_payout_status_check" CHECK ("teacher_payout"."status" IN ('draft', 'approved', 'paid')),
	CONSTRAINT "teacher_payout_period_check" CHECK ("teacher_payout"."period_end" > "teacher_payout"."period_start"),
	CONSTRAINT "teacher_payout_amounts_check" CHECK ("teacher_payout"."gross_collected" >= 0 AND "teacher_payout"."commission_total" >= 0 AND "teacher_payout"."net_payable" >= 0 AND "teacher_payout"."net_payable" = "teacher_payout"."gross_collected" - "teacher_payout"."commission_total"),
	CONSTRAINT "teacher_payout_approved_check" CHECK ("teacher_payout"."status" = 'draft' OR "teacher_payout"."approved_by" IS NOT NULL),
	CONSTRAINT "teacher_payout_paid_check" CHECK ("teacher_payout"."status" <> 'paid' OR ("teacher_payout"."paid_on" IS NOT NULL AND "teacher_payout"."payment_reference" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "content_purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_content_id_content_item_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_handed_over_by_user_id_fk" FOREIGN KEY ("handed_over_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_listed_branch_fk" FOREIGN KEY ("content_id","branch_id") REFERENCES "public"."content_branch"("content_id","branch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_invoice_student_fk" FOREIGN KEY ("invoice_id","student_id") REFERENCES "public"."invoice"("id","student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_invoice_branch_fk" FOREIGN KEY ("invoice_id","branch_id") REFERENCES "public"."invoice"("id","branch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_payment_allocation_id_payment_allocation_id_fk" FOREIGN KEY ("payment_allocation_id") REFERENCES "public"."payment_allocation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_reverses_entry_id_commission_entry_id_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "public"."commission_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_rule_lecturer_fk" FOREIGN KEY ("rule_id","lecturer_id") REFERENCES "public"."commission_rule"("id","lecturer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_payout_lecturer_fk" FOREIGN KEY ("payout_id","lecturer_id") REFERENCES "public"."teacher_payout"("id","lecturer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rule" ADD CONSTRAINT "commission_rule_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rule" ADD CONSTRAINT "commission_rule_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rule" ADD CONSTRAINT "commission_rule_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rule" ADD CONSTRAINT "commission_rule_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_proof_file_id_file_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_purchase_active_uq" ON "content_purchase" USING btree ("content_id","student_id") WHERE "content_purchase"."status" IN ('pending', 'paid');--> statement-breakpoint
CREATE INDEX "content_purchase_student_idx" ON "content_purchase" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_entry_accrual_uq" ON "commission_entry" USING btree ("payment_allocation_id","lecturer_id") WHERE "commission_entry"."entry_type" = 'accrual' AND "commission_entry"."status" <> 'void';--> statement-breakpoint
CREATE UNIQUE INDEX "commission_entry_reversal_uq" ON "commission_entry" USING btree ("reverses_entry_id") WHERE "commission_entry"."reverses_entry_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "commission_entry_lecturer_idx" ON "commission_entry" USING btree ("lecturer_id","status");--> statement-breakpoint
CREATE INDEX "commission_entry_allocation_idx" ON "commission_entry" USING btree ("payment_allocation_id");--> statement-breakpoint
CREATE INDEX "commission_rule_lecturer_idx" ON "commission_rule" USING btree ("lecturer_id");--> statement-breakpoint
CREATE INDEX "teacher_payout_lecturer_idx" ON "teacher_payout" USING btree ("lecturer_id");--> statement-breakpoint
-- Added NOT VALID so this migration does not scan invoice_item under a lock; 0017 validates it. New rows are checked from here on.
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_purchase_invoice_fk" FOREIGN KEY ("content_purchase_id","invoice_id") REFERENCES "public"."content_purchase"("id","invoice_id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_item_content_purchase_uq" ON "invoice_item" USING btree ("content_purchase_id") WHERE "invoice_item"."kind" = 'content' AND "invoice_item"."cancelled_at" IS NULL;--> statement-breakpoint
-- Phase 1 allowed kind = 'content' with no purchase to point at, and every existing row has a NULL content_purchase_id. Such a line cannot satisfy the
-- check below, and a purchase cannot be invented for it. Keep the line, with its amount, invoice, cancelled_at and the invoice totals untouched, as an
-- adjustment (a positive adjustment is allowed) and mark it in the description, so history is preserved and the upgrade does not stop.
UPDATE "invoice_item" SET "kind" = 'adjustment', "description" = 'Content (migrated)' || COALESCE(': ' || "description", '') WHERE "kind" = 'content' AND "content_purchase_id" IS NULL;--> statement-breakpoint
-- NOT VALID for the same reason as the foreign key above; 0017 validates it.
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_content_fields_check" CHECK (("invoice_item"."kind" = 'content' AND "invoice_item"."content_purchase_id" IS NOT NULL) OR ("invoice_item"."kind" <> 'content' AND "invoice_item"."content_purchase_id" IS NULL)) NOT VALID;
