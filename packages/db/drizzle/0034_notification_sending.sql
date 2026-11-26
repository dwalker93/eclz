-- Dispatch no longer holds a transaction across the provider call. A dispatcher first claims a row in a short transaction (status `sending`, with a lease in
-- `claimed_until`), sends outside any transaction, then finishes the row with a conditional update. A row whose lease ran out is `unconfirmed`, never `queued`:
-- the provider may already have accepted it.
-- The column is nullable with no default, so adding it rewrites nothing. The status check is replaced by a wider one and a new check says a `sending` row has its
-- lease. Both are added NOT VALID and validated in 0035, so no scan of the table runs while the lock for the change is held.
ALTER TABLE "notification" ADD COLUMN "claimed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_status_check";--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_status_check" CHECK ("notification"."status" IN ('queued', 'sending', 'sent', 'failed', 'unconfirmed')) NOT VALID;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_sending_check" CHECK ("notification"."status" <> 'sending' OR "notification"."claimed_until" IS NOT NULL) NOT VALID;--> statement-breakpoint
CREATE INDEX "notification_sending_idx" ON "notification" USING btree ("claimed_until") WHERE "notification"."status" = 'sending';
