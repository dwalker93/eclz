-- The check is looser than the one it replaces (gross and commission may be negative), so existing rows satisfy it. NOT VALID avoids a scan under lock here; 0021 validates it.
ALTER TABLE "teacher_payout" DROP CONSTRAINT "teacher_payout_amounts_check";--> statement-breakpoint
ALTER TABLE "teacher_payout" ADD CONSTRAINT "teacher_payout_amounts_check" CHECK ("teacher_payout"."net_payable" >= 0 AND "teacher_payout"."net_payable" = "teacher_payout"."gross_collected" - "teacher_payout"."commission_total") NOT VALID;
