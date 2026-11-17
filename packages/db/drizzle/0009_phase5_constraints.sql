-- Phase 5 rules that Drizzle cannot express. Statements are separated by statement-breakpoint markers.

-- A gateway transaction belongs to a payment made with a gateway payment method.
CREATE OR REPLACE FUNCTION gateway_transaction_guard() RETURNS trigger AS $$
DECLARE
  v_type text;
BEGIN
  SELECT pm.type INTO v_type
    FROM payment p JOIN payment_method pm ON pm.id = p.payment_method_id
   WHERE p.id = NEW.payment_id;
  IF v_type IS DISTINCT FROM 'gateway' THEN
    RAISE EXCEPTION 'gateway_transaction_guard: the payment must use a gateway payment method';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER gateway_transaction_guard
  BEFORE INSERT OR UPDATE ON gateway_transaction
  FOR EACH ROW EXECUTE FUNCTION gateway_transaction_guard();
