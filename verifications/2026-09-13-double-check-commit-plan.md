# Double-check: the commit-messages draft plan, against ~30 files that changed since it was drafted

**Date:** 2026-09-13T17:59:00Z
**Method:** double-check skill, scoped to the user-named target (`/commit-messages`) — i.e. re-verifying
the grouped commit plan drafted in this session against the repo's current state, not a fresh feature
**Verdict:** PASS (plan refreshed; no code regression; one new design-consistency finding, flagged not fixed)
**Scope:** The full uncommitted working tree (143 changed/untracked entries), re-diffed against the
commit-plan draft from earlier this session. ~30 files changed on disk since that draft was written —
two flagged directly by the harness (`BudgetsScreen.tsx`, `schemas.ts`) plus `packages/contracts/src/{enums,calc}.ts`,
`mobile/src/utils/{derive,money,transactionForm}.ts`, and all ten `mobile/src/services/guest/*.ts` files.
**Files touched:** none — this pass is a plan refresh + verification, not a code change.
**Related reports:** [2026-09-12-infra-audit.md](2026-09-12-infra-audit.md),
[2026-09-12-double-check-mobile-redesign.md](2026-09-12-double-check-mobile-redesign.md),
[2026-09-12-comment-audit.md](2026-09-12-comment-audit.md), [2026-09-12-clean-up-comments.md](2026-09-12-clean-up-comments.md)
(this session's four prior passes; the commit plan under review here follows all four)

## Method

`git status --short` re-run in full (143 entries, up from ~140 when the draft was written) and diffed
against the draft's file groupings. Every file the harness flagged as changed, plus every file that
diff revealed wasn't in the original snapshot, was read via `git diff` to characterize the actual change
— not assumed from the filename. Then Phase 2: rebuilt `@sora/contracts`, typechecked `@sora/server` and
`@sora/mobile`, ran the contracts test suite, the parity check, and the server test suite, to confirm the
two days of additional drift introduced no regression before re-presenting the plan.

## Findings

### 1. A real, repo-wide enum refactor landed since the draft — not just cosmetic

`packages/contracts/src/enums.ts` now exports, for every domain enum (`WalletRole`, `MemberStatus`,
`WalletStatus`, `AccountType`, `AccountStatus`, `CategoryType`, `CategoryStatus`, `TransactionType`,
`TransactionStatus`, `BudgetPeriodType`, `BudgetStatus`, `GoalStatus`), a same-named `const` object
alongside the existing `type` alias (e.g. `export const TransactionType = { INCOME: 'INCOME', ... } as
const` next to `export type TransactionType = ...`) — a standard TS type/value-merge pattern giving
callers `TransactionType.INCOME` instead of the literal `'INCOME'`. Confirmed the runtime values are
identical to the string literals they replace, so every consumer this pulled in
(`packages/contracts/src/calc.ts`, `mobile/src/utils/{derive,money,transactionForm}.ts`, all ten
`mobile/src/services/guest/*.ts` files) is behaviorally unchanged — verified by typecheck + the full
test suite passing, not by inspection alone.

**Not accounted for in the original commit-plan draft**, which only knew about `enums.ts`'s
`LOCALES`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` additions. The plan is revised below.

### 2. One incidental correctness fix inside the "mechanical" refactor

`mobile/src/services/guest/guestTransactions.ts`'s `updateTransaction`: `transactionDate:
patch.transactionDate ?? existing.transactionDate` and `categoryId: patch.categoryId ?? existing.categoryId`
became `!== undefined ? patch.X : existing.X` — not just style. `??` treats an explicit `null` in the
patch the same as "field omitted," silently keeping the old value; `!== undefined` lets a caller
explicitly clear `categoryId` to `null`, matching the pattern the two neighboring fields
(`description`/`reference`) already used. A real (minor) bug fix riding along with the enum-style
changes, not something to split out — same file, same commit, per the skill's own guidance on
folding an incidental fix into its dominant change.

### 3. New finding, flagged not fixed — the enum-value style split between mobile and server

Adoption count via `grep -rl "<Enum>\."`: `TransactionType.` in 14 files, `TransactionStatus.` in 9,
`CategoryType.`/`CategoryStatus.`/`BudgetStatus.` in 5-9 each — all in `mobile/src` and
`packages/contracts/src`. **Zero** adoption in `server/src`: every controller/service there still
compares against raw string literals (`server/src/accounts/balance.service.ts:199-201`,
`server/src/transactions/transactions.service.ts:301-468`, `wallet-access.service.ts:124,218`, etc. —
grepped directly, not sampled). Not a bug (the enum objects' values are the same strings), but it's
exactly the "one side of a shared contract adopts a pattern, the other doesn't" shape double-check's
own Phase 1 item 11 calls out. Flagging as a follow-up rather than fixing: touching every server
service to match is a much larger, unrelated-to-today's-work change.

### 4. `mobile/src/utils/derive.ts` — still fully dead, now doubly maintained

The 2026-09-12 infra-audit already found `derive.ts` has zero importers anywhere (a second, unused copy
of `calc.ts`'s ledger math). Re-confirmed here: still zero references
(`grep -rn "from ['\"].*utils/derive"` — no hits). It was nonetheless updated to the new
`TransactionType.INCOME`-style comparisons in this pass of edits — effort spent keeping dead code in
sync with a refactor instead of deleting it. Reinforces, doesn't replace, the existing follow-up.

### 5. Verification — no regression from the additional drift

```
npm run build -w @sora/contracts        # clean
npm run typecheck -w @sora/server       # clean
npm run typecheck -w @sora/mobile       # clean
npm test -w @sora/contracts             # 63/63 pass
node scripts/check-contract-parity.mjs  # 31/31 PASS
npm test -w @sora/server                # 3/3 pass
```

### 6. This session's own earlier fixes, confirmed still intact

The harness's own change-notices for `BudgetsScreen.tsx` and `schemas.ts` were read in full: both still
carry this session's double-check fixes (the `openModal('AddBudget')` call, the `stripCurrencyInput`
normalization in `positiveAmountSchema`/`signedAmountSchema`) — the further edits made to these files
since (an `AnimatedScreen`/`renderContent()` refactor in `BudgetsScreen.tsx`; an added `TransactionType`
import in `schemas.ts`) are additive and don't touch either fix.

## Revised commit plan

Same 10 groups as before, with these changes: **Group 1** grows to absorb the enum-value refactor and
its consumers (moved out of Group 6, since they're a contracts-consumption change, not
redesign/RTK-Query wiring); everything else is unchanged.

**1. Contracts — add locale list, pagination constants and runtime enum-value objects; migrate
derivation/guest/form logic off string literals; fix comma-formatted amount validation**
`packages/contracts/src/{enums,money,schemas,calc}.ts`, `packages/contracts/test/money.test.ts`,
`mobile/src/utils/{derive,money,transactionForm}.ts`, all ten `mobile/src/services/guest/*.ts` files,
`server/src/{goals,wallets}.controller.ts`

**2-10.** Unchanged from the prior draft (verify-boot.ts comment fix; i18n locale expansion; design
tokens + NativeWind scaffolding; animation/state primitives; the RTK Query + ModalProvider redesign
commit — now without the utils/guest files, which moved to Group 1; webpage/ theming; this session's
four verification reports; the two carried-over 09-11 reports). The four flagged/unassigned items
(root scratch docs, `check_hardcoded.js`, CLAUDE.md's stale MB-02) still stand, unchanged.

## Fixes Applied

None — this is a plan refresh and a verification pass, not a code change.

## Follow-ups

- Carried forward from this session's infra-audit/double-check/comment-audit reports (RTK-vs-MB-02 doc
  drift, `webpage/`'s orphaned theme files, root scratch docs, `check_hardcoded.js`, `verify-boot.ts`).
- New: decide whether `server/src` should eventually adopt the same `TransactionType.X`-style enum
  values mobile/contracts now use (Finding 3) — cosmetic consistency, not a correctness issue.
- New: `mobile/src/utils/derive.ts` remains fully dead and was kept in sync with a refactor rather than
  deleted (Finding 4) — reinforces the existing delete-it follow-up.
