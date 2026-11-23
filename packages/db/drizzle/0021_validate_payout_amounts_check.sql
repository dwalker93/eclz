-- Validates the teacher_payout check that 0020 added NOT VALID, in its own transaction so the earlier lock is released first.
ALTER TABLE "teacher_payout" VALIDATE CONSTRAINT "teacher_payout_amounts_check";
