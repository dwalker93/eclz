-- Moved to the top by hand: the fee_exception foreign keys below depend on this unique constraint.
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_id_course_uq" UNIQUE("id","course_id");--> statement-breakpoint
CREATE TABLE "fee_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"alternate_fee_structure_id" uuid,
	"discount_type" text,
	"discount_value" numeric(12, 2),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"ended_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_exception_id_enrollment_uq" UNIQUE("id","enrollment_id"),
	CONSTRAINT "fee_exception_kind_check" CHECK ("fee_exception"."kind" IN ('alternate_option', 'discount')),
	CONSTRAINT "fee_exception_kind_columns_check" CHECK (("fee_exception"."kind" = 'alternate_option' AND "fee_exception"."alternate_fee_structure_id" IS NOT NULL AND "fee_exception"."discount_type" IS NULL AND "fee_exception"."discount_value" IS NULL) OR ("fee_exception"."kind" = 'discount' AND "fee_exception"."alternate_fee_structure_id" IS NULL AND "fee_exception"."discount_type" IS NOT NULL AND "fee_exception"."discount_type" IN ('percent', 'fixed') AND "fee_exception"."discount_value" IS NOT NULL)),
	CONSTRAINT "fee_exception_discount_value_check" CHECK ("fee_exception"."discount_type" IS NULL OR ("fee_exception"."discount_value" IS NOT NULL AND "fee_exception"."discount_value" >= 0 AND ("fee_exception"."discount_type" <> 'percent' OR "fee_exception"."discount_value" <= 100))),
	CONSTRAINT "fee_exception_reason_check" CHECK (length(btrim("fee_exception"."reason")) > 0),
	CONSTRAINT "fee_exception_dates_check" CHECK ("fee_exception"."effective_to" IS NULL OR "fee_exception"."effective_to" > "fee_exception"."effective_from"),
	CONSTRAINT "fee_exception_ended_check" CHECK ("fee_exception"."ended_by" IS NULL OR "fee_exception"."effective_to" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "installment_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_structure_id" uuid NOT NULL,
	"name" text NOT NULL,
	"installment_count" integer NOT NULL,
	"down_payment_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"interval_days" integer NOT NULL,
	"surcharge_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "installment_option_structure_name_uq" UNIQUE("fee_structure_id","name"),
	CONSTRAINT "installment_option_count_check" CHECK ("installment_option"."installment_count" >= 2),
	CONSTRAINT "installment_option_down_payment_check" CHECK ("installment_option"."down_payment_percent" >= 0 AND "installment_option"."down_payment_percent" < 100),
	CONSTRAINT "installment_option_interval_check" CHECK ("installment_option"."interval_days" > 0),
	CONSTRAINT "installment_option_surcharge_check" CHECK ("installment_option"."surcharge_percent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_installment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "invoice_installment_seq_uq" UNIQUE("invoice_id","seq"),
	CONSTRAINT "invoice_installment_status_check" CHECK ("invoice_installment"."status" IN ('pending', 'partial', 'paid', 'overdue')),
	CONSTRAINT "invoice_installment_seq_check" CHECK ("invoice_installment"."seq" >= 1),
	CONSTRAINT "invoice_installment_amount_check" CHECK ("invoice_installment"."amount" > 0),
	CONSTRAINT "invoice_installment_paid_check" CHECK ("invoice_installment"."amount_paid" >= 0 AND "invoice_installment"."amount_paid" <= "invoice_installment"."amount")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_body_check" CHECK (length(btrim("message"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "message_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"course_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_thread_subject_check" CHECK (length(btrim("message_thread"."subject")) > 0)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"channel" text NOT NULL,
	"event" text NOT NULL,
	"event_key" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_channel_value_check" CHECK ("notification"."channel" IN ('email', 'sms', 'push', 'in_app')),
	CONSTRAINT "notification_event_check" CHECK ("notification"."event" IN ('payment_submitted', 'payment_verified', 'payment_rejected', 'receipt_issued', 'installment_due', 'installment_overdue', 'attendance_marked', 'class_reminder', 'exam_published', 'notice')),
	CONSTRAINT "notification_status_check" CHECK ("notification"."status" IN ('queued', 'sent', 'failed')),
	CONSTRAINT "notification_sent_check" CHECK ("notification"."status" <> 'sent' OR "notification"."sent_at" IS NOT NULL),
	CONSTRAINT "notification_failed_check" CHECK ("notification"."status" <> 'failed' OR "notification"."error" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "notification_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"provider" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	CONSTRAINT "notification_channel_uq" UNIQUE("organization_id","channel"),
	CONSTRAINT "notification_channel_check" CHECK ("notification_channel"."channel" IN ('email', 'sms', 'push', 'in_app'))
);
--> statement-breakpoint
CREATE TABLE "notification_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	CONSTRAINT "notification_template_uq" UNIQUE("organization_id","event","channel"),
	CONSTRAINT "notification_template_event_check" CHECK ("notification_template"."event" IN ('payment_submitted', 'payment_verified', 'payment_rejected', 'receipt_issued', 'installment_due', 'installment_overdue', 'attendance_marked', 'class_reminder', 'exam_published', 'notice')),
	CONSTRAINT "notification_template_channel_check" CHECK ("notification_template"."channel" IN ('email', 'sms', 'push', 'in_app'))
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "thread_participant" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	CONSTRAINT "thread_participant_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "installment_option_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN "fee_exception_id" uuid;--> statement-breakpoint
ALTER TABLE "fee_exception" ADD CONSTRAINT "fee_exception_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_exception" ADD CONSTRAINT "fee_exception_ended_by_user_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_exception" ADD CONSTRAINT "fee_exception_enrollment_course_fk" FOREIGN KEY ("enrollment_id","course_id") REFERENCES "public"."enrollment"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_exception" ADD CONSTRAINT "fee_exception_alternate_course_fk" FOREIGN KEY ("alternate_fee_structure_id","course_id") REFERENCES "public"."fee_structure"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_option" ADD CONSTRAINT "installment_option_fee_structure_id_fee_structure_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_installment" ADD CONSTRAINT "invoice_installment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_participant_fk" FOREIGN KEY ("thread_id","sender_id") REFERENCES "public"."thread_participant"("thread_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread" ADD CONSTRAINT "message_thread_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread" ADD CONSTRAINT "message_thread_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_template_id_notification_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel" ADD CONSTRAINT "notification_channel_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template" ADD CONSTRAINT "notification_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participant" ADD CONSTRAINT "thread_participant_thread_id_message_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participant" ADD CONSTRAINT "thread_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fee_exception_enrollment_idx" ON "fee_exception" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "installment_option_structure_idx" ON "installment_option" USING btree ("fee_structure_id");--> statement-breakpoint
CREATE INDEX "invoice_installment_due_idx" ON "invoice_installment" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "message_thread_idx" ON "message" USING btree ("thread_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_dedupe_uq" ON "notification" USING btree ("user_id","event_key","channel");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_queue_idx" ON "notification" USING btree ("status") WHERE "notification"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "thread_participant_user_idx" ON "thread_participant" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_installment_option_id_installment_option_id_fk" FOREIGN KEY ("installment_option_id") REFERENCES "public"."installment_option"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_fee_exception_id_fee_exception_id_fk" FOREIGN KEY ("fee_exception_id") REFERENCES "public"."fee_exception"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_exception_kind_check" CHECK ("invoice_item"."fee_exception_id" IS NULL OR "invoice_item"."kind" = 'discount');