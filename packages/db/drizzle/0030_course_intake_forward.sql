-- Forward migration for databases that already ran the earlier 0013 (the runner skips an edited file). That 0013 added the course trigger but did not look at
-- enrolments that already break the intake rule, and its enrolment trigger read the course without a lock. Migration 0025 validates only the numeric checks. Here:
-- (1) list existing enrolments that break the rule and stop, so a person can decide what each one needs; (2) replace the enrolment trigger function with the
-- locking read. Nothing from 0013 is replayed: the triggers and the numeric checks already exist and are not touched. On a database that ran the current 0013
-- both steps are no-ops.

-- (1) C2 for every existing row, not only for changes made after the trigger existed.
DO $$
DECLARE
  bad integer;
  sample text;
BEGIN
  SELECT count(*), string_agg(id::text, ', ') FILTER (WHERE rn <= 10) INTO bad, sample FROM (
    SELECT e."id", row_number() OVER (ORDER BY e."id") AS rn
    FROM "enrollment" e JOIN "course" c ON c."id" = e."course_id"
    WHERE (c."kind" = 'class' AND e."intake_id" IS NOT NULL)
       OR (c."kind" = 'program' AND c."learning_mode" = 'scheduled' AND e."intake_id" IS NULL)
       OR (c."kind" = 'program' AND c."learning_mode" = 'self_paced' AND e."intake_id" IS NOT NULL)
  ) x;
  IF bad > 0 THEN
    RAISE EXCEPTION 'C2: % existing enrolment(s) break the intake rule (first ids: %). Give each enrolment in a scheduled program an intake, and remove the intake from enrolments in a class or self-paced program (UPDATE enrollment SET intake_id = ... WHERE id IN (...)), then run this migration again.', bad, sample
      USING ERRCODE = 'check_violation';
  END IF;
END $$;
--> statement-breakpoint

-- (2)
-- The enrolment trigger reads the course FOR SHARE. A course update (not a key update) takes a conflicting row lock, so an enrolment insert and a
-- kind or learning mode change cannot both pass their checks against each other's uncommitted state under Read Committed: one waits for the
-- other, then validates against the committed course. The foreign key's key-share lock alone would not block that update.
CREATE OR REPLACE FUNCTION "enrollment_check_intake"() RETURNS trigger AS $$
DECLARE
  c_kind text;
  c_mode text;
BEGIN
  SELECT "kind", "learning_mode" INTO c_kind, c_mode FROM "course" WHERE "id" = NEW."course_id" FOR SHARE;
  IF c_kind = 'class' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a class enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'scheduled' AND NEW."intake_id" IS NULL THEN
    RAISE EXCEPTION 'C2: a scheduled program enrolment requires an intake' USING ERRCODE = 'check_violation';
  ELSIF c_kind = 'program' AND c_mode = 'self_paced' AND NEW."intake_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C2: a self-paced program enrolment cannot have an intake' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
