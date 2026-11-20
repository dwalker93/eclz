-- Four gaps in the phase 3 exam triggers (0005), found in review. Same trigger names, so CREATE OR REPLACE keeps the existing triggers.

-- G4: moving a question between exams changes two exams. Check both the old and the new one, and lock each exam row FOR SHARE so a concurrent
-- publish (which takes FOR NO KEY UPDATE, below) waits for this edit, and an edit that starts after a publish waits and then sees "published".
-- Rows are locked in id order so two moves in opposite directions cannot deadlock.
CREATE OR REPLACE FUNCTION exam_question_frozen() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- G4: the publish guard locks its exam row before it probes the questions, so it sees every question edit that committed first. Under READ COMMITTED
-- each probe below takes a fresh snapshot, so the lock is what makes the order well defined.
-- G7: the mode cannot change while the exam has results, because results are only checked against the mode when they are written.
CREATE OR REPLACE FUNCTION exam_status_guard() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- G4: an exam starts as a draft. Inserting it as published would skip the publish checks, and the freeze trigger would then stop the missing questions
-- from ever being added.
CREATE FUNCTION exam_insert_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'exam_insert_guard: a new exam must start as a draft';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER exam_insert_guard
  BEFORE INSERT ON exam
  FOR EACH ROW EXECUTE FUNCTION exam_insert_guard();
