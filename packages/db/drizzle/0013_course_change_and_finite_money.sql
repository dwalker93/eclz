-- Custom migration: two gaps found in review.

-- C2 again: the enrolment trigger only runs on enrollment, so changing a course's kind or learning mode could leave existing enrolments that break the
-- intake rule. Reject such a change while any enrolment would no longer fit.
--
-- Existing data: C2 holds for every row, not only for changes made after this migration. A course changed before the trigger existed (for example
-- a class turned into a scheduled program) can still have enrolments that break the rule. They need a person's decision (which intake, or
-- whether the intake is wrong), so the upgrade stops here and lists them; fix the rows and run the migration again.
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
--> statement-breakpoint

CREATE FUNCTION "course_check_enrollment_intake"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "enrollment" e
    WHERE e."course_id" = NEW."id"
      AND (
        (NEW."kind" = 'class' AND e."intake_id" IS NOT NULL)
        OR (NEW."kind" = 'program' AND NEW."learning_mode" = 'scheduled' AND e."intake_id" IS NULL)
        OR (NEW."kind" = 'program' AND NEW."learning_mode" = 'self_paced' AND e."intake_id" IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'C2: the course has enrolments that do not fit its new kind or learning mode' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER "course_intake_rule"
  BEFORE UPDATE OF "kind", "learning_mode" ON "course"
  FOR EACH ROW EXECUTE FUNCTION "course_check_enrollment_intake"();
--> statement-breakpoint

-- PostgreSQL accepts NaN in numeric columns and orders it above every number, so a check such as "amount > 0" lets it through. Every numeric column
-- gets a "not NaN" check (NULL still passes, as for any check). New numeric columns need the same; the db tests fail until they have it.
--
-- The checks are added NOT VALID, one ALTER TABLE per table (no table scan under lock, and a NaN already stored cannot abort the upgrade), and they
-- reject NaN in every new or changed row from now on. Migration 0025 validates them and, if an old row still holds NaN, stops there and lists the
-- rows. An unknown value is never replaced by zero here.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT table_name, string_agg(
             format('ADD CONSTRAINT %I CHECK (%I <> ''NaN''::numeric) NOT VALID', left(table_name || '_' || column_name || '_finite_check', 63), column_name),
             ', ' ORDER BY column_name) AS adds
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'numeric'
      AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    GROUP BY table_name
  LOOP
    EXECUTE format('ALTER TABLE %I %s', t.table_name, t.adds);
  END LOOP;
END $$;
