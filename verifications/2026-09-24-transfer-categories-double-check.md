# Double-check of the transfer-categories session diff (plus toast, sheet height, copy fixes)

**Date:** 2026-09-24T02:37:07Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** every uncommitted change on `main` at the time of the pass — TRANSFER category type
(contracts, server, mobile, guest store/seed/upload), migrations `005`/`006`, `BottomSheetModal`
numeric `maxHeight`, Add Transaction header, `ToastProvider` timers/queue/a11y, connection/sync copy.
Chosen because it was all built in this session and none of it had been swept yet.
**Files touched:** `mobile/src/hooks/useDefaultToFirst.ts` (new), `mobile/src/hooks/index.ts` (new),
`mobile/src/features/categories/components/categoryTypeLabel.ts` (new),
`mobile/src/features/accounts/components/AccountPicker.tsx`,
`mobile/src/features/categories/components/CategoryPicker.tsx`,
`mobile/src/features/categories/components/CategoryGrid.tsx`,
`mobile/src/features/categories/screens/CategoryListScreen.tsx`,
`mobile/src/services/guest/guestUpload.ts`, `mobile/src/services/guest/guestUpload.test.ts`,
`mobile/src/services/guest/guestSeed.ts`, `mobile/src/services/guest/guestTransactions.test.ts`
**Related reports:** [2026-09-23-double-check-and-comment-audit-remaining-diff.md](2026-09-23-double-check-and-comment-audit-remaining-diff.md)
(carried follow-up: duplicated default-to-first logic — closed here)

## Method

- Health sweep of `git diff` by a read-only agent against CLAUDE.md Part 5 and Part 7; every finding
  re-grepped before acting.
- `npm run typecheck`; `npm test -w @sora/contracts`; `npm test -w @sora/server`;
  `npm run test -w @sora/mobile`; `node scripts/check-contract-parity.mjs`.
- Scratch Postgres 17 container `sora-scratch-dc` (port 55435, db `sora_scratch_dc`) →
  `node scripts/migrate.mjs` → built server (`node dist/src/main.js`, port 3999, fake
  `JWT_SECRET`/`GOOGLE_CLIENT_ID`) → HTTP probe script using users
  `probe+{a,b}-a3a0819d-2af0-4021-9278-d434d4fddc60@example.invalid`. Container started `--rm`,
  stopped afterwards — all probe data gone with it.
- Scratch container `sora-scratch-probe` (port 55436) → `node scripts/migrate.mjs --constraints`.

## Findings

1. Typecheck, all packages → exit 0. PASS.
2. Tests → contracts 73/73, server 11/11, mobile 227/227. PASS.
3. Parity → 31/31, incl. `CATEGORY_TYPES matches chk_category_type`. PASS.
4. Server boot on migrated scratch DB → no errors in log; one `WARN` = the expected
   `CATEGORY_WRONG_WALLET actor=… role=none target=POST /api/v1/transactions` (LA-03). PASS.
5. Real endpoints (all as specified in API_SPECIFICATION §10–§11):
   - register → seeded categories EXPENSE/INCOME/TRANSFER = 23/10/5
   - `GET /categories?type=TRANSFER` → 200, 5
   - transfer + TRANSFER category → 201, category `Savings`; transfer with none → 201, `null`
   - transfer + EXPENSE category → 422 `CATEGORY_WRONG_TYPE`; expense + TRANSFER category → 422
   - transfer + another wallet's TRANSFER category → 403 `CATEGORY_WRONG_WALLET`
   - PATCH sets category on an uncategorised transfer → 200; PATCH transfer to EXPENSE category → 422
   - `GET /transactions?categoryId=<Savings>` → 200, 2
   - dashboard after two 250000 transfers + one 40000 expense → `expense` = 40000.0000,
     `spendingByCategory` = `Food=40000.0000` only (BR-06 holds). PASS.
6. `db/tests/001_constraints.sql` with `001`–`006` applied → PASS. A second `--constraints` run on the
   same DB fails `users_pkey` — pre-existing: the suite seeds fixed ids with no cleanup; CI re-applies
   migrations, not probes. Not a regression.
7. Sweep: server and guest transfer-category validation match on create and update; no
   income/expense/budget/goal path can include a TRANSFER category; i18n keys all referenced, en/vi
   parity intact; no function `style` on Pressable (rule 15); no `Number(amount)`/`toLocaleString`
   (MB-08). PASS.
8. Sweep: empty-state label interpolated the raw enum (`type.toLowerCase()`) into translated text —
   vi rendered "Chưa có danh mục transfer nào." FAIL → fixed.
9. Sweep: guest upload matched categories by type+name, but `uq_category_name_per_parent` ignores
   type — a guest TRANSFER "Savings" against a wallet's EXPENSE "Savings" would 409 and stall the
   upload. The existing test asserted a plain duplicate "Food" create, which the real server rejects.
   FAIL → fixed.
10. Sweep: default-to-first effect duplicated three times (carried follow-up), made worse by this
    session's `optional` flag. FAIL → fixed.
11. Sweep: `CategoryListScreen` only surfaced an error for the expense query. FAIL → fixed.
12. Sweep: new category-type buttons had no `testID` (NC-04). FAIL → fixed.

## Fixes Applied

- #8 → `categoryTypeLabel.ts` maps each type to its translated key; `CategoryGrid`/`CategoryPicker`
  interpolate `t(key).toLowerCase()`. Re-verified: `grep -rn "type.toLowerCase()"
  mobile/src/features/categories` → no matches; typecheck clean.
- #9 → `guestUpload.ts` `uploadCategories`: on a same-name clash with another type, upload as
  `"<name> (<Type>)"`, reusing an earlier suffixed copy if present. Test updated to expect
  `Food (Expense)` and assert no plain `Food` create; new test for reusing the suffixed copy.
  Re-verified: mobile 227/227.
- #10 → `mobile/src/hooks/useDefaultToFirst.ts` (+ new `hooks/index.ts` barrel); all three pickers use
  it. Re-verified: no `useEffect` left in the three files; `services/sync` (reached via the barrel's
  `useNetworkStatus`) imports only `app/store` slices, `utils`, `services/guest` — no cycle back.
- #11 → first failing query of the three drives the error `StateView`. Typecheck clean.
- #12 → `btn-category-type-{EXPENSE,INCOME,TRANSFER}`.
- Comments: dropped a what-comment in `guestTransactions.test.ts`; `guestSeed.ts` JSDocs cut to one
  why-line each, with the "Other" skip rationale kept beside its check.

## Follow-ups

Resolved in a follow-up pass the same day (each re-verified as noted):

- Clearing a transfer's category — `updateTransactionSchema.categoryId` now `uuid | null`; server
  (`assertCategoryRemovable`) and guest refuse `null` on income/expense with `CATEGORY_WRONG_TYPE`;
  `CategoryPicker` gained `onClear` ("No category" row), wired in `EditTransactionModal` for
  transfers; API spec §11.4 updated. Verified: contracts 75/75 (new schema tests), guest tests for
  clear-on-transfer and refuse-on-expense, mobile 229/229.
- Server transfer-category rules — extracted to `server/src/transactions/transaction-category.ts`,
  used by `create` and `update`; `server/test/transaction-category.test.ts` covers the type matrix,
  wrong wallet, missing category, paying-side wallet choice and removal. Verified: server 22/22.
- Probe suite re-runnable — `001_constraints.sql` wrapped in `BEGIN … ROLLBACK`; `migrate.mjs`
  rolls back after a failed suite. Verified on scratch DB `sora_scratch_rerun`: two consecutive
  `--constraints` runs both PASS; afterwards 0 users and 0 `expect_%` functions remain. The
  failure-path `ROLLBACK` was not exercised.
- Shared guest category builder — `newGuestCategory` in `guestCategories.ts`, used by `create` and
  `guestSeed.ts`. Verified: mobile 229/229.
- `StateView.tsx` — the long condition extracted to `isSelfResolvingError`, comment cut to a
  why-only JSDoc; `features/home/screens/HomeScreen.tsx` tab-bar comment cut to one line.

Still open, by design:

- `005`'s TRANSFER insert is repeated by `006` (harmless, `ON CONFLICT DO NOTHING`). `005` is
  applied to `sora_dev` and applied migrations are immutable, so it stays.
- Offline edit of a transaction's category patches the cache with `categoryId` only
  (`transactionsApi.ts` `onQueryStarted`), not the `category` ref, so the row shows its old category
  until the queue syncs — pre-existing, true for any category change, not just removal.
