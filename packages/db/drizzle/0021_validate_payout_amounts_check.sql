-- Validates the teacher_payout check that 0020 added NOT VALID. This is its own migration so that 0020's lock is released when 0020 commits, before this scan starts.
-- (Each migration must commit before this one starts: `bun run db:migrate` commits each file separately; `drizzle-kit migrate` runs all pending files in one transaction and does not give that boundary.)
ALTER TABLE "teacher_payout" VALIDATE CONSTRAINT "teacher_payout_amounts_check";
