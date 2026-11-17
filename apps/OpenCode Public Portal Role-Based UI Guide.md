# OpenCode Guide: Build the Role-Based Public Portal UI

This guide instructs OpenCode to build the public-facing portal UI for the ECLZ project. It is grounded in `packages/db/src/schema/*.ts`, `packages/db/docs/tables.md`, `packages/db/docs/student-management-erd.md`, and `packages/db/docs/student-management-invariants.md` in the supplied repository.

## Product boundary and role model

The public app serves four audiences: **student, lecturer, parent/guardian, and guest**. The guest is a public visitor and can see only the landing page. The landing page is explicitly deferred; for this work, preserve an existing landing page or leave a minimal placeholder if none exists. Do not design the marketing/landing page now. A guest must not see or enter authenticated portal pages.

The authenticated portal must present a different navigation, home page, and available pages according to the active role context:

- **Student** sees their own learning, schedule, attendance, exams/results, fees, communication, and profile.
- **Lecturer** sees their own teaching, course materials, class sessions, attendance, exams/questions/results, communication, profile, and optional own earnings.
- **Parent/guardian** sees only linked children and parent-relevant course, schedule, attendance, exam/result, billing, receipt, and communication information. A parent does not take exams as the child.
- **Guest** stays outside the portal and sees only the deferred landing page.

Important schema detail: one `user` can be linked to several identities at once (staff, lecturer, student, guardian); there is no single `user_type` field. `guardian` is the schema name for the parent/guardian profile. If a signed-in mock account has multiple portal identities, show an **active portal role/profile switcher** in the account menu and switch the UI context explicitly. Do not assume one global role or mix records from multiple identities on one dashboard. Guest is not a database role; it means unauthenticated public visitor.

Portal availability is module/profile dependent: lecturer portal pages are available only when the lecturer portal is enabled for that lecturer and the `lecturer_portal` module is on; parent pages require a linked guardian with `portal_enabled` plus the organization's `parent_portal` module. Student portal identity is linked through `student.user_id`. For this UI-only task, represent these conditions with demo states; do not implement the checks.

## Where to build it

The supplied repository currently contains `apps/admin` and shared `packages/ui`, with no portal app. Keep `apps/admin` unchanged. Build one public Next.js app using the repository's workspace conventions: prefer `apps/web` if that is the repo's public app name; use `apps/public` only if that convention already exists or the project has chosen it. Do not create separate student, lecturer, and parent apps. Put the role-specific pages and layouts inside this single public app, reuse `@workspace/ui`, and follow the existing monorepo configuration.

Suggested URL structure (adjust only to match existing project routing conventions):

| Audience | Route pattern | Notes |
|---|---|---|
| Guest | `/` | Existing landing page or minimal placeholder only; landing design is deferred. |
| Student | `/portal/student/...` | Student-specific shell and pages. |
| Lecturer | `/portal/lecturer/...` | Lecturer-specific shell and pages. |
| Parent | `/portal/parent/...` | Parent-specific shell and pages. |

Role prefixes help keep each layout and route intent clear. A role switch should go to that role's dashboard. Do not let a guest navigate to a portal route: show a simple sign-in-required/access-unavailable UI state or return to `/`; do not build real auth. Do not create a full sign-in experience unless one already exists in the app, since authentication is outside this UI task.

## Shared instruction — include with every page task

> Build the public portal as UI only with realistic local mock data and local component state. Do not connect to or modify the database, schemas, migrations, seed data, DB services, APIs, server actions, authentication, authorization, or email/SMS/push/payment providers. Do not add persistence. Do not claim an action has been saved, sent, verified, paid, submitted, uploaded, graded, or otherwise completed in the real system. Forms and controls may demonstrate local UI states only.
>
> Preserve the existing ECLZ admin design type. Inspect `apps/admin`, `packages/ui/src/styles/globals.css`, `packages/ui/src/components`, and repository instructions before coding. Reuse the Geist typography, Tailwind design tokens, shadcn-style components, neutral palette, border/radius language, light/dark theme, spacing, lucide-react icons, and responsive behavior. Build audience-appropriate public portal layouts within the same visual family: clear, calm, compact, trustworthy, and accessible. Do not redesign the brand, add a different color system or typography, or copy the admin's unrelated commerce demo. The student, lecturer, and parent shells should share design tokens and selected common components but have their own role-appropriate navigation and landing dashboard.
>
> Prefer existing `@workspace/ui/components` (Card, Button, Badge, Input, Select, Textarea, Checkbox, Switch, Dialog, DropdownMenu, Table, Pagination, Avatar, Breadcrumb, Skeleton, Separator, Sheet, etc.). Check exports before using them. Use lucide-react icons. Use semantic headings, accessible labels and keyboard focus, readable contrast, and responsive layouts. Avoid oversized hero sections and dense desktop tables on mobile. Provide populated and empty states. Use consistent local fixtures across dashboards, courses, billing, exams, and messages.
>
> Keep role data private and scoped. A student sees only their own record; a lecturer sees only their own assigned courses, sessions, content, questions/exams, results and applicable earnings; a parent sees only the children linked through `student_guardian`. Never show another student's private details. Do not display raw UUIDs, QR tokens, password hashes, storage keys, receipt signing keys, provider secrets, full bank-account numbers, or card data. Use organization currency (default LKR) and timezone (default Asia/Colombo) in sample dates and amounts. Show optional features as unavailable/module-disabled when relevant.
>
> Treat schema and invariant documents as domain references, not permission to implement their backend rules. Reflect domain states through labels, hints, disabled states, and local demo flows only.

## Common public shell, role layouts, and preview state

Build a shared public shell foundation with a modest ECLZ identity, profile menu, optional notification indicator, responsive navigation, page container, and theme support. Desktop can use the current sidebar visual language; mobile should use a menu/sheet. Avoid duplicating the entire admin shell. Reuse components where helpful, but make each role's navigation and dashboard visibly relevant to that role.

For UI preview only, provide a clear local mock role selector or mock profile data so reviewers can inspect Student, Lecturer, Parent, and Guest experiences. Mark it as a preview/demo control; it is not production login or authorization. A normal signed-in user's role switcher should appear only when the fixture has multiple linked identities. Switching role must change the active shell, route, profile identity, navigation, and mock data as one coherent experience.

Shared components that may help: `PublicPortalShell`, `PortalPageHeader`, `RolePreviewSwitcher` (demo only), `StatusBadge`, `EmptyState`, `CourseCard`, `ScheduleItem`, `InvoiceSummaryCard`, `NoticeCard`, and local mock fixtures. Keep abstractions small and consistent with repo conventions.

## Role-specific navigation

### Student navigation

- Home: Dashboard
- Learning: My Courses, Timetable, Attendance, Learning Materials, Exams & Results
- Fees: Invoices & Payments, Receipts
- Communication: Notices, Messages, Notifications
- Account: My Profile

### Lecturer navigation

- Home: Dashboard
- Teaching: My Courses, Timetable & Sessions, Attendance, Learning Materials
- Assessment: Exams, Question Bank, Results
- Communication: Notices, Messages, Notifications
- Earnings: My Earnings (only when commissions are enabled)
- Account: My Profile

### Parent navigation

- Home: Dashboard
- Children: My Children, Courses, Timetable, Attendance, Exams & Results
- Fees: Invoices & Payments, Receipts
- Communication: Notices, Messages, Notifications
- Account: My Profile

Parent pages must keep a selected-child context visible when the parent has more than one linked student. Do not include student-only exam-taking actions in the parent menu.

## Page-by-page instructions

# Student pages

### 1. Student Dashboard — `/portal/student`

**Icon:** `House` or `LayoutDashboard`.

Build a useful welcome overview for one student. Show name, student number, and grade without a database ID. Include next class (course, date/time, branch/room or online indicator), active courses summary, fees snapshot (next due date and outstanding balance), upcoming exam, recent attendance, recent notices, and recent notifications. Use a compact card grid like the admin app. Use consistent LKR values and coherent linked mock records. Empty states should guide the student to course details, materials, or institute support; do not present sample metrics as live calculations.

### 2. My Courses — `/portal/student/courses`

**Icon:** `BookOpen`.

Show only the student's enrollments and related courses/subjects/intakes/branches/lecturers/grade levels. Tabs: Active, Completed, Past/Dropped. Cards show course name, subject, class/program, teacher(s), branch, delivery mode, grade, status, attendance-enabled state, and intake dates for scheduled programs. Show access state/date range where useful; if restricted, explain that the student should review fees or contact the institute. Do not reveal fee exception reasons or other students. Do not invent self-service enrollment unless an existing defined student enrollment flow is present. Self-paced progress may be shown only as an explicitly illustrative local progress widget, not persisted fact.

### 3. Student Timetable — `/portal/student/timetable`

**Icon:** `CalendarDays`.

Show the student's weekly `schedule_slot` and dated `class_session` records. Provide week/list toggle, date navigation and “Today.” Items show course, date/time, session topic if actual, branch/room, mode, and scheduled/held/cancelled state. Distinguish recurring weekly slots from real dated sessions. Online meeting controls are placeholders; no external launch. Include a clear empty state.

### 4. Student Attendance — `/portal/student/attendance`

**Icon:** `ClipboardCheck`.

Show only the student's own attendance. Summary cards for present/late/absent/excused and a demo attendance rate; history rows show date, course/session, status, physical/online, and manual/QR marking. Add course/date filters and mobile-friendly layout. Students view records; do not add mark/edit controls. QR module may show a card placeholder, but never reveal raw `qr_token`.

### 5. Student Learning Materials — `/portal/student/materials`

**Icon:** `Library` or `FolderOpen`.

Show course content grouped by course and section. Display recording/file/physical book kind, title, description, lecturer, access type and a local open/download preview. Access types are course-only, free for registered students, and paid. Respect the student's mock entitlements: locked content must look locked. Paid store/purchase UI appears only if `content_store` is enabled. Show price and local purchase flow preview; no real payment, download, or storage key.

### 6. Student Exams & Results — `/portal/student/exams`

**Icon:** `FileCheck2`.

Separate available/upcoming, in progress, past, and results. Exam cards show title, course, online MCQ/paper mode, open/close window or exam date, time limit, max attempts, used attempts, and availability. For online MCQ, provide a local instructions screen, mock question-taking UI, timer display, navigation, and submit confirmation; answers remain local. Paper exams show details without a start action. Results show marks/max, grade, remarks, and provisional versus released state. Do not show correct answers before result visibility allows it. Show an unavailable state if `online_exams` is disabled; paper results may remain. Do not implement scoring or time enforcement.

### 7. Student Invoices & Payments — `/portal/student/billing`

**Icon:** `CreditCard` or `WalletCards`.

Tabs Invoices and Payments. Invoice rows show issue/due date, item summary, total, paid amount, balance, and pending/partial/paid/overdue/waived/cancelled status. Detail page shows fee/content/discount/adjustment lines, period, and sequential installment schedule with due/paid amounts. Payment history shows method, date, amount, reference and verification status.

Provide a local “Submit payment” demo: choose outstanding invoices (same student/branch), amount, supported method, bank destination if transfer, reference, date, and slip-upload placeholder, followed by a review state that labels it pending verification. Cash is not a student-submitted method. Gateway placeholder only if enabled; never request card data. Do not implement payment allocation, real uploads, installment arithmetic, or invoice mutation. Do not imply payment is complete before verification.

### 8. Student Receipts — `/portal/student/receipts`

**Icon:** `ReceiptText`.

List only receipts linked to the student's verified payments. Show receipt number, branch, issue date, amount, method/reference, and issued/void state. Detail/preview includes student, branch, amount and verification code in a safe presentation, with a PDF download placeholder. A void receipt must look void; show replacement relation where present. Never show signing key, hash, or storage path.

### 9. Student Notices — `/portal/student/notices`

**Icon:** `Megaphone`.

Show notices targeted to the student's branch, courses, grade, student audience, or everyone. Cards show title, author, publish/expiry date, and audience/course label. Detail shows full body. Unread/read can be local presentation state only; the notice schema does not provide a read field. Do not add persisted priority because the schema has none.

### 10. Student Messages — `/portal/student/messages`

**Icon:** `MessagesSquare`.

Inbox/thread layout using message thread, participants and messages. Show subject, participant names, optional course, last message time and unread state from local/read timestamp fixture. Conversation shows sender, sent time and body. A local composer/new-thread flow may demonstrate UI but must not send externally or claim delivery. Do not show unrelated threads or students.

### 11. Student Notifications — `/portal/student/notifications`

**Icon:** `Bell`.

Show only this student's notification rows with event, channel, queued/sent/failed state, sent time, and read state. Group by date and allow local read/unread filtering. Events can cover payment verified, installment overdue, attendance marked, exam published. In-app is always available; external channels depend on enabled organization settings. Never show provider payloads.

### 12. Student My Profile — `/portal/student/profile`

**Icon:** `UserRound`.

Show student number, name, DOB/age display, gender, school, contact email/phone, optional NIC; branch memberships and join dates; linked guardian contact cards and relationships; current grade and grade history. Only show guardians linked to the student. Allow plausible contact edits in a local-only dialog. Do not allow editing student number, QR token, status, grade history, or guardian links. Do not invent preferences or login fields as persisted schema data.

# Lecturer pages

### 13. Lecturer Dashboard — `/portal/lecturer`

**Icon:** `House` or `Presentation`.

Show a welcome summary for the active lecturer profile: next teaching session, courses taught, attendance needing attention, upcoming exams/results, recent course notices/messages, and optional own earnings/payout state when commissions are enabled. Use only courses assigned through `course_lecturer` and lecturer's branches. Avoid institute-wide or other lecturers' financial data.

### 14. Lecturer My Courses — `/portal/lecturer/courses`

**Icon:** `BookOpen`.

List only courses assigned to this lecturer. Filters branch, class/program, term/intake, grade, status. Cards show subject, course, grade(s), branch, term/intake, delivery mode, enrolled count/capacity as mock data, course co-teachers and this lecturer's share percentage. Detail tabs show course overview, schedule/sessions, assigned content, exams, and attendance summary. Ownership is important: never show controls for an unassigned course. Do not create enrollment, fee, or course administration settings.

### 15. Lecturer Timetable & Sessions — `/portal/lecturer/timetable`

**Icon:** `CalendarClock`.

Show only the lecturer's assigned courses' recurring schedule slots and dated class sessions. Week/list toggle and date navigation. Session details include course, class/intake, time, room/branch or online provider, topic and scheduled/held/cancelled status. Local demo controls may preview “Mark held” or session detail but do not create actual sessions or meeting links.

### 16. Lecturer Attendance — `/portal/lecturer/attendance`

**Icon:** `ClipboardCheck`.

Choose an owned course/session and display enrolled students for that class only. Show present/absent/late/excused, attended via physical/online, marked via manual/QR. Provide a local attendance-marking table with bulk controls and an optional QR scan placeholder if the module is on. Clearly label local demo changes. Do not expose other courses or provide actual QR scanning/persistence.

### 17. Lecturer Learning Materials — `/portal/lecturer/materials`

**Icon:** `FolderOpen`.

Show lecturer-owned `content_item` records and course placements where the lecturer teaches. Tabs by published/draft/archived and kind. Show title, recording/file/book type, access type, listed courses/branches, paid price if relevant, and preview. Local create/edit forms should reflect schema fields (title, description, kind-specific URL/file placeholder, access, price, branch and course section ordering). Do not show raw storage keys or implement uploads/publishing.

### 18. Lecturer Exams — `/portal/lecturer/exams`

**Icon:** `FileCheck2`.

Show only exams owned by this lecturer and attached to their courses. List mode, schedule, attempt/time settings, results visibility and draft/published/closed status. Detail shows attached courses, question count/marks, attempts summary and result release state. Local create/edit preview reflects online MCQ versus paper distinctions. Published question snapshots are immutable; show a lock/state hint. Online exam features depend on `online_exams`; paper exam information/results may remain. No actual publishing/grading.

### 19. Lecturer Question Bank — `/portal/lecturer/questions`

**Icon:** `ListChecks`.

Manage only this lecturer's question-bank items. Search by body, show default marks, image presence, option count. Local editor includes question body, optional image placeholder, explanation, positive default marks, ordered answer options and correctness flags. Show when a question is used in a published snapshot as read-only context. Page is unavailable when `online_exams` is disabled. Do not implement scoring or mutate published snapshots.

### 20. Lecturer Results — `/portal/lecturer/results`

**Icon:** `Award`.

Show result lists only for lecturer-owned exams/courses. Online exams display attempt-derived provisional/final results and release state; paper exams have a local manual entry preview for marks, grade, remarks. Provide a result detail with attempt status/score where applicable. Released-result edits should show a reason/audit warning in the mock UI. Do not expose results from unassigned courses, implement grading, or claim result release is real.

### 21. Lecturer Messages — `/portal/lecturer/messages`

**Icon:** `MessagesSquare`.

Thread list and composer using `message_thread`, participant and message concepts. Show conversations involving this lecturer and optional course context. Local compose/new-thread UI only. No cross-student browsing or external send.

### 22. Lecturer Notices — `/portal/lecturer/notices`

**Icon:** `Megaphone`.

Display announcements targeted to the lecturer or relevant branch/course. Read-only notices list/detail unless the repository defines lecturer notice-authoring permission; do not infer authoring rights from the schema alone. No send/publish behavior.

### 23. Lecturer Notifications — `/portal/lecturer/notifications`

**Icon:** `Bell`.

Display this lecturer's notifications by event/channel/status/read state. Local read/unread filters. Show channel availability from organization/module mock settings, and no provider payload or real send.

### 24. Lecturer My Earnings — `/portal/lecturer/earnings`

**Icon:** `Wallet` or `HandCoins`.

Only show when `commissions` is enabled. This lecturer's own `commission_entry` and `teacher_payout` summaries: accrued/settled/void entries, gross/base, commission, net teacher amount, reversals, and payout draft/approved/paid history with period and reference. Explain that entries are snapshots and reversal lines may be negative. Mask proof file details. Do not expose other lecturers' earnings or implement commission calculations/payout actions.

### 25. Lecturer My Profile — `/portal/lecturer/profile`

**Icon:** `UserRound`.

Show own full name, qualification, bio, teaching branches, portal-enabled/account state and linked contact info when provided by mock user context. Local profile edit may demonstrate name/bio/contact only. Do not let lecturer change course assignment, commission rules, portal access or role; do not reveal auth secrets.

# Parent/guardian pages

### 26. Parent Dashboard — `/portal/parent`

**Icon:** `House` or `UsersRound`.

Show parent greeting and linked child cards. If multiple children, provide a selected-child switcher with current child visibly identified. Summary for selected child: next class, attendance snapshot, upcoming exam/result, outstanding invoices and latest notice. Make every card link retain the selected-child context. Show only children linked through `student_guardian`; do not use a global student directory.

### 27. Parent My Children — `/portal/parent/children`

**Icon:** `UsersRound`.

List only guardians' linked students with relationship, primary marker, student number/name, current grade, primary branch, and active course count. Child detail shows safe summary and links to that child's pages. Do not display or edit the student's full private profile or QR token. If there are no linked students, show a help/contact-institute state.

### 28. Parent Courses — `/portal/parent/courses`

**Icon:** `BookOpen`.

Show courses/enrollments for the selected linked child only. Include course, subject, lecturer(s), branch, grade, status and intake where applicable. Allow switching child. Parent view is read-only and must not expose lecturer-only controls or enrollment mutation.

### 29. Parent Timetable — `/portal/parent/timetable`

**Icon:** `CalendarDays`.

Show selected child's recurring slots and dated sessions; clearly label child context. Include course, time/date, room/branch, online mode and session status. For multiple children, offer child filter and distinguish overlapping events with child name. Meeting links remain placeholders.

### 30. Parent Attendance — `/portal/parent/attendance`

**Icon:** `ClipboardCheck`.

Show selected child's own attendance history and summary (present/late/absent/excused, physical/online, manual/QR). Provide course/date filters and child switcher. Read-only; no staff marking controls. Do not display other students in the session.

### 31. Parent Exams & Results — `/portal/parent/exams`

**Icon:** `Award`.

Show exam schedule and result visibility for the selected child. Display exam title/course/date/window/mode and marks/grade/remarks only when visible according to mock visibility/release state. This is a parent view: no start exam, answer, submit, or attempt actions. Keep provisional and released results clearly distinct. Online exam area follows `online_exams` availability.

### 32. Parent Invoices & Payments — `/portal/parent/billing`

**Icon:** `CreditCard` or `WalletCards`.

Show invoices, installments, balances, and payment history for the selected linked child. Parent can see invoice items/status and submit a payment on behalf of that child in local demo UI. Keep the child identity in the confirmation review and mock payment record. Use bank transfer proof/reference placeholders; gateway only when enabled; no card details or real upload. Payment remains pending verification in the demo. Never mix siblings' balances or invoices into one payment context unless the product schema/service explicitly supports it (payment and invoice are student-scoped).

### 33. Parent Receipts — `/portal/parent/receipts`

**Icon:** `ReceiptText`.

List receipts for the selected child only. Include receipt number, branch/date/amount, method/reference and issued/void status. Provide safe preview/PDF placeholder and replacement relationship. Child selector remains visible. No signatures/keys/hashes exposed.

### 34. Parent Notices — `/portal/parent/notices`

**Icon:** `Megaphone`.

Show notices targeted to the guardian, a linked child's branch/course/grade, or all. Mark which child/audience made it relevant where helpful. Filter by child and date; detail is read-only. Do not invent persisted read or priority fields.

### 35. Parent Messages — `/portal/parent/messages`

**Icon:** `MessagesSquare`.

Show parent-involved threads, course context and linked child context. Local message composer and thread navigation only. Do not expose conversations in which this parent is not a participant or unrelated student discussions. Do not send externally.

### 36. Parent Notifications — `/portal/parent/notifications`

**Icon:** `Bell`.

Show only this guardian user's notification rows, with event, child context where available, channel, status and time. Local read/unread state. Explain external channels depend on enabled settings. No provider error data.

### 37. Parent My Profile — `/portal/parent/profile`

**Icon:** `UserRound`.

Show guardian's own name, phone, address, NIC/email, linked portal state and a summary of linked children/relationships. Local edit preview for contact fields only. Do not change student records or guardian-child relationships. Do not show password/auth data.

# Guest behavior (landing page deferred)

### 38. Guest route/access state — `/`

**Icon:** none required.

Do not design a full landing/marketing page in this task. Preserve one if already present; if absent, use a bare, intentional placeholder that says the public landing page will be designed later. A guest has no portal navigation, profile menu, student data, course data, billing data, or communication records. If a guest opens `/portal/student/...`, `/portal/lecturer/...`, or `/portal/parent/...`, show a restrained sign-in-required/access-unavailable state or return to `/`. This is only a visual mock; do not implement authentication, session handling, redirects based on real roles, or route security.

## Build sequence

1. Read repository instructions and inspect workspace scripts, app conventions, shared UI exports, and the existing admin appearance. Keep `apps/admin` unchanged.
2. Create one public app (`apps/web` preferred unless the repo convention is `apps/public`) and establish the shared public shell, three distinct role layouts/navigation sets, mock role context/switcher, and guest-only route behavior. Keep the landing page deferred.
3. Add small, coherent local fixtures for one student, lecturer, guardian, linked child or children, courses, sessions, attendance, invoices/payments, exams/results, notices/messages/notifications and optional payouts. Keep identity and ownership relationships consistent across pages.
4. Implement pages one role group at a time. Reuse visual components where they fit, while preserving distinct dashboards and menus. Every action stays local/demo only.

## Completion checklist

- One public app contains Student, Lecturer, Parent, and Guest experiences; the admin app remains unchanged.
- Each signed-in role has a distinct home/dashboard, navigation, active profile identity, and page access state.
- A mock user with multiple linked identities can switch active role/profile; the UI does not assume the schema has a single `user_type`.
- Guest can see only the existing/deferred landing page and cannot access portal views in the UI.
- Student records are self-only, lecturer data is limited to assigned/owned items, and parent views are limited to linked children.
- Optional module screens/states reflect organization flags, especially parent portal, lecturer portal, online exams, content store, commissions, gateway, QR attendance, and external notification channels.
- All data and controls are local demo UI. No persistence, API, DB, auth, real upload, real payment, message send, exam grading or notification dispatch is added.
- Existing admin design tokens, typography, component language, and light/dark theme remain intact; public layouts are role-appropriate and responsive.
- Do not add or run tests unless separately requested.
