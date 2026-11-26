-- Discount lines made from a fee exception before this migration carried no enrolment_id. Fill it from the exception so the new check and key hold on existing data.
UPDATE "invoice_item" i SET "enrollment_id" = f."enrollment_id" FROM "fee_exception" f WHERE i."fee_exception_id" = f."id" AND i."enrollment_id" IS NULL;
--> statement-breakpoint
-- The trigger below only sees rows written after it exists, so check the existing discount links now with the same predicate it uses. A discount that
-- carries an enrolment must carry the enrolment of the item it reduces; list the ones that do not and stop, so they can be reconciled by hand first.
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
    RAISE EXCEPTION 'D19: % existing discount line(s) carry a different enrolment from the item they reduce (first ids: %). Make the discount and its applies_to item share one enrolment (UPDATE invoice_item SET enrollment_id = ... WHERE id IN (...)), then run this migration again.', bad, ids USING ERRCODE = 'check_violation';
  END IF;
END $$;
--> statement-breakpoint
-- Both constraints are added NOT VALID so this migration does not scan invoice_item while holding the table lock; 0026 validates them once this one has committed.
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_exception_enrollment_fk" FOREIGN KEY ("fee_exception_id","enrollment_id") REFERENCES "public"."fee_exception"("id","enrollment_id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_exception_enrollment_check" CHECK ("invoice_item"."fee_exception_id" IS NULL OR "invoice_item"."enrollment_id" IS NOT NULL) NOT VALID;--> statement-breakpoint

-- D19 again: the composite foreign key above ties a discount's fee exception to the line's own enrolment_id, but says nothing about the item the discount
-- reduces. Reject a discount whose enrolment differs from the enrolment of its applies_to item, from either side (the discount row, or the reduced item's
-- enrolment changing afterwards). A discount without an enrolment (not created from an exception) is not checked here.
CREATE FUNCTION "invoice_item_check_discount_enrollment"() RETURNS trigger AS $$
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

-- The trigger looks discounts up by the item they reduce, which nothing indexed; without this each checked line could scan the whole table.
-- On a large table an operator can build it first with CREATE INDEX CONCURRENTLY (README, "Upgrading a running deployment"), so accept an index of this name
-- that is valid and is exactly the one below, create it when the name is free, and stop on anything else rather than treat the name as success.
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
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER "invoice_item_discount_enrollment"
  AFTER INSERT OR UPDATE OF "enrollment_id", "applies_to_item_id", "kind" ON "invoice_item"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "invoice_item_check_discount_enrollment"();
