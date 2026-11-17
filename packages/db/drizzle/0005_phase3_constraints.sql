-- Phase 3 rules that Drizzle cannot express. Statements are separated by statement-breakpoint markers.

-- G4: a published exam's questions are immutable. Snapshots are written while the exam is still a draft.
CREATE OR REPLACE FUNCTION exam_question_frozen() RETURNS trigger AS $$
DECLARE
  v_exam uuid := COALESCE(NEW.exam_id, OLD.exam_id);
  v_status text;
BEGIN
  SELECT status INTO v_status FROM exam WHERE id = v_exam;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'exam_question_frozen: questions of a published exam cannot change';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER exam_question_frozen
  BEFORE INSERT OR UPDATE OR DELETE ON exam_question
  FOR EACH ROW EXECUTE FUNCTION exam_question_frozen();
--> statement-breakpoint

-- Exam status moves draft -> published -> closed only. Publishing an online exam needs at least one question,
-- each with its snapshot (G4). The mode cannot change after the draft stage.
CREATE OR REPLACE FUNCTION exam_status_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status = 'draft' AND NEW.status = 'published') OR (OLD.status = 'published' AND NEW.status = 'closed')) THEN
      RAISE EXCEPTION 'exam_status_guard: cannot move an exam from % to %', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'published' AND NEW.mode = 'online_mcq' THEN
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER exam_status_guard
  BEFORE UPDATE ON exam
  FOR EACH ROW EXECUTE FUNCTION exam_status_guard();
--> statement-breakpoint

-- G7: an online exam gets results from attempts (or a later manual override), a paper exam only by manual entry.
-- G8: a result is released only after the exam is closed (status closed, or the closing time has passed).
CREATE OR REPLACE FUNCTION exam_result_guard() RETURNS trigger AS $$
DECLARE
  v_mode text;
  v_status text;
  v_closes timestamptz;
BEGIN
  SELECT mode, status, closes_at INTO v_mode, v_status, v_closes FROM exam WHERE id = NEW.exam_id;
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER exam_result_guard
  BEFORE INSERT OR UPDATE ON exam_result
  FOR EACH ROW EXECUTE FUNCTION exam_result_guard();
