# @workspace/db

Database package for the student management system: Drizzle ORM schema, migrations, seed and client for PostgreSQL.
Built from design v1.0 (frozen). A plain-language guide to every table is in [`docs/tables.md`](../../docs/tables.md). The design lives in [`docs/`](../../docs) at the repository root: the ER diagram and the invariants file,
where every rule says whether it is enforced by the database, a transaction, application code, or a job.

The business rules that need a transaction or a job are in the service layer, `@workspace/domain` (`packages/domain`), not here.

**All five phases are done** (69 tables), plus three sign-in tables (`auth_session`, `user_two_factor`, `auth_rate_limit`) used by `@workspace/auth`: 72 tables. Two optional extras need no tables (see phase 5 below).

## What is in phase 1

organization, branch, user, file, role, permission, role_permission, staff_role_assignment, audit_log,
lecturer, lecturer_branch, student, student_branch, grade_level, guardian, student_guardian,
academic_term, subject, course_group, course, course_grade_level, course_lecturer, intake, enrollment,
schedule_slot, class_session, attendance, promotion_run, promotion_item, student_level,
fee_structure, fee_rate, invoice, invoice_item, payment_method, bank_account, payment,
payment_allocation, receipt, receipt_counter, content_item, content_branch, course_section,
course_content, notice, notice_target.

## What phase 2 adds (10 tables)

installment_option, invoice_installment, fee_exception, notification_channel, notification_template,
notification, push_subscription, message_thread, thread_participant, message. It also adds
`invoice.installment_option_id` and `invoice_item.fee_exception_id`.

The parent portal needs no tables of its own: guardians, `student_guardian` and the `parent_portal` module flag
from phase 1 are enough. Overdue restriction is also rules over existing columns (C9: grace days and action on the
organization and fee structure, `enrollment.access_status`), run by a daily job.

## What phase 3 adds (8 tables)

question, question_option, exam, exam_course, exam_question, exam_attempt, attempt_answer, exam_result.
An exam is attached to courses through `exam_course`, so branch-specific or shared is just which courses it is attached to.

## What phase 4 adds (4 tables)

content_purchase, commission_rule, commission_entry, teacher_payout. It also adds `invoice_item.content_purchase_id`
and a unique `(id, branch_id)` on `invoice`.

## What phase 5 adds (1 table)

gateway_transaction: the online payment attempt for a payment made with a gateway method (E14, unique on provider and provider reference).
It uses the same `payment` row, verification and allocation as every other method.

Not tables: Zoom and Teams automation uses the meeting columns on `class_session` from phase 1 (provider, url, ref), and
certificate-signed PDF receipts use `receipt`'s `content_hash`, `signature` and `verification_code` from phase 1. Both are application work.

## Package layout

| Import | What it gives you | Safe in a browser bundle |
| --- | --- | --- |
| `@workspace/db` | the schema (tables and types) and the money helpers | yes |
| `@workspace/db/schema` | the schema only | yes |
| `@workspace/db/money` | `toCents`, `fromCents` | yes |
| `@workspace/db/client` | `createDb(url)` and the `Database` type (postgres-js) | no, blocked by the `browser` export condition |
| `@workspace/db/seed` | `seedDefaults`, starter roles and permissions | no (scripts and tests only) |

`drizzle/` holds the migrations, `src/schema/` the tables, `scripts/seed.ts` the provisioning script, `test/` the database tests.

## Setting up a customer deployment

1. Create the customer's PostgreSQL database and set `DATABASE_URL` in that deployment's environment (never commit it).
2. `bun run db:migrate` runs the pending migrations, each in its own transaction (`scripts/migrate.ts`, same history table as drizzle). `0000_init` needs the `btree_gist` extension, which the database owner can create. Do not use `drizzle-kit migrate` for a deployment: it puts every pending migration in one transaction (see "Migrations from here on").
3. `ORG_NAME="..." ORG_TYPE=institution bun run db:seed` creates the one organization, its default branch,
   receipt counter, payment methods (bank transfer is the default), starter permissions, the built-in roles and grades 1 to 13.
4. Use the app: `import { createDb } from "@workspace/db/client"` for the connection and `@workspace/domain` for the services.

### Migrations from here on

`drizzle/0000_init.sql` is the whole schema in one migration (tables, constraints, triggers and functions, all validated), generated from the fully migrated database of the design review rounds, so a new database needs nothing else and there are no forward fixes to apply. It starts with `SET check_function_bodies = false` (some functions name a table's row type before the table exists) and resets it at the end. The seed data (institution, branch, grades, permissions, starter roles) is not in it: run `bun run db:seed`.

Change the schema in `src/schema`, run `bun run db:generate` and commit the new `000N_*.sql` with its snapshot; hand-written SQL for what Drizzle cannot express (constraints, triggers, functions) goes in `drizzle-kit generate --custom` migrations. Rules for those, because the runner applies each migration in its own transaction and skips any migration not newer than the last one applied:

- A change to an applied migration is never edited in place on a database that has run it: add a forward migration.
- A new numeric column gets a not-NaN check in a migration. A new CHECK or FOREIGN KEY constraint on an existing table is added `NOT VALID` first and validated in a separate later migration (the validation scan takes only SHARE UPDATE EXCLUSIVE, so it does not block reads or writes). Because each migration commits before the next starts, the two run at different times; `drizzle-kit migrate` would put them in one transaction, which is why deployments use `bun run db:migrate`. This two-step is only for CHECK and FOREIGN KEY: PostgreSQL cannot add a UNIQUE (or PRIMARY KEY) constraint `NOT VALID`. For a UNIQUE constraint on a table that holds data, build the unique index first, outside a transaction (`CREATE UNIQUE INDEX CONCURRENTLY name ON table (columns)`, see the index rules below), check that it is valid, and then attach it in a migration with `ALTER TABLE table ADD CONSTRAINT name UNIQUE USING INDEX name`, which needs only a brief lock (the index must be valid, not partial and not on expressions).
- A plain `CREATE INDEX` blocks writes to its table while it builds, so on a table that holds data it is built with `CREATE INDEX CONCURRENTLY`, which cannot run inside a transaction. The runner puts every migration file in a transaction, so that statement never goes in a migration. Order for a deployment that is in use:
  1. Apply the migration that adds the column (stop there; `bun run db:migrate` applies whatever is pending, so keep the later migration out of the folder, or not yet deployed, until step 3).
  2. Build the index by hand, as a single statement in autocommit (`psql`, not inside `BEGIN`): `CREATE INDEX CONCURRENTLY name ON table USING btree (column)`.
  3. Apply the migration that checks the index. It compares catalog fields (`pg_index`: valid, ready and live, key columns, access method, no predicate; not `pg_get_indexdef` text, which changes with `quote_all_identifiers`), keeps a matching index, and, when the table has rows and the index is missing or unusable, stops with these instructions instead of building one.
  A fresh install has no rows, so there a plain `CREATE INDEX` takes no time and blocks nobody: write that migration so it creates the index itself only when the table is empty (`IF NOT EXISTS (SELECT 1 FROM table)`), and raises the instructions above otherwise. Never rely on the plain build for a table with rows.
  If a concurrent build fails or is cancelled it leaves an invalid index behind that still costs writes. Check it in the catalog: `SELECT indexrelid::regclass, indisvalid, indisready, indislive FROM pg_index WHERE indexrelid = 'name'::regclass;`. If any of the three flags is false, drop it outside a transaction (`DROP INDEX CONCURRENTLY name`), build it again with `CREATE INDEX CONCURRENTLY`, run the same query to confirm all three are true, and only then continue or rerun the migration that checks it (rerunning before that makes it stop again, as intended).
- Put an index in its own migration after the ALTERs of the same change, so `db:migrate` has committed those first (this separation is a property of this runner only).
- The migration role needs `CREATE` on schema `public` (PostgreSQL 15 and later no longer grant it to everyone). `0000_init` pins `search_path` to `public` while it runs and ends with a check that fails the migration if the tables are not in `public`, so a role or database default `search_path` cannot make it succeed while creating them elsewhere.
- The app, the seed and the migration all use unqualified table names, so every connection they open must resolve them in `public`. `0000_init` pins its own connection, but the app and `db:seed` do not, so set it on the role, not on each connection: `ALTER ROLE <app_role> IN DATABASE <database> SET search_path = public;` (do the same for the migration role if it is another role). A role setting works through a connection pooler; the other choice, a per-connection `options=-c search_path=public` in the URL, is refused by some poolers, so it is not used here. Before provisioning, look at what the role would get, and connect as that role and run `SHOW search_path;`:
  `SELECT coalesce(r.rolname, '(all roles)') AS role, coalesce(d.datname, '(all databases)') AS database, s.setconfig FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole LEFT JOIN pg_database d ON d.oid = s.setdatabase;`
  Any row for the role or database that sets `search_path` to something other than `public` (or `"$user", public` when no schema has the role's name) is overridden by the `ALTER ROLE` above, which is more specific than a database-wide or server-wide setting.
- Databases that ran the old 37-migration chain: the squash was made for databases that had never been migrated, so none should exist. If a development, staging or customer database does keep the old history, `bun run db:migrate` would try to apply `0000_init` (its journal time is just after the old last migration, `1795161269844`, so it counts as newer) and fail on tables that exist. Either rebuild it, or baseline it once. First compare its schema with a fresh database migrated from `0000_init`: `scripts/compare-schema.sh <url-of-the-old-database> <url-of-a-fresh-database>` (it dumps both with `pg_dump`, drops the random `\restrict` key lines and trailing spaces, and prints `IDENTICAL`, `FORMATTING ONLY` or `REAL DIFFERENCE` with the diff). `IDENTICAL` is required to go on, and `FORMATTING ONLY` (for example blank lines inside a function body such as `commission_entry_guard`) is acceptable after you have read the diff; on `REAL DIFFERENCE` stop and resolve the schema difference first, and do not touch the history. Then replace the history with the single row for `0000_init` (`bun -e 'import {readMigrationFiles} from "drizzle-orm/migrator"; const [m]=readMigrationFiles({migrationsFolder:"drizzle"}); console.log(m.hash, m.folderMillis)'` from this folder prints the two values): `BEGIN; DELETE FROM drizzle.__drizzle_migrations; INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<hash>', <folderMillis>); COMMIT;`. A database whose old chain stopped part way is not baselined this way: finish or rebuild it first.
- Journal times: a migration's time in `drizzle/meta/_journal.json` must be later than the one before it, because the runner skips anything not newer than the last one applied; a test (`migrate-runner.test.ts`) fails if they do not strictly increase. `0000_init` is dated one millisecond after the old chain's last migration, so that any migration generated later (it carries its own generation time) sorts after it.
- Upgrading a running deployment: stop everything that runs the old code (API, recurring-invoice, overdue and due-soon jobs, the notification dispatcher), run `bun run db:migrate`, then start the new code, when a migration tightens what the data may hold.
- Add a dated entry to the changelog in `docs/student-management-invariants.md` (repository root).


## Services

The service layer moved to its own package, `@workspace/domain` (`packages/domain`). See its README for the services, their rules and their tests.

## What the database enforces

In the Drizzle schema (checks, unique and partial unique indexes, composite foreign keys):
C1, C3, C4, D1, D2, D4, D7, D8 and D23 (item signs, discount links), D9, E6, E7 (item belongs to invoice),
E10, E12, E13, E15 (bank account branch), F1, F2, B3, A1, the primary-flag rules, and status value lists.

In the Drizzle schema, phase 2: D16 and D19 (exception columns by kind, value ranges), D17 (reason, dates),
D20 (an alternate option belongs to the enrolment's class), D21 (ended_by needs an end date), D10 (installment sequence
unique, amounts positive), J2 (one notification per user, event key and channel), and only participants can post a message.

In the Drizzle schema, phase 3: G2 (unique attempt number per exam and student, one running attempt), G3 (an attempt's enrolment
belongs to the student and the exam is attached to its course, by composite foreign keys), G5 (answers belong to the attempt's exam),
G7 (one result per exam and student, attempt results point at an attempt of the same student and exam), and mode-specific exam fields
(online needs a window and attempt limit, paper needs a date and total marks).

In the Drizzle schema, phase 4: F5 (no second pending or paid purchase of one item), F6 (handover needs a paid physical purchase and a handler),
D13 and D24 (a purchase's branch is one the item is listed in and is its invoice's branch, and its invoice is the student's), a content line must use
its purchase's own invoice (one active line per purchase), H4 scope shapes, H12 (rate ranges, an accrual's commission between 0 and its base, reversals zero or negative),
H1 (teacher amount = base minus commission), H2 (one accrual per allocation and lecturer), H7 (an entry is reversed once), H8 (a settled entry has a payout, a payout's net is gross minus commission and never negative,
and an entry's rule and payout belong to its lecturer).

In `0007_phase4_constraints.sql`: H4 no overlapping rules of one scope per lecturer (`btree_gist`), only paid content items can be purchased,
and triggers: a paid payout is immutable and payout status moves draft, approved, paid only (H8); commission entries are never deleted and only status and payout change (H6),
an accrual comes from a fee item of a course the lecturer teaches (H11), a reversal is the exact negative of an accrual of the same allocation, lecturer and rule (H12),
and nothing joins or changes inside a paid payout.

In `0005_phase3_constraints.sql` (triggers): G4 a published exam's questions cannot change and publishing needs every snapshot,
exam status moves draft to published to closed only, G7 online results come from attempts (or a manual override) while paper results are manual,
G8 a result is released only after the exam closes.

In `0003_phase2_constraints.sql`: D18, no overlapping fee exceptions of one kind on an enrolment (end-exclusive, `btree_gist`).

In `0001_phase1_constraints.sql`:
- A2 one organization per deployment
- B4 no overlapping student grade ranges, D5 no overlapping fee rates (end-exclusive ranges, `btree_gist`)
- C2 intake rule by course kind (trigger)
- E3, E4 verification and allocation are atomic: a deferred constraint trigger checks at commit that a verified
  payment's active allocations equal its amount and that other payments have none
- J4 append-only audit log (also revoke UPDATE, DELETE and TRUNCATE on `audit_log` from the app's database role)

## What is still the application's job (transactions, helpers, jobs)

These rules are in the invariants file but cannot live in the database: invoice totals equal the sum of items (insert the
invoice with its final totals, then the items), `amount_paid` and status caches (E1, E2), allocation limits (E5), the
default pro rata split across items (E7), installment waterfall (E16), capacity (C5), the access helper (C8),
overdue restriction (C9), promotion confirm (B6, B8, C12 to C15), grade lookup (B5), rate lookup (D6), receipt
numbering through `receipt_counter` (E13), commission rules and accrual, payout totals, module gates, authorization and branch scoping,
and the audit log writes (J3). Most of these are implemented in `@workspace/domain`. Use `receipt_counter` like this inside the issuing transaction:
`UPDATE receipt_counter SET last_number = last_number + 1 WHERE branch_id = $1 RETURNING last_number`.

## Phase 5 notes for the application

- Checkout: insert the `payment` (gateway method, no bank account or slip) and its `gateway_transaction`, send the student to the provider, then handle the webhook.
- Webhook: verify the provider's signature first, find the transaction by `(provider, provider_ref)` (or by your own order id stored in `raw_payload` before the reference is known),
  and in one transaction set the transaction status, then verify and allocate the payment like any other (E3, E4). A repeated callback must change nothing (E14).
- Trigger `gateway_transaction_guard` rejects a transaction for a non-gateway payment and sets `updated_at`. Status values: initiated, succeeded, failed, cancelled (refunds are not modelled).
- Module gate: `gateway`. Keep provider keys in environment variables, not in `payment_method.config`.

## Phase 4 notes for the application

- Buying content is one transaction: insert the invoice (final totals, branch = the purchase's branch), insert the `content_purchase` pointing at it, then the
  `content` invoice line pointing at the purchase. When the invoice is paid, set the purchase to `paid`. Access (F3, F4) comes from `canViewContent()`.
- A handed-over purchase must stay `paid` (F6 as written). If a payment for a handed-over book is ever voided, record the return as an invoice adjustment instead of cancelling the purchase.
- Commission accrual runs in the verification transaction (H2, H5, H10, H11): for each lecturer of the course, pick the most specific effective rule, compute base, commission and cap,
  and insert the entry with its snapshots. The database checks the shape and the cap, not the formula. Voiding a payment marks unsettled entries `void` and adds a negative reversal entry for settled ones (H7).
- Payout creation: pick accrued entries (including negative reversals) for the lecturer and period, insert the payout with its final totals, then mark the entries `settled`. If the net is negative, create no payout and carry the entries forward (H8).
  Check in the transaction that payout totals equal the sum of its entries, and in the nightly reconciliation.
- Module gate: `commissions` (H9). A fixed rule larger than the lowest fee of its course should show a warning (H12), which the database does not check.
- Course shares summing to 100 (H3) are still a transaction check when saving a course's lecturers.

## Phase 3 notes for the application

- Publishing is one transaction: build each `exam_question.snapshot` (question, options, correct flags, option keys), set `exam.max_marks`
  to the sum of question marks, then set status to `published`. The trigger refuses it if a snapshot is missing.
- Grade only from the snapshot (G5). Enforce the attempt limit (a count against `max_attempts`), server-time windows and the time limit (G6),
  eligibility (G1), the best or latest rule, and result recomputation (G7) in application code. Check that marks do not exceed `max_marks`.
- A result's `enrollment_id` and `course_id` are optional but come as a pair. Attempts require both.
- Use the module flag `online_exams` and audit result edits after release (J3).

## Phase 2 notes for the application

- Installment amounts must sum to the invoice total (D10, D25), and balances come from the waterfall (E16). Both are transaction work.
- Fee exception billing (D17, D19, D20): resolve the exception active on the period start, bill the alternate option's rate
  or add a negative discount item with `fee_exception_id` and `applies_to_item_id`.
- Notifications: build `event_key` from what caused the event (for example `installment:<id>:due`) so retrying the enqueue does not create a second row (delivery itself can still repeat if a dispatch rolls back after the provider accepted).
  Check the channel switch and module flag before inserting. `read_at` tracks in-app reads.
- New permissions in the seed: `fees.override` (D15) and `notifications.manage`. A deployment seeded in phase 1 must insert
  them and its four `notification_channel` rows once (the seed only runs on an empty database).

## Choices made while implementing (review these)

- Status columns are text with CHECK constraints, not Postgres enums, so adding a value is an easy migration.
- A CHECK passes when its condition is NULL. `oneOf` is for NOT NULL columns only, and other checks guard nullable columns explicitly.
  The tests caught two such cases while this was built.
- Added beyond the ER diagram: `notification.event_key` and `read_at` (J2 and in-app reads), `message_thread.created_by`,
  `fee_exception.course_id` (lets a composite foreign key enforce D20), and the extra events `payment_submitted`,
  `payment_rejected` and `installment_overdue` from the notifications section.
- `receipt_counter` is not in the ER diagram. It implements the "per-branch counter" from E13.
- Extra composite foreign keys keep related rows consistent: a fee structure and its course share a branch, a grouped class
  shares branch and subject with its group, a bank payment shares the branch of its bank account.
- `course.status` values (draft, active, closed, archived), ISO weekday numbers (1 = Monday), and the defaults
  (guardian details required under age 16, overdue grace 7 days, action notify, receipt currency LKR) are starting values, not part of the frozen design.
- `src/seed.ts` has a starter permission list and role mapping. Review it before first use.
- `payment_bank_reference_uq` also blocks reusing a bank reference after a payment is voided (the design only frees it after rejection).
- Foreign keys default to no action. Users, students and money records are disabled, ended or voided, never deleted.
- User emails should be lower-cased by the app before saving.

## Tests

`bun run test` (from this folder) runs on an in-process PostgreSQL (PGlite) with every migration applied, in journal order. PGlite runs real PostgreSQL code but is not a server:
run the migrations once against a real database (for example the one you will deploy on) before first use.

| File | What it covers |
| --- | --- |
| `constraints.test.ts` | 225 database rules: the constraints, triggers and uniqueness listed above, grouped by phase and rule (payment verification and void, multi-invoice payments, cancel and reissue, the append-only audit log, exams, purchases, commissions, payouts, gateway) |
| `seed.test.ts` | what the provisioning seed creates, and that it cannot run twice |
| `money.test.ts` | cents conversion |

`constraints.test.ts` is one ordered story (later groups reuse the students, invoices and payments earlier groups created), so run it whole.
`setup.ts` creates the database and applies the migrations, `helpers.ts` has `eq` and `rejects`.
The service tests are in `packages/domain/test`.
