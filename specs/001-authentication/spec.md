# Feature Specification: Authentication & Authorization (Auth-US)

> **Feature:** SRS §7 Auth-US
> **Traceability:** CDM §2.2 (User), Flows §8.1
> **Roles:** ALL
> **Plan:** [plan.md](plan.md)
> **Test Cases:** [test_cases.md](test_cases.md)

---

## User Scenarios & Testing *(mandatory)*

### Auth-US-01: User Registration

**As a** new user, **I want to** register with email and password, **so that** I can create a personal finance workspace.

#### Acceptance Criteria

**AC-01: Registration with an unused email and an acceptable password**
**Given** a visitor supplies an email address no account uses and a password of at least the minimum length,
**When** they submit the registration form,
**Then** an account is created, held inactive and unverified, and the visitor is told to check their email.

**AC-02: The password is stored in a form that cannot be read back**
**Given** a registration completes,
**When** the stored account is examined,
**Then** the password is present only as a one-way hash, and the submitted text appears nowhere in storage.

**AC-03: Registration with an email that already has an account**
**Given** an account already exists for the supplied address,
**When** the visitor submits registration,
**Then** the system refuses and states the address is already registered, and no second account is created.

**AC-04: Password below the minimum length**
**Given** a password shorter than the minimum,
**When** the visitor submits,
**Then** the system refuses with a validation error naming the password field, and no account is created.

**AC-05: Malformed email address**
**Given** a value that is not a valid email address,
**When** the visitor submits,
**Then** the system refuses with a validation error naming the email field.

**AC-06: An address on an internal reserved domain is accepted**
**Given** an address whose domain is an internal reserved name used for operational accounts,
**When** the visitor submits,
**Then** it is accepted as a valid address rather than rejected as a special-use domain.

**AC-07: Missing required fields**
**Given** the form is submitted with the email or password absent,
**When** the system processes it,
**Then** the missing fields are reported and no registration is attempted.

**AC-08: The display name is optional**
**Given** a registration with no display name,
**When** it is submitted,
**Then** the account is created and the absent name is not treated as an error.

**AC-09: A verification message is issued**
**Given** a registration succeeds,
**When** the system completes it,
**Then** a verification message is sent to the address supplied, carrying a single-use link.

**AC-10: The verification link expires**
**Given** a verification link,
**When** its validity window passes,
**Then** it can no longer activate the account.

**AC-11: Verifying within the window activates the account**
**Given** a valid, unexpired, unused verification link,
**When** the recipient opens it,
**Then** the account becomes active and verified and the verification time is recorded.

**AC-12: An expired verification link is refused as expired**
**Given** a verification link past its validity window,
**When** the recipient opens it,
**Then** the system refuses, stating the link has expired, and the account stays unverified.

**AC-13: A used verification link is refused as used**
**Given** a verification link that has already activated the account,
**When** it is opened again,
**Then** the system refuses, stating the link was already used, and the account's verified state is unchanged.

**AC-14: An unknown verification link is refused**
**Given** a link value that matches no issued verification,
**When** it is opened,
**Then** the system refuses without revealing whether any account is involved.

**AC-15: A missing verification link value**
**Given** the verification page is reached with no link value at all,
**When** it loads,
**Then** the user is told the link is missing rather than shown a failure of the system.

**AC-16: An unverified account cannot be used to log in**
**Given** a registered but unverified account,
**When** its owner attempts to log in with correct credentials,
**Then** access is refused and verification is requested.

**AC-17: Registration is recorded**
**Given** any registration attempt, successful or refused,
**When** it completes,
**Then** an audit record is written with the outcome, the address supplied, the time, and the source address.

**AC-18: Registration feedback stays on the form**
**Given** a registration is refused,
**When** the response returns,
**Then** the reason is shown on the form the visitor filled in, without navigating away or clearing their input.

---

### Auth-US-02: User Login

**As a** registered user, **I want to** log in, **so that** I can reach my workspaces.

#### Acceptance Criteria

**AC-19: Login with correct credentials on a verified account**
**Given** an active, verified account and its correct password,
**When** the user submits the login form,
**Then** access is granted, session credentials are issued, and the user lands on their workspace list.

**AC-20: The response carries what the client needs and nothing more**
**Given** a successful login,
**When** the response is examined,
**Then** it carries the session credentials, their lifetime, and the user's identity, and carries no password or password hash.

**AC-21: Login with a wrong password**
**Given** an existing account and an incorrect password,
**When** the user submits,
**Then** access is refused as invalid credentials, without stating which field was wrong.

**AC-22: Login for an address with no account**
**Given** no account exists for the supplied address,
**When** the user submits,
**Then** access is refused with a distinct "no such account" outcome, and no failed-attempt record is created — there is no account to protect.

**AC-23: A failed attempt against an existing account is counted**
**Given** an existing account and a wrong password,
**When** the attempt is refused,
**Then** a failed-attempt record is kept against that address.

**AC-24: A successful login clears the failure count**
**Given** an account with earlier failed attempts inside the window,
**When** a correct login succeeds,
**Then** the accumulated failures no longer count towards locking.

**AC-25: Login before verifying the email**
**Given** a registered account whose address is not yet verified,
**When** its owner submits correct credentials,
**Then** access is refused and verification is requested, distinctly from a credential failure.

**AC-26: Repeated failures lock the account**
**Given** an existing account has reached the failure threshold inside the detection window,
**When** a further attempt is made,
**Then** access is refused as locked.

**AC-27: A locked account is refused even with the correct password**
**Given** a locked account,
**When** its owner submits the correct password,
**Then** access is still refused as locked.

**AC-28: Failures outside the window do not accumulate**
**Given** failed attempts older than the detection window,
**When** a further attempt is made,
**Then** those older failures do not count towards locking.

**AC-29: Locking is per account, not global**
**Given** one account has been locked,
**When** a different account logs in correctly,
**Then** that other account is unaffected.

**AC-30: Missing credentials**
**Given** the login form is submitted with the email or password absent,
**When** the system processes it,
**Then** the missing fields are reported and no authentication is attempted.

**AC-31: A failure keeps the user on the login form**
**Given** a login attempt is refused for any reason,
**When** the response returns,
**Then** the reason is displayed on the login form and remains readable until the user acts — the page does not reload or navigate.

**AC-32: A refusal does not establish any session**
**Given** a refused login,
**When** the browser state is examined,
**Then** no session credential has been stored.

**AC-33: Session credentials are stored so the client can act on them**
**Given** a successful login,
**When** the client stores the issued credentials,
**Then** later requests carry the access credential without the user re-entering anything.

**AC-34: Reaching a protected destination without a session**
**Given** a visitor holding no valid session,
**When** they navigate directly to a protected destination,
**Then** they are sent to the login page rather than shown the destination.

**AC-35: An expired session on a protected request sends the user to log in**
**Given** a user whose session credential is no longer valid,
**When** they make a protected request,
**Then** the stored credentials are cleared and they are sent to the login page.

**AC-36: A refused login is not treated as an expired session**
**Given** a login attempt refused for wrong credentials,
**When** the client handles the refusal,
**Then** it is handled by the form that asked, and no session-expiry redirect occurs.

**AC-37: Every login attempt is recorded**
**Given** any login attempt, successful or refused,
**When** it completes,
**Then** an audit record is written with the outcome, the address supplied, the failure reason where applicable, the time, and the source address.

**AC-38: Secrets never appear in logs**
**Given** any login outcome at any log level,
**When** logs are examined,
**Then** no password, password hash, or session credential appears in them.

---

### Auth-US-03: Token Refresh

**As a** logged-in user, **I want to** stay signed in without re-entering my password, **so that** a working session is not interrupted.

#### Acceptance Criteria

**AC-39: Exchanging a valid refresh credential**
**Given** a refresh credential that is unexpired and unrevoked,
**When** the client exchanges it,
**Then** a new access credential is issued with a fresh lifetime.

**AC-40: The refresh credential is rotated on use**
**Given** a successful exchange,
**When** it completes,
**Then** a new refresh credential is issued and the one presented is no longer usable.

**AC-41: A rotated credential cannot be reused**
**Given** a refresh credential that has already been exchanged,
**When** it is presented again,
**Then** the exchange is refused.

**AC-42: An expired refresh credential is refused**
**Given** a refresh credential past its lifetime,
**When** it is presented,
**Then** the exchange is refused and the user must log in again.

**AC-43: A revoked refresh credential is refused**
**Given** a refresh credential revoked by logout,
**When** it is presented,
**Then** the exchange is refused.

**AC-44: An unknown refresh credential is refused**
**Given** a value matching no issued credential,
**When** it is presented,
**Then** the exchange is refused without revealing whether any account is involved.

**AC-45: A malformed or absent credential**
**Given** a request to exchange with no credential or a malformed one,
**When** it is processed,
**Then** it is refused as a validation failure rather than as an authentication decision.

**AC-46: An access credential cannot be exchanged as a refresh credential**
**Given** an access credential presented where a refresh credential is expected,
**When** it is processed,
**Then** the exchange is refused.

**AC-47: Refresh does not extend a locked account's access**
**Given** an account locked after the credential was issued,
**When** the credential is exchanged,
**Then** the exchange is refused.

**AC-48: A refused exchange sends the user to log in**
**Given** an exchange is refused,
**When** the client handles it,
**Then** stored credentials are cleared and the user is sent to the login page.

**AC-49: Exchange does not require the password**
**Given** a valid refresh credential,
**When** it is exchanged,
**Then** no password is requested or transmitted.

**AC-50: Refresh outcomes are recorded**
**Given** any exchange attempt, successful or refused,
**When** it completes,
**Then** an audit record is written with the outcome, the time, and the source address.

---

### Auth-US-04: Logout

**As a** logged-in user, **I want to** log out, **so that** my session cannot be reused on a shared device.

#### Acceptance Criteria

**AC-51: Logging out revokes the session**
**Given** a logged-in user,
**When** they log out,
**Then** the refresh credential is revoked and can no longer be exchanged.

**AC-52: Stored credentials are cleared from the browser**
**Given** a logout completes,
**When** the browser state is examined,
**Then** no access or refresh credential remains stored.

**AC-53: After logout, protected destinations are unreachable**
**Given** a user who has logged out,
**When** they navigate to a protected destination,
**Then** they are sent to the login page.

**AC-54: Logging out twice**
**Given** a user who has already logged out,
**When** logout is requested again,
**Then** the request is handled without error and the session remains revoked.

**AC-55: Logging out with an unknown credential**
**Given** a logout request carrying a credential that matches no issued session,
**When** it is processed,
**Then** the request completes without revealing whether any session existed.

**AC-56: Logout does not affect other sessions of the same user**
**Given** the same user is logged in on two devices,
**When** they log out on one,
**Then** the other device's session continues to work.

**AC-57: Logout does not delete the account or its data**
**Given** a logout completes,
**When** the account is examined,
**Then** the account and everything it owns are unchanged.

**AC-58: Logout is recorded**
**Given** any logout, successful or refused,
**When** it completes,
**Then** an audit record is written with the outcome, the identity, the time, and the source address.

**AC-59: The user is returned to a public page**
**Given** a logout completes,
**When** the browser settles,
**Then** the user is on a public page and no protected content remains on screen.

**AC-60: Logging out mid-request does not leave protected data visible**
**Given** a user logs out while a protected request is in flight,
**When** that request resolves,
**Then** its data is not rendered into a session that no longer exists.

---

## Edge Cases

- **EC-001**: A visitor opens the login page while already holding a valid session.
- **EC-002**: An account is locked between the credentials being submitted and the check running.
- **EC-003**: A verification link is opened twice in quick succession, the second arriving before the first has committed.
- **EC-004**: The login form is submitted twice in quick succession.
- **EC-005**: Two tabs exchange the same refresh credential concurrently.
- **EC-006**: Registration is submitted twice with the same address in quick succession.
- **EC-007**: A user logs out in one tab while another tab is still using the session.
- **EC-008**: The verification message never arrives and the visitor registers again with the same address.
- **EC-009**: A password consisting entirely of whitespace at the minimum length.
- **EC-010**: An address differing from an existing one only by letter case.
- **EC-011**: The account is deleted between the session being issued and a protected request arriving.
- **EC-012**: The clock moves such that a credential appears to be issued in the future.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST accept a registration of an email address, a password, and an optional display name.
- **FR-002**: The system MUST refuse a registration whose address already belongs to an account.
- **FR-003**: The system MUST require a password of at least eight characters.
- **FR-004**: The system MUST validate the address is well formed before creating an account.
- **FR-005**: The system MUST accept addresses on internal reserved domains.
- **FR-006**: The system MUST store passwords only as one-way hashes.
- **FR-007**: The system MUST create every new account inactive and unverified.
- **FR-008**: The system MUST issue a single-use verification link with a bounded validity window.
- **FR-009**: The system MUST activate and mark verified an account whose valid, unexpired, unused link is opened, recording when.
- **FR-010**: The system MUST refuse an expired verification link distinctly from one already used.
- **FR-011**: The system MUST refuse an unknown verification link without revealing account existence.
- **FR-012**: The system MUST refuse login for an unverified account, requesting verification.
- **FR-013**: The system MUST refuse login when the address has no account, and MUST NOT record a failed attempt for it.
- **FR-014**: The system MUST refuse login when the password does not match, and MUST record the attempt against that address.
- **FR-015**: The system MUST clear accumulated failures on a successful login.
- **FR-016**: The system MUST lock an account after five consecutive failures inside the detection window.
- **FR-017**: The system MUST refuse a locked account regardless of credential correctness.
- **FR-018**: The system MUST disregard failures older than the detection window.
- **FR-019**: The system MUST scope locking to a single account.
- **FR-020**: The system MUST issue an access credential and a refresh credential on successful login, and state the access lifetime.
- **FR-021**: The system MUST exclude passwords and hashes from every response.
- **FR-022**: The system MUST exchange an unexpired, unrevoked refresh credential for a new access credential.
- **FR-023**: The system MUST rotate the refresh credential on every exchange and refuse the presented one thereafter.
- **FR-024**: The system MUST refuse an expired, revoked, or unknown refresh credential.
- **FR-025**: The system MUST refuse an access credential presented in place of a refresh credential.
- **FR-026**: The system MUST NOT require a password to exchange a refresh credential.
- **FR-027**: The system MUST revoke the refresh credential on logout.
- **FR-028**: The system MUST leave other sessions of the same user intact on logout.
- **FR-029**: The system MUST clear stored credentials in the browser on logout and on an expired-session refusal.
- **FR-030**: The system MUST send a visitor without a valid session to the login page when they reach a protected destination.
- **FR-031**: The system MUST keep a refused login on the form that produced it, without navigating away or clearing input.
- **FR-032**: The system MUST distinguish an authentication refusal on an authentication request from an expired session on a protected request, and MUST NOT redirect for the former.
- **FR-033**: The system MUST write an audit record for every registration, verification, login, refresh, and logout attempt, capturing outcome, identity supplied, failure reason where applicable, time, and source address.
- **FR-034**: The system MUST NOT write passwords, password hashes, or session credentials to any log at any level.
- **FR-035**: The system MUST treat logout of an already-revoked or unknown session as a completed request rather than an error.

### Key Entities

- **User**: A person with access to the system, identified by their email address, holding a verification state, an active/locked access state, and a one-way password hash.
- **Verification link**: A single-use, time-limited proof that a person controls the address they registered, carrying its own issued, expiry, and used states.
- **Refresh credential**: A longer-lived proof of an established session, exchangeable for short-lived access, rotated on use and revocable on logout.
- **Login attempt**: A record of one authentication attempt against an existing account, carrying its outcome, the source address, and its time, used to decide locking.
- **Audit record**: The durable trace of an authentication event, carrying the event name, action, outcome, error code where applicable, identity, and source address.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A registered, verified user completes login in under five seconds from submit to landing.
- **SC-002**: Every registration, verification, login, refresh, and logout attempt produces exactly one audit record, verified across 100 consecutive attempts.
- **SC-003**: An attempt against an address with no account leaves no login-attempt record whatsoever.
- **SC-004**: After five consecutive failures the sixth attempt is refused as locked, with no manual intervention.
- **SC-005**: Passwords, hashes, and session credentials are absent from all logs at every level, verified by scan after each release.
- **SC-006**: A refused login leaves its message visible on the form until the user acts, with no reload, in 100% of tested refusals.
- **SC-007**: A rotated refresh credential is refused on reuse in 100% of attempts.
- **SC-008**: Protected destinations send a session-less visitor to login 100% of the time, with no bypass by direct navigation.
- **SC-009**: A logout revokes the presented session and leaves other sessions of the same user working, verified across two concurrent devices.
- **SC-010**: No response body at any point contains a password or password hash, verified by scanning responses across the whole suite.

---

## Assumptions

- Self-registration is open; no invitation is required to create an account.
- One address, one account; an address is not reusable after verification.
- Password reset and account unlock by an administrator are separate stories, out of scope here.
- No single sign-on or external identity provider is required.
- Addresses on internal reserved domains must be accepted, because operational accounts use them.
- The detection window and lock duration are operational settings, not story constants.
- Email delivery is best effort; the system's obligation ends at issuing the message.
- Rate limiting of authentication endpoints is **not** covered by any story yet; see [plan.md](plan.md) Open Risks.
- Multi-factor authentication is out of scope.
- Session credentials are held by the browser in cookies readable by the client script, which is why the audit and revocation rules above carry the security weight.
