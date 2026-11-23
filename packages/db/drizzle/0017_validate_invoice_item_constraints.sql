-- Validates the two invoice_item constraints that 0006 added NOT VALID. This is its own migration so the earlier ACCESS EXCLUSIVE lock is released first;
-- VALIDATE CONSTRAINT itself takes only SHARE UPDATE EXCLUSIVE, which lets reads and writes continue while it scans.
ALTER TABLE "invoice_item" VALIDATE CONSTRAINT "invoice_item_purchase_invoice_fk";--> statement-breakpoint
ALTER TABLE "invoice_item" VALIDATE CONSTRAINT "invoice_item_content_fields_check";
