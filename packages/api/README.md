# @workspace/api

The HTTP API (Hono + zod) over `@workspace/auth` and `@workspace/domain`. Server only. It does no business logic of its own: it reads the cookie, checks the portal and the permission in the right branch, validates the body and calls a service.

```ts
const api = createApi({ db, auth, acl, payments, content, notices, reports, guardians, commissionRules, students, enrollment, attendance, exams, feeExceptions, promotion, payouts, config: { trustedOrigins: ["https://admin.example.com"] } });
// Bun.serve({ fetch: api.fetch })
```

`config`: `trustedOrigins` (required, at least one; each entry must be an http(s) origin, scheme + host + optional port, and is compared in serialized form, so `https://admin.example.com:443` and `https://admin.example.com` are the same while another port is a different origin; an invalid entry stops start-up and names itself; the CSRF guard refuses every write from another origin), `cookieName` (default `sms_session`), `secureCookie` (default true; false only for local http), `trustProxy` (read the client address from `X-Forwarded-For`; only behind a proxy you control). Without a proxy, serve with `Bun.serve({ fetch: withPeerAddress(api) })` so the sign-in address limit uses the socket's peer address (forwarded headers are ignored unless `trustProxy` is true). `trustedOrigins` also drives CORS: preflights from those origins are answered with credentials allowed, before the CSRF guard; other origins get no CORS headers. Unmatched routes return a JSON `not_found` envelope.

## Rules

- The session is an httpOnly, SameSite=Lax cookie holding the token from `@workspace/auth`. Every write must come from a trusted origin: with an `Origin` header it must be on the list; without one, `Sec-Fetch-Site` must be `same-origin` or `none`, and a request with neither header passes only if it carries no session cookie. That is the one case where a write does not need an allowlisted `Origin`: curl, server-to-server calls and a script signing in (no cookie yet). A request that does carry a session cookie always needs one of the two.
- Errors are `{ error: { code, message } }`. 401 not signed in or wrong details, 403 forbidden or a half-signed-in session (`password_setup_required`, `mfa_required`, `mfa_setup_required`), 404 not found, 409 only for the conflicts that map to it (`last_root_admin`, `already_purchased`, `already_handed_over`, `payment_not_pending`, `guardian_linked`, `phone_taken`, `rule_overlap`, `rule_in_use`) and for a blocked promotion confirmation, which answers `{ status: "blocked", ... }` rather than an error envelope, 429 too many attempts, 400 bad input, 422 every other broken rule (for example confirming a run that is no longer a draft is `422 promotion_not_draft`, not 409). Unexpected errors are logged and return a plain 500.
- A branch is always read from the record being changed (the payment's branch), never from the request (I2).
- The admin routes need the admin portal, which for staff means the authenticator step is done.

## Routes in this slice

| Mount | Routes |
|---|---|
| `/auth` | `POST sign-in`, `first-login`, `set-password`, `mfa/verify`, `mfa/begin`, `mfa/confirm`, `change-password` (a fully signed-in session only: 403 `password_setup_required`, `mfa_required` or `mfa_setup_required` while the session is half signed in), `sign-out`; `GET me` |
| `/admin` | `GET payments?status=` (scoped to your branches); `POST payments/:id/verify`, `payments/:id/reject`, `payments/:id/void`, `payments/cash`; `POST roles/assign`, `roles/revoke`; `POST users/:id/status`, `users/:id/reset-mfa`, `guardians/:id/reset-password` |
| `/admin` (students) | `POST students` (needs `students.create` in the given branch), `GET students?q=&limit=&offset=` (your branches only), `GET students/:id`, `PATCH students/:id` (a student is reachable through any of their branches) |
| `/admin` (enrolments, invoices) | `POST enrollments` and `POST enrollments/:id/drop` (the course's branch), `GET students/:id/invoices` (only invoices of branches you may read), `GET invoices/:id` |
| `/admin` (attendance) | `POST attendance/sessions`, `sessions/:id/cancel`, `sessions/:id/mark`, `sessions/:id/mark-remaining-absent`, `sessions/:id/qr`; `GET attendance/sessions/:id/roster`; `GET students/:id/attendance`; `POST students/:id/rotate-qr`. The branch is the session's course's branch. |
| `/lecturer` and `/admin/exams` | The same exam routes mounted twice: `POST questions`, `PUT questions/:id`, `POST exams`, `PUT exams/:id/questions`, `POST exams/:id/publish`, `close`, `marks`, `release`; `GET exams/:id/results`. A lecturer reaches only what they own (the `lecturer` portal must be on); staff reach exams in their branches; `release` needs `exams.release` (staff only); questions can also be changed by a root administrator. For an exam shared by several branches, `marks` and `GET exams/:id/results` are limited to results recorded in the caller's own branches (rows, count, average and highest alike; a `marks` batch with any entry outside them is refused with 403 and writes nothing); the owning lecturer and all-branches staff are unrestricted. `opensAt` and `closesAt` must be timestamps with an explicit zone (`Z` or an offset); `examDate` must be a real calendar date; `weight`, `maxMarks` and question marks must be above zero (marks earned may be zero). With `online_exams` off every exam route answers 403 `module_disabled`, before any exam or question lookup. |
| `/admin` (fees, promotion, payouts) | `POST fee-exceptions`, `fee-exceptions/:id/end`, `enrollments/:id/clear-billing-grade` (the course's branch, `fees.override`); `POST promotion/runs`, `GET promotion/runs/:id`, `PUT promotion/runs/:id/items/:itemId`, `PUT .../effective-date`, `POST .../discard`, `.../confirm` (409 when blocked); `GET payouts/preview`, `GET payouts`, `GET payouts/:id`, `POST payouts`, `payouts/:id/refresh`, `approve`, `paid`, `discard`. `refresh` and `approve` both answer `{ payout, pulledReversals }`; `paid` answers `{ payout }`. Promotion and payouts span the whole institute, so they need an all-branches role. |
| `/lecturer/content` and `/admin/content` | The same content routes mounted twice: `POST items`, `items/:id/branches`, `items/:id/status`; `PATCH items/:id`; `POST courses/:id/sections`, `courses/:id/content`; `DELETE courses/:id/content/:contentId`. A lecturer reaches only their own items and may list them only in branches where they teach; staff need `content.manage` in each branch (an all-branches role when none is given). Admin only: `GET handovers`, `POST purchases/:id/hand-over`, `purchases/:id/cancel` (`content.handover` in the purchase's branch). |
| `/admin` (notices) | `POST notices`, `GET notices`, `GET notices/mine`, `GET/PATCH/DELETE notices/:id`. Needs `notices.manage` in the notice's branch (null branch = all-branches role); `mine` lists the notices aimed at the staff member's roles. |
| `/admin` (reports) | `GET reports/overdue?branchId&limit&offset`, `GET reports/collections?from&to&branchId`. Need `reports.read`; a caller sees only the branches they hold it in (an explicit `branchId` outside them is a 403). |
| `/admin` (guardians) | `PATCH guardians/:id`, `POST guardians/:id/phone`, `POST students/:id/guardians`, `PATCH` and `DELETE students/:id/guardians/:guardianId`. Need `guardians.manage` in the student's branches (a guardian-level change: in any branch of any of their children). |
| `/admin` (commission rules) | `GET commission-rules?lecturerId&activeOn`, `POST commission-rules`, `POST commission-rules/:id/end`, `DELETE commission-rules/:id`. Need `commissions.manage` as an all-branches role. A rate is never edited: end the rule and add a new one. |
| `/lecturer/payouts` | `GET /`, `GET /:id`: a lecturer's own statements, only once approved or paid. |
| `/student` | `GET notices`, `content`, `content/:id`, `attendance`; `POST content/:id/purchase`, `purchases/:id/cancel` (own purchases only); exams: `POST exams/:id/attempts`, `GET attempts/:id`, `PUT attempts/:id/answers`, `POST attempts/:id/submit`, `GET exams/:id/result` (the student is always the signed-in student) |
| `/parent` | `GET notices`, `children`, `children/:id/content`, `children/:id/attendance` |

Every area now has routes. New ones follow the same pattern: portal guard, permission in the record's branch, zod body, one service call.

## Tests

`bun test --timeout 60000` runs `test/api.test.ts` on PGlite through `app.request`: CSRF guard, cookies, error mapping, the sign-in steps over HTTP (including the staff authenticator and the parent first login), branch-scoped payment verification, roles, and both portals.

**Logging.** An unexpected error answers 500 `internal_error` and is logged. A failed database query is logged as `{ kind: "database_error", name, code (SQLSTATE), constraint, method, path }` only: its message carries the bound values (a student's name, birth date, NIC, phone and email; a guardian's contact details) and its `cause` the raw driver error with the same data, so neither is ever written to the log. Other unexpected errors are logged whole.

