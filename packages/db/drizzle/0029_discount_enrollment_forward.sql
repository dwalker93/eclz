-- Forward migration for databases that already ran the earlier 0014 (the runner skips an edited file). That 0014 filled a discount's enrollment_id from its fee
-- exception, so a discount could end up on enrolment A while the item it reduces belongs to B, installed the check trigger after that backfill, and gave the trigger
-- no lock and the lookup no index. 0026 validates only the discount's link to its exception and that an enrolment is present, so none of this was ever caught.
-- Here: (1) list existing discounts that do not match the item they reduce, and stop so they can be reconciled; (2) install the locking trigger body (the trigger
-- itself already exists and is not recreated); (3) make sure the lookup index exists, keeping a valid prebuilt one. On a database that ran the current 0014 all three
-- are no-ops.

-- (1) The trigger's own predicate over existing rows. A discount that carries an enrolment must carry the enrolment of the item it reduces.
DO $$
DECLARE
  bad integer;
  ids text;
BEGIN
  SELECT count(*), string_agg(id::text, ', ' ORDER BY id) FILTER (WHERE n <= 20) INTO bad, ids FROM (
    SELECT d."id", row_number() OVER (ORDER BY d."id") AS n FROM "invoice_item" d
    JOIN "invoice_item" t ON t."id" = d."applies_to_item_id"
    WHERE d."kind" = 'discount'
      AND d."enrollment_id" IS NOT NULL
      AND t."enrollment_id" IS DISTINCT FROM d."enrollment_id"
  ) x;
  IF bad > 0 THEN
    RAISE EXCEPTION 'D19: % existing discount line(s) carry a different enrolment from the item they reduce (first ids: %). Make the discount and its applies_to item share one enrolment (UPDATE invoice_item SET enrollment_id = ... WHERE id IN (...)), then run this migration again (0014 already ran, so only this check is repeated).', bad, ids USING ERRCODE = 'check_violation';
  END IF;
END $$;
--> statement-breakpoint

-- (2) The trigger body with the row locks (see 0014 for why).
CREATE OR REPLACE FUNCTION "invoice_item_check_discount_enrollment"() RETURNS trigger AS $$
BEGIN
  -- Under READ COMMITTED, inserting a discount and changing its target's enrolment are not ordered by any row lock (the foreign key only takes a key-share lock,
  -- which a non-key update does not conflict with), so both checks could pass and the committed rows disagree. Lock the item the check is about, the row
  -- itself and the item it reduces, in id order, before reading: a concurrent change to either waits, and the query below then sees its result.
  PERFORM 1 FROM "invoice_item" WHERE "id" IN (NEW."id", NEW."applies_to_item_id") ORDER BY "id" FOR SHARE;
  IF EXISTS (
    SELECT 1 FROM "invoice_item" d
    JOIN "invoice_item" t ON t."id" = d."applies_to_item_id"
    WHERE d."kind" = 'discount'
      AND d."enrollment_id" IS NOT NULL
      AND (d."id" = NEW."id" OR d."applies_to_item_id" = NEW."id")
      AND t."enrollment_id" IS DISTINCT FROM d."enrollment_id"
  ) THEN
    RAISE EXCEPTION 'D19: a discount must carry the same enrolment as the item it reduces' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- (3) The index for the trigger's lookup.
DO $$
DECLARE
  existing oid := to_regclass('public.invoice_item_applies_to_idx');
  usable boolean;
BEGIN
  IF existing IS NULL THEN
    CREATE INDEX "invoice_item_applies_to_idx" ON "invoice_item" USING btree ("applies_to_item_id");
  ELSE
    SELECT i.indisvalid AND i.indisready AND i.indislive
           AND pg_get_indexdef(existing) = 'CREATE INDEX invoice_item_applies_to_idx ON public.invoice_item USING btree (applies_to_item_id)'
      INTO usable FROM pg_index i WHERE i.indexrelid = existing;
    IF usable IS NOT TRUE THEN
      RAISE EXCEPTION 'invoice_item_applies_to_idx already exists but is not a valid btree index on invoice_item (applies_to_item_id) (%). Drop it (DROP INDEX CONCURRENTLY public.invoice_item_applies_to_idx), build it again with CREATE INDEX CONCURRENTLY invoice_item_applies_to_idx ON invoice_item USING btree (applies_to_item_id), and run this migration again.', pg_get_indexdef(existing) USING ERRCODE = 'duplicate_table';
    END IF;
  END IF;
END $$;
