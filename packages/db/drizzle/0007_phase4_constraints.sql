-- Phase 4 rules that Drizzle cannot express. Statements are separated by statement-breakpoint markers.

-- H4: rules of one lecturer with the same scope never overlap in dates ([from, to), null end = current).
-- Null scope columns count as their own key.
ALTER TABLE "commission_rule" ADD CONSTRAINT "commission_rule_no_overlap"
  EXCLUDE USING gist (
    "lecturer_id" WITH =,
    (COALESCE("subject_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (COALESCE("grade_level_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (COALESCE("course_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    daterange("effective_from", "effective_to", '[)') WITH &&
  );
--> statement-breakpoint

-- Only a paid content item can be purchased (F2 gives it a price; this keeps free and course-only items out).
CREATE OR REPLACE FUNCTION content_purchase_paid_only() RETURNS trigger AS $$
DECLARE
  v_access text;
BEGIN
  SELECT access_type INTO v_access FROM content_item WHERE id = NEW.content_id;
  IF v_access IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'content_purchase_paid_only: only a paid content item can be purchased';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER content_purchase_paid_only
  BEFORE INSERT ON content_purchase
  FOR EACH ROW EXECUTE FUNCTION content_purchase_paid_only();
--> statement-breakpoint

-- H8: a paid payout is immutable, and it cannot be deleted. Status moves draft -> approved -> paid only.
CREATE OR REPLACE FUNCTION teacher_payout_guard() RETURNS trigger AS $$
BEGIN
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER teacher_payout_guard
  BEFORE UPDATE OR DELETE ON teacher_payout
  FOR EACH ROW EXECUTE FUNCTION teacher_payout_guard();
--> statement-breakpoint

-- H2, H7, H8, H11, H12 on commission entries:
--  * entries are never deleted, and only status and payout_id change after insert (history is kept)
--  * an entry cannot join, leave or change inside a paid payout
--  * an accrual comes from a fee item (recurring_fee or package_fee) of a course the lecturer teaches (H11)
--  * a reversal is the exact negative of an accrual of the same allocation and lecturer (H12)
CREATE OR REPLACE FUNCTION commission_entry_guard() RETURNS trigger AS $$
DECLARE
  v_orig commission_entry%ROWTYPE;
  v_kind text;
  v_payout_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_entry_guard: commission entries are never deleted';
  END IF;

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
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER commission_entry_guard
  BEFORE INSERT OR UPDATE OR DELETE ON commission_entry
  FOR EACH ROW EXECUTE FUNCTION commission_entry_guard();
