# Student Management System: Invariants and Enforcement (v1)

Companion to `student-management-erd.md` (design v1.0, frozen). Every rule says where it is enforced:

- **DB** = database constraint (unique index, CHECK, foreign key, exclusion constraint, trigger)
- **TX** = application code inside one database transaction (with row locks where noted)
- **APP** = application validation or policy, checked on every route, action and job
- **JOB** = scheduled job

Drizzle does not model exclusion constraints, partial unique indexes with expressions, or triggers well, so those go in hand-written SQL migrations next to the generated ones. Exclusion constraints on date ranges need the `btree_gist` extension.

**Date convention.** Every entitlement, billing and effectivity range is start-inclusive and end-exclusive, `[from, to)`. A column such as `to_date`, `effective_to`, `access_ends_on` or `period_end` holds the first day outside the range, and null means no end. Exclusion constraints use `daterange(from, to, '[)')`. The only exceptions are `academic_term.ends_on` and `intake.ends_on`, which are display dates holding the last day.

## A. Identity and access

| # | Rule | Enforced |
|---|---|---|
| A1 | A user can hold several identities at once (staff role, lecturer, student, guardian). There is no single user type. A solo teacher is one user with a `root_admin` assignment and a `lecturer` row. | DB: unique `user_id` on lecturer, student and guardian |
| A2 | Exactly one `organization` row exists per deployment. | DB: unique index on a constant expression |
| A3 | Login requires an active user. Portal entry additionally requires the identity's flag or link: `lecturer.portal_enabled`, a linked `student.user_id`, `guardian.portal_enabled` plus the parent_portal module. | APP |
| A4 | Switching a lecturer's portal off removes login and the `lecturer` role only. The `lecturer` row stays so course assignment, commissions and history survive. | APP + TX |
| A5 | Built-in `lecturer` role grants only ownership-scoped actions: own courses (via `course_lecturer`), own content, own exams and questions. | APP (ownership check in every handler) |
| A6 | Staff permissions are checked through one `authorize(user, permission, branch)` function. A role assignment with null branch applies to all branches. | APP |
| A7 | The last `root_admin` cannot be removed or disabled. | TX |

## B. Students, grades and promotion

| # | Rule | Enforced |
|---|---|---|
| B1 | Required for every student: name, date of birth. Grade is required only to enrol in a class with grade-based fees. Adults in programs need no grade. Guardians and staff have no grade. | APP |
| B2 | If age (from date of birth, on the registration date) is below `guardian_required_below_age`, at least one guardian with name, phone and address is required. | APP |
| B3 | A student has at most one current `student_level` row (`to_date` null). | DB: partial unique index |
| B4 | A student's `student_level` date ranges never overlap. | DB: exclusion constraint |
| B5 | The grade on date D is the row with `from_date <= D` and (`to_date` null or `D < to_date`). One shared helper is used everywhere and always takes an explicit as-of date: `period_start` for billing, the enrolment or session date for eligibility. A promotion creates `student_level` rows starting on the run's effective date, so a period starting that day uses the new grade and anything earlier uses the old one. | APP |
| B6 | Promotion is a draft, review and confirm flow, per class enrolment. The draft creates a `promotion_run` (status `draft`) with one `promotion_item` for each active class enrolment of each student (a student with no active enrolment gets one item with no enrolment). The admin reviews and edits items and sets the effective date. Confirm runs in one transaction: for each student whose items are not all `skip`, close the current `student_level` and open the next from the effective date, then apply each item. A student already at the highest ordinal is listed as `skip`. Nothing changes until confirm. | TX |
| B7 | Enrolling in a course creates the `student_branch` row for the course's branch if missing. | TX |
| B8 | A promotion run can be confirmed once. A draft can be discarded with no effect. Item decisions: `move` ends the old enrolment and starts one in the target class; `stay` keeps the enrolment in its class, the student still advances a grade, and `billing_grade_level_id` on that enrolment is set to the grade before promotion so its rate does not change; `skip` means nothing changes for that item, and a student whose items are all `skip` does not advance. An admin can clear a pinned billing grade later, with a reason, but only if the class has a fee rate (or an all-grades rate) effective for the student's current grade from the clear date. Otherwise the clear is rejected, and the admin first adds the missing rate to the class, gives the student a fee exception (D20), or moves the student to the right class. Billing never fails silently because of a cleared pin. | TX |

## C. Courses, enrolment and access

| # | Rule | Enforced |
|---|---|---|
| C1 | `kind = 'class'` requires `learning_mode = 'scheduled'`. `learning_mode = 'self_paced'` requires `attendance_enabled = false`. | DB: CHECK on course |
| C2 | Intake rule on enrolment: class has no intake. Scheduled program requires an intake. Self-paced program has no intake. | DB: trigger on enrollment (needs course kind) |
| C3 | An enrolment's intake must belong to the enrolment's course. | DB: composite FK `(intake_id, course_id)` |
| C4 | A student has at most one active enrolment per (course, intake). | DB: partial unique index on `(student_id, course_id, coalesce(intake_id))` where status = 'active' |
| C5 | Active enrolments cannot exceed intake capacity (or course capacity when no intake). | TX with row lock on the intake or course |
| C6 | For classes, the student's grade on the enrolment date must be in `course_grade_level`. An admin may override with a reason, which is audit-logged. | APP + audit |
| C7 | Dropping an enrolment sets `status = 'dropped'`, stops future recurring invoices, ends access immediately, and leaves existing invoices payable. No automatic refund. | TX |
| C8 | **Effective access** = `status IN ('active','completed')` AND `access_starts_on <= today` AND (`access_ends_on` is null OR `today < access_ends_on`) AND `access_status = 'active'`. The end date is exclusive, as in the date convention. | APP (one `hasAccess()` helper) |
| C9 | `access_status = 'restricted'` is a billing overlay only. It is set when any invoice or installment is past its grace period and the overdue action includes restrict. It is cleared when no past-grace item remains unpaid. A partially paid overdue item keeps the restriction. | JOB (daily) + TX (re-check on every verified payment) |
| C10 | `lecturer_branch` must exist for the lecturer of any course in that branch. | TX |
| C11 | The class setup form creates one course per selected grade in one transaction, under one `course_group`. Each course gets its own fee structure and rate, schedule slots, capacity, delivery mode and lecturer assignment, and is independent afterwards. | TX |
| C12 | **Promotion target:** for each active enrolment, the target is the course in the same `course_group` for the student's next grade. A course with no group matches on same subject, branch, primary lecturer and batch label. Exactly one match gives a proposed move. No match or several matches flags the item `needs_review` for the admin. | APP |
| C13 | On confirm, a move ends the old enrolment (`status = completed`, `end_reason = promoted`, `access_ends_on` = the effective date, exclusive, so the old enrolment gives no access on that day) and creates the new enrolment with `promoted_from_enrollment_id` set, the target class's default fee option, and access from the effective date. Existing invoices are untouched and stay payable. | TX |
| C14 | No double billing in the move month: the old enrolment's last billed period ends on or before the effective date, and the new one starts on it. The effective date defaults to the first day of the next billing month and cannot fall inside a period already invoiced for the old enrolment. | TX |
| C15 | Moves obey capacity (C5). If the target class is full, the item is flagged `needs_review` and not moved automatically. | TX with row lock on the target course |

## D. Fees and invoicing

| # | Rule | Enforced |
|---|---|---|
| D1 | Fees are set on the class: each course has its own fee structure(s) (monthly, one-time package with optional access duration, or one-time with installment plans) and at most one default. Enrolling attaches the default automatically and sets `enrollment.fee_structure_id`. Staff choose only when the course has several options and none is default. A course with no structure is free and creates no fee invoices. Billing never searches for matching structures. | DB: partial unique index on `fee_structure(course_id)` where `is_default` and `is_active`; APP |
| D2 | The enrolment's fee structure must belong to the enrolment's course (and that intake, if set) and the course's branch. | TX |
| D3 | General fees (admission, materials) are fee structures with no course and are added to a student explicitly. | APP |
| D4 | A recurring structure requires `frequency`. A package structure has none. | DB: CHECK |
| D5 | Rates for one structure and grade never overlap in effective dates. A null grade counts as its own key. | DB: exclusion constraint |
| D6 | Rate lookup: the grade is `enrollment.billing_grade_level_id` if set, otherwise the student's grade on `period_start` (or the enrolment date for packages). Use the rate for that grade effective on that date. If none, use the null-grade rate. If still none, invoice generation fails for that enrolment and an admin is alerted. Never zero. | APP |
| D7 | Recurring generation is idempotent: one recurring fee item per (enrollment, period_start). | DB: partial unique index on `invoice_item(enrollment_id, period_start)` where kind = 'recurring_fee' and `cancelled_at` is null |
| D8 | Item amounts are signed: fee and content items are positive, discount items are negative, adjustments can be either. `total` = sum of all item amounts. `discount_total` = minus the sum of discount items (a positive number). `subtotal` = `total` + `discount_total`, so `total = subtotal − discount_total` and a discount is counted once. Issued invoices change only by adding adjustment or discount items. Existing items are never edited or removed (D26). | TX + DB: CHECK on `invoice_item` (fee and content kinds > 0, discount kind < 0) |
| D9 | `discount_total <= subtotal`, so `total >= 0`. A total of zero is allowed only with status `waived`. | DB: CHECK |
| D10 | Installment amounts sum to the invoice total. `(invoice_id, seq)` is unique. | TX + DB unique |
| D11 | The installment option is chosen at issue time. Changing it means cancelling and reissuing. | APP |
| D12 | Only an enrolment whose fee structure is a one-time package gets one invoice at enrolment. A free enrolment (no fee structure) or a recurring one never gets it. For packages, `access_ends_on` = start + duration (exclusive: 3 months from 1 March ends on 1 June), or null (lifetime) when no duration is set. | TX |
| D13 | Invoice branch = the course's branch (fee items) or the content purchase's `branch_id` (content items). A content purchase's branch is chosen when buying and must be a branch the content item is listed in. | TX |
| D14 | The billing type (monthly or one-time) of a fee structure used by active enrolments cannot change. Add a new option instead. Amount changes use new `fee_rate` rows with an effective date and never touch issued invoices. | TX |
| D15 | Fee exceptions exist only while the `fee_exceptions` module is on. Creating, changing or ending one requires the `fees.override` permission (root admin by default). | APP (`requireModule` plus `authorize`) |
| D16 | Two kinds: `alternate_option` (the enrolment uses another fee structure of the same course) and `discount` (percent or fixed amount off). Columns are required or null according to the kind. | DB: CHECK by kind |
| D17 | Every exception has `effective_from`, an optional `effective_to` (null = until ended) and a non-empty reason. It affects only invoices whose billing period starts on or after `effective_from`. Issued invoices never change. | DB: CHECK (reason) + TX |
| D18 | An enrolment has at most one active exception of each kind on any date. | DB: exclusion constraint on `(enrollment_id, kind, daterange)` (`btree_gist`) |
| D19 | A discount appears on the invoice as its own `invoice_item` of kind `discount`, stored as a negative amount (D8), linked by `fee_exception_id` and, through `applies_to_item_id`, to the fee item it reduces (D23), so list price and discount are both visible. Percent is between 0 and 100, fixed is at least 0, and the discount cannot exceed the item amount. 100 percent gives a zero total, allowed only with status `waived` (D9). | TX + DB: CHECK |
| D20 | For `alternate_option`, the chosen structure must belong to the same course and be active. `enrollment.fee_structure_id` always stays the original option chosen at enrolment and is never rewritten. Billing resolves the active exception for the period start and uses its structure in its place. | TX |
| D21 | Ending an exception sets `effective_to` and `ended_by`. Exceptions are never deleted. | TX |
| D22 | Turning the module off blocks new exceptions only. Active exceptions keep applying to billing until they end, so prices do not change silently. | APP |
| D23 | **Payable items and net amount.** Payable items are fee, content and positive adjustment items. Every discount item and negative adjustment must reference `applies_to_item_id`, a payable item on the same invoice. An item's net amount = its amount + the sum of items that apply to it, and is never negative. | DB: CHECK (discount kinds require `applies_to_item_id`) + composite FK `(applies_to_item_id, invoice_id)` + TX |
| D24 | **One branch per invoice.** All items on an invoice belong to the invoice's branch (D13). The billing job groups a student's items by branch and due date, so payment, bank account and receipt always have one clear branch. | TX |
| D25 | **Installments follow the invoice.** Installment amounts sum to the invoice total. When an adjustment or discount item is added to an issued invoice that has installments, the unpaid installments are re-spread in the same transaction so the sum still equals the total. Paid installments never change, and a change that would push the total below the amount already paid is rejected. | TX |
| D26 | **Issued invoices are append-only.** Items are never edited or removed after issue. Corrections are new adjustment or discount items (D8, D23). An invoice with no active allocations may be cancelled: status `cancelled`, every item gets `cancelled_at`, and it can be reissued. An invoice with payments cannot be cancelled, only adjusted. A cancelled invoice accepts no allocations, is ignored by overdue checks and commissions, and does not block regenerating the recurring fee item (D7). | TX + DB: CHECK (allocation requires non-cancelled invoice via TX) |

## E. Payments, receipts and reversals

| # | Rule | Enforced |
|---|---|---|
| E1 | `payment_allocation` is the financial truth. `invoice.amount_paid`, invoice status and installment status are caches updated in the same transaction as any allocation change. | TX |
| E2 | A nightly reconciliation compares each cache with the sum of active allocations and reports differences. | JOB |
| E3 | Verification and allocation are one atomic operation. In one transaction: lock the payment row, insert the allocation lines chosen by the verifier, run the checks in E4 and E5, then set status `verified`. Allocation rows exist only for verified payments (and are reversed, never deleted, on void). A deferred constraint trigger rejects any commit where a verified payment's active allocations do not sum to its amount, or an allocation exists for a payment that is not verified. Gateway and cash verification use the same operation. | TX + DB: deferred constraint trigger |
| E4 | No advance payments: a payment can only be verified when its active allocations sum to exactly its amount. The verifier must fix the amount, add invoices, or reject. | TX with row lock on the payment |
| E5 | An allocation cannot exceed its item's net outstanding amount (D23), and a payment's allocations to one invoice cannot exceed the invoice's outstanding amount. | TX with row lock on the invoice |
| E6 | Payment, invoice and allocation belong to the same student. | DB: composite FKs using `student_id` on all three |
| E7 | Every allocation carries `invoice_item_id`, and the item must belong to the allocation's invoice. One payment may cover several invoices, provided they all belong to the payment's student and branch (E6, E15, D24). The student or verifier selects the invoices. The default split fills them oldest due date first, and within an invoice the money is split across payable items pro rata to each item's net outstanding amount (largest-remainder rounding to the cent). Money left over after every selected invoice is paid cannot be allocated, so the payment cannot be verified (E4). The verifier can adjust the split before verifying. Installments are never allocated to directly. | DB: composite FK `(invoice_item_id, invoice_id)` + APP |
| E8 | Status moves: `pending_verification` → `verified` or `rejected`, and `verified` → `voided`. Only users with the matching permission can move it. Verified payments are otherwise immutable. | TX + APP |
| E9 | **Void:** requires a reason. In one transaction: mark allocations reversed (never delete), recompute invoice and installment caches, void commission entries, void the receipt, re-evaluate access, and write the audit log. | TX |
| E10 | The same bank reference cannot be used twice on one bank account unless the earlier payment was rejected. | DB: partial unique index `(bank_account_id, reference_no)` |
| E11 | Cash is created by staff with the record-cash permission, already `verified`, and issues a receipt immediately. | TX |
| E12 | A verified payment has exactly one active receipt. Voiding keeps the old row (`status = 'void'`) and may set `replaced_by_receipt_id` on reissue. | DB: partial unique index on `payment_id` where status = 'issued' |
| E13 | Receipt numbers come from a per-branch counter taken inside the issuing transaction. `(branch_id, receipt_no)` is unique. | DB unique + TX |
| E14 | A gateway callback is idempotent on the provider reference. | DB: unique `(provider, provider_ref)` |
| E15 | Payment branch = the bank account's branch (online) or the recording staff member's branch (cash). It must match the invoices it is allocated to. | TX |
| E16 | **Installment balances are derived.** The invoice's total active allocated amount is applied to its installments in `seq` order (a waterfall). `invoice_installment.amount_paid` and status are caches of that, re-derived in the same transaction as any allocation, void or item change, and checked by the nightly reconciliation. An invoice-level payment needs no installment named, and paying more than the current installment spills into the next. | TX + JOB |

## F. Content

| # | Rule | Enforced |
|---|---|---|
| F1 | Kind rules: `recording` has `external_url` and no file. `file` has a file. `physical_book` has neither. | DB: CHECK |
| F2 | `access_type = 'paid'` requires a positive price. | DB: CHECK |
| F3 | Student can open an item if (a) it is in a course they effectively have access to, or (b) it is `free_registered` and listed in a branch the student belongs to, or (c) they have a `paid` purchase. | APP (one `canViewContent()` helper) |
| F4 | One paid purchase grants permanent access. A pending purchase grants none. | APP |
| F5 | A student cannot have two pending or paid purchases of the same item. | DB: partial unique index on `(content_id, student_id)` where status in ('pending','paid') |
| F6 | Physical items: payment and handover are separate events. `handed_over_at` requires status `paid` and records `handed_over_by`. | TX |

## G. Exams

| # | Rule | Enforced |
|---|---|---|
| G1 | A student is eligible if they have effective access (C8) in at least one course the exam is attached to. | APP |
| G2 | The attempt limit applies per (exam, student) across all attached courses. | DB unique `(exam_id, student_id, attempt_no)` + TX count check |
| G3 | Each attempt records the enrolment through which the exam was reached, for branch and course reporting. | DB: FK |
| G4 | Publishing an exam copies each question and its options (with the correct flags) into `exam_question.snapshot`. A published exam's questions are immutable. Question-bank edits never change past or running exams. | TX |
| G5 | Answers store the selected option key from the snapshot. Auto-grading uses only the snapshot. | APP |
| G6 | Time limits and open/close windows are enforced with server time. | APP |
| G7 | `exam_result` is a calculated summary, unique per (exam, student). An `online_mcq` exam gets results only from attempts (`source = attempt`), recomputed after each submitted attempt using `attempt_scoring` while the result is not yet released. A `paper` exam gets results only by manual entry (`source = manual`). The two never mix on one exam. | DB unique + CHECK on source vs exam mode + TX |
| G8 | `released_at` is the final release and can be set only after the exam is closed (`closes_at` passed or status `closed`), when no attempt can change the result any more, so automatic recomputation never touches a released result. Before release, an `immediate` visibility exam shows the student a provisional score. After release, any change requires a reason, is audit-logged, and for an online exam sets `source = manual_override`, which stops any further automatic recompute. | TX + audit |
| G9 | `results_visibility` decides when students and parents can see results. | APP |

## H. Commissions

| # | Rule | Enforced |
|---|---|---|
| H1 | **Definition:** `commission_rate` is what the institute keeps (a percent of the base, or a fixed amount per student per month). `teacher_amount` = base − `commission_amount`. | schema naming + APP |
| H2 | **Base** = basis-adjusted amount × the lecturer's `share_percent` ÷ 100, where the basis-adjusted amount follows `discount_commission_basis` (H10): under `paid` it is the allocated amount, under `list` it is the allocated amount scaled to the item's list price. This is the `base_amount` stored on the entry. Each co-teacher gets their own entry. | TX |
| H3 | `share_percent` is between 0 and 100, and a course's shares sum to 100. | DB: CHECK + TX on save |
| H4 | **Rule choice:** the most specific effective rule wins: course, then subject plus grade, then subject, then lecturer default. Equal specificity with overlapping dates is not allowed. | DB: exclusion constraint on (lecturer, subject, grade, course, date range), COALESCE for nulls |
| H5 | Percent: commission = base × rate ÷ 100, where base already includes the lecturer's share (H2). Fixed per student month: the amount is per course, per student, per month, and each co-teacher's entry takes their share: commission = fixed amount × `share_percent` ÷ 100 × (allocation amount ÷ item net amount). Partial payments accrue proportionally, and across all payments of an item each lecturer's total never exceeds fixed amount × share. With equal rules and shares summing to 100, the course total equals one fixed amount. | TX |
| H6 | Each entry snapshots the rule used, calc type, rate, and share percent. Later rule edits never change past earnings. | DB columns |
| H7 | Voiding a payment: unsettled entries become `void`. Settled entries get a new negative `reversal` entry (`reverses_entry_id`) that is deducted in the next payout. | TX |
| H8 | A payout includes only accrued entries for its lecturer and period and marks them `settled`. A paid payout is immutable. A negative net carries forward to the next payout. | TX |
| H9 | When the commissions module is off, no entries accrue and no payouts can be created. | APP |
| H11 | **Commission basis link:** a commission entry traces `payment_allocation` → `invoice_item` → `enrollment` → course. The lecturers and shares come from `course_lecturer` of that course, the subject from the course, and the grade from `invoice_item.grade_level_id` (the grade used for the rate). Rule matching (H4) uses exactly these. Only fee items (`recurring_fee`, `package_fee`) accrue commission. Content and adjustment items accrue none, and discount items only reduce the net amount of the item they apply to. | TX |
| H12 | **Commission cap.** For an accrual entry, `commission_amount` is limited to between 0 and `base_amount`, and `teacher_amount` = `base_amount` − `commission_amount`, so `teacher_amount` is never negative. When the calculated commission exceeds the base, the entry is capped and `capped = true`. Percent rates are between 0 and 100 and fixed amounts are at least 0. The base is the commission base, not the cash collected: under the `paid` basis they are the same, but under the `list` basis the institute can end up with less cash than the teacher is owed on a discounted item, by design. Creating a fixed rule larger than the lowest fee of its course shows a warning. Reversal entries are the exact negatives of the entries they reverse. | DB: CHECK on accrual entries + TX |
| H10 | Discounted fees follow `organization.discount_commission_basis`. With `paid` (default) the base is the money actually allocated to the item. With `list` the basis-adjusted amount is the allocation scaled to the list price (allocation × list amount ÷ net amount), so the institute absorbs the discount. Either way, the stored base is that amount × the lecturer's share (H2). The basis is snapshotted on each entry (`basis_applied`). A free place accrues no commission, since nothing is paid. | APP + snapshot column |

## I. Branch ownership

| # | Rule | Enforced |
|---|---|---|
| I1 | `branch_id` is stored on course, fee structure, bank account, invoice, payment and receipt. Sessions, attendance and enrolments inherit the course's branch. | DB columns |
| I2 | Branch-scoped staff can read and write only rows in their assigned branches. A null assignment means all branches. Applied in one query layer. Consider Postgres row-level security later. | APP |
| I3 | Cross-branch and cross-student consistency is checked in the transaction, because foreign keys alone cannot enforce it: a payment cannot settle another branch's or another student's invoice; a lecturer must work in the course's branch; a student must belong to the enrolment's branch; a content purchase's invoice branch must match a branch the content is listed in; an exam attempt's enrolment must belong to the same student and to a course the exam is attached to; a promotion item's source and target enrolments belong to the same student, and the target course has the same subject, so the student gets a `student_branch` row for the target branch (B7). | TX |

## J. Notifications and audit

| # | Rule | Enforced |
|---|---|---|
| J1 | In-app notifications are always available. Disabled external channels (email, SMS, push) create no notification rows and no send attempts. | APP |
| J2 | A notification is unique per (user, event key, channel) to prevent duplicate sends on retries. | DB: unique index |
| J3 | These actions write an `audit_log` row in the same transaction: payment verify, reject and void, receipt issue and void, promotion, access restrict and restore, role changes, fee rate changes, fee exception create, change and end, default fee option changes, grade eligibility override, result edits after release, payout approve and pay. | TX |
| J4 | `audit_log` is append-only. The application database role has no update or delete rights on it. | DB: permissions or trigger |

## K. Module switches as capability gates

A hidden menu is not enough. Each module is enforced with one server-side `requireModule(name)` guard, called in every route, server action, job and notification dispatch that belongs to it. Data is kept when a module is turned off but becomes unreachable.

| Module | Gated routes and actions | Jobs | Notifications | Notes |
|---|---|---|---|---|
| parent_portal | Guardian login and all guardian routes | none | Guardian-targeted sends skipped | Guardians still stored |
| lecturer_portal | Lecturer login and routes, role assignment | none | none | Lecturer rows always allowed |
| online_exams | Question bank, attempts, grading | none | exam_published | Paper results always available |
| content_store | Paid content, purchases, physical sales | none | content events | Recordings and free notes stay core |
| commissions | Rules, payouts, entry views | Accrual | none | No accrual when off |
| fee_exceptions | Create, change and end exceptions; exception report | none (billing still honours active exceptions) | none | Needs `fees.override`. Data kept when off |
| qr_attendance | QR token issue and scan endpoint | none | none | Manual attendance stays |
| gateway | Gateway checkout and webhook | none | none | Bank transfer is always on |
| email, sms, web_push | Subscription endpoints | Dispatcher skips channel | Skipped, no rows created | In-app unaffected |

Add one automated test per module: with the flag off, every gated route returns 403 and every job skips.

## L. Tenancy

The single-customer deployment is a deliberate choice, protected by A2. If you ever host several customers in one database, treat it as a migration project, not a column addition: `organization_id` on every table, unique constraints and foreign keys that include it, tenant-scoped queries and jobs, and row-level security or equivalent.

## Confirmed in discussion

1. **Fees are set on the class** (D1). The admin creates the class, picks the teacher and fee type, and the fee is attached automatically at enrolment. This replaces the earlier idea of staff choosing a fee structure.
2. **One class per grade**, created together from one form (C11), because fee, duration and schedule differ by grade.
3. **Promotion moves students into the next grade's class** with admin review before confirming (B6, C12 to C14).
4. **Fee exceptions are built now** as an optional module per buyer (D15 to D22).

## Accepted v1 defaults

These were recorded as judgment calls during the reviews and are accepted for design v1.0. After the freeze, changing any of them is a migration plus a changelog entry (see Change control).

1. **Fixed commission accrues proportionally (H5)** instead of once when an invoice is fully paid. It handles partial payments and reversals cleanly.
2. **Completed enrolments keep access (C8)** while the date window allows it, so self-paced programs and finished intakes can keep lifetime access.
3. **Grade eligibility can be overridden by an admin (C6)** with a reason, because real institutes let students attend a different grade's class.
4. **Audit log is phase 1**, not later.
5. **Commission on discounted fees defaults to the amount paid (H10)**, with a setting for the institute to absorb the discount instead.
6. **Promotion effective date defaults to the first day of the next billing month (C14)**, so no month is billed twice.
7. **Active fee exceptions keep applying when the module is switched off (D22)**, so turning it off never changes a student's price silently.
8. **End-exclusive dates everywhere** (date convention at the top), so a promotion or package expiry never gives access through two enrolments on one day.
9. **A `stay` decision pins the billing grade (B8)**, so the fee stays the same until the admin clears it. The alternative is billing at the new grade, which would fail wherever a per-grade class has no rate for it.
10. **Fixed commission is per course and split by share (H5)**, so two co-teachers do not each take the full fixed amount.
11. **Online exam results are released only after the exam closes (G8)**, with a provisional score shown before that if visibility is immediate.
12. **Commission applies to fee items only (H11).** Content sales accrue none. It can be added later with its own rule type.
13. **Installments are paid in order (E16).** Paying a later installment first is not supported, and extra money spills forward.
14. **An invoice payment is split across items pro rata (E7)**, with the verifier able to adjust the split.
15. **Issued invoices are append-only (D26).** Corrections are new items, and an unpaid invoice can be cancelled and reissued.
16. **Commission is capped at its base (H12).** `teacher_amount` is never negative, and the institute may fund the difference under the `list` basis.
17. **One payment may cover several invoices** of the same student and branch (E7).

## Change control after the freeze

- Schema changes are migrations only, written backward-compatible (add first, remove later) so a customer on the previous app version keeps working during a rollout.
- Every change that alters a rule in this file gets a dated changelog entry at the bottom of this file, naming the rule and the migration.
- Changes to money rules (sections D, E and H) also need a reconciliation check or test that proves old data still balances.
- New optional features are added as new modules behind `enabled_modules`, not as changes to existing rules.

## Changelog

- 2026-11-10: Design v1.0 frozen. Before the freeze, H2, H10 and the ERD `base_amount` description were aligned so the commission base is the basis-adjusted amount × the lecturer's share.
- 2026-11-11: Phase 2 schema built in `packages/db` (installments, fee exceptions, notifications, push, messaging). No rule changes. Implementation additions: `notification.event_key`/`read_at`, `message_thread.created_by`, `fee_exception.course_id`.
- 2026-11-11: Phase 3 schema built in `packages/db` (exams, questions, attempts, results). No rule changes. Implementation additions: `enrollment` unique `(id, student_id, course_id)`, `exam_attempt.course_id`, `exam_attempt` and `attempt_answer` carry `exam_id` and `exam_result` carries `course_id` for composite foreign keys, `exam_result.updated_at`, one running attempt per exam and student, exam status order enforced by trigger.
- 2026-11-11: Phase 4 schema built in `packages/db` (content purchases, commission rules and entries, teacher payouts). No rule changes. Implementation additions: `invoice` unique `(id, branch_id)`, `commission_rule` scope shapes (a grade needs a subject, a course rule is a course alone), `teacher_payout.created_at`, `commission_entry.created_at`, payout net never negative, triggers for payout status order and entry history, paid-item-only purchases, and one active content line per purchase.
- 2026-11-11: Phase 5 schema built in `packages/db` (`gateway_transaction`). No rule changes. Implementation additions: `created_at` and `updated_at`, status values initiated, succeeded, failed, cancelled, a succeeded transaction needs its provider reference, trigger keeping transactions to gateway payments. All five build phases are complete.
- 2026-11-12: Service layer extended in `packages/db/src/services` (enrolment, recurring invoice generation, package invoices with installments, invoice adjustments and cancellation, fee exceptions). No rule changes. Implementation choices: calendar-month periods without proration, per-term fees use the course's term, rate failures are reported and never billed as zero, cash payment dates use the organization time zone.
