-- The gateway_transaction guard (0009) only runs on writes to gateway_transaction. Two changes on its parents could leave existing transactions pointing at a
-- payment that guard would reject, and every later update of those rows would then fail. Block both while a gateway transaction exists.

-- A payment with a gateway transaction cannot move to a method that is not a gateway method.
CREATE OR REPLACE FUNCTION payment_gateway_method_guard() RETURNS trigger AS $$
DECLARE
  v_type text;
BEGIN
  IF NEW.payment_method_id IS DISTINCT FROM OLD.payment_method_id
     AND EXISTS (SELECT 1 FROM gateway_transaction WHERE payment_id = NEW.id) THEN
    SELECT type INTO v_type FROM payment_method WHERE id = NEW.payment_method_id;
    IF v_type IS DISTINCT FROM 'gateway' THEN
      RAISE EXCEPTION 'payment_gateway_method_guard: a payment with a gateway transaction must keep a gateway payment method';
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
  IF NEW.type IS DISTINCT FROM OLD.type AND NEW.type <> 'gateway' AND EXISTS (
    SELECT 1 FROM gateway_transaction gt JOIN payment p ON p.id = gt.payment_id WHERE p.payment_method_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'payment_method_gateway_type_guard: a payment method with gateway transactions must stay a gateway method';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER payment_method_gateway_type_guard
  BEFORE UPDATE OF type ON payment_method
  FOR EACH ROW EXECUTE FUNCTION payment_method_gateway_type_guard();
