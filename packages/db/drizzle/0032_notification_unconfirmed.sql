-- A provider call that times out may still have been accepted, so its row is neither sent nor safely failed: add the status `unconfirmed`.
-- The status check is replaced by a wider one, and a new check says an unconfirmed row carries its reason. Both are added NOT VALID and validated in 0033, so no
-- scan of the table runs while the lock for the change is held.
ALTER TABLE "notification" DROP CONSTRAINT "notification_status_check";--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_status_check" CHECK ("notification"."status" IN ('queued', 'sent', 'failed', 'unconfirmed')) NOT VALID;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_unconfirmed_check" CHECK ("notification"."status" <> 'unconfirmed' OR "notification"."error" IS NOT NULL) NOT VALID;
