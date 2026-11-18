# Table guide (72 tables)

What each table stores, grouped by area. "Phase" is the build phase that added it. Almost every table has an `id` (uuid) and many have `created_at`, which are not repeated below.

## 1. Organization, branches and users (core)

| Table | What it stores |
|---|---|
| `organization` | The one customer this deployment belongs to (solo teacher or institution): name, type (`individual` or `institution`), enabled modules (parent portal, exams, commissions and so on), currency, timezone, default overdue rules, the guardian age limit, and the signing key reference for receipts. Exactly one row. |
| `branch` | A physical or logical branch of the organization. A solo teacher gets one automatic branch. Branches own classes, bank accounts, invoices and receipt numbering. |
| `user` | A login account: email, username, phone, password hash, status, last login. Staff, lecturers, students and guardians all log in through a user. |
| `file` | Any uploaded file (payment slips, receipts, book files, exam images, payout proofs): storage key, type, size, who uploaded it. Other tables point at it. |

## 2. Roles, permissions and audit (access)

| Table | What it stores |
|---|---|
| `role` | A named staff role (root admin, student counselor, payment handler, attendance marker, lecturer, or a custom one). |
| `permission` | A single permission code such as `payments.verify` or `fees.override`. |
| `role_permission` | Which permissions each role has. |
| `staff_role_assignment` | Which user holds which role, optionally limited to one branch. |
| `audit_log` | An append-only record of sensitive actions: who, what, which record, before and after values, reason. It cannot be edited or deleted. |

## 3. People (people)

| Table | What it stores |
|---|---|
| `lecturer` | A teacher profile: name, qualification, bio, whether they have portal access. Links to a user if they log in. |
| `lecturer_branch` | Which branches a lecturer teaches in. |
| `student` | A student: student number, name, date of birth, gender, school, NIC, contact details, QR token for attendance, status. Links to a user if they log in. |
| `student_branch` | Which branches a student belongs to, with a primary branch and join date. |
| `grade_level` | The grade list (1 to 13) with stage (primary, junior, O/L, A/L) and order. |
| `guardian` | A parent or guardian: name, phone, address, NIC, email, whether they use the parent portal. |
| `student_guardian` | Links students to guardians with the relationship and a primary flag. |

## 4. Classes, enrolment and attendance (academics)

| Table | What it stores |
|---|---|
| `academic_term` | A term or year period (name, dates, current flag) for term-based fees and reporting. |
| `subject` | A subject (code, name), for example Science or Photography. |
| `course_group` | One teacher covering several grades gets one class per grade, created together. This row ties them as one group (branch, subject, name, batch label). |
| `course` | A class or program: branch, subject, term, kind (`class` recurring or `program` one-time), learning mode, delivery mode, attendance on or off, capacity, status. |
| `course_grade_level` | Which grades a course serves. |
| `course_lecturer` | Which lecturers teach a course, the primary one, and each one's revenue share percent for co-teaching. |
| `intake` | A scheduled run of a program (a batch with start and end dates and capacity). |
| `enrollment` | A student's place in a course: intake, the fee structure chosen, the billing grade, status, access status (active, restricted), and the dates access starts and ends. |
| `schedule_slot` | The weekly timetable: weekday, start and end time, room. |
| `class_session` | One actual class occurrence: date, times, topic, physical or online, and Zoom or Teams link and id. |
| `attendance` | One student's attendance for one session: present or absent, how they attended, how it was marked (staff or QR), who marked it. |

## 5. Yearly promotion (promotion)

| Table | What it stores |
|---|---|
| `promotion_run` | One bulk promotion pass: draft, review, confirmed, with the effective date and note. |
| `promotion_item` | One student's decision in a run: move to the next class, stay, or leave, with the old and new enrolment. |
| `student_level` | The history of grades a student has been in, with date ranges, so billing can find the right grade on any date. |

## 6. Fees, invoices, payments and receipts (billing)

| Table | What it stores |
|---|---|
| `fee_structure` | A way of charging for a course: recurring (monthly or per term) or a one-time package, access duration, overdue grace days and action. |
| `fee_rate` | The price of a fee structure, by grade and date range (for example grade 6 is 1000, grade 7 is 1200). |
| `installment_option` | An installment plan offered on a package: number of installments, down payment percent, days between them, surcharge percent. |
| `fee_exception` | A per-student exception on an enrolment: a different fee option of the same class, or a discount (percent or fixed), with dates and a required reason. |
| `invoice` | The bill header for a student and branch: dates, subtotal, discount, total, amount paid, status. Totals are cached from the items. |
| `invoice_item` | The signed lines of an invoice: fees (positive), discounts (negative), adjustments, content purchases, with the period covered and the enrolment, fee structure and grade used. |
| `invoice_installment` | The installment schedule of an invoice: sequence, due date, amount, paid amount, status (pending, partial, paid, overdue). |
| `payment_method` | The payment methods the buyer offers: bank transfer (default), cash, gateway. |
| `bank_account` | The bank accounts students pay into, per branch. |
| `payment` | A payment submitted by or for a student: amount, method, bank account, slip file, reference number, and its status (pending, verified, rejected, void) with who verified or voided it and why. |
| `payment_allocation` | How a verified payment is split across invoice items. One payment can cover several invoices. Reversed (not deleted) if the payment is voided. |
| `receipt` | The signed receipt issued for a verified payment: per-branch number, verification code, content hash, signature, PDF file, status. |
| `receipt_counter` | The last receipt number used per branch, so numbers never repeat or skip. |

## 7. Content library and store (content)

| Table | What it stores |
|---|---|
| `content_item` | A recording (YouTube link), a file (notes), or a physical book: title, owner lecturer, access type (course only, free for registered students, or paid) and price. |
| `content_branch` | Which branches an item is listed in. |
| `course_section` | An ordered section (module) inside a program. |
| `course_content` | Which content items sit in which course and section, in order. |
| `content_purchase` | A student's purchase of a paid item: branch, online or physical, price, status, and for books who handed it over and when. Billed through a normal invoice. |

## 8. Notices (notices)

| Table | What it stores |
|---|---|
| `notice` | An announcement: author, optional branch, title, body, publish and expiry times. |
| `notice_target` | Who sees a notice: a branch, course, grade or specific audience. |

## 9. Notifications, push and messaging (messaging)

| Table | What it stores |
|---|---|
| `notification_channel` | Which channels the buyer has switched on (in-app, email, SMS via text.lk, web push) and their provider settings. |
| `notification_template` | The message wording per event and channel (payment verified, installment overdue, attendance marked and so on). |
| `notification` | Each message queued or sent to a user: channel, event, a key that prevents duplicates, status, sent and read times, errors. |
| `push_subscription` | A browser's web push registration for a user. |
| `message_thread` | A direct-message conversation (subject, optional course). |
| `thread_participant` | Who is in a thread and when they last read it. |
| `message` | A message in a thread. Only participants can post. |

## 10. Exams (exams)

| Table | What it stores |
|---|---|
| `question` | A lecturer's question bank item: text, image, explanation, default marks. |
| `question_option` | The answer options of a question and which are correct. |
| `exam` | An online MCQ or paper exam: owner, mode, dates or open window, time limit, attempt limit, best or latest scoring, whether answers are locked once chosen, result visibility, status. |
| `exam_course` | Which courses an exam is attached to (branch-specific or shared). |
| `exam_question` | A question placed in an exam with its marks, order, and a frozen snapshot taken at publish so later edits never change it. |
| `exam_attempt` | One try by a student: the enrolment used, attempt number, start and submit times, score, status. |
| `attempt_answer` | The option a student selected for each question, with correctness and marks. |
| `exam_result` | The final result per exam and student: marks, grade, remarks, whether it came from an attempt, was entered by hand, or overridden, and when it was released. |

## 11. Commissions and teacher payouts (commissions)

| Table | What it stores |
|---|---|
| `commission_rule` | What the institute keeps from a lecturer: percent or a fixed amount per student per month, optionally narrowed by subject, grade or course, with dates. |
| `commission_entry` | One earning line per payment allocation and lecturer: the rule and rate used (snapshotted), the base, the commission kept, the amount owed to the teacher, and its status. Reversals are separate negative entries. |
| `teacher_payout` | A settlement paid to a lecturer for a period: gross, commission, net, status (draft, approved, paid), payment reference and proof file. A paid payout cannot change. |

## 12. Online payment gateway (gateway)

| Table | What it stores |
|---|---|
| `gateway_transaction` | An online payment attempt for a payment made through the gateway: provider, the provider's reference, status, and the raw callback data. |

## 13. Sign-in (auth)

| Table | What it stores |
|---|---|
| `auth_session` | A signed-in browser or device: a hash of the session token (never the token), expiry, last use, when the second step was passed, address and browser. |
| `user_two_factor` | A user's authenticator-app setup: the secret (encrypted), when it was turned on, and hashes of the unused recovery codes. |
| `auth_rate_limit` | Attempt counters for sign-in, first login and code entry, one row per key and time window. |

## How the main flow connects

student -> enrollment (in a course, with a fee structure) -> invoice and invoice items -> payment (with slip) -> staff verify -> payment allocation -> receipt -> commission entries -> teacher payout.

Optional modules (parent portal, exams, content store, commissions, fee exceptions, QR attendance, gateway, email, SMS, web push) are switched on in `organization.enabled_modules`. A solo teacher simply leaves most of them off.
