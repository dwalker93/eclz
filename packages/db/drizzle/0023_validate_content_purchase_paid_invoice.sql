-- Validates content_purchase_paid_invoice_check (0022) in its own transaction. A paid purchase with no invoice has no billing record and cannot be repaired
-- automatically (an invoice cannot be invented), so stop with a clear message instead of a bare constraint error.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM "content_purchase" WHERE "status" = 'paid' AND "invoice_id" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '% paid content purchase(s) have no invoice; give each an invoice or set its status before migrating (see content_purchase_paid_invoice_check)', n;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "content_purchase" VALIDATE CONSTRAINT "content_purchase_paid_invoice_check";
