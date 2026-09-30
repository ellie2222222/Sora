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

Budget windows are **inclusive on both ends** and compared by calendar day, so an expense at `2026-08-31T23:30:00Z` falls inside an August budget.

### 2.4 Authentication

`Authorization: Bearer <accessToken>`. Access tokens live 15 minutes; refresh tokens 7 days and are single-use (rotated on every refresh). Only the refresh token's hash is stored, so a database read cannot mint a session.

Public endpoints: `/health`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/invitations/preview`.

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

`UPPER_SNAKE_CASE`, resource-prefixed. The full list and its status mapping is `ERROR_CODES` / `ERROR_STATUS` in [`responses.ts`](../packages/contracts/src/responses.ts) — that map is the single source; this document does not restate it. A path no route matches returns `404 ROUTE_NOT_FOUND`, never a resource code such as `WALLET_NOT_FOUND`: the resource was not looked up.

### 2.8 Pagination, filtering, sorting

- `?page=1&pageSize=25` — default 25, max 200.
- `?sortBy=-transactionDate,amount` — leading `-` is descending; multiple keys comma-separated.
- Filters are documented per endpoint.

### 2.9 Rate limiting

`/auth/login`, `/auth/register` and `/auth/refresh`: 10 requests per minute per IP, and for login additionally 5 consecutive failures per email before a 15-minute lockout. Exceeding either returns `429 RATE_LIMITED` with a `Retry-After` header.

### 2.10 Idempotency

Mutating endpoints accept an optional `Idempotency-Key` header. A replay with the same key and same body returns the original response instead of creating a duplicate — the case this exists for is a mobile client retrying a transaction create over a flaky connection, where a duplicate is a real financial error.

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
  "baseCurrency": "VND"
}
```

**Validation**

| Field | Rule |
|---|---|
| `email` | valid email; trimmed and lowercased; unique case-insensitively |
| `password` | 12–200 characters. Length only — no composition rules, which measurably push users toward predictable substitutions (NIST SP 800-63B) |
| `displayName` | 1–100 characters after trim |
| `baseCurrency` | `^[A-Z]{3}$`, defaults to `VND` |

**Response `201`** — `AuthResponse`: the new `user` plus `tokens`.

**Errors** — `409 EMAIL_ALREADY_REGISTERED` · `422 VALIDATION_FAILED` · `429 RATE_LIMITED`

**Side effects**

1. Creates the `users` row (password hashed with Argon2id).
2. Creates a **default wallet** named after `displayName` plus an `OWNER` membership row — a user with no wallet cannot record anything, so registration that left them empty-handed would strand them on an unusable first screen.
3. Seeds that wallet with the starter categories in `packages/contracts/src/starter-categories.ts` — expense, income and transfer.
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

**Request** — `googleAuthSchema`: `{ "idToken": "..." }`, the ID token Google's SDK returns to the client. The API verifies its signature and `aud` claim against `GOOGLE_CLIENT_ID` server-side — the client's own decoding of the token is never trusted.

**Response `200`** — `AuthResponse`. A first sign-in for that Google account creates the user (email taken from the verified token, unusable random `password_hash`), a default wallet named `"{displayName}'s Wallet"`, its starter categories, and one default `CASH` account — the same seeding `POST /auth/register` performs. A Google account whose email already has a password-based `users` row is linked to it (`google_id` is set on the existing row) rather than creating a second user, so a person who registered with a password and later taps "Sign in with Google" keeps one account, one set of wallets.

**Errors** — `401 GOOGLE_TOKEN_INVALID` (bad signature, wrong audience, or expired) · `429 RATE_LIMITED`

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

**Query** — `?status=ACTIVE|ARCHIVED` (default `ACTIVE`), `?includeOwn=true`, `?includeShared=true`

**Response `200`** — `WalletResponse[]`. Each carries the caller's own `role`, their `relationLabel` ("Girlfriend"), `isOwn`, and `balances` **per currency**.

> `balances` is an array, not a scalar. A wallet holding a VND and a USD account has no single total, and inventing one by adding the two numbers together produces a figure that is silently meaningless. Conversion is out of scope for v1.

**Errors** — `401 UNAUTHENTICATED`

**Side effects** — none.

### 6.2 POST /wallets

| | |
|---|---|
| **Auth** | Bearer |
| **Authorization** | Any authenticated user may create a wallet |

**Request** — `createWalletSchema`: `{ "name": "Mom's Money" }`

**Validation** — `name` 1–100 characters after trim.

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

**Request** — `updateWalletSchema`: `{ "name"?, "status"? }`, at least one key.

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

**Side effects** — sets `status = ARCHIVED`. Accounts, categories and transactions are left intact and readable; an archived wallet rejects new writes. Hard deletion is not exposed: transactions are the ledger, and destroying one wallet's rows would silently rewrite the other side of every cross-wallet transfer it participated in. Audit `WALLET_ARCHIVED`.

---

## 7. Members

### 7.1 GET /wallets/{id}/members

| | |
|---|---|
| **Auth** | Bearer |
| **Min role** | `VIEWER` — you can see who else can see your money |

**Query** — `?status=ACTIVE|REVOKED` (default `ACTIVE`)

**Response `200`** — `WalletMemberResponse[]`.

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

**Query** — `?state=open|accepted|revoked|expired` (default `open`)

**Response `200`** — `WalletInvitationResponse[]`. The `token` is **never** returned here — only once, at creation (§8.2). A list endpoint that re-emitted live tokens would turn read access to the invitation list into the ability to join the wallet.

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
| `relationLabel` | ≤ 50 characters, optional |

Rejected when the email already belongs to an `ACTIVE` member, or when an open invitation for this `(wallet, email)` already exists — `uq_wallet_invitation_open` enforces the latter in the database, so re-inviting must revoke first rather than stacking up tokens that all still work. An *expired* open invitation is not live: creating a new one revokes it in the same transaction (audited `INVITATION_REVOKED`), so its old token then answers `404` rather than `410`.

**Response `201`** — `WalletInvitationCreatedResponse`, the one response carrying `token`.

**Errors** — `409 MEMBER_ALREADY_EXISTS` · `409 INVITATION_ALREADY_OPEN` · `403 FORBIDDEN` · `422 VALIDATION_FAILED`

**Side effects** — stores the invitation with a hashed token; audit `MEMBER_INVITED`. Delivery is the caller's job in v1 — no mail is sent.

### 8.3 DELETE /wallets/{id}/invitations/{invId}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `OWNER` |

**Response `204`**. Sets `revoked_at`, which also frees the `(wallet, email)` slot for a fresh invite.

**Errors** — `404 INVITATION_NOT_FOUND` · `409 INVITATION_ALREADY_USED`

**Side effects** — audit `INVITATION_REVOKED`.

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

**Query** — `?walletId=uuid` (optional; omitted returns accounts across **every** wallet the caller can reach), `?status=ACTIVE|ARCHIVED`, `?type=`

**Response `200`** — `AccountResponse[]`, each with a **derived** `balance`.

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

**Request** — `updateAccountSchema`: `{ "name"?, "status"? }`

**Validation** — `currency`, `type` and `initialBalance` are **not** editable. Every stored balance and every transaction on the account derives from them; changing one retroactively rewrites history with no audit trail. Create a new account instead.

**Response `200`** — `AccountResponse`.

**Errors** — `403 FORBIDDEN` · `404 ACCOUNT_NOT_FOUND` · `422 VALIDATION_FAILED`

**Side effects** — audit `ACCOUNT_UPDATED`.

### 9.5 DELETE /accounts/{id}

Archives.

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Response `204`**. Sets `status = ARCHIVED`; the account stops appearing in pickers but its transactions and history remain. Hard delete is not exposed — it would orphan the other side of every transfer.

**Errors** — `404 ACCOUNT_NOT_FOUND`

**Side effects** — audit `ACCOUNT_ARCHIVED`.

---

## 10. Categories

### 10.1 GET /categories

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Query** — `?walletId=uuid` (required), `?type=INCOME|EXPENSE|TRANSFER`, `?status=`, `?tree=true`

**Response `200`** — `CategoryResponse[]`, each carrying `transactionCount` — how many transactions (any status) point at it. The app reads this before offering to delete a category: non-zero means "delete" must mean archive, not permanent removal (§10.4). With `tree=true`, roots carry populated `children`, each with its own `transactionCount`.

**Errors** — `404 WALLET_NOT_FOUND` · `422 VALIDATION_FAILED`

### 10.2 POST /categories

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createCategorySchema`

**Validation**

- `parentId`, when given, must belong to the **same wallet** and have the **same `type`** — an expense category nested under an income parent would make a category tree that cannot be summed.
- Name unique case-insensitively among siblings (`uq_category_name_per_parent`).
- A category cannot be its own parent (`chk_category_not_own_parent`); deeper cycles are rejected in the service layer as `CATEGORY_CYCLE`.

**Response `201`** — `CategoryResponse`.

**Errors** — `409 CATEGORY_DUPLICATE_NAME` · `422 CATEGORY_WRONG_TYPE` · `403 CATEGORY_WRONG_WALLET` · `422 CATEGORY_CYCLE` · `404 CATEGORY_NOT_FOUND` (unknown parent, or one in a wallet the caller cannot see — AC-01)

**Side effects** — audit `CATEGORY_CREATED`.

### 10.3 PATCH /categories/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `updateCategorySchema`: `{ "name"?, "icon"?, "color"?, "status"? }`

**Validation** — `type` is immutable: flipping a category from `EXPENSE` to `INCOME` would invert the sign of every transaction already classified under it. `parentId` is immutable for the same reason budgets aggregate by category.

**Response `200`** — `CategoryResponse`.

**Errors** — `409 CATEGORY_DUPLICATE_NAME` · `404 CATEGORY_NOT_FOUND` · `403 FORBIDDEN`

### 10.4 DELETE /categories/{id}

Archives by default; permanently removes only when explicitly asked **and** the category is genuinely unused.

A category with transactions on it is not something the app silently loses history for by calling this once — the client is expected to have already read `transactionCount` (§10.1) and presented a choice: **rename** (`PATCH` with a new `name`), **archive** (this route, no query), or **delete permanently** (this route, `?mode=permanent`) — with the permanent option disabled client-side whenever `transactionCount > 0`. The API enforces the same rule server-side rather than trusting that client-side gate.

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Query** — `?mode=archive` (default) or `?mode=permanent`.

**Response `204`**.

**Errors** — `404 CATEGORY_NOT_FOUND` · `409 CATEGORY_IN_USE` when archiving and an **active** budget still references it (archiving it would leave a budget that can never compute a period again) · `409 CATEGORY_HAS_TRANSACTIONS` when `mode=permanent` and `transactionCount > 0`, or when it has any non-archived child category with transactions.

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
| Transfer accounts differ | `422 TRANSFER_SAME_ACCOUNT` |
| `currency` equals every named account's currency | `422 ACCOUNT_CURRENCY_MISMATCH` |
| Transfer: both accounts share one currency | `422 TRANSFER_CURRENCY_MISMATCH` — cross-currency transfer needs a conversion rate and is out of scope for v1 |
| Category type matches transaction type | `422 CATEGORY_WRONG_TYPE` |
| Category exists and the caller can see its wallet | `404 CATEGORY_NOT_FOUND` — checked first, so a hidden category is indistinguishable from a made-up id (AC-01) |
| Category belongs to the account's wallet (a transfer's: the `fromAccountId` wallet) | `403 CATEGORY_WRONG_WALLET` |
| No account is `ARCHIVED` | `409 ACCOUNT_ARCHIVED` |
| `EDITOR` on **both** wallets for a cross-wallet transfer | `403 FORBIDDEN` |

**Response `201`** — `TransactionResponse`.

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

**Request** — `updateTransactionSchema`: `{ "description"?, "transactionDate"?, "categoryId"? (uuid or null), "reference"? }`

**Validation** — `amount`, `type`, `fromAccountId` and `toAccountId` are **immutable**. A recorded movement of money is a historical fact; rewriting one silently changes every balance, budget figure and goal total derived from it. Correcting a real mistake means §11.5 then a fresh create, which leaves both rows visible. Attempting to change an immutable field returns `409 TRANSACTION_IMMUTABLE`. A `DELETED` transaction cannot be edited at all.

A changed `categoryId` must keep the same `type` and wallet. `"categoryId": null` removes a transfer's category; on an income or expense it is refused with `422 CATEGORY_WRONG_TYPE`, since those always carry one.

**Response `200`** — `TransactionResponse`.

**Errors** — `409 TRANSACTION_IMMUTABLE` · `409 TRANSACTION_ALREADY_DELETED` · `422 CATEGORY_WRONG_TYPE` · `404 TRANSACTION_NOT_FOUND`

**Side effects** — audit `TRANSACTION_UPDATED` with the changed field names.

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

**Query** — `?walletId=uuid` (required), `?status=`, `?activeOn=YYYY-MM-DD` (budgets whose window contains that day)

**Response `200`** — `BudgetResponse[]`, each with derived `spent`, `remaining`, `usagePercentage`, `isOverBudget`.

**Errors** — `404 WALLET_NOT_FOUND`

### 12.2 POST /budgets

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createBudgetSchema`

```json
{
  "walletId": "uuid", "categoryId": "uuid", "name": "Food August",
  "amount": "3000000", "currency": "VND",
  "periodType": "MONTHLY", "startDate": "2026-08-01", "endDate": "2026-08-31"
}
```

**Validation**

| Rule | Failure |
|---|---|
| `amount > 0` | `422` |
| `endDate >= startDate` | `422` (`chk_budget_dates`) |
| Category is `EXPENSE` and belongs to `walletId` | `422 CATEGORY_WRONG_TYPE` / `403 CATEGORY_WRONG_WALLET`; `404 CATEGORY_NOT_FOUND` when the category's wallet is not visible to the caller (AC-01) |
| No **overlapping active** budget for the same category | `409 BUDGET_PERIOD_OVERLAP` |

> The overlap rule is enforced by a GIST exclusion constraint (`excl_budget_overlap`) over `daterange(start_date, end_date, '[]')`, not by a unique index — two budgets can overlap without sharing either endpoint, which no unique index can express. Archived budgets are excluded from the constraint, so last August's budget does not block this August's.

**Response `201`** — `BudgetResponse` with `spent` already computed over existing transactions — creating a budget mid-month must immediately show what has been spent so far, not zero.

**Errors** — `409 BUDGET_PERIOD_OVERLAP` · `422 VALIDATION_FAILED` · `403 FORBIDDEN`

**Side effects** — audit `BUDGET_CREATED`.

### 12.3 GET /budgets/{id}

**Response `200`** — `BudgetResponse`. Min role `VIEWER`. `404 BUDGET_NOT_FOUND`.

### 12.4 PATCH /budgets/{id}

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `updateBudgetSchema`: `{ "name"?, "amount"?, "status"? }`

**Validation** — `categoryId`, `periodType`, `startDate` and `endDate` are immutable; moving a window changes which transactions the budget ever covered, which is a different budget. Archive and create instead.

**Response `200`** — `BudgetResponse`. **Errors** — `404` · `409` · `422`.

**Side effects** — audit `BUDGET_UPDATED`.

### 12.5 DELETE /budgets/{id}

Archives (`status = ARCHIVED`), which also releases its slot in the overlap constraint. `204`. Audit `BUDGET_ARCHIVED`.

---

## 13. Goals & contributions

### 13.1 GET /goals

Min role `VIEWER`. Query: `?walletId=` (required), `?status=`. Response `200` — `GoalResponse[]` with derived `currentAmount`, `remaining` (floored at zero), `progressPercentage` (capped at 100).

### 13.2 POST /goals

| | |
|---|---|
| **Auth** | Bearer · **Min role** `EDITOR` |

**Request** — `createGoalSchema`: `{ walletId, name, description?, targetAmount, currency, targetDate? }`

**Validation** — `targetAmount > 0`; `targetDate` may be null (a goal without a deadline is valid).

**Response `201`** — `GoalResponse`. **Errors** — `422` · `403` · `404 WALLET_NOT_FOUND`.

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

**Side effects** — `recordAsTransaction: true` creates an `EXPENSE` transaction **and** the contribution pointing at it, in one transaction, so the money leaving the account and the goal advancing can never disagree. Left `false`, the contribution is an earmark: the goal advances without asserting money moved. `transaction_id` is `UNIQUE`, so one transaction can back at most one contribution — otherwise a single payment could be counted toward a goal twice. Audit `GOAL_CONTRIBUTION_ADDED`.

### 13.8 DELETE /goals/{id}/contributions/{cId}

Min role `EDITOR`. `204`. Removes the contribution row outright; when it was transaction-backed, the backing transaction only has its status flipped to `DELETED` — the transaction row itself is never removed, keeping the ledger intact. Audit `GOAL_CONTRIBUTION_REMOVED`.

---

## 14. Dashboard

### 14.1 GET /dashboard

One request answering the four questions the dashboard exists to answer: how much do I have, what came in, what went out, and where did it go.

| | |
|---|---|
| **Auth** | Bearer · **Min role** `VIEWER` |

**Query** — `dashboardQuerySchema`: `walletId` (required), `accountId` (optional — one of this wallet's accounts, see below), `dateFrom`, `dateTo` (default: the current calendar month), `displayCurrency` (optional, three-letter code)

**`accountId`** narrows every figure to that one account. `totalBalance` is that account's balance, and `income`/`expense`/`spendingByCategory`/`spendingByMember`/`recentTransactions` count only transactions touching it. The account is now the boundary, so a transfer to or from a *sibling* account in the same wallet appears in `transferredIn`/`transferredOut`. At wallet level that transfer is internal and appears in neither. It is still never income or expense (BR-06). `activeBudgets` and `activeGoals` are wallet-level, not per-account, so an account-scoped response returns them as `[]` rather than wallet figures that would read as the account's. An `accountId` that is not one of `walletId`'s accounts is `404 ACCOUNT_NOT_FOUND`: the wallet is already authorised, so this reveals nothing about another wallet (AC-01).

**Response `200`** — `DashboardResponse`: `totalBalance`, `income`, `expense`, `net`, `transferredIn`, `transferredOut` (each **per currency**), `spendingByCategory` (descending, with percentages), `spendingByMember`, `recentTransactions` (10), `activeBudgets`, `activeGoals`, `valuation` (optional — present only when `displayCurrency` was supplied).

> `income` and `expense` **exclude transfers entirely**. This is the single most consequential rule in the product: a wallet that moved 2,000,000 from bank to cash has not earned or spent anything, and a dashboard that says otherwise makes every other number untrustworthy.

**`transferredIn` / `transferredOut`** (`CurrencyTotal[]`): the period's transfers **across this wallet's boundary**, reported on their own and never folded into `income`/`expense`/`net`. A transfer whose two legs are both this wallet's own accounts is **internal** and appears in neither figure — it never crossed the boundary, and counting it as both in and out would inflate each by the same amount. In practice these are the cross-wallet transfers of §11.4 (BR-02), seen from one side.

**`spendingByCategory[].parentId`** (`string | null`): the category's own parent, so a client can group the breakdown by parent without a second call to §7. `null` for a top-level category.

**`spendingByMember`** (`MemberSpendSlice[]`): `{userId, displayName, income, expense}` per member who recorded activity in the period, ordered by spend. Attributed by `transactions.created_by_user_id` — on a shared wallet, "who recorded this" is also "whose spending was it". Each member's figures are filtered by the same predicate as the wallet-level totals, so the split always reconciles against `income`/`expense`. No new information is exposed: any `VIEWER` on the wallet can already read every transaction and its `createdBy` via §11.1.

**`valuation`** (`ConvertedValuation`, present only when `displayCurrency` is requested): `{currency, amount, isApproximate, status, rateTimestamp?, missingCurrencies?}`. `amount` is `totalBalance` converted into `currency` — an estimate, never authoritative, never stored, never summed into any other figure. `status` is one of `FRESH` (converted just now, or every account already in `currency` so no conversion was needed), `STALE` (converted using the best available cached/snapshotted rate, older than preferred), or `UNAVAILABLE` (`amount: null`, `missingCurrencies` lists what couldn't be converted — the whole total is withheld rather than silently excluding a currency). Rates come from an external provider (`ExchangeRateService`, 12h cache by default) with a daily-snapshot fallback for staleness; a request with no `displayCurrency` omits this field entirely rather than sending `null`.

**Errors** — `404 WALLET_NOT_FOUND` · `404 ACCOUNT_NOT_FOUND` (an `accountId` outside the wallet) · `422 VALIDATION_FAILED`. `503 VALUATION_UNAVAILABLE` is defined in the error catalog for this feature but not currently returned by any code path — an unavailable conversion is reported in-band via `valuation.status`, not as a request failure.

**Side effects** — none. Served by two aggregate queries rather than one per tile, plus (only when `displayCurrency` is requested) a possible external rate lookup, cached for 12h by default.

---

## 15. Audit

### 15.1 GET /wallets/{id}/audit-logs

| | |
|---|---|
| **Auth** | Bearer · **Min role** `OWNER` |

**Query** — `?event=`, `?dateFrom=`, `?dateTo=`, `page`, `pageSize`

**Response `200`** — `AuditLogResponse[]`: `id`, `event`, `entityType`, `entityId`, `result`, `actorId`, `actorRole`, `note`, `createdAt`.

**Errors** — `403 FORBIDDEN` · `404 WALLET_NOT_FOUND`

**Side effects** — none. The log is append-only: no update or delete path is exposed on any route.

---

## 16. Cross-cutting behaviour

### 16.1 What is logged

Audited at `INFO`: transaction created / updated / deleted; account, category, budget, goal created / updated / archived; member invited / accepted / removed / role changed; ownership transferred; wallet created / archived; login, logout, registration. Every `401` and `403` is logged at `WARN` with actor, role and target.

Never logged: passwords, tokens (access, refresh, or invitation), or password hashes. User ids and emails may appear at `INFO`.

### 16.2 Concurrency

Multi-row writes run in one database transaction: wallet + owner membership, invitation acceptance, ownership transfer, and contribution + backing transaction. Ownership transfer additionally takes `SELECT ... FOR UPDATE` on the wallet's membership rows, because `uq_wallet_single_owner` turns a concurrent double-promote into a constraint violation rather than a corrupt state — the lock converts that into a clean serialised outcome.

### 16.3 Deletion policy

Nothing financial is hard-removed. Wallets, accounts, categories, budgets are archived; transactions are marked `DELETED` (status flip, row stays); members are revoked. The only true row removal is a goal contribution, and that marks its backing transaction `DELETED` rather than erasing it. Transactions are the source of truth for every derived figure, so a destroyed row silently changes historical answers.

### 16.4 Currency scope for v1

Each account has one currency. A transaction must match its accounts' currency. Transfers require both accounts to share a currency. Wallet, dashboard and account totals are reported **per currency** — never summed across currencies. Conversion, rate snapshots and cross-currency transfer are explicitly out of scope for v1.

---

## 17. AI assistant

A chat that answers questions about one wallet and can **propose** an income or expense. It never records anything by itself: a proposal is stored on the assistant's message as `PENDING`, and only the user's explicit confirm (§17.6) turns it into a transaction, through the same code path, checks and audit row as §11.2.

A conversation belongs to the user who created it. Another user's conversation id is `404 AI_CONVERSATION_NOT_FOUND`, the same as an id that does not exist. Each message names the wallet it is about, and read access to that wallet is checked on every send (AC-01: a non-member gets `404 WALLET_NOT_FOUND`). The assistant reads only that wallet, through read-only tools: its active accounts with their derived balances, its active categories, and the current month's §14.1 figures (so transfers are never income or expense, BR-06).

The model is pluggable behind one server-side interface. The default is a deterministic keyword-rule provider that needs no API key; every figure it states comes from a tool, never from its own arithmetic. Replies are written in the request's `locale` (`en` or `vi`).

Types: `AiConversationResponse` `{id, walletId, title, createdAt, updatedAt}` · `AiMessageResponse` `{id, conversationId, role (USER | ASSISTANT), content, action, createdAt}` · `AiActionResponse` `{type (CREATE_TRANSACTION), status (PENDING | CONFIRMED | DISMISSED), transaction, accountName, categoryName, transactionId}`. `transaction` is an income or expense in exactly the §11.2 request shape (`aiTransactionDraftSchema`), in the account's own currency (BR-07); `accountName`/`categoryName` are the names at proposal time.

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
| §6 Wallets | `createWalletSchema`, `updateWalletSchema` | `chk_wallet_status` |
| §7 Members | `updateMemberSchema` | `uq_wallet_member`, `uq_wallet_single_owner`, `chk_wallet_member_role` |
| §8 Invitations | `inviteMemberSchema`, `acceptInvitationSchema` | `chk_invitation_role`, `uq_wallet_invitation_open` |
| §9 Accounts | `createAccountSchema`, `updateAccountSchema` | `chk_account_type`, `chk_account_currency` |
| §10 Categories | `createCategorySchema`, `updateCategorySchema` | `uq_category_name_per_parent`, `chk_category_not_own_parent`, `chk_category_type` |
| §11 Transactions | `createTransactionSchema`, `updateTransactionSchema` | `chk_transaction_shape`, `chk_transaction_amount`, `chk_transaction_status` |
| §12 Budgets | `createBudgetSchema`, `updateBudgetSchema` | `chk_budget_dates`, `excl_budget_overlap` |
| §13 Goals | `createGoalSchema`, `createContributionSchema` | `chk_goal_target`, `goal_contributions.transaction_id UNIQUE` |
| §14 Dashboard | `dashboardQuerySchema` | — |
| §17 AI assistant | `createAiConversationSchema`, `sendAiMessageSchema`, `aiTransactionDraftSchema` | `chk_ai_message_role`, `chk_ai_message_action_type`, `chk_ai_message_action_status`, `chk_ai_message_action_shape` |

Derived values (`balance`, `spent`, `remaining`, `usagePercentage`, `progressPercentage`) are computed by [`calc.ts`](../packages/contracts/src/calc.ts) and proven against real PostgreSQL by [`db/tests/001_constraints.sql`](../db/tests/001_constraints.sql).
