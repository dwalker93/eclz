-- Added NOT VALID so this migration does not scan message while holding its lock; 0027 validates it once this one has committed. New writes are checked at once and ON DELETE cascade applies.
ALTER TABLE "message" ADD CONSTRAINT "message_thread_id_message_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_thread"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
