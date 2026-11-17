CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "file_size_check" CHECK ("file"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"enabled_modules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"currency" text DEFAULT 'LKR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Colombo' NOT NULL,
	"guardian_required_below_age" integer DEFAULT 16 NOT NULL,
	"signing_key_ref" text,
	"overdue_grace_days" integer DEFAULT 7 NOT NULL,
	"overdue_action" text DEFAULT 'notify' NOT NULL,
	"discount_commission_basis" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_type_check" CHECK ("organization"."type" IN ('individual', 'institution')),
	CONSTRAINT "organization_overdue_action_check" CHECK ("organization"."overdue_action" IN ('none', 'notify', 'restrict', 'notify_and_restrict')),
	CONSTRAINT "organization_commission_basis_check" CHECK ("organization"."discount_commission_basis" IN ('paid', 'list')),
	CONSTRAINT "organization_guardian_age_check" CHECK ("organization"."guardian_required_below_age" >= 0),
	CONSTRAINT "organization_grace_days_check" CHECK ("organization"."overdue_grace_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"username" text,
	"phone" text,
	"password_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_status_check" CHECK ("user"."status" IN ('active', 'disabled')),
	CONSTRAINT "user_has_login_check" CHECK ("user"."email" IS NOT NULL OR "user"."username" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before_data" jsonb,
	"after_data" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	CONSTRAINT "permission_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "grade_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stage" text NOT NULL,
	"ordinal" integer NOT NULL,
	CONSTRAINT "grade_level_name_unique" UNIQUE("name"),
	CONSTRAINT "grade_level_ordinal_unique" UNIQUE("ordinal"),
	CONSTRAINT "grade_level_stage_check" CHECK ("grade_level"."stage" IN ('primary', 'junior', 'ordinary_level', 'advanced_level'))
);
--> statement-breakpoint
CREATE TABLE "guardian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"phone" text,
	"address" text,
	"nic" text,
	"email" text,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "lecturer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"qualification" text,
	"bio" text,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lecturer_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "lecturer_portal_needs_user_check" CHECK (NOT "lecturer"."portal_enabled" OR "lecturer"."user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "lecturer_branch" (
	"lecturer_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "lecturer_branch_lecturer_id_branch_id_pk" PRIMARY KEY("lecturer_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"student_no" text NOT NULL,
	"full_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" text,
	"school_name" text,
	"nic" text,
	"contact_email" text,
	"contact_phone" text,
	"qr_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "student_student_no_unique" UNIQUE("student_no"),
	CONSTRAINT "student_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "student_status_check" CHECK ("student"."status" IN ('active', 'alumni', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "student_branch" (
	"student_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"joined_on" date DEFAULT CURRENT_DATE NOT NULL,
	CONSTRAINT "student_branch_student_id_branch_id_pk" PRIMARY KEY("student_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "student_guardian" (
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "student_guardian_student_id_guardian_id_pk" PRIMARY KEY("student_id","guardian_id")
);
--> statement-breakpoint
CREATE TABLE "academic_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "academic_term_dates_check" CHECK ("academic_term"."ends_on" >= "academic_term"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text NOT NULL,
	"attended_via" text,
	"marked_via" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"marked_by" uuid,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_session_student_uq" UNIQUE("session_id","student_id"),
	CONSTRAINT "attendance_status_check" CHECK ("attendance"."status" IN ('present', 'absent', 'late', 'excused')),
	CONSTRAINT "attendance_marked_via_check" CHECK ("attendance"."marked_via" IN ('manual', 'qr')),
	CONSTRAINT "attendance_attended_via_check" CHECK ("attendance"."attended_via" IS NULL OR "attendance"."attended_via" IN ('physical', 'online'))
);
--> statement-breakpoint
CREATE TABLE "class_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"intake_id" uuid,
	"session_date" date NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"topic" text,
	"delivery_mode" text DEFAULT 'physical' NOT NULL,
	"meeting_provider" text,
	"meeting_url" text,
	"meeting_ref" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "class_session_delivery_mode_check" CHECK ("class_session"."delivery_mode" IN ('physical', 'online', 'hybrid')),
	CONSTRAINT "class_session_status_check" CHECK ("class_session"."status" IN ('scheduled', 'held', 'cancelled')),
	CONSTRAINT "class_session_meeting_provider_check" CHECK ("class_session"."meeting_provider" IS NULL OR "class_session"."meeting_provider" IN ('zoom', 'teams', 'other')),
	CONSTRAINT "class_session_time_check" CHECK ("class_session"."ends_at" > "class_session"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"course_group_id" uuid,
	"term_id" uuid,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"learning_mode" text DEFAULT 'scheduled' NOT NULL,
	"delivery_mode" text DEFAULT 'physical' NOT NULL,
	"attendance_enabled" boolean DEFAULT true NOT NULL,
	"batch_label" text,
	"capacity" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_id_branch_uq" UNIQUE("id","branch_id"),
	CONSTRAINT "course_kind_check" CHECK ("course"."kind" IN ('class', 'program')),
	CONSTRAINT "course_learning_mode_check" CHECK ("course"."learning_mode" IN ('scheduled', 'self_paced')),
	CONSTRAINT "course_delivery_mode_check" CHECK ("course"."delivery_mode" IN ('physical', 'online', 'hybrid')),
	CONSTRAINT "course_status_check" CHECK ("course"."status" IN ('draft', 'active', 'closed', 'archived')),
	CONSTRAINT "course_class_is_scheduled_check" CHECK ("course"."kind" <> 'class' OR "course"."learning_mode" = 'scheduled'),
	CONSTRAINT "course_self_paced_no_attendance_check" CHECK ("course"."learning_mode" <> 'self_paced' OR NOT "course"."attendance_enabled"),
	CONSTRAINT "course_capacity_check" CHECK ("course"."capacity" IS NULL OR "course"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "course_grade_level" (
	"course_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	CONSTRAINT "course_grade_level_course_id_grade_level_id_pk" PRIMARY KEY("course_id","grade_level_id")
);
--> statement-breakpoint
CREATE TABLE "course_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"name" text NOT NULL,
	"batch_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_group_id_branch_uq" UNIQUE("id","branch_id"),
	CONSTRAINT "course_group_id_subject_uq" UNIQUE("id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "course_lecturer" (
	"course_id" uuid NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"share_percent" numeric(5, 2) DEFAULT '100' NOT NULL,
	CONSTRAINT "course_lecturer_course_id_lecturer_id_pk" PRIMARY KEY("course_id","lecturer_id"),
	CONSTRAINT "course_lecturer_share_check" CHECK ("course_lecturer"."share_percent" >= 0 AND "course_lecturer"."share_percent" <= 100)
);
--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"intake_id" uuid,
	"fee_structure_id" uuid,
	"billing_grade_level_id" uuid,
	"preferred_mode" text,
	"status" text DEFAULT 'active' NOT NULL,
	"end_reason" text,
	"promoted_from_enrollment_id" uuid,
	"access_status" text DEFAULT 'active' NOT NULL,
	"enrolled_on" date DEFAULT CURRENT_DATE NOT NULL,
	"access_starts_on" date DEFAULT CURRENT_DATE NOT NULL,
	"access_ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_status_check" CHECK ("enrollment"."status" IN ('active', 'dropped', 'completed')),
	CONSTRAINT "enrollment_access_status_check" CHECK ("enrollment"."access_status" IN ('active', 'restricted')),
	CONSTRAINT "enrollment_end_reason_check" CHECK ("enrollment"."end_reason" IS NULL OR "enrollment"."end_reason" IN ('dropped', 'promoted', 'course_ended', 'transferred')),
	CONSTRAINT "enrollment_preferred_mode_check" CHECK ("enrollment"."preferred_mode" IS NULL OR "enrollment"."preferred_mode" IN ('physical', 'online')),
	CONSTRAINT "enrollment_active_has_no_end_reason_check" CHECK ("enrollment"."status" <> 'active' OR "enrollment"."end_reason" IS NULL),
	CONSTRAINT "enrollment_access_dates_check" CHECK ("enrollment"."access_ends_on" IS NULL OR "enrollment"."access_ends_on" > "enrollment"."access_starts_on")
);
--> statement-breakpoint
CREATE TABLE "intake" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"capacity" integer,
	"status" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "intake_id_course_uq" UNIQUE("id","course_id"),
	CONSTRAINT "intake_status_check" CHECK ("intake"."status" IN ('open', 'running', 'closed')),
	CONSTRAINT "intake_dates_check" CHECK ("intake"."ends_on" IS NULL OR "intake"."ends_on" >= "intake"."starts_on"),
	CONSTRAINT "intake_capacity_check" CHECK ("intake"."capacity" IS NULL OR "intake"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "schedule_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"intake_id" uuid,
	"weekday" integer NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"room" text,
	CONSTRAINT "schedule_slot_weekday_check" CHECK ("schedule_slot"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "schedule_slot_time_check" CHECK ("schedule_slot"."ends_at" > "schedule_slot"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	CONSTRAINT "subject_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promotion_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_run_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"from_enrollment_id" uuid,
	"to_course_id" uuid,
	"decision" text DEFAULT 'needs_review' NOT NULL,
	"to_enrollment_id" uuid,
	"note" text,
	CONSTRAINT "promotion_item_decision_check" CHECK ("promotion_item"."decision" IN ('move', 'stay', 'skip', 'needs_review'))
);
--> statement-breakpoint
CREATE TABLE "promotion_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performed_by" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"effective_date" date NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "promotion_run_status_check" CHECK ("promotion_run"."status" IN ('draft', 'confirmed', 'discarded')),
	CONSTRAINT "promotion_run_confirmed_check" CHECK ("promotion_run"."status" <> 'confirmed' OR "promotion_run"."confirmed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "student_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"promotion_run_id" uuid,
	"from_date" date NOT NULL,
	"to_date" date,
	"reason" text DEFAULT 'admission' NOT NULL,
	CONSTRAINT "student_level_reason_check" CHECK ("student_level"."reason" IN ('admission', 'promotion', 'correction')),
	CONSTRAINT "student_level_dates_check" CHECK ("student_level"."to_date" IS NULL OR "student_level"."to_date" > "student_level"."from_date")
);
--> statement-breakpoint
CREATE TABLE "bank_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"branch_name" text,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bank_account_id_branch_uq" UNIQUE("id","branch_id"),
	CONSTRAINT "bank_account_number_uq" UNIQUE("branch_id","bank_name","account_number")
);
--> statement-breakpoint
CREATE TABLE "fee_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_structure_id" uuid NOT NULL,
	"grade_level_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	CONSTRAINT "fee_rate_amount_check" CHECK ("fee_rate"."amount" > 0),
	CONSTRAINT "fee_rate_dates_check" CHECK ("fee_rate"."effective_to" IS NULL OR "fee_rate"."effective_to" > "fee_rate"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "fee_structure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"course_id" uuid,
	"intake_id" uuid,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"billing_type" text NOT NULL,
	"frequency" text,
	"access_duration_months" integer,
	"overdue_grace_days" integer,
	"overdue_action" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_structure_id_course_uq" UNIQUE("id","course_id"),
	CONSTRAINT "fee_structure_billing_type_check" CHECK ("fee_structure"."billing_type" IN ('recurring', 'one_time_package')),
	CONSTRAINT "fee_structure_frequency_check" CHECK (("fee_structure"."billing_type" = 'recurring' AND "fee_structure"."frequency" IS NOT NULL AND "fee_structure"."frequency" IN ('monthly', 'per_term')) OR ("fee_structure"."billing_type" = 'one_time_package' AND "fee_structure"."frequency" IS NULL)),
	CONSTRAINT "fee_structure_duration_check" CHECK ("fee_structure"."access_duration_months" IS NULL OR ("fee_structure"."billing_type" = 'one_time_package' AND "fee_structure"."access_duration_months" > 0)),
	CONSTRAINT "fee_structure_intake_needs_course_check" CHECK ("fee_structure"."intake_id" IS NULL OR "fee_structure"."course_id" IS NOT NULL),
	CONSTRAINT "fee_structure_default_needs_course_check" CHECK (NOT "fee_structure"."is_default" OR "fee_structure"."course_id" IS NOT NULL),
	CONSTRAINT "fee_structure_grace_days_check" CHECK ("fee_structure"."overdue_grace_days" IS NULL OR "fee_structure"."overdue_grace_days" >= 0),
	CONSTRAINT "fee_structure_overdue_action_check" CHECK ("fee_structure"."overdue_action" IS NULL OR "fee_structure"."overdue_action" IN ('none', 'notify', 'restrict', 'notify_and_restrict'))
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"issued_on" date DEFAULT CURRENT_DATE NOT NULL,
	"due_date" date NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_id_student_uq" UNIQUE("id","student_id"),
	CONSTRAINT "invoice_status_check" CHECK ("invoice"."status" IN ('pending', 'partial', 'paid', 'overdue', 'waived', 'cancelled')),
	CONSTRAINT "invoice_discount_range_check" CHECK ("invoice"."discount_total" >= 0 AND "invoice"."discount_total" <= "invoice"."subtotal"),
	CONSTRAINT "invoice_total_formula_check" CHECK ("invoice"."total" = "invoice"."subtotal" - "invoice"."discount_total"),
	CONSTRAINT "invoice_paid_range_check" CHECK ("invoice"."amount_paid" >= 0 AND "invoice"."amount_paid" <= "invoice"."total"),
	CONSTRAINT "invoice_zero_total_check" CHECK ("invoice"."total" > 0 OR "invoice"."status" IN ('waived', 'cancelled')),
	CONSTRAINT "invoice_due_date_check" CHECK ("invoice"."due_date" >= "invoice"."issued_on")
);
--> statement-breakpoint
CREATE TABLE "invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"enrollment_id" uuid,
	"fee_structure_id" uuid,
	"grade_level_id" uuid,
	"applies_to_item_id" uuid,
	"cancelled_at" timestamp with time zone,
	"period_start" date,
	"period_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_item_id_invoice_uq" UNIQUE("id","invoice_id"),
	CONSTRAINT "invoice_item_kind_check" CHECK ("invoice_item"."kind" IN ('recurring_fee', 'package_fee', 'content', 'adjustment', 'discount')),
	CONSTRAINT "invoice_item_sign_check" CHECK (("invoice_item"."kind" IN ('recurring_fee', 'package_fee', 'content') AND "invoice_item"."amount" > 0) OR ("invoice_item"."kind" = 'discount' AND "invoice_item"."amount" < 0) OR ("invoice_item"."kind" = 'adjustment' AND "invoice_item"."amount" <> 0)),
	CONSTRAINT "invoice_item_discount_applies_check" CHECK ("invoice_item"."kind" <> 'discount' OR "invoice_item"."applies_to_item_id" IS NOT NULL),
	CONSTRAINT "invoice_item_negative_adjustment_check" CHECK ("invoice_item"."kind" <> 'adjustment' OR "invoice_item"."amount" > 0 OR "invoice_item"."applies_to_item_id" IS NOT NULL),
	CONSTRAINT "invoice_item_applies_kind_check" CHECK ("invoice_item"."applies_to_item_id" IS NULL OR "invoice_item"."kind" IN ('discount', 'adjustment')),
	CONSTRAINT "invoice_item_recurring_fields_check" CHECK ("invoice_item"."kind" <> 'recurring_fee' OR ("invoice_item"."enrollment_id" IS NOT NULL AND "invoice_item"."fee_structure_id" IS NOT NULL AND "invoice_item"."period_start" IS NOT NULL AND "invoice_item"."period_end" IS NOT NULL)),
	CONSTRAINT "invoice_item_package_fields_check" CHECK ("invoice_item"."kind" <> 'package_fee' OR ("invoice_item"."enrollment_id" IS NOT NULL AND "invoice_item"."fee_structure_id" IS NOT NULL)),
	CONSTRAINT "invoice_item_period_check" CHECK ("invoice_item"."period_start" IS NULL OR "invoice_item"."period_end" IS NULL OR "invoice_item"."period_end" > "invoice_item"."period_start")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"submitted_by" uuid,
	"branch_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"bank_account_id" uuid,
	"slip_file_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" date,
	"reference_no" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"rejection_reason" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"void_reason" text,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_id_student_uq" UNIQUE("id","student_id"),
	CONSTRAINT "payment_status_check" CHECK ("payment"."status" IN ('pending_verification', 'verified', 'rejected', 'voided')),
	CONSTRAINT "payment_amount_check" CHECK ("payment"."amount" > 0),
	CONSTRAINT "payment_verified_fields_check" CHECK ("payment"."status" <> 'verified' OR ("payment"."verified_by" IS NOT NULL AND "payment"."verified_at" IS NOT NULL)),
	CONSTRAINT "payment_rejected_fields_check" CHECK ("payment"."status" <> 'rejected' OR "payment"."rejection_reason" IS NOT NULL),
	CONSTRAINT "payment_voided_fields_check" CHECK ("payment"."status" <> 'voided' OR ("payment"."void_reason" IS NOT NULL AND "payment"."voided_by" IS NOT NULL AND "payment"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"invoice_item_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocation_amount_check" CHECK ("payment_allocation"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_method" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	CONSTRAINT "payment_method_type_check" CHECK ("payment_method"."type" IN ('bank_transfer', 'cash', 'gateway'))
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"receipt_no" text NOT NULL,
	"verification_code" text NOT NULL,
	"content_hash" text NOT NULL,
	"signature" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"replaced_by_receipt_id" uuid,
	"file_id" uuid,
	CONSTRAINT "receipt_verification_code_unique" UNIQUE("verification_code"),
	CONSTRAINT "receipt_branch_no_uq" UNIQUE("branch_id","receipt_no"),
	CONSTRAINT "receipt_status_check" CHECK ("receipt"."status" IN ('issued', 'void')),
	CONSTRAINT "receipt_replaced_check" CHECK ("receipt"."replaced_by_receipt_id" IS NULL OR "receipt"."status" = 'void')
);
--> statement-breakpoint
CREATE TABLE "receipt_counter" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "receipt_counter_check" CHECK ("receipt_counter"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_branch" (
	"content_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "content_branch_content_id_branch_id_pk" PRIMARY KEY("content_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"external_url" text,
	"file_id" uuid,
	"access_type" text DEFAULT 'course' NOT NULL,
	"price" numeric(12, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_item_kind_check" CHECK ("content_item"."kind" IN ('recording', 'file', 'physical_book')),
	CONSTRAINT "content_item_access_type_check" CHECK ("content_item"."access_type" IN ('course', 'free_registered', 'paid')),
	CONSTRAINT "content_item_status_check" CHECK ("content_item"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "content_item_kind_fields_check" CHECK (("content_item"."kind" = 'recording' AND "content_item"."external_url" IS NOT NULL AND "content_item"."file_id" IS NULL) OR ("content_item"."kind" = 'file' AND "content_item"."file_id" IS NOT NULL) OR ("content_item"."kind" = 'physical_book' AND "content_item"."external_url" IS NULL AND "content_item"."file_id" IS NULL)),
	CONSTRAINT "content_item_paid_price_check" CHECK ("content_item"."access_type" <> 'paid' OR ("content_item"."price" IS NOT NULL AND "content_item"."price" > 0))
);
--> statement-breakpoint
CREATE TABLE "course_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"section_id" uuid,
	"content_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "course_content_course_content_uq" UNIQUE("course_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "course_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "course_section_id_course_uq" UNIQUE("id","course_id")
);
--> statement-breakpoint
CREATE TABLE "notice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"branch_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "notice_expiry_check" CHECK ("notice"."expires_at" IS NULL OR "notice"."expires_at" > "notice"."published_at")
);
--> statement-breakpoint
CREATE TABLE "notice_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	CONSTRAINT "notice_target_type_check" CHECK ("notice_target"."target_type" IN ('all', 'role', 'course', 'grade', 'student')),
	CONSTRAINT "notice_target_id_check" CHECK (("notice_target"."target_type" = 'all') = ("notice_target"."target_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignment" ADD CONSTRAINT "staff_role_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignment" ADD CONSTRAINT "staff_role_assignment_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignment" ADD CONSTRAINT "staff_role_assignment_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturer" ADD CONSTRAINT "lecturer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturer_branch" ADD CONSTRAINT "lecturer_branch_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecturer_branch" ADD CONSTRAINT "lecturer_branch_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_branch" ADD CONSTRAINT "student_branch_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_branch" ADD CONSTRAINT "student_branch_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_guardian_id_guardian_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardian"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_class_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_session" ADD CONSTRAINT "class_session_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_session" ADD CONSTRAINT "class_session_intake_course_fk" FOREIGN KEY ("intake_id","course_id") REFERENCES "public"."intake"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_term_id_academic_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_term"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_group_branch_fk" FOREIGN KEY ("course_group_id","branch_id") REFERENCES "public"."course_group"("id","branch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_group_subject_fk" FOREIGN KEY ("course_group_id","subject_id") REFERENCES "public"."course_group"("id","subject_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_grade_level" ADD CONSTRAINT "course_grade_level_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_grade_level" ADD CONSTRAINT "course_grade_level_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_group" ADD CONSTRAINT "course_group_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_group" ADD CONSTRAINT "course_group_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lecturer" ADD CONSTRAINT "course_lecturer_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lecturer" ADD CONSTRAINT "course_lecturer_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_billing_grade_level_id_grade_level_id_fk" FOREIGN KEY ("billing_grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_promoted_from_enrollment_id_enrollment_id_fk" FOREIGN KEY ("promoted_from_enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_intake_course_fk" FOREIGN KEY ("intake_id","course_id") REFERENCES "public"."intake"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_fee_structure_course_fk" FOREIGN KEY ("fee_structure_id","course_id") REFERENCES "public"."fee_structure"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake" ADD CONSTRAINT "intake_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_intake_course_fk" FOREIGN KEY ("intake_id","course_id") REFERENCES "public"."intake"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_item" ADD CONSTRAINT "promotion_item_promotion_run_id_promotion_run_id_fk" FOREIGN KEY ("promotion_run_id") REFERENCES "public"."promotion_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_item" ADD CONSTRAINT "promotion_item_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_item" ADD CONSTRAINT "promotion_item_from_enrollment_id_enrollment_id_fk" FOREIGN KEY ("from_enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_item" ADD CONSTRAINT "promotion_item_to_course_id_course_id_fk" FOREIGN KEY ("to_course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_item" ADD CONSTRAINT "promotion_item_to_enrollment_id_enrollment_id_fk" FOREIGN KEY ("to_enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_run" ADD CONSTRAINT "promotion_run_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_level" ADD CONSTRAINT "student_level_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_level" ADD CONSTRAINT "student_level_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_level" ADD CONSTRAINT "student_level_promotion_run_id_promotion_run_id_fk" FOREIGN KEY ("promotion_run_id") REFERENCES "public"."promotion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rate" ADD CONSTRAINT "fee_rate_fee_structure_id_fee_structure_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rate" ADD CONSTRAINT "fee_rate_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structure" ADD CONSTRAINT "fee_structure_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structure" ADD CONSTRAINT "fee_structure_course_branch_fk" FOREIGN KEY ("course_id","branch_id") REFERENCES "public"."course"("id","branch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structure" ADD CONSTRAINT "fee_structure_intake_course_fk" FOREIGN KEY ("intake_id","course_id") REFERENCES "public"."intake"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_fee_structure_id_fee_structure_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_applies_to_fk" FOREIGN KEY ("applies_to_item_id","invoice_id") REFERENCES "public"."invoice_item"("id","invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_payment_method_id_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_slip_file_id_file_id_fk" FOREIGN KEY ("slip_file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_bank_account_branch_fk" FOREIGN KEY ("bank_account_id","branch_id") REFERENCES "public"."bank_account"("id","branch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_payment_student_fk" FOREIGN KEY ("payment_id","student_id") REFERENCES "public"."payment"("id","student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_invoice_student_fk" FOREIGN KEY ("invoice_id","student_id") REFERENCES "public"."invoice"("id","student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_item_invoice_fk" FOREIGN KEY ("invoice_item_id","invoice_id") REFERENCES "public"."invoice_item"("id","invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_replaced_by_receipt_id_receipt_id_fk" FOREIGN KEY ("replaced_by_receipt_id") REFERENCES "public"."receipt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_counter" ADD CONSTRAINT "receipt_counter_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_branch" ADD CONSTRAINT "content_branch_content_id_content_item_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_branch" ADD CONSTRAINT "content_branch_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_content" ADD CONSTRAINT "course_content_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_content" ADD CONSTRAINT "course_content_content_id_content_item_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_content" ADD CONSTRAINT "course_content_section_course_fk" FOREIGN KEY ("section_id","course_id") REFERENCES "public"."course_section"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_section" ADD CONSTRAINT "course_section_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice" ADD CONSTRAINT "notice_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice" ADD CONSTRAINT "notice_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_target" ADD CONSTRAINT "notice_target_notice_id_notice_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_org_name_uq" ON "branch" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_one_default_uq" ON "branch" USING btree ("organization_id") WHERE "branch"."is_default";--> statement-breakpoint
CREATE INDEX "file_uploaded_by_idx" ON "file" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_all_branches_uq" ON "staff_role_assignment" USING btree ("user_id","role_id") WHERE "staff_role_assignment"."branch_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_one_branch_uq" ON "staff_role_assignment" USING btree ("user_id","role_id","branch_id") WHERE "staff_role_assignment"."branch_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "staff_role_user_idx" ON "staff_role_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_branch_one_primary_uq" ON "student_branch" USING btree ("student_id") WHERE "student_branch"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardian_one_primary_uq" ON "student_guardian" USING btree ("student_id") WHERE "student_guardian"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "academic_term_one_current_uq" ON "academic_term" USING btree ("is_current") WHERE "academic_term"."is_current";--> statement-breakpoint
CREATE INDEX "attendance_student_idx" ON "attendance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "class_session_course_date_idx" ON "class_session" USING btree ("course_id","session_date");--> statement-breakpoint
CREATE INDEX "course_branch_idx" ON "course" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "course_group_idx" ON "course" USING btree ("course_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_lecturer_one_primary_uq" ON "course_lecturer" USING btree ("course_id") WHERE "course_lecturer"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_one_active_no_intake_uq" ON "enrollment" USING btree ("student_id","course_id") WHERE "enrollment"."status" = 'active' AND "enrollment"."intake_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_one_active_per_intake_uq" ON "enrollment" USING btree ("student_id","course_id","intake_id") WHERE "enrollment"."status" = 'active' AND "enrollment"."intake_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "enrollment_student_idx" ON "enrollment" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enrollment_course_idx" ON "enrollment" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "schedule_slot_course_idx" ON "schedule_slot" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_item_run_enrollment_uq" ON "promotion_item" USING btree ("promotion_run_id","from_enrollment_id") WHERE "promotion_item"."from_enrollment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_item_run_student_no_enrollment_uq" ON "promotion_item" USING btree ("promotion_run_id","student_id") WHERE "promotion_item"."from_enrollment_id" IS NULL;--> statement-breakpoint
CREATE INDEX "promotion_item_run_idx" ON "promotion_item" USING btree ("promotion_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_level_one_current_uq" ON "student_level" USING btree ("student_id") WHERE "student_level"."to_date" IS NULL;--> statement-breakpoint
CREATE INDEX "student_level_student_idx" ON "student_level" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "fee_rate_structure_idx" ON "fee_rate" USING btree ("fee_structure_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structure_one_default_per_course_uq" ON "fee_structure" USING btree ("course_id") WHERE "fee_structure"."is_default" AND "fee_structure"."is_active";--> statement-breakpoint
CREATE INDEX "fee_structure_course_idx" ON "fee_structure" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "invoice_student_idx" ON "invoice" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "invoice_status_due_idx" ON "invoice" USING btree ("status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_item_recurring_uq" ON "invoice_item" USING btree ("enrollment_id","period_start") WHERE "invoice_item"."kind" = 'recurring_fee' AND "invoice_item"."cancelled_at" IS NULL;--> statement-breakpoint
CREATE INDEX "invoice_item_invoice_idx" ON "invoice_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_item_enrollment_idx" ON "invoice_item" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_bank_reference_uq" ON "payment" USING btree ("bank_account_id","reference_no") WHERE "payment"."bank_account_id" IS NOT NULL AND "payment"."reference_no" IS NOT NULL AND "payment"."status" <> 'rejected';--> statement-breakpoint
CREATE INDEX "payment_student_idx" ON "payment" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_allocation_payment_idx" ON "payment_allocation" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocation_invoice_idx" ON "payment_allocation" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_allocation_item_idx" ON "payment_allocation" USING btree ("invoice_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_method_one_default_uq" ON "payment_method" USING btree ("organization_id") WHERE "payment_method"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_one_issued_per_payment_uq" ON "receipt" USING btree ("payment_id") WHERE "receipt"."status" = 'issued';--> statement-breakpoint
CREATE INDEX "content_item_lecturer_idx" ON "content_item" USING btree ("lecturer_id");--> statement-breakpoint
CREATE INDEX "course_section_course_idx" ON "course_section" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "notice_published_idx" ON "notice" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "notice_target_notice_idx" ON "notice_target" USING btree ("notice_id");