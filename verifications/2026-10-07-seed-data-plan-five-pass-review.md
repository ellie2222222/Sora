# Seed-data plan: five review passes, each with its own lens

**Date:** 2026-10-07T07:12:53Z (pass 1 start; same session)
**Method:** ad hoc. Five read-only review agents ran in sequence, each with one lens. Every finding was re-checked by hand against the code before the plan was edited, and each pass reviewed the plan as the previous pass left it
**Verdict:** PASS after fixes (docs-only; the plan is still not implemented, so nothing to run)
**Scope:** `plans/tooling/seed-data-plan.md`, after the user said the first review today missed too many details
**Files touched:** `plans/tooling/seed-data-plan.md`
**Related reports:** 2026-10-07-seed-data-plan-final-review.md (supersedes its "PASS"), 2026-10-06-double-check-seed-data-plan.md

## Method

| Pass | Lens | Findings | Confirmed by hand |
|---|---|---|---|
| 1 | API request and response shapes | 12 | `responses.ts:474-481`, `calc.ts:191-198,255-262`, `goal-contributions.service.ts:116-121,221`, `budgets.service.ts:87-96`, `invitations`/`wallets.controller.ts:72`, `categories.service.ts:184,262,467`, `account-write-lock.ts:59` |
| 2 | Roles, write order, state preconditions | 10, plus 1 timing contradiction | `transactions.service.ts:456,524-566,584`, `schemas.ts:356-372`, `transaction-category.ts:34-36`, `idempotency.interceptor.ts:51-63`, `responses.ts:81,89` |
| 3 | Arithmetic and internal consistency | 20 | `node -e` weekday and percentage checks (output below); the agent's Monte-Carlo of An's year in the scratchpad |
| 4 | Calendar and derived values, run against `packages/contracts` | 10 | `calendar.ts:113`, `PlanningScreen.tsx:62,67`, `dashboard.service.ts:251,472`, `goal-contributions.service.ts:147`; `overdue` in `mobile/src`: 0 hits |
| 5 | Tooling feasibility and whole-document coherence | 21 | `probe-data.ts:27-33`, `starter-categories.ts:70-71`, `responses.ts:324`, `calc.ts:182-183`, `health.controller.ts:31`, `plans/README.md:50`, `mobile/e2e/README.md:21-26`, `tsconfig.base.json` |

Hand checks (`node -e`):
- 2026-10-06 is a Tuesday; 2025-10-06 a Monday; 2026-02-07 a Saturday; 2026-10-04 a Sunday.
- Old Weekend Dining = 1,030,000 a week (103% of 1M); new = 647,500 (≈ 93% of 700k).
- Vietcombank's monthly outflow ≈ 29.3M against a 28M salary.
- Travel 39.4M / 65M ≈ 61%; Japan GOAL 21.5M / 30M ≈ 72%; Motorbike 35.7M ≈ 102%; Mom's Market ≈ 2.77M a month, ≈ 241 rows.

## Findings

Each item was wrong, missing or inconsistent in the plan. Grouped:

- **API semantics:**
  - `transferredIn`/`transferredOut` count only cross-wallet transfers.
  - `progressPercentage` caps at 100.
  - No overdue or pace field exists.
  - A transaction-backed contribution needs an EXPENSE `categoryId`.
  - Removing a contribution deletes its row outright.
  - Budgets are read at the server's real date unless `activeOn` is passed.
  - The invitation token is returned once, and the invitation expires in 7 days.
  - `CATEGORY_IN_USE` blocks archiving a budgeted category.
  - `ACCOUNT_ARCHIVED` applies only to creates and money-moving edits.
  - The state-change routes and the `memberId` were unnamed.
- **`relationLabel`:** the owner sets it at invite. The plan's "Son" and "Daughter" fit neither reading. Product contradiction: `schemas.ts` and `WalletSwitcher.tsx` treat it as the invitee's name for the wallet; SRS FR-11 and the invite prompt treat it as the inviter's word for the person.
- **Roles:**
  - Corrections must use a token with `EDITOR` on every wallet the row names.
  - Corrections must skip contribution-backed and goal-tagged rows.
  - Categories are per wallet (`CATEGORY_WRONG_WALLET`).
  - A Linh-wallet expense debits Linh.
  - An contributes to Linh's goal only from BIDV.
  - The EXPENSE → TRANSFER PATCH needs `toAccountId`.
  - `verify.ts` needs a member's token per wallet.
  - Phase 1 invite/accept order.
  - Idempotency keys.
  - A JPY expense was dated before the trip.
- **Numbers:**
  - Vietcombank went negative (−6.5M in month 1, −44M by Sep).
  - The refill-after-spend rule failed.
  - Mom's Cash drained.
  - Weekend Dining, Monthly Cap, Travel 2026, 11.11 and the Japan GOAL budget expectations were all off.
  - Food's Tet surge was unquantified.
  - Volumes were underestimated (An ≈ 1,500, not 1,300; Linh was 2× her stated count at 0.6×).
  - The "at anchor" column didn't hold for weekly and Bills budgets.
  - The Motorbike schedule was missing.
  - The coffee range contradicted §1.6.
  - The Japan date contradicted the 30-day future rule.
  - An paid two rents.
  - The Tet bonus fell on a Saturday.
  - The yearly-budget start sentence was wrong.
  - Course amounts were missing.
- **Calendar:**
  - `SEED_ANCHOR` doesn't reproduce screenshots.
  - The default anchor must be the wallet-zone today.
  - Anchor-day rows came after the run instant.
  - Create responses read at the real date.
  - The zero-spent reading wasn't stable.
  - The midnight rows' type wasn't pinned.
  - `zonedInstant`, not `withDay`.
  - JPY appears only in `totalBalance`.
  - The app hides COMPLETED/CANCELLED goals and has no overdue state.
  - The courses' dates were missing.
- **Tooling and coherence:**
  - `probe-data.ts` can't be reused beyond its types.
  - Loopback isn't the same as disposable (`/health` hides the database).
  - `SEED_API_URL` prefix.
  - Passwords and `runId` must come from crypto.
  - Ids weren't persisted, and the post-step's Data Safety handling.
  - No typecheck covers `scripts/`, and Node is strip-only.
  - Phase-7 doc list.
  - Refresh cadence.
  - The stale "Assumption" line.
  - Determinism vs the anchor-day cut.
  - Phases 3–5 need one in-memory ledger.
  - Settle Up direction.
  - `displayName` must be the first name.
  - Starters are resolved by `systemKey`.
  - Linh's rows per week.
  - Budget start dates.
  - Earmark funding accounts.
  - "Newest goal" ordering.
  - 11.11 was "over" only by chance (`spent > amount`).
  - Undefined hotel pre-authorization.
  - Audit dates.

Checked and still correct across passes: the route paths, the register/invite/account/category/transaction/goal/budget bodies, role minimums, rate limits, `ACCOUNT_LAST_ACTIVE`, the WEEKLY windows following the start weekday, the Bills windows clamping (09-30 → 10-30 at the anchor), `spent` rules (COMPLETED EXPENSE, per currency, any-depth roll-up, goal-tagged counted in both), balance and goal derivations, the `@sora/contracts` import from `scripts/` on Node 24 (scratch run, exit 0), `.env.*` ignored, 38 starters and 37 icons, every `§` reference.

## Fixes Applied

All in `plans/tooling/seed-data-plan.md`:
- §1.1–§1.4: guard, output, crypto ids, typecheck, write-order routes, refresh cadence.
- §1.5–§1.6: anchor rules, `zonedInstant`, pinned midnight rows, the non-negative rule.
- §2–§4: labels, `displayName`, `systemKey`, House Share, the Shared House story.
- §3: balances.
- §5: refill-before-spend, rebalanced habits and events, corrections-pass rules.
- §6: goal schedules and earmarks; budget amounts and expectations.
- §7: per-wallet tokens, transfer semantics, `activeOn` readings, per-field currencies, app limits.
- §8: audit dates and the opt-in backdating script.
- §10: the in-memory ledger, phase-1 order, phase-7 docs.

Re-check: grep for every replaced value or phrase ("0.6×", "18,500,000", "~720k", "ramen", "on track", "Assumption", "previous Sunday", "runs last", "withDay", and others) finds only Linh's legitimate 20,000,000 goal target. `§` references all resolve.

## Follow-ups

- Product question, not plan scope: what `relationLabel` means (the invitee's wallet name, per `schemas.ts:178` and `WalletSwitcher.tsx:59`, or the inviter's word for the person, per SRS FR-11 and the `howDoYouKnow` prompt). The plan follows the code.
- The plan's numbers rest on expected values and the pass-3 simulation. The generator's own checks (non-negative balances, earmarks) are what will prove them on a real run.
- Still Draft and not implemented: phases 1–7.
