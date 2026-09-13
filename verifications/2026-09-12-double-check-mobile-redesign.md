# Double-check: mobile redesign in-flight diff — one live money bug fixed, one navigation inconsistency fixed, one agent claim disproved

**Date:** 2026-09-12T16:44:26Z
**Method:** double-check skill (Phase 1 delegated to two parallel scan agents — mobile-diff quality
sweep, cross-layer/money-handling sweep — every finding re-verified against the live files by hand
before acting, per the skill's own instruction; Phase 2 run directly)
**Verdict:** PASS (fixes applied and re-verified; no regressions)
**Scope:** Broad, per the user's request — the whole uncommitted working tree, weighted toward
`mobile/`'s large in-progress redesign (75 modified + ~35 new untracked files) since that's where
essentially all current changes live. `packages/contracts/` and the two touched server controllers
were in scope too.
**Files touched:** [packages/contracts/src/schemas.ts:29,47-64,67-80](../packages/contracts/src/schemas.ts#L29-L80),
[mobile/src/features/budgets/screens/BudgetsScreen.tsx:6,8,19,53](../mobile/src/features/budgets/screens/BudgetsScreen.tsx#L6-L53)
**Related reports:** [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md) (run immediately before
this pass, same session — carries the architectural-level findings this pass deliberately did not
re-litigate: the RTK-Query-vs-MB-02 migration, dead NativeWind config, orphaned `webpage/` files,
root-level stray docs), [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md)

## Method

Two Phase-1 scan agents in parallel, told to cite `file:line` and not re-derive what the prior
infra-audit pass already covered: (1) mobile-diff sweep for dead code, duplicated logic, dangling
references, and CLAUDE.md rule violations in the new/changed screens; (2) cross-layer sweep on the
money-handling helpers added this session (`stripCurrencyInput`/`formatCurrencyInput`), the new
`LOCALES`/pagination constants, and a repo-wide grep for `Number(amount)`/raw `.toLocaleString()`.
Every finding from both agents was independently re-verified against the live files before any fix —
one claim did not survive that check (Finding 3 below).

Phase 2 commands run directly, after the fixes:

```
npm run build -w @sora/contracts                    # clean
npm test -w @sora/contracts                          # 63/63 pass
npm run typecheck -w @sora/server                    # clean
npm run typecheck -w @sora/mobile                    # clean
node scripts/check-contract-parity.mjs               # 31/31 PASS
npm test -w @sora/server                             # 3/3 pass
```

Plus a direct manual check against the built schema (see Finding 1) to confirm the fix, not just
the absence of a type error.

## Findings

### 1. BUG (fixed) — comma-formatted money input was rejected by validation for any amount ≥ 1,000

`packages/contracts/src/money.ts:89-104` defines a matched pair: `formatCurrencyInput` (adds
thousands-separator commas for display) and `stripCurrencyInput` (reverses it). Only the first half
was wired up: `mobile/src/components/Input.tsx:10,44,46` calls `formatCurrencyInput` on every
keystroke for `decimal-pad`/`numeric` fields and forwards the **comma-formatted** string to the
caller's `onChangeText` — which is the shared `Input` component used by every amount field across
transactions, budgets, goals, contributions, and account opening balances. `stripCurrencyInput` had
**zero call sites anywhere** (`grep -rn "stripCurrencyInput" mobile/src packages/contracts/src` — one
hit, its own definition).

That comma-laden string flows unmodified into `positiveAmountSchema`/`signedAmountSchema`
(`packages/contracts/src/schemas.ts:47-80`), which call `parseMoney()` — whose `MONEY_PATTERN`
(`money.ts:25`) is `/^-?\d{1,15}(\.\d{1,4})?$/` and rejects commas outright. Traced one full path:
`AddTransactionModal.tsx` → `validateDraft()` (`mobile/src/utils/transactionForm.ts`) →
`createTransactionSchema.safeParse` → `positiveAmountSchema` → `parseMoney` throws `MoneyError` →
rejected. Any transaction, budget, goal target, contribution, or opening balance of 1,000 or more in
its currency's minor-unit-free form (i.e. almost any real amount) failed validation. This is exactly
the class of bug CLAUDE.md's Part 7 rule 1 exists to prevent, on the input side rather than the
storage side.

**Fix**: `packages/contracts/src/schemas.ts:29,47-64,67-80` — both amount schemas now strip commas
(`stripCurrencyInput`) before calling `parseMoney`, and return the *stripped* string rather than the
original value, so a comma never reaches the database as text either. Fixed at the shared-contract
layer (not per-screen) because both sides validate with the same object per VL-01, and every
money-input screen goes through the same `Input` component.

**Re-verified**: rebuilt `@sora/contracts`, then called the built schema directly —
`positiveAmountSchema.safeParse('1,000.50')` → `"1000.50"` (previously a rejected `MoneyError`);
`signedAmountSchema.safeParse('-2,500,000')` → `"-2500000"`; a plain `'500'` (no commas) still
parses unchanged, confirming no regression for already-valid input. `npm test -w @sora/contracts`
63/63 pass (unchanged count — no existing test exercised the comma path, which is itself worth
noting as a coverage gap, see Follow-ups).

### 2. Inconsistency (fixed) — Budgets was the one entity still on the old navigation-based add flow

Per the infra-audit's Finding 1, the app is mid-migration from route-based `Add*Screen`s to a
`ModalProvider`-driven `openModal()` flow. Every other entity has moved:
`HomeScreen.tsx:15`/`TransactionsScreen.tsx:16` → `openModal('AddTransaction')`,
`TransactionDetailScreen.tsx:93` → `openModal('EditTransaction', …)`,
`AccountsScreen.tsx:114,131` → `openModal('AddAccount', …)`, `GoalsScreen.tsx:55` →
`openModal('AddGoal')`, `GoalDetailScreen.tsx:68` → `openModal('AddContribution', …)`. Only
`BudgetsScreen.tsx:53` still called `navigation.navigate('AddBudget')` — the old screen-route path —
even though `AddBudgetModal.tsx` already exists and is already mounted in `ModalProvider.tsx:71-74`.
Both paths technically worked (the `AddBudget` stack route is still registered in
`AppNavigator.tsx:63`), but it's the one place the redesign was left half-done, and CLAUDE.md's
double-check Phase 1 item 11 calls out exactly this shape ("one feature follows pattern A, another
follows pattern B").

**Fix**: `BudgetsScreen.tsx:6,8,19,53` — imports `useModal`, calls `openModal('AddBudget')` in place
of the `navigation.navigate` call, matching every other entity's empty-state CTA.

**Re-verified**: `npm run typecheck -w @sora/mobile` clean (confirms the `ModalType` union already
included `'AddBudget'`, so no type change was needed elsewhere).

### 3. Claim investigated and disproved — `ModalProvider` is, in fact, mounted

One scan agent reported that `ModalProvider` was built but never mounted anywhere in the app, and
that the six screens calling `useModal()` would throw at runtime. Checked directly against the live
files rather than taken on the agent's word (per the skill's own "verify against the live repo
before fixing" instruction): `mobile/src/app/navigation/AppNavigator.tsx:21,41,70` imports
`ModalProvider` and wraps its entire `Stack.Navigator` (including `MainTabNavigator`, which every
`useModal()`-calling screen renders under) in it. The chain is `RootNavigator.tsx:35-37` →
`WalletProvider` → `AppNavigator` → `ModalProvider` → the stack. The agent's search evidently only
checked `App.tsx` and `providers/index.ts` (where `ModalProvider` genuinely is *not* exported/mounted)
and missed that it's mounted one level down, inside the navigator itself. Recording this because the
value of a double-check is in findings being verified, not relayed — this one would have sent a
"crash on every add/edit tap" claim into the record incorrectly.

### 4. Checked and clean

- **Dangling references** — no import anywhere in `mobile/src` points at a deleted hook file; the 8
  empty leftover `features/*/hooks/` directories (noted in the infra-audit) are empty, not dangling.
- **MB-01 (`any`)** — zero `: any` in `mobile/src`.
- **MB-04 (secure token storage)** — `AsyncStorage` use is confined to `preferencesStore.ts` and
  guest storage, both non-secret and both already commented as to why; tokens go through
  `secureStore.ts`.
- **MB-08 (money never `Number()`/raw `toLocaleString`)** — zero violating hits in `mobile/src` or
  `server/src`; all `Number(` hits are non-money (dates, env parsing, percentages) or confined to the
  out-of-scope `webpage/` package.
- **`LOCALES` parity** — `packages/contracts/src/enums.ts`'s 10-entry list matches
  `mobile/src/app/i18n/index.ts`'s registered locales exactly, same order.
- **Pagination constants** — `goals.controller.ts`/`wallets.controller.ts` and
  `schemas.ts`'s `transactionQuerySchema` all reference the new `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`
  consistently. (Accounts/categories/budgets controllers still have no pagination at all — a
  pre-existing gap, not a regression from this change; carried to Follow-ups.)
- **Contract parity** — 31/31, unaffected by the schema edit (the script checks enum/route/error-code
  agreement, not amount-parsing logic).

## Fixes Applied

1. [packages/contracts/src/schemas.ts:29,47-64,67-80](../packages/contracts/src/schemas.ts#L29-L80) —
   strip thousands-separator commas before `parseMoney`, return the stripped string. Re-verified:
   direct schema call on comma input now succeeds; `npm test -w @sora/contracts` 63/63; parity 31/31.
2. [mobile/src/features/budgets/screens/BudgetsScreen.tsx:6,8,19,53](../mobile/src/features/budgets/screens/BudgetsScreen.tsx#L6-L53) —
   switch the empty-state "new budget" CTA from `navigation.navigate('AddBudget')` to
   `openModal('AddBudget')`, matching every other entity's add flow. Re-verified: `npm run typecheck
   -w @sora/mobile` clean.

Regression check after both: `typecheck -w @sora/server` clean, `typecheck -w @sora/mobile` clean,
`check-contract-parity.mjs` 31/31, `@sora/contracts` 63/63, `@sora/server` 3/3.

## Follow-ups

Not started this pass — carried forward, in addition to everything already listed in
[2026-09-12-infra-audit.md](2026-09-12-infra-audit.md)'s Follow-ups (the RTK-Query/MB-02 decision,
NativeWind adoption decision, `webpage/` parked-but-active question, stray root docs):

- **No test covers the comma-input path** that Finding 1 fixed — `stripCurrencyInput` and the two
  amount schemas' new normalization step have no dedicated test. Worth a couple of cases in
  `packages/contracts/test/money.test.ts` (or a schema-level test) asserting `"1,000.50"` and
  `"-2,500,000"` parse correctly, so a future edit to either function can't silently reopen this.
- **MB-03 violation across ~6 screens**: `AddBudgetScreen.tsx`, `AddGoalScreen.tsx`,
  `AddAccountScreen.tsx`, `AddContributionScreen.tsx`, `AddTransactionScreen.tsx`,
  `InviteMemberScreen.tsx` hand-roll `useState` + manual `try/catch` instead of React Hook Form + the
  Zod schema from `@sora/contracts`, unlike `LoginScreen.tsx`/`RegisterScreen.tsx`. Not fixed this
  pass — six screens' worth of form rewiring is beyond a double-check-sized change; flagging for a
  dedicated pass.
- **Hardcoded `'VND'` currency fallback** repeated across ~10 call sites
  (`AddAccountScreen.tsx:23`, `AddAccountModal.tsx:27,35`, `AddBudgetScreen.tsx:53`,
  `AddBudgetModal.tsx:68`, `AddGoalScreen.tsx:35`, `AddGoalModal.tsx:47`,
  `AddContributionModal.tsx:65`, `AddContributionScreen.tsx:50`, `RegisterScreen.tsx:40`) with no
  single `DEFAULT_CURRENCY` constant in `@sora/contracts` to centralize it against.
- Accounts/categories/budgets controllers still have no pagination (pre-existing API-05 gap,
  unrelated to this session's changes).
