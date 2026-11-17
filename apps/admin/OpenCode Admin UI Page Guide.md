# OpenCode Guide: Build the Admin UI Pages

Use this guide to build the admin interface pages in the existing repository. The page list below mirrors `apps/admin/src/lib/navigation.ts`. Treat `packages/db/src/schema/*.ts`, `packages/db/docs/tables.md`, and `packages/db/docs/student-management-invariants.md` as the domain reference for names, fields, statuses, and relationships. Those repository documents describe the product domain; this guide's scope is the user's request: **build UI only**.

## Shared instruction for every page

> Work inside `apps/admin` and the shared UI package only when needed. Build the admin pages as presentational UI with realistic local mock data and local component state. Do not change database schemas, migrations, seed data, DB services, APIs, authentication, authorization, server actions, or business rules. Do not claim an action persisted. Buttons, dialogs, tabs, filters, search, pagination, dropdowns, and forms may demonstrate the intended UI with local state and sample data only. Keep domain rules visible in labels, warnings, and disabled states where relevant; do not implement them.
>
> Preserve the existing visual design and design type. First inspect and reuse `AppShell`, `AppSidebar`, `AppHeader`, the existing dashboard components, `@workspace/ui` shadcn-style components, Tailwind tokens, Geist typography, spacing, borders, radii, light/dark theme, and lucide-react icons. Keep the current restrained neutral palette, compact administration layout, card/table treatment, and responsive behavior. Do not introduce a new brand, color system, typography, sidebar/header design, illustration style, or unrelated dashboard template. Do not alter the shared shell except to make the existing breadcrumbs reflect the active page and make the existing sidebar links navigate to the matching page. Preserve its groups, labels, item order, and icons.
>
> Use the existing reusable components from `@workspace/ui/components` where appropriate: Card, Button, Badge, Input, Select, Textarea, Checkbox, Switch, Dialog, DropdownMenu, Table, Pagination, Breadcrumb, Avatar, Tabs if already available, and Sheet. Use lucide-react icons already installed. Provide coherent empty, loading/skeleton, and populated states when a page needs them. Use accessible labels, focus states, semantic headings, and responsive tables (horizontal scrolling or stacked cards on narrow screens). Avoid oversized hero areas; page titles, a short description, primary action, compact filters, and the working surface should appear quickly.
>
> Keep currency and date formatting consistent with the organization settings in the mock data (default currency LKR and timezone Asia/Colombo). Do not show the commerce-demo people, USD, shipped orders, or unrelated sales data. Use education and institute examples. Use only schema-backed concepts; when a field or relation is absent, do not invent it as persisted data. Keep optional-module screens clearly marked as module-dependent in the UI.

## Page-by-page instructions

Implement these as separate routes/pages, with the route segments shown. Keep each page within the existing shared shell. The icon named here is the current sidebar icon; retain it. Use other small lucide icons only for page actions and status cues.

### 1. Dashboard — `/`

**Sidebar icon:** `ChartNoAxesCombinedIcon` (keep the current badge if it is intentional, but do not imply it is a real unread count).

Build an institute operations overview, replacing the unrelated shipping/sales demo content. Include a page title and date range selector; compact KPI cards for active students, active courses/classes, pending payment verification, and overdue invoices; a recent payments table (student, branch, amount, method, submitted/verified date, status); upcoming class sessions; and a small attendance or collections trend chart. Use LKR and plausible local sample values. Keep charts secondary to actionable tables. A dashboard number is mock data, not a live calculation.

### 2. Students — `/students`

**Sidebar icon:** `GraduationCapIcon`.

Create a student directory backed by the concepts in `student`, `student_branch`, `student_guardian`, `student_level`, and `enrollment`. Header actions: “Add student” and optional export placeholder. Filters: search by student number/name/contact, branch, status (active/alumni/suspended), grade, and course. Table columns: student number/name, grade as of today, primary branch, active enrollment count, contact, status, created date, row menu. Detail panel/page sections: profile and contact (DOB, age derived for display, gender, school, NIC), branches and joined dates, guardian relationships with primary flag, grade history with date ranges, enrollments and access status/dates, and portal-linked user indicator. Registration mock form includes required name and DOB, contact, branch, grade where relevant, guardian details section, and QR-card placeholder. Clearly explain that guardian requirement depends on configured age threshold; do not expose QR token itself.

### 3. Lecturers — `/lecturers`

**Sidebar icon:** `PresentationIcon`.

Directory using `lecturer`, `lecturer_branch`, `user`, and course lecturer assignments. Filters: search, branch, portal enabled. Table: lecturer, qualification, branch chips, assigned courses, portal status, created date, actions. Detail view: bio/qualification, branches, assigned courses and co-teacher share percentages, portal/account link state. Add/edit dialog fields: full name, qualification, bio, branches, portal access toggle and account-link placeholder. Show the portal toggle as account access, not lecturer record deletion; keep the profile/history concept visible.

### 4. Guardians — `/guardians`

**Sidebar icon:** `HeartHandshakeIcon`.

Directory based on `guardian`, `student_guardian`, linked `student`, and optional `user`. Table: guardian, phone/email, linked students, relationship/primary summary, portal status, actions. Detail drawer groups contact/address/NIC, linked students and each relationship, and parent portal account state. Add/edit dialog for name, phone, address, NIC, email, portal toggle, and student linking with relationship and primary choice. Show an empty state for guardians not linked to a student. Do not require every guardian to have a login.

### 5. Promotions — `/promotions`

**Sidebar icon:** `TrendingUpIcon`.

Design this as a draft → review → confirm workflow from `promotion_run`, `promotion_item`, and `student_level`, not an immediate bulk edit. List runs with status, effective date, item counts, created date, and note. “Create promotion run” opens a setup step for branch/course group/grade cohort and effective date (show the expected first-of-next-billing-month default as a preview only). Review table per student/enrollment: current grade/class, proposed next class, decision (`move`, `stay`, `skip`, `needs review`), reason/warning, editable decision. Explain “stay” advances grade but pins the enrollment billing grade; “move” creates next-grade class placement; highest grade/no match/full class/missing fee option can need review or skip. Final confirm dialog summarizes impacts and makes clear no changes occur before confirmation. UI-only; never apply mock decisions to real records.

### 6. Courses & Classes — `/courses`

**Sidebar icon:** `BookOpenIcon`.

Present a searchable course/class directory from `course`, `course_group`, `course_grade_level`, `course_lecturer`, `academic_term`, `intake`, and linked `fee_structure`. Tabs or filter chips for Classes and Programs; filters branch, subject, grade, term, lecturer, delivery mode, and status. Table: course name, kind/mode, subject, branch, grades, lecturer(s), term/intake, enrolled/capacity, status. Course detail sections: overview, teachers and shares, grade eligibility, schedules/sessions, enrollments, fee option/rates, and intakes for programs. “Create class” should visually be a guided setup form that supports several grades under one course group and separate class records per grade, each with its own fee, schedule, capacity, delivery mode, and lecturer assignment. Program form distinguishes scheduled vs self-paced; show rule hints: classes are scheduled, self-paced has no attendance, scheduled programs need an intake for enrollment. No persistence.

### 7. Subjects — `/subjects`

**Sidebar icon:** `LibraryBigIcon`.

Manage the simple `subject` catalog. Table: code, subject name, number of courses, actions. Search by code/name. Add/edit dialog uses code (optional and unique in data) and required name. Subject detail can show related courses and assigned lecturers. Avoid invented descriptions, grade mappings, or subject settings not present in schema.

### 8. Terms & Intakes — `/terms-intakes`

**Sidebar icon:** `CalendarRangeIcon`.

Use two clearly separated tabs: Academic Terms (`academic_term`) and Program Intakes (`intake`). Terms table shows name, start/end display dates, current marker; form enforces end date on/after start and allows one current term indicator. Intakes table shows name, parent program, date window, capacity, status (open/running/closed), enrollment count. Form lets admin select a program, set dates/capacity/status. Explain that academic term and intake are distinct concepts; their end dates are display-inclusive last days, unlike access/effectivity dates elsewhere. Use date pickers only if already available, otherwise native date inputs.

### 9. Grade Levels — `/grade-levels`

**Sidebar icon:** `LayersIcon`.

Manage `grade_level`: ordered list with name, stage (primary, junior, ordinary level, advanced level), ordinal, student/course counts. Add/edit uses name, stage and ordinal. Display order by ordinal because promotion uses it. Show students' current grade context without suggesting grade is stored directly on the student profile. Warn visually that changing order can affect next-grade promotion proposals; no actual mutation logic.

### 10. Timetable — `/timetable`

**Sidebar icon:** `CalendarClockIcon`.

Create a weekly schedule view based on `schedule_slot` (weekday, start/end, room) with branch, course, lecturer, grade, and delivery filters. Provide week/day toggle or a compact week grid and a list alternative. Course cards show class, subject, teacher, time, room, branch. Detail/edit dialog modifies a mock recurring slot. Provide a separate upcoming/past sessions view from `class_session` with date/time, topic, mode, meeting provider/link status and session status (scheduled/held/cancelled). Do not treat weekly slots as actual session attendance events. Avoid inventing room capacity or conflict outcomes.

### 11. Attendance — `/attendance`

**Sidebar icon:** `ClipboardCheckIcon`.

Session-first attendance workspace based on `class_session` and `attendance`. Select branch, course, date/session; show session topic/time/mode, enrolled students, and statuses present/absent/late/excused. Table columns: student number/name, grade, attendance status, attended via (physical/online), marked via (manual/QR), marked at/by. Provide “Mark attendance” demo controls, bulk status menu, and summary counts. QR attendance should be an optional module badge/placeholder. Clearly distinguish manual and QR records; no actual scanning, messaging, or saving.

### 12. Fee Structures — `/fee-structures`

**Sidebar icon:** `ReceiptTextIcon`.

Catalog grouped by course and branch from `fee_structure`, `fee_rate`, and `installment_option`. Filters: branch, course, billing type, active/effective date. Table: fee name/course, recurring vs one-time package, frequency, access duration, current rate summary, overdue grace/action, status if provided. Detail shows grade-specific date-bounded rates, installment options (count, down payment %, interval days, surcharge %), and overdue behavior. Form fields must reflect actual schema; highlight that fees belong to a course/class and default onto enrollment. Support recurring monthly/per-term and one-time package distinctions. Do not invent generic student fee selection or silent zero rates.

### 13. Invoices — `/invoices`

**Sidebar icon:** `FileTextIcon`.

Invoice register based on `invoice`, `invoice_item`, `invoice_installment`, and enrollment/student/branch. Filters: student, branch, date range, status (pending/partial/paid/overdue/waived/cancelled), due date. Table: invoice number/reference if modeled, student, branch, issue/due date, total, paid, balance, status. Detail shows itemized signed lines (fee/package/content/adjustment/discount), covered period, grade/fee references, installment schedule and paid amounts, allocation/payment history. Actions are UI-only: view/print placeholder, add adjustment/cancel/reissue previews; label issued invoice lines as immutable and use a new adjustment/correction concept rather than inline rewriting. Amounts and balances should be coherent in mock records.

### 14. Payments — `/payments`

**Sidebar icon:** `CreditCardIcon` (preserve the current badge visually but treat the number as sample data).

Verification queue and payment register from `payment`, `payment_allocation`, `invoice`, `bank_account`, `file`, and `gateway_transaction`. Tabs pending verification, verified, rejected, voided. Filters branch, method, status, date, student. Table: submitted date, student, branch, method, reference/provider ref, amount, target invoices, status. Detail drawer shows payment info, proof/slip preview placeholder, invoice allocation split, verifier and timestamps, gateway status/provider for gateway payments. Demo actions verify, reject with required reason, void with required reason, and adjust allocation in dialog; show confirmation and resulting receipt/commission side-effect summary without persisting. Cash recording is distinct from student-submitted payments and is shown as immediately verified in its mock preview.

### 15. Receipts — `/receipts`

**Sidebar icon:** `ReceiptIcon`.

Issued receipt register from `receipt`, `receipt_counter`, payment, branch, and student. Table: receipt number, payment/student, branch, issue date, amount, status (issued/void), verification code masked, PDF indicator. Filters branch/date/status/student. Detail has payment reference, signature/hash metadata as read-only support details, PDF preview/download placeholder, and void/reissue relationship when present. Do not expose signing keys or raw hashes as primary UI. Make receipt number branch-scoped and immutable in presentation.

### 16. Fee Exceptions — `/fee-exceptions`

**Sidebar icon:** `PercentIcon`.

Optional `fee_exceptions` module page using `fee_exception` and enrollment/course. Show a module-disabled empty/notice state when feature is off. Active, scheduled, and ended exception tabs. Table: student, enrollment/course, kind (alternate fee option or discount), amount/type, effective dates, reason, status. Form requires reason, start/end dates, kind and appropriate alternate option or percent/fixed discount. Show original fee alongside exception and preview resulting amount, with explicit effectivity range. Explain exceptions attach to an enrollment and an alternate option must be for the same course; existing active exceptions still apply if module is switched off. UI-only and no billing calculation beyond illustrative local preview.

### 17. Payment Methods — `/payment-methods`

**Sidebar icon:** `LandmarkIcon`.

Settings screen for `payment_method` and `bank_account`. Separate offered methods (bank transfer/cash/gateway, enabled/default flags) from branch bank destinations (bank/branch/account display details and active/default status). Mask account numbers by default. Actions edit labels/enabled state and add a bank account through a local modal. Show branch scope and default bank-transfer method. Gateway settings may link to Integrations; never request or display secret credentials in plain text.

### 18. Exams — `/exams`

**Sidebar icon:** `FileCheck2Icon`.

Exam list from `exam`, `exam_course`, `exam_question`, attempts and results. Table: title, mode (online MCQ/paper), attached courses, open/close window, time limit, attempt limit, scoring best/latest, result visibility, status draft/published/closed. Detail/create flow includes course attachments, exam mode, schedule/window, limits, visibility, and question selection or paper results entry. Show eligibility/candidate count as mock data. Publishing confirmation explains question/options snapshots freeze at publish; published questions cannot be edited in place. Result release control appears only after closure in the UI. No real exams or grading.

### 19. Question Bank — `/question-bank`

**Sidebar icon:** `ListChecksIcon`.

Manage `question` and `question_option` records. Search/filter by lecturer/owner and text; table/card rows show question text preview, option count, default marks, image attachment indicator, and last updated if available. Create/edit question form: prompt, optional image, explanation, default marks, ordered answer options with one/multiple correctness indicators only as schema permits. Include read-only “used in published exam snapshot” cue when mocked; avoid editing published exam snapshots through the bank. Mark this page optional when `online_exams` is disabled.

### 20. Results — `/results`

**Sidebar icon:** `AwardIcon`.

Result workspace based on `exam_result`, `exam_attempt`, and `attempt_answer`. Select exam and course/branch; table: student, marks/max, grade, source (attempt/manual/manual override), remarks, released state/date. Paper exams get manual entry UI; online MCQ results show provisional versus final/released states and attempt count. Include exam close/release controls with explanatory gating; released edits require reason and audit cue. Show attempt detail answers, correctness, marks, and submission status. Do not imply release or edits are persisted.

### 21. Content Library — `/content-library`

**Sidebar icon:** `FolderOpenIcon`.

Catalog for `content_item`, `content_branch`, `course_section`, and `course_content`. Filters kind (recording/file/physical book), access (course/free registered/paid), lecturer, branch, status. Table: title, kind, owner lecturer, access type/price, listed branches, linked courses/sections, status. Detail/edit form includes title, kind-specific external URL/file placeholder, owner, access type and price for paid, branch visibility, and ordered course sections/content placement. Show module-dependent paid store capabilities, while course/free content remain distinguishable. Do not display raw storage keys.

### 22. Purchases — `/purchases`

**Sidebar icon:** `ShoppingCartIcon`.

Order-style register for `content_purchase` linked to student, content item, branch, invoice and payment. Filters channel (online/physical), status (pending/paid/cancelled), branch/date, handover pending. Table: student, content, channel, price, status, purchase date, handover state/by/date. Detail view separates payment state from physical handover. For physical books show handover action only as a local-state demo and a required staff/date preview; paid status grants access, pending does not. Optional content-store module badge.

### 23. Notices — `/notices`

**Sidebar icon:** `MegaphoneIcon`.

Manage `notice` and `notice_target`. List title, author, branch/global, publish/expiry window, audience summary, current state (draft/scheduled/published/expired derived for display). Editor includes title/body, optional branch, publish/expiry timestamp, and targets: all, role, course, grade, student according to target type. Preview the notice and recipient targeting. Use scheduling/publishing local UI only; no send action.

### 24. Messages — `/messages`

**Sidebar icon:** `MessageSquareIcon`.

Inbox/thread layout based on `message_thread`, `thread_participant`, and `message`. Left list shows subject, participants, optional course, last message time, unread indicator based on last-read timestamp. Main panel shows message history and composer; start-thread dialog selects participants and optional course. Use student/guardian/lecturer/staff identities appropriately. Demo local conversation state only; do not send messages externally or pretend notifications were delivered.

### 25. Notifications — `/notifications`

**Sidebar icon:** `BellRingIcon`.

Admin delivery log and configuration tabs based on `notification`, `notification_channel`, `notification_template`, and `push_subscription`. Delivery table: recipient, event, channel (in-app/email/SMS/push), status queued/sent/failed, created/sent/read time, failure summary. Configuration shows enabled channel toggles and provider labels/settings placeholders; template list by event/channel with editable subject/body preview. Respect enabled modules/channels in the UI; in-app always exists, external channel delivery can be disabled. Hide secrets and do not trigger sends.

### 26. Commission Rules — `/commission-rules`

**Sidebar icon:** `ScaleIcon`.

Optional commissions module. List `commission_rule` with lecturer, calculation type (percent/fixed per student-month), rate, scope (default / subject / subject+grade / course), effective dates, active indicator. Form validates visually: course scope is a course rule; grade requires subject; percent 0–100; fixed amount nonnegative. Detail shows specificity precedence (course → subject+grade → subject → lecturer default), overlap warning, and organization basis setting paid/list. Use mock estimates only and label them illustrative. No accrual or payment computation.

### 27. Teacher Payouts — `/teacher-payouts`

**Sidebar icon:** `HandCoinsIcon`.

Optional commissions module with payout list and lecturer detail using `teacher_payout` and `commission_entry`. Filters lecturer, period, status draft/approved/paid. Table: lecturer, period, gross collected/base, commission, net payable, status, paid date/reference. Draft preview groups accrued and reversal entries; actions preview, create draft, approve, pay with payment reference/proof placeholder, discard draft. Confirmation screens explain approval freezes totals and paid payouts are immutable. Provide entry-level breakdown and carry-forward context for negative reversals. UI-only; never calculate or settle real commissions.

### 28. Organization — `/organization`

**Sidebar icon:** `Building2Icon`.

Settings form for the single `organization` row: name, type (individual/institution), currency, timezone, guardian-required-below-age, overdue grace days/action (none/notify/restrict/notify and restrict), discount commission basis (paid/list), enabled modules. Organize into General, Student & billing rules, Modules. Mark signing key reference as configured/not configured with a masked reference only; no secret input display. Explain module switches gate features; do not delete feature data. Include saved/unsaved UI state only.

### 29. Branches — `/branches`

**Sidebar icon:** `MapPinIcon`.

Directory based on `branch`: branch name, address, phone, default and active indicators, student/course/bank-account counts. Add/edit form for name/address/phone, default, active. Show branch as the scope shared by courses, students, invoices, payments, receipts, and bank accounts. Do not offer destructive delete for a branch with dependent data; use an inactive state in the demo.

### 30. Users & Roles — `/users-roles`

**Sidebar icon:** `ShieldCheckIcon`.

Tabs Users, Roles, Assignments, Permissions based on `user`, `role`, `permission`, `role_permission`, and `staff_role_assignment`. Users table: email/username, phone, active/disabled, last login, assigned roles/branches, linked profile badges. Role editor shows permissions by code/description; assignment supports user, role, branch or all branches (null branch). Mask credentials; never display password hashes. Highlight that one user may also have lecturer/student/guardian profiles and that built-in/system roles cannot be deleted. Warn if an action would affect the last root admin, but do not implement authorization logic.

### 31. Audit Log — `/audit-log`

**Sidebar icon:** `ScrollTextIcon`.

Read-only append-only register based on `audit_log`. Filters date/time, actor, action, entity type/id. Table: timestamp, actor (or System), action, entity, reason. Detail drawer shows before/after JSON in a readable, syntax-styled view and linked entity ID; paginate and search. No edit/delete controls. Use safe truncation for large values and keep sensitive values masked in mock records.

### 32. Integrations — `/integrations`

**Sidebar icon:** `PlugZapIcon`.

Settings overview for module-backed external connections: gateway and `gateway_transaction` statuses; email/SMS/web push channels in `notification_channel`; push subscriptions summary; file-storage status as a non-secret placeholder. Show connection state, provider name, last activity/sample status, enabled module/channel, and “Configure” dialogs with masked credential placeholders. Never reveal or request raw signing keys, passwords, card details, or provider secrets. Gateway transaction statuses are initiated/succeeded/failed/cancelled. No real connection test or network calls.

## Build sequence and completion checks

Implement in the same sidebar order, in small batches, keeping routes and breadcrumbs aligned with `navigation.ts`. Start by replacing the dashboard demo with domain-appropriate UI and establish any reusable page header, filter bar, table, status badge, and detail drawer patterns using the existing UI components. Then implement each destination separately. Keep mock fixtures centralized and clearly fake, avoid duplicating inconsistent student/course/payment records across pages, and do not change the database package.

For every route, ensure it loads inside the existing shell; the correct sidebar item is active; breadcrumb shows the current destination; title/description/actions match the page; table/form content reflects the mapped schema; icons match the navigation; empty and narrow-screen layouts remain usable; and every interactive element has a clear local demo response. Do not add or run tests unless separately requested.
