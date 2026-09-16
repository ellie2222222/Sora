# Business Rules & Access Control

The product is a **mobile finance tracker whose headline feature is tracking someone else's money alongside your own** — a partner's, a parent's, a friend's — with a real per-person role on each wallet.

---

## Business Terminology

One canonical term per concept across code, SQL, API, and UI:

| Term | Do NOT Use | Definition |
|---|---|---|
| **Wallet** | Household, Family, Group | One person's finances ("Tam's Wallet", "Mom's Wallet"). The wallet **is** the sharing boundary; there is no group container above it. |
| **Member** | Participant, Collaborator | A `wallet_members` record: another real user holding `OWNER`, `EDITOR`, or `VIEWER` on a wallet, plus a `relationLabel`. |
| **Account** | Sub-wallet | Where a wallet's money sits (e.g. Cash, Vietcombank, MoMo). Belongs to exactly one wallet. |
| **Transaction** | Entry, Record | `INCOME`, `EXPENSE`, `TRANSFER`. Hangs off accounts, never directly off a wallet. |
| **Budget** | Limit, Allowance | Planned spend limit for one category over one date range. |
| **Saving Goal** | Target, Objective | Target amount, optional deadline, funded by contributions. |

---

## Canonical Business Rules

### BR-01 — Wallet Ownership & Membership
- Every wallet has **exactly one** `ACTIVE` `OWNER` row, enforced by partial unique index `uq_wallet_single_owner`.
- A user can own multiple wallets and be a member of many others.
- Removing a member sets `status = REVOKED`. The record is retained so historical references (`transactions.created_by_user_id`) resolve to a name.

### BR-02 — Cross-Wallet Transfers
- A `TRANSFER` whose two accounts belong to *different* wallets is a single transaction. It is the primary mechanism to settle balances between partners/collaborators.
- Cross-wallet transfers require `EDITOR` role on **both** wallets. Read access to someone's wallet must never permit pushing money into it.

### BR-03 — Transaction Immutability
- `amount`, `type`, `fromAccountId`, and `toAccountId` cannot be edited (`409 TRANSACTION_IMMUTABLE`).
- Financial transactions are historical facts. Editing them rewrites balances, budget figures, and goal progress.
- Correcting an entry requires cancelling and creating a new transaction. Only `description`, `transactionDate`, `categoryId`, and `reference` are mutable.

### BR-04 — Non-Overlapping Budget Windows
- At most one `ACTIVE` budget per category per overlapping date range.
- Enforced at the database level by the Postgres GIST exclusion constraint `excl_budget_overlap`, not by a simple unique index. Archived budgets are excluded.

### BR-05 — Derived Values are Never Stored
- Account balances, wallet totals, budget spend/remaining/usage, and saving goal progress are **computed dynamically from ledger transactions on every read**.
- There is no `spent_amount` or `cached_balance` column in the database.
- The single source of truth for derivation math is [`packages/contracts/src/calc.ts`](file:///d:/Code/sora/packages/contracts/src/calc.ts).

### BR-06 — Transfers are Neither Income nor Expense
- Transfers are strictly excluded from `income`, `expense`, `spendingByCategory`, and budget `spent`.
- Transfers represent movements of liquidity and are tracked as `transferredIn` / `transferredOut`. A transfer between bank and cash does not represent earnings or spend.

### BR-07 — Currency Consistency
- An account has a single currency.
- Transactions must match the currency of all named accounts. Transfers require both accounts to share the same currency.
- Wallet, account, and dashboard totals are reported **per currency and never summed across currencies**.
- Optional cross-currency estimates on the dashboard (`displayCurrency`) are read-only approximations marked with freshness status, never persisted.

### BR-08 — Single-Use Email Invitations
- Invitations are addressed to an **email** address so non-registered users can be invited.
- Single-use, SHA-256 hashed token (only the hash is stored in `wallet_invitations`), with a 7-day expiration.
- Allowed invitation roles are `EDITOR` or `VIEWER`. `OWNER` cannot be invited (ownership transfer requires explicit handoff).
- Enforced by `uq_wallet_invitation_open`: re-inviting revokes prior live tokens for that email.

---

## Access Control

Role comparison is performed per wallet using `roleSatisfies()` from [`packages/contracts/src/enums.ts`](file:///d:/Code/sora/packages/contracts/src/enums.ts):

| Role | Permissions |
|---|---|
| `OWNER` | Full control: membership management, roles, ownership transfer, wallet archive, audit log. |
| `EDITOR` | Write operations: create/edit accounts, categories, transactions, budgets, goals, contributions. |
| `VIEWER` | Read-only access: view balances, transactions, and membership list. |

### AC-01 — No Membership Row Returns `404`, Never `403`
- If a user has no membership row for a wallet-scoped resource, return **404 Not Found**.
- Returning `403 Forbidden` leaks whether the resource or wallet ID exists to unauthorized actors.
- Reserve `403` strictly for cases where membership exists but the assigned role is insufficient.

### AC-02 — Server-Side Enforcement
- Authorization is strictly enforced in server guards and service layers.
- The mobile app UI reflects permissions for UX only; client-side hiding is never a security control.

### AC-03 — Cross-Wallet Verification
- Transactions touching accounts in different wallets must verify `EDITOR` permissions on both wallets.

### AC-04 — Audit Log Security
- The audit log (`audit_logs`) is append-only and accessible strictly by `OWNER`. No update or delete endpoints exist.

### AC-05 — Denial Logging
- Every `401` and `403` denial is logged at `WARN` level with actor ID, resolved role, and target resource.
