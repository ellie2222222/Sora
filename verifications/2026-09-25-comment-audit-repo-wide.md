# Comment audit, repo-wide

**Date:** 2026-09-25T11:59:35Z
**Method:** comment-audit skill
**Verdict:** PASS
**Scope:** the whole repo, per an unscoped `/comment-audit`:
- `packages/contracts`, `server/src`, `server/test`;
- `mobile/src` (tests included) and `mobile/e2e`;
- `db/`, `scripts/`, `.github/`, `docker-compose.yml`, `.env.example`.

Excluded: `webpage/` (parked, `PARKED.md`), `node_modules`, build output, lockfiles, locale strings, `.claude/skills/` and `verifications/`. The last whole-repo pass was `2026-09-21-comment-audit-repo-wide.md`.

**Files touched:** 62 files. Every change is a comment edit except one line, `packages/contracts/test/calc.test.ts` (see Fixes Applied). `git diff --stat` has the list.
**Related reports:**
- `2026-09-25-comment-audit.md`: its kept items (the four-way Ref-pattern comment and the paging tiebreak note) were not re-flagged;
- `2026-09-24-comment-audit.md`: its overscroll follow-up is still open.

## Method

- Four read-only Explore agents ran in parallel:
  - mobile `features/` + `app/`;
  - mobile shared code, config and `e2e/`;
  - server;
  - contracts, db, scripts and CI.
- Each agent reported `file:line — text — pattern`, plus flag-only items and missing-comment gaps.
- Every finding acted on was re-read in the live file first (`sed -n`, `grep`). Claims were checked against the code, for example:
  - `check-contract-parity.mjs:31-36` concatenates every migration;
  - `requireAccountsWritable` throws on the first failing account;
  - `db/tests/001_constraints.sql:223` adds a persisted 1,000 VND transfer;
  - `calculateBudgetSpent` filters on `currency` (`calc.ts:109`).
- Comment-only proof: `git diff -U0 | grep -E '^[+-]' | grep -vE '^[+-]\s*(//|/\*|\*|\*/|#|\{/\*)' | grep -vE '^[+-]\s*$'` → exactly one line, `+    currency: 'VND',`.
- Checks run:
  - `npm run typecheck` (every package);
  - `npm run test -w @sora/contracts`;
  - `node scripts/check-contract-parity.mjs`;
  - mobile `npm run test`;
  - server `npm run test`.

## Findings

Fixed. Pattern numbers follow the skill: 1 restates the code, 3 caller reference, 4 stale, 5 untracked TODO, 7 rotting count, J journal, 2 commented-out code.

| File:line (before) | Was | Pattern | Now |
|---|---|---|---|
| `contracts/src/calc.ts:34` | "a CANCELLED one is a record of a mistake" | 4 | DELETED (migration 004) |
| `contracts/src/calc.ts:65`, `:92` | first lines restating the function | 1 | removed; the why lines kept |
| `contracts/src/enums.ts:4-7` | "the CHECK constraint in db/migrations/001_…" | 4 | `db/migrations/`, which the parity script reads in full |
| `contracts/src/enums.ts:114-120` | "check-contract-parity.mjs does not read [002] (it's scoped to 001)" | 4 | 2 lines: the script's `'([A-Z_]+)'` match skips lowercase slugs |
| `contracts/src/enums.ts:154` | "Shared pagination limits." | 1 | removed |
| `contracts/src/schemas.ts:9-10` | "mirror the CHECK constraints in db/migrations/001_…" | 4 | `db/migrations/` |
| `contracts/src/responses.ts:140-141` | "one `CODE: HTTP_STATUS.NAME` pair per line for it to parse" | 4 | the real limit: the parser reads up to the first `}` |
| `contracts/src/money.ts:141` | "rounded half-up" | 4 | "half away from zero" (`scaled < 0n ? -1n : 1n`) |
| `contracts/src/routes.ts:43`, `:100` | restating one-liners | 1 | removed |
| `contracts/test/calc.test.ts:24-28` | "The same fixture … If the TypeScript and the database ever disagree, one of the two suites goes red" | 4 | modelled on the fixture without the probe rows; the SQL suite prints, doesn't assert |
| `contracts/test/money.test.ts:98` | "The same figure db/tests/001_constraints.sql produces" (SQL gives 14,349,000) | 4 | removed |
| `scripts/check-contract-parity.mjs:2-19` | "Three things can drift", listing 3 of the checks | 4, 7 | 5 lines naming all three check groups |
| `scripts/check-contract-parity.mjs:27-30` | repeated the `constraintValues` docblock | 6 | 1 line |
| `scripts/migrate.mjs:45-52` | "the constraint suite prints balances" (the runner never prints rows) | 4 | 2 lines citing rule 1 |
| `ci.yml:16-18` | "every other job depends on it" (`database` has no `needs:`) | 4 | server and mobile depend on it |
| `.env.example:62` | "where the migration runner looks" (it never reads the var) | 4 | says it is unused |
| `docker-compose.yml:2-3` | "the "Docker" section" of CLAUDE.md/README (only README has one) | 4 | README.md's Docker section |
| `server/src/wallets/wallet-access.service.ts:143-145` | "`notFound` defaults to ACCOUNT_NOT_FOUND" (no such parameter) | 4 | states the fixed ACCOUNT_NOT_FOUND |
| `wallet-access.service.ts:205-206`, `transactions.service.ts:11-13` | "Both sides are resolved before either is judged, so the caller cannot learn which of the two ids was the problem" | 4 | removed (see note 1) |
| `server/src/database/types.ts:2` | "view of 001_initial_wallet_schema.sql" | 4 | the schema `db/migrations/` builds |
| `server/src/database/types.ts:208` | "Bookkeeping for the SQL migration runner" on `interface DB` | 4 | removed |
| `server/src/accounts/balance.service.ts:216-217` | "cancelled included" | 4 | deleted |
| `server/src/config/env.ts:55` | "Where the SQL migration runner looks" | 4 | says it is unused |
| `server/src/wallets/require-wallet-role.guard.ts:61-63` | "routes where walletId is optional (GET /accounts…)" (that route isn't guarded) | 4 | first sentence kept |
| `server/src/wallets/wallets.module.ts:17-19` | "imported here … purely so … resolves it" | 4 | resolves through WalletAccessModule's exports |
| `server/src/transactions/transaction-category.ts:39` | "(BR-06)" for the always-has-a-category rule | 4 | `chk_transaction_shape` (migration 005) |
| `server/src/auth/auth-rate-limit.guard.ts:2` | "Per-IP" (the key is IP plus path) | 4 | "Per-IP, per-route" |
| `server/src/app.module.ts:31-34` | "Nest runs them in registration order, so JwtAuthGuard … runs before any route-level guard" | 4 | the guard order comes from scope; the interceptor order comes from registration |
| `server/src/wallets/wallets.controller.ts:59-61` | "transferOwnershipSchema … belongs in contracts; noted rather than silently duplicated" | 5 | removed; tracked under Follow-ups |
| `server/src/dashboard/dashboard.service.ts:266` | "Last 10 transactions" | 7 | names `RECENT_TRANSACTIONS_LIMIT` |
| `server/src/exchange-rate/exchange-rate.service.ts:140`, `:272` | "Check database snapshot table", "Collect all foreign currencies…" | 1 | removed |
| `server/test/routes.test.ts:14-19`, `:105-107` | "22 endpoints answered 404 while parity reported 31/31", "the failure that hid for a whole feature set" | J | the why kept; the history dropped |
| `mobile/src/app/navigation/types.ts:21-22`, `:25-27` | "a transaction's detail is opened from Home, Transactions AND a budget/goal detail"; "AccountDetail linking to Transactions" (a stack route, not a tab) | 4 | the real multi-entry routes; the example dropped |
| `mobile/src/app/navigation/tabBarMetrics.ts:1-6` | "(the Home FAB)" (only MainTabNavigator imports it) | 4 | 2 lines: why it lives outside the navigator |
| `RootNavigator.tsx:12`, `AuthProvider.tsx:22` | "a blank screen" / "render nothing" (it renders an ActivityIndicator) | 4 | spinner |
| `mobile/src/app/store/api/transactionsApi.ts:152`, `:199` | "Offline `enqueueOffline` cannot itself reject" (the catch is for `queryFulfilled`) | 4 | the wording every other slice uses |
| `mobile/src/app/i18n/locales/vi.ts:3` | "checked by i18n/index.ts's dev-mode assertion" (a warn that catches extra keys only) | 4 | `TranslationResource` + `localeParity.test.ts` |
| `mobile/src/app/i18n/index.ts:20-28` | "temporarily disabled per user request" + 8 commented imports | 2 | removed (rule 13 is the record) |
| `PlanningScreen.tsx:258` | "Matches the Accounts and Dashboard tabs" (Dashboard uses other keys) | 4 | Accounts only |
| `CategoryGrid.tsx:28-31` | "for the add-transaction screen" (also the budget and contribution sheets) | 4, 3 | caller-neutral, 2 lines |
| `WalletContextBar.tsx:10-11`, `:36` | "the row Home already does"; "MainTabNavigator has `headerShown: false`" | 3, 4 | caller-neutral; see note 2 |
| `DashboardScreen.tsx:140-142` | "the same two-query shape … already used, now driven by…" | J | first sentence kept |
| `useGoogleSignIn.ts:8-9` | "Untestable in this environment" | J | removed; `GAPS.md` is the pointer |
| `AppNavigator.tsx:24`, `env.ts:2`, `MainTabNavigator.tsx:150`, `DashboardKpis.tsx:20`, `DashboardEmpty.tsx:19`, `CategoryListScreen.tsx:241-243` | restating lead lines | 1 | removed, or cut to the spec reference |
| `ThemeProvider.tsx:76` | "~90-call-site re-render" (111 today) | 7 | count dropped |
| `ProgressBar.tsx:6` | "above 100 render as a full, danger-coloured bar" (danger comes from its own prop) | 4 | caps at full width |
| `ProgressBar.tsx:15` | "(CLAUDE.md: "you are 400,000 over"…)" (the quote is in SRS.md FR-40) | 4 | SRS FR-40 |
| `guestWallets.ts:4` | "(HANDOFF.md)" (no such file) | 4 | reference dropped |
| `guestStore.ts:6` | "MB-02's "don't mirror API data into Zustand"" | 4 | MB-02's no-mirroring rule |
| `guestStore.ts:249-252` | two stacked JSDoc blocks on `hydrate()`, the first one shadowed | 6 | merged; the caller names dropped |
| `secureStore.ts:5`, `groupByDate.ts:2`, `transactionForm.ts:4`, `optimisticRecords.ts:7` | "plan §6/§13/§12", "§ UI" (no such sections) | 4 | MB-04 / dropped |
| `offlineQueueTypes.ts:32` | "(BR — no duplicate money movement)" | 4 | the rule stated in plain words |
| `optimisticMutation.ts:1-9` | "the first use of `onQueryStarted`… written once instead of five times" (no production caller) | 4, 7, J | 2 lines of role only; dead code flagged below |
| `syncEngineRuntime.ts:100` | "For pull-to-refresh and the banner's "Try again"" (neither one calls it) | 4 | the sync status's "Try again" |
| `TransactionRow.tsx:20` | "shared by Home's timeline and the Transactions list" | 4, 3 | caller names dropped |
| `offlineQueueDb.ts:214` | "Web fallback when SQLite … is unavailable" (it is used for every web build) | 4 | the web build's queue, with the reason kept |
| `ListItemEnter.tsx:5-7` | "`entering`/`layout` props fire this exactly once" (`layout` animates every change) | 4 | `entering` only |
| `KeyboardDockProvider.tsx:43`, `:64` | "(the original bug here)", "which is why this only showed up on web" | J | removed |
| `client.ts:86` | "each of the fifty call sites" | 7 | count dropped |
| `ConfirmDialog.tsx:48-52` | "slide-up spring bounce physics, zero-gap bottom anchoring…" | 8 | 1 line: built on `BottomSheetModal` |

Notes:
1. `requireAccountsWritable` checks accounts in order and throws on the first failure, so the comment's non-disclosure claim was false. Nothing leaks beyond AC-01, because each account is still judged 404-vs-403 on its own membership. No spec text makes the claim (`grep` over `docs/`, SRS, SDS and CLAUDE.md).
2. `TransactionsScreen` is a stack screen whose header is shown (`AppNavigator.tsx:47`), and it also renders `WalletContextBar`, which pads `insets.top`. That is a possible double inset, flagged below.

Comments added:
- `contracts/src/schemas.ts:274-275`: why `.innerType()` needs the own-accounts check repeated in `superRefine`. Source: the discriminated union accepts plain objects only, and the `ZodEffects` refine is dropped, as seen at `schemas.ts:257-270`.
- `ci.yml:227`: the E2E `EXCHANGE_RATE_API_URL` is unreachable on purpose. Source: this job's own design (`2026-09-25-e2e-and-follow-ups-double-check.md`) and the no-consequential-external-calls rule.

Kept deliberately:
- The pattern-6 multi-line blocks all four agents listed (more than 150 blocks, mostly file headers and service docblocks). Their reasoning is sound and current, and the `2026-09-12` and `2026-09-21` passes kept them. Condensing them all is churn, not a fix.
- Any comment an agent listed as low-confidence or borderline, for example `DashboardKpis.tsx:15` and `MoneyInput.tsx:39-40`.
- Test-name strings (code, not comments): `calc.test.ts:67`, `:201`, `:210`, `:240`, `:357`, `money.test.ts:167`.

Flagged, not fixed:
- **F1:** the BR-xx ids in code follow CLAUDE.md, but SRS.md §4 numbers the same rules differently (BR-04 transfer, BR-08 immutability, BR-13 per-currency). A reader checking SRS will find `calc.ts:108/164/197`, `schemas.ts:263`, `responses.ts:420/448`, `calc.test.ts:231/297/366` and `005_transfer_categories.sql:5` all "wrong".
- **F1:** bare "rule N" and "§N" pointers name no document (`dashboardAnalytics.ts:8`, `WaterfallChart.tsx:11`, `pendingTotals.ts:5`, guest `§` refs, `integration.ts:8` "rule 8"). They all resolve today.
- **F2:**
  - "AuditService and DatabaseService are @Global" appears in 6 server modules;
  - the `dayAfter` helper and its doc are copied in `audit.service.ts` and `transactions.service.ts`;
  - "Nothing was applied to the cache yet" appears ×12 across the api slices;
  - the rule-15 `style` note appears ×6;
  - "native animated module doesn't exist on web" appears ×3;
  - the "Relative, not `@/utils`" note appears ×3;
  - the idempotency-key note appears in `goals.ts`/`transactions.ts`/`client.ts`.
- **Immutable migrations (report only):**
  - `001:99-101` says the index guarantees exactly one owner, but it only prevents a second;
  - `001:161-162` is history wording;
  - line 1 of each migration repeats its filename;
  - `001:188-189` has no comment explaining the COALESCE.
- **Gaps, reason not recoverable, no comment invented:**
  - `DashboardScreen.tsx:48-56`: a fixed 500 ms sleep after invalidating;
  - the `>= 5` and `>= 1` change thresholds (`DashboardScreen.tsx:414`, `CategoryBreakdown.tsx:177`);
  - `store/index.ts:16-21` `warnAfter: 128`;
  - `BottomSheetModal.tsx:62`: the 600 fallback;
  - `syncEngine.ts:88-93`: why a 404 is parked as a conflict;
  - `auth-rate-limit.guard.ts:27`: why the bucket is per route against §2.9's per-IP;
  - `exchange-rate.service.ts:114`: why the snapshot write isn't awaited.

## Fixes Applied

- Every edit listed above is comment-only (proof in Method). The one code line: `packages/contracts/test/calc.test.ts` `inAugust()` now sets `currency: 'VND'`.
  - Before, the three tests using it passed because the missing currency failed `calculateBudgetSpent`'s currency filter, not because of the rules they name (BR-06, other category).
  - The test tsconfig didn't catch it: `packages/contracts/tsconfig.json` includes only `src/**`.
- Re-verified:
  - `npm run typecheck` → exit 0, 0 `error TS`;
  - contracts 114/114;
  - parity 31/31;
  - mobile 528/528, 0 todo;
  - server 34/34. The integration suites need `DATABASE_URL` and didn't run; the server diff is comments only.

## Follow-ups

**Code issues seen during the sweep (not fixed in this comment pass):**
- `server/src/auth/token.service.ts:85`: `hashesMatch` has no callers.
- `require-wallet-role.guard.ts:29`: `WALLET_ACCESS_KEY` is written and never read.
- `wallets.module.ts:8`: the `RequireWalletRoleGuard` import is unused.
- `transactions.service.ts:345-347`: the TRANSFER_CURRENCY_MISMATCH branch looks unreachable after the per-account check at 338-340.
- `server/src/config/env.ts:56` / `.env.example`: `MIGRATIONS_DIR` is validated but read by nothing. Wire it into `migrate.mjs` or remove it; CLAUDE.md Part 6 lists it.
- `transferOwnershipSchema` belongs in `@sora/contracts` (§7.4) once the app posts it. This was the untracked note removed from `wallets.controller.ts`; `mobile/src/services/api/members.ts:14` says the same.
- `mobile/src/services/sync/optimisticMutation.ts`: `runOptimisticMutation` has no production caller. `services/{sync,guest}/index.ts` re-export `testSupport.ts` through production barrels.
- `mobile/src/app/providers/ThemeProvider.tsx:40-50`: the injected web CSS looks malformed. `hydratedFromCache` is written and never read.
- `GuestUploadScreen.tsx:106`: the list-error retry clears the error without refetching. `Loader2` is unused.
- `TransactionDetailModal.tsx:16`: `onEdit` is never passed, so Edit never renders.
- `.slice(0, 10)` on ISO instants takes the UTC date, in `TransactionDetailModal.tsx:136/142`, `GoalDetailScreen.tsx:144` and `WalletMembersScreen.tsx:294`. It is a likely timezone bug; `dayOfInstant` exists.
- `MemberSplit.tsx:28-30`: it relies on the server's sort order and divides across currencies.
- `StateView.tsx:216-229`: `CONNECTIVITY_WORDS` matches English text only, and includes the bare "connection" that `utils/errors.ts:47-50` deliberately avoids.
- `WalletContextBar` inside the headed `Transactions` stack screen: possible double top inset.
- The `name === 'Guest Wallet'` literal is tied to `guestSeed.ts:38` in 4 places.
- `QueryProvider` / `@tanstack/react-query`: its retry and clear-order comments describe a cache nothing populates (MB-02 calls it reserved).
- `contrast.test.ts:8-13` hard-codes the category colours instead of importing `starter-categories.ts`.
- `ci.yml:44`: the moderate-advisory claim can't be checked without `npm audit`.

**Carried forward:** extract the three Refreshable* lists' shared overscroll props (`2026-09-24-comment-audit.md`).
