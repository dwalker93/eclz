-- Added NOT VALID so it does not scan under lock; new and changed rows are checked from here, and 0023 validates the rest.
ALTER TABLE "content_purchase" ADD CONSTRAINT "content_purchase_paid_invoice_check" CHECK ("content_purchase"."status" <> 'paid' OR "content_purchase"."invoice_id" IS NOT NULL) NOT VALID;
