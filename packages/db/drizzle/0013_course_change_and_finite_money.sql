-- Custom migration: two gaps found in review.

-- C2 again: the enrolment trigger only runs on enrollment, so changing a course's kind or learning mode could leave existing enrolments that break the
-- intake rule. Reject such a change while any enrolment would no longer fit.
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
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'numeric'
      AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I <> ''NaN''::numeric)', c.table_name, left(c.table_name || '_' || c.column_name || '_finite_check', 63), c.column_name);
  END LOOP;
END $$;
