-- Validates the not-NaN checks that 0013 added NOT VALID, as their own transaction, so 0013's locks are released when 0013 commits, before these scans start.
-- (Each migration must commit before this one starts: `bun run db:migrate` commits each file separately; `drizzle-kit migrate` runs all pending files in one transaction and does not give that boundary.)
--
-- A NaN that was stored before 0013 (fee_rate.amount could hold one, because NaN passes "> 0") would fail the validation, and retrying would fail
-- again. So this migration first looks for such rows and, if there are any, stops with the table, column and number of rows. Correct each row to its
-- real value (or delete the row if it was never meant to exist), then run the migration again. Do not set an unknown rate to zero: a zero rate bills
-- nothing, which is a different mistake.
DO $$
DECLARE
  c record;
  n bigint;
  report text := '';
BEGIN
  FOR c IN
    SELECT k.conrelid::regclass::text AS tbl, k.conrelid AS rel, a.attname AS col
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.contype = 'c' AND NOT k.convalidated AND k.conname LIKE '%\_finite\_check'
    ORDER BY 1, 3
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = ''NaN''::numeric', c.tbl, c.col) INTO n;
    IF n > 0 THEN
      report := report || format(E'\n  %s.%s: %s row(s)', c.tbl, c.col, n);
    END IF;
  END LOOP;
  IF report <> '' THEN
    RAISE EXCEPTION E'Cannot validate the not-NaN checks: these columns still hold NaN:%\nFind the rows with SELECT * FROM <table> WHERE <column> = ''NaN''; set each to its real value (or delete a row that should not exist), then run the migration again. Do not use 0 for an unknown rate.', report
      USING ERRCODE = 'check_violation';
  END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT k.conrelid::regclass::text AS tbl, k.conname
    FROM pg_constraint k
    WHERE k.contype = 'c' AND NOT k.convalidated AND k.conname LIKE '%\_finite\_check'
    ORDER BY 1, 2
  LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;
