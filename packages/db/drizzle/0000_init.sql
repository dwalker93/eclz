-- Initial schema: the whole database in one migration, as it stands after the design v1.0 review rounds.
-- Generated from a fully migrated PostgreSQL 16 database (pg_dump, schema only), so every constraint is already validated and there are no forward fixes.
-- The data the seed provides (institution, branch, grades, permissions, starter roles) is not here: run `bun run db:seed` after `bun run db:migrate`.

-- Functions that name a table's row type (`%ROWTYPE`) are created before the tables are, so their bodies are not checked at creation (reset at the end).
SET check_function_bodies = false;
--> statement-breakpoint
-- Every object below is created unqualified, so the schema they land in is whatever the connection's search_path says first. A role or database default
-- (`ALTER ROLE ... SET search_path`) could point that at another schema, and the migration would still "succeed". Pin it to public for this migration; the check at the end fails the migration if public.organization is not there.
SET search_path = public;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
--> statement-breakpoint
CREATE FUNCTION audit_log_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'J4: audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE FUNCTION commission_entry_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_orig commission_entry%ROWTYPE;
  v_kind text;
  v_payout_status text;
  v_lock uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_entry_guard: commission entries are never deleted';
  END IF;

  -- Lock the old and the new payout row before reading their status, in id order so two entry changes cannot deadlock. A payout moving to paid
  -- updates its own row, which conflicts with this lock: it waits for an entry change that started first, and an entry change that starts after
  -- it waits and then sees 'paid'. A plain SELECT would read the old status without waiting.
  FOR v_lock IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.payout_id END,
      NEW.payout_id
    ]) AS x WHERE x IS NOT NULL ORDER BY x
  LOOP
    PERFORM 1 FROM teacher_payout WHERE id = v_lock FOR SHARE;
  END LOOP;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.payment_allocation_id IS DISTINCT FROM OLD.payment_allocation_id OR NEW.rule_id IS DISTINCT FROM OLD.rule_id
       OR NEW.lecturer_id IS DISTINCT FROM OLD.lecturer_id OR NEW.reverses_entry_id IS DISTINCT FROM OLD.reverses_entry_id
       OR NEW.entry_type IS DISTINCT FROM OLD.entry_type OR NEW.calc_type_applied IS DISTINCT FROM OLD.calc_type_applied
       OR NEW.rate_applied IS DISTINCT FROM OLD.rate_applied OR NEW.share_percent_applied IS DISTINCT FROM OLD.share_percent_applied
       OR NEW.basis_applied IS DISTINCT FROM OLD.basis_applied OR NEW.capped IS DISTINCT FROM OLD.capped
       OR NEW.base_amount IS DISTINCT FROM OLD.base_amount OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
       OR NEW.teacher_amount IS DISTINCT FROM OLD.teacher_amount THEN
      RAISE EXCEPTION 'commission_entry_guard: only status and payout can change on a commission entry';
    END IF;
    IF OLD.payout_id IS NOT NULL THEN
      SELECT status INTO v_payout_status FROM teacher_payout WHERE id = OLD.payout_id;
      IF v_payout_status = 'paid' THEN
        RAISE EXCEPTION 'commission_entry_guard: an entry in a paid payout cannot change';
      END IF;
    END IF;
  END IF;

  IF NEW.payout_id IS NOT NULL THEN
    SELECT status INTO v_payout_status FROM teacher_payout WHERE id = NEW.payout_id;
    IF v_payout_status = 'paid' THEN
      RAISE EXCEPTION 'commission_entry_guard: an entry cannot join a paid payout';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.entry_type = 'accrual' THEN
      SELECT ii.kind INTO v_kind
        FROM payment_allocation pa JOIN invoice_item ii ON ii.id = pa.invoice_item_id
        WHERE pa.id = NEW.payment_allocation_id;
      IF v_kind IS NULL OR v_kind NOT IN ('recurring_fee', 'package_fee') THEN
        RAISE EXCEPTION 'commission_entry_guard: only fee items accrue commission';
      END IF;
      IF NOT EXISTS (
        SELECT 1
          FROM payment_allocation pa
          JOIN invoice_item ii ON ii.id = pa.invoice_item_id
          JOIN enrollment e ON e.id = ii.enrollment_id
          JOIN course_lecturer cl ON cl.course_id = e.course_id
         WHERE pa.id = NEW.payment_allocation_id AND cl.lecturer_id = NEW.lecturer_id
      ) THEN
        RAISE EXCEPTION 'commission_entry_guard: the lecturer does not teach the course of this fee item';
      END IF;
    ELSE
      SELECT * INTO v_orig FROM commission_entry WHERE id = NEW.reverses_entry_id;
      IF v_orig.id IS NULL OR v_orig.entry_type <> 'accrual' THEN
        RAISE EXCEPTION 'commission_entry_guard: a reversal must reverse an accrual';
      END IF;
      IF v_orig.payment_allocation_id <> NEW.payment_allocation_id OR v_orig.lecturer_id <> NEW.lecturer_id
         OR v_orig.rule_id <> NEW.rule_id THEN
        RAISE EXCEPTION 'commission_entry_guard: a reversal must use the allocation, lecturer and rule of the entry it reverses';
      END IF;
      IF NEW.base_amount <> -v_orig.base_amount OR NEW.commission_amount <> -v_orig.commission_amount
         OR NEW.teacher_amount <> -v_orig.teacher_amount THEN
        RAISE EXCEPTION 'commission_entry_guard: a reversal must be the exact negative of the entry it reverses';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION content_purchase_paid_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_access text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.content_id IS NOT DISTINCT FROM OLD.content_id THEN
    RETURN NEW;
  END IF;
  SELECT access_type INTO v_access FROM content_item WHERE id = NEW.content_id;
  IF v_access IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'content_purchase_paid_only: only a paid content item can be purchased';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION course_check_enrollment_intake() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "enrollment" e
    WHERE e."course_id" = NEW."id"
      AND (
        (NEW."kind" = 'class' AND e."intake_id" IS NOT NULL)
        OR (NEW."kind" = 'program' AND NEW."learning_mode" = 'scheduled' AND e."intake_id" IS NULL)
        OR (NEW."kind" = 'program' AND NEW."learning_mode" = 'self_paced' AND e."intake_id" IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'C2: the course has enrolments that do not fit its new kind or learning mode' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION enrollment_check_intake() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  c_kind text;
  c_mode text;
BEGIN
  SELECT "kind", "learning_mode" INTO c_kind, c_mode FROM "course" WHERE "id" = NEW."course_id" FOR SHARE;
  IF c_kind = 'class' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a class enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'scheduled' AND NEW."intake_id" IS NULL THEN
    RAISE EXCEPTION 'C2: a scheduled program enrolment requires an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'self_paced' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a self-paced program enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION exam_insert_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'exam_insert_guard: a new exam must start as a draft';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION exam_question_frozen() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  FOR v_id IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.exam_id END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.exam_id END
    ]) AS x WHERE x IS NOT NULL ORDER BY x
  LOOP
    SELECT status INTO v_status FROM exam WHERE id = v_id FOR SHARE;
    IF v_status <> 'draft' THEN
      RAISE EXCEPTION 'exam_question_frozen: questions of a published exam cannot change';
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE FUNCTION exam_result_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_mode text;
  v_status text;
  v_closes timestamptz;
BEGIN
  SELECT mode, status, closes_at INTO v_mode, v_status, v_closes FROM exam WHERE id = NEW.exam_id FOR SHARE;
  IF v_mode = 'online_mcq' AND NEW.source = 'manual' THEN
    RAISE EXCEPTION 'exam_result_guard: an online exam result comes from an attempt, or is a manual override';
  END IF;
  IF v_mode = 'paper' AND NEW.source <> 'manual' THEN
    RAISE EXCEPTION 'exam_result_guard: a paper exam result is entered manually';
  END IF;
  IF NEW.released_at IS NOT NULL AND v_status <> 'closed' AND (v_closes IS NULL OR v_closes > now()) THEN
    RAISE EXCEPTION 'exam_result_guard: results can be released only after the exam is closed';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION exam_status_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status = 'draft' AND NEW.status = 'published') OR (OLD.status = 'published' AND NEW.status = 'closed')) THEN
      RAISE EXCEPTION 'exam_status_guard: cannot move an exam from % to %', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'published' AND NEW.mode = 'online_mcq' THEN
      PERFORM 1 FROM exam WHERE id = NEW.id FOR NO KEY UPDATE;
      IF NOT EXISTS (SELECT 1 FROM exam_question WHERE exam_id = NEW.id) THEN
        RAISE EXCEPTION 'exam_status_guard: an online exam needs at least one question to be published';
      END IF;
      IF EXISTS (SELECT 1 FROM exam_question WHERE exam_id = NEW.id AND snapshot IS NULL) THEN
        RAISE EXCEPTION 'exam_status_guard: every question needs its snapshot before publishing';
      END IF;
    END IF;
  END IF;
  IF OLD.status <> 'draft' AND NEW.mode IS DISTINCT FROM OLD.mode THEN
    RAISE EXCEPTION 'exam_status_guard: the mode of a published exam cannot change';
  END IF;
  IF NEW.mode IS DISTINCT FROM OLD.mode AND EXISTS (SELECT 1 FROM exam_result WHERE exam_id = NEW.id) THEN
    RAISE EXCEPTION 'exam_status_guard: the mode of an exam with results cannot change';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION gateway_transaction_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_type text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
    PERFORM 1 FROM payment WHERE id = NEW.payment_id FOR SHARE;
    SELECT pm.type INTO v_type
      FROM payment p JOIN payment_method pm ON pm.id = p.payment_method_id
     WHERE p.id = NEW.payment_id
       FOR SHARE OF pm;
    IF v_type IS DISTINCT FROM 'gateway' THEN
      RAISE EXCEPTION 'gateway_transaction_guard: the payment must use a gateway payment method';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION invoice_item_check_discount_enrollment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Under READ COMMITTED, inserting a discount and changing its target's enrolment are not ordered by any row lock (the foreign key only takes a key-share lock,
  -- which a non-key update does not conflict with), so both checks could pass and the committed rows disagree. Lock the item the check is about, the row
  -- itself and the item it reduces, in id order, before reading: a concurrent change to either waits, and the query below then sees its result.
  PERFORM 1 FROM "invoice_item" WHERE "id" IN (NEW."id", NEW."applies_to_item_id") ORDER BY "id" FOR SHARE;
  IF EXISTS (
    SELECT 1 FROM "invoice_item" d
    JOIN "invoice_item" t ON t."id" = d."applies_to_item_id"
    WHERE d."kind" = 'discount'
      AND d."enrollment_id" IS NOT NULL
      AND (d."id" = NEW."id" OR d."applies_to_item_id" = NEW."id")
      AND t."enrollment_id" IS DISTINCT FROM d."enrollment_id"
  ) THEN
    RAISE EXCEPTION 'D19: a discount must carry the same enrolment as the item it reduces' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION payment_allocation_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'payment' THEN
    PERFORM "payment_check_allocations"(NEW."id");
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      PERFORM "payment_check_allocations"(OLD."payment_id");
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      PERFORM "payment_check_allocations"(NEW."payment_id");
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION payment_check_allocations(p_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  p_status text;
  p_amount numeric;
  allocated numeric;
BEGIN
  SELECT "status", "amount" INTO p_status, p_amount FROM "payment" WHERE "id" = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO allocated
    FROM "payment_allocation" WHERE "payment_id" = p_id AND "reversed_at" IS NULL;
  IF p_status = 'verified' AND allocated <> p_amount THEN
    RAISE EXCEPTION 'E3/E4: verified payment % has allocations of % but amount %', p_id, allocated, p_amount
      USING ERRCODE = 'check_violation';
  ELSIF p_status <> 'verified' AND allocated <> 0 THEN
    RAISE EXCEPTION 'E3: payment % is % but has active allocations of %', p_id, p_status, allocated
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION payment_gateway_method_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_type text;
BEGIN
  IF NEW.payment_method_id IS DISTINCT FROM OLD.payment_method_id THEN
    IF EXISTS (SELECT 1 FROM gateway_transaction WHERE payment_id = NEW.id) THEN
      SELECT type INTO v_type FROM payment_method WHERE id = NEW.payment_method_id FOR SHARE;
      IF v_type IS DISTINCT FROM 'gateway' THEN
        RAISE EXCEPTION 'payment_gateway_method_guard: a payment with a gateway transaction must keep a gateway payment method';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION payment_method_gateway_type_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM OLD.type AND NEW.type <> 'gateway' THEN
    IF EXISTS (
      SELECT 1 FROM gateway_transaction gt JOIN payment p ON p.id = gt.payment_id WHERE p.payment_method_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'payment_method_gateway_type_guard: a payment method with gateway transactions must stay a gateway method';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION teacher_payout_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'teacher_payout_guard: a new payout must start as a draft';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'teacher_payout_guard: only a draft payout can be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'teacher_payout_guard: a paid payout is immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT
     ((OLD.status = 'draft' AND NEW.status = 'approved') OR (OLD.status = 'approved' AND NEW.status = 'paid')) THEN
    RAISE EXCEPTION 'teacher_payout_guard: cannot move a payout from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TABLE academic_term (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    CONSTRAINT academic_term_dates_check CHECK ((ends_on >= starts_on))
);
--> statement-breakpoint
CREATE TABLE attempt_answer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    exam_question_id uuid NOT NULL,
    selected_option_key text,
    is_correct boolean,
    marks_awarded numeric(8,2),
    CONSTRAINT attempt_answer_marks_awarded_finite_check CHECK ((marks_awarded <> 'NaN'::numeric)),
    CONSTRAINT attempt_answer_marks_check CHECK (((marks_awarded IS NULL) OR (marks_awarded >= (0)::numeric)))
);
--> statement-breakpoint
CREATE TABLE attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    status text NOT NULL,
    attended_via text,
    marked_via text DEFAULT 'manual'::text NOT NULL,
    note text,
    marked_by uuid,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_attended_via_check CHECK (((attended_via IS NULL) OR (attended_via = ANY (ARRAY['physical'::text, 'online'::text])))),
    CONSTRAINT attendance_marked_via_check CHECK ((marked_via = ANY (ARRAY['manual'::text, 'qr'::text]))),
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text])))
);
--> statement-breakpoint
CREATE TABLE audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE auth_rate_limit (
    key text NOT NULL,
    count integer NOT NULL,
    window_start timestamp with time zone NOT NULL,
    CONSTRAINT auth_rate_limit_count_check CHECK ((count >= 0))
);
--> statement-breakpoint
CREATE TABLE auth_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    mfa_verified_at timestamp with time zone,
    ip text,
    user_agent text
);
--> statement-breakpoint
CREATE TABLE bank_account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    bank_name text NOT NULL,
    branch_name text,
    account_name text NOT NULL,
    account_number text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE branch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE class_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    intake_id uuid,
    session_date date NOT NULL,
    starts_at time without time zone NOT NULL,
    ends_at time without time zone NOT NULL,
    topic text,
    delivery_mode text DEFAULT 'physical'::text NOT NULL,
    meeting_provider text,
    meeting_url text,
    meeting_ref text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    CONSTRAINT class_session_delivery_mode_check CHECK ((delivery_mode = ANY (ARRAY['physical'::text, 'online'::text, 'hybrid'::text]))),
    CONSTRAINT class_session_meeting_provider_check CHECK (((meeting_provider IS NULL) OR (meeting_provider = ANY (ARRAY['zoom'::text, 'teams'::text, 'other'::text])))),
    CONSTRAINT class_session_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'held'::text, 'cancelled'::text]))),
    CONSTRAINT class_session_time_check CHECK ((ends_at > starts_at))
);
--> statement-breakpoint
CREATE TABLE commission_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_allocation_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    lecturer_id uuid NOT NULL,
    payout_id uuid,
    reverses_entry_id uuid,
    entry_type text NOT NULL,
    calc_type_applied text NOT NULL,
    rate_applied numeric(12,2) NOT NULL,
    share_percent_applied numeric(5,2) NOT NULL,
    basis_applied text NOT NULL,
    capped boolean DEFAULT false NOT NULL,
    base_amount numeric(12,2) NOT NULL,
    commission_amount numeric(12,2) NOT NULL,
    teacher_amount numeric(12,2) NOT NULL,
    status text DEFAULT 'accrued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commission_entry_base_amount_finite_check CHECK ((base_amount <> 'NaN'::numeric)),
    CONSTRAINT commission_entry_basis_check CHECK ((basis_applied = ANY (ARRAY['paid'::text, 'list'::text]))),
    CONSTRAINT commission_entry_calc_type_check CHECK ((calc_type_applied = ANY (ARRAY['percent'::text, 'fixed_per_student_month'::text]))),
    CONSTRAINT commission_entry_commission_amount_finite_check CHECK ((commission_amount <> 'NaN'::numeric)),
    CONSTRAINT commission_entry_payout_check CHECK (((status = 'settled'::text) = (payout_id IS NOT NULL))),
    CONSTRAINT commission_entry_rate_applied_finite_check CHECK ((rate_applied <> 'NaN'::numeric)),
    CONSTRAINT commission_entry_rate_check CHECK ((rate_applied >= (0)::numeric)),
    CONSTRAINT commission_entry_share_check CHECK (((share_percent_applied >= (0)::numeric) AND (share_percent_applied <= (100)::numeric))),
    CONSTRAINT commission_entry_share_percent_applied_finite_check CHECK ((share_percent_applied <> 'NaN'::numeric)),
    CONSTRAINT commission_entry_split_check CHECK ((teacher_amount = (base_amount - commission_amount))),
    CONSTRAINT commission_entry_status_check CHECK ((status = ANY (ARRAY['accrued'::text, 'settled'::text, 'void'::text]))),
    CONSTRAINT commission_entry_teacher_amount_finite_check CHECK ((teacher_amount <> 'NaN'::numeric)),
    CONSTRAINT commission_entry_type_amounts_check CHECK ((((entry_type = 'accrual'::text) AND (reverses_entry_id IS NULL) AND (base_amount >= (0)::numeric) AND (commission_amount >= (0)::numeric) AND (commission_amount <= base_amount)) OR ((entry_type = 'reversal'::text) AND (reverses_entry_id IS NOT NULL) AND (base_amount <= (0)::numeric) AND (commission_amount <= (0)::numeric) AND (commission_amount >= base_amount)))),
    CONSTRAINT commission_entry_type_check CHECK ((entry_type = ANY (ARRAY['accrual'::text, 'reversal'::text])))
);
--> statement-breakpoint
CREATE TABLE commission_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecturer_id uuid NOT NULL,
    subject_id uuid,
    grade_level_id uuid,
    course_id uuid,
    calc_type text NOT NULL,
    commission_rate numeric(12,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commission_rule_calc_type_check CHECK ((calc_type = ANY (ARRAY['percent'::text, 'fixed_per_student_month'::text]))),
    CONSTRAINT commission_rule_commission_rate_finite_check CHECK ((commission_rate <> 'NaN'::numeric)),
    CONSTRAINT commission_rule_dates_check CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT commission_rule_rate_check CHECK (((commission_rate >= (0)::numeric) AND ((calc_type <> 'percent'::text) OR (commission_rate <= (100)::numeric)))),
    CONSTRAINT commission_rule_scope_check CHECK ((((course_id IS NOT NULL) AND (subject_id IS NULL) AND (grade_level_id IS NULL)) OR ((course_id IS NULL) AND ((grade_level_id IS NULL) OR (subject_id IS NOT NULL)))))
);
--> statement-breakpoint
CREATE TABLE content_branch (
    content_id uuid NOT NULL,
    branch_id uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE content_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecturer_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    description text,
    external_url text,
    file_id uuid,
    access_type text DEFAULT 'course'::text NOT NULL,
    price numeric(12,2),
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_item_access_type_check CHECK ((access_type = ANY (ARRAY['course'::text, 'free_registered'::text, 'paid'::text]))),
    CONSTRAINT content_item_kind_check CHECK ((kind = ANY (ARRAY['recording'::text, 'file'::text, 'physical_book'::text]))),
    CONSTRAINT content_item_kind_fields_check CHECK ((((kind = 'recording'::text) AND (external_url IS NOT NULL) AND (file_id IS NULL)) OR ((kind = 'file'::text) AND (file_id IS NOT NULL)) OR ((kind = 'physical_book'::text) AND (external_url IS NULL) AND (file_id IS NULL)))),
    CONSTRAINT content_item_paid_price_check CHECK (((access_type <> 'paid'::text) OR ((price IS NOT NULL) AND (price > (0)::numeric)))),
    CONSTRAINT content_item_price_finite_check CHECK ((price <> 'NaN'::numeric)),
    CONSTRAINT content_item_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);
--> statement-breakpoint
CREATE TABLE content_purchase (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_id uuid NOT NULL,
    student_id uuid NOT NULL,
    invoice_id uuid,
    branch_id uuid NOT NULL,
    channel text NOT NULL,
    price numeric(12,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    handed_over_at timestamp with time zone,
    handed_over_by uuid,
    CONSTRAINT content_purchase_channel_check CHECK ((channel = ANY (ARRAY['online'::text, 'physical'::text]))),
    CONSTRAINT content_purchase_handover_check CHECK ((((handed_over_at IS NULL) AND (handed_over_by IS NULL)) OR ((handed_over_at IS NOT NULL) AND (handed_over_by IS NOT NULL) AND (status = 'paid'::text) AND (channel = 'physical'::text)))),
    CONSTRAINT content_purchase_paid_invoice_check CHECK (((status <> 'paid'::text) OR (invoice_id IS NOT NULL))),
    CONSTRAINT content_purchase_price_check CHECK ((price > (0)::numeric)),
    CONSTRAINT content_purchase_price_finite_check CHECK ((price <> 'NaN'::numeric)),
    CONSTRAINT content_purchase_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))
);
--> statement-breakpoint
CREATE TABLE course (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    course_group_id uuid,
    term_id uuid,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    learning_mode text DEFAULT 'scheduled'::text NOT NULL,
    delivery_mode text DEFAULT 'physical'::text NOT NULL,
    attendance_enabled boolean DEFAULT true NOT NULL,
    batch_label text,
    capacity integer,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT course_class_is_scheduled_check CHECK (((kind <> 'class'::text) OR (learning_mode = 'scheduled'::text))),
    CONSTRAINT course_delivery_mode_check CHECK ((delivery_mode = ANY (ARRAY['physical'::text, 'online'::text, 'hybrid'::text]))),
    CONSTRAINT course_kind_check CHECK ((kind = ANY (ARRAY['class'::text, 'program'::text]))),
    CONSTRAINT course_learning_mode_check CHECK ((learning_mode = ANY (ARRAY['scheduled'::text, 'self_paced'::text]))),
    CONSTRAINT course_self_paced_no_attendance_check CHECK (((learning_mode <> 'self_paced'::text) OR (NOT attendance_enabled))),
    CONSTRAINT course_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text, 'archived'::text])))
);
--> statement-breakpoint
CREATE TABLE course_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    section_id uuid,
    content_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE course_grade_level (
    course_id uuid NOT NULL,
    grade_level_id uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE course_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    name text NOT NULL,
    batch_label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE course_lecturer (
    course_id uuid NOT NULL,
    lecturer_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    share_percent numeric(5,2) DEFAULT '100'::numeric NOT NULL,
    CONSTRAINT course_lecturer_share_check CHECK (((share_percent >= (0)::numeric) AND (share_percent <= (100)::numeric))),
    CONSTRAINT course_lecturer_share_percent_finite_check CHECK ((share_percent <> 'NaN'::numeric))
);
--> statement-breakpoint
CREATE TABLE course_section (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE enrollment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    student_id uuid NOT NULL,
    intake_id uuid,
    fee_structure_id uuid,
    billing_grade_level_id uuid,
    preferred_mode text,
    status text DEFAULT 'active'::text NOT NULL,
    end_reason text,
    promoted_from_enrollment_id uuid,
    access_status text DEFAULT 'active'::text NOT NULL,
    enrolled_on date DEFAULT CURRENT_DATE NOT NULL,
    access_starts_on date DEFAULT CURRENT_DATE NOT NULL,
    access_ends_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enrollment_access_dates_check CHECK (((access_ends_on IS NULL) OR (access_ends_on > access_starts_on))),
    CONSTRAINT enrollment_access_status_check CHECK ((access_status = ANY (ARRAY['active'::text, 'restricted'::text]))),
    CONSTRAINT enrollment_active_has_no_end_reason_check CHECK (((status <> 'active'::text) OR (end_reason IS NULL))),
    CONSTRAINT enrollment_end_reason_check CHECK (((end_reason IS NULL) OR (end_reason = ANY (ARRAY['dropped'::text, 'promoted'::text, 'course_ended'::text, 'transferred'::text])))),
    CONSTRAINT enrollment_preferred_mode_check CHECK (((preferred_mode IS NULL) OR (preferred_mode = ANY (ARRAY['physical'::text, 'online'::text])))),
    CONSTRAINT enrollment_status_check CHECK ((status = ANY (ARRAY['active'::text, 'dropped'::text, 'completed'::text])))
);
--> statement-breakpoint
CREATE TABLE exam (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecturer_id uuid NOT NULL,
    title text NOT NULL,
    mode text NOT NULL,
    exam_date date,
    max_marks numeric(8,2),
    weight numeric(8,2),
    opens_at timestamp with time zone,
    closes_at timestamp with time zone,
    time_limit_minutes integer,
    max_attempts integer,
    attempt_scoring text DEFAULT 'best'::text NOT NULL,
    shuffle_questions boolean DEFAULT false NOT NULL,
    results_visibility text DEFAULT 'after_release'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lock_answers boolean DEFAULT false NOT NULL,
    CONSTRAINT exam_attempts_check CHECK (((max_attempts IS NULL) OR (max_attempts >= 1))),
    CONSTRAINT exam_max_marks_check CHECK (((max_marks IS NULL) OR (max_marks > (0)::numeric))),
    CONSTRAINT exam_max_marks_finite_check CHECK ((max_marks <> 'NaN'::numeric)),
    CONSTRAINT exam_mode_check CHECK ((mode = ANY (ARRAY['online_mcq'::text, 'paper'::text]))),
    CONSTRAINT exam_mode_fields_check CHECK ((((mode = 'online_mcq'::text) AND (opens_at IS NOT NULL) AND (closes_at IS NOT NULL) AND (max_attempts IS NOT NULL)) OR ((mode = 'paper'::text) AND (exam_date IS NOT NULL) AND (max_marks IS NOT NULL) AND (opens_at IS NULL) AND (closes_at IS NULL) AND (time_limit_minutes IS NULL) AND (max_attempts IS NULL)))),
    CONSTRAINT exam_scoring_check CHECK ((attempt_scoring = ANY (ARRAY['best'::text, 'latest'::text]))),
    CONSTRAINT exam_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'closed'::text]))),
    CONSTRAINT exam_time_limit_check CHECK (((time_limit_minutes IS NULL) OR (time_limit_minutes > 0))),
    CONSTRAINT exam_title_check CHECK ((length(btrim(title)) > 0)),
    CONSTRAINT exam_visibility_check CHECK ((results_visibility = ANY (ARRAY['immediate'::text, 'after_release'::text, 'manual'::text]))),
    CONSTRAINT exam_weight_check CHECK (((weight IS NULL) OR (weight > (0)::numeric))),
    CONSTRAINT exam_weight_finite_check CHECK ((weight <> 'NaN'::numeric)),
    CONSTRAINT exam_window_check CHECK (((opens_at IS NULL) OR (closes_at IS NULL) OR (closes_at > opens_at)))
);
--> statement-breakpoint
CREATE TABLE exam_attempt (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    course_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    score numeric(8,2),
    status text DEFAULT 'in_progress'::text NOT NULL,
    CONSTRAINT exam_attempt_graded_check CHECK (((status <> 'graded'::text) OR (score IS NOT NULL))),
    CONSTRAINT exam_attempt_no_check CHECK ((attempt_no >= 1)),
    CONSTRAINT exam_attempt_score_check CHECK (((score IS NULL) OR (score >= (0)::numeric))),
    CONSTRAINT exam_attempt_score_finite_check CHECK ((score <> 'NaN'::numeric)),
    CONSTRAINT exam_attempt_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'graded'::text, 'expired'::text]))),
    CONSTRAINT exam_attempt_submitted_check CHECK ((((status = ANY (ARRAY['submitted'::text, 'graded'::text])) AND (submitted_at IS NOT NULL)) OR ((status = 'in_progress'::text) AND (submitted_at IS NULL)) OR (status = 'expired'::text)))
);
--> statement-breakpoint
CREATE TABLE exam_course (
    exam_id uuid NOT NULL,
    course_id uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE exam_question (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    question_id uuid NOT NULL,
    marks numeric(8,2) NOT NULL,
    "position" integer NOT NULL,
    snapshot jsonb,
    CONSTRAINT exam_question_marks_check CHECK ((marks > (0)::numeric)),
    CONSTRAINT exam_question_marks_finite_check CHECK ((marks <> 'NaN'::numeric)),
    CONSTRAINT exam_question_position_check CHECK (("position" >= 1))
);
--> statement-breakpoint
CREATE TABLE exam_result (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrollment_id uuid,
    course_id uuid,
    attempt_id uuid,
    marks numeric(8,2) NOT NULL,
    grade text,
    remarks text,
    source text NOT NULL,
    released_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_result_enrollment_pair_check CHECK (((enrollment_id IS NULL) = (course_id IS NULL))),
    CONSTRAINT exam_result_marks_check CHECK ((marks >= (0)::numeric)),
    CONSTRAINT exam_result_marks_finite_check CHECK ((marks <> 'NaN'::numeric)),
    CONSTRAINT exam_result_source_attempt_check CHECK ((((source = 'attempt'::text) AND (attempt_id IS NOT NULL)) OR ((source = 'manual'::text) AND (attempt_id IS NULL)) OR (source = 'manual_override'::text))),
    CONSTRAINT exam_result_source_check CHECK ((source = ANY (ARRAY['attempt'::text, 'manual'::text, 'manual_override'::text])))
);
--> statement-breakpoint
CREATE TABLE fee_exception (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    course_id uuid NOT NULL,
    kind text NOT NULL,
    alternate_fee_structure_id uuid,
    discount_type text,
    discount_value numeric(12,2),
    effective_from date NOT NULL,
    effective_to date,
    reason text NOT NULL,
    created_by uuid NOT NULL,
    ended_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_exception_dates_check CHECK (((effective_to IS NULL) OR (effective_to > effective_from))),
    CONSTRAINT fee_exception_discount_value_check CHECK (((discount_type IS NULL) OR ((discount_value IS NOT NULL) AND (discount_value >= (0)::numeric) AND ((discount_type <> 'percent'::text) OR (discount_value <= (100)::numeric))))),
    CONSTRAINT fee_exception_discount_value_finite_check CHECK ((discount_value <> 'NaN'::numeric)),
    CONSTRAINT fee_exception_ended_check CHECK (((ended_by IS NULL) OR (effective_to IS NOT NULL))),
    CONSTRAINT fee_exception_kind_check CHECK ((kind = ANY (ARRAY['alternate_option'::text, 'discount'::text]))),
    CONSTRAINT fee_exception_kind_columns_check CHECK ((((kind = 'alternate_option'::text) AND (alternate_fee_structure_id IS NOT NULL) AND (discount_type IS NULL) AND (discount_value IS NULL)) OR ((kind = 'discount'::text) AND (alternate_fee_structure_id IS NULL) AND (discount_type IS NOT NULL) AND (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])) AND (discount_value IS NOT NULL)))),
    CONSTRAINT fee_exception_reason_check CHECK ((length(btrim(reason)) > 0))
);
--> statement-breakpoint
CREATE TABLE fee_rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fee_structure_id uuid NOT NULL,
    grade_level_id uuid,
    amount numeric(12,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    CONSTRAINT fee_rate_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT fee_rate_amount_finite_check CHECK ((amount <> 'NaN'::numeric)),
    CONSTRAINT fee_rate_dates_check CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);
--> statement-breakpoint
CREATE TABLE fee_structure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    course_id uuid,
    intake_id uuid,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    billing_type text NOT NULL,
    frequency text,
    access_duration_months integer,
    overdue_grace_days integer,
    overdue_action text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_structure_billing_type_check CHECK ((billing_type = ANY (ARRAY['recurring'::text, 'one_time_package'::text]))),
    CONSTRAINT fee_structure_default_needs_course_check CHECK (((NOT is_default) OR (course_id IS NOT NULL))),
    CONSTRAINT fee_structure_duration_check CHECK (((access_duration_months IS NULL) OR ((billing_type = 'one_time_package'::text) AND (access_duration_months > 0)))),
    CONSTRAINT fee_structure_frequency_check CHECK ((((billing_type = 'recurring'::text) AND (frequency IS NOT NULL) AND (frequency = ANY (ARRAY['monthly'::text, 'per_term'::text]))) OR ((billing_type = 'one_time_package'::text) AND (frequency IS NULL)))),
    CONSTRAINT fee_structure_grace_days_check CHECK (((overdue_grace_days IS NULL) OR (overdue_grace_days >= 0))),
    CONSTRAINT fee_structure_intake_needs_course_check CHECK (((intake_id IS NULL) OR (course_id IS NOT NULL))),
    CONSTRAINT fee_structure_overdue_action_check CHECK (((overdue_action IS NULL) OR (overdue_action = ANY (ARRAY['none'::text, 'notify'::text, 'restrict'::text, 'notify_and_restrict'::text]))))
);
--> statement-breakpoint
CREATE TABLE file (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uploaded_by uuid,
    storage_key text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_size_check CHECK ((size_bytes >= 0))
);
--> statement-breakpoint
CREATE TABLE gateway_transaction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    provider text NOT NULL,
    provider_ref text,
    status text DEFAULT 'initiated'::text NOT NULL,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gateway_transaction_provider_check CHECK ((length(btrim(provider)) > 0)),
    CONSTRAINT gateway_transaction_ref_check CHECK (((provider_ref IS NULL) OR (length(btrim(provider_ref)) > 0))),
    CONSTRAINT gateway_transaction_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT gateway_transaction_succeeded_check CHECK (((status <> 'succeeded'::text) OR (provider_ref IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE grade_level (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    stage text NOT NULL,
    ordinal integer NOT NULL,
    CONSTRAINT grade_level_stage_check CHECK ((stage = ANY (ARRAY['primary'::text, 'junior'::text, 'ordinary_level'::text, 'advanced_level'::text])))
);
--> statement-breakpoint
CREATE TABLE guardian (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    phone text,
    address text,
    nic text,
    email text,
    portal_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE installment_option (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fee_structure_id uuid NOT NULL,
    name text NOT NULL,
    installment_count integer NOT NULL,
    down_payment_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    interval_days integer NOT NULL,
    surcharge_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT installment_option_count_check CHECK ((installment_count >= 2)),
    CONSTRAINT installment_option_down_payment_check CHECK (((down_payment_percent >= (0)::numeric) AND (down_payment_percent < (100)::numeric))),
    CONSTRAINT installment_option_down_payment_percent_finite_check CHECK ((down_payment_percent <> 'NaN'::numeric)),
    CONSTRAINT installment_option_interval_check CHECK ((interval_days > 0)),
    CONSTRAINT installment_option_surcharge_check CHECK ((surcharge_percent >= (0)::numeric)),
    CONSTRAINT installment_option_surcharge_percent_finite_check CHECK ((surcharge_percent <> 'NaN'::numeric))
);
--> statement-breakpoint
CREATE TABLE intake (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    name text NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    capacity integer,
    status text DEFAULT 'open'::text NOT NULL,
    CONSTRAINT intake_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT intake_dates_check CHECK (((ends_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT intake_status_check CHECK ((status = ANY (ARRAY['open'::text, 'running'::text, 'closed'::text])))
);
--> statement-breakpoint
CREATE TABLE invoice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    issued_on date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount_total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    installment_option_id uuid,
    CONSTRAINT invoice_amount_paid_finite_check CHECK ((amount_paid <> 'NaN'::numeric)),
    CONSTRAINT invoice_discount_range_check CHECK (((discount_total >= (0)::numeric) AND (discount_total <= subtotal))),
    CONSTRAINT invoice_discount_total_finite_check CHECK ((discount_total <> 'NaN'::numeric)),
    CONSTRAINT invoice_due_date_check CHECK ((due_date >= issued_on)),
    CONSTRAINT invoice_paid_range_check CHECK (((amount_paid >= (0)::numeric) AND (amount_paid <= total))),
    CONSTRAINT invoice_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'overdue'::text, 'waived'::text, 'cancelled'::text]))),
    CONSTRAINT invoice_subtotal_finite_check CHECK ((subtotal <> 'NaN'::numeric)),
    CONSTRAINT invoice_total_finite_check CHECK ((total <> 'NaN'::numeric)),
    CONSTRAINT invoice_total_formula_check CHECK ((total = (subtotal - discount_total))),
    CONSTRAINT invoice_zero_total_check CHECK (((total > (0)::numeric) OR (status = ANY (ARRAY['waived'::text, 'cancelled'::text]))))
);
--> statement-breakpoint
CREATE TABLE invoice_installment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    seq integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT invoice_installment_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT invoice_installment_amount_finite_check CHECK ((amount <> 'NaN'::numeric)),
    CONSTRAINT invoice_installment_amount_paid_finite_check CHECK ((amount_paid <> 'NaN'::numeric)),
    CONSTRAINT invoice_installment_paid_check CHECK (((amount_paid >= (0)::numeric) AND (amount_paid <= amount))),
    CONSTRAINT invoice_installment_seq_check CHECK ((seq >= 1)),
    CONSTRAINT invoice_installment_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'overdue'::text])))
);
--> statement-breakpoint
CREATE TABLE invoice_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    kind text NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    enrollment_id uuid,
    fee_structure_id uuid,
    grade_level_id uuid,
    applies_to_item_id uuid,
    cancelled_at timestamp with time zone,
    period_start date,
    period_end date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fee_exception_id uuid,
    content_purchase_id uuid,
    CONSTRAINT invoice_item_amount_finite_check CHECK ((amount <> 'NaN'::numeric)),
    CONSTRAINT invoice_item_applies_kind_check CHECK (((applies_to_item_id IS NULL) OR (kind = ANY (ARRAY['discount'::text, 'adjustment'::text])))),
    CONSTRAINT invoice_item_content_fields_check CHECK ((((kind = 'content'::text) AND (content_purchase_id IS NOT NULL)) OR ((kind <> 'content'::text) AND (content_purchase_id IS NULL)))),
    CONSTRAINT invoice_item_discount_applies_check CHECK (((kind <> 'discount'::text) OR (applies_to_item_id IS NOT NULL))),
    CONSTRAINT invoice_item_exception_enrollment_check CHECK (((fee_exception_id IS NULL) OR (enrollment_id IS NOT NULL))),
    CONSTRAINT invoice_item_exception_kind_check CHECK (((fee_exception_id IS NULL) OR (kind = 'discount'::text))),
    CONSTRAINT invoice_item_kind_check CHECK ((kind = ANY (ARRAY['recurring_fee'::text, 'package_fee'::text, 'content'::text, 'adjustment'::text, 'discount'::text]))),
    CONSTRAINT invoice_item_negative_adjustment_check CHECK (((kind <> 'adjustment'::text) OR (amount > (0)::numeric) OR (applies_to_item_id IS NOT NULL))),
    CONSTRAINT invoice_item_package_fields_check CHECK (((kind <> 'package_fee'::text) OR ((enrollment_id IS NOT NULL) AND (fee_structure_id IS NOT NULL)))),
    CONSTRAINT invoice_item_period_check CHECK (((period_start IS NULL) OR (period_end IS NULL) OR (period_end > period_start))),
    CONSTRAINT invoice_item_recurring_fields_check CHECK (((kind <> 'recurring_fee'::text) OR ((enrollment_id IS NOT NULL) AND (fee_structure_id IS NOT NULL) AND (period_start IS NOT NULL) AND (period_end IS NOT NULL)))),
    CONSTRAINT invoice_item_sign_check CHECK ((((kind = ANY (ARRAY['recurring_fee'::text, 'package_fee'::text, 'content'::text])) AND (amount > (0)::numeric)) OR ((kind = 'discount'::text) AND (amount < (0)::numeric)) OR ((kind = 'adjustment'::text) AND (amount <> (0)::numeric))))
);
--> statement-breakpoint
CREATE TABLE lecturer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    qualification text,
    bio text,
    portal_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lecturer_portal_needs_user_check CHECK (((NOT portal_enabled) OR (user_id IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE lecturer_branch (
    lecturer_id uuid NOT NULL,
    branch_id uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_body_check CHECK ((length(btrim(body)) > 0))
);
--> statement-breakpoint
CREATE TABLE message_thread (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject text NOT NULL,
    course_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_thread_subject_check CHECK ((length(btrim(subject)) > 0))
);
--> statement-breakpoint
CREATE TABLE notice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    branch_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT notice_expiry_check CHECK (((expires_at IS NULL) OR (expires_at > published_at)))
);
--> statement-breakpoint
CREATE TABLE notice_target (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notice_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    CONSTRAINT notice_target_id_check CHECK (((target_type = 'all'::text) = (target_id IS NULL))),
    CONSTRAINT notice_target_type_check CHECK ((target_type = ANY (ARRAY['all'::text, 'role'::text, 'course'::text, 'grade'::text, 'student'::text])))
);
--> statement-breakpoint
CREATE TABLE notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    template_id uuid,
    channel text NOT NULL,
    event text NOT NULL,
    event_key text NOT NULL,
    payload jsonb,
    status text DEFAULT 'queued'::text NOT NULL,
    sent_at timestamp with time zone,
    read_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_until timestamp with time zone,
    CONSTRAINT notification_channel_value_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'in_app'::text]))),
    CONSTRAINT notification_event_check CHECK ((event = ANY (ARRAY['payment_submitted'::text, 'payment_verified'::text, 'payment_rejected'::text, 'receipt_issued'::text, 'installment_due'::text, 'installment_overdue'::text, 'attendance_marked'::text, 'class_reminder'::text, 'exam_published'::text, 'notice'::text]))),
    CONSTRAINT notification_failed_check CHECK (((status <> 'failed'::text) OR (error IS NOT NULL))),
    CONSTRAINT notification_sending_check CHECK (((status <> 'sending'::text) OR (claimed_until IS NOT NULL))),
    CONSTRAINT notification_sent_check CHECK (((status <> 'sent'::text) OR (sent_at IS NOT NULL))),
    CONSTRAINT notification_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'unconfirmed'::text]))),
    CONSTRAINT notification_unconfirmed_check CHECK (((status <> 'unconfirmed'::text) OR (error IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE notification_channel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel text NOT NULL,
    provider text,
    is_enabled boolean DEFAULT false NOT NULL,
    config jsonb,
    CONSTRAINT notification_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'in_app'::text])))
);
--> statement-breakpoint
CREATE TABLE notification_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    event text NOT NULL,
    channel text NOT NULL,
    subject text,
    body text NOT NULL,
    CONSTRAINT notification_template_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'in_app'::text]))),
    CONSTRAINT notification_template_event_check CHECK ((event = ANY (ARRAY['payment_submitted'::text, 'payment_verified'::text, 'payment_rejected'::text, 'receipt_issued'::text, 'installment_due'::text, 'installment_overdue'::text, 'attendance_marked'::text, 'class_reminder'::text, 'exam_published'::text, 'notice'::text])))
);
--> statement-breakpoint
CREATE TABLE organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    enabled_modules jsonb DEFAULT '{}'::jsonb NOT NULL,
    currency text DEFAULT 'LKR'::text NOT NULL,
    timezone text DEFAULT 'Asia/Colombo'::text NOT NULL,
    guardian_required_below_age integer DEFAULT 16 NOT NULL,
    signing_key_ref text,
    overdue_grace_days integer DEFAULT 7 NOT NULL,
    overdue_action text DEFAULT 'notify'::text NOT NULL,
    discount_commission_basis text DEFAULT 'paid'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_commission_basis_check CHECK ((discount_commission_basis = ANY (ARRAY['paid'::text, 'list'::text]))),
    CONSTRAINT organization_grace_days_check CHECK ((overdue_grace_days >= 0)),
    CONSTRAINT organization_guardian_age_check CHECK ((guardian_required_below_age >= 0)),
    CONSTRAINT organization_overdue_action_check CHECK ((overdue_action = ANY (ARRAY['none'::text, 'notify'::text, 'restrict'::text, 'notify_and_restrict'::text]))),
    CONSTRAINT organization_type_check CHECK ((type = ANY (ARRAY['individual'::text, 'institution'::text])))
);
--> statement-breakpoint
CREATE TABLE payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    submitted_by uuid,
    branch_id uuid NOT NULL,
    payment_method_id uuid NOT NULL,
    bank_account_id uuid,
    slip_file_id uuid,
    amount numeric(12,2) NOT NULL,
    paid_on date,
    reference_no text,
    status text DEFAULT 'pending_verification'::text NOT NULL,
    rejection_reason text,
    verified_by uuid,
    verified_at timestamp with time zone,
    void_reason text,
    voided_by uuid,
    voided_at timestamp with time zone,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_amount_finite_check CHECK ((amount <> 'NaN'::numeric)),
    CONSTRAINT payment_rejected_fields_check CHECK (((status <> 'rejected'::text) OR (rejection_reason IS NOT NULL))),
    CONSTRAINT payment_status_check CHECK ((status = ANY (ARRAY['pending_verification'::text, 'verified'::text, 'rejected'::text, 'voided'::text]))),
    CONSTRAINT payment_verified_fields_check CHECK (((status <> 'verified'::text) OR ((verified_by IS NOT NULL) AND (verified_at IS NOT NULL)))),
    CONSTRAINT payment_voided_fields_check CHECK (((status <> 'voided'::text) OR ((void_reason IS NOT NULL) AND (voided_by IS NOT NULL) AND (voided_at IS NOT NULL))))
);
--> statement-breakpoint
CREATE TABLE payment_allocation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    invoice_item_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    reversed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_allocation_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_allocation_amount_finite_check CHECK ((amount <> 'NaN'::numeric))
);
--> statement-breakpoint
CREATE TABLE payment_method (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb,
    CONSTRAINT payment_method_type_check CHECK ((type = ANY (ARRAY['bank_transfer'::text, 'cash'::text, 'gateway'::text])))
);
--> statement-breakpoint
CREATE TABLE permission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text
);
--> statement-breakpoint
CREATE TABLE promotion_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_run_id uuid NOT NULL,
    student_id uuid NOT NULL,
    from_enrollment_id uuid,
    to_course_id uuid,
    decision text DEFAULT 'needs_review'::text NOT NULL,
    to_enrollment_id uuid,
    note text,
    CONSTRAINT promotion_item_decision_check CHECK ((decision = ANY (ARRAY['move'::text, 'stay'::text, 'skip'::text, 'needs_review'::text])))
);
--> statement-breakpoint
CREATE TABLE promotion_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    performed_by uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    effective_date date NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    note text,
    CONSTRAINT promotion_run_confirmed_check CHECK (((status <> 'confirmed'::text) OR (confirmed_at IS NOT NULL))),
    CONSTRAINT promotion_run_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'discarded'::text])))
);
--> statement-breakpoint
CREATE TABLE push_subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh_key text NOT NULL,
    auth_key text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE question (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecturer_id uuid NOT NULL,
    body text NOT NULL,
    image_file_id uuid,
    explanation text,
    default_marks numeric(8,2) DEFAULT '1'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT question_body_check CHECK ((length(btrim(body)) > 0)),
    CONSTRAINT question_default_marks_finite_check CHECK ((default_marks <> 'NaN'::numeric)),
    CONSTRAINT question_marks_check CHECK ((default_marks > (0)::numeric))
);
--> statement-breakpoint
CREATE TABLE question_option (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    body text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    "position" integer NOT NULL,
    CONSTRAINT question_option_body_check CHECK ((length(btrim(body)) > 0)),
    CONSTRAINT question_option_position_check CHECK (("position" >= 1))
);
--> statement-breakpoint
CREATE TABLE receipt (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    receipt_no text NOT NULL,
    verification_code text NOT NULL,
    content_hash text NOT NULL,
    signature text NOT NULL,
    signed_at timestamp with time zone NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'issued'::text NOT NULL,
    replaced_by_receipt_id uuid,
    file_id uuid,
    CONSTRAINT receipt_replaced_check CHECK (((replaced_by_receipt_id IS NULL) OR (status = 'void'::text))),
    CONSTRAINT receipt_status_check CHECK ((status = ANY (ARRAY['issued'::text, 'void'::text])))
);
--> statement-breakpoint
CREATE TABLE receipt_counter (
    branch_id uuid NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    CONSTRAINT receipt_counter_check CHECK ((last_number >= 0))
);
--> statement-breakpoint
CREATE TABLE role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE role_permission (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE schedule_slot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    intake_id uuid,
    weekday integer NOT NULL,
    starts_at time without time zone NOT NULL,
    ends_at time without time zone NOT NULL,
    room text,
    CONSTRAINT schedule_slot_time_check CHECK ((ends_at > starts_at)),
    CONSTRAINT schedule_slot_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7)))
);
--> statement-breakpoint
CREATE TABLE staff_role_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    branch_id uuid
);
--> statement-breakpoint
CREATE TABLE student (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    student_no text NOT NULL,
    full_name text NOT NULL,
    date_of_birth date NOT NULL,
    gender text,
    school_name text,
    nic text,
    contact_email text,
    contact_phone text,
    qr_token text DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_status_check CHECK ((status = ANY (ARRAY['active'::text, 'alumni'::text, 'suspended'::text])))
);
--> statement-breakpoint
CREATE TABLE student_branch (
    student_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    joined_on date DEFAULT CURRENT_DATE NOT NULL
);
--> statement-breakpoint
CREATE TABLE student_guardian (
    student_id uuid NOT NULL,
    guardian_id uuid NOT NULL,
    relationship text,
    is_primary boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE student_level (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    grade_level_id uuid NOT NULL,
    promotion_run_id uuid,
    from_date date NOT NULL,
    to_date date,
    reason text DEFAULT 'admission'::text NOT NULL,
    CONSTRAINT student_level_dates_check CHECK (((to_date IS NULL) OR (to_date > from_date))),
    CONSTRAINT student_level_reason_check CHECK ((reason = ANY (ARRAY['admission'::text, 'promotion'::text, 'correction'::text])))
);
--> statement-breakpoint
CREATE TABLE subject (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text,
    name text NOT NULL
);
--> statement-breakpoint
CREATE TABLE teacher_payout (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecturer_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    gross_collected numeric(12,2) NOT NULL,
    commission_total numeric(12,2) NOT NULL,
    net_payable numeric(12,2) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    paid_on date,
    payment_reference text,
    proof_file_id uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_payout_amounts_check CHECK (((net_payable >= (0)::numeric) AND (net_payable = (gross_collected - commission_total)))),
    CONSTRAINT teacher_payout_approved_check CHECK (((status = 'draft'::text) OR (approved_by IS NOT NULL))),
    CONSTRAINT teacher_payout_commission_total_finite_check CHECK ((commission_total <> 'NaN'::numeric)),
    CONSTRAINT teacher_payout_gross_collected_finite_check CHECK ((gross_collected <> 'NaN'::numeric)),
    CONSTRAINT teacher_payout_net_payable_finite_check CHECK ((net_payable <> 'NaN'::numeric)),
    CONSTRAINT teacher_payout_paid_check CHECK (((status <> 'paid'::text) OR ((paid_on IS NOT NULL) AND (payment_reference IS NOT NULL)))),
    CONSTRAINT teacher_payout_period_check CHECK ((period_end > period_start)),
    CONSTRAINT teacher_payout_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'paid'::text])))
);
--> statement-breakpoint
CREATE TABLE thread_participant (
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    username text,
    phone text,
    password_hash text,
    status text DEFAULT 'active'::text NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_has_login_check CHECK (((email IS NOT NULL) OR (username IS NOT NULL))),
    CONSTRAINT user_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);
--> statement-breakpoint
CREATE TABLE user_two_factor (
    user_id uuid NOT NULL,
    secret_cipher text NOT NULL,
    enabled_at timestamp with time zone,
    recovery_hashes jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_step bigint
);
--> statement-breakpoint
ALTER TABLE ONLY academic_term
    ADD CONSTRAINT academic_term_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY attempt_answer
    ADD CONSTRAINT attempt_answer_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY attempt_answer
    ADD CONSTRAINT attempt_answer_uq UNIQUE (attempt_id, exam_question_id);
--> statement-breakpoint
ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_session_student_uq UNIQUE (session_id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY auth_rate_limit
    ADD CONSTRAINT auth_rate_limit_pkey PRIMARY KEY (key);
--> statement-breakpoint
ALTER TABLE ONLY auth_session
    ADD CONSTRAINT auth_session_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY auth_session
    ADD CONSTRAINT auth_session_token_hash_unique UNIQUE (token_hash);
--> statement-breakpoint
ALTER TABLE ONLY bank_account
    ADD CONSTRAINT bank_account_id_branch_uq UNIQUE (id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY bank_account
    ADD CONSTRAINT bank_account_number_uq UNIQUE (branch_id, bank_name, account_number);
--> statement-breakpoint
ALTER TABLE ONLY bank_account
    ADD CONSTRAINT bank_account_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY class_session
    ADD CONSTRAINT class_session_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY commission_entry
    ADD CONSTRAINT commission_entry_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_id_lecturer_uq UNIQUE (id, lecturer_id);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_no_overlap EXCLUDE USING gist (lecturer_id WITH =, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, COALESCE(grade_level_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY content_branch
    ADD CONSTRAINT content_branch_content_id_branch_id_pk PRIMARY KEY (content_id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY content_item
    ADD CONSTRAINT content_item_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_id_invoice_uq UNIQUE (id, invoice_id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY course_content
    ADD CONSTRAINT course_content_course_content_uq UNIQUE (course_id, content_id);
--> statement-breakpoint
ALTER TABLE ONLY course_content
    ADD CONSTRAINT course_content_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY course_grade_level
    ADD CONSTRAINT course_grade_level_course_id_grade_level_id_pk PRIMARY KEY (course_id, grade_level_id);
--> statement-breakpoint
ALTER TABLE ONLY course_group
    ADD CONSTRAINT course_group_id_branch_uq UNIQUE (id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY course_group
    ADD CONSTRAINT course_group_id_subject_uq UNIQUE (id, subject_id);
--> statement-breakpoint
ALTER TABLE ONLY course_group
    ADD CONSTRAINT course_group_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_id_branch_uq UNIQUE (id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY course_lecturer
    ADD CONSTRAINT course_lecturer_course_id_lecturer_id_pk PRIMARY KEY (course_id, lecturer_id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY course_section
    ADD CONSTRAINT course_section_id_course_uq UNIQUE (id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY course_section
    ADD CONSTRAINT course_section_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_id_course_uq UNIQUE (id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_id_student_course_uq UNIQUE (id, student_id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_id_exam_student_uq UNIQUE (id, exam_id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_id_exam_uq UNIQUE (id, exam_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_no_uq UNIQUE (exam_id, student_id, attempt_no);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY exam_course
    ADD CONSTRAINT exam_course_pk PRIMARY KEY (exam_id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY exam
    ADD CONSTRAINT exam_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY exam_question
    ADD CONSTRAINT exam_question_id_exam_uq UNIQUE (id, exam_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_question
    ADD CONSTRAINT exam_question_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY exam_question
    ADD CONSTRAINT exam_question_position_uq UNIQUE (exam_id, "position");
--> statement-breakpoint
ALTER TABLE ONLY exam_question
    ADD CONSTRAINT exam_question_question_uq UNIQUE (exam_id, question_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_uq UNIQUE (exam_id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_id_enrollment_uq UNIQUE (id, enrollment_id);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_no_overlap EXCLUDE USING gist (enrollment_id WITH =, kind WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY fee_rate
    ADD CONSTRAINT fee_rate_no_overlap EXCLUDE USING gist (fee_structure_id WITH =, COALESCE(grade_level_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange(effective_from, effective_to, '[)'::text) WITH &&);
--> statement-breakpoint
ALTER TABLE ONLY fee_rate
    ADD CONSTRAINT fee_rate_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY fee_structure
    ADD CONSTRAINT fee_structure_id_course_uq UNIQUE (id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY fee_structure
    ADD CONSTRAINT fee_structure_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY file
    ADD CONSTRAINT file_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY file
    ADD CONSTRAINT file_storage_key_unique UNIQUE (storage_key);
--> statement-breakpoint
ALTER TABLE ONLY gateway_transaction
    ADD CONSTRAINT gateway_transaction_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY gateway_transaction
    ADD CONSTRAINT gateway_transaction_provider_ref_uq UNIQUE (provider, provider_ref);
--> statement-breakpoint
ALTER TABLE ONLY grade_level
    ADD CONSTRAINT grade_level_name_unique UNIQUE (name);
--> statement-breakpoint
ALTER TABLE ONLY grade_level
    ADD CONSTRAINT grade_level_ordinal_unique UNIQUE (ordinal);
--> statement-breakpoint
ALTER TABLE ONLY grade_level
    ADD CONSTRAINT grade_level_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY guardian
    ADD CONSTRAINT guardian_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY guardian
    ADD CONSTRAINT guardian_user_id_unique UNIQUE (user_id);
--> statement-breakpoint
ALTER TABLE ONLY installment_option
    ADD CONSTRAINT installment_option_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY installment_option
    ADD CONSTRAINT installment_option_structure_name_uq UNIQUE (fee_structure_id, name);
--> statement-breakpoint
ALTER TABLE ONLY intake
    ADD CONSTRAINT intake_id_course_uq UNIQUE (id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY intake
    ADD CONSTRAINT intake_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY invoice
    ADD CONSTRAINT invoice_id_branch_uq UNIQUE (id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY invoice
    ADD CONSTRAINT invoice_id_student_uq UNIQUE (id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_installment
    ADD CONSTRAINT invoice_installment_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_installment
    ADD CONSTRAINT invoice_installment_seq_uq UNIQUE (invoice_id, seq);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_id_invoice_uq UNIQUE (id, invoice_id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY lecturer_branch
    ADD CONSTRAINT lecturer_branch_lecturer_id_branch_id_pk PRIMARY KEY (lecturer_id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY lecturer
    ADD CONSTRAINT lecturer_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY lecturer
    ADD CONSTRAINT lecturer_user_id_unique UNIQUE (user_id);
--> statement-breakpoint
ALTER TABLE ONLY message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY message_thread
    ADD CONSTRAINT message_thread_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY notice
    ADD CONSTRAINT notice_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY notice_target
    ADD CONSTRAINT notice_target_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY notification_channel
    ADD CONSTRAINT notification_channel_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY notification_channel
    ADD CONSTRAINT notification_channel_uq UNIQUE (organization_id, channel);
--> statement-breakpoint
ALTER TABLE ONLY notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY notification_template
    ADD CONSTRAINT notification_template_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY notification_template
    ADD CONSTRAINT notification_template_uq UNIQUE (organization_id, event, channel);
--> statement-breakpoint
ALTER TABLE ONLY organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY payment_allocation
    ADD CONSTRAINT payment_allocation_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_id_student_uq UNIQUE (id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY payment_method
    ADD CONSTRAINT payment_method_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY permission
    ADD CONSTRAINT permission_code_unique UNIQUE (code);
--> statement-breakpoint
ALTER TABLE ONLY permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_item
    ADD CONSTRAINT promotion_item_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_run
    ADD CONSTRAINT promotion_run_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY push_subscription
    ADD CONSTRAINT push_subscription_endpoint_unique UNIQUE (endpoint);
--> statement-breakpoint
ALTER TABLE ONLY push_subscription
    ADD CONSTRAINT push_subscription_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY question_option
    ADD CONSTRAINT question_option_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY question_option
    ADD CONSTRAINT question_option_position_uq UNIQUE (question_id, "position");
--> statement-breakpoint
ALTER TABLE ONLY question
    ADD CONSTRAINT question_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_branch_no_uq UNIQUE (branch_id, receipt_no);
--> statement-breakpoint
ALTER TABLE ONLY receipt_counter
    ADD CONSTRAINT receipt_counter_pkey PRIMARY KEY (branch_id);
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_verification_code_unique UNIQUE (verification_code);
--> statement-breakpoint
ALTER TABLE ONLY role
    ADD CONSTRAINT role_name_unique UNIQUE (name);
--> statement-breakpoint
ALTER TABLE ONLY role_permission
    ADD CONSTRAINT role_permission_role_id_permission_id_pk PRIMARY KEY (role_id, permission_id);
--> statement-breakpoint
ALTER TABLE ONLY role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY schedule_slot
    ADD CONSTRAINT schedule_slot_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY staff_role_assignment
    ADD CONSTRAINT staff_role_assignment_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY student_branch
    ADD CONSTRAINT student_branch_student_id_branch_id_pk PRIMARY KEY (student_id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY student_guardian
    ADD CONSTRAINT student_guardian_student_id_guardian_id_pk PRIMARY KEY (student_id, guardian_id);
--> statement-breakpoint
-- Created before the overlap exclusion, so a second current grade row is refused by this index first (PostgreSQL checks unique indexes and exclusion constraints in creation order).
CREATE UNIQUE INDEX student_level_one_current_uq ON student_level USING btree (student_id) WHERE (to_date IS NULL);
--> statement-breakpoint
ALTER TABLE ONLY student_level
    ADD CONSTRAINT student_level_no_overlap EXCLUDE USING gist (student_id WITH =, daterange(from_date, to_date, '[)'::text) WITH &&);
--> statement-breakpoint
ALTER TABLE ONLY student_level
    ADD CONSTRAINT student_level_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY student
    ADD CONSTRAINT student_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY student
    ADD CONSTRAINT student_qr_token_unique UNIQUE (qr_token);
--> statement-breakpoint
ALTER TABLE ONLY student
    ADD CONSTRAINT student_student_no_unique UNIQUE (student_no);
--> statement-breakpoint
ALTER TABLE ONLY student
    ADD CONSTRAINT student_user_id_unique UNIQUE (user_id);
--> statement-breakpoint
ALTER TABLE ONLY subject
    ADD CONSTRAINT subject_code_unique UNIQUE (code);
--> statement-breakpoint
ALTER TABLE ONLY subject
    ADD CONSTRAINT subject_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY teacher_payout
    ADD CONSTRAINT teacher_payout_id_lecturer_uq UNIQUE (id, lecturer_id);
--> statement-breakpoint
ALTER TABLE ONLY teacher_payout
    ADD CONSTRAINT teacher_payout_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY thread_participant
    ADD CONSTRAINT thread_participant_pk PRIMARY KEY (thread_id, user_id);
--> statement-breakpoint
ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);
--> statement-breakpoint
ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY user_two_factor
    ADD CONSTRAINT user_two_factor_pkey PRIMARY KEY (user_id);
--> statement-breakpoint
ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_username_unique UNIQUE (username);
--> statement-breakpoint
CREATE UNIQUE INDEX academic_term_one_current_uq ON academic_term USING btree (is_current) WHERE is_current;
--> statement-breakpoint
CREATE INDEX attendance_student_idx ON attendance USING btree (student_id);
--> statement-breakpoint
CREATE INDEX audit_log_actor_idx ON audit_log USING btree (actor_user_id);
--> statement-breakpoint
CREATE INDEX audit_log_created_idx ON audit_log USING btree (created_at);
--> statement-breakpoint
CREATE INDEX audit_log_entity_idx ON audit_log USING btree (entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX auth_session_expires_idx ON auth_session USING btree (expires_at);
--> statement-breakpoint
CREATE INDEX auth_session_user_idx ON auth_session USING btree (user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX branch_one_default_uq ON branch USING btree (organization_id) WHERE is_default;
--> statement-breakpoint
CREATE UNIQUE INDEX branch_org_name_uq ON branch USING btree (organization_id, name);
--> statement-breakpoint
CREATE INDEX class_session_course_date_idx ON class_session USING btree (course_id, session_date);
--> statement-breakpoint
CREATE UNIQUE INDEX commission_entry_accrual_uq ON commission_entry USING btree (payment_allocation_id, lecturer_id) WHERE ((entry_type = 'accrual'::text) AND (status <> 'void'::text));
--> statement-breakpoint
CREATE INDEX commission_entry_allocation_idx ON commission_entry USING btree (payment_allocation_id);
--> statement-breakpoint
CREATE INDEX commission_entry_lecturer_idx ON commission_entry USING btree (lecturer_id, status);
--> statement-breakpoint
CREATE UNIQUE INDEX commission_entry_reversal_uq ON commission_entry USING btree (reverses_entry_id) WHERE (reverses_entry_id IS NOT NULL);
--> statement-breakpoint
CREATE INDEX commission_rule_lecturer_idx ON commission_rule USING btree (lecturer_id);
--> statement-breakpoint
CREATE INDEX content_item_lecturer_idx ON content_item USING btree (lecturer_id);
--> statement-breakpoint
CREATE UNIQUE INDEX content_purchase_active_uq ON content_purchase USING btree (content_id, student_id) WHERE (status = ANY (ARRAY['pending'::text, 'paid'::text]));
--> statement-breakpoint
CREATE INDEX content_purchase_student_idx ON content_purchase USING btree (student_id);
--> statement-breakpoint
CREATE INDEX course_branch_idx ON course USING btree (branch_id);
--> statement-breakpoint
CREATE INDEX course_group_idx ON course USING btree (course_group_id);
--> statement-breakpoint
CREATE UNIQUE INDEX course_lecturer_one_primary_uq ON course_lecturer USING btree (course_id) WHERE is_primary;
--> statement-breakpoint
CREATE INDEX course_section_course_idx ON course_section USING btree (course_id);
--> statement-breakpoint
CREATE INDEX enrollment_course_idx ON enrollment USING btree (course_id);
--> statement-breakpoint
CREATE UNIQUE INDEX enrollment_one_active_no_intake_uq ON enrollment USING btree (student_id, course_id) WHERE ((status = 'active'::text) AND (intake_id IS NULL));
--> statement-breakpoint
CREATE UNIQUE INDEX enrollment_one_active_per_intake_uq ON enrollment USING btree (student_id, course_id, intake_id) WHERE ((status = 'active'::text) AND (intake_id IS NOT NULL));
--> statement-breakpoint
CREATE INDEX enrollment_student_idx ON enrollment USING btree (student_id);
--> statement-breakpoint
CREATE UNIQUE INDEX exam_attempt_one_running_uq ON exam_attempt USING btree (exam_id, student_id) WHERE (status = 'in_progress'::text);
--> statement-breakpoint
CREATE INDEX exam_attempt_student_idx ON exam_attempt USING btree (student_id);
--> statement-breakpoint
CREATE INDEX exam_course_course_idx ON exam_course USING btree (course_id);
--> statement-breakpoint
CREATE INDEX exam_lecturer_idx ON exam USING btree (lecturer_id);
--> statement-breakpoint
CREATE INDEX exam_result_student_idx ON exam_result USING btree (student_id);
--> statement-breakpoint
CREATE INDEX fee_exception_enrollment_idx ON fee_exception USING btree (enrollment_id);
--> statement-breakpoint
CREATE INDEX fee_rate_structure_idx ON fee_rate USING btree (fee_structure_id);
--> statement-breakpoint
CREATE INDEX fee_structure_course_idx ON fee_structure USING btree (course_id);
--> statement-breakpoint
CREATE UNIQUE INDEX fee_structure_one_default_per_course_uq ON fee_structure USING btree (course_id) WHERE (is_default AND is_active);
--> statement-breakpoint
CREATE INDEX file_uploaded_by_idx ON file USING btree (uploaded_by);
--> statement-breakpoint
CREATE INDEX gateway_transaction_payment_idx ON gateway_transaction USING btree (payment_id);
--> statement-breakpoint
CREATE INDEX installment_option_structure_idx ON installment_option USING btree (fee_structure_id);
--> statement-breakpoint
CREATE INDEX invoice_installment_due_idx ON invoice_installment USING btree (status, due_date);
--> statement-breakpoint
CREATE INDEX invoice_item_applies_to_idx ON invoice_item USING btree (applies_to_item_id);
--> statement-breakpoint
CREATE UNIQUE INDEX invoice_item_content_purchase_uq ON invoice_item USING btree (content_purchase_id) WHERE ((kind = 'content'::text) AND (cancelled_at IS NULL));
--> statement-breakpoint
CREATE INDEX invoice_item_enrollment_idx ON invoice_item USING btree (enrollment_id);
--> statement-breakpoint
CREATE INDEX invoice_item_invoice_idx ON invoice_item USING btree (invoice_id);
--> statement-breakpoint
CREATE UNIQUE INDEX invoice_item_recurring_uq ON invoice_item USING btree (enrollment_id, period_start) WHERE ((kind = 'recurring_fee'::text) AND (cancelled_at IS NULL));
--> statement-breakpoint
CREATE INDEX invoice_status_due_idx ON invoice USING btree (status, due_date);
--> statement-breakpoint
CREATE INDEX invoice_student_idx ON invoice USING btree (student_id);
--> statement-breakpoint
CREATE INDEX message_thread_idx ON message USING btree (thread_id, sent_at);
--> statement-breakpoint
CREATE INDEX notice_published_idx ON notice USING btree (published_at);
--> statement-breakpoint
CREATE INDEX notice_target_notice_idx ON notice_target USING btree (notice_id);
--> statement-breakpoint
CREATE UNIQUE INDEX notification_dedupe_uq ON notification USING btree (user_id, event_key, channel);
--> statement-breakpoint
CREATE INDEX notification_queue_idx ON notification USING btree (status) WHERE (status = 'queued'::text);
--> statement-breakpoint
CREATE INDEX notification_sending_idx ON notification USING btree (claimed_until) WHERE (status = 'sending'::text);
--> statement-breakpoint
CREATE INDEX notification_user_idx ON notification USING btree (user_id, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX organization_singleton ON organization USING btree ((true));
--> statement-breakpoint
CREATE INDEX payment_allocation_invoice_idx ON payment_allocation USING btree (invoice_id);
--> statement-breakpoint
CREATE INDEX payment_allocation_item_idx ON payment_allocation USING btree (invoice_item_id);
--> statement-breakpoint
CREATE INDEX payment_allocation_payment_idx ON payment_allocation USING btree (payment_id);
--> statement-breakpoint
CREATE UNIQUE INDEX payment_bank_reference_uq ON payment USING btree (bank_account_id, reference_no) WHERE ((bank_account_id IS NOT NULL) AND (reference_no IS NOT NULL) AND (status <> 'rejected'::text));
--> statement-breakpoint
CREATE UNIQUE INDEX payment_method_one_default_uq ON payment_method USING btree (organization_id) WHERE is_default;
--> statement-breakpoint
CREATE INDEX payment_status_idx ON payment USING btree (status);
--> statement-breakpoint
CREATE INDEX payment_student_idx ON payment USING btree (student_id);
--> statement-breakpoint
CREATE UNIQUE INDEX promotion_item_run_enrollment_uq ON promotion_item USING btree (promotion_run_id, from_enrollment_id) WHERE (from_enrollment_id IS NOT NULL);
--> statement-breakpoint
CREATE INDEX promotion_item_run_idx ON promotion_item USING btree (promotion_run_id);
--> statement-breakpoint
CREATE UNIQUE INDEX promotion_item_run_student_no_enrollment_uq ON promotion_item USING btree (promotion_run_id, student_id) WHERE (from_enrollment_id IS NULL);
--> statement-breakpoint
CREATE INDEX push_subscription_user_idx ON push_subscription USING btree (user_id);
--> statement-breakpoint
CREATE INDEX question_lecturer_idx ON question USING btree (lecturer_id);
--> statement-breakpoint
CREATE UNIQUE INDEX receipt_one_issued_per_payment_uq ON receipt USING btree (payment_id) WHERE (status = 'issued'::text);
--> statement-breakpoint
CREATE INDEX schedule_slot_course_idx ON schedule_slot USING btree (course_id);
--> statement-breakpoint
CREATE UNIQUE INDEX staff_role_all_branches_uq ON staff_role_assignment USING btree (user_id, role_id) WHERE (branch_id IS NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX staff_role_one_branch_uq ON staff_role_assignment USING btree (user_id, role_id, branch_id) WHERE (branch_id IS NOT NULL);
--> statement-breakpoint
CREATE INDEX staff_role_user_idx ON staff_role_assignment USING btree (user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX student_branch_one_primary_uq ON student_branch USING btree (student_id) WHERE is_primary;
--> statement-breakpoint
CREATE UNIQUE INDEX student_guardian_one_primary_uq ON student_guardian USING btree (student_id) WHERE is_primary;
--> statement-breakpoint
CREATE INDEX student_level_student_idx ON student_level USING btree (student_id);
--> statement-breakpoint
CREATE INDEX teacher_payout_lecturer_idx ON teacher_payout USING btree (lecturer_id);
--> statement-breakpoint
CREATE INDEX thread_participant_user_idx ON thread_participant USING btree (user_id);
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER allocation_payment_integrity AFTER INSERT OR DELETE OR UPDATE ON payment_allocation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payment_allocation_guard();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete BEFORE DELETE OR UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint
CREATE TRIGGER commission_entry_guard BEFORE INSERT OR DELETE OR UPDATE ON commission_entry FOR EACH ROW EXECUTE FUNCTION commission_entry_guard();
--> statement-breakpoint
CREATE TRIGGER content_purchase_paid_only BEFORE INSERT OR UPDATE OF content_id ON content_purchase FOR EACH ROW EXECUTE FUNCTION content_purchase_paid_only();
--> statement-breakpoint
CREATE TRIGGER course_intake_rule BEFORE UPDATE OF kind, learning_mode ON course FOR EACH ROW EXECUTE FUNCTION course_check_enrollment_intake();
--> statement-breakpoint
CREATE TRIGGER enrollment_intake_rule BEFORE INSERT OR UPDATE OF course_id, intake_id ON enrollment FOR EACH ROW EXECUTE FUNCTION enrollment_check_intake();
--> statement-breakpoint
CREATE TRIGGER exam_insert_guard BEFORE INSERT ON exam FOR EACH ROW EXECUTE FUNCTION exam_insert_guard();
--> statement-breakpoint
CREATE TRIGGER exam_question_frozen BEFORE INSERT OR DELETE OR UPDATE ON exam_question FOR EACH ROW EXECUTE FUNCTION exam_question_frozen();
--> statement-breakpoint
CREATE TRIGGER exam_result_guard BEFORE INSERT OR UPDATE ON exam_result FOR EACH ROW EXECUTE FUNCTION exam_result_guard();
--> statement-breakpoint
CREATE TRIGGER exam_status_guard BEFORE UPDATE ON exam FOR EACH ROW EXECUTE FUNCTION exam_status_guard();
--> statement-breakpoint
CREATE TRIGGER gateway_transaction_guard BEFORE INSERT OR UPDATE ON gateway_transaction FOR EACH ROW EXECUTE FUNCTION gateway_transaction_guard();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER invoice_item_discount_enrollment AFTER INSERT OR UPDATE OF enrollment_id, applies_to_item_id, kind ON invoice_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION invoice_item_check_discount_enrollment();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER payment_allocation_integrity AFTER INSERT OR UPDATE ON payment DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payment_allocation_guard();
--> statement-breakpoint
CREATE TRIGGER payment_gateway_method_guard BEFORE UPDATE OF payment_method_id ON payment FOR EACH ROW EXECUTE FUNCTION payment_gateway_method_guard();
--> statement-breakpoint
CREATE TRIGGER payment_method_gateway_type_guard BEFORE UPDATE OF type ON payment_method FOR EACH ROW EXECUTE FUNCTION payment_method_gateway_type_guard();
--> statement-breakpoint
CREATE TRIGGER teacher_payout_guard BEFORE INSERT OR DELETE OR UPDATE ON teacher_payout FOR EACH ROW EXECUTE FUNCTION teacher_payout_guard();
--> statement-breakpoint
ALTER TABLE ONLY attempt_answer
    ADD CONSTRAINT attempt_answer_attempt_exam_fk FOREIGN KEY (attempt_id, exam_id) REFERENCES exam_attempt(id, exam_id);
--> statement-breakpoint
ALTER TABLE ONLY attempt_answer
    ADD CONSTRAINT attempt_answer_question_exam_fk FOREIGN KEY (exam_question_id, exam_id) REFERENCES exam_question(id, exam_id);
--> statement-breakpoint
ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_marked_by_user_id_fk FOREIGN KEY (marked_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_session_id_class_session_id_fk FOREIGN KEY (session_id) REFERENCES class_session(id);
--> statement-breakpoint
ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY audit_log
    ADD CONSTRAINT audit_log_actor_user_id_user_id_fk FOREIGN KEY (actor_user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY auth_session
    ADD CONSTRAINT auth_session_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY bank_account
    ADD CONSTRAINT bank_account_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY branch
    ADD CONSTRAINT branch_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES organization(id);
--> statement-breakpoint
ALTER TABLE ONLY class_session
    ADD CONSTRAINT class_session_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY class_session
    ADD CONSTRAINT class_session_intake_course_fk FOREIGN KEY (intake_id, course_id) REFERENCES intake(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY commission_entry
    ADD CONSTRAINT commission_entry_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY commission_entry
    ADD CONSTRAINT commission_entry_payment_allocation_id_payment_allocation_id_fk FOREIGN KEY (payment_allocation_id) REFERENCES payment_allocation(id);
--> statement-breakpoint
ALTER TABLE ONLY commission_entry
    ADD CONSTRAINT commission_entry_payout_lecturer_fk FOREIGN KEY (payout_id, lecturer_id) REFERENCES teacher_payout(id, lecturer_id);
--> statement-breakpoint
ALTER TABLE ONLY commission_entry
    ADD CONSTRAINT commission_entry_reverses_entry_id_commission_entry_id_fk FOREIGN KEY (reverses_entry_id) REFERENCES commission_entry(id);
--> statement-breakpoint
ALTER TABLE ONLY commission_entry
    ADD CONSTRAINT commission_entry_rule_lecturer_fk FOREIGN KEY (rule_id, lecturer_id) REFERENCES commission_rule(id, lecturer_id);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_grade_level_id_grade_level_id_fk FOREIGN KEY (grade_level_id) REFERENCES grade_level(id);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY commission_rule
    ADD CONSTRAINT commission_rule_subject_id_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subject(id);
--> statement-breakpoint
ALTER TABLE ONLY content_branch
    ADD CONSTRAINT content_branch_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY content_branch
    ADD CONSTRAINT content_branch_content_id_content_item_id_fk FOREIGN KEY (content_id) REFERENCES content_item(id);
--> statement-breakpoint
ALTER TABLE ONLY content_item
    ADD CONSTRAINT content_item_file_id_file_id_fk FOREIGN KEY (file_id) REFERENCES file(id);
--> statement-breakpoint
ALTER TABLE ONLY content_item
    ADD CONSTRAINT content_item_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_content_id_content_item_id_fk FOREIGN KEY (content_id) REFERENCES content_item(id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_handed_over_by_user_id_fk FOREIGN KEY (handed_over_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_invoice_branch_fk FOREIGN KEY (invoice_id, branch_id) REFERENCES invoice(id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_invoice_student_fk FOREIGN KEY (invoice_id, student_id) REFERENCES invoice(id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_listed_branch_fk FOREIGN KEY (content_id, branch_id) REFERENCES content_branch(content_id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY content_purchase
    ADD CONSTRAINT content_purchase_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY course_content
    ADD CONSTRAINT course_content_content_id_content_item_id_fk FOREIGN KEY (content_id) REFERENCES content_item(id);
--> statement-breakpoint
ALTER TABLE ONLY course_content
    ADD CONSTRAINT course_content_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY course_content
    ADD CONSTRAINT course_content_section_course_fk FOREIGN KEY (section_id, course_id) REFERENCES course_section(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY course_grade_level
    ADD CONSTRAINT course_grade_level_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY course_grade_level
    ADD CONSTRAINT course_grade_level_grade_level_id_grade_level_id_fk FOREIGN KEY (grade_level_id) REFERENCES grade_level(id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_group_branch_fk FOREIGN KEY (course_group_id, branch_id) REFERENCES course_group(id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY course_group
    ADD CONSTRAINT course_group_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_group_subject_fk FOREIGN KEY (course_group_id, subject_id) REFERENCES course_group(id, subject_id);
--> statement-breakpoint
ALTER TABLE ONLY course_group
    ADD CONSTRAINT course_group_subject_id_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subject(id);
--> statement-breakpoint
ALTER TABLE ONLY course_lecturer
    ADD CONSTRAINT course_lecturer_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY course_lecturer
    ADD CONSTRAINT course_lecturer_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY course_section
    ADD CONSTRAINT course_section_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_subject_id_subject_id_fk FOREIGN KEY (subject_id) REFERENCES subject(id);
--> statement-breakpoint
ALTER TABLE ONLY course
    ADD CONSTRAINT course_term_id_academic_term_id_fk FOREIGN KEY (term_id) REFERENCES academic_term(id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_billing_grade_level_id_grade_level_id_fk FOREIGN KEY (billing_grade_level_id) REFERENCES grade_level(id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_fee_structure_course_fk FOREIGN KEY (fee_structure_id, course_id) REFERENCES fee_structure(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_intake_course_fk FOREIGN KEY (intake_id, course_id) REFERENCES intake(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_promoted_from_enrollment_id_enrollment_id_fk FOREIGN KEY (promoted_from_enrollment_id) REFERENCES enrollment(id);
--> statement-breakpoint
ALTER TABLE ONLY enrollment
    ADD CONSTRAINT enrollment_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_enrollment_fk FOREIGN KEY (enrollment_id, student_id, course_id) REFERENCES enrollment(id, student_id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_exam_course_fk FOREIGN KEY (exam_id, course_id) REFERENCES exam_course(exam_id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_attempt
    ADD CONSTRAINT exam_attempt_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_course
    ADD CONSTRAINT exam_course_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_course
    ADD CONSTRAINT exam_course_exam_id_exam_id_fk FOREIGN KEY (exam_id) REFERENCES exam(id);
--> statement-breakpoint
ALTER TABLE ONLY exam
    ADD CONSTRAINT exam_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_question
    ADD CONSTRAINT exam_question_exam_id_exam_id_fk FOREIGN KEY (exam_id) REFERENCES exam(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_question
    ADD CONSTRAINT exam_question_question_id_question_id_fk FOREIGN KEY (question_id) REFERENCES question(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_attempt_fk FOREIGN KEY (attempt_id, exam_id, student_id) REFERENCES exam_attempt(id, exam_id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_enrollment_fk FOREIGN KEY (enrollment_id, student_id, course_id) REFERENCES enrollment(id, student_id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_exam_course_fk FOREIGN KEY (exam_id, course_id) REFERENCES exam_course(exam_id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_exam_id_exam_id_fk FOREIGN KEY (exam_id) REFERENCES exam(id);
--> statement-breakpoint
ALTER TABLE ONLY exam_result
    ADD CONSTRAINT exam_result_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_alternate_course_fk FOREIGN KEY (alternate_fee_structure_id, course_id) REFERENCES fee_structure(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_created_by_user_id_fk FOREIGN KEY (created_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_ended_by_user_id_fk FOREIGN KEY (ended_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY fee_exception
    ADD CONSTRAINT fee_exception_enrollment_course_fk FOREIGN KEY (enrollment_id, course_id) REFERENCES enrollment(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY fee_rate
    ADD CONSTRAINT fee_rate_fee_structure_id_fee_structure_id_fk FOREIGN KEY (fee_structure_id) REFERENCES fee_structure(id);
--> statement-breakpoint
ALTER TABLE ONLY fee_rate
    ADD CONSTRAINT fee_rate_grade_level_id_grade_level_id_fk FOREIGN KEY (grade_level_id) REFERENCES grade_level(id);
--> statement-breakpoint
ALTER TABLE ONLY fee_structure
    ADD CONSTRAINT fee_structure_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY fee_structure
    ADD CONSTRAINT fee_structure_course_branch_fk FOREIGN KEY (course_id, branch_id) REFERENCES course(id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY fee_structure
    ADD CONSTRAINT fee_structure_intake_course_fk FOREIGN KEY (intake_id, course_id) REFERENCES intake(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY file
    ADD CONSTRAINT file_uploaded_by_user_id_fk FOREIGN KEY (uploaded_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY gateway_transaction
    ADD CONSTRAINT gateway_transaction_payment_id_payment_id_fk FOREIGN KEY (payment_id) REFERENCES payment(id);
--> statement-breakpoint
ALTER TABLE ONLY guardian
    ADD CONSTRAINT guardian_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY installment_option
    ADD CONSTRAINT installment_option_fee_structure_id_fee_structure_id_fk FOREIGN KEY (fee_structure_id) REFERENCES fee_structure(id);
--> statement-breakpoint
ALTER TABLE ONLY intake
    ADD CONSTRAINT intake_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice
    ADD CONSTRAINT invoice_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_installment
    ADD CONSTRAINT invoice_installment_invoice_id_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoice(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice
    ADD CONSTRAINT invoice_installment_option_id_installment_option_id_fk FOREIGN KEY (installment_option_id) REFERENCES installment_option(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_applies_to_fk FOREIGN KEY (applies_to_item_id, invoice_id) REFERENCES invoice_item(id, invoice_id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_enrollment_id_enrollment_id_fk FOREIGN KEY (enrollment_id) REFERENCES enrollment(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_exception_enrollment_fk FOREIGN KEY (fee_exception_id, enrollment_id) REFERENCES fee_exception(id, enrollment_id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_fee_exception_id_fee_exception_id_fk FOREIGN KEY (fee_exception_id) REFERENCES fee_exception(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_fee_structure_id_fee_structure_id_fk FOREIGN KEY (fee_structure_id) REFERENCES fee_structure(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_grade_level_id_grade_level_id_fk FOREIGN KEY (grade_level_id) REFERENCES grade_level(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_invoice_id_invoice_id_fk FOREIGN KEY (invoice_id) REFERENCES invoice(id);
--> statement-breakpoint
ALTER TABLE ONLY invoice_item
    ADD CONSTRAINT invoice_item_purchase_invoice_fk FOREIGN KEY (content_purchase_id, invoice_id) REFERENCES content_purchase(id, invoice_id);
--> statement-breakpoint
ALTER TABLE ONLY invoice
    ADD CONSTRAINT invoice_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY lecturer_branch
    ADD CONSTRAINT lecturer_branch_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY lecturer_branch
    ADD CONSTRAINT lecturer_branch_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY lecturer
    ADD CONSTRAINT lecturer_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY message
    ADD CONSTRAINT message_sender_participant_fk FOREIGN KEY (thread_id, sender_id) REFERENCES thread_participant(thread_id, user_id);
--> statement-breakpoint
ALTER TABLE ONLY message_thread
    ADD CONSTRAINT message_thread_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY message_thread
    ADD CONSTRAINT message_thread_created_by_user_id_fk FOREIGN KEY (created_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY message
    ADD CONSTRAINT message_thread_id_message_thread_id_fk FOREIGN KEY (thread_id) REFERENCES message_thread(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY notice
    ADD CONSTRAINT notice_author_id_user_id_fk FOREIGN KEY (author_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY notice
    ADD CONSTRAINT notice_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY notice_target
    ADD CONSTRAINT notice_target_notice_id_notice_id_fk FOREIGN KEY (notice_id) REFERENCES notice(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY notification_channel
    ADD CONSTRAINT notification_channel_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES organization(id);
--> statement-breakpoint
ALTER TABLE ONLY notification
    ADD CONSTRAINT notification_template_id_notification_template_id_fk FOREIGN KEY (template_id) REFERENCES notification_template(id);
--> statement-breakpoint
ALTER TABLE ONLY notification_template
    ADD CONSTRAINT notification_template_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES organization(id);
--> statement-breakpoint
ALTER TABLE ONLY notification
    ADD CONSTRAINT notification_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY payment_allocation
    ADD CONSTRAINT payment_allocation_invoice_student_fk FOREIGN KEY (invoice_id, student_id) REFERENCES invoice(id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY payment_allocation
    ADD CONSTRAINT payment_allocation_item_invoice_fk FOREIGN KEY (invoice_item_id, invoice_id) REFERENCES invoice_item(id, invoice_id);
--> statement-breakpoint
ALTER TABLE ONLY payment_allocation
    ADD CONSTRAINT payment_allocation_payment_student_fk FOREIGN KEY (payment_id, student_id) REFERENCES payment(id, student_id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_bank_account_branch_fk FOREIGN KEY (bank_account_id, branch_id) REFERENCES bank_account(id, branch_id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY payment_method
    ADD CONSTRAINT payment_method_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES organization(id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_payment_method_id_payment_method_id_fk FOREIGN KEY (payment_method_id) REFERENCES payment_method(id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_slip_file_id_file_id_fk FOREIGN KEY (slip_file_id) REFERENCES file(id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_submitted_by_user_id_fk FOREIGN KEY (submitted_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_verified_by_user_id_fk FOREIGN KEY (verified_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY payment
    ADD CONSTRAINT payment_voided_by_user_id_fk FOREIGN KEY (voided_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_item
    ADD CONSTRAINT promotion_item_from_enrollment_id_enrollment_id_fk FOREIGN KEY (from_enrollment_id) REFERENCES enrollment(id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_item
    ADD CONSTRAINT promotion_item_promotion_run_id_promotion_run_id_fk FOREIGN KEY (promotion_run_id) REFERENCES promotion_run(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY promotion_item
    ADD CONSTRAINT promotion_item_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_item
    ADD CONSTRAINT promotion_item_to_course_id_course_id_fk FOREIGN KEY (to_course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_item
    ADD CONSTRAINT promotion_item_to_enrollment_id_enrollment_id_fk FOREIGN KEY (to_enrollment_id) REFERENCES enrollment(id);
--> statement-breakpoint
ALTER TABLE ONLY promotion_run
    ADD CONSTRAINT promotion_run_performed_by_user_id_fk FOREIGN KEY (performed_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY push_subscription
    ADD CONSTRAINT push_subscription_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY question
    ADD CONSTRAINT question_image_file_id_file_id_fk FOREIGN KEY (image_file_id) REFERENCES file(id);
--> statement-breakpoint
ALTER TABLE ONLY question
    ADD CONSTRAINT question_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY question_option
    ADD CONSTRAINT question_option_question_id_question_id_fk FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY receipt_counter
    ADD CONSTRAINT receipt_counter_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_file_id_file_id_fk FOREIGN KEY (file_id) REFERENCES file(id);
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_payment_id_payment_id_fk FOREIGN KEY (payment_id) REFERENCES payment(id);
--> statement-breakpoint
ALTER TABLE ONLY receipt
    ADD CONSTRAINT receipt_replaced_by_receipt_id_receipt_id_fk FOREIGN KEY (replaced_by_receipt_id) REFERENCES receipt(id);
--> statement-breakpoint
ALTER TABLE ONLY role_permission
    ADD CONSTRAINT role_permission_permission_id_permission_id_fk FOREIGN KEY (permission_id) REFERENCES permission(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY role_permission
    ADD CONSTRAINT role_permission_role_id_role_id_fk FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY schedule_slot
    ADD CONSTRAINT schedule_slot_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id);
--> statement-breakpoint
ALTER TABLE ONLY schedule_slot
    ADD CONSTRAINT schedule_slot_intake_course_fk FOREIGN KEY (intake_id, course_id) REFERENCES intake(id, course_id);
--> statement-breakpoint
ALTER TABLE ONLY staff_role_assignment
    ADD CONSTRAINT staff_role_assignment_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY staff_role_assignment
    ADD CONSTRAINT staff_role_assignment_role_id_role_id_fk FOREIGN KEY (role_id) REFERENCES role(id);
--> statement-breakpoint
ALTER TABLE ONLY staff_role_assignment
    ADD CONSTRAINT staff_role_assignment_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY student_branch
    ADD CONSTRAINT student_branch_branch_id_branch_id_fk FOREIGN KEY (branch_id) REFERENCES branch(id);
--> statement-breakpoint
ALTER TABLE ONLY student_branch
    ADD CONSTRAINT student_branch_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY student_guardian
    ADD CONSTRAINT student_guardian_guardian_id_guardian_id_fk FOREIGN KEY (guardian_id) REFERENCES guardian(id);
--> statement-breakpoint
ALTER TABLE ONLY student_guardian
    ADD CONSTRAINT student_guardian_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY student_level
    ADD CONSTRAINT student_level_grade_level_id_grade_level_id_fk FOREIGN KEY (grade_level_id) REFERENCES grade_level(id);
--> statement-breakpoint
ALTER TABLE ONLY student_level
    ADD CONSTRAINT student_level_promotion_run_id_promotion_run_id_fk FOREIGN KEY (promotion_run_id) REFERENCES promotion_run(id);
--> statement-breakpoint
ALTER TABLE ONLY student_level
    ADD CONSTRAINT student_level_student_id_student_id_fk FOREIGN KEY (student_id) REFERENCES student(id);
--> statement-breakpoint
ALTER TABLE ONLY student
    ADD CONSTRAINT student_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY teacher_payout
    ADD CONSTRAINT teacher_payout_approved_by_user_id_fk FOREIGN KEY (approved_by) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY teacher_payout
    ADD CONSTRAINT teacher_payout_lecturer_id_lecturer_id_fk FOREIGN KEY (lecturer_id) REFERENCES lecturer(id);
--> statement-breakpoint
ALTER TABLE ONLY teacher_payout
    ADD CONSTRAINT teacher_payout_proof_file_id_file_id_fk FOREIGN KEY (proof_file_id) REFERENCES file(id);
--> statement-breakpoint
ALTER TABLE ONLY thread_participant
    ADD CONSTRAINT thread_participant_thread_id_message_thread_id_fk FOREIGN KEY (thread_id) REFERENCES message_thread(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY thread_participant
    ADD CONSTRAINT thread_participant_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
ALTER TABLE ONLY user_two_factor
    ADD CONSTRAINT user_two_factor_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.organization') IS NULL OR to_regclass('public.student') IS NULL THEN
    RAISE EXCEPTION '0000_init: the tables were not created in schema public (check the migration role''s CREATE privilege on public and its search_path)';
  END IF;
END $$;
--> statement-breakpoint
RESET search_path;
--> statement-breakpoint
RESET check_function_bodies;
