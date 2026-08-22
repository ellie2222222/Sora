# Test Cases: Authentication & Authorization (Auth-US)

> **Feature:** SRS §7 Auth-US
> **Spec:** [spec.md](spec.md)
> **Plan:** [plan.md](plan.md)

Classification: **[API]** verifiable through the HTTP contract alone · **[UI]** only observable in the browser · **[BOTH]** needs both to be meaningful.

---

## Auth-US-01: User Registration

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-01 | Registration with unused email and acceptable password | [BOTH] |
| AC-02 | Password stored only as a hash | [API] |
| AC-03 | Email already registered | [BOTH] |
| AC-04 | Password below minimum length | [BOTH] |
| AC-05 | Malformed email | [BOTH] |
| AC-06 | Internal reserved domain accepted | [API] |
| AC-07 | Missing required fields | [BOTH] |
| AC-08 | Display name optional | [API] |
| AC-09 | Verification message issued | [API] |
| AC-10 | Verification link expires | [API] |
| AC-11 | Verifying activates the account | [BOTH] |
| AC-12 | Expired link refused as expired | [BOTH] |
| AC-13 | Used link refused as used | [BOTH] |
| AC-14 | Unknown link refused | [API] |
| AC-15 | Missing link value | [UI] |
| AC-16 | Unverified account cannot log in | [BOTH] |
| AC-17 | Registration audited | [API] |
| AC-18 | Feedback stays on the form | [UI] |
| EC-006 | Duplicate registration submitted twice quickly | [API] |
| EC-008 | Re-registration after a lost verification message | [API] |
| EC-009 | Whitespace-only password at minimum length | [API] |
| EC-010 | Address differing only by letter case | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-01 | Successful registration | TC-01 | TC-02 |
| AC-02 | Password hashed | TC-03 | — |
| AC-03 | Email exists | TC-04 | TC-05 |
| AC-04 | Password too short | TC-06 | TC-07 |
| AC-05 | Malformed email | TC-08 | TC-09 |
| AC-06 | Reserved domain | TC-10 | — |
| AC-07 | Missing fields | TC-11 | TC-12 |
| AC-08 | Name optional | TC-13 | — |
| AC-09 | Verification issued | TC-14 | — |
| AC-10 | Link expiry set | TC-15 | — |
| AC-11 | Verification activates | TC-16 | TC-17 |
| AC-12 | Expired link | TC-18 | TC-19 |
| AC-13 | Used link | TC-20 | TC-21 |
| AC-14 | Unknown link | TC-22 | — |
| AC-15 | Missing link value | — | TC-23 |
| AC-16 | Unverified login refused | TC-24 | TC-25 |
| AC-17 | Registration audited | TC-26, TC-27 | — |
| AC-18 | Feedback stays on form | — | TC-28 |
| EC-006 | Double submit | TC-29 | — |
| EC-008 | Re-registration | TC-30 | — |
| EC-009 | Whitespace password | TC-31 | — |
| EC-010 | Case-differing address | TC-32 | — |

---

### TC-01: Registration with an unused address succeeds and leaves the account unverified

- **US:** Auth-US-01
- **Given:** No account exists for `new.user@example.com`
- **When:** `POST /api/v1/auth/register` with a valid address, an 8+ character password, and a display name
- **Then:** 201 with the envelope carrying `id`, `email`, `full_name`, `email_verified: false`; the stored user has `is_active` false and `email_verified` false
- **AC:** AC-01
- **Type:** integration

### TC-02: A visitor can register through the form and is told to check their email

- **US:** Auth-US-01
- **Given:** The registration page is open
- **When:** `fullName-register`, `email-register` and `password-register` are filled and `btn-submit-register` is pressed
- **Then:** A success alert appears containing the verification instruction, and the submit control is disabled to prevent a second submission
- **AC:** AC-01
- **Type:** e2e

### TC-03: The submitted password never appears in storage

- **US:** Auth-US-01
- **Given:** A registration has just completed with password `Str0ngPass!`
- **When:** The stored user row is read
- **Then:** `password_hash` is present, is not equal to `Str0ngPass!`, and carries a bcrypt prefix; no column holds the plain text
- **AC:** AC-02
- **Type:** integration

### TC-04: Registering an address that already has an account is refused

- **US:** Auth-US-01
- **Given:** An account already exists for `taken@example.com`
- **When:** `POST /api/v1/auth/register` with that address
- **Then:** 409 with `error_code: USER_EMAIL_EXISTS`; the number of accounts is unchanged
- **AC:** AC-03
- **Type:** integration

### TC-05: The form reports an address already in use

- **US:** Auth-US-01
- **Given:** An account exists for `taken@example.com`
- **When:** The registration form is submitted with that address
- **Then:** An error alert states the address is already registered
- **AC:** AC-03
- **Type:** e2e

### TC-06: A password below the minimum is refused

- **US:** Auth-US-01
- **Given:** A registration payload with the password `short`
- **When:** `POST /api/v1/auth/register`
- **Then:** 422 with the validation detail naming the `password` field; no account is created
- **AC:** AC-04
- **Type:** integration

### TC-07: The form refuses a short password before submitting

- **US:** Auth-US-01
- **Given:** The registration page is open
- **When:** A password shorter than the minimum is entered and submitted
- **Then:** An inline error appears beneath the password field and no request is sent
- **AC:** AC-04
- **Type:** e2e

### TC-08: A malformed address is refused

- **US:** Auth-US-01
- **Given:** A registration payload whose email is `not-an-address`
- **When:** `POST /api/v1/auth/register`
- **Then:** 422 with the validation detail naming the `email` field
- **AC:** AC-05
- **Type:** integration

### TC-09: The form refuses a malformed address before submitting

- **US:** Auth-US-01
- **Given:** The registration page is open
- **When:** `not-an-address` is entered as the email and the form is submitted
- **Then:** An inline error appears beneath the email field and no request is sent
- **AC:** AC-05
- **Type:** e2e

### TC-10: An address on an internal reserved domain is accepted

- **US:** Auth-US-01
- **Given:** No account exists for `admin.user@globee.local`
- **When:** `POST /api/v1/auth/register` with that address
- **Then:** 201; the address is not rejected as a special-use domain
- **AC:** AC-06
- **Type:** integration

### TC-11: A registration missing the password is refused

- **US:** Auth-US-01
- **Given:** A registration payload carrying only an email
- **When:** `POST /api/v1/auth/register`
- **Then:** 422 naming the missing field; no account is created
- **AC:** AC-07
- **Type:** integration

### TC-12: The form reports both fields when both are empty

- **US:** Auth-US-01
- **Given:** The registration page is open with empty fields
- **When:** `btn-submit-register` is pressed
- **Then:** Inline errors appear for email and password, and no request is sent
- **AC:** AC-07
- **Type:** e2e

### TC-13: The display name may be omitted

- **US:** Auth-US-01
- **Given:** A registration payload with no `full_name`
- **When:** `POST /api/v1/auth/register`
- **Then:** 201 and the account is created with an absent display name
- **AC:** AC-08
- **Type:** integration

### TC-14: A verification token is issued on registration

- **US:** Auth-US-01
- **Given:** A registration has just completed
- **When:** Verification tokens for that user are read
- **Then:** Exactly one token exists, unused, bound to that user
- **AC:** AC-09
- **Type:** integration

### TC-15: The verification token carries a bounded expiry

- **US:** Auth-US-01
- **Given:** A verification token has just been issued
- **When:** Its expiry is read
- **Then:** The expiry is in the future and no further ahead than the configured validity window
- **AC:** AC-10
- **Type:** integration

### TC-16: Opening a valid verification link activates the account

- **US:** Auth-US-01
- **Given:** An unverified account holding a valid, unused verification token
- **When:** `POST /api/v1/auth/verify-email` with that token
- **Then:** 200; the account becomes `is_active` and `email_verified` with `email_verified_at` set; the token is marked used
- **AC:** AC-11
- **Type:** integration

### TC-17: The verification page confirms and directs the user to log in

- **US:** Auth-US-01
- **Given:** A valid verification link
- **When:** The link is opened in the browser
- **Then:** A success message appears and the user is directed to the login page
- **AC:** AC-11
- **Type:** e2e

### TC-18: An expired verification link is refused as expired

- **US:** Auth-US-01
- **Given:** A verification token whose expiry has passed
- **When:** `POST /api/v1/auth/verify-email` with it
- **Then:** 410 with `error_code: TOKEN_EXPIRED`; the account stays unverified
- **AC:** AC-12
- **Type:** integration

### TC-19: The verification page explains an expired link

- **US:** Auth-US-01
- **Given:** An expired verification link
- **When:** It is opened in the browser
- **Then:** A message states the link has expired and offers a route back to registration
- **AC:** AC-12
- **Type:** e2e

### TC-20: A used verification link is refused as used

- **US:** Auth-US-01
- **Given:** A verification token already redeemed
- **When:** `POST /api/v1/auth/verify-email` with it again
- **Then:** 409 with `error_code: TOKEN_ALREADY_USED`; the verified state is unchanged
- **AC:** AC-13
- **Type:** integration

### TC-21: The verification page explains an already-used link

- **US:** Auth-US-01
- **Given:** A verification link already redeemed
- **When:** It is opened again
- **Then:** A message states the link was already used
- **AC:** AC-13
- **Type:** e2e

### TC-22: An unknown verification token is refused

- **US:** Auth-US-01
- **Given:** A token value matching no issued verification
- **When:** `POST /api/v1/auth/verify-email` with it
- **Then:** The request is refused and the body reveals nothing about whether any account exists
- **AC:** AC-14
- **Type:** integration

### TC-23: Reaching the verification page with no token says the link is missing

- **US:** Auth-US-01
- **Given:** The verification route is opened with no token parameter
- **When:** The page loads
- **Then:** A message states the verification link is missing, rather than reporting a system failure
- **AC:** AC-15
- **Type:** e2e

### TC-24: An unverified account cannot log in

- **US:** Auth-US-01
- **Given:** A registered account whose address is not verified, with a known correct password
- **When:** `POST /api/v1/auth/login` with correct credentials
- **Then:** 403 with `error_code: EMAIL_NOT_VERIFIED`; no session credentials are issued
- **AC:** AC-16
- **Type:** integration

### TC-25: The login form asks an unverified user to verify

- **US:** Auth-US-01
- **Given:** An unverified account
- **When:** Correct credentials are submitted on the login form
- **Then:** An error alert asks the user to verify their email before logging in
- **AC:** AC-16
- **Type:** e2e

### TC-26: A successful registration is audited

- **US:** Auth-US-01
- **Given:** A registration succeeds
- **When:** Audit records are read
- **Then:** One record exists with the registration action, `result=success`, the address supplied, and the source address
- **AC:** AC-17
- **Type:** integration

### TC-27: A refused registration is audited

- **US:** Auth-US-01
- **Given:** A registration is refused for a duplicate address
- **When:** Audit records are read
- **Then:** One record exists with `result=failure` and `error_code=USER_EMAIL_EXISTS`
- **AC:** AC-17
- **Type:** integration

### TC-28: A refused registration keeps the visitor's input on the form

- **US:** Auth-US-01
- **Given:** The registration form filled with an address already in use
- **When:** It is submitted and refused
- **Then:** The error alert appears, the page does not reload, and the entered name and address are still in their fields
- **AC:** AC-18
- **Type:** e2e

### TC-29: The same address submitted twice in quick succession yields one account

- **US:** Auth-US-01
- **Given:** No account exists for `race@example.com`
- **When:** Two registrations for that address are issued concurrently
- **Then:** Exactly one succeeds, the other is refused with `USER_EMAIL_EXISTS`, and exactly one account exists
- **AC:** EC-006
- **Type:** integration

### TC-30: Registering again after a lost verification message is refused

- **US:** Auth-US-01
- **Given:** An unverified account exists for `lost@example.com`
- **When:** `POST /api/v1/auth/register` with the same address
- **Then:** 409 `USER_EMAIL_EXISTS` — re-registration is not the remedy for a lost message
- **AC:** EC-008
- **Type:** integration

### TC-31: A whitespace-only password at the minimum length

- **US:** Auth-US-01
- **Given:** A registration payload whose password is eight space characters
- **When:** `POST /api/v1/auth/register`
- **Then:** The documented outcome is recorded — the length rule alone admits it, which is a known limitation of FR-003
- **AC:** EC-009
- **Type:** integration

### TC-32: An address differing only by letter case

- **US:** Auth-US-01
- **Given:** An account exists for `user@example.com`
- **When:** `POST /api/v1/auth/register` with `USER@example.com`
- **Then:** The outcome is recorded and asserted consistently with FR-002 — the two must not become separate accounts
- **AC:** EC-010
- **Type:** integration

---

## Auth-US-02: User Login

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-19 | Login with correct credentials | [BOTH] |
| AC-20 | Response carries credentials, no secrets | [API] |
| AC-21 | Wrong password | [BOTH] |
| AC-22 | Address with no account, no attempt recorded | [BOTH] |
| AC-23 | Failed attempt counted | [API] |
| AC-24 | Success clears the failure count | [API] |
| AC-25 | Unverified account refused | [BOTH] |
| AC-26 | Failures lock the account | [BOTH] |
| AC-27 | Locked account refused with correct password | [API] |
| AC-28 | Failures outside the window disregarded | [API] |
| AC-29 | Locking is per account | [API] |
| AC-30 | Missing credentials | [BOTH] |
| AC-31 | Failure stays on the form | [UI] |
| AC-32 | Refusal establishes no session | [BOTH] |
| AC-33 | Credentials stored for later requests | [UI] |
| AC-34 | Protected destination without a session | [UI] |
| AC-35 | Expired session on a protected request | [BOTH] |
| AC-36 | A login refusal is not an expired session | [UI] |
| AC-37 | Every attempt audited | [API] |
| AC-38 | No secrets in logs | [API] |
| EC-001 | Login page opened while already signed in | [UI] |
| EC-002 | Account locked between submit and check | [API] |
| EC-004 | Login submitted twice quickly | [UI] |
| EC-011 | Account deleted after the session was issued | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-19 | Successful login | TC-33 | TC-34 |
| AC-20 | Response contents | TC-35 | — |
| AC-21 | Wrong password | TC-36 | TC-37 |
| AC-22 | No such account | TC-38, TC-39 | TC-40 |
| AC-23 | Attempt counted | TC-41 | — |
| AC-24 | Count cleared on success | TC-42 | — |
| AC-25 | Unverified refused | TC-24 | TC-25 |
| AC-26 | Lock after threshold | TC-43 | TC-44 |
| AC-27 | Locked with correct password | TC-45 | — |
| AC-28 | Stale failures disregarded | TC-46 | — |
| AC-29 | Locking per account | TC-47 | — |
| AC-30 | Missing credentials | TC-48 | TC-49 |
| AC-31 | Error persists on the form | — | TC-50 |
| AC-32 | No session on refusal | TC-51 | TC-52 |
| AC-33 | Credentials used by later requests | — | TC-53 |
| AC-34 | Protected destination redirects | — | TC-54 |
| AC-35 | Expired session redirects | TC-55 | TC-56 |
| AC-36 | Login 401 is not a redirect | — | TC-57 |
| AC-37 | Attempts audited | TC-58, TC-59 | — |
| AC-38 | No secrets in logs | TC-60 | — |
| EC-001 | Already signed in | — | TC-61 |
| EC-002 | Locked mid-flight | TC-62 | — |
| EC-004 | Double submit | — | TC-63 |
| EC-011 | Account deleted after issue | TC-64 | — |

---

### TC-33: Correct credentials on a verified account return session credentials

- **US:** Auth-US-02
- **Given:** An active, verified account with a known password
- **When:** `POST /api/v1/auth/login` with the correct pair
- **Then:** 200 with `access_token`, `refresh_token`, `token_type`, `expires_in`, and the user identity
- **AC:** AC-19
- **Type:** integration

### TC-34: A verified user reaches their workspace list from the form

- **US:** Auth-US-02
- **Given:** The login page is open and a verified account exists
- **When:** `email-login` and `password-login` are filled and `btn-submit-login` is pressed
- **Then:** The browser lands on the workspace area and the login form is no longer displayed
- **AC:** AC-19
- **Type:** e2e

### TC-35: The login response contains no password material

- **US:** Auth-US-02
- **Given:** A successful login
- **When:** The response body is scanned
- **Then:** No field holds the submitted password or any hash of it
- **AC:** AC-20
- **Type:** integration

### TC-36: A wrong password is refused as invalid credentials

- **US:** Auth-US-02
- **Given:** An existing verified account
- **When:** `POST /api/v1/auth/login` with a wrong password
- **Then:** 401 with `error_code: INVALID_CREDENTIALS`, and the message does not identify which field was wrong
- **AC:** AC-21
- **Type:** integration

### TC-37: The form shows a generic refusal for a wrong password

- **US:** Auth-US-02
- **Given:** An existing verified account
- **When:** The login form is submitted with a wrong password
- **Then:** An error alert shows the invalid-credentials message without naming a field
- **AC:** AC-21
- **Type:** e2e

### TC-38: An address with no account is refused distinctly

- **US:** Auth-US-02
- **Given:** No account exists for `ghost@example.com`
- **When:** `POST /api/v1/auth/login` with that address
- **Then:** 404 with `error_code: USER_NOT_FOUND`
- **AC:** AC-22
- **Type:** integration

### TC-39: No failed-attempt record is created for an address with no account

- **US:** Auth-US-02
- **Given:** No account exists for `ghost@example.com`
- **When:** Six login attempts are made with that address
- **Then:** No `login_attempts` row exists for it, and every attempt still returns `USER_NOT_FOUND` rather than a lock
- **AC:** AC-22
- **Type:** integration

### TC-40: The form states that no account exists for the address

- **US:** Auth-US-02
- **Given:** No account exists for the entered address
- **When:** The login form is submitted
- **Then:** An error alert states that no account exists for that address
- **AC:** AC-22
- **Type:** e2e

### TC-41: A wrong password against an existing account is recorded as a failed attempt

- **US:** Auth-US-02
- **Given:** An existing account with no prior attempts
- **When:** One login with a wrong password is refused
- **Then:** Exactly one `login_attempts` row exists for that address with `success` false
- **AC:** AC-23
- **Type:** integration

### TC-42: A successful login clears accumulated failures

- **US:** Auth-US-02
- **Given:** An existing account with four failed attempts inside the window
- **When:** A correct login succeeds, then two further wrong passwords are tried
- **Then:** The account is not locked, because the count restarted at the success
- **AC:** AC-24
- **Type:** integration

### TC-43: The account locks on the attempt after the threshold

- **US:** Auth-US-02
- **Given:** An existing account with five consecutive failures inside the window
- **When:** A sixth attempt is made
- **Then:** 423 with `error_code: ACCOUNT_LOCKED`
- **AC:** AC-26
- **Type:** integration

### TC-44: The form explains a locked account

- **US:** Auth-US-02
- **Given:** A locked account
- **When:** The login form is submitted
- **Then:** An error alert states the account is locked after too many failed attempts and to try again later
- **AC:** AC-26
- **Type:** e2e

### TC-45: A locked account is refused even with the correct password

- **US:** Auth-US-02
- **Given:** A locked account whose correct password is known
- **When:** `POST /api/v1/auth/login` with the correct pair
- **Then:** 423 `ACCOUNT_LOCKED`; no session credentials are issued
- **AC:** AC-27
- **Type:** integration

### TC-46: Failures older than the detection window do not lock

- **US:** Auth-US-02
- **Given:** An account with five failures dated outside the detection window
- **When:** A correct login is attempted
- **Then:** 200; the stale failures did not lock the account
- **AC:** AC-28
- **Type:** integration

### TC-47: Locking one account leaves another usable

- **US:** Auth-US-02
- **Given:** Account A is locked and account B is verified and untouched
- **When:** Account B logs in correctly
- **Then:** 200 for B
- **AC:** AC-29
- **Type:** integration

### TC-48: A login missing the password is refused as a validation failure

- **US:** Auth-US-02
- **Given:** A login payload carrying only an email
- **When:** `POST /api/v1/auth/login`
- **Then:** 422 naming the missing field; no authentication is attempted and no attempt is recorded
- **AC:** AC-30
- **Type:** integration

### TC-49: The form reports both missing fields

- **US:** Auth-US-02
- **Given:** The login page with empty fields
- **When:** `btn-submit-login` is pressed
- **Then:** Inline errors appear for both fields and no request is sent
- **AC:** AC-30
- **Type:** e2e

### TC-50: A refusal message persists on the login form

- **US:** Auth-US-02
- **Given:** The login form submitted with a wrong password
- **When:** The refusal is rendered
- **Then:** The error alert remains visible for at least five seconds with no navigation or reload, and disappears only when dismissed or on resubmission
- **AC:** AC-31
- **Type:** e2e

### TC-51: A refused login issues no session credentials

- **US:** Auth-US-02
- **Given:** A refused login
- **When:** The response is examined
- **Then:** No access or refresh credential is present in the body or in any `Set-Cookie` header
- **AC:** AC-32
- **Type:** integration

### TC-52: A refused login leaves the browser without stored credentials

- **US:** Auth-US-02
- **Given:** A browser with no prior session
- **When:** A login is refused
- **Then:** No access or refresh credential is stored
- **AC:** AC-32
- **Type:** e2e

### TC-53: A later protected request carries the stored credential

- **US:** Auth-US-02
- **Given:** A user has just logged in through the form
- **When:** A protected area is opened
- **Then:** Its data renders without any further credential prompt
- **AC:** AC-33
- **Type:** e2e

### TC-54: A protected destination reached without a session sends the user to login

- **US:** Auth-US-02
- **Given:** A browser holding no session
- **When:** A protected route is navigated to directly
- **Then:** The browser ends on the login page and no protected content is rendered
- **AC:** AC-34
- **Type:** e2e

### TC-55: A protected request with an invalid credential is refused

- **US:** Auth-US-02
- **Given:** An access credential that is expired or malformed
- **When:** A protected endpoint is called with it
- **Then:** 401
- **AC:** AC-35
- **Type:** integration

### TC-56: An expired session clears credentials and returns the user to login

- **US:** Auth-US-02
- **Given:** A signed-in browser whose access credential has been invalidated
- **When:** A protected page issues a request
- **Then:** Stored credentials are cleared and the browser ends on the login page
- **AC:** AC-35
- **Type:** e2e

### TC-57: A login refusal does not trigger the session-expiry redirect

- **US:** Auth-US-02
- **Given:** The login page is open
- **When:** A wrong password produces a 401 from the login endpoint
- **Then:** The page does not reload and does not navigate; the error is rendered by the form — the refusal is not treated as an expired session
- **AC:** AC-36
- **Type:** e2e

### TC-58: A successful login is audited

- **US:** Auth-US-02
- **Given:** A successful login
- **When:** Audit records are read
- **Then:** One `AUTH_AUDIT` record exists with the login action, `result=success`, the username, and the source address
- **AC:** AC-37
- **Type:** integration

### TC-59: Each refusal reason is audited distinctly

- **US:** Auth-US-02
- **Given:** One refusal each for unknown address, wrong password, unverified account, and locked account
- **When:** Audit records are read
- **Then:** Four records exist with `result=failure` and error codes `USER_NOT_FOUND`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_LOCKED`
- **AC:** AC-37
- **Type:** integration

### TC-60: No secrets appear in logs for any login outcome

- **US:** Auth-US-02
- **Given:** One login of each outcome — success, wrong password, unknown address, locked
- **When:** Captured log output is scanned at every level
- **Then:** No submitted password, password hash, or session credential appears
- **AC:** AC-38
- **Type:** integration

### TC-61: Opening the login page while already signed in

- **US:** Auth-US-02
- **Given:** A browser holding a valid session
- **When:** The login page is opened directly
- **Then:** The documented behaviour is asserted — the user is not left with a form that would invalidate their working session unexpectedly
- **AC:** EC-001
- **Type:** e2e

### TC-62: An account locked between submission and the check

- **US:** Auth-US-02
- **Given:** An account that reaches the failure threshold from another source while a login is in flight
- **When:** The in-flight login is processed
- **Then:** It is refused as locked, not granted
- **AC:** EC-002
- **Type:** integration

### TC-63: Submitting the login form twice quickly produces one attempt

- **US:** Auth-US-02
- **Given:** The login form filled with valid credentials
- **When:** `btn-submit-login` is pressed twice in rapid succession
- **Then:** The control is disabled after the first press and only one authentication is attempted
- **AC:** EC-004
- **Type:** e2e

### TC-64: A session outliving its account is refused

- **US:** Auth-US-02
- **Given:** A valid access credential whose account has since been soft-deleted
- **When:** A protected endpoint is called
- **Then:** The request is refused rather than served
- **AC:** EC-011
- **Type:** integration

---

## Auth-US-03: Token Refresh

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-39 | Valid credential exchanged | [API] |
| AC-40 | Credential rotated on use | [API] |
| AC-41 | Rotated credential cannot be reused | [API] |
| AC-42 | Expired credential refused | [API] |
| AC-43 | Revoked credential refused | [API] |
| AC-44 | Unknown credential refused | [API] |
| AC-45 | Malformed or absent credential | [API] |
| AC-46 | Access credential rejected as refresh | [API] |
| AC-47 | Locked account cannot refresh | [API] |
| AC-48 | Refused exchange returns the user to login | [UI] |
| AC-49 | No password required | [API] |
| AC-50 | Refresh outcomes audited | [API] |
| EC-005 | Two tabs exchange the same credential | [API] |
| EC-012 | Credential appearing to be issued in the future | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-39 | Valid exchange | TC-65 | — |
| AC-40 | Rotation | TC-66 | — |
| AC-41 | Reuse refused | TC-67 | — |
| AC-42 | Expired refused | TC-68 | — |
| AC-43 | Revoked refused | TC-69 | — |
| AC-44 | Unknown refused | TC-70 | — |
| AC-45 | Malformed or absent | TC-71 | — |
| AC-46 | Wrong credential kind | TC-72 | — |
| AC-47 | Locked account | TC-73 | — |
| AC-48 | Refusal returns to login | — | TC-74 |
| AC-49 | No password required | TC-75 | — |
| AC-50 | Audited | TC-76 | — |
| EC-005 | Concurrent exchange | TC-77 | — |
| EC-012 | Future-dated credential | TC-78 | — |

---

### TC-65: A valid refresh credential yields a new access credential

- **US:** Auth-US-03
- **Given:** A refresh credential from a recent login, unexpired and unrevoked
- **When:** `POST /api/v1/auth/refresh` with it
- **Then:** 200 with a new `access_token` and a stated `expires_in`
- **AC:** AC-39
- **Type:** integration

### TC-66: The refresh credential is rotated

- **US:** Auth-US-03
- **Given:** A valid refresh credential
- **When:** It is exchanged
- **Then:** The response carries a refresh credential different from the one presented
- **AC:** AC-40
- **Type:** integration

### TC-67: A rotated credential cannot be exchanged again

- **US:** Auth-US-03
- **Given:** A refresh credential that has already been exchanged
- **When:** `POST /api/v1/auth/refresh` with it again
- **Then:** The exchange is refused
- **AC:** AC-41
- **Type:** integration

### TC-68: An expired refresh credential is refused

- **US:** Auth-US-03
- **Given:** A refresh credential past its lifetime
- **When:** It is exchanged
- **Then:** The exchange is refused and no access credential is issued
- **AC:** AC-42
- **Type:** integration

### TC-69: A revoked refresh credential is refused

- **US:** Auth-US-03
- **Given:** A refresh credential revoked by a logout
- **When:** It is exchanged
- **Then:** The exchange is refused
- **AC:** AC-43
- **Type:** integration

### TC-70: An unknown refresh credential is refused

- **US:** Auth-US-03
- **Given:** A credential value matching nothing issued
- **When:** It is exchanged
- **Then:** The exchange is refused and the body reveals nothing about account existence
- **AC:** AC-44
- **Type:** integration

### TC-71: An absent credential is a validation failure

- **US:** Auth-US-03
- **Given:** A refresh request with no credential field
- **When:** It is sent
- **Then:** 422 naming the missing field
- **AC:** AC-45
- **Type:** integration

### TC-72: An access credential is not accepted as a refresh credential

- **US:** Auth-US-03
- **Given:** A valid access credential
- **When:** It is presented to the refresh endpoint
- **Then:** The exchange is refused
- **AC:** AC-46
- **Type:** integration

### TC-73: A locked account cannot refresh

- **US:** Auth-US-03
- **Given:** A valid refresh credential whose account has since been locked
- **When:** It is exchanged
- **Then:** The exchange is refused
- **AC:** AC-47
- **Type:** integration

### TC-74: A refused exchange returns the user to login

- **US:** Auth-US-03
- **Given:** A signed-in browser whose refresh credential has been revoked
- **When:** The client attempts an exchange
- **Then:** Stored credentials are cleared and the browser ends on the login page
- **AC:** AC-48
- **Type:** e2e

### TC-75: Exchanging requires no password

- **US:** Auth-US-03
- **Given:** A valid refresh credential
- **When:** It is exchanged with no password anywhere in the request
- **Then:** 200 — the password is not part of the contract
- **AC:** AC-49
- **Type:** integration

### TC-76: Refresh outcomes are audited

- **US:** Auth-US-03
- **Given:** One successful and one refused exchange
- **When:** Audit records are read
- **Then:** Both appear with their outcome, time, and source address
- **AC:** AC-50
- **Type:** integration

### TC-77: Concurrent exchange of one credential admits only one

- **US:** Auth-US-03
- **Given:** One valid refresh credential held by two clients
- **When:** Both exchange it at the same moment
- **Then:** At most one succeeds; the other is refused, and no two live refresh credentials descend from the same one
- **AC:** EC-005
- **Type:** integration

### TC-78: A credential that appears to be issued in the future

- **US:** Auth-US-03
- **Given:** A credential whose issued time is ahead of the server clock
- **When:** It is exchanged
- **Then:** The documented outcome is asserted rather than left to chance
- **AC:** EC-012
- **Type:** integration

---

## Auth-US-04: Logout

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-51 | Logout revokes the session | [API] |
| AC-52 | Stored credentials cleared | [UI] |
| AC-53 | Protected destinations unreachable after logout | [UI] |
| AC-54 | Logging out twice | [API] |
| AC-55 | Logout with an unknown credential | [API] |
| AC-56 | Other sessions unaffected | [API] |
| AC-57 | Account and data unchanged | [API] |
| AC-58 | Logout audited | [API] |
| AC-59 | User returned to a public page | [UI] |
| AC-60 | Logout mid-request renders nothing protected | [UI] |
| EC-007 | Logout in one tab while another is active | [UI] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-51 | Session revoked | TC-79 | — |
| AC-52 | Credentials cleared | — | TC-80 |
| AC-53 | Protected unreachable | — | TC-81 |
| AC-54 | Double logout | TC-82 | — |
| AC-55 | Unknown credential | TC-83 | — |
| AC-56 | Other sessions intact | TC-84 | — |
| AC-57 | Data unchanged | TC-85 | — |
| AC-58 | Audited | TC-86 | — |
| AC-59 | Public page | — | TC-87 |
| AC-60 | Mid-request logout | — | TC-88 |
| EC-007 | Two tabs | — | TC-89 |

---

### TC-79: Logout revokes the refresh credential

- **US:** Auth-US-04
- **Given:** A signed-in session
- **When:** `POST /api/v1/auth/logout` with its refresh credential, then that credential is exchanged
- **Then:** The logout succeeds and the later exchange is refused
- **AC:** AC-51
- **Type:** integration

### TC-80: Logout clears stored credentials

- **US:** Auth-US-04
- **Given:** A signed-in browser
- **When:** Logout is chosen
- **Then:** No access or refresh credential remains stored
- **AC:** AC-52
- **Type:** e2e

### TC-81: After logout a protected destination redirects

- **US:** Auth-US-04
- **Given:** A browser that has just logged out
- **When:** A protected route is navigated to directly
- **Then:** The browser ends on the login page with no protected content rendered
- **AC:** AC-53
- **Type:** e2e

### TC-82: Logging out twice is not an error

- **US:** Auth-US-04
- **Given:** A session already logged out
- **When:** Logout is requested again with the same credential
- **Then:** The request completes without a server error and the session remains revoked
- **AC:** AC-54
- **Type:** integration

### TC-83: Logging out with an unknown credential completes quietly

- **US:** Auth-US-04
- **Given:** A logout request carrying a credential matching nothing issued
- **When:** It is sent
- **Then:** The request completes without revealing whether any session existed
- **AC:** AC-55
- **Type:** integration

### TC-84: One device logging out leaves the other signed in

- **US:** Auth-US-04
- **Given:** The same account signed in twice, each with its own refresh credential
- **When:** One logs out
- **Then:** The other credential still exchanges successfully
- **AC:** AC-56
- **Type:** integration

### TC-85: Logout changes no account data

- **US:** Auth-US-04
- **Given:** An account owning a workspace with transactions
- **When:** The user logs out
- **Then:** The account, workspace, and transactions are unchanged
- **AC:** AC-57
- **Type:** integration

### TC-86: Logout is audited

- **US:** Auth-US-04
- **Given:** A logout completes
- **When:** Audit records are read
- **Then:** One `AUTH_AUDIT` logout record exists with the outcome, username, and source address
- **AC:** AC-58
- **Type:** integration

### TC-87: Logout ends on a public page

- **US:** Auth-US-04
- **Given:** A signed-in browser inside a workspace
- **When:** Logout is chosen
- **Then:** The browser ends on a public page and no workspace content remains on screen
- **AC:** AC-59
- **Type:** e2e

### TC-88: A protected response arriving after logout renders nothing

- **US:** Auth-US-04
- **Given:** A protected request in flight
- **When:** Logout completes before it resolves
- **Then:** Its data is not rendered and the user remains on a public page
- **AC:** AC-60
- **Type:** e2e

### TC-89: Logging out in one tab affects the other tab's next action

- **US:** Auth-US-04
- **Given:** Two tabs signed in as the same user with the same stored credentials
- **When:** One logs out and the other then acts
- **Then:** The second tab's next protected request is refused and it returns to the login page
- **AC:** EC-007
- **Type:** e2e

---

## Notes for implementation

- **The suite does not currently run.** `backend/tests/conftest.py` constructs `User(hashed_password=…)` while the model field is `password_hash`, so collection fails before any case executes. Fixing that fixture is a prerequisite for every integration case above.
- **TC-31, TC-32, TC-61, TC-78** deliberately say "the documented outcome is asserted": these are edge cases where the spec does not yet fix a behaviour. Each must be decided and the spec amended before the case is written, rather than encoding whatever the code happens to do today.
- **Element identifiers** used by the e2e cases: `email-login`, `password-login`, `btn-submit-login`, `fullName-register`, `email-register`, `password-register`, `btn-submit-register`. Any change to these is a breaking change for this suite.
