-- Forward migration for guard changes found in review after 0016 and 0019 had been applied: a database that already ran them skips an edited file, so the new
-- bodies are installed here. Functions only (CREATE OR REPLACE); the triggers that call them already exist under the same names and are not recreated.

-- G7: the result guard checked the exam's mode from an unlocked read, so a manual result for a draft paper exam that had not committed and a concurrent change of
-- the exam to online_mcq each saw nothing wrong (the status guard finds no committed result), and both committed. Lock the exam row FOR SHARE before reading its mode:
-- a mode change (which locks the row for its update) waits for the result write and then sees the result, and a result write that starts after a mode change waits
-- for it and then sees the new mode.
CREATE OR REPLACE FUNCTION exam_result_guard() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

--> statement-breakpoint

-- Locking protocol shared by the three gateway guards. A guard that only reads cannot be ordered against another transaction's uncommitted change: a gateway insert
-- that has read "gateway" and a concurrent move of the payment to cash, or change of the method to cash, each saw nothing wrong and both committed. So the child guard
-- locks the rows it relies on before it reads, in the order payment, then payment method:
--   gateway_transaction insert / move: payment FOR SHARE, then its method FOR SHARE
--   payment moved to another method:   the new method FOR SHARE (the payment row itself is already locked by the update)
--   payment method type change:        nothing extra (the method row itself is already locked by the update)
-- PostgreSQL locks the row being updated, waiting for any share lock on it, before it fires a BEFORE ROW trigger, and each statement after a wait sees what the other
-- transaction committed (READ COMMITTED). So whichever side comes second waits for the first to commit and then sees it. test/concurrency.pg.test.ts runs every order
-- on a real server.

-- 0009's guard, now checked only on insert or when the row moves to another payment (a status change would add lock waits to every provider callback).
CREATE OR REPLACE FUNCTION gateway_transaction_guard() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION payment_gateway_method_guard() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION payment_method_gateway_type_guard() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;
