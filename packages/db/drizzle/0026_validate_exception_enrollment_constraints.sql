-- Validates the two invoice_item constraints that 0014 added NOT VALID. This is its own migration so that 0014's ACCESS EXCLUSIVE lock is released when 0014 commits, before this scan starts.
-- (Each migration must commit before this one starts: `bun run db:migrate` commits each file separately; `drizzle-kit migrate` runs all pending files in one transaction and does not give that boundary.)
-- VALIDATE CONSTRAINT itself takes only SHARE UPDATE EXCLUSIVE, which lets reads and writes continue while it scans. A database that already ran the
-- earlier form of 0014 has both constraints validated, and validating them again does nothing.
ALTER TABLE "invoice_item" VALIDATE CONSTRAINT "invoice_item_exception_enrollment_fk";--> statement-breakpoint
ALTER TABLE "invoice_item" VALIDATE CONSTRAINT "invoice_item_exception_enrollment_check";
