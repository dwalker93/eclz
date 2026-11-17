-- Phase 2 rules that Drizzle cannot express. Statements are separated by statement-breakpoint markers.

-- D18: an enrolment has at most one fee exception of each kind on any date.
-- Dates are [effective_from, effective_to), and a null end means "until ended".
ALTER TABLE "fee_exception" ADD CONSTRAINT "fee_exception_no_overlap"
  EXCLUDE USING gist (
    "enrollment_id" WITH =,
    "kind" WITH =,
    daterange("effective_from", "effective_to", '[)') WITH &&
  );
