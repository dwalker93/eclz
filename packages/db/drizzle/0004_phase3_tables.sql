-- Moved to the top by hand: the exam foreign keys below depend on this unique constraint.
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_id_student_course_uq" UNIQUE("id","student_id","course_id");--> statement-breakpoint
CREATE TABLE "attempt_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"exam_question_id" uuid NOT NULL,
	"selected_option_key" text,
	"is_correct" boolean,
	"marks_awarded" numeric(8, 2),
	CONSTRAINT "attempt_answer_uq" UNIQUE("attempt_id","exam_question_id"),
	CONSTRAINT "attempt_answer_marks_check" CHECK ("attempt_answer"."marks_awarded" IS NULL OR "attempt_answer"."marks_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "exam" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"mode" text NOT NULL,
	"exam_date" date,
	"max_marks" numeric(8, 2),
	"weight" numeric(8, 2),
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"time_limit_minutes" integer,
	"max_attempts" integer,
	"attempt_scoring" text DEFAULT 'best' NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"results_visibility" text DEFAULT 'after_release' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_mode_check" CHECK ("exam"."mode" IN ('online_mcq', 'paper')),
	CONSTRAINT "exam_scoring_check" CHECK ("exam"."attempt_scoring" IN ('best', 'latest')),
	CONSTRAINT "exam_visibility_check" CHECK ("exam"."results_visibility" IN ('immediate', 'after_release', 'manual')),
	CONSTRAINT "exam_status_check" CHECK ("exam"."status" IN ('draft', 'published', 'closed')),
	CONSTRAINT "exam_title_check" CHECK (length(btrim("exam"."title")) > 0),
	CONSTRAINT "exam_max_marks_check" CHECK ("exam"."max_marks" IS NULL OR "exam"."max_marks" > 0),
	CONSTRAINT "exam_weight_check" CHECK ("exam"."weight" IS NULL OR "exam"."weight" > 0),
	CONSTRAINT "exam_time_limit_check" CHECK ("exam"."time_limit_minutes" IS NULL OR "exam"."time_limit_minutes" > 0),
	CONSTRAINT "exam_attempts_check" CHECK ("exam"."max_attempts" IS NULL OR "exam"."max_attempts" >= 1),
	CONSTRAINT "exam_window_check" CHECK ("exam"."opens_at" IS NULL OR "exam"."closes_at" IS NULL OR "exam"."closes_at" > "exam"."opens_at"),
	CONSTRAINT "exam_mode_fields_check" CHECK (("exam"."mode" = 'online_mcq' AND "exam"."opens_at" IS NOT NULL AND "exam"."closes_at" IS NOT NULL AND "exam"."max_attempts" IS NOT NULL) OR ("exam"."mode" = 'paper' AND "exam"."exam_date" IS NOT NULL AND "exam"."max_marks" IS NOT NULL AND "exam"."opens_at" IS NULL AND "exam"."closes_at" IS NULL AND "exam"."time_limit_minutes" IS NULL AND "exam"."max_attempts" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "exam_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" numeric(8, 2),
	"status" text DEFAULT 'in_progress' NOT NULL,
	CONSTRAINT "exam_attempt_no_uq" UNIQUE("exam_id","student_id","attempt_no"),
	CONSTRAINT "exam_attempt_id_exam_uq" UNIQUE("id","exam_id"),
	CONSTRAINT "exam_attempt_id_exam_student_uq" UNIQUE("id","exam_id","student_id"),
	CONSTRAINT "exam_attempt_status_check" CHECK ("exam_attempt"."status" IN ('in_progress', 'submitted', 'graded', 'expired')),
	CONSTRAINT "exam_attempt_no_check" CHECK ("exam_attempt"."attempt_no" >= 1),
	CONSTRAINT "exam_attempt_score_check" CHECK ("exam_attempt"."score" IS NULL OR "exam_attempt"."score" >= 0),
	CONSTRAINT "exam_attempt_submitted_check" CHECK (("exam_attempt"."status" IN ('submitted', 'graded') AND "exam_attempt"."submitted_at" IS NOT NULL) OR ("exam_attempt"."status" = 'in_progress' AND "exam_attempt"."submitted_at" IS NULL) OR "exam_attempt"."status" = 'expired'),
	CONSTRAINT "exam_attempt_graded_check" CHECK ("exam_attempt"."status" <> 'graded' OR "exam_attempt"."score" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "exam_course" (
	"exam_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	CONSTRAINT "exam_course_pk" PRIMARY KEY("exam_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "exam_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"marks" numeric(8, 2) NOT NULL,
	"position" integer NOT NULL,
	"snapshot" jsonb,
	CONSTRAINT "exam_question_id_exam_uq" UNIQUE("id","exam_id"),
	CONSTRAINT "exam_question_position_uq" UNIQUE("exam_id","position"),
	CONSTRAINT "exam_question_question_uq" UNIQUE("exam_id","question_id"),
	CONSTRAINT "exam_question_marks_check" CHECK ("exam_question"."marks" > 0),
	CONSTRAINT "exam_question_position_check" CHECK ("exam_question"."position" >= 1)
);
--> statement-breakpoint
CREATE TABLE "exam_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"course_id" uuid,
	"attempt_id" uuid,
	"marks" numeric(8, 2) NOT NULL,
	"grade" text,
	"remarks" text,
	"source" text NOT NULL,
	"released_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_result_uq" UNIQUE("exam_id","student_id"),
	CONSTRAINT "exam_result_source_check" CHECK ("exam_result"."source" IN ('attempt', 'manual', 'manual_override')),
	CONSTRAINT "exam_result_marks_check" CHECK ("exam_result"."marks" >= 0),
	CONSTRAINT "exam_result_enrollment_pair_check" CHECK (("exam_result"."enrollment_id" IS NULL) = ("exam_result"."course_id" IS NULL)),
	CONSTRAINT "exam_result_source_attempt_check" CHECK (("exam_result"."source" = 'attempt' AND "exam_result"."attempt_id" IS NOT NULL) OR ("exam_result"."source" = 'manual' AND "exam_result"."attempt_id" IS NULL) OR "exam_result"."source" = 'manual_override')
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"body" text NOT NULL,
	"image_file_id" uuid,
	"explanation" text,
	"default_marks" numeric(8, 2) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_body_check" CHECK (length(btrim("question"."body")) > 0),
	CONSTRAINT "question_marks_check" CHECK ("question"."default_marks" > 0)
);
--> statement-breakpoint
CREATE TABLE "question_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "question_option_position_uq" UNIQUE("question_id","position"),
	CONSTRAINT "question_option_body_check" CHECK (length(btrim("question_option"."body")) > 0),
	CONSTRAINT "question_option_position_check" CHECK ("question_option"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_attempt_exam_fk" FOREIGN KEY ("attempt_id","exam_id") REFERENCES "public"."exam_attempt"("id","exam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_question_exam_fk" FOREIGN KEY ("exam_question_id","exam_id") REFERENCES "public"."exam_question"("id","exam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam" ADD CONSTRAINT "exam_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_exam_course_fk" FOREIGN KEY ("exam_id","course_id") REFERENCES "public"."exam_course"("exam_id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_enrollment_fk" FOREIGN KEY ("enrollment_id","student_id","course_id") REFERENCES "public"."enrollment"("id","student_id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_course" ADD CONSTRAINT "exam_course_exam_id_exam_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exam"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_course" ADD CONSTRAINT "exam_course_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_question" ADD CONSTRAINT "exam_question_exam_id_exam_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exam"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_question" ADD CONSTRAINT "exam_question_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result" ADD CONSTRAINT "exam_result_exam_id_exam_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exam"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result" ADD CONSTRAINT "exam_result_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result" ADD CONSTRAINT "exam_result_attempt_fk" FOREIGN KEY ("attempt_id","exam_id","student_id") REFERENCES "public"."exam_attempt"("id","exam_id","student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result" ADD CONSTRAINT "exam_result_enrollment_fk" FOREIGN KEY ("enrollment_id","student_id","course_id") REFERENCES "public"."enrollment"("id","student_id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_result" ADD CONSTRAINT "exam_result_exam_course_fk" FOREIGN KEY ("exam_id","course_id") REFERENCES "public"."exam_course"("exam_id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_lecturer_id_lecturer_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_image_file_id_file_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_option" ADD CONSTRAINT "question_option_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_lecturer_idx" ON "exam" USING btree ("lecturer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_attempt_one_running_uq" ON "exam_attempt" USING btree ("exam_id","student_id") WHERE "exam_attempt"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "exam_attempt_student_idx" ON "exam_attempt" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "exam_course_course_idx" ON "exam_course" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "exam_result_student_idx" ON "exam_result" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "question_lecturer_idx" ON "question" USING btree ("lecturer_id");
