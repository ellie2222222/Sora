# Final review: seed-data plan against the code after the wallet time-zone change

**Date:** 2026-10-07T07:12:53Z
**Method:** ad hoc
**Verdict:** PASS after fixes (docs-only; the plan is still not implemented, so nothing to run)
**Scope:** `plans/tooling/seed-data-plan.md`. The previous review (06:57Z on 10-06) predates the wallet time-zone change (08:35Z), so this pass checks what that change, and the uncommitted contract and server edits since, could have broken
**Files touched:** `plans/tooling/seed-data-plan.md`
**Related reports:** 2026-10-06-double-check-seed-data-plan.md (follows up), 2026-10-06-wallet-time-zone.md

## Method

- `git log --since=2026-10-06T06:57:00Z` → no commits; `git status` → contracts, server and schema changes are uncommitted, so they were read from the working tree.
- Read `packages/contracts/src/schemas.ts:100-180` (auth, wallets) and `:270-350`, `:395-480` (transactions, budgets, goals, contributions).
- Starter names: the 26 names the plan cites, matched against `starter-categories.ts` (38 `key:` entries).
- Icons: keys parsed from `mobile/src/utils/categoryIcons.ts` and diffed against the 11 icons the plan uses.
- Grep: `probe-data.ts` (`registerProbeUser`), `wallets.controller.ts:60,67` (status defaults), `responses.ts` (dashboard fields), `env.ts:49` (rate limit), `budgets.service.ts` (GOAL rules) and the server's day logic (`dayRange`, `budgetWindow`, `AT TIME ZONE`).
- Confirmed the API spec sections the plan cites exist: §2.11, §5.1, §12.2, §13.5.

## Findings

Wrong in the plan (FAIL, all fixed):

1. **`timeZone` is now required** by `registerSchema` (`schemas.ts:131`) and `createWalletSchema` (`:164`), and `timeZoneSchema` rejects fixed offsets. The plan registers four personas and creates Mom's Wallet and Shared House 2025 without one, so every one of those requests would get a `422`. (`probe-data.ts:31` already sends `'Asia/Ho_Chi_Minh'`.)
2. **§1.2/§1.5 built local times by hand-writing `+07:00`.** Rule 18 says an instant becomes a wallet day only through `packages/contracts/src/calendar.ts`. `withDay`, `dayOfInstant` and `dayRange` are exported there (`:93,147,152`, re-exported from `index.ts`).
3. **Verify item 2 didn't check the time zone.** §1.5's 00:10-on-the-1st entry is meant to test the day rule, but no item asserted where it lands, or `period.timeZone` (`responses.ts:468`).

Checked, still correct:
- 38 starters; all 26 cited names present.
- All 11 plan icons are among the 37 keys.
- Members filter by `status` and wallets list defaults to `ACTIVE`, so `?status=REVOKED`/`ARCHIVED` stays right (`wallets.controller.ts:60,67`).
- Dashboard has `transferredIn`/`transferredOut` (`responses.ts:480-481`).
- Auth rate limit is 10 a minute by default (`env.ts:49`).
- Repeating budgets take no `endDate`; CUSTOM/GOAL need one (`schemas.ts:411-421`). Every row in §6.2 complies.
- A GOAL budget needs an `ACTIVE` goal (`budgets.service.ts:128`). Budgets are phase 5 and goal state changes phase 6, so the order holds.
- Contributions take `accountId`, `currency`, `recordAsTransaction` and an optional `categoryId` (`schemas.ts:465-478`).
- PATCH can change the type and category, and has no `status` field. The plan never edits status.
- The 00:10 local → 17:10Z previous-day arithmetic is unchanged.
- No `scripts/seed` or `db:seed` exists yet; `.env.*` is still ignored.

## Fixes Applied

- §1.2: `calendar.ts` keeps only the anchor and Tet table; wallet-local times go through the contracts calendar.
- §1.5: every wallet is `Asia/Ho_Chi_Minh` and both endpoints require an IANA `timeZone`. Local windows are in the wallet's zone. The generator files rows by `dayOfInstant` and builds windows with `budgetWindow`/`dayRange`, which is what `dashboard.service.ts:167,422` and `budgets.service.ts:318` use. The first draft said "the same function the server uses", but the server calls `dayOfInstant` nowhere; corrected after grep.
- §2: personas register with `timeZone`, and the two created wallets pass it too.
- §7 item 2: months are wallet-zone months, `period.timeZone` must read `Asia/Ho_Chi_Minh`, and the 00:10 entry must count in its local month.
- Re-check: grep for `+07:00` in the plan leaves only the "a fixed offset is a 422" line. Headings and every `§` reference resolve.

## Follow-ups

- Still Draft and not implemented: phases 1–7 in §10.
- Optional, not added: one wallet in a second zone (e.g. a DST zone) would put the open product question from 2026-10-06-wallet-time-zone.md (row times follow the device, not the wallet) into demo data. It's left out because it's a product decision, not a correctness gap.
