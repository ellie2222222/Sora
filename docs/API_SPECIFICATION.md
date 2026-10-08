# Sora — API Specification

**Version:** v1
**Base path:** `/api/v1`
**Transport:** HTTPS, JSON only (`Content-Type: application/json`)
**Status:** authoritative contract. The types and validation rules referenced throughout are exported from [`@sora/contracts`](../packages/contracts/src/) and imported by both the API and the mobile app — this document describes them, it does not re-declare them.

Every endpoint below documents: **Method · URL · Authentication · Authorization · Request · Validation · Response · Errors · Side effects**, per §7 of the development plan.

---

## 1. Model summary

A **Wallet** is one person's finances. An **Account** is where that person's money sits. **WalletMember** grants another real user a role on a wallet — that is what makes tracking a partner's or a family member's money possible. There is no workspace layer: the wallet *is* the sharing boundary.

```text
User ──owns──▶ Wallet ──contains──▶ Account ──▶ Transaction
      ──member of──▶ Wallet ──▶ Category / Budget / Goal
```

A transaction hangs off accounts, not off a wallet, so a **cross-wallet transfer** (paying your partner back) is one transaction rather than two disconnected entries.

---

## 2. Conventions

### 2.1 Response envelope

Every response — success or failure — is wrapped. Type: `ApiEnvelope<T>`.

```json
{
  "success": true,
  "message": "Optional human-readable note",
  "data": { },
  "meta": {
    "timestamp": "2026-08-22T10:30:00Z",
    "pagination": { "page": 1, "pageSize": 25, "total": 132, "hasMore": true }
  }
}
```

`meta.pagination` appears only on list endpoints. Errors use `ApiErrorBody`:

```json
{
  "success": false,
  "message": "End date cannot be before start date",
  "error": {
    "code": "VALIDATION_FAILED",
    "fields": { "endDate": ["End date cannot be before start date"] }
  },
  "meta": { "timestamp": "2026-08-22T10:30:00Z" }
}
```

### 2.2 Money

**All monetary values are JSON strings, never numbers** — `"150000.0000"`, not `150000`. The columns are `DECIMAL(19,4)`, whose range exceeds the 2^53 boundary where float64 stops representing integers exactly, and float arithmetic cannot represent `0.1 + 0.2` either. Clients must parse with `parseMoney()` from `@sora/contracts` and never with `Number()`.

Amounts are always **positive**; direction comes from the transaction `type` and from which account side is populated.

### 2.3 Dates

| Kind | Format | Example |
|---|---|---|
| Calendar date | `YYYY-MM-DD` | `2026-08-22` |
| Instant | ISO-8601 with offset | `2026-08-22T10:30:00Z` |

Every calendar date a wallet is judged on is a day in the **wallet's time zone** (§2.12), never UTC and never the caller's. Budget windows are **inclusive on both ends** and compared by that day, so in an `Asia/Ho_Chi_Minh` wallet an expense at `2026-08-31T16:30:00Z` (23:30 local) falls inside an August budget, and one at `2026-08-31T17:30:00Z` (00:30 on September 1 local) does not.

### 2.4 Authentication

`Authorization: Bearer <accessToken>`. Access tokens live 15 minutes; refresh tokens 7 days and are single-use (rotated on every refresh). Only the refresh token's hash is stored, so a database read cannot mint a session.

Public endpoints: `/health`, `/auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/invitations/preview`.

### 2.5 Authorization

Access is **role-based per wallet**, resolved from `wallet_members`:

```text
OWNER   administer the wallet: membership, roles, ownership transfer, archive
EDITOR  create and edit accounts, categories, transactions, budgets, goals
VIEWER  read only
```

Ranks compare (`roleSatisfies()`): OWNER ⊇ EDITOR ⊇ VIEWER. Everything under a wallet inherits that wallet's role — there is no per-row override.

| Operation class | Minimum role |
|---|---|
| Read anything under the wallet | `VIEWER` |
| Create / edit accounts, categories, transactions, budgets, goals | `EDITOR` |
| Invite, revoke, change roles, transfer ownership, archive wallet | `OWNER` |

**A user with no membership row gets `404`, not `403`**, for any wallet-scoped resource. `403` would confirm the resource exists, which leaks whether a given wallet or account id is real to someone who has no access to it. `403` is reserved for cases where membership *is* established but the role is insufficient.

**Cross-wallet transfer rule:** a `TRANSFER` whose two accounts sit in different wallets requires `EDITOR` or above on **both** wallets. Deliberately stricter than a same-wallet transfer, because it moves money across a person boundary — read-only access to someone's wallet must not let you push money into it.

### 2.6 Status codes

| Code | Meaning |
|---|---|
| 200 | Successful read / update / action |
| 201 | Created |
| 204 | Success, no body (archive, logout) |
| 400 | Malformed request (unparseable body, bad query type) |
| 401 | Unauthenticated, or token expired/invalid |
| 403 | Authenticated and a member, but role insufficient |
| 404 | Not found, or not visible to this user |
| 409 | Business conflict (duplicate, immutable, overlap) |
| 410 | Gone (expired invitation) |
| 422 | Validation failed |
| 429 | Rate limited |
| 500 | Unexpected server error |

### 2.7 Error codes

`UPPER_SNAKE_CASE`, resource-prefixed. The full list and its status mapping is `ERROR_CODES` / `ERROR_STATUS` in [`responses.ts`](../packages/contracts/src/responses.ts) — that map is the single source; this document does not restate it. A path no route matches returns `404 ROUTE_NOT_FOUND`, never a resource code such as `WALLET_NOT_FOUND`: the resource was not looked up. Every path parameter is a UUID id, so a path whose id segment is not a UUID is treated the same way — `404 ROUTE_NOT_FOUND`, before any lookup.

### 2.8 Pagination, filtering, sorting

- `?page=1&pageSize=25` — default 25, max 200.
- `?sortBy=-transactionDate,amount` — leading `-` is descending; multiple keys comma-separated.
- Filters are documented per endpoint.

### 2.9 Rate limiting

`/auth/login`, `/auth/register` and `/auth/refresh`: 10 requests per minute per IP, and for login additionally 5 consecutive failures per email before a 15-minute lockout. An attempt counts toward the lockout from the moment it starts, before its password is checked, so a burst of concurrent guesses cannot all slip under it; a success clears the count. Exceeding either returns `429 RATE_LIMITED` with a `Retry-After` header.

### 2.10 Idempotency

Mutating endpoints accept an optional `Idempotency-Key` header. A replay with the same key and same body returns the original response instead of creating a duplicate — the case this exists for is a mobile client retrying a transaction create over a flaky connection, where a duplicate is a real financial error.

- A replay that arrives **while the first attempt is still running** waits for it and receives the same response; the write happens once.
- The same key with a **different** body is refused with `422 VALIDATION_FAILED`.
- A first attempt that **failed** is not remembered, so its retry runs normally.
- Keys are scoped per user and kept for 24 hours, in memory per API process.

### 2.11 Locale

Starter categories (§5.1) are named in the request's locale wherever a category name appears — categories, transactions, budgets, the dashboard, the AI assistant's wallet snapshot. The locale is the highest-weighted supported language in `Accept-Language` (`vi-VN` reads as `vi`), else the caller's saved `locale` (§5.7), else `en`. A starter category without a translation in that locale falls back to English. A custom category is always returned exactly as its author typed it.

Translations live in `category_translations`, keyed by the category's `system_key`; they mirror `STARTER_CATEGORIES` in `packages/contracts`, which `scripts/check-contract-parity.mjs` checks. `CategoryResponse.systemKey` is set on a starter category and `null` on a custom one.

### 2.12 Time zones

Every wallet has a `timeZone`: an IANA name such as `Asia/Ho_Chi_Minh` or `America/Los_Angeles`, never a fixed offset. The API refuses `+07:00`, `GMT+7` or an unknown name with `422 VALIDATION_FAILED`, and `chk_wallet_time_zone` refuses them at the database. It is the zone in which that wallet's instants become calendar days, for **every** member alike. That covers:
- transaction `dateFrom`/`dateTo` filters (§11.1);
- budget windows and their `spent` (§12);
- dashboard periods and their default month (§14);
- audit date filters (§15.1);
- "today", wherever an endpoint defaults to it.

A date filter is the half-open interval from local midnight of `dateFrom` to local midnight after `dateTo`, so DST days are 23 or 25 hours long.

Example: in an `Asia/Ho_Chi_Minh` wallet, `2026-10-31T23:30:00Z` is 06:30 on November 1, so it belongs to November 1 and to November. In an `America/Los_Angeles` wallet the same instant is October 31.

Instants (`transactionDate`, `contributionDate`, `createdAt`) are stored as given and never rewritten. Changing a wallet's zone (§6.4) changes only which day each instant is read on, so figures near midnight can move between days, months and budget periods. Nothing stores a derived local date.

The app proposes the device's zone when a wallet is created (§5.1, §6.2), and the owner can change it.

---

## 3. Endpoint index

| # | Method | Path | Min role | § |
|---|---|---|---|---|
| 1 | GET | `/health` | public | [4.1](#41-get-health) |
| 2 | POST | `/auth/register` | public | [5.1](#51-post-authregister) |
| 3 | POST | `/auth/login` | public | [5.2](#52-post-authlogin) |
| 4 | POST | `/auth/refresh` | public | [5.3](#53-post-authrefresh) |
| 5 | POST | `/auth/logout` | authed | [5.4](#54-post-authlogout) |
| 6 | GET | `/auth/me` | authed | [5.5](#55-get-authme) |
| 7 | GET | `/wallets` | authed | [6.1](#61-get-wallets) |
| 8 | POST | `/wallets` | authed | [6.2](#62-post-wallets) |
| 9 | GET | `/wallets/{id}` | VIEWER | [6.3](#63-get-walletsid) |
| 10 | PATCH | `/wallets/{id}` | OWNER | [6.4](#64-patch-walletsid) |
| 11 | DELETE | `/wallets/{id}` | OWNER | [6.5](#65-delete-walletsid) |
| 12 | GET | `/wallets/{id}/members` | VIEWER | [7.1](#71-get-walletsidmembers) |
| 13 | PATCH | `/wallets/{id}/members/{memberId}` | OWNER | [7.2](#72-patch-walletsidmembersmemberid) |
| 14 | DELETE | `/wallets/{id}/members/{memberId}` | OWNER | [7.3](#73-delete-walletsidmembersmemberid) |
| 15 | POST | `/wallets/{id}/transfer-ownership` | OWNER | [7.4](#74-post-walletsidtransfer-ownership) |
| 16 | POST | `/wallets/{id}/leave` | VIEWER | [7.5](#75-post-walletsidleave) |
| 17 | GET | `/wallets/{id}/invitations` | OWNER | [8.1](#81-get-walletsidinvitations) |
| 18 | POST | `/wallets/{id}/invitations` | OWNER | [8.2](#82-post-walletsidinvitations) |
| 19 | DELETE | `/wallets/{id}/invitations/{invId}` | OWNER | [8.3](#83-delete-walletsidinvitationsinvid) |
| 20 | POST | `/invitations/preview` | public | [8.4](#84-post-invitationspreview) |
| 21 | POST | `/invitations/accept` | authed | [8.5](#85-post-invitationsaccept) |
| 22 | GET | `/accounts` | VIEWER | [9.1](#91-get-accounts) |
| 23 | POST | `/accounts` | EDITOR | [9.2](#92-post-accounts) |
| 24 | GET | `/accounts/{id}` | VIEWER | [9.3](#93-get-accountsid) |
| 25 | PATCH | `/accounts/{id}` | EDITOR | [9.4](#94-patch-accountsid) |
| 26 | DELETE | `/accounts/{id}` | EDITOR | [9.5](#95-delete-accountsid) |
| 27 | GET | `/categories` | VIEWER | [10.1](#101-get-categories) |
| 28 | POST | `/categories` | EDITOR | [10.2](#102-post-categories) |
| 29 | PATCH | `/categories/{id}` | EDITOR | [10.3](#103-patch-categoriesid) |
| 30 | DELETE | `/categories/{id}` | EDITOR | [10.4](#104-delete-categoriesid) |
| 31 | GET | `/transactions` | VIEWER | [11.1](#111-get-transactions) |
| 32 | POST | `/transactions` | EDITOR | [11.2](#112-post-transactions) |
| 33 | GET | `/transactions/{id}` | VIEWER | [11.3](#113-get-transactionsid) |
| 34 | PATCH | `/transactions/{id}` | EDITOR | [11.4](#114-patch-transactionsid) |
| 35 | POST | `/transactions/{id}/delete` | EDITOR | [11.5](#115-post-transactionsiddelete) |
| 36 | GET | `/budgets` | VIEWER | [12.1](#121-get-budgets) |
| 37 | POST | `/budgets` | EDITOR | [12.2](#122-post-budgets) |
| 38 | GET | `/budgets/{id}` | VIEWER | [12.3](#123-get-budgetsid) |
| 39 | PATCH | `/budgets/{id}` | EDITOR | [12.4](#124-patch-budgetsid) |
| 40 | DELETE | `/budgets/{id}` | EDITOR | [12.5](#125-delete-budgetsid) |
| 41 | GET | `/goals` | VIEWER | [13.1](#131-get-goals) |
| 42 | POST | `/goals` | EDITOR | [13.2](#132-post-goals) |
| 43 | GET | `/goals/{id}` | VIEWER | [13.3](#133-get-goalsid) |
| 44 | PATCH | `/goals/{id}` | EDITOR | [13.4](#134-patch-goalsid) |
| 45 | DELETE | `/goals/{id}` | EDITOR | [13.5](#135-delete-goalsid) |
| 46 | GET | `/goals/{id}/contributions` | VIEWER | [13.6](#136-get-goalsidcontributions) |
| 47 | POST | `/goals/{id}/contributions` | EDITOR | [13.7](#137-post-goalsidcontributions) |
| 48 | DELETE | `/goals/{id}/contributions/{cId}` | EDITOR | [13.8](#138-delete-goalsidcontributionscid) |
| 49 | GET | `/dashboard` | VIEWER | [14.1](#141-get-dashboard) |
| 50 | GET | `/wallets/{id}/audit-logs` | OWNER | [15.1](#151-get-walletsidaudit-logs) |
| 51 | GET | `/ai/conversations` | authed | [17.1](#171-get-aiconversations) |
| 52 | POST | `/ai/conversations` | authed | [17.2](#172-post-aiconversations) |
| 53 | POST | `/ai/conversations/{id}/delete` | authed | [17.3](#173-post-aiconversationsiddelete) |
| 54 | GET | `/ai/conversations/{id}/messages` | authed | [17.4](#174-get-aiconversationsidmessages) |
| 55 | POST | `/ai/conversations/{id}/messages` | VIEWER | [17.5](#175-post-aiconversationsidmessages) |
| 56 | POST | `/ai/conversations/{id}/messages/{messageId}/confirm` | EDITOR | [17.6](#176-post-aiconversationsidmessagesmessageidconfirm) |
| 57 | POST | `/ai/conversations/{id}/messages/{messageId}/dismiss` | authed | [17.7](#177-post-aiconversationsidmessagesmessageiddismiss) |

---

## 4. Health

### 4.1 GET /health

| | |
|---|---|
| **Auth** | Public |
| **Authorization** | None |

**Request** — none.

**Response `200`** — envelope-free by design, so an uptime probe needs no JSON parsing beyond the status:

```json
{ "status": "ok", "version": "0.1.0", "database": "up" }
```

**Errors** — `503` when the database is unreachable (`status: "degraded"`).

**Side effects** — none. Never logged, to keep probe traffic out of the audit trail.

---

## 5. Authentication

### 5.1 POST /auth/register

| | |
|---|---|
| **Auth** | Public |
| **Authorization** | None |
| **Rate limit** | 10/min per IP |

**Request** — `registerSchema`

```json
{
  "email": "tam@example.com",
  "password": "correct-horse-battery",
  "displayName": "Tam",
  "baseCurrency": "VND",
  "locale": "vi",
  "timeZone": "Asia/Ho_Chi_Minh"
}
```

**Validation**

| Field | Rule |
|---|---|
| `email` | valid email; trimmed and lowercased; unique case-insensitively |
| `password` | 12–200 characters. Length only — no composition rules, which measurably push users toward predictable substitutions (NIST SP 800-63B) |
| `displayName` | 1–100 characters after trim |
| `baseCurrency` | `^[A-Z]{3}$`, defaults to `VND` |
| `locale` | optional; one of `LOCALES` (`en`, `vi`). Saved as the user's language and used to name the first wallet and Cash account; when omitted, `en` (the column default) |
| `timeZone` | required; an IANA zone (§2.12). The first wallet's time zone; the app sends the device's |

**Response `201`** — `AuthResponse`: the new `user` plus `tokens`.

**Errors** — `409 EMAIL_ALREADY_REGISTERED` · `422 VALIDATION_FAILED` · `429 RATE_LIMITED`

**Side effects**

1. Creates the `users` row (password hashed with Argon2id).
2. Creates a **default wallet** named after `displayName` plus an `OWNER` membership row — a user with no wallet cannot record anything, so registration that left them empty-handed would strand them on an unusable first screen. The wallet and its default `CASH` account are named in the request's `locale` (`"{displayName}'s Wallet"` / `Cash`, or `"Ví của {displayName}"` / `Tiền mặt`); the app asks for the language on its sign-up screen.
3. Seeds that wallet with the starter categories in `packages/contracts/src/starter-categories.ts` — expense, income and transfer — each with its `system_key`, so its name follows the reader's locale (§2.11).
4. Issues and stores a refresh-token hash.
5. Audit: `USER_REGISTERED`.

### 5.2 POST /auth/login

| | |
|---|---|
| **Auth** | Public |
| **Authorization** | None |
| **Rate limit** | 10/min per IP; 5 consecutive failures per email → 15-min lockout |

**Request** — `loginSchema`: `{ "email": "...", "password": "..." }`

**Validation** — both non-empty. The password is *not* re-checked against `passwordSchema`: an existing password that predates a rule change must still work.

**Response `200`** — `AuthResponse`.

**Errors** — `401 CREDENTIALS_INVALID` (identical body for unknown email and wrong password, so the response cannot be used to enumerate registered addresses) · `429 RATE_LIMITED`

**Side effects** — issues a token pair; records the attempt; audit `USER_LOGIN` with `SUCCESS`/`DENIED`.

### 5.3 POST /auth/refresh

| | |
|---|---|
| **Auth** | Public (the refresh token itself is the credential) |
| **Rate limit** | 10/min per IP |

**Request** — `refreshSchema`: `{ "refreshToken": "..." }`

**Validation** — token hash exists, is unexpired, and is unrevoked.

**Response `200`** — a new `AuthTokens` pair.

**Errors** — `401 TOKEN_INVALID` · `401 TOKEN_EXPIRED`

**Side effects** — **rotation**: the presented token is revoked and a new one issued. If an already-revoked token is presented, the entire token family for that user is revoked and the event audited — that pattern means a token was replayed, i.e. stolen, and the safe response is to end every session rather than to serve the replay. Two concurrent requests presenting the same token count the same way: the revoke is conditional on the row still being live, so only one request rotates and the other is treated as a replay.

### 5.4 POST /auth/logout

| | |
|---|---|
| **Auth** | Bearer |

**Request** — `{ "refreshToken": "..." }` (optional; omitted revokes only the current access token's family).

**Response `204`** — no body.

**Errors** — `401 UNAUTHENTICATED`

**Side effects** — revokes the refresh token, only if it belongs to the caller; audit `USER_LOGOUT`. Idempotent: logging out twice still returns `204`.

### 5.5 GET /auth/me

| | |
|---|---|
| **Auth** | Bearer |

**Response `200`** — `UserResponse`, including `theme`, `locale` and `hasPassword`.

**Errors** — `401 UNAUTHENTICATED`

**Side effects** — none.

### 5.6 POST /auth/google

| | |
|---|---|
| **Auth** | Public |
| **Authorization** | None |
| **Rate limit** | 10/min per IP |

**Request** — `googleAuthSchema`: `{ "idToken": "...", "locale"?: "en" | "vi", "timeZone": "Asia/Ho_Chi_Minh" }`. `locale` and `timeZone` are used only when this sign-in creates the account, to name its wallet and set its zone as §5.1 does. `idToken` is the ID token Google's SDK returns to the client. The API verifies its signature and `aud` claim against `GOOGLE_CLIENT_ID` server-side — the client's own decoding of the token is never trusted.

**Response `200`** — `AuthResponse`. A first sign-in for that Google account creates the user (email taken from the verified token, `password_hash` null — `chk_user_has_credential` requires a password hash or a Google id, so password sign-in stays refused for it), a default wallet named in `locale` as §5.1 describes, its starter categories, and one default `CASH` account — the same seeding `POST /auth/register` performs. A Google account whose email already has a password-based `users` row is linked to it (`google_id` is set on the existing row) rather than creating a second user, so a person who registered with a password and later taps "Sign in with Google" keeps one account, one set of wallets. Linking happens only while the row has no Google account yet: a different Google account with the same verified email is refused, never swapped in for the one already linked.

**Errors** — `401 GOOGLE_TOKEN_INVALID` (bad signature, wrong audience, or expired) · `409 GOOGLE_ACCOUNT_MISMATCH` (the email's account is already linked to a different Google account) · `429 RATE_LIMITED`

**Side effects** — issues a token pair; audit `USER_REGISTERED` (first sign-in) or `USER_LOGIN` (returning).

### 5.7 PATCH /auth/me/preferences

| | |
|---|---|
| **Auth** | Bearer |

**Request** — `updatePreferencesSchema`: `{ "theme"?, "locale"? }`, at least one field.

**Response `200`** — `UserResponse`.

**Errors** — `401 UNAUTHENTICATED` · `422 VALIDATION_FAILED`

**Side effects** — none. Persisted server-side (not just on-device) so a returning user sees the same theme and language on a new device.

---

## 6. Wallets

### 6.1 GET /wallets

Every wallet the caller can reach — owned and shared-with alike.

| | |
|---|---|
| **Auth** | Bearer |
| **Authorization** | Implicit: the result *is* the caller's membership list |

**Query** — `?status=ACTIVE|ARCHIVED` (default `ACTIVE`), `?includeOwn=true|false`, `?includeShared=true|false` (both default `true`; any other value is `422`), `?page&pageSize` (§2.8)

**Response `200`** — `WalletResponse[]`, oldest first, plus `meta.pagination`. Each carries the caller's own `role`, the `relationLabel` the owner gave the caller's membership ("Girlfriend": the inviter's word for the member, not a wallet name), `isOwn`, the wallet's `timeZone` (§2.12), and `balances` **per currency**.

> `balances` is an array, not a scalar. A wallet holding a VND and a USD account has no single total, and inventing one by adding the two numbers together produces a figure that is silently meaningless. Conversion is out of scope for v1.

**Errors** — `401 UNAUTHENTICATED`

**Side effects** — none.

### 6.2 POST /wallets

| | |
|---|---|
| **Auth** | Bearer |
| **Authorization** | Any authenticated user may create a wallet |

**Request** — `createWalletSchema`: `{ "name": "Mom's Money", "timeZone": "Asia/Ho_Chi_Minh" }`

**Validation** — `name` 1–100 characters after trim; `timeZone` required, an IANA zone (§2.12). The app starts it at the device's zone for the creator to confirm or change.

**Response `201`** — `WalletResponse`.

**Errors** — `422 VALIDATION_FAILED` · `401 UNAUTHENTICATED`

**Side effects** — creates the wallet and, in the same transaction, the caller's `OWNER` membership row. Both or neither: a wallet with no owner cannot be administered through any API path, so it would be unrecoverable. Audit `WALLET_CREATED`.

### 6.3 GET /wallets/{id}

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `VIEWER` |

**Response `200`** — `WalletResponse`.

**Errors** — `404 WALLET_NOT_FOUND` (also when it exists but the caller has no membership — see §2.5) · `401`

**Side effects** — none.

### 6.4 PATCH /wallets/{id}

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `OWNER` |

**Request** — `updateWalletSchema`: `{ "name"?, "status"?, "timeZone"? }`, at least one key. A new `timeZone` re-reads every instant in the new zone and rewrites none (§2.12), so the app confirms it first.

**Response `200`** — the updated `WalletResponse`.

**Errors** — `422 VALIDATION_FAILED` · `403 FORBIDDEN` · `404 WALLET_NOT_FOUND`

**Side effects** — audit `WALLET_UPDATED`.

### 6.5 DELETE /wallets/{id}

**Archives**; does not delete.

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `OWNER` |

**Response `204`**.

**Errors** — `403 FORBIDDEN` · `404 WALLET_NOT_FOUND`

**Side effects** — sets `status = ARCHIVED`. Accounts, categories and transactions are left intact and readable. An archived wallet rejects new writes with `409 WALLET_ARCHIVED`: no new account, category, budget or goal, and the ledger is frozen (no transaction is created, edited or deleted, including a contribution's backing one). An earmark contribution, which moves no money, is still accepted and removable (§13.7). Existing accounts, categories, budgets and goals can still be edited or archived, so an owner can tidy what is left; restoring the wallet is `PATCH /wallets/{id}` with `status: ACTIVE`. Hard deletion is not exposed: transactions are the ledger, and destroying one wallet's rows would silently rewrite the other side of every cross-wallet transfer it participated in. Audit `WALLET_ARCHIVED`.

---

## 7. Members

### 7.1 GET /wallets/{id}/members

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `VIEWER` — you can see who else can see your money |

**Query** — `?status=ACTIVE|REVOKED` (default `ACTIVE`), `?page&pageSize` (§2.8)

**Response `200`** — `WalletMemberResponse[]`, in joining order, plus `meta.pagination`.

**Errors** — `404 WALLET_NOT_FOUND`

**Side effects** — none.

### 7.2 PATCH /wallets/{id}/members/{memberId}

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `OWNER` |

**Request** — `updateMemberSchema`: `{ "role": "EDITOR" }`

**Validation** — the target member exists on this wallet and is `ACTIVE`. Promoting to `OWNER` through this endpoint is **rejected**: use §7.4, because ownership is a transfer (the old owner is demoted in the same transaction) and not an additive grant. The database's `uq_wallet_single_owner` index enforces this independently.

**Response `200`** — the updated `WalletMemberResponse`.

**Errors** — `403 FORBIDDEN` · `404 MEMBER_NOT_FOUND` · `409 WALLET_LAST_OWNER` (demoting yourself as sole owner) · `422 VALIDATION_FAILED`

**Side effects** — audit `MEMBER_ROLE_CHANGED` with old and new role.

### 7.3 DELETE /wallets/{id}/members/{memberId}

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `OWNER` |

**Response `204`**.

**Errors** — `404 MEMBER_NOT_FOUND` · `409 WALLET_LAST_OWNER`

**Side effects** — sets `status = REVOKED` rather than deleting the row, so `transactions.created_by_user_id` still resolves to a name — a removed member's past entries must not become anonymous. Audit `MEMBER_REMOVED`.

### 7.4 POST /wallets/{id}/transfer-ownership

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `OWNER` |

**Request** — `{ "toUserId": "uuid" }`

**Validation** — target is an `ACTIVE` member of this wallet and is not already the owner.

**Response `200`** — the updated member list.

**Errors** — `403 FORBIDDEN` · `404 MEMBER_NOT_FOUND` · `422 VALIDATION_FAILED`

**Side effects** — in **one** transaction: demote the current owner to `EDITOR`, promote the target to `OWNER`, update `wallets.owner_user_id`. The order matters — `uq_wallet_single_owner` is a real unique index and rejects two active owners even momentarily, so the demote must land first. Audit `WALLET_OWNERSHIP_TRANSFERRED`.

### 7.5 POST /wallets/{id}/leave

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `VIEWER` (any member may leave) |

**Response `204`**.

**Errors** — `409 WALLET_LAST_OWNER` — an owner must transfer ownership or archive the wallet first, otherwise the wallet becomes permanently unadministrable.

**Side effects** — revokes the caller's own membership; audit `MEMBER_LEFT`.

---

## 8. Invitations

Invitations are addressed to an **email**, not a user id, so you can invite someone who has not signed up yet. They are single-use, expire in 7 days, and only the token hash is stored.

### 8.1 GET /wallets/{id}/invitations

| | |
|---|---|
| **Auth** | Bearer · **Min role** `OWNER` |

**Query** — `?state=open|accepted|revoked|expired` (default `open`), `?page&pageSize` (§2.8)

**Response `200`** — `WalletInvitationResponse[]`, newest first, plus `meta.pagination`. The `token` is **never** returned here — only once, at creation (§8.2). A list endpoint that re-emitted live tokens would turn read access to the invitation list into the ability to join the wallet.

**Errors** — `403 FORBIDDEN` · `404 WALLET_NOT_FOUND`

### 8.2 POST /wallets/{id}/invitations

| | |
|---|---|
| **Auth** | Bearer · **Min role** `OWNER` |

**Request** — `inviteMemberSchema`

```json
{ "email": "linh@example.com", "role": "EDITOR", "relationLabel": "Girlfriend" }
```

**Validation**

| Field | Rule |
|---|---|
| `email` | valid, trimmed, lowercased |
| `role` | `EDITOR` or `VIEWER` only — `INVITABLE_ROLES`. Inviting straight to `OWNER` is rejected by both the schema and the `chk_invitation_role` constraint |
| `relationLabel` | ≤ 50 characters, optional. The inviter's word for the invitee (SRS FR-11) |

Rejected when the email already belongs to an `ACTIVE` member, or when an open invitation for this `(wallet, email)` already exists — `uq_wallet_invitation_open` enforces the latter in the database, so re-inviting must revoke first rather than stacking up tokens that all still work. An *expired* open invitation is not live: creating a new one revokes it in the same transaction (audited `INVITATION_REVOKED`), so its old token then answers `404` rather than `410`.

**Response `201`** — `WalletInvitationCreatedResponse`, the one response carrying `token`.

**Errors** — `409 MEMBER_ALREADY_EXISTS` · `409 INVITATION_ALREADY_OPEN` · `403 FORBIDDEN` · `422 VALIDATION_FAILED`

**Side effects** — stores the invitation with a hashed token; audit `MEMBER_INVITED`. Delivery is the caller's job in v1 — no mail is sent.

### 8.3 DELETE /wallets/{id}/invitations/{invId}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `OWNER` |

**Response `204`**. Sets `revoked_at`, which also frees the `(wallet, email)` slot for a fresh invite. Revoking an already-revoked invitation is a no-op `204`. A revoke and an accept racing on one invitation are serialised on its row: whichever commits first wins, and the other sees it (`409 INVITATION_ALREADY_USED` here, `404 INVITATION_NOT_FOUND` for the accept).

**Errors** — `404 INVITATION_NOT_FOUND` · `409 INVITATION_ALREADY_USED`

**Side effects** — audit `INVITATION_REVOKED`, only when this request revoked it.

### 8.4 POST /invitations/preview

Lets an invitee see what they are being offered *before* signing up.

| | |
|---|---|
| **Auth** | Public |

**Request** — `{ "token": "..." }`

**Response `200`**

```json
{ "walletName": "Linh's Wallet", "invitedEmail": "l***@example.com", "role": "EDITOR", "expiresAt": "..." }
```

`invitedEmail` is masked: the token may be pasted anywhere, and the endpoint is public, so it must not hand out a full address.

**Errors** — `404 INVITATION_NOT_FOUND` · `410 INVITATION_EXPIRED` · `409 INVITATION_ALREADY_USED`

**Side effects** — none.

### 8.5 POST /invitations/accept

| | |
|---|---|
| **Auth** | Bearer — you must be signed in as the invited address |

**Request** — `acceptInvitationSchema`: `{ "token": "..." }`

**Validation** — the invitation is open and unexpired, **and** the caller's email equals `invited_email` case-insensitively. Without that equality check, anyone holding the token could join, which would make the invite a bearer capability rather than an invitation to a person.

**Response `200`** — the joined `WalletResponse`.

**Errors** — `404 INVITATION_NOT_FOUND` · `410 INVITATION_EXPIRED` · `409 INVITATION_ALREADY_USED` · `403 INVITATION_EMAIL_MISMATCH` · `409 MEMBER_ALREADY_EXISTS`

**Side effects** — in one transaction: create the `wallet_members` row with the invitation's role and `relationLabel`, and set `accepted_at`. Audit `INVITATION_ACCEPTED`.

---

## 9. Accounts

### 9.1 GET /accounts

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` on the wallet filtered to |

**Query** — `?walletId=uuid` (optional; omitted returns accounts across **every** wallet the caller can reach), `?status=ACTIVE|ARCHIVED`, `?type=`, `?page&pageSize` (§2.8)

**Response `200`** — `AccountResponse[]`, oldest first, plus `meta.pagination`, each with a **derived** `balance`.

**Errors** — `404 WALLET_NOT_FOUND` when `walletId` names a wallet the caller cannot see.

**Side effects** — none.

### 9.2 POST /accounts

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` on `walletId` |

**Request** — `createAccountSchema`

```json
{ "walletId": "uuid", "name": "Vietcombank VND", "type": "BANK_ACCOUNT", "currency": "VND", "initialBalance": "1000000" }
```

**Validation**

| Field | Rule |
|---|---|
| `type` | one of `ACCOUNT_TYPES` |
| `currency` | `^[A-Z]{3}$` |
| `initialBalance` | signed — **may be negative**, because a credit card legitimately opens in debt. This is why the column carries no `CHECK (>= 0)` |

**Response `201`** — `AccountResponse`.

**Errors** — `403 FORBIDDEN` · `404 WALLET_NOT_FOUND` · `409 WALLET_ARCHIVED` · `422 VALIDATION_FAILED`

**Side effects** — audit `ACCOUNT_CREATED`.

### 9.3 GET /accounts/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Response `200`** — `AccountDetailResponse`: the account plus `totalIncome`, `totalExpense`, `transferredIn`, `transferredOut`, `transactionCount`.

> Transfers are reported **separately** from income and expense, never folded into them. `totalExpense` must answer "what did this person spend", and money moved to their own cash account or to a partner's wallet is not spending.

**Errors** — `404 ACCOUNT_NOT_FOUND`

**Side effects** — none.

### 9.4 PATCH /accounts/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `updateAccountSchema`: `{ "name"?, "currency"?, "status"? }`

**Validation** — `type` and `initialBalance` are **not** editable. Every stored balance and every transaction on the account derives from them; changing one retroactively rewrites history with no audit trail. Create a new account instead. `currency` is editable only while the account is empty — no transaction of any status and no goal contribution names it — and is otherwise refused with `422 ACCOUNT_CURRENCY_MISMATCH`. The check and the change hold a lock on the account row, which every transaction and contribution create also takes, so a write naming the account at the same moment either commits first (the change is refused) or waits and is refused because it names the old currency.

**Response `200`** — `AccountResponse`.

**Errors** — `403 FORBIDDEN` · `404 ACCOUNT_NOT_FOUND` · `422 ACCOUNT_CURRENCY_MISMATCH` · `422 VALIDATION_FAILED`

**Side effects** — audit `ACCOUNT_UPDATED`.

### 9.5 DELETE /accounts/{id}

Archives.

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Response `204`**. Sets `status = ARCHIVED`; the account stops appearing in pickers but its transactions and history remain. Hard delete is not exposed — it would orphan the other side of every transfer.

**Errors** — `404 ACCOUNT_NOT_FOUND` · `409 ACCOUNT_LAST_ACTIVE` (a wallet keeps at least one active account; checked under a lock on the wallet's active accounts, so two archives at once cannot remove both)

**Side effects** — audit `ACCOUNT_ARCHIVED`.

---

## 10. Categories

### 10.1 GET /categories

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Query** — `?walletId=uuid` (required), `?type=INCOME|EXPENSE|TRANSFER`, `?status=`, `?tree=true|false` (default `false`; any other value is `422`), `?page&pageSize` (§2.8)

**Response `200`** — `CategoryResponse[]` sorted by name as the caller reads it (§2.11), plus `meta.pagination`, each carrying `transactionCount` — how many transactions (any status) point at it. The app reads this before offering to delete a category: non-zero means "delete" must mean archive, not permanent removal (§10.4). With `tree=true`, roots carry populated `children`, each with its own `transactionCount`, and the whole tree comes back unpaged: a page of a tree would cut children off from their parents.

**Errors** — `404 WALLET_NOT_FOUND` · `422 VALIDATION_FAILED`

### 10.2 POST /categories

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createCategorySchema`

**Validation**

- `parentId`, when given, must belong to the **same wallet** and have the **same `type`** — an expense category nested under an income parent would make a category tree that cannot be summed — and must not be archived (`409 CATEGORY_PARENT_ARCHIVED`).
- Name unique case-insensitively among siblings (`uq_category_name_per_parent`), and also against the siblings' names as the caller reads them: a custom "Ăn uống" is refused beside the starter Food read in Vietnamese (`409 CATEGORY_DUPLICATE_NAME`).
- A category cannot be its own parent (`chk_category_not_own_parent`); deeper cycles are rejected in the service layer as `CATEGORY_CYCLE`.

**Response `201`** — `CategoryResponse`.

**Errors** — `409 WALLET_ARCHIVED` · `409 CATEGORY_DUPLICATE_NAME` · `409 CATEGORY_PARENT_ARCHIVED` · `422 CATEGORY_WRONG_TYPE` · `403 CATEGORY_WRONG_WALLET` · `422 CATEGORY_CYCLE` · `404 CATEGORY_NOT_FOUND` (unknown parent, or one in a wallet the caller cannot see — AC-01)

**Side effects** — audit `CATEGORY_CREATED`.

### 10.3 PATCH /categories/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `updateCategorySchema`: `{ "name"?, "icon"?, "color"?, "status"? }`

**Renaming a starter category** makes it custom: the new name is stored as typed and `systemKey` becomes `null`, so every member reads that name in every locale from then on. Sending back the name the caller already reads (an edit form resubmitting it unchanged) is not a rename and keeps the category translatable. A new name is checked for duplicates as in §10.2.

**Validation** — `type` is immutable: flipping a category from `EXPENSE` to `INCOME` would invert the sign of every transaction already classified under it. `parentId` is immutable for the same reason budgets aggregate by category. `status: ARCHIVED` is the archive of §10.4 by another route: refused while a budget references the category, and child categories are archived with it. `status: ACTIVE` on a child whose parent is still archived is refused: restore the parent first.

**Response `200`** — `CategoryResponse`.

**Errors** — `409 CATEGORY_DUPLICATE_NAME` · `409 CATEGORY_IN_USE` (archiving, see §10.4) · `409 CATEGORY_PARENT_ARCHIVED` (restoring under an archived parent) · `404 CATEGORY_NOT_FOUND` · `403 FORBIDDEN`

**Side effects** — audit `CATEGORY_UPDATED`; when archiving, also `CATEGORY_ARCHIVED`.

### 10.4 DELETE /categories/{id}

Archives by default; permanently removes only when explicitly asked **and** the category is genuinely unused.

A category with transactions on it is not something the app silently loses history for by calling this once — the client is expected to have already read `transactionCount` (§10.1) and presented a choice: **rename** (`PATCH` with a new `name`), **archive** (this route, no query), or **delete permanently** (this route, `?mode=permanent`) — with the permanent option disabled client-side whenever `transactionCount > 0`. The API enforces the same rule server-side rather than trusting that client-side gate.

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Query** — `?mode=archive` (default) or `?mode=permanent`.

**Response `204`**.

**Errors** — `404 CATEGORY_NOT_FOUND` · `409 CATEGORY_IN_USE` when archiving and a budget still references it or any descendant (archiving it would leave a budget that can never compute a period again), or when `mode=permanent` and a budget of **any** status still references it or a descendant · `409 CATEGORY_HAS_TRANSACTIONS` when `mode=permanent` and it, or any descendant whatever its status, has transactions.

Archive, restore and permanent delete lock every category of the wallet before reading the tree, and a category or budget create share-locks the category it names, so none of them can act on a tree another is changing.

**Side effects** — `mode=archive` (default): `status = ARCHIVED`. Historical transactions keep pointing at it and still render; it disappears from pickers. Child categories are archived with it. Audit `CATEGORY_ARCHIVED`. `mode=permanent`: the row is deleted outright — only reachable when nothing references it. Audit `CATEGORY_DELETED` (distinct from `CATEGORY_ARCHIVED`, so the audit trail says which one actually happened), recorded before the delete commits since `audit_logs.entity_id` is a bare column with no FK to a live category row.

---

## 11. Transactions

The central entity. Direction is expressed by `type` plus which account side is set — amounts are always positive.

| Type | `fromAccountId` | `toAccountId` | `categoryId` |
|---|---|---|---|
| `INCOME` | `null` | **required** | **required**, must be `INCOME` |
| `EXPENSE` | **required** | `null` | **required**, must be `EXPENSE` |
| `TRANSFER` | **required** | **required**, ≠ from | optional; if set, must be `TRANSFER` and belong to the `fromAccountId` wallet |

Enforced three times, deliberately: by the `createTransactionSchema` discriminated union (client + server), in the service layer (currency and cross-wallet role checks that need database lookups), and by `chk_transaction_shape` in Postgres (the backstop that holds for any writer, including a migration script).

### 11.1 GET /transactions

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Query** — `transactionQuerySchema`: `walletId`, `accountId`, `categoryId`, `type`, `status`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`, `search`, `page`, `pageSize`, `sortBy` (default `-transactionDate`)

`dateFrom`/`dateTo` are calendar days in the wallet's zone (§2.12). With `walletId`, that wallet's zone; without it, each transaction is read in its paying wallet's zone (the receiving one for income).

Results are restricted to transactions touching an account in a wallet the caller can read. A cross-wallet transfer is visible to members of **either** side — each of them genuinely had money move.

**Response `200`** — `TransactionResponse[]` plus `meta.pagination`. Each item carries `isCrossWallet` and both accounts' wallet names, so the list can show *whose* account a transfer touched.

**Errors** — `404 WALLET_NOT_FOUND` · `422 VALIDATION_FAILED`

**Side effects** — none.

### 11.2 POST /transactions

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `EDITOR` on the wallet of **every** account named — both sides of a cross-wallet transfer |

**Request** — `createTransactionSchema` (discriminated on `type`). Expense:

```json
{
  "type": "EXPENSE",
  "fromAccountId": "uuid",
  "categoryId": "uuid",
  "amount": "150000",
  "currency": "VND",
  "description": "Dinner",
  "transactionDate": "2026-08-22T12:30:00Z",
  "status": "COMPLETED"
}
```

**Validation**

| Rule | Failure |
|---|---|
| `amount > 0` | `422 VALIDATION_FAILED` |
| Shape matches `type` (table above) | `422 VALIDATION_FAILED` |
| Transfer accounts differ | `422 VALIDATION_FAILED` on `toAccountId` — `createTransactionSchema` refuses it before the service runs; the service keeps `TRANSFER_SAME_ACCOUNT` as a backstop that no current caller reaches |
| Transfer: both accounts share one currency | `422 TRANSFER_CURRENCY_MISMATCH` — cross-currency transfer needs a conversion rate and is out of scope for v1. Checked before the next row, which a cross-currency transfer always also fails |
| `currency` equals every named account's currency | `422 ACCOUNT_CURRENCY_MISMATCH` |
| Category type matches transaction type | `422 CATEGORY_WRONG_TYPE` |
| Category exists and the caller can see its wallet | `404 CATEGORY_NOT_FOUND` — checked first, so a hidden category is indistinguishable from a made-up id (AC-01) |
| Category belongs to the account's wallet (a transfer's: the `fromAccountId` wallet) | `403 CATEGORY_WRONG_WALLET` |
| No account is `ARCHIVED` | `409 ACCOUNT_ARCHIVED` |
| `goalId`, when given, is on an `EXPENSE` only | `422 VALIDATION_FAILED` (`chk_transaction_goal`) |
| `goalId` names a goal in the paying account's wallet | `404 GOAL_NOT_FOUND` |
| `EDITOR` on **both** wallets for a cross-wallet transfer | `403 FORBIDDEN` |

**Response `201`** — `TransactionResponse`.

`goalId` tags an expense with one of the wallet's saving goals, so that goal's budget counts it (§12.2). It moves nothing toward the goal itself: progress comes only from contributions (§13.7).

A `TRANSFER` category only labels the movement; the transfer still never counts toward `income`, `expense`, `spendingByCategory` or budget `spent` (BR-06).

**Side effects** — inserts one row. No balance is written: balances are derived, so nothing to update and nothing that can drift. Audit `TRANSACTION_CREATED` (for a cross-wallet transfer, once against each wallet, so it appears in both audit trails). Clients should invalidate their cached transactions, accounts, dashboard and budgets.

### 11.3 GET /transactions/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` on either side |

**Response `200`** — `TransactionResponse`.

**Errors** — `404 TRANSACTION_NOT_FOUND`

### 11.4 PATCH /transactions/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `updateTransactionSchema`: `{ "type"?, "amount"?, "currency"?, "fromAccountId"? (uuid or null), "toAccountId"? (uuid or null), "description"?, "transactionDate"?, "categoryId"? (uuid or null), "goalId"? (uuid or null), "reference"? }`

**Validation** — every field a create sets can be edited. When `type`, `amount`, `currency` or an account is sent, the body is laid over the stored row and the result is checked exactly as §11.2 checks a create: the per-type shape (a type change must send the account side and category the new type needs; the side it no longer uses is cleared), `EDITOR` on every wallet named before and after, account and wallet not archived, currency matching every account, the category's type and wallet, and the goal tag. A goal tag lapses when the transaction stops being an expense. A transaction that backs a goal contribution (§13.6) carries its new amount and account into that contribution, and must stay an `EXPENSE` from the goal's wallet in the goal's currency (`422 VALIDATION_FAILED`). A `DELETED` transaction cannot be edited at all.

A changed `categoryId` must keep the same `type` and wallet. `"categoryId": null` removes a transfer's category; on an income or expense it is refused with `422 CATEGORY_WRONG_TYPE`, since those always carry one.

A changed `goalId` follows the §11.2 rules: an `EXPENSE` only (`422 VALIDATION_FAILED`), and a goal in the paying account's wallet (`404 GOAL_NOT_FOUND`). `null` removes the tag.

**Response `200`** — `TransactionResponse`.

**Errors** — `409 TRANSACTION_ALREADY_DELETED` · `422 VALIDATION_FAILED` · `422 CATEGORY_WRONG_TYPE` · `422 CATEGORY_WRONG_WALLET` · `422 ACCOUNT_CURRENCY_MISMATCH` · `422 TRANSFER_CURRENCY_MISMATCH` · `409 ACCOUNT_ARCHIVED` · `409 WALLET_ARCHIVED` · `404 TRANSACTION_NOT_FOUND` · `404 ACCOUNT_NOT_FOUND` · `403 FORBIDDEN`

**Side effects** — audit `TRANSACTION_UPDATED` with the changed field names, once per wallet the transaction touched before or after the edit.

### 11.5 POST /transactions/{id}/delete

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` (both wallets, for a cross-wallet transfer) |

**Request** — `deleteTransactionSchema`: `{ "reason"? }`

**Response `200`** — the transaction with `status: "DELETED"`.

**Errors** — `409 TRANSACTION_ALREADY_DELETED` · `404 TRANSACTION_NOT_FOUND` · `403 FORBIDDEN`

**Side effects** — sets `status = DELETED`; the row stays — this is a soft delete, not a row removal. Because only `COMPLETED` transactions count, every derived balance, budget `spent` and dashboard total drops the amount on the next read, with the deleted row still visible as the record of what happened. Any `goal_contributions` row pointing at it is removed in the same transaction — otherwise a deleted payment would keep crediting a savings goal. Audit `TRANSACTION_DELETED`.

---

## 12. Budgets

### 12.1 GET /budgets

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Query** — `?walletId=uuid` (required), `?activeOn=YYYY-MM-DD` (budgets covering that day: started on or before it and, for a fixed window, not ended before it), `?page&pageSize` (§2.8)

**Response `200`** — `BudgetResponse[]`, newest start first, plus `meta.pagination`. Each carries derived `spent`, `remaining`, `usagePercentage`, `isOverBudget` over its `periodStart`–`periodEnd`: the period containing `activeOn` (when omitted, today in the wallet's zone, §2.12). Each also carries `timeZone`, the wallet's, in which `periodStart`/`periodEnd` are read.

**Errors** — `404 WALLET_NOT_FOUND`

### 12.2 POST /budgets

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createBudgetSchema`

```json
{
  "walletId": "uuid", "categoryId": "uuid", "goalId": null, "name": "Food August",
  "amount": "3000000", "currency": "VND",
  "periodType": "MONTHLY", "startDate": "2026-08-01", "endDate": null
}
```

**Repeating and fixed periods.** `DAILY`, `WEEKLY`, `MONTHLY` and `YEARLY` repeat from `startDate` until the budget is deleted, so they take no `endDate`; each read reports the period containing the day asked about, stepping from `startDate` (a monthly budget begun on the 1st follows calendar months; one begun on the 31st starts on a shorter month's last day). `CUSTOM` and `GOAL` cover the fixed window `startDate`–`endDate`. Every `BudgetResponse` carries `periodStart`/`periodEnd`, the window its figures cover.

A budget is exactly one kind, and its kind decides what `spent` counts. `BudgetResponse.categoryIds` lists the categories a category budget counts — its own and every descendant — and is empty for the other kinds. In every kind, `spent` counts only `COMPLETED` `EXPENSE` transactions in the budget's `currency`, dated inside the current window by calendar day in the wallet's zone (§2.12). Transfers never count (BR-06).

| Kind | `categoryId` | `goalId` | `periodType` | `spent` counts expenses… |
|---|---|---|---|---|
| Category | set | `null` | `DAILY` · `WEEKLY` · `MONTHLY` · `YEARLY` · `CUSTOM` | in that category or any subcategory beneath it, at any depth |
| Goal | `null` | set | `GOAL` | tagged with that goal (`goalId`, §11.2), including a contribution's backing expense (§13.7) |
| Wallet-wide | `null` | `null` | `DAILY` · `WEEKLY` · `MONTHLY` · `YEARLY` · `CUSTOM` | paid from any account in `walletId` |

**Validation**

| Rule | Failure |
|---|---|
| `amount > 0` | `422` |
| A repeating period has no `endDate`; `CUSTOM` and `GOAL` have one (`chk_budget_end`) | `422 VALIDATION_FAILED` |
| `endDate >= startDate` | `422` (`chk_budget_dates`) |
| Category is `EXPENSE` and belongs to `walletId` | `422 CATEGORY_WRONG_TYPE` / `403 CATEGORY_WRONG_WALLET`; `404 CATEGORY_NOT_FOUND` when the category's wallet is not visible to the caller (AC-01) |
| Category is not archived | `409 CATEGORY_ARCHIVED` |
| Exactly one kind, as in the table above | `422 VALIDATION_FAILED` (`chk_budget_kind`) |
| Goal exists and belongs to `walletId` | `404 GOAL_NOT_FOUND` |
| Goal is `ACTIVE` | `409 GOAL_NOT_ACTIVE` |
| No **overlapping** budget of the same kind and target (category, goal, or wallet) | `409 BUDGET_PERIOD_OVERLAP` |

> The overlap rule is enforced by a GIST exclusion constraint (`excl_budget_category_overlap`; goal and wallet-wide budgets use `excl_budget_goal_overlap` and `excl_budget_overall_overlap`) over `daterange(start_date, end_date, '[]')`, not by a unique index — two budgets can overlap without sharing either endpoint, which no unique index can express. A repeating budget's open end is an unbounded range, so it holds its target from its start onward; delete it to plan that target differently.

**Response `201`** — `BudgetResponse` with `spent` already computed over existing transactions — creating a budget mid-month must immediately show what has been spent so far, not zero.

**Errors** — `409 WALLET_ARCHIVED` · `409 BUDGET_PERIOD_OVERLAP` · `409 CATEGORY_ARCHIVED` · `409 GOAL_NOT_ACTIVE` · `404 GOAL_NOT_FOUND` · `422 VALIDATION_FAILED` · `403 FORBIDDEN`

**Side effects** — audit `BUDGET_CREATED`.

### 12.3 GET /budgets/{id}

**Response `200`** — `BudgetResponse`. Min role `VIEWER`. `404 BUDGET_NOT_FOUND`.

### 12.4 PATCH /budgets/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `updateBudgetSchema`: `{ "name"?, "amount"? }`

**Validation** — `categoryId`, `goalId`, `periodType`, `startDate` and `endDate` are immutable; moving a window changes which transactions the budget ever covered, which is a different budget. Delete and create instead.

**Response `200`** — `BudgetResponse`. **Errors** — `404` · `422`.

**Side effects** — audit `BUDGET_UPDATED`.

### 12.5 DELETE /budgets/{id}

Deletes the budget row outright, releasing its slot in the overlap constraint. A budget only plans: no balance, transaction or goal figure is derived from it, so nothing else changes. `204`. Min role `EDITOR`. Audit `BUDGET_DELETED`; its audit rows stay. A second delete is `404 BUDGET_NOT_FOUND`.

---

## 13. Goals & contributions

### 13.1 GET /goals

Min role `VIEWER`. Query: `?walletId=` (required), `?status=`, `?page&pageSize` (§2.8). Response `200` — `GoalResponse[]`, newest first, plus `meta.pagination`, with derived `currentAmount`, `remaining` (floored at zero), `progressPercentage` (capped at 100).

### 13.2 POST /goals

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createGoalSchema`: `{ walletId, name, description?, targetAmount, currency, targetDate? }`

**Validation** — `targetAmount > 0`; `targetDate` may be null (a goal without a deadline is valid).

**Response `201`** — `GoalResponse`. **Errors** — `422` · `403` · `404 WALLET_NOT_FOUND` · `409 WALLET_ARCHIVED`.

**Side effects** — audit `GOAL_CREATED`.

### 13.3 GET /goals/{id}

`200` — `GoalResponse`. `404 GOAL_NOT_FOUND`.

### 13.4 PATCH /goals/{id}

Min role `EDITOR`. `updateGoalSchema`: `{ name?, description?, targetAmount?, targetDate?, status? }`. `currency` is immutable — contributions are already recorded in it.

`200` — `GoalResponse`. Audit `GOAL_UPDATED`.

### 13.5 DELETE /goals/{id}

Sets `status = CANCELLED`. Contributions are retained: they record money that really was set aside. `204`. Audit `GOAL_CANCELLED`.

### 13.6 GET /goals/{id}/contributions

Min role `VIEWER`. Paginated. `200` — `ContributionResponse[]`.

### 13.7 POST /goals/{id}/contributions

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createContributionSchema`

```json
{
  "accountId": "uuid", "amount": "2000000", "currency": "VND",
  "contributionDate": "2026-08-22T10:00:00Z",
  "recordAsTransaction": true, "categoryId": "uuid"
}
```

**Validation**

| Rule | Failure |
|---|---|
| Goal is `ACTIVE` | `409 GOAL_NOT_ACTIVE` |
| Account belongs to the goal's wallet | `403 FORBIDDEN` |
| `currency` matches both goal and account | `422 ACCOUNT_CURRENCY_MISMATCH` |
| `categoryId` required and `EXPENSE`-typed when `recordAsTransaction` is true | `422 VALIDATION_FAILED` |
| Wallet not archived when `recordAsTransaction` is true | `409 WALLET_ARCHIVED` |
| Account not archived when `recordAsTransaction` is true | `409 ACCOUNT_ARCHIVED` |

**Response `201`** — `ContributionResponse`.

**Side effects** — `recordAsTransaction: true` creates an `EXPENSE` transaction, tagged with this goal's `goalId` so the goal's budget counts it (§12.2), **and** the contribution pointing at it, in one transaction, so the money leaving the account and the goal advancing can never disagree. Left `false`, the contribution is an earmark: the goal advances without asserting money moved. `transaction_id` is `UNIQUE`, so one transaction can back at most one contribution — otherwise a single payment could be counted toward a goal twice. Audit `GOAL_CONTRIBUTION_ADDED`.

### 13.8 DELETE /goals/{id}/contributions/{cId}

Min role `EDITOR`. `204`. Removes the contribution row outright; when it was transaction-backed, the backing transaction only has its status flipped to `DELETED` — the transaction row itself is never removed, keeping the ledger intact. That delete is a ledger write, so in an archived wallet a transaction-backed contribution can't be removed (`409 WALLET_ARCHIVED`); an earmark still can. Audit `GOAL_CONTRIBUTION_REMOVED`. `404 CONTRIBUTION_NOT_FOUND` when it is already gone — including when a concurrent removal, or the delete of its backing transaction (§11.5), took it first.

---

## 14. Dashboard

### 14.1 GET /dashboard

One request answering the four questions the dashboard exists to answer: how much do I have, what came in, what went out, and where did it go.

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Query** — `dashboardQuerySchema`: `walletId` (required), `accountId` (optional — one of this wallet's accounts, see below), `dateFrom`, `dateTo` (calendar days in the wallet's zone, §2.12; each defaults to its end of the current month there; a resolved `dateFrom` after `dateTo` is `422 VALIDATION_FAILED`), `displayCurrency` (optional, three-letter code)

**`accountId`** narrows every figure to that one account. `totalBalance` is that account's balance, and `income`/`expense`/`spendingByCategory`/`spendingByMember`/`recentTransactions` count only transactions touching it. The account is now the boundary, so a transfer to or from a *sibling* account in the same wallet appears in `transferredIn`/`transferredOut`. At wallet level that transfer is internal and appears in neither. It is still never income or expense (BR-06). `activeBudgets` and `activeGoals` are wallet-level, not per-account, so an account-scoped response returns them as `[]` rather than wallet figures that would read as the account's. An `accountId` that is not one of `walletId`'s accounts is `404 ACCOUNT_NOT_FOUND`: the wallet is already authorised, so this reveals nothing about another wallet (AC-01).

**Response `200`** — `DashboardResponse`: `totalBalance`, `income`, `expense`, `net`, `transferredIn`, `transferredOut` (each **per currency**), `spendingByCategory` (descending, with percentages), `spendingByMember`, `recentTransactions` (10), `activeBudgets` (the budgets covering today in the wallet's zone, or the period's nearest day when the period doesn't include today, each over its period around that day), `activeGoals`, `period` (the resolved `dateFrom`/`dateTo` and the wallet's `timeZone` they are read in), `valuation` (optional — present only when `displayCurrency` was supplied).

> `income` and `expense` **exclude transfers entirely**. This is the single most consequential rule in the product: a wallet that moved 2,000,000 from bank to cash has not earned or spent anything, and a dashboard that says otherwise makes every other number untrustworthy.

**`transferredIn` / `transferredOut`** (`CurrencyTotal[]`): the period's transfers **across this wallet's boundary**, reported on their own and never folded into `income`/`expense`/`net`. A transfer whose two legs are both this wallet's own accounts is **internal** and appears in neither figure — it never crossed the boundary, and counting it as both in and out would inflate each by the same amount. In practice these are the cross-wallet transfers of §11.4 (BR-02), seen from one side.

**`spendingByCategory[].parentId`** (`string | null`): the category's own parent, so a client can group the breakdown by parent without a second call to §7. `null` for a top-level category.

**`spendingByMember`** (`MemberSpendSlice[]`): `{userId, displayName, income, expense}` per member who recorded activity in the period, ordered by spend. Attributed by `transactions.created_by_user_id` — on a shared wallet, "who recorded this" is also "whose spending was it". Each member's figures are filtered by the same predicate as the wallet-level totals, so the split always reconciles against `income`/`expense`. No new information is exposed: any `VIEWER` on the wallet can already read every transaction and its `createdBy` via §11.1.

**`valuation`** (`ConvertedValuation`, present only when `displayCurrency` is requested): `{currency, amount, isApproximate, status, rateTimestamp?, missingCurrencies?}`. `amount` is `totalBalance` converted into `currency` — an estimate, never authoritative, never stored, never summed into any other figure. `status` is one of `FRESH` (converted just now, or every account already in `currency` so no conversion was needed), `STALE` (converted using the best available cached/snapshotted rate, older than preferred), or `UNAVAILABLE` (`amount: null`, `missingCurrencies` lists what couldn't be converted — the whole total is withheld rather than silently excluding a currency). Rates come from an external provider (`ExchangeRateService`, 12h cache by default) with a daily-snapshot fallback for staleness; a request with no `displayCurrency` omits this field entirely rather than sending `null`.

**Errors** — `404 WALLET_NOT_FOUND` · `404 ACCOUNT_NOT_FOUND` (an `accountId` outside the wallet) · `422 VALIDATION_FAILED`. `503 VALUATION_UNAVAILABLE` is defined in the error catalog for this feature but not currently returned by any code path — an unavailable conversion is reported in-band via `valuation.status`, not as a request failure.

**Side effects** — none. Served by a fixed set of set-based queries — the wallet's accounts, then balance, period activity, recent transactions, active budgets (with their spendable expenses) and active goals (with their contributions) in parallel, then one category lookup for the spending split — none issued per row, plus (only when `displayCurrency` is requested) a possible external rate lookup, cached for 12h by default.

---

## 15. Audit

### 15.1 GET /wallets/{id}/audit-logs

| | |
|---|---|
| **Auth** | Bearer · **Min role** `OWNER` |

**Query** — `?event=`, `?dateFrom=`, `?dateTo=` (calendar days in the wallet's zone, §2.12), `page`, `pageSize`

**Response `200`** — `AuditLogResponse[]`: `id`, `event`, `entityType`, `entityId`, `result`, `actorId`, `actorRole`, `note`, `createdAt`. Denied attempts (`ACCESS_DENIED`, §16.1) appear alongside successes.

**Errors** — `403 FORBIDDEN` · `404 WALLET_NOT_FOUND`

**Side effects** — none. The log is append-only: no update or delete path is exposed on any route.

---

## 16. Cross-cutting behaviour

### 16.1 What is logged

Audited at `INFO`: transaction created / updated / deleted; account, category, goal created / updated / archived; budget created / updated / deleted; member invited / accepted / removed / role changed; ownership transferred; wallet created / archived; login, logout, registration. Every `401` and `403` is logged at `WARN` with actor, role and target. A `403` to a member (role too low) is also audited against that wallet as `ACCESS_DENIED`, `result = DENIED`, with the method and path as its note, so the owner's trail shows the attempt (SRS WAL-US-13). A `404` standing in for no membership (AC-01) is not, since no wallet resolved for that caller.

Never logged: passwords, tokens (access, refresh, or invitation), or password hashes. User ids and emails may appear at `INFO`.

### 16.2 Concurrency

Multi-row writes run in one database transaction: wallet + owner membership, invitation acceptance, ownership transfer, and contribution + backing transaction. Ownership transfer additionally takes `SELECT ... FOR UPDATE` on the wallet's membership rows, because `uq_wallet_single_owner` turns a concurrent double-promote into a constraint violation rather than a corrupt state — the lock converts that into a clean serialised outcome.

### 16.3 Deletion policy

Nothing financial is hard-removed. Wallets, accounts and categories are archived; a budget, which only plans, is deleted outright (§12.5); transactions are marked `DELETED` (status flip, row stays); members are revoked. The only true row removal is a goal contribution, and that marks its backing transaction `DELETED` rather than erasing it. Transactions are the source of truth for every derived figure, so a destroyed row silently changes historical answers.

### 16.4 Currency scope for v1

Each account has one currency. A transaction must match its accounts' currency. Transfers require both accounts to share a currency. Wallet, dashboard and account totals are reported **per currency** — never summed across currencies. Conversion, rate snapshots and cross-currency transfer are explicitly out of scope for v1.

---

## 17. AI assistant

A chat that answers questions about one wallet and can **propose** an income or expense. It never records anything by itself: a proposal is stored on the assistant's message as `PENDING`, and only the user's explicit confirm (§17.6) turns it into a transaction, through the same code path, checks and audit row as §11.2.

A conversation belongs to the user who created it. Another user's conversation id is `404 AI_CONVERSATION_NOT_FOUND`, the same as an id that does not exist. Each message names the wallet it is about, and read access to that wallet is checked on every send (AC-01: a non-member gets `404 WALLET_NOT_FOUND`). The assistant reads only that wallet, through read-only tools: its active accounts with their derived balances, its active categories, and the current month's §14.1 figures (so transfers are never income or expense, BR-06).

The model is pluggable behind one server-side interface. The default is a deterministic keyword-rule provider that needs no API key; every figure it states comes from a tool, never from its own arithmetic. Replies are written in the request's `locale` (`en` or `vi`).

Types: `AiConversationResponse` `{id, walletId, title, createdAt, updatedAt}` · `AiMessageResponse` `{id, conversationId, role (USER | ASSISTANT), content, action, createdAt}` · `AiActionResponse` `{type (CREATE_TRANSACTION), status (PENDING | CONFIRMED | DISMISSED), transaction, accountName, categoryName, transactionId}`. `transaction` is an income or expense in exactly the §11.2 request shape (`aiTransactionDraftSchema`), in the account's own currency (BR-07); `accountName` is the name at proposal time; `categoryName` is the category's current name as the reader reads it (§2.11), falling back to the name at proposal time if the category no longer resolves.

Conversations and their messages are chat history, not financial data, so §17.3 removes them outright. A confirmed proposal's transaction is unaffected.

### 17.1 GET /ai/conversations

| | |
|---|---|
| **Auth** | Bearer · the caller's own conversations only |

**Query** — `aiConversationQuerySchema`: `page`, `pageSize`

**Response `200`** — `AiConversationResponse[]`, most recently active first.

**Side effects** — none.

### 17.2 POST /ai/conversations

| | |
|---|---|
| **Auth** | Bearer · `VIEWER` on `walletId` when it is given |

**Request** — `createAiConversationSchema`: `walletId` (optional), `title` (optional, 1–150; default `New conversation`)

**Response `201`** — `AiConversationResponse`

**Errors** — `404 WALLET_NOT_FOUND` · `422 VALIDATION_FAILED`

**Side effects** — inserts `ai_conversations`.

### 17.3 POST /ai/conversations/{id}/delete

| | |
|---|---|
| **Auth** | Bearer · the conversation's owner |

**Response `200`** — the deleted `AiConversationResponse`.

**Errors** — `404 AI_CONVERSATION_NOT_FOUND`

**Side effects** — deletes the conversation and, by cascade, its messages.

### 17.4 GET /ai/conversations/{id}/messages

| | |
|---|---|
| **Auth** | Bearer · the conversation's owner |

**Query** — `page`, `pageSize`

**Response `200`** — `AiMessageResponse[]`, **newest first**, so page 1 is the end of the chat.

**Errors** — `404 AI_CONVERSATION_NOT_FOUND`

### 17.5 POST /ai/conversations/{id}/messages

| | |
|---|---|
| **Auth** | Bearer · the conversation's owner · **Min role** `VIEWER` on `walletId` |

**Request** — `sendAiMessageSchema`: `walletId` (required), `message` (1–2000, trimmed), `locale` (`en` \| `vi`, default `en`)

**Response `201`** — `SendAiMessageResponse` `{conversation, userMessage, assistantMessage}`. `assistantMessage.action` is set only when the caller holds `EDITOR` on an active wallet and the proposal names that wallet's own active account and a category of the matching type in the account's currency. Otherwise the assistant explains in text and proposes nothing.

**Errors** — `404 AI_CONVERSATION_NOT_FOUND` · `404 WALLET_NOT_FOUND` · `422 VALIDATION_FAILED`

**Side effects** — inserts the user's and the assistant's `ai_messages` rows and sets the conversation's `walletId` and `updatedAt`, in one transaction. The provider sees at most the last 15 earlier messages; the stored history is never trimmed.

### 17.6 POST /ai/conversations/{id}/messages/{messageId}/confirm

| | |
|---|---|
| **Auth** | Bearer · the conversation's owner · **Min role** `EDITOR` on the proposal's account's wallet, checked by §11.2 |

**Response `200`** — the `AiMessageResponse` with `action.status: CONFIRMED` and `action.transactionId` set.

**Errors** — `404 AI_CONVERSATION_NOT_FOUND` · `404 AI_MESSAGE_NOT_FOUND` (no such message, or it carries no proposal) · `409 AI_ACTION_NOT_PENDING` · every error of §11.2 (e.g. `403 FORBIDDEN` after a demotion, `409 ACCOUNT_ARCHIVED`, `409 WALLET_ARCHIVED`)

**Side effects** — creates the transaction exactly as §11.2 would (including its audit row), then marks the proposal `CONFIRMED`. The message row is locked for the duration, so a double tap records one transaction and the second gets `409 AI_ACTION_NOT_PENDING`.

### 17.7 POST /ai/conversations/{id}/messages/{messageId}/dismiss

| | |
|---|---|
| **Auth** | Bearer · the conversation's owner |

**Response `200`** — the `AiMessageResponse` with `action.status: DISMISSED`.

**Errors** — `404 AI_CONVERSATION_NOT_FOUND` · `404 AI_MESSAGE_NOT_FOUND` · `409 AI_ACTION_NOT_PENDING`

**Side effects** — none beyond the status change.

---

## 18. Traceability

| Section | Schema / type | Database constraint |
|---|---|---|
| §5 Auth | `registerSchema`, `loginSchema`, `refreshSchema` | `uq_users_email`, `chk_user_currency` |
| §6 Wallets | `createWalletSchema`, `updateWalletSchema`, `timeZoneSchema` | `chk_wallet_status`, `chk_wallet_time_zone` |
| §7 Members | `updateMemberSchema` | `uq_wallet_member`, `uq_wallet_single_owner`, `chk_wallet_member_role` |
| §8 Invitations | `inviteMemberSchema`, `acceptInvitationSchema` | `chk_invitation_role`, `uq_wallet_invitation_open` |
| §9 Accounts | `createAccountSchema`, `updateAccountSchema` | `chk_account_type`, `chk_account_currency` |
| §10 Categories | `createCategorySchema`, `updateCategorySchema` | `uq_category_name_per_parent`, `chk_category_not_own_parent`, `chk_category_type` |
| §11 Transactions | `createTransactionSchema`, `updateTransactionSchema` | `chk_transaction_shape`, `chk_transaction_amount`, `chk_transaction_status`, `chk_transaction_goal` |
| §12 Budgets | `createBudgetSchema`, `updateBudgetSchema` | `chk_budget_dates`, `chk_budget_period`, `chk_budget_kind`, `excl_budget_category_overlap`, `excl_budget_goal_overlap`, `excl_budget_overall_overlap` |
| §13 Goals | `createGoalSchema`, `createContributionSchema` | `chk_goal_target`, `goal_contributions.transaction_id UNIQUE` |
| §14 Dashboard | `dashboardQuerySchema` | — |
| §17 AI assistant | `createAiConversationSchema`, `sendAiMessageSchema`, `aiTransactionDraftSchema` | `chk_ai_message_role`, `chk_ai_message_action_type`, `chk_ai_message_action_status`, `chk_ai_message_action_shape` |

Derived values (`balance`, `spent`, `remaining`, `usagePercentage`, `progressPercentage`) are computed by [`calc.ts`](../packages/contracts/src/calc.ts) and proven against real PostgreSQL by [`db/tests/001_constraints.sql`](../db/tests/001_constraints.sql).
