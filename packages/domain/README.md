# @workspace/domain

Service layer of the student management system: the business rules the database cannot enforce (see "What is still the application's job" in the
[`@workspace/db` README](../db/README.md)), written as typed services over Drizzle. They run against the production `createDb` object and against PGlite in tests.

Server-only. The entry point is guarded with the `browser` export condition, so importing it into a browser bundle fails the build.
It depends on `@workspace/db` for the schema (`@workspace/db/schema`) and money helpers (`@workspace/db/money`).

## Layout

| File | What it holds |
| --- | --- |
| `src/types.ts`, `src/errors.ts` | `Db` and `Tx` types, `ServiceError` with its `code` |
| `src/payments.ts`, `src/allocation.ts`, `src/receipts.ts` | submit, verify, reject, void, cash, allocation, signed receipts |
| `src/enrollment.ts`, `src/invoicing.ts`, `src/invoices.ts`, `src/fee-exceptions.ts` | enrolment, recurring and package invoices, adjustments, fee exceptions |
| `src/commissions.ts`, `src/payouts.ts` | commission accrual and reversal, teacher payouts |
| `src/promotion.ts` | yearly promotion |
| `src/access.ts` | effective access (C8) and the overdue job (C9) |
| `src/dates.ts`, `src/lookups.ts`, `src/audit.ts` | date helpers, organization and rate lookups, audit rows |

Import everything from the package root: `import { createPaymentService, ServiceError } from "@workspace/domain"`.
Database client: `@workspace/db/client`. Money helpers (`toCents`, `fromCents`): `@workspace/db/money`.

## Services

This package holds the business logic that the database cannot enforce, as typed functions over Drizzle. They work with the production
`createDb` object and with PGlite in tests. Services so far: payments and receipts, enrolment, invoice generation, fee exceptions, commission accrual, yearly promotion, teacher payouts, effective access and the overdue job.

```ts
import { createDb } from "@workspace/db/client";
import { createPaymentService, hmacSigner, verifyReceipt } from "@workspace/domain";

const { db } = createDb(process.env.DATABASE_URL!);
const payments = createPaymentService(db, {
  signer: hmacSigner(process.env.RECEIPT_SIGNING_SECRET!),   // key stays out of the database
  hooks: { afterVerify, afterVoid },                          // later services join the same transaction
});

const p = await payments.submitPayment({ studentId, branchId, paymentMethodId, bankAccountId, slipFileId, amount: "1500.00", referenceNo, submittedBy });
const done = await payments.verifyPayment({ paymentId: p.id, verifiedBy, invoiceIds: [invoiceId] });  // allocate, caches, receipt
await payments.rejectPayment({ paymentId, rejectedBy, reason });
await payments.voidPayment({ paymentId, voidedBy, reason });
await payments.recordCashPayment({ studentId, branchId, amount, recordedBy, invoiceIds });
const check = await verifyReceipt(db, verificationCode, signer);   // for the public verify page
```

What they do, by rule: E3 and E4 (verification and allocation in one transaction, no advance payments), E5 (never more than an item's net outstanding, where allocations recorded under a linked line count as paid on the root item,
with invoice rows locked in id order), E7 (default split: oldest due date first, pro rata across payable items with largest-remainder rounding, or explicit
item lines), E1 and E16 (invoice and installment caches re-derived in the same transaction), E8, E9 (void reverses allocations, voids the receipt),
E11 (cash), E12 and E13 (one signed receipt per payment, number from the branch counter), J3 (audit rows). Domain errors are `ServiceError` with a `code`.
Pure arithmetic (`splitProRata`, `planAllocation`, `waterfall`, status derivation, money in cents) is exported and unit tested.

Receipts: the hash is SHA-256 of a fixed-order text of the receipt number, branch, payment, student, amount, verification time and active allocations.
The signature is `signer.sign(hash)`. `verifyReceipt` rebuilds the data from the database, so any later change to the data, or a forged hash or signature, shows as invalid,
and a voided receipt shows as void. The default signer is HMAC-SHA256 with a shared secret. Use a public-key signer (same interface) if third parties must verify offline.

The row locks (`FOR UPDATE` on the payment and the invoices) cannot be exercised by PGlite, which has one connection. Before going live, run two simultaneous verifications of the same payment, and two payments on the same invoice, against a real PostgreSQL database. Both should leave consistent totals, and the second verification of one payment should fail with `payment_not_pending`.

### Enrolment, invoicing and fee exceptions

```ts
import { createEnrollmentService, createInvoicingService, createFeeExceptionService } from "@workspace/domain";

const enrolment = createEnrollmentService(db);
const invoicing = createInvoicingService(db);
const exceptions = createFeeExceptionService(db);

const { enrollment, invoiceId } = await enrolment.enrollStudent({ studentId, courseId, intakeId, feeStructureId, installmentOptionId });
await enrolment.dropEnrollment({ enrollmentId, actorUserId, reason });

const report = await invoicing.generateRecurringInvoices({ branchId });   // run daily from a scheduled job; safe to run twice
await invoicing.addInvoiceLine({ invoiceId, kind: "discount", amount: "-500", appliesToItemId, description, createdBy, reason });
await invoicing.cancelInvoice({ invoiceId, cancelledBy, reason });

await exceptions.createFeeException({ enrollmentId, kind: "discount", discountType: "percent", discountValue: "25", effectiveFrom, reason, createdBy });
await exceptions.endFeeException({ exceptionId, endedBy });
```

By rule: C1 to C6 and C10 (course open, student active, intake rules, one active place, capacity counted under a lock on the course row (the course limit applies to enrolments without an intake, an intake's own capacity to its enrolments), grade list with an audited override),
D1 (fee option: the one given, else the default, else the only active one; a course with no fee structure at all is free and is enrolled with no fee option and no invoice; otherwise `fee_structure_required`), D6 (rate by billing grade, then grade on the period start, then the all-grades rate;
a missing rate is reported and nothing is billed, never zero), D7 (one recurring line per enrolment and period, so generation is idempotent), D8 and D23 (signed lines, totals re-derived from them),
D9 and D19 (a 100% discount gives a zero `waived` invoice), D10 and D25 (installment schedule, surcharge as an adjustment line, unpaid installments re-spread after an adjustment; when every installment is already paid, a positive adjustment gets one new installment for the extra balance, due 7 days from today or after the last installment, whichever is later),
D12 (package invoice at enrolment, access end = start + months), D17 to D22 (fee exceptions, module check only when creating), D24 (one invoice per student, branch and due date),
D26 (invoices are append-only: cancel only without payments), C7 (drop), B5 and B7 (grade on a date, student_branch).

Implementation choices to review:
- Monthly fees bill calendar months, starting with the month of `access_starts_on`, with no proration for a mid-month start.
- A per-term fee bills the course's academic term once (`term.starts_on` to `ends_on`). A course without a term is reported as a failure.
- Generation bills every missing period whose start is on or before today (plus `leadDays`) and before `access_ends_on`, oldest first, at most `maxPeriodsPerEnrollment` (12) per run.
- Due date is the period start plus `dueAfterDays` (7), but never before today. Periods with different due dates become separate invoices.
- A discount exception becomes a negative `discount` line linked to the fee line and the exception. An alternate option replaces the fee structure for its dates only, and the enrolment is never rewritten. It must bill on the same cycle (monthly or per term) as the enrolled option, because periods are built from the enrolled one; the generator also reports a mismatched alternate as `fee_structure_invalid` and bills nothing for that period. If another run bills some periods of a group first, the generator drops those periods (counted as already invoiced) and inserts the rest.
- Dates such as `enrolled_on`, `paid_on` and invoice issue dates use the organization's time zone, not UTC.
- Dropping an enrolment sets access to end today (or the next day if it started today).
- Not done yet: proration, promotion confirm (it will call `enrollStudent` with `promotedFromEnrollmentId`), and the overdue job.

### Commission accrual

```ts
import { createCommissionService, createPaymentService, combineHooks } from "@workspace/domain";

const commissions = createCommissionService();
const payments = createPaymentService(db, { signer, hooks: commissions.hooks });   // or combineHooks(commissions.hooks, otherHooks)
```

Accrual runs inside the verification transaction (`afterVerify`), and reversal inside the void transaction (`afterVoid`), so a failure in either rolls the whole payment step back.
`commissions.accrue(tx, event)` returns what it created and what it skipped (with a reason such as `no_rule`), so gaps can be reported.

By rule: H1 and H2 (base = basis-adjusted allocation x the lecturer's share, one entry per allocation and lecturer, split with largest-remainder rounding),
H4 (most specific rule in effect: course, subject plus grade, subject, lecturer default; `pickRule` is exported), H5 (percent of the base; fixed per student month split by share,
accrued in proportion to what is paid, and the last payment of an item takes the remainder so the total is exact), H6 (rule, rate, share and basis snapshotted on the entry),
H7 (void: unsettled entries become `void`, settled ones get one negative reversal entry), H9 (module off: nothing accrues, but voids still unwind earlier entries),
H10 (`paid` basis uses the money allocated, `list` scales it to the list price), H11 (fee items only), H12 (commission capped at the base, `capped = true`).

Things to know:
- A lecturer with no matching rule accrues nothing (the institute keeps no commission on that fee). It shows in `skipped`.
- Course shares are not validated to sum to 100 here (H3 is checked when the course is saved), so a course whose shares sum to less than 100 simply accrues less.
- Rule dates are compared with the day of verification in the organization's time zone, not the invoice period.
- If a payment is voided after its entries joined a draft payout, a reversal is added (as for settled entries). The payout service takes that reversal into the draft when the draft is approved (see Teacher payouts).

### Teacher payouts

```ts
import { createPayoutService } from "@workspace/domain";
const payouts = createPayoutService(db);

const r = await payouts.createPayout({ lecturerId, periodEnd: "2027-04-01", createdBy });   // { status: "created", payout, entryIds } or { status: "carried_forward", reason, net, ... }
await payouts.approvePayout({ payoutId, approvedBy });                                      // rebuilds draft totals, then freezes them
await payouts.markPaid({ payoutId, paidBy, paymentReference: "TRX-1042", paidOn, proofFileId });
await payouts.discardDraft({ payoutId, discardedBy, reason });                              // entries return to accrued
const pending = await payouts.previewPayout({ lecturerId, periodEnd });                     // read-only: what a payout would hold now
await payouts.getPayout({ payoutId });  await payouts.listPayouts({ lecturerId, status });
```

By rule: H8 (a payout takes the lecturer's accrued entries, accruals and negative reversals, and marks them settled; it is inserted with its final totals and the totals are
re-added from the entries in the same transaction; a paid payout is immutable; a negative net creates no payout and the entries carry forward), H7 (reversals are deducted in the next payout),
H9 (every payout action needs the commissions module), J3 (audit rows for create, approve, pay and discard).

Behaviour to know:
- **Period end is a cut-off, not a filter.** A payout takes every unsettled accrued entry created before the start of `periodEnd` (organization time zone), including entries from before `periodStart`. This is what makes carry-forward work: nothing is ever stranded in an earlier period. `periodStart` defaults to the end of the lecturer's previous payout, else the day of the oldest included entry, and only labels the payout. Payouts of one lecturer cannot overlap, and a period cannot end after tomorrow.
- **Carry-forward.** If the net is zero or negative, or no entries exist, nothing is created and the result is `carried_forward` with a reason (`no_entries`, `net_not_positive`). Gross and commission totals are signed sums, so a reversal can make either negative while the net stays positive; only the net decides.
- **Draft totals are rebuilt at approval.** If a payment in a draft was voided, its reversal is pulled into the draft, which removes that entry from the payout. If nothing payable is left, approval fails with `payout_nothing_to_pay` and changes nothing; discard the draft and create a new one.
- **Approved totals are fixed.** A payment voided after approval adds a reversal that is deducted from the lecturer's next payout, so the approved amount is the amount to transfer.
- Only a draft can be discarded (the database refuses to delete an approved or paid payout). A zero-net payout is never created, so `paid` always means money was sent.
- Separation of duties (creator, approver and payer being different people) is not enforced here. Do it with permissions in the app if the institute wants it.

### Access and overdue

```ts
import { createAccessService, createPaymentService, combineHooks, hasAccess, accessState } from "@workspace/domain";

const access = createAccessService(db);
const payments = createPaymentService(db, { signer, hooks: combineHooks(commissions.hooks, access.hooks) });   // verify and void re-check overdue state

const result = await access.runOverdueJob();          // run daily from a scheduled job; safe to run twice
const state = accessState(enrollmentRow, today);       // { allowed: true } or { allowed: false, reason: "not_active" | "not_started" | "ended" | "restricted" }
await access.getAccess({ enrollmentId });             // the same, on today's date in the organization's time zone
await access.recheckStudent(tx, studentId, actorId);   // call after anything that changes what a student owes
```

By rule: C8 (`accessState` and `hasAccess` are the one place that decides effective access; route guards, jobs and notification code should all call it), C9 (overdue status,
restrict and restore), J1 and J2 (overdue notifications), J3 (audit rows for every restrict and restore).

Behaviour to know:
- **Overdue means past the grace period.** An invoice is overdue from the day after `due date + grace days`. With installments each unpaid installment is judged by its own due date and the invoice follows. A part-paid item is still unpaid, so it stays overdue.
- **Settings.** Grace days and action come from the fee option of the invoice's earliest fee line, field by field, else from the organization. An invoice that mixes classes with different settings follows its earliest fee line.
- **Action `none`** still moves the invoice and installments to `overdue` (a label for staff) but notifies and restricts nothing. `notify` only notifies, `restrict` only restricts.
- **Restrict and restore are per enrolment.** Every active or completed enrolment with a fee line on a past-grace invoice whose action includes restrict becomes `restricted`. It is restored only when no such invoice remains unpaid, so paying one of two overdue invoices keeps the restriction. Dropped enrolments are never touched. A restriction is a billing overlay: C8 reads it, nothing else changes.
- **Verified payment and void.** The hooks run the same reconcile for the payment's student in the same transaction. A verified payment that clears the last overdue invoice restores access straight away (the verifier is the audit actor, which matches "access returns after staff verify the payment"). A void that leaves an invoice unpaid and past grace marks it overdue and restricts again at once. The daily job writes audit rows with no actor.
- **Statuses go back too.** If an invoice or installment is no longer overdue (grace changed, due date moved) it returns to pending or partial.
- **Notifications.** One row per recipient, channel and overdue item (invoice, or installment number), event `installment_overdue`, so reruns add nothing. Recipients are the student's portal user and, when the `parent_portal` module is on, guardians with a portal login. Channels are in-app always, plus email, SMS and push only when the module and the channel switch are both on. In-app rows are `sent`, external ones `queued` for the dispatcher (see Notifications below). A student with no portal login still gets the status and restriction, but no notification (the table needs a user).
- Invoices with no fee line (content only) get the overdue status and notification but restrict nothing.
- The job reconciles each student in a transaction of their own and reports failures in `errors` rather than stopping.
- The "due soon" reminder (`installment_due`) and the dispatcher that sends the queued email, SMS and push rows are described under Notifications below.

### Notifications

```ts
import { createNotificationService, createTextLkSms } from "@workspace/domain";

const notifications = createNotificationService(db, {
  providers: {
    sms: createTextLkSms({ apiToken: process.env.TEXTLK_TOKEN!, senderId: "MyInstitute" }),
    email: async ({ to, subject, body }) => { /* your mailer; throw on failure */ },
    push: async ({ subscription, title, body }) => { /* web-push; throw on failure */ },
  },
});

await notifications.runDueSoonJob({ leadDays: 3 }); // run daily: queues installment_due reminders
await notifications.dispatchQueued({ limit: 100 }); // run every minute or so: sends queued email, SMS and push
await notifications.retryFailed();                  // after fixing a provider key
await notifications.listInApp({ userId, unreadOnly: true });
await notifications.markRead({ userId, ids });
```

- J1, J2: `queueNotifications` (shared with the overdue job) makes one row per recipient, channel and item. In-app rows are `sent` at once; email, SMS and push rows exist only when the module flag and the channel switch are both on, and start `queued`.
- The dispatcher locks each row (`FOR UPDATE SKIP LOCKED`), so two workers never send the same row. A row ends `sent` or `failed` with the reason (no phone, bad number, no subscription, provider error, channel switched off after queueing, inactive user, no provider configured). Failed rows are not retried by themselves.
- Templates use `{{student_name}}` or `{{studentName}}`; without a template for the channel a built-in text is used.
- "Due soon": every unpaid installment (or unpaid invoice without installments) due from today up to `leadDays` ahead, both ends inclusive. One reminder per item for good, whatever the number of runs. The amount in the message is what is still owed.
- `createTextLkSms` follows the text.lk v3 plain SMS API; numbers are normalised to `94XXXXXXXXX`. Email and push are provider callbacks you supply.

### Attendance

```ts
import { createAttendanceService } from "@workspace/domain";
const attendance = createAttendanceService(db);

const session = await attendance.createSession({ courseId, sessionDate: "2027-03-10", startsAt: "16:00", endsAt: "18:00" });
const { students } = await attendance.getRoster({ sessionId: session.id });
await attendance.mark({ sessionId: session.id, entries: [{ studentId, status: "present" }], actor: staffUserId });
await attendance.markRemainingAbsent({ sessionId: session.id, actor: staffUserId });
await attendance.markByQr({ sessionId: session.id, qrToken, actor: staffUserId }); // needs the qr_attendance module
await attendance.rotateQrToken({ studentId });                                      // lost card
await attendance.studentSummary({ studentId, courseId, from: "2027-03-01", to: "2027-04-01" });
```

- A session needs a course with attendance on. The roster is the students with an active enrolment whose access window covers the session day (end exclusive), in the session's intake when it has one. Billing restriction does not remove a student from the roster; `restricted` is returned so staff can see it.
- Marking is allowed on the session day or later, never before, and never on a cancelled session. A later mark corrects an earlier one. Marking sets the session to `held`; a session with marks cannot be cancelled.
- `attended_via` is filled for present and late: the session's mode, else the explicit value, else the enrolment's preferred mode (hybrid sessions need one of these). Absent and excused have none.
- Newly absent students: their guardians with portal access get an `attendance_marked` notification (in-app plus any enabled SMS/email/push), once per session and student. Guardians registered through `createStudentService` always have a login record, so they are reachable; guardians created by hand or import need `provisionGuardianLogins()` once.
- QR: scanning twice changes nothing; an earlier absent or excused mark is corrected to present (or late).
- `studentSummary` rate = (present + late) / (present + late + absent); excused sessions are left out; cancelled sessions are ignored.
- Class capacity (C5) is enforced at enrolment, see the enrolment service.

### Student registration

```ts
import { createStudentService } from "@workspace/domain";
const students = createStudentService(db);

const { student, guardians } = await students.register({
  fullName: "Nimal Perera",
  dateOfBirth: "2015-05-01",
  gradeLevelId,
  guardians: [{ fullName: "Kamala Perera", phone: "077 123 4567", address: "12 Lake Road, Kandy" }],
});
await students.provisionGuardianLogins(); // one-off, for guardians entered before this rule or imported
```

- B1, B2: name and date of birth are required. A student younger than the organization's `guardian_required_below_age` on the registration day needs at least one guardian with name, phone and address; the limit is exclusive (a student who has just turned 16 needs none).
- Each guardian gets a lightweight login record automatically: a user named `parent-94XXXXXXXXX` with the phone number, the email when given and free, no password (no sign-in until the parent is invited and sets one), and `portal_enabled` on. This is what lets absence and payment notices reach a parent, because notifications belong to users. The parent portal module still decides whether parents can use it.
- A guardian whose phone number matches an existing guardian is the same person (a sibling's parent) and is linked, not duplicated. Numbers are stored as `94XXXXXXXXX`.
- Student numbers are generated (`STU-000001`, ...) unless one is given. A grade starts a `student_level` on the registration day.

### Exams

```ts
import { createExamService } from "@workspace/domain";
const exams = createExamService(db);

const q = await exams.createQuestion({ lecturerId, body: "2 + 2 = ?", options: [{ body: "3", isCorrect: false }, { body: "4", isCorrect: true }] });
const exam = await exams.createExam({ lecturerId, title: "Unit 1", mode: "online_mcq", courseIds, opensAt, closesAt, timeLimitMinutes: 30, maxAttempts: 2, lockAnswers: false });
await exams.setQuestions({ examId: exam.id, questions: [{ questionId: q.id, marks: 2 }] });
await exams.publishExam({ examId: exam.id });                 // freezes the questions, notifies students

const { paper } = await exams.startAttempt({ examId: exam.id, studentId });   // or resumes the running one
await exams.saveAnswers({ attemptId: paper.attemptId, studentId, answers: [{ examQuestionId, selectedOptionKey: "B" }] });
await exams.submitAttempt({ attemptId: paper.attemptId, studentId });

await exams.closeExam({ examId: exam.id });
await exams.releaseResults({ examId: exam.id });
await exams.getResultForStudent({ examId: exam.id, studentId });             // G9 visibility
await exams.enterMarks({ examId: paperExamId, entries: [{ studentId, marks: 72.5 }], actor });
await exams.overrideResult({ examId: exam.id, studentId, marks: 3, reason: "Question 2 was ambiguous", actor });
await exams.runReleaseJob();            // daily or hourly
await exams.finalizeExpiredAttempts();  // every few minutes
```

- G4: publishing copies each question and its options (with correct flags) into `exam_question.snapshot`; options are keyed A, B, C by position. The exam's total marks become the sum of the question marks. Later question-bank edits never reach a published exam. A question has exactly one correct option.
- G1, G3: a student may start only with effective access (C8) in an attached course; the enrolment used is stored on the attempt. G2: the attempt limit counts the student's attempts in the exam across all attached courses; two simultaneous starts are settled by the unique indexes.
- G6: the window and time limit use server time. An attempt ends at the earlier of its time limit and the closing time. Answers cannot be saved after that. An attempt that runs out of time (or is cut off by closing the exam) is graded from the answers already saved and gets status `expired`; it still counts for the result and the attempt limit.
- Answer locking, chosen per exam (`lockAnswers`, default off): off means a student can change or clear an answer until the attempt ends; on means the first choice is final (`answer_locked` on a change or clear; saving the same choice again is accepted, so network retries are safe; a batch with a refused answer saves nothing). The student's paper carries `lockAnswers` so the screen can disable chosen options. Either way every choice should be saved as it is made, so nothing is lost if the connection drops.
- G5: answers store the option key; grading reads only the snapshot. The student's paper never contains correct flags or explanations.
- G7: after each finished attempt the result follows the counted attempt (`best`: highest score, earliest on a tie; `latest`: highest attempt number) until it is released or overridden. Paper exams get results only through `enterMarks` (within the total marks).
- An exam's total marks must fit numeric(8,2) (999999.99): `setQuestions` refuses a larger sum (counting the bank's default marks) before replacing anything, and `publishExam` refuses an older draft that is already over it, both with `exam_invalid`.
- `getResults` and `enterMarks` take an optional `branchIds`: only results recorded in courses of those branches are returned and counted (or may be written; an entry outside it fails the batch with `forbidden` and nothing is saved). A new result for a student in several attached courses is recorded in an in-scope one. `examResultScope(db, user, code, examId)` gives the set for a caller (`"all"` for the owner and all-branches staff).
- G8: results are released only for a closed exam. An online exam past its closing time is closed first. A paper exam must be closed by hand. After release, `enterMarks` (paper) and `overrideResult` (online, sets `manual_override`) need a reason and write an audit row (J3).
- G9: `immediate` shows the score as soon as it exists, marked provisional until released; `after_release` and `manual` show nothing until released. The release job releases `immediate` and `after_release` exams after they close; `manual` ones wait for `releaseResults`. The same rule covers an attempt's own score: `submitAttempt` returns `score: null` and `getAttempt` returns `score: null, scoreHidden: true` while an `after_release` or `manual` result is unreleased (the stored score is unchanged). Student calls (`getAttempt`, `saveAnswers`, `submitAttempt`, `startAttempt`) only ever finalize that student's own attempts; `finalizeExpiredAttempts` is the unrestricted path. `saveAnswers` and `submitAttempt` re-check the deadline under the attempt's lock: an attempt that expired meanwhile is finalized and committed as `expired`, then `saveAnswers` answers `attempt_time_over` and `submitAttempt` returns the expired attempt. `attendance.studentSummary` rejects impossible `from` or `to` days with `invalid_input` (`from` inclusive, `to` exclusive).

### Content

```ts
import { createContentService, createPaymentService, combineHooks } from "@workspace/domain";
const content = createContentService(db);
const payments = createPaymentService(db, { signer, hooks: combineHooks(commissions.hooks, access.hooks, content.hooks) });

const item = await content.createItem({ lecturerId, kind: "recording", title: "Lesson 1", externalUrl: "https://youtu.be/...", accessType: "paid", price: 500, branchIds });
await content.setStatus({ contentId: item.id, status: "published" });
await content.attachToCourse({ courseId, contentId: item.id, sectionId });

await content.listForStudent({ studentId });                  // { available, store, purchases }, no links
await content.openContent({ studentId, contentId });          // the link or file id, only when F3 allows it
const { invoiceId } = await content.purchase({ contentId, studentId, branchId });   // pending purchase plus its invoice
await content.handOver({ purchaseId, handedOverBy: staffUserId });                  // physical books, after payment
await content.pendingHandovers({ branchId });
```

- F1, F2: a recording needs a web link, a file item needs an uploaded file, a physical book has neither and can only be sold. Only paid items have a price (above zero). Paid and free-for-registered items must be listed in at least one branch. Items start as drafts; draft, published and archived move as `setStatus` allows.
- F3: `canViewContent` / `openContent` decide in one place. A student can open a published item that is in a course where they have effective access (C8), or a `free_registered` item listed in a branch they belong to, or an item they have bought. Drafts and archived items close for course and free access. A physical book can never be opened.
- F4: a purchase makes a pending purchase and one invoice with a single `content` line (price copied from the item, due 7 days after issue by default, D13 branch rules apply). Pending grants nothing. When the invoice is fully paid (through the normal slip, verify and receipt flow) `content.hooks` turn the purchase `paid`, which is permanent: archiving the item later does not take it away.
- Voiding the payment turns a digital purchase back to `pending` and closes access. A physical item that was already handed over stays `paid` (the record of the handover is kept) while the invoice shows the money owed again; staff resolve it.
- F5: one pending or paid purchase per student and item. Asking again while one is pending returns it (`existing: true`); once paid, `already_purchased`. A cancelled purchase can be bought again with a new invoice.
- `cancelPurchase` cancels a pending purchase and its invoice, and is refused once any payment is allocated.
- F6: physical books use channel `physical`, digital items `online`. `handOver` needs a paid purchase, records who and when, and can happen once. Payment and handover are separate events.
- Overdue handling is unchanged: an unpaid content-only invoice gets the overdue label and notice but never restricts class access (C9).

### Guardians
```ts
const guardians = createGuardianService(db);
await guardians.update({ guardianId, actor, fullName, address, nic, email });   // details; the phone has its own method
await guardians.changePhone({ guardianId, actor, phone });                       // moves the parent's login (username parent-<phone>), ends their sessions
await guardians.link({ studentId, actor, fullName, phone, relationship, isPrimary });  // a known phone links the same person; the first guardian is primary
await guardians.updateLink({ studentId, guardianId, actor, relationship, isPrimary: true });
await guardians.unlink({ studentId, guardianId, actor });                        // removes the link only; promotes the next guardian if the primary left
```
- Needs `guardians.manage`: student-level calls in the student's branches, guardian-level calls in any branch of any of the guardian's children.
- A student under the guardian-required age keeps at least one guardian. A phone number another guardian or login already has is refused (`phone_taken`).

### Commission rules
```ts
const rules = createCommissionRuleService(db);
await rules.create({ actor, lecturerId, scope: { courseId }, calcType: "percent", rate: "20", effectiveFrom: "2027-01-01", effectiveTo: "2027-12-31" });  // -> { rule, warnings }
await rules.end({ ruleId, actor, effectiveTo });   // closes or shortens, never extends
await rules.remove({ ruleId, actor });             // only if no earning used it
await rules.list({ actor, lecturerId, activeOn });
```
- `scope` is one of `{ courseId }`, `{ subjectId }`, `{ subjectId, gradeLevelId }` or `{}` (every course of the lecturer). `effectiveTo` may be left out for an open-ended rule.
- Institute-wide, so every call needs `commissions.manage` as an all-branches role. Rules of the same scope never overlap in dates (`rule_overlap`; the database has the same guard).
- A rate is never edited: end the old rule and create a new one, so past earnings keep their rule (H6). A used rule cannot be deleted (`rule_in_use`).
- A fixed amount above the lowest current fee of the courses it covers returns a warning (H12). Rules can be prepared while the commissions module is off.

### Reports (the owner's)
```ts
const reports = createReportService(db);
await reports.overdue({ actor });                               // unpaid invoices past their due date: totals, aging, per branch, rows with the parent's phone
await reports.collections({ actor, from: "2027-03-01", to: "2027-03-31" });      // money verified in a period (local dates, at most 366 days): by branch, method and day, plus slips still pending
```
- Optional inputs: `branchId` on both reports (one branch, which must be inside the actor's own), and `limit` and `offset` on `overdue` for paging. Without `branchId` each report covers every branch the actor may read.
- Needs `reports.read`, and covers only the branches the actor holds it in (all with an all-branches assignment). The root admin has it from the seed; migration 0012 adds it to existing databases.
- Overdue means unpaid after the due date whatever the stored status says, so it is right before the overdue job runs. Aging buckets are 1 to 30, 31 to 60 and 61 or more days late; a due date of today is not late yet. Totals cover every overdue invoice, the rows are paged.
- Collected money is by verification date in the organization's time zone; a payment voided later is left out.

### Notices
```ts
const notices = createNoticeService(db);
await notices.create({ actor, branchId, title, body, publishAt, expiresAt, targets: [{ type: "grade", id: gradeId }] }); // default target: everyone
await notices.update({ noticeId, actor, title, body, expiresAt });   // wording and expiry only; branch and audience stay as published
await notices.remove({ noticeId, actor });                           // the audit trail keeps what it said
await notices.listManaged({ actor });                                // every notice of the actor's branches (all with an all-branches role)
await notices.listForStudent(studentId);                             // live, in the student's branches, aimed at them
await notices.listForGuardian(guardianId);                           // the union over their children, once each
await notices.listForStaff(userId);                                  // live notices aimed at a role the staff member holds
```
- Writing needs `notices.manage` in the notice's branch; an all-branches notice (`branchId` null) needs an all-branches assignment.
- Targets: `all` (every student and parent in the notice's branches; it cannot be combined with others), `course` (active enrolment), `grade` (current grade), `student`, and `role` (staff only, shown by `listForStaff`). A course or student target must belong to the notice's branch.
- Visible while `publishedAt <= now` and not expired. Notices do not queue SMS or push yet; that comes with the notification wiring.

### Students (reads and edits)

`createStudentService(db)`: `register` (now takes `branchId`, the student joins it as primary), `list({ scope, search, limit, offset })` (scope from `branchScope`, a student in several branches appears once), `get`, `update` (audited with before and after).

`createPromotionService(db)` also has `getRun({ runId })` for the review screen: the run, its items with student names, and counts per decision.

### Authorization

`authorization.ts`. Functions take a `Db` or `Tx` and a user id; roles and permissions stay data.

- `authorize(q, userId, code, { branchId })`: A6. An assignment for that branch or for all branches counts. With no branch given only an all-branches assignment counts. A disabled user holds nothing. The built-in `lecturer` role never grants a branch-wide permission.
- `requirePermission` throws `forbidden`. `authorizeAnywhere` and `branchScope` (`"all"` or a branch list) serve menus and scoped reads (I2).
- `authorizeResource` / `requireResource` (A5): staff covering the resource's branch, or the lecturer who owns the course, content, exam or question, with the `lecturer` role, portal on and the lecturer_portal module on.
- `resolveIdentity` (A1, A3): staff roles, lecturer, student, guardian and which portals are open. `canAccessStudent`: the student, a linked guardian (parent_portal on), or staff with `students.read` in the student's branch.
- `requireModule(q, name)` and `gateModule(db, name, service, jobs)` (K). `createExamService` is gated by `online_exams` and `createContentService` by `content_store`; their scheduled jobs return an empty result when the module is off, payment hooks always pass through.
- Questions belong to the lecturer who created them: `createQuestion` and `updateQuestion` take an `actor` (a user id, or null for a trusted system call) and allow only that lecturer or a root administrator.
- Parent first sign-in: `findFirstLoginUser({ phone })` finds the guardian login by phone while it has no password (parent_portal on, portal enabled, active), `setInitialPassword` saves the first password once, and `resolveIdentity(...).needsPasswordSetup` tells sign-in to open the set-password form.
- `authorizeStudent` / `requireStudent` (I2): staff may use a permission on a student through an all-branches assignment or any branch the student belongs to. A student in no branch is reachable only through an all-branches assignment, so registration takes a `branchId`.
- `createAccessControlService(db)`: `assignRole`, `revokeRole`, `setUserStatus`, `setLecturerPortal`, `listAssignments`. The last active all-branches root admin cannot be revoked or disabled (A7, `last_root_admin`). Role, status and portal changes are audited (J3).

### Yearly promotion

```ts
import { createPromotionService } from "@workspace/domain";
const promotion = createPromotionService(db);

const draft = await promotion.createDraft({ performedBy });                    // effective date defaults to the 1st of next month
await promotion.updateItem({ runId, itemId, decision: "move", toCourseId });    // review: move, stay, skip
await promotion.setEffectiveDate({ runId, effectiveDate });
const result = await promotion.confirm({ runId, confirmedBy });                 // { status: "confirmed", ... } or { status: "blocked", flagged }
await promotion.discardDraft({ runId, discardedBy });
await promotion.clearBillingGrade({ enrollmentId, clearedBy, reason });
```

By rule: B6 and B8 (draft, review, confirm once; nothing changes before confirm; students whose items are all `skip` do not advance), C12 (target = class in the same
course group that serves the next grade, otherwise same subject, branch, primary lecturer and batch label; exactly one match proposes a move, otherwise `needs_review`),
C13 (a move completes the old enrolment with `end_reason = promoted` and `access_ends_on` = the effective date, and opens a new one with `promoted_from_enrollment_id`,
the target's default fee option, and access from the effective date), C14 (the effective date is refused if it is not after the old enrolment started, or if a period past it is
already invoiced for a class being left), C15 (capacity under a lock on the target course; a full target, a duplicate or a class with fee options but no default is not applied; a class with no fee structure at all is free and is joined with no fee option),
B5 (the old grade row ends on the effective date and the new one starts on it), B7 (`student_branch`), B8 stay (billing grade pinned to the grade before promotion)
and the rule for clearing a pin (needs a reason and a fee rate for the current grade), J3 (audit on confirm and discard).

Behaviour to know:
- A draft covers every active student who has a current grade. Students with no grade (for example adults in programs) are not included. Only class enrolments are promoted, not programs.
- Confirm refuses while any item is `needs_review`. If a move cannot be placed, confirm changes nothing, flags those items `needs_review` with a note, and returns `status: "blocked"` with the list. Fix them and confirm again.
- Seats freed by students moving up in the same run count for the class behind them.
- A student with no class enrolment gets a `stay` item (grade only), and a student already at the highest grade gets `skip`.
- A draft goes stale if an enrolment in it ends before confirm (`promotion_stale`). Discard it and build a new one.
- Nothing stops two drafts existing at once. Confirm the one you want and discard the other.

Sign-in itself is in `@workspace/auth` (`packages/auth`). Not yet built: the gateway webhook, and a scheduled worker that calls `runOverdueJob()`, `runDueSoonJob()` and `dispatchQueued()` on a timer.

## Tests

`bun run test` (from this folder) runs everything on an in-process PostgreSQL (PGlite) with the migrations of `@workspace/db` applied. Each file creates its own database, so files never share state.
No test needs a server or a connection string.

| File | Kind | What it covers |
| --- | --- | --- |
| `allocation.test.ts`, `dates.test.ts`, `commission-rules.test.ts`, `payout-totals.test.ts`, `access-rules.test.ts` | pure unit tests, no database | pro rata split, allocation plan, waterfall, invoice status, dates, schedules, discounts, rule matching, payout totals, access and overdue rules |
| `payments.test.ts` | scenario | E rules: submit, verify and allocate, installments, void, cash, receipts, hooks |
| `enrolment.test.ts` | scenario | C and D rules: enrolment, recurring and package invoices, adjustments, cancellation, fee exceptions |
| `commissions.test.ts` | scenario | H rules: accrual and reversal inside verify and void |
| `payouts.test.ts` | scenario | H rules: create, carry forward, approve, pay, discard |
| `promotion.test.ts` | scenario | B and C rules: yearly promotion |
| `access.test.ts` | scenario | C8, C9, J rules: overdue job, restrict and restore, notifications |
| `notifications.test.ts` | scenario | J rules: queueing, dispatcher, retries, text.lk request, due-soon reminders, in-app inbox |
| `attendance.test.ts` | scenario | sessions, roster, marking and corrections, QR, absence notices, summaries |
| `students.test.ts` | scenario | B1, B2: registration, guardian logins, sibling linking, numbering, end-to-end absence notice |
| `exams.test.ts` | scenario | G rules: snapshots, attempts, grading, results, release, paper marks, overrides |
| `authorization.test.ts` | scenario | A5 to A7, K: branch scope, lecturer ownership, portals, last root admin, module switches |
| `content.test.ts` | scenario | F rules: items, who can open what, purchases through payment and void, physical handover |
| `server-only.test.ts` | boundary | the `browser` condition blocks the client bundle and leaves server bundles alone |

Most scenario files tell one story in order (a later test relies on the rows an earlier one left), so run a file whole rather than a single test.
`setup.ts` creates the database, `helpers.ts` has `eq` and `fails`.

The row locks (`FOR UPDATE`) cannot be exercised by PGlite, which has one connection. Before going live, run two simultaneous verifications of the same payment,
two payments on the same invoice, and two payout creations for one lecturer against a real PostgreSQL database.

Payment arithmetic note: lines linked to an item (discounts, reductions, positive adjustments with `appliesToItemId`) change that item's net once through `linkedTotals` and are not payable items of their own; receipt verification fails as `tampered` if the receipt row's branch differs from the signed payload's.

Lock order: anything that locks a student's invoices takes the student row first (`lockStudent`, `FOR NO KEY UPDATE`), then the invoices in id order (`lockInvoice` does both). Payment verify and void, invoice adjust and cancel, the overdue reconcile and branch membership all follow it.

Commission notes: `accrue` skips voided allocations (`allocation_reversed`); fixed commissions split between co-teachers by largest remainder; `reverse` voids an accrual only while it is still unpaid, else reverses the settled entry.

Promotion notes: a move target must serve the promoted grade (`grade_not_allowed`, no override) and must not be a one-time package class; the old enrolment ends on the effective date and stays billable for unbilled months before it; the generator re-checks each prepared invoice against the locked enrolments before inserting; blocked-item flags are written only to items still in the failed state of a still-draft run; clearing a pinned billing grade is checked for every month it affects.

Attendance notes: `createSession` locks the course row; `markRemainingAbsent` runs in one transaction under the session lock and shares its writing code with `mark`.

Notification notes: provider calls time out after `providerTimeoutMs` (default 15 s) and fail the row; `listInApp` filters and limits in SQL and validates `limit`.

Auth notes: `setUserStatus` deletes the user's sessions when disabling; `setInitialPasswordIn(tx, ...)` is the transactional body of `setInitialPassword`, for callers that commit more with it.

Guardian logins: `findGuardianByPhone` matches any stored phone format; `ensureGuardianLogin` reuses only a bare `parent-<phone>` account (else `phone_taken`); `provisionGuardianLogins` returns `{ provisioned, skipped, duplicates, conflicts }`; usernames starting with `parent-` are reserved in `register`.

Guardians: `link` reuses a guardian by phone only inside the actor's branch scope (else `forbidden`); link changes lock the student row first; `changePhone` locks the number and the guardian row and checks login clashes even without a login; `normalizeGuardianEmail` is the one email rule.

Commission rules: dates must be real calendar days, a fixed rate must fit numeric(12,2), `end` and `remove` lock the rule, `remove` reports `rule_in_use` when an accrual wins the race and `not_found` when the row is already gone; the fixed-rate warning names the commission base and respects a rule's grade.

Students: `get` needs the caller's read `scope` and filters enrolments to those branches; birth dates must be real, not future, and an under-age correction needs a linked guardian.

Notices: edits lock the row and keep fields omitted from a patch from the latest row; removal audits the deleted text; grade and course notices follow the grade and the access window in effect today; staff see role notices only.

Reports: `overdue` aggregates in SQL and pages in SQL (fully paid invoices excluded); both reports read in one read-only repeatable-read transaction; `collections` validates real calendar dates.
