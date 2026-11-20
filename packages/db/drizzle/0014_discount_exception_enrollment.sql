-- Discount lines made from a fee exception before this migration carried no enrolment_id. Fill it from the exception so the new check and key hold on existing data.
UPDATE "invoice_item" i SET "enrollment_id" = f."enrollment_id" FROM "fee_exception" f WHERE i."fee_exception_id" = f."id" AND i."enrollment_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_exception_enrollment_fk" FOREIGN KEY ("fee_exception_id","enrollment_id") REFERENCES "public"."fee_exception"("id","enrollment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_exception_enrollment_check" CHECK ("invoice_item"."fee_exception_id" IS NULL OR "invoice_item"."enrollment_id" IS NOT NULL);--> statement-breakpoint

-- D19 again: the composite foreign key above ties a discount's fee exception to the line's own enrolment_id, but says nothing about the item the discount
-- reduces. Reject a discount whose enrolment differs from the enrolment of its applies_to item, from either side (the discount row, or the reduced item's
-- enrolment changing afterwards). A discount without an enrolment (not created from an exception) is not checked here.
CREATE FUNCTION "invoice_item_check_discount_enrollment"() RETURNS trigger AS $$
BEGIN
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

CREATE CONSTRAINT TRIGGER "invoice_item_discount_enrollment"
  AFTER INSERT OR UPDATE OF "enrollment_id", "applies_to_item_id", "kind" ON "invoice_item"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "invoice_item_check_discount_enrollment"();
