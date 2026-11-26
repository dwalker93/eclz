-- Validates the checks added NOT VALID by 0032, in a transaction of their own.
ALTER TABLE "notification" VALIDATE CONSTRAINT "notification_status_check";--> statement-breakpoint
ALTER TABLE "notification" VALIDATE CONSTRAINT "notification_unconfirmed_check";
