-- Validates content_purchase_paid_invoice_check (0022) as its own transaction, so 0022's lock is released when 0022 commits, before this scan starts.
-- (Each migration must commit before this one starts: `bun run db:migrate` commits each file separately; `drizzle-kit migrate` runs all pending files in one transaction and does not give that boundary.)
-- A paid purchase with no invoice has no billing record and cannot be repaired
-- automatically (an invoice cannot be invented), so stop with a clear message instead of a bare constraint error.
DO $$
DECLARE
  n integer;
  ids text;
  h integer;
  hids text;
  msg text;
BEGIN
  SELECT count(*), string_agg(id::text, ', ' ORDER BY id) FILTER (WHERE k <= 20),
         count(*) FILTER (WHERE handed), string_agg(id::text, ', ' ORDER BY id) FILTER (WHERE handed AND hk <= 20)
    INTO n, ids, h, hids FROM (
      SELECT "id", ("handed_over_at" IS NOT NULL) AS handed,
             row_number() OVER (ORDER BY "id") AS k,
             row_number() OVER (PARTITION BY ("handed_over_at" IS NOT NULL) ORDER BY "id") AS hk
      FROM "content_purchase" WHERE "status" = 'paid' AND "invoice_id" IS NULL
    ) x;
  IF n > 0 THEN
    msg := format('%s paid content purchase(s) have no invoice (first ids: %s). Give each one its invoice, or, if it was never paid, set its status to pending or cancelled (see content_purchase_paid_invoice_check).', n, ids);
    IF h > 0 THEN
      msg := msg || format(' %s of them were handed over (first ids: %s). Their status cannot change on its own: content_purchase_handover_check requires a handed-over purchase to stay paid. Give each its matching invoice, or reconcile its handover records first and only then change its status; do not clear the handover history as a routine fix.', h, hids);
    END IF;
    RAISE EXCEPTION '%', msg USING ERRCODE = 'check_violation';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "content_purchase" VALIDATE CONSTRAINT "content_purchase_paid_invoice_check";
