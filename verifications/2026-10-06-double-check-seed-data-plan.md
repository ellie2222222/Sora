# Double-check: seed-data plan against the live schema, contracts and API

**Date:** 2026-10-06T06:57:16Z
**Method:** double-check skill
**Verdict:** PASS after fixes (docs-only; nothing to run, since the plan isn't implemented)
**Scope:** `plans/tooling/seed-data-plan.md`, which the user named as "the plan". Every factual claim was checked against code, including today's changes: starter keys and translations, sign-up language and parent budgets. Phase 1 code sweep skipped: there is no code to sweep.
**Files touched:** `plans/tooling/seed-data-plan.md`, `docs/API_SPECIFICATION.md` (§5.1)
**Related reports:** 2026-10-06-i18n-budget-follow-ups.md, 2026-10-06-i18n-sync-and-tone.md

## Method

A read-only agent checked 14 claim groups against:
- `db/migrations/001_schema.sql`, `packages/contracts/src/*`, `docs/API_SPECIFICATION.md`;
- `server/src/{auth,wallets,categories,transactions,goals,budgets}`;
- `mobile/src/utils/categoryIcons.ts`, `mobile/e2e/seed.mts`, `.gitignore` and the root `package.json`.

Discrepancies were then re-checked by hand:
- `sed -n 190,203p packages/contracts/src/schemas.ts`: `updateAccountSchema` has no `initialBalance`;
- `sed -n 459,470p server/src/auth/auth.service.ts`: the seeded account is `CASH` with `initial_balance: '0'`;
- the key count of `categoryIcons.ts` is 37.

## Findings

Verified correct, with the evidence in the agent's hand-back:
- `seed.mts` reuses `probe-data.ts`, and `E2E_API_URL` has no default;
- `.env.seed` is ignored but `seed.env` is not;
- register `locale` (§5.1), Accept-Language (§2.11), and `POST /wallets` seeds nothing;
- 38 starters, all top-level; all 26 starter names the plan cites exist with the right types;
- no custom name collides with a starter's English or Vietnamese name under the same parent (`assertNameFree` is per parent);
- a child category must share its parent's type;
- the 4 account types; signed `initialBalance`; any `[A-Z]{3}` currency;
- `PENDING` can be created; `reference`; `goalId` only on EXPENSE; delete via `POST …/delete`; PATCH can change the type;
- goal statuses, `recordAsTransaction`/`contributionDate`, `GOAL_NOT_ACTIVE`, no auto-complete, contribution removal deletes its backing transaction;
- budget kinds and periods, a per-budget `currency`, subcategory roll-up at any depth, GOAL budget rules;
- invite, revoke and archive routes; `GET /wallets` defaults to ACTIVE;
- page size 25; no `scripts/seed` or `db:seed` yet.

Wrong in the plan (FAIL, all fixed):
1. **Seeded Cash balance.** The plan gave An's and Linh's Cash accounts opening balances of 1,200,000 and 600,000. The registered Cash account always opens at 0 and can't be edited, so the plan's balances couldn't be set.
2. **Wallet and Cash names.** An, Khoa and Bao register in `vi`, so their wallets are "Ví của …" with "Tiền mặt", not "An's Wallet" / "Cash".
3. **Parent-budget example.** "Food also counts Coffee" is wrong: Coffee is under Dining Out in the plan's own table, and no starter has children.
4. **Icon count.** It's 37 keys, not 38 (`credit-card` is shared). The server doesn't validate icons.
5. **Open questions 1 and 2** (future `transactionDate` for PENDING, future budget `startDate`) are answerable from code: nothing rejects either.
6. **JPY whole yen** is enforced only by the seed; the server accepts 4 decimals in any currency.

## Fixes Applied

- §2: added the locale-driven wallet and Cash names; "An's Wallet" now refers to "Ví của An".
- §3:
  - An's row is now "Tiền mặt (seeded) 0 → funded with 1,200,000";
  - new paragraph: the seeded Cash opens at 0 and is funded by a day-one Cash Withdrawal transfer, and verify item 1's expected balances account for it;
  - Linh's, Khoa's and Bao's Cash adjusted the same way.
- §1.5: the seed enforces whole yen itself.
- §4: 37 icon keys; the seed checks icons itself; starters are top-level.
- §6.2:
  - the roll-up paragraph corrected;
  - a new **Housing** MONTHLY 7,000,000 budget added to the table, reached only through Rent, as the parent-through-subcategory case;
  - Transportation is excluded, because the Motorbike goal's payment is booked straight to it.
- §9: questions 1–2 marked resolved, with the evidence.
- Re-check: `grep` for "38 lucide", "Food also counts" and the old assumption markers returns nothing.

## Self-review passes 2 and 3

The user asked to "self review again and again". Each claim below was re-checked in code before the plan was edited.

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 7 | Phase 2 archived ACB and Gym before phase 4's ACB closing transfer and the corrections pass. Writes to an archived account fail | `transactions.service.ts:329` `ACCOUNT_ARCHIVED`; `account-write-lock.ts:29-30` | New §1.4 "Write order" table; every state change moved to phase 6, after corrections |
| 8 | Goal-tagged expenses (Japan, phases 3–4) came before goals were created (phase 5) | `assertGoalTag` → `requireGoalInWallet` (`transactions.service.ts:405-414`) | Goals are now created `ACTIVE` in phase 2; contributions stay in phase 5; complete/cancel moved to phase 6 |
| 9 | The Japan GOAL budget window started at "goal created", which is run time, so it would miss the Aug–Oct tagged spending | §8 (`createdAt` = now); `budgets.service.ts:126-128` doesn't tie the window to the goal | Window is now 2026-08-01 → target date |
| 10 | Weekend Dining (Dining Out) now also counts Coffee, so at 700,000 it would be over, not near | spec §12.2 roll-up; habit rates in §5.3 | 1,000,000, expected ~900k a week |
| 11 | No EXPENSE category for lì xì given. "Lucky Money" is INCOME, and names are unique per parent across types | `uq_category_name_per_parent` (no type column) | Added "Lucky Money Given" (EXPENSE) |
| 12 | §1.1 named an `addMember` flow that doesn't exist | `routes.ts:37,44`; `invitations.service.ts:199` returns the token | `POST /wallets/{id}/invitations`, then `POST /invitations/accept` |
| 13 | Cross-wallet transfers can't take a payee-side category; Bao (VIEWER) can't record in Mom's Wallet | `categorisedAccountId` (`transaction-category.ts`) | §4 note added: An records the allowance cash |
| 14 | "Wedding Fund created last week" isn't possible (`createdAt` = now) | §8 | "the newest goal" |
| 15 | Correction #3 (EXPENSE → TRANSFER) would fail without changing the category | `assertCategoryFits` on update; BR-03 | The PATCH also sets Credit Card Payment |
| 16 | Verify item 7 can't see a revoked member or an archived wallet with the default list queries | `wallets.controller.ts:60,67` default `ACTIVE` | `?status=REVOKED`, `?status=ARCHIVED` |
| 17 | The sister's invite email didn't follow the `seed+…@example.invalid` rule | §1.3 | `seed+sister-<runId>@example.invalid` |
| 18 | My own first §1.4 draft said an archived wallet blocks member changes | `members.service.ts` has no archived check; only creates and ledger writes do (`requireWritable` callers) | Row corrected |

Also checked, still correct:
- auth rate limiting is per IP per route, 10 a minute, auth routes only (`auth-rate-limit.guard.ts`), and the plan stays under it;
- `PENDING` doesn't move balances (`calc.ts:33-38`);
- past goal `targetDate` is allowed;
- earmarks need an `accountId` in the goal's currency;
- a contribution can be removed on a COMPLETED goal;
- Housing ≈ 93% from Rent alone.

Pass 3: `grep` for every replaced phrase ("700,000", "goal created", "archived account/category", "addMember", "Food also", "38 lucide", "created last week") finds none left; section references resolve.

## Final pass

The whole plan was read again, including §1, which hadn't been re-read in full since the edits.

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 19 | §1.5 said a late-night and a 00:10 transaction "land on different UTC dates". Only the 00:10 one does | `node -e` gives `2026-11-01T00:10+07:00` = `2026-10-31T17:10:00.000Z`; 23:30+07:00 is 16:30Z on the same date | Reworded: the 00:10 entry falls on the previous month's last UTC day |
| 20 | `client.ts` refresh-on-401 didn't say refreshes must be serialized. Two parallel refreshes rotate one token twice, and the loser is treated as a replay, which revokes the persona's whole token family | `auth.service.ts:327,336` call `rejectReplay` on a revoked token and on a lost rotation race | `client.ts` now allows one in-flight refresh per persona |
| 21 | §5.1 salary said "the 24th when the 25th is a Sunday", but §5.2 says weekend → previous Friday | Internal contradiction | §5.1 now follows §5.2 |

Checked, still correct:
- Tet dates (2025-01-29, 2026-02-17, 2027-02-06);
- the history window, 2025-10-01 → 2026-10-06;
- `node >=22.18` (root `package.json:12`), which runs `.mts` directly;
- the ~2,500 request estimate against the transaction volumes in §5.

## Follow-ups

- The plan is still Draft and not implemented. Building it is phases 1–7 in §10.
- None open. API spec §5.1 was missing `locale` from its request example and validation table, though the schema accepts it. Both added this pass: an omitted locale falls back to `en`, the `users.locale` default (`auth.service.ts:430`). Parity 65/65.
