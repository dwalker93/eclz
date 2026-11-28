#!/bin/sh
# Compares the schema of two databases (public schema objects, the drizzle history schema left out).
#   scripts/compare-schema.sh <url-of-database-A> <url-of-database-B>
# Needs pg_dump (the same major version as the servers) on the PATH. Prints IDENTICAL, FORMATTING ONLY or REAL DIFFERENCE and shows the diff.
# Exit status: 0 for IDENTICAL or FORMATTING ONLY, 1 for REAL DIFFERENCE, 2 for a usage or dump error.
#
# pg_dump (16.x minor releases that add it) writes `\restrict <random key>` and `\unrestrict <key>` lines that differ on every run, so they are removed.
# Nothing else is changed, so the strict comparison sees trailing spaces too. If it differs, the diff is repeated ignoring blank lines and changes in the amount of white space (trailing spaces included):
# when that second comparison is empty the two schemas differ in layout only (for example blank lines inside a function body), which does not change
# what the database does. Read the strict diff before accepting that: white space inside a string literal is also ignored by the second pass.
set -eu
[ $# -eq 2 ] || { echo "usage: $0 <url-A> <url-B>" >&2; exit 2; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# The dump goes to a raw file first and its exit status is checked before anything is filtered: in a pipe a failed pg_dump would be hidden, and two empty
# dumps would compare as IDENTICAL.
dump() { # dump <url> <outfile> <label>
  pg_dump --schema-only --no-owner --no-privileges -N drizzle "$1" > "$2.raw" || { echo "pg_dump failed for database $3 (see its error above)" >&2; return 1; }
  grep -v -E '^\\(un)?restrict ' "$2.raw" > "$2" || [ $? -eq 1 ]
}
dump "$1" "$tmp/a.sql" A || exit 2
dump "$2" "$tmp/b.sql" B || exit 2
if diff -u "$tmp/a.sql" "$tmp/b.sql" > "$tmp/strict.diff"; then
  echo IDENTICAL
elif diff -u -B -b "$tmp/a.sql" "$tmp/b.sql" > /dev/null; then
  echo "FORMATTING ONLY"
  cat "$tmp/strict.diff"
else
  echo "REAL DIFFERENCE"
  cat "$tmp/strict.diff"
  exit 1
fi
