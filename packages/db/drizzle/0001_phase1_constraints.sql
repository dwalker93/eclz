-- Hand-written constraints that Drizzle cannot express (design v1.0, phase 1).
-- Each statement is separated by a statement-breakpoint so the migrator runs them one at a time.
-- Requires the btree_gist extension (a trusted extension: the database owner can create it).

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- A2: exactly one organization row per deployment.
CREATE UNIQUE INDEX "organization_singleton" ON "organization" ((true));
--> statement-breakpoint

-- B4: a student's grade ranges never overlap. Ranges are [from_date, to_date), the end is exclusive.
ALTER TABLE "student_level" ADD CONSTRAINT "student_level_no_overlap"
  EXCLUDE USING gist (
    "student_id" WITH =,
    daterange("from_date", "to_date", '[)') WITH &&
  );
--> statement-breakpoint

-- D5: rates for one fee structure and grade never overlap in effective dates.
-- A null grade (rate for all grades) counts as its own key.
ALTER TABLE "fee_rate" ADD CONSTRAINT "fee_rate_no_overlap"
  EXCLUDE USING gist (
    "fee_structure_id" WITH =,
    (COALESCE("grade_level_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    daterange("effective_from", "effective_to", '[)') WITH &&
  );
--> statement-breakpoint

-- C2: intake rule on enrolment, which depends on the course kind and learning mode.
--   class                      -> no intake
--   scheduled program          -> intake required
--   self-paced program         -> no intake
CREATE FUNCTION "enrollment_check_intake"() RETURNS trigger AS $$
DECLARE
  c_kind text;
  c_mode text;
BEGIN
  SELECT "kind", "learning_mode" INTO c_kind, c_mode FROM "course" WHERE "id" = NEW."course_id";
  IF c_kind = 'class' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a class enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'scheduled' AND NEW."intake_id" IS NULL THEN
    RAISE EXCEPTION 'C2: a scheduled program enrolment requires an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'self_paced' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a self-paced program enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER "enrollment_intake_rule"
  BEFORE INSERT OR UPDATE OF "course_id", "intake_id" ON "enrollment"
  FOR EACH ROW EXECUTE FUNCTION "enrollment_check_intake"();
--> statement-breakpoint

-- E3, E4: verification and allocation are one atomic step.
-- At commit, a verified payment's active allocations must sum exactly to its amount,
-- and a payment that is not verified must have no active allocations.
-- Voiding sets reversed_at on the allocations (they are never deleted), so voided payments pass.
CREATE FUNCTION "payment_check_allocations"(p_id uuid) RETURNS void AS $$
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION "payment_allocation_guard"() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "payment_allocation_integrity"
  AFTER INSERT OR UPDATE ON "payment"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "payment_allocation_guard"();
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "allocation_payment_integrity"
  AFTER INSERT OR UPDATE OR DELETE ON "payment_allocation"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "payment_allocation_guard"();
--> statement-breakpoint

-- J4: the audit log is append-only. Also revoke UPDATE, DELETE and TRUNCATE on it
-- from the application's database role.
CREATE FUNCTION "audit_log_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'J4: audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER "audit_log_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_immutable"();
--> statement-breakpoint

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_immutable"();
