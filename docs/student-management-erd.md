# Student Management System: ER Diagram (design v1.0, frozen, full scope)

## Core idea

One schema serves both products and both kinds of teaching.

- **Solo teacher** = an `organization` with `type = 'individual'`, one auto-created branch, and the teacher as `root_admin` (owner). The lecturer portal is off. The teacher still has a `lecturer` row so they can be assigned to courses.
- **Institution** = an `organization` with many `branch` rows, many lecturers, and staff with different roles and permissions.
- **Teaching style is a property of the course, not the person.** A course has `kind = 'class'` (recurring monthly, grade-based, school-subject style) or `kind = 'program'` (one-time or intake-based, special courses like photography or sewing). Any teacher, solo or in an institution, can run both.
- Optional modules are switched on per organization through `organization.enabled_modules`: parent_portal, lecturer_portal, online_exams, content_store, commissions, fee_exceptions, qr_attendance, gateway, email, sms, web_push.

Each customer gets a separate deployment and database, so there is exactly one `organization` row and I skip `organization_id` on other tables. If you ever host many customers in one database, add it everywhere.

## What changed at the v1.0 freeze

The design is frozen as v1.0 after the fourth team review. Later changes go through migrations and the changelog rule at the end of `student-management-invariants.md`.

1. **Issued invoices are append-only.** Items are never edited or removed. Corrections are new adjustment or discount items. An unpaid invoice can be cancelled and reissued (`invoice.status = cancelled`, `invoice_item.cancelled_at`).
2. **Commission is capped at its base.** Commission can never exceed the base it is calculated on, so `teacher_amount` is never negative. `commission_entry.capped` flags the cases where the cap applied. With the `list` discount basis, the institute can still end up with less cash than the teacher is owed on a discounted item, by design.
3. **One payment may cover several invoices** of the same student and branch. Allocation lines are per invoice item.
4. **Recorded assumptions are accepted as v1.0 defaults.**

## What changed in v9

Changes from the third team review. Rules are in `student-management-invariants.md`.

1. **Payments are allocated to invoice items.** `payment_allocation` now points at the `invoice_item` it pays (with the invoice kept for integrity checks). A commission entry therefore traces from allocation to item to enrolment, course, lecturer, subject and grade, with no ambiguity. Discount and negative adjustment items carry `applies_to_item_id`, so every payable item has a clear net amount.
2. **Installments are derived, not allocated.** Money is allocated to items. Installment balances come from applying the invoice's paid amount to installments in order (a waterfall), so invoice and installment totals cannot disagree. An invoice-level payment needs no installment named.
3. **Content purchases have a branch.** `content_purchase.branch_id` records the branch chosen at purchase, and the invoice, bank account and receipt follow it. An invoice holds items of one branch only.
4. **Clearing a pinned billing grade is validated.** The admin can clear it only when the class has a rate for the student's grade from the clear date. Otherwise they first add the rate, give a fee exception, or move the student.

## What changed in v8

Changes from the second team review. Rules are in `student-management-invariants.md`.

1. **Promotion works per class enrolment.** A student in three subjects has three `promotion_item` rows. A `stay` decision pins the billing grade on that enrolment (`enrollment.billing_grade_level_id`), so its rate does not jump when the student's grade changes.
2. **Invoice signs are defined.** Items are signed amounts: charges positive, discounts negative. `total` is the sum of all items, `discount_total` is the positive discount amount, and `subtotal` is the total before discounts, so a discount is counted once.
3. **Fixed commissions respect co-teacher shares.** A fixed commission is per course per student per month, and each co-teacher's entry takes their share of it.
4. **One date convention.** Ranges are start-inclusive and end-exclusive. `access_ends_on`, `to_date`, `effective_to` and `period_end` hold the first day outside the range, so a promotion never gives access through two enrolments on the same day.
5. **Verification and allocation are one atomic step**, guarded by a deferred constraint.
6. **Smaller clarifications:** the package invoice applies only to package fee structures, `enrollment.fee_structure_id` is never rewritten by a fee exception, online exam results are released only after the exam closes, and cross-branch checks cover content purchases, exam attempts and promotion moves.

## What changed in v7

Changes from design discussion after the v6 review.

1. **One class per grade.** A teacher teaching one subject across Grades 6 to 11 gets one class (`course`) per grade, created together from a single form and tied by `course_group`. Each class has its own fee, schedule, duration, capacity, attendance, content and exams.
2. **Fees are set on the class.** The class form defines the fee: monthly, one-time (with optional access duration), or one-time with installment plans. `fee_structure.is_default` marks the class's default option, and enrolling attaches it automatically. Staff pick only when a class offers several options.
3. **Promotion moves enrolments.** `promotion_run` is now a draft, review, confirm flow with `promotion_item` rows. Confirming moves each student from the old grade's class to the next grade's class (`enrollment.promoted_from_enrollment_id`, `end_reason`). Old invoices are untouched.
4. **Fee exceptions (optional module).** `fee_exception` lets staff with the `fees.override` permission give one student another fee option of the same class, or a discount, with a required reason and audit trail. Module flag `fee_exceptions`. Commission on discounted fees follows `organization.discount_commission_basis`.

## What changed in v6

Changes from a team review of v5. Rules and their enforcement level (database, transaction, application) are in `student-management-invariants.md`.

1. **Invoice items.** `invoice_item` holds fee, content, adjustment and discount lines. The invoice is a header with totals. Recurring-fee uniqueness moves to `(enrollment_id, period_start)` on recurring items.
2. **Allocation is the financial truth.** `invoice.amount_paid` and status are caches. Allocations carry `student_id` so composite foreign keys tie payment, invoice and installment together. Payments can be `voided`, allocations are reversed (never deleted), and receipts can be voided and replaced.
3. **Exam history is frozen.** `exam_question.snapshot` stores the question and options at publish time. Answers refer to snapshot option keys. Attempts and results record the enrolment used.
4. **Commission meaning.** `commission_rate` is what the institute keeps. Entries snapshot the rule inputs, and reversals are new negative entries.
5. **Identity.** `user.user_type` is removed. One user can be staff, lecturer, student or guardian through role and profile rows. `portal_enabled` flags control login without deleting records. A built-in `lecturer` role is added.
6. **Access.** `enrollment.status` is lifecycle only, `access_status` is a billing overlay (`active | restricted`), and the date window is the time entitlement. Effective access combines all three.
7. **Audit log** moves into phase 1.
8. **Branch ownership.** `branch_id` on invoices and payments.

## What changed in v5

1. **Course kinds:** `course.kind` (`class | program`), `learning_mode` (`scheduled | self_paced`), and `attendance_enabled`. Self-paced online programs have attendance off and store only the enrollment start date.
2. **Intakes:** `intake` is a batch of a program with start date, capacity and its own schedule, sessions and price.
3. **Lifetime access:** `enrollment.access_ends_on` empty means lifetime. Time-limited access still works.
4. **Content library:** `content_item` covers YouTube recordings, notes, books and physical items. `course_section` and `course_content` give programs an ordered lesson structure. `content_branch` scopes library items to branches. `content_purchase` handles paid items through the normal invoice, slip and receipt flow.
5. **Online MCQ exams:** `question`, `question_option`, `exam_question`, `exam_attempt`, `attempt_answer`. Paper exams still use manual `exam_result` entry. An exam attaches to courses through `exam_course`, so branch-specific or shared across branches is just which courses it is attached to.
6. **Roles and permissions:** `role`, `permission`, `role_permission` replace the fixed role list. Four built-in roles ship by default and custom roles can come later.
7. **Commissions:** `commission_rule`, `commission_entry`, `teacher_payout`. The institute collects all fees, accrues commission per verified payment, and pays teachers the net per period.
8. **Students and guardians:** school, NIC, optional contact fields, date of birth. A configurable age threshold makes guardian details compulsory for younger students.
9. **Promotion:** `promotion_run` records each bulk promotion done by an admin. `course.batch_label` supports exam-year batches like "2027 A/L".
10. **QR attendance:** `student.qr_token` (a student QR card scanned by an attendance marker) and `attendance.marked_via`.
11. **Web push:** `push_subscription`, plus `push` as a notification channel and new events (attendance marked, payment approved, exam published).

## Diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ BRANCH : has
    ORGANIZATION ||--o{ ACADEMIC_TERM : defines
    ORGANIZATION ||--o{ SUBJECT : offers
    ORGANIZATION ||--o{ GRADE_LEVEL : defines
    ORGANIZATION ||--o{ USER : owns
    ORGANIZATION ||--o{ ROLE : defines
    ORGANIZATION ||--o{ PAYMENT_METHOD : configures
    ORGANIZATION ||--o{ NOTIFICATION_CHANNEL : configures
    ORGANIZATION ||--o{ NOTIFICATION_TEMPLATE : defines

    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : included_in
    USER ||--o{ STAFF_ROLE_ASSIGNMENT : granted
    ROLE ||--o{ STAFF_ROLE_ASSIGNMENT : assigned_as
    BRANCH |o--o{ STAFF_ROLE_ASSIGNMENT : scopes

    USER ||--o| LECTURER : is
    USER ||--o| STUDENT : is
    USER ||--o| GUARDIAN : is

    LECTURER ||--o{ LECTURER_BRANCH : works_at
    BRANCH ||--o{ LECTURER_BRANCH : employs

    STUDENT ||--o{ STUDENT_BRANCH : belongs_to
    BRANCH ||--o{ STUDENT_BRANCH : admits
    STUDENT ||--o{ STUDENT_GUARDIAN : has
    GUARDIAN ||--o{ STUDENT_GUARDIAN : responsible_for

    STUDENT ||--o{ STUDENT_LEVEL : progresses
    GRADE_LEVEL ||--o{ STUDENT_LEVEL : placed_in
    PROMOTION_RUN |o--o{ STUDENT_LEVEL : created
    USER ||--o{ PROMOTION_RUN : performed_by

    SUBJECT ||--o{ COURSE : taught_as
    ACADEMIC_TERM |o--o{ COURSE : runs_in
    BRANCH ||--o{ COURSE : hosts
    COURSE ||--o{ COURSE_GRADE_LEVEL : open_to
    GRADE_LEVEL ||--o{ COURSE_GRADE_LEVEL : includes
    COURSE ||--o{ COURSE_LECTURER : taught_by
    LECTURER ||--o{ COURSE_LECTURER : teaches
    COURSE ||--o{ INTAKE : runs_as
    BRANCH ||--o{ COURSE_GROUP : hosts
    SUBJECT ||--o{ COURSE_GROUP : taught_as
    COURSE_GROUP ||--o{ COURSE : groups

    COURSE ||--o{ ENROLLMENT : has
    STUDENT ||--o{ ENROLLMENT : joins
    INTAKE |o--o{ ENROLLMENT : part_of
    FEE_STRUCTURE |o--o{ ENROLLMENT : priced_by
    ENROLLMENT |o--o| ENROLLMENT : promoted_from
    ENROLLMENT ||--o{ FEE_EXCEPTION : has
    FEE_STRUCTURE |o--o{ FEE_EXCEPTION : alternate_option
    USER ||--o{ FEE_EXCEPTION : created_by
    FEE_EXCEPTION |o--o{ INVOICE_ITEM : discount_line
    PROMOTION_RUN ||--o{ PROMOTION_ITEM : proposes
    STUDENT ||--o{ PROMOTION_ITEM : moved
    ENROLLMENT |o--o{ PROMOTION_ITEM : from_enrollment
    COURSE |o--o{ PROMOTION_ITEM : target_course

    COURSE ||--o{ SCHEDULE_SLOT : recurs
    INTAKE |o--o{ SCHEDULE_SLOT : for_intake
    COURSE ||--o{ CLASS_SESSION : held_as
    INTAKE |o--o{ CLASS_SESSION : for_intake
    CLASS_SESSION ||--o{ ATTENDANCE : records
    STUDENT ||--o{ ATTENDANCE : marked

    LECTURER ||--o{ CONTENT_ITEM : owns
    FILE |o--o{ CONTENT_ITEM : stored_as
    CONTENT_ITEM ||--o{ CONTENT_BRANCH : visible_in
    BRANCH ||--o{ CONTENT_BRANCH : lists
    COURSE ||--o{ COURSE_SECTION : organised_into
    COURSE ||--o{ COURSE_CONTENT : includes
    COURSE_SECTION |o--o{ COURSE_CONTENT : groups
    CONTENT_ITEM ||--o{ COURSE_CONTENT : used_in
    CONTENT_ITEM ||--o{ CONTENT_PURCHASE : sold_as
    STUDENT ||--o{ CONTENT_PURCHASE : buys
    BRANCH ||--o{ CONTENT_PURCHASE : sold_at
    INVOICE |o--o{ CONTENT_PURCHASE : billed_by

    LECTURER ||--o{ EXAM : authors
    EXAM ||--o{ EXAM_COURSE : given_in
    COURSE ||--o{ EXAM_COURSE : has_exam
    LECTURER ||--o{ QUESTION : writes
    QUESTION ||--o{ QUESTION_OPTION : offers
    EXAM ||--o{ EXAM_QUESTION : contains
    QUESTION ||--o{ EXAM_QUESTION : used_in
    EXAM ||--o{ EXAM_ATTEMPT : attempted
    STUDENT ||--o{ EXAM_ATTEMPT : takes
    EXAM_ATTEMPT ||--o{ ATTEMPT_ANSWER : answers
    EXAM_QUESTION ||--o{ ATTEMPT_ANSWER : for_question
    ENROLLMENT |o--o{ EXAM_ATTEMPT : reached_via
    ENROLLMENT |o--o{ EXAM_RESULT : recorded_for
    EXAM ||--o{ EXAM_RESULT : produces
    STUDENT ||--o{ EXAM_RESULT : scores
    EXAM_ATTEMPT |o--o| EXAM_RESULT : counted_for

    BRANCH ||--o{ FEE_STRUCTURE : defines
    COURSE |o--o{ FEE_STRUCTURE : prices
    INTAKE |o--o{ FEE_STRUCTURE : priced_for
    FEE_STRUCTURE ||--o{ FEE_RATE : has
    GRADE_LEVEL |o--o{ FEE_RATE : rate_for
    FEE_STRUCTURE ||--o{ INSTALLMENT_OPTION : offers

    BRANCH ||--o{ INVOICE : issued_by
    STUDENT ||--o{ INVOICE : owes
    INVOICE ||--o{ INVOICE_ITEM : itemised_as
    ENROLLMENT |o--o{ INVOICE_ITEM : billed_for
    FEE_STRUCTURE |o--o{ INVOICE_ITEM : priced_by
    GRADE_LEVEL |o--o{ INVOICE_ITEM : grade_used
    CONTENT_PURCHASE |o--o{ INVOICE_ITEM : charged_as
    INSTALLMENT_OPTION |o--o{ INVOICE : chosen_plan
    INVOICE ||--o{ INVOICE_INSTALLMENT : split_into

    BRANCH ||--o{ BANK_ACCOUNT : receives_in
    STUDENT ||--o{ PAYMENT : pays
    USER ||--o{ PAYMENT : submitted_by
    PAYMENT_METHOD ||--o{ PAYMENT : via
    BANK_ACCOUNT |o--o{ PAYMENT : paid_into
    PAYMENT ||--o{ PAYMENT_ALLOCATION : split_into
    INVOICE ||--o{ PAYMENT_ALLOCATION : settled_by
    INVOICE_ITEM ||--o{ PAYMENT_ALLOCATION : paid_by
    INVOICE_ITEM |o--o{ INVOICE_ITEM : applies_to
    FILE |o--o{ PAYMENT : slip_image
    USER |o--o{ PAYMENT : verified_by
    BRANCH ||--o{ PAYMENT : received_at
    PAYMENT ||--o| RECEIPT : issues
    BRANCH ||--o{ RECEIPT : numbered_in
    FILE |o--o{ RECEIPT : signed_pdf
    PAYMENT |o--o{ GATEWAY_TRANSACTION : online_attempt

    LECTURER ||--o{ COMMISSION_RULE : subject_to
    SUBJECT |o--o{ COMMISSION_RULE : narrowed_by
    GRADE_LEVEL |o--o{ COMMISSION_RULE : narrowed_by
    COURSE |o--o{ COMMISSION_RULE : narrowed_by
    PAYMENT_ALLOCATION ||--o{ COMMISSION_ENTRY : earns
    COMMISSION_RULE ||--o{ COMMISSION_ENTRY : applied
    LECTURER ||--o{ COMMISSION_ENTRY : charged_to
    TEACHER_PAYOUT |o--o{ COMMISSION_ENTRY : settles
    COMMISSION_ENTRY |o--o{ COMMISSION_ENTRY : reversed_by
    LECTURER ||--o{ TEACHER_PAYOUT : receives
    FILE |o--o{ TEACHER_PAYOUT : transfer_proof

    USER ||--o{ NOTICE : authors
    NOTICE ||--o{ NOTICE_TARGET : targets
    BRANCH |o--o{ NOTICE : scoped_to

    MESSAGE_THREAD ||--o{ THREAD_PARTICIPANT : includes
    USER ||--o{ THREAD_PARTICIPANT : joins
    MESSAGE_THREAD ||--o{ MESSAGE : contains
    USER ||--o{ MESSAGE : sends

    USER ||--o{ NOTIFICATION : receives
    NOTIFICATION_TEMPLATE |o--o{ NOTIFICATION : uses
    USER ||--o{ PUSH_SUBSCRIPTION : registers
    USER ||--o{ FILE : uploads
    USER |o--o{ AUDIT_LOG : acted

    ORGANIZATION {
        uuid id PK
        text name
        text type "individual | institution"
        jsonb enabled_modules "parent_portal, lecturer_portal, online_exams, content_store, commissions, fee_exceptions, qr_attendance, gateway, email, sms, web_push"
        text currency
        text timezone
        int guardian_required_below_age "guardian details compulsory under this age"
        text signing_key_ref "reference to key in secret store"
        int overdue_grace_days "default grace before action"
        text overdue_action "none | notify | restrict | notify_and_restrict"
        text discount_commission_basis "paid | list: commission on amount paid or on list price"
    }
    BRANCH {
        uuid id PK
        uuid organization_id FK
        text name
        text address
        text phone
        bool is_default
        bool is_active
    }
    USER {
        uuid id PK
        text email UK "login, nullable for young students"
        text username UK "alternative login e.g. student_no"
        text phone
        text password_hash
        text status "active | disabled"
        timestamptz last_login_at
    }
    ROLE {
        uuid id PK
        text name "root_admin, student_counselor, payment_handler, attendance_marker, lecturer"
        text description
        bool is_system "built-in, cannot be deleted"
    }
    PERMISSION {
        uuid id PK
        text code UK "payments.verify, attendance.mark, students.create"
        text description
    }
    ROLE_PERMISSION {
        uuid role_id FK
        uuid permission_id FK
    }
    STAFF_ROLE_ASSIGNMENT {
        uuid id PK
        uuid user_id FK
        uuid role_id FK
        uuid branch_id FK "null = all branches"
    }
    LECTURER {
        uuid id PK
        uuid user_id FK "nullable if portal disabled"
        text full_name
        text qualification
        bool portal_enabled "false = no login or lecturer role, record kept"
        text bio
    }
    LECTURER_BRANCH {
        uuid lecturer_id FK
        uuid branch_id FK
    }
    STUDENT {
        uuid id PK
        uuid user_id FK "nullable until portal invite"
        text student_no UK
        text full_name
        date date_of_birth "age is calculated"
        text gender
        text school_name
        text nic "optional"
        text contact_email "optional"
        text contact_phone "optional"
        text qr_token UK "for QR attendance card"
        text status "active | alumni | suspended"
    }
    STUDENT_BRANCH {
        uuid student_id FK
        uuid branch_id FK
        bool is_primary
        date joined_on
    }
    GRADE_LEVEL {
        uuid id PK
        text name "Grade 1 ... Grade 13"
        text stage "primary | junior | ordinary_level | advanced_level"
        int ordinal "for ordering and promotion"
    }
    PROMOTION_RUN {
        uuid id PK
        uuid performed_by FK
        text status "draft | confirmed | discarded"
        date effective_date "default: first day of next billing month"
        timestamptz performed_at
        timestamptz confirmed_at
        text note
    }
    PROMOTION_ITEM {
        uuid id PK
        uuid promotion_run_id FK
        uuid student_id FK
        uuid from_enrollment_id FK "one item per class enrolment, null if the student has none"
        uuid to_course_id FK "proposed next-grade class"
        text decision "move | stay (keep class, pin billing grade) | skip (no change at all) | needs_review"
        uuid to_enrollment_id FK "set on confirm"
        text note
    }
    STUDENT_LEVEL {
        uuid id PK
        uuid student_id FK
        uuid grade_level_id FK
        uuid promotion_run_id FK "null for admission or correction"
        date from_date
        date to_date "exclusive end, null = current"
        text reason "admission | promotion | correction"
    }
    GUARDIAN {
        uuid id PK
        uuid user_id FK
        text full_name
        text phone
        text address
        text nic "optional"
        text email "optional"
        bool portal_enabled "needs parent_portal module"
    }
    STUDENT_GUARDIAN {
        uuid student_id FK
        uuid guardian_id FK
        text relationship
        bool is_primary
    }
    ACADEMIC_TERM {
        uuid id PK
        text name
        date starts_on
        date ends_on
        bool is_current
    }
    SUBJECT {
        uuid id PK
        text code
        text name
    }
    COURSE_GROUP {
        uuid id PK
        uuid branch_id FK
        uuid subject_id FK
        text name "Science, Grades 6 to 11"
        text batch_label "optional, e.g. 2027 A/L"
    }
    COURSE {
        uuid id PK
        uuid subject_id FK
        uuid course_group_id FK "classes created together, one per grade"
        uuid term_id FK "nullable for ongoing classes"
        uuid branch_id FK
        text name
        text kind "class | program"
        text learning_mode "scheduled | self_paced"
        text delivery_mode "physical | online | hybrid"
        bool attendance_enabled "off for self-paced programs"
        text batch_label "e.g. 2027 A/L, optional"
        int capacity
        text status
    }
    COURSE_GRADE_LEVEL {
        uuid course_id FK
        uuid grade_level_id FK
    }
    COURSE_LECTURER {
        uuid course_id FK
        uuid lecturer_id FK
        bool is_primary
        numeric share_percent "default 100, for co-taught courses"
    }
    INTAKE {
        uuid id PK
        uuid course_id FK
        text name "March 2027 intake"
        date starts_on
        date ends_on
        int capacity
        text status "open | running | closed"
    }
    ENROLLMENT {
        uuid id PK
        uuid course_id FK
        uuid student_id FK
        uuid intake_id FK "programs only"
        uuid fee_structure_id FK "class default, attached automatically, never rewritten by exceptions"
        uuid billing_grade_level_id FK "pins the grade used for rates, set when a student stays after promotion"
        text preferred_mode "physical | online (hybrid courses)"
        text status "active | dropped | completed (lifecycle only)"
        text end_reason "dropped | promoted | course_ended | transferred"
        uuid promoted_from_enrollment_id FK "set when created by a promotion move"
        text access_status "active | restricted (billing overlay only)"
        date enrolled_on "start date"
        date access_starts_on
        date access_ends_on "exclusive: first day without access, null = lifetime or ongoing"
    }
    SCHEDULE_SLOT {
        uuid id PK
        uuid course_id FK
        uuid intake_id FK "nullable"
        int weekday
        time starts_at
        time ends_at
        text room
    }
    CLASS_SESSION {
        uuid id PK
        uuid course_id FK
        uuid intake_id FK "nullable"
        date session_date
        time starts_at
        time ends_at
        text topic
        text delivery_mode "physical | online | hybrid"
        text meeting_provider "zoom | teams | other"
        text meeting_url
        text meeting_ref "meeting id / passcode"
        text status "scheduled | held | cancelled"
    }
    ATTENDANCE {
        uuid id PK
        uuid session_id FK
        uuid student_id FK
        text status "present | absent | late | excused"
        text attended_via "physical | online"
        text marked_via "manual | qr"
        text note
        uuid marked_by FK
        timestamptz marked_at
    }
    CONTENT_ITEM {
        uuid id PK
        uuid lecturer_id FK
        text kind "recording | file | physical_book"
        text title
        text description
        text external_url "YouTube link for recordings"
        uuid file_id FK "notes, PDFs, books"
        text access_type "course | free_registered | paid"
        numeric price "for paid items"
        text status "draft | published | archived"
    }
    CONTENT_BRANCH {
        uuid content_id FK
        uuid branch_id FK
    }
    COURSE_SECTION {
        uuid id PK
        uuid course_id FK
        text title
        int position
    }
    COURSE_CONTENT {
        uuid id PK
        uuid course_id FK
        uuid section_id FK "nullable"
        uuid content_id FK
        int position
    }
    CONTENT_PURCHASE {
        uuid id PK
        uuid content_id FK
        uuid student_id FK
        uuid invoice_id FK
        uuid branch_id FK "branch chosen at purchase, must be a branch the item is listed in"
        text channel "online | physical"
        numeric price
        text status "pending | paid | cancelled"
        timestamptz purchased_at
        timestamptz handed_over_at "physical items, only after paid"
        uuid handed_over_by FK
    }
    EXAM {
        uuid id PK
        uuid lecturer_id FK
        text title
        text mode "online_mcq | paper"
        date exam_date
        numeric max_marks
        numeric weight
        timestamptz opens_at
        timestamptz closes_at
        int time_limit_minutes
        int max_attempts
        text attempt_scoring "best | latest"
        bool shuffle_questions
        bool lock_answers
        text results_visibility "immediate | after_release | manual"
        text status "draft | published | closed"
    }
    EXAM_COURSE {
        uuid exam_id FK
        uuid course_id FK
    }
    QUESTION {
        uuid id PK
        uuid lecturer_id FK
        text body
        uuid image_file_id FK
        text explanation
        numeric default_marks
    }
    QUESTION_OPTION {
        uuid id PK
        uuid question_id FK
        text body
        bool is_correct
        int position
    }
    EXAM_QUESTION {
        uuid id PK
        uuid exam_id FK
        uuid question_id FK
        numeric marks
        int position
        jsonb snapshot "question text, options and correct flags frozen at publish"
    }
    EXAM_ATTEMPT {
        uuid id PK
        uuid exam_id FK
        uuid student_id FK
        uuid enrollment_id FK "enrolment through which the exam was reached"
        int attempt_no "unique per exam and student across all courses"
        timestamptz started_at
        timestamptz submitted_at
        numeric score
        text status "in_progress | submitted | graded | expired"
    }
    ATTEMPT_ANSWER {
        uuid id PK
        uuid attempt_id FK
        uuid exam_question_id FK
        text selected_option_key "option id inside the exam_question snapshot"
        bool is_correct
        numeric marks_awarded
    }
    EXAM_RESULT {
        uuid id PK
        uuid exam_id FK
        uuid student_id FK
        uuid enrollment_id FK "enrolment the result is recorded against"
        uuid attempt_id FK "counted attempt, null for paper exams"
        numeric marks
        text grade
        text remarks
        text source "attempt | manual | manual_override"
        timestamptz released_at "final release, only after the exam is closed"
    }
    FEE_STRUCTURE {
        uuid id PK
        uuid branch_id FK
        uuid course_id FK "nullable = general fee"
        uuid intake_id FK "nullable = all intakes"
        text name
        bool is_default "the class default option, at most one per class"
        text billing_type "recurring | one_time_package"
        text frequency "monthly | per_term (recurring)"
        int access_duration_months "null = lifetime for packages"
        int overdue_grace_days "null = organization default"
        text overdue_action "null = organization default"
        bool is_active
    }
    FEE_RATE {
        uuid id PK
        uuid fee_structure_id FK
        uuid grade_level_id FK "null = same for all grades"
        numeric amount "1000, 1200, 20000"
        date effective_from
        date effective_to "exclusive end, null = current"
    }
    FEE_EXCEPTION {
        uuid id PK
        uuid enrollment_id FK
        text kind "alternate_option | discount"
        uuid alternate_fee_structure_id FK "alternate_option: same course"
        text discount_type "percent | fixed (discount)"
        numeric discount_value "100 percent = free place"
        date effective_from
        date effective_to "exclusive end, null = until ended"
        text reason "required"
        uuid created_by FK "needs fees.override"
        uuid ended_by FK
        timestamptz created_at
    }
    INSTALLMENT_OPTION {
        uuid id PK
        uuid fee_structure_id FK
        text name "3 monthly installments"
        int installment_count
        numeric down_payment_percent
        int interval_days
        numeric surcharge_percent "optional"
        bool is_active
    }
    INVOICE {
        uuid id PK
        uuid student_id FK
        uuid branch_id FK
        uuid installment_option_id FK "null = pay in full"
        date issued_on
        date due_date
        numeric subtotal "total before discounts"
        numeric discount_total "positive, minus the sum of discount items"
        numeric total "sum of all signed items = subtotal minus discount_total"
        numeric amount_paid "cache of active allocations"
        text status "pending | partial | paid | overdue | waived | cancelled (cache)"
    }
    INVOICE_ITEM {
        uuid id PK
        uuid invoice_id FK
        text kind "recurring_fee | package_fee | content | adjustment | discount"
        text description
        numeric amount "signed: charges positive, discounts negative, adjustments either"
        uuid enrollment_id FK "fee items"
        uuid fee_structure_id FK "fee items"
        uuid grade_level_id FK "grade used for the rate"
        uuid content_purchase_id FK "content items"
        uuid fee_exception_id FK "discount items created by a fee exception"
        uuid applies_to_item_id FK "discount and negative adjustment items: the payable item they reduce"
        timestamptz cancelled_at "set on every item when the invoice is cancelled"
        date period_start "recurring fees"
        date period_end "exclusive end"
    }
    INVOICE_INSTALLMENT {
        uuid id PK
        uuid invoice_id FK
        int seq
        date due_date
        numeric amount
        numeric amount_paid "cache: the invoice paid amount applied in seq order"
        text status "pending | partial | paid | overdue (cache)"
    }
    PAYMENT_METHOD {
        uuid id PK
        uuid organization_id FK
        text type "bank_transfer | cash | gateway"
        text label
        bool is_default "bank_transfer by default"
        bool is_active
        jsonb config "gateway keys etc."
    }
    BANK_ACCOUNT {
        uuid id PK
        uuid branch_id FK
        text bank_name
        text branch_name
        text account_name
        text account_number
        bool is_active
    }
    PAYMENT {
        uuid id PK
        uuid student_id FK
        uuid submitted_by FK "student, guardian or staff recording cash"
        uuid branch_id FK "branch that received the money"
        uuid payment_method_id FK
        uuid bank_account_id FK "for bank transfers"
        uuid slip_file_id FK "payment slip image"
        numeric amount
        date paid_on "date on slip or cash date"
        text reference_no "bank txn ref"
        text status "pending_verification | verified | rejected | voided"
        text rejection_reason
        uuid verified_by FK
        timestamptz verified_at
        text void_reason
        uuid voided_by FK
        timestamptz voided_at
        timestamptz submitted_at
    }
    PAYMENT_ALLOCATION {
        uuid id PK
        uuid payment_id FK
        uuid student_id FK "same student as payment and invoice"
        uuid invoice_id FK
        uuid invoice_item_id FK "the payable item this money pays, must belong to the invoice"
        numeric amount
        timestamptz reversed_at "set when the payment is voided, never deleted"
    }
    RECEIPT {
        uuid id PK
        uuid payment_id FK "unique"
        uuid branch_id FK
        text receipt_no "unique per branch"
        text verification_code UK "public verify URL and QR"
        text content_hash "SHA-256 of receipt data"
        text signature "digital signature"
        timestamptz signed_at
        timestamptz issued_at
        text status "issued | void"
        uuid replaced_by_receipt_id FK "set when voided and reissued"
        uuid file_id FK "signed PDF"
    }
    GATEWAY_TRANSACTION {
        uuid id PK
        uuid payment_id FK
        text provider
        text provider_ref
        text status
        jsonb raw_payload
    }
    COMMISSION_RULE {
        uuid id PK
        uuid lecturer_id FK
        uuid subject_id FK "nullable"
        uuid grade_level_id FK "nullable"
        uuid course_id FK "nullable"
        text calc_type "percent | fixed_per_student_month"
        numeric commission_rate "what the institute keeps, not the teacher share"
        date effective_from
        date effective_to "exclusive end, null = current"
    }
    COMMISSION_ENTRY {
        uuid id PK
        uuid payment_allocation_id FK "leads to the invoice item, enrolment, course, lecturer and grade"
        uuid rule_id FK
        uuid lecturer_id FK
        uuid payout_id FK "null until settled"
        uuid reverses_entry_id FK "set on reversal entries"
        text entry_type "accrual | reversal"
        text calc_type_applied "snapshot of the rule"
        numeric rate_applied "snapshot of the rule"
        numeric share_percent_applied "snapshot of the co-teacher share"
        text basis_applied "paid | list, snapshot of the organization setting"
        bool capped "true when commission was limited to the base"
        numeric base_amount "basis-adjusted amount x share (paid: allocation, list: allocation scaled to list price)"
        numeric commission_amount "kept by the institute, negative on reversal"
        numeric teacher_amount "owed to the teacher, negative on reversal"
        text status "accrued | settled | void"
    }
    TEACHER_PAYOUT {
        uuid id PK
        uuid lecturer_id FK
        date period_start
        date period_end
        numeric gross_collected
        numeric commission_total
        numeric net_payable
        text status "draft | approved | paid"
        date paid_on
        text payment_reference
        uuid proof_file_id FK
        uuid approved_by FK
    }
    FILE {
        uuid id PK
        uuid uploaded_by FK
        text storage_key
        text mime_type
        int size_bytes
        timestamptz created_at
    }
    AUDIT_LOG {
        uuid id PK
        uuid actor_user_id FK
        text action "payment.verify, payment.void, receipt.void, promotion.run, access.restrict ..."
        text entity_type
        uuid entity_id
        jsonb before_data
        jsonb after_data
        text reason
        timestamptz created_at "append-only"
    }
    NOTIFICATION_CHANNEL {
        uuid id PK
        uuid organization_id FK
        text channel "email | sms | push | in_app"
        text provider "smtp, resend, text.lk (sms), web push"
        bool is_enabled
        jsonb config "sender id, keys"
    }
    NOTIFICATION_TEMPLATE {
        uuid id PK
        uuid organization_id FK
        text event "payment_verified | receipt_issued | installment_due | attendance_marked | class_reminder | exam_published | notice"
        text channel "email | sms | push | in_app"
        text subject
        text body "with placeholders"
    }
    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        uuid template_id FK
        text channel
        text event
        jsonb payload
        text status "queued | sent | failed"
        timestamptz sent_at
        text error
    }
    PUSH_SUBSCRIPTION {
        uuid id PK
        uuid user_id FK
        text endpoint UK
        text p256dh_key
        text auth_key
        text user_agent
        timestamptz created_at
    }
    NOTICE {
        uuid id PK
        uuid author_id FK
        uuid branch_id FK "null = all branches"
        text title
        text body
        timestamptz published_at
        timestamptz expires_at "null = no expiry"
    }
    NOTICE_TARGET {
        uuid id PK
        uuid notice_id FK
        text target_type "all | role | course | grade | student"
        uuid target_id
    }
    MESSAGE_THREAD {
        uuid id PK
        text subject
        uuid course_id FK "optional context"
        timestamptz created_at
    }
    THREAD_PARTICIPANT {
        uuid thread_id FK
        uuid user_id FK
        timestamptz last_read_at
    }
    MESSAGE {
        uuid id PK
        uuid thread_id FK
        uuid sender_id FK
        text body
        timestamptz sent_at
    }
```

## Business rules by area

### Courses, programs and access

- **Creating classes:** the admin picks branch, subject, teacher and the grades (for example 6 to 11), then fills one row per grade: monthly or one-time fee, day, start time, duration, room or meeting link, capacity. Saving creates one class per grade in a `course_group`, each with its own fee structure, schedule, attendance, content and exams. Teachers still see the group as one subject. A class can also cover several grades that share a schedule, with different rates per grade inside it.

- **Class (type A style):** recurring monthly fee, grade-based `fee_rate`, attendance on, sessions on a weekly schedule. Billed by a monthly job.
- **Program (type B style):** one-time or intake-based price, optional installments. `learning_mode = 'scheduled'` programs run in `intake` batches with sessions and attendance. `learning_mode = 'self_paced'` programs have attendance off, store only the enrollment start date, and give lifetime access when `access_ends_on` is empty.
- A student's access to course content is allowed when the enrollment is `active`, `access_status = 'active'`, and today is inside the access window (or no end date).
- Overdue rules from v4 still apply: grace period, then notify and/or restrict, and access returns only after staff verify the payment.

### Student and guardian data

- Required for every student: name, date of birth. Grade is required only to enrol in a class with grade-based fees, and adults in programs need none. Optional: NIC, email, phone, school.
- If age (from date of birth) is below `organization.guardian_required_below_age`, the app requires at least one guardian with name, phone and address. This is app validation, not a database constraint.
- Young students may have no email, so `user.email` is nullable and `user.username` (for example the student number) can be the login.

### Grades and promotion

- Promotion is a draft, review and confirm flow. The draft proposes the next grade for each student and, for each of the student's active class enrolments, a matching next-grade class (same `course_group`, or same subject, branch, teacher and batch label), so a student in three subjects has three items. The admin reviews, changes or skips items, sets the effective date, and confirms. On confirm, each student's `student_level` advances and their enrolment moves to the next grade's class. The old enrolment ends with `end_reason = promoted`, the new one starts with the target class's fee, and all earlier invoices stay as issued. Students without a single matching class are flagged for the admin to decide. A `stay` item keeps that enrolment in its class and pins its billing grade to the grade before promotion, so its fee stays the same until the admin clears the pin or moves the student later.
- `grade_level.stage` lets you group primary, ordinary level and advanced level. Exam-year batches such as "2027 A/L" use `course.batch_label`.

### Attendance

- `attendance_enabled` on the course decides whether sessions record attendance.
- Marking is manual or by QR: the marker scans the student's QR card (`student.qr_token`), which creates an `attendance` row with `marked_via = 'qr'`. Only users with the `attendance.mark` permission can do this.
- The event `attendance_marked` can notify guardians by SMS, email or push.

### Content library and purchases

- Content access has three modes: `course` (only students in a course that includes it), `free_registered` (any registered student in the branches listed in `content_branch`), and `paid` (needs a paid `content_purchase`).
- Shared across branches means listed in several `content_branch` rows or attached to courses in several branches. Branch-specific means one.
- Online purchase creates an invoice with a content item, and the normal slip, verification and receipt flow applies. Physical sale is recorded by staff as a verified payment (usually cash), and `handed_over_at` is set when the book is given. There is no stock tracking.
- Recordings are YouTube links (unlisted). They are shown only inside the portal after login, but anyone who has the link can still share it, so treat this as convenience and not strong protection.

### Exams

- **Online MCQ:** the lecturer builds questions and options in their question bank, creates an exam, and attaches it to courses (`exam_course`). Students start `exam_attempt` rows within `opens_at`/`closes_at`, bounded by `time_limit_minutes` and `max_attempts`. Answers are auto-graded. `attempt_scoring` decides whether best or latest attempt counts, and `results_visibility` decides when students and parents can see results.
- **Paper:** `exam.mode = 'paper'` and marks are entered into `exam_result` manually (`source = 'manual'`).
- Because exams attach to courses, "separate per branch" or "shared" is just a choice of which courses to attach.

### Roles and permissions

- Built-in roles: `root_admin` (also the solo teacher), `student_counselor`, `payment_handler`, `attendance_marker`. Permissions are codes like `payments.verify`, `attendance.mark`, `students.create`, and `fees.override` (fee exceptions, root admin by default).
- A role assignment can be limited to one branch (`branch_id`) or all branches (null). Custom roles come later with no schema change, since roles are data.

### Fees and commissions

- Fee structures can be defined per branch, course, intake and grade. The institute sets them up per teacher-subject-grade by creating them against the right course.
- Fees are set on the class. Each class has its own fee structure or structures with at most one default, and enrolling attaches the default automatically. A class with several options (for example 3 or 12 months of access) asks staff to pick one at enrolment. Billing never searches for a matching structure. Rate changes use new `fee_rate` rows with an effective date and never change issued invoices. If no rate exists, invoice generation fails loudly and never bills zero.
- **Fee exceptions (optional module `fee_exceptions`):** staff with the `fees.override` permission can give one student another fee option of the same class, or a discount (percent or fixed, 100 percent is a free place) from a chosen date, with a required reason. The invoice shows the list price and the discount as separate lines, so both are visible. Only future invoices change. Exceptions are ended and never deleted, and every change is audit-logged. Turning the module off stops new exceptions, while active ones keep applying to billing until they end.
- For institutes that take commission, `organization.discount_commission_basis` decides whether commission is calculated on the amount actually paid (default) or on the list price, so the institute absorbs the discount.
- **Commission rule:** a rule belongs to a lecturer and can be narrowed by subject, grade or course. The most specific matching rule wins (course, then grade plus subject, then subject, then teacher default). `calc_type` is `percent` of the fee or `fixed_per_student_month`.
- **Accrual:** when a payment is verified, each allocation to a fee item creates a `commission_entry` per lecturer. The base is the basis-adjusted allocation amount (the amount paid, or under the `list` basis the amount scaled to the item's list price) times that lecturer's `share_percent`. A percent rule takes `commission_rate` percent of the base. A fixed rule takes the fixed amount in proportion to how much of the item this allocation pays, so partial payments work and the total never exceeds the fixed amount. `commission_rate` is what the institute keeps. The rule's inputs are copied onto the entry.
- **Payout:** a `teacher_payout` collects accrued entries for a period, shows gross, commission and net, and is marked paid with a reference and transfer proof. Entries move from `accrued` to `settled`.
- Voiding a payment voids its unsettled commission entries. Entries already settled in a payout get a negative reversal entry that is deducted from the next payout.

### Payment flow (unchanged from v4)

1. Fee structures generate invoices (monthly, one-time, or content).
2. The student or guardian transfers money, uploads the slip, and the payment is `pending_verification`. Cash payments recorded by staff are created already `verified`.
3. Staff verify or reject. On verification, allocations are created, invoice and installment statuses update, a signed receipt is issued, and commission entries accrue.
4. A gateway, if enabled, uses the same payment row with a `gateway_transaction`.

### Notifications

- Channels: in-app, email, SMS (text.lk) and web push. Email, SMS and push are switched on per buyer, and a disabled one creates no record and no send attempt. In-app notifications are always available.
- Events: payment submitted, payment verified or rejected, receipt issued, installment due or overdue, attendance marked, class reminder, exam published, new notice.
- Notices appear in portal headers for students and parents (using `notice_target`) and can also trigger push or SMS.

## Suggested build phases

The schema can be created in stages. Each phase needs only its own tables.

1. **Core:** organization, branch, users, roles and permissions, audit log, students, guardians, grades, subjects, courses, intakes, enrollment, attendance (manual and QR), fee structures, invoices and items, bank-slip payments with void and reversal, receipts, notices, recordings.
2. **Billing depth and messaging:** installments, fee exceptions, overdue restriction, in-app, email and SMS notifications, web push, parent portal.
3. **Exams:** online MCQ and paper results.
4. **Content store and commissions:** paid content, branch scoping, commission rules, accruals and teacher payouts.
5. **Optional extras:** payment gateway, Zoom and Teams automation, certificate-signed PDF receipts.

## Design notes

- Receipt numbers need a per-branch counter (unique index on `branch_id, receipt_no`, assigned in a transaction).
- Allocations are the financial truth. Invoice `amount_paid` and statuses are caches updated in the same transaction and checked by a nightly reconciliation job.
- Constraints, unique indexes and transaction rules are listed with their enforcement level in `student-management-invariants.md`.
- Store slips, receipts and content files privately and serve them through signed, expiring URLs.
- Rotate `student.qr_token` if a card is lost.
- Add later if needed: refunds, late fees, discounts and scholarships, grading scale, certificates for program completion.

## Decisions made

- Teaching style (class or program) is set per course. Any teacher can run both.
- Self-paced programs store only the start date. Lifetime access is the default for one-time programs, with optional time-limited access.
- Scheduled programs run in intakes, with attendance on by default.
- Commission is a percent or fixed amount per student per month, matched by teacher with optional subject, grade or course overrides. The institute collects all fees and pays teachers net, tracked by payouts.
- Four built-in roles now, custom roles later.
- Promotion is a bulk admin action, with an optional batch label such as "2027 A/L".
- QR attendance uses a student QR card scanned by a marker.
- Exam rules (time limit, attempts, result visibility) are configurable per exam.
- Physical sales of notes and books are recorded only, with no stock tracking.
- Full ERD now, staged build.
- One class per grade, created together from one form, each with its own fee, schedule, duration and capacity.
- Fees are set on the class (monthly, one-time, or one-time with installments) and attached automatically at enrolment.
- Promotion moves students into the next grade's class, with admin review before confirming.
- Fee exceptions are built in now as an optional module per buyer.
- Students may belong to one or many branches. Attendance is per class session. Bank transfer with slip is the primary payment method. No advance payments. Receipts use v1 signing. SMS goes through text.lk. Overdue handling is configurable, and access returns only after staff verify.

## Next step

The design is frozen as v1.0. Write the Drizzle ORM schema (Postgres) in phases, with the SQL-only constraints in hand-written migrations, and record any later design change as a migration plus a changelog entry.
