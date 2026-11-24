-- Validates message_thread_id_message_thread_id_fk, which 0015 added NOT VALID. This is its own migration so that 0015's lock is released when 0015 commits, before this scan starts.
-- (Each migration must commit before this one starts: `bun run db:migrate` commits each file separately; `drizzle-kit migrate` runs all pending files in one transaction and does not give that boundary.)
-- VALIDATE CONSTRAINT takes only SHARE UPDATE EXCLUSIVE on message (and ROW SHARE on message_thread), so reads and writes continue while it scans.
-- Every existing message already points at a real thread through message_sender_participant_fk, so this cannot find a bad row.
ALTER TABLE "message" VALIDATE CONSTRAINT "message_thread_id_message_thread_id_fk";
