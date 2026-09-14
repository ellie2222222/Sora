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
USER
WALLET
ACCOUNT
TRANSACTION
CATEGORY
BUDGET
GOAL
INVITATION
SPACE
MEMBER
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

Use a small, consistent vocabulary of conditions.

### Not Found

```text
<RESOURCE>_NOT_FOUND
```

Examples:

```text
WALLET_NOT_FOUND
ACCOUNT_NOT_FOUND
TRANSACTION_NOT_FOUND
CATEGORY_NOT_FOUND
```

### Already Exists

```text
<RESOURCE>_ALREADY_EXISTS
```

Examples:

```text
WALLET_ALREADY_EXISTS
CATEGORY_ALREADY_EXISTS
INVITATION_ALREADY_EXISTS
```

Use this for uniqueness/conflict situations where the resource or requested entity already exists.

### In Use

```text
<RESOURCE>_IN_USE
```

Examples:

```text
CATEGORY_IN_USE
ACCOUNT_IN_USE
WALLET_IN_USE
```

Use this when deletion or replacement is blocked because another resource depends on it.

### Archived

```text
<RESOURCE>_ARCHIVED
```

Examples:

```text
ACCOUNT_ARCHIVED
CATEGORY_ARCHIVED
WALLET_ARCHIVED
```

### Deleted

```text
<RESOURCE>_DELETED
```

Use only when distinguishing deleted state is meaningful to the API.

### Invalid

Use:

```text
<RESOURCE>_INVALID
```

only when the resource itself is semantically invalid.

Prefer a more specific condition when possible.

For example:

```text
AMOUNT_INVALID
```

is better than:

```text
TRANSACTION_INVALID
```

when the actual problem is the amount.

---

## 4. Action-Specific Errors

When the problem is specifically related to an operation, use:

```text
<RESOURCE>_<ACTION>_<CONDITION>
```

Examples:

```text
TRANSACTION_CREATE_FAILED
TRANSACTION_UPDATE_FAILED
TRANSACTION_DELETE_FAILED

INVITATION_ACCEPT_FAILED
INVITATION_REVOKED
INVITATION_EXPIRED

TRANSFER_SAME_ACCOUNT
TRANSFER_INSUFFICIENT_BALANCE
```

However, avoid generic `*_FAILED` codes when a more meaningful condition exists.

Prefer:

```text
TRANSFER_SAME_ACCOUNT
```

over:

```text
TRANSFER_FAILED
```

Prefer:

```text
INSUFFICIENT_BALANCE
```

over:

```text
TRANSFER_FAILED
```

when insufficient balance is the actual reason.

---

## 5. Permission Errors

For authorization failures, prefer resource + action:

```text
<RESOURCE>_<ACTION>_FORBIDDEN
```

Examples:

```text
WALLET_VIEW_FORBIDDEN
WALLET_EDIT_FORBIDDEN
WALLET_DELETE_FORBIDDEN

TRANSACTION_CREATE_FORBIDDEN
TRANSACTION_EDIT_FORBIDDEN
TRANSACTION_DELETE_FORBIDDEN
```

When the restriction is not resource-specific, use:

```text
PERMISSION_DENIED
AUTH_REQUIRED
```

Do not create vague codes such as:

```text
ACCESS_ERROR
USER_ERROR
ACTION_NOT_ALLOWED
```

when the actual meaning can be expressed more precisely.

---

## 6. Authentication Errors

Authentication is a system-level domain, so use explicit authentication codes:

```text
AUTH_REQUIRED
INVALID_CREDENTIALS
SESSION_EXPIRED
ACCOUNT_DISABLED
```

Do not use:

```text
USER_NOT_FOUND
```

as an authentication response when doing so could expose whether an account exists.

Use the appropriate security-safe code instead.

---

## 7. Validation Errors

Validation errors should describe the actual invalid field or rule where practical.

Prefer:

```text
AMOUNT_INVALID
EMAIL_INVALID
PASSWORD_TOO_WEAK
TRANSFER_SAME_ACCOUNT
DATE_RANGE_INVALID
```

rather than:

```text
TRANSACTION_INVALID
REQUEST_INVALID
DATA_INVALID
```

For reusable validation errors, use a field/rule-oriented name rather than inventing resource-specific duplicates.

---

## 8. Balance / Financial Rules

Financial constraints should describe the actual business rule.

Examples:

```text
INSUFFICIENT_BALANCE
TRANSFER_SAME_ACCOUNT
ACCOUNT_CURRENCY_MISMATCH
INVALID_AMOUNT
AMOUNT_MUST_BE_POSITIVE
```

Avoid:

```text
TRANSACTION_FAILED
TRANSFER_FAILED
FINANCE_ERROR
```

when the underlying reason is known.

---

## 9. Invitation / Membership Errors

Use the resource prefix consistently:

```text
INVITATION_NOT_FOUND
INVITATION_EXPIRED
INVITATION_REVOKED
INVITATION_ALREADY_ACCEPTED
INVITATION_ALREADY_EXISTS

MEMBER_NOT_FOUND
MEMBER_ALREADY_EXISTS
MEMBER_ALREADY_REMOVED
```

Keep invitation lifecycle conditions under `INVITATION_*` rather than creating generic codes.

---

## 10. Sync / Network / Infrastructure Errors

Not every error needs a resource prefix.

Use system-level codes when the failure is genuinely system-wide:

```text
INTERNAL_ERROR
SERVICE_UNAVAILABLE
RATE_LIMITED
SYNC_FAILED
NETWORK_UNAVAILABLE
TIMEOUT
```

However, `NETWORK_UNAVAILABLE` and similar codes should normally be generated by the client when the device cannot reach the server. Do not force a client-side network condition into the server `ErrorCode` enum unless the API actually returns that condition.

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

INSUFFICIENT_BALANCE
→ errors.insufficientBalance
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
* Add the corresponding client i18n key.
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
INVITATION_REVOKED
TRANSFER_SAME_ACCOUNT
INSUFFICIENT_BALANCE
PERMISSION_DENIED
AUTH_REQUIRED
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
