-- The gateway_transaction guard (0009) only runs on writes to gateway_transaction. Two changes on its parents could leave existing transactions pointing at a
-- payment that guard would reject, and every later update of those rows would then fail. Block both while a gateway transaction exists.

-- Locking protocol shared by the three guards (0009's child guard is replaced below). A guard that only reads cannot be ordered against another transaction's
-- uncommitted change: a gateway insert that has read "gateway" and a concurrent move of the payment to cash, or change of the method to cash, each saw nothing
-- wrong and both committed. So the child guard locks the rows it relies on before it reads, in the order payment, then payment method:
--   gateway_transaction insert / move: payment FOR SHARE, then its method FOR SHARE
--   payment moved to another method:   the new method FOR SHARE (the payment row itself is already locked by the update)
--   payment method type change:        nothing extra (the method row itself is already locked by the update)
-- PostgreSQL locks the row being updated, waiting for any share lock on it, before it fires a BEFORE ROW trigger, and each statement after a wait sees what the
-- other transaction committed (READ COMMITTED). So whichever side comes second waits for the first to commit and then sees it: a gateway insert in flight makes the
-- move or type change fail, and a move or type change in flight makes the insert fail. test/concurrency.pg.test.ts runs all four orders on a real server.

-- A gateway transaction belongs to a payment made with a gateway payment method. Checked when the row is inserted or moved to another payment; a status
-- change does not need it (the parent guards below keep it true) and would only add lock waits to every provider callback.
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

-- A payment with a gateway transaction cannot move to a method that is not a gateway method.
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
CREATE TRIGGER payment_gateway_method_guard
  BEFORE UPDATE OF payment_method_id ON payment
  FOR EACH ROW EXECUTE FUNCTION payment_gateway_method_guard();
--> statement-breakpoint

-- A payment method used by a gateway transaction cannot stop being a gateway method.
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
--> statement-breakpoint
CREATE TRIGGER payment_method_gateway_type_guard
  BEFORE UPDATE OF type ON payment_method
  FOR EACH ROW EXECUTE FUNCTION payment_method_gateway_type_guard();
