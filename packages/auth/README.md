# @workspace/auth

Sign-in for the student management system, on the `user` table of `@workspace/db` and the rules of `@workspace/domain`. Server only. No third-party auth library: a parent may have only a phone number and no email, and the password stays in `user.password_hash`.

```ts
const auth = createAuthService(db, { secretKey: process.env.AUTH_SECRET! }); // at least 16 characters, never committed
```

## Flows

| Call | What it does |
|---|---|
| `signIn({ identifier, password, ip?, userAgent? })` | Email, username or a parent's phone plus password. Every failure is `invalid_credentials` and costs the same time. Returns `{ token, expiresAt, principal }`. |
| `firstLogin({ phone })` | A parent's first sign-in with the phone number alone, only while the account has no password. The session is restricted to `set_password`. |
| `setPassword({ token, newPassword })` | Ends the first login. Signs out the account's other sessions. |
| `authenticate(token)` | The `Principal` for a token, or `unauthenticated`. Read `principal.restriction` and `principal.portals`. |
| `verifyMfa({ token, code })` | Authenticator code or a one-time recovery code. |
| `beginMfaEnrollment` / `confirmMfaEnrollment` | Staff enrolment: returns the secret and otpauth link, then the 8 recovery codes (shown once). |
| `changePassword`, `signOut`, `signOutEverywhere` | As named. Changing a password ends the other sessions. |
| `resetParentPassword({ guardianId, actor })` | Needs `guardians.manage`. Clears the password so the parent uses the phone number again. Refused for parents who are also staff or lecturers. |
| `resetMfa({ userId, actor })` | Root administrator only, never for themselves. The user enrols again at the next sign-in. |
| `assertReady(principal)`, `requirePortal(principal, portal)` | Guards for the API layer. |
| `purgeExpired()` | Housekeeping job for expired sessions and old counters. |

`principal.restriction` is `set_password`, `mfa` (enter the code), `mfa_setup` (staff must enrol) or `null`. While it is set, every portal in `principal.portals` is false.

## Rules

Passwords: argon2id, 10 to 200 characters. Sessions: token stored as a SHA-256 hash, 12 hours for staff, 30 days for everyone else, ended at once when the user is disabled. Second step: required for any staff role other than `lecturer`, optional for others and then required; authenticator secrets are stored encrypted with `secretKey`. Limits per 15 minutes: sign-in 10 per identifier and 60 per address; first login 5 per phone and 30 per address; codes 8 per 10 minutes. Audited (J3): password set, changed and reset, authenticator on and reset.

## Not in this package

Cookies and request handling (the API layer sets the cookie from `token` and passes the client address), sending the one-time SMS code on first login (a possible extra), and a staff "set temporary password" screen.

## Tests

`bun test --timeout 60000` runs `test/auth.test.ts` on PGlite (every migration applied): TOTP against the RFC vector, sign-in, limits, sessions, staff second step, first login, resets.
