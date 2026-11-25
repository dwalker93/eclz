-- Validates the two invoice_item constraints that 0006 added NOT VALID. This is its own migration so that 0006's ACCESS EXCLUSIVE lock is released when 0006 commits, before this scan starts.
-- (Each migration must commit before this one starts: `bun run db:migrate` commits each file separately; `drizzle-kit migrate` runs all pending files in one transaction and does not give that boundary.)
-- VALIDATE CONSTRAINT itself takes only SHARE UPDATE EXCLUSIVE, which lets reads and writes continue while it scans.
ALTER TABLE "invoice_item" VALIDATE CONSTRAINT "invoice_item_purchase_invoice_fk";--> statement-breakpoint
ALTER TABLE "invoice_item" VALIDATE CONSTRAINT "invoice_item_content_fields_check";
