# ErrorCode Naming Convention

Establish a consistent naming convention for all `ErrorCode` values in `@sora/contracts`.

The purpose is to make codes:

* predictable
* searchable
* readable
* easy to map to i18n
* stable as the API evolves
* independent of user-facing language

## 1. Base Pattern

Use:

```text
<RESOURCE>_<CONDITION>
```

Examples:

```text
WALLET_NOT_FOUND
ACCOUNT_NOT_FOUND
TRANSACTION_NOT_FOUND
CATEGORY_NOT_FOUND
GOAL_NOT_FOUND
BUDGET_NOT_FOUND
INVITATION_NOT_FOUND
```

The **resource comes first**, followed by the condition.

Do not reverse the order:

```text
NOT_FOUND_WALLET
NOT_FOUND_ACCOUNT
```

---

## 2. Resource Names

Use the canonical domain/resource name already used by the system.

Examples:

```text
WALLET
MEMBER
INVITATION
ACCOUNT
CATEGORY
TRANSACTION
TRANSFER
BUDGET
GOAL
CONTRIBUTION
AI_CONVERSATION
AI_MESSAGE
```

Use singular nouns.

Prefer:

```text
WALLET_NOT_FOUND
```

over:

```text
WALLETS_NOT_FOUND
```

The code describes the resource type, not the number of records.

---

## 3. Common Conditions

Use a small, consistent vocabulary of conditions. Every example below is a real code in `ERROR_CODES`
(`packages/contracts/src/responses.ts`); a pattern with no example yet has no code using it.

| Condition | Pattern | In use |
|---|---|---|
| Missing or not visible (404, AC-01) | `<RESOURCE>_NOT_FOUND` | `WALLET_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `BUDGET_NOT_FOUND`, `GOAL_NOT_FOUND`, `MEMBER_NOT_FOUND`, `INVITATION_NOT_FOUND` |
| Already present (409) | `<RESOURCE>_ALREADY_<STATE>` | `MEMBER_ALREADY_EXISTS`, `INVITATION_ALREADY_OPEN`, `INVITATION_ALREADY_USED`, `TRANSACTION_ALREADY_DELETED` |
| Taken name (409, VL-02) | `<RESOURCE>_DUPLICATE_<FIELD>` | `CATEGORY_DUPLICATE_NAME` |
| Blocked by a dependant (409) | `<RESOURCE>_IN_USE` / `_HAS_<DEPENDANT>` | `CATEGORY_IN_USE`, `CATEGORY_HAS_TRANSACTIONS`, `TRANSACTION_BACKS_CONTRIBUTION` |
| Archived or closed (409, VL-03) | `<RESOURCE>_ARCHIVED` / `_NOT_ACTIVE` | `WALLET_ARCHIVED`, `ACCOUNT_ARCHIVED`, `CATEGORY_ARCHIVED`, `CATEGORY_PARENT_ARCHIVED`, `GOAL_NOT_ACTIVE` |
| Mismatch between two things | `<RESOURCE>_<FIELD>_MISMATCH` / `_WRONG_<FIELD>` | `ACCOUNT_CURRENCY_MISMATCH`, `TRANSFER_CURRENCY_MISMATCH`, `INVITATION_EMAIL_MISMATCH`, `CATEGORY_WRONG_TYPE`, `CATEGORY_WRONG_WALLET` |
| Would break an invariant | `<RESOURCE>_<RULE>` | `WALLET_LAST_OWNER`, `ACCOUNT_LAST_ACTIVE`, `CATEGORY_CYCLE`, `BUDGET_PERIOD_OVERLAP`, `TRANSFER_SAME_ACCOUNT` |

Prefer the specific condition to a generic one: `TRANSFER_SAME_ACCOUNT`, never `TRANSFER_FAILED`.

---

## 4. Action-Specific Errors

When the condition only exists for one operation, name the operation's subject:

```text
TRANSFER_SAME_ACCOUNT
TRANSFER_CURRENCY_MISMATCH
AI_ACTION_NOT_PENDING
```

Do not add `*_FAILED` codes (`TRANSACTION_CREATE_FAILED`): an unexpected failure is `INTERNAL_ERROR`, and an
expected one has a condition worth naming.

---

## 5. Permission Errors

There is one permission code, `FORBIDDEN` (403), for a member whose role is too low. A caller with no
membership gets the resource's `*_NOT_FOUND` (404) instead (AC-01), so a code can never reveal that a
wallet exists. Do not add per-action codes (`WALLET_EDIT_FORBIDDEN`): the app reads the role from the
wallet, not from the error, and a second code per action is a second copy of the role table.

---

## 6. Authentication Errors

```text
UNAUTHENTICATED          no or unusable credentials
TOKEN_EXPIRED            a token past its lifetime
TOKEN_INVALID            a token that is malformed, unknown or revoked
CREDENTIALS_INVALID      wrong email or password, identical for both
EMAIL_ALREADY_REGISTERED
GOOGLE_TOKEN_INVALID
GOOGLE_ACCOUNT_MISMATCH
RATE_LIMITED

EMAIL_ALREADY_VERIFIED             409
EMAIL_VERIFICATION_CODE_INVALID    422  a wrong code; the guess counts
EMAIL_VERIFICATION_EXPIRED         410  none sent, past its time, or its five guesses spent
EMAIL_DELIVERY_UNAVAILABLE         503  no mail server, or it refused the message
```

Never answer an unknown email differently from a wrong password (no `USER_NOT_FOUND` at login): that
would let login enumerate registered addresses.

---

## 7. Validation Errors

Request validation is one code, `VALIDATION_FAILED` (422), with the failing fields in the envelope's
`error.fields` (API spec §2.1). Field-level detail belongs there, not in new codes (`AMOUNT_INVALID`, `EMAIL_INVALID`). A rule
that needs a lookup (a currency mismatch, an overlap) gets its own code from §3.

---

## 8. Balance / Financial Rules

Name the business rule: `ACCOUNT_CURRENCY_MISMATCH`, `TRANSFER_SAME_ACCOUNT`, `BUDGET_PERIOD_OVERLAP`.
There is deliberately no `INSUFFICIENT_BALANCE`: an account may go negative (a credit card opens
negative, VL-04).

---

## 9. Invitation / Membership Errors

Keep the lifecycle under its resource prefix:

```text
INVITATION_NOT_FOUND
INVITATION_EXPIRED        410
INVITATION_ALREADY_USED
INVITATION_ALREADY_OPEN
INVITATION_EMAIL_MISMATCH
INVITATION_EMAIL_UNVERIFIED   403

MEMBER_NOT_FOUND
MEMBER_ALREADY_EXISTS
WALLET_LAST_OWNER
```

---

## 10. Sync / Network / Infrastructure Errors

System-wide failures carry no resource prefix: `INTERNAL_ERROR`, `RATE_LIMITED`, `ROUTE_NOT_FOUND`,
`IDEMPOTENCY_KEY_IN_USE`, `VALUATION_UNAVAILABLE`.

The assistant's model is an upstream dependency, so its failures are named for it: `AI_PROVIDER_UNAVAILABLE` and
`AI_PROVIDER_BUSY` (503), `AI_PROVIDER_TIMEOUT` (504), and `AI_REQUEST_CANCELLED` (499, logged only: the client that
would read it has already gone).

A device that cannot reach the server is the client's condition, not the API's. The app detects it
(`isNetworkError` in `mobile/src/utils/errors.ts`) and never adds it to the server `ErrorCode` enum.

---

## 11. Generic Fallback

Use one canonical server-side fallback:

```text
INTERNAL_ERROR
```

Client translation:

```text
errors.internalError
```

Example:

> Something went wrong. Please try again.

Never expose internal exception details as error codes.

---

## 12. Avoid Synonyms

Choose one canonical word and use it everywhere.

For example, do not mix:

```text
NOT_FOUND
MISSING
DOES_NOT_EXIST
UNAVAILABLE
```

for the same semantic condition.

Use:

```text
<RESOURCE>_NOT_FOUND
```

consistently.

Likewise, choose one:

```text
FORBIDDEN
```

rather than mixing:

```text
DENIED
NOT_ALLOWED
UNAUTHORIZED
```

unless those terms represent genuinely different HTTP/security semantics.

---

## 13. ErrorCode → i18n Naming

Map the API code to a camelCase translation key using the same semantic structure.

Examples:

```text
WALLET_NOT_FOUND
→ errors.walletNotFound

ACCOUNT_NOT_FOUND
→ errors.accountNotFound

CATEGORY_IN_USE
→ errors.categoryInUse

TRANSFER_SAME_ACCOUNT
→ errors.transferSameAccount

BUDGET_PERIOD_OVERLAP
→ errors.budgetPeriodOverlap
```

The transformation should be predictable:

```text
UPPER_SNAKE_CASE
        ↓
camelCase
```

Do not create unrelated translation names.

Bad:

```text
WALLET_NOT_FOUND
→ errors.missingWallet
```

Good:

```text
WALLET_NOT_FOUND
→ errors.walletNotFound
```

---

## 14. Naming Decision Order

When introducing a new error, determine it in this order:

```text
1. What domain/resource is affected?
        ↓
2. What exactly happened?
        ↓
3. Is the condition reusable?
        ↓
4. Can an existing condition describe it?
        ↓
5. If not, create a new semantic code.
```

Example:

> User tries to delete a category that is referenced by transactions.

Result:

```text
CATEGORY_IN_USE
```

Not:

```text
CATEGORY_DELETE_FAILED
```

Example:

> User tries to transfer money into the same account.

Result:

```text
TRANSFER_SAME_ACCOUNT
```

Not:

```text
TRANSACTION_INVALID
```

Example:

> Requested wallet does not exist.

Result:

```text
WALLET_NOT_FOUND
```

---

## 15. Rules for Future Development

Every new `ErrorCode` should follow these rules:

* Use `UPPER_SNAKE_CASE`.
* Prefer `<RESOURCE>_<CONDITION>`.
* Use singular resource names.
* Use stable semantic terminology.
* Prefer specific conditions over generic `*_FAILED`.
* Reuse existing conditions before creating a synonym.
* Keep codes language-neutral.
* Never include IDs, names, or dynamic values in the code.
* Do not encode HTTP status into the code.
* Add it to `ERROR_CODES` with its status in `ERROR_STATUS` (`packages/contracts/src/responses.ts`), never at a call site.
* Add the corresponding client i18n key (`mobile/src/utils/errors.ts`).
* Add translations for all supported locales.
* Add/update tests when the code affects important business behavior.

### Examples

Good:

```text
WALLET_NOT_FOUND
ACCOUNT_ARCHIVED
CATEGORY_IN_USE
TRANSACTION_NOT_FOUND
INVITATION_EXPIRED
INVITATION_ALREADY_USED
TRANSFER_SAME_ACCOUNT
BUDGET_PERIOD_OVERLAP
FORBIDDEN
UNAUTHENTICATED
INTERNAL_ERROR
```

Avoid:

```text
walletError
walletMissing
WalletNotFound
404_WALLET
WALLET_123_NOT_FOUND
FAILED_TO_FIND_WALLET
SOMETHING_WRONG_WITH_WALLET
```

The objective is to make an `ErrorCode` understandable **without seeing its translation or implementation**.

> **Name the condition, not the sentence shown to the user.**
