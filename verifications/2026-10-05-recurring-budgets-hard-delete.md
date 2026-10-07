# Repeating budgets (daily/weekly/monthly/yearly) and budget hard delete

**Date:** 2026-10-05T10:30:00Z
**Method:** ad hoc
**Verdict:** PASS (migration, suites, bundle); device UI not exercised
**Scope:** the user's two requests: "a monthly budget is meant to represent every month" (chose: repeats until deleted) and "delete budget entirely, no archive, no soft delete" (chose: remove existing archived budgets and the status column).
**Files touched:** `db/migrations/013_recurring_budgets_hard_delete.sql` (new), `db/tests/001_constraints.sql`; contracts `enums.ts`, `calc.ts`, `schemas.ts`, `responses.ts`, `routes.ts` (+tests); `scripts/check-contract-parity.mjs`; server `budgets/*`, `dashboard/dashboard.service.ts`, `categories/categories.service.ts`, `audit/audit-events.ts`, `common/utc-day.ts`, `database/types.ts` (+5 integration tests); mobile guest budgets/store/dashboard/upload/categories, offline queue adapter, optimistic records, pending totals, budgets API + RTK slice, `AddBudgetModal`, `BudgetDetailModal`, `BudgetEditCard`, `DeleteBudgetDialog` (replaces `ArchiveBudgetDialog`), `PlanningScreen`, `utils/budgetPeriod.ts` (new), i18n; docs CLAUDE.md BR-04 + Data Safety, `.agents/rules`, API spec §12 + dashboard + audit, SRS, SDS, README, RUNBOOK, DESIGN_GUIDELINES, test plans, `domain-database-design.md`
**Related reports:** [2026-10-05-editable-transactions-sheet-header.md](2026-10-05-editable-transactions-sheet-header.md)

## Method

```bash
docker run -d --name scratch-int-03a5db5a -e POSTGRES_DB=sora_test -p 127.0.0.1:5546:5432 postgres:17
# conversion: a second scratch DB, 001–012 applied by psql, old-shape budgets seeded, then 013
docker exec … psql -d sora_check_conversion2 < db/migrations/013_recurring_budgets_hard_delete.sql
DATABASE_URL=…5546/sora_test node scripts/migrate.mjs --constraints      # twice
DATABASE_URL=…5546/sora_test npm run test -w @sora/server
npm test -w @sora/contracts; node scripts/check-contract-parity.mjs
npm run typecheck; npm run test -w @sora/mobile; npx expo export --platform android
docker rm -f scratch-int-03a5db5a
```

## Findings

- **Model.** DAILY/WEEKLY/MONTHLY/YEARLY have no `end_date` (`chk_budget_end`) and repeat from `start_date`; `budgetWindow` (contracts `calc.ts`) gives the period containing a day, stepping from the start (31st-anchored months start on a shorter month's last day). CUSTOM/GOAL stay fixed. `BudgetResponse` gained `periodStart`/`periodEnd`; `endDate` is nullable; `status` is gone. The overlap exclusions now cover every row; an open end is unbounded, so a repeating budget holds its target until deleted.
- **Delete.** `DELETE /budgets/{id}` removes the row; audit `BUDGET_DELETED` (rows stay); a second delete 404. The route key `ROUTES.budgets.archive` became `delete`. Category archive/permanent delete now block on any budget.
- **Migration 013 on old-shape data** (seeded: archived Bills, monthly Food Sept + Food Oct, monthly Bills Oct, monthly wallet-wide Oct, a later wallet-wide December CUSTOM):

  ```
   Food Sept   | CUSTOM  | 2026-09-01 | 2026-09-30
   Food Oct    | MONTHLY | 2026-10-01 |
   Bills       | MONTHLY | 2026-10-01 |
   Wallet Oct  | CUSTOM  | 2026-10-01 | 2026-10-31
   Wallet trip | CUSTOM  | 2026-12-01 | 2026-12-10
  ```

  Archived row deleted; the latest repeating budget per target became open-ended; one followed by a later budget kept its dates as CUSTOM (Wallet Oct, because the December trip would overlap an open end). Status column gone.
- `migrate.mjs --constraints`: 013 applied, `001_constraints.sql` and `002_ai_messages.sql` PASS (probes now cover `chk_budget_end` and an open-ended overlap); second run applied nothing.
- Server 227/227 (new: delete removes and frees the slot; monthly repeats per month with `periodStart`/`periodEnd`; end-date rule; repeating blocks a later fixed budget). Contracts 137/137 (window maths incl. month-end anchoring, active-on, schema end-date rule). Parity 58/58 (`REPEATING_BUDGET_PERIODS` ↔ `chk_budget_end` replaces the dropped status pair). Mobile typecheck clean, 627/627 (guest repeat + delete + on-device upgrade, offline adapter, pending-totals window). Android bundle 3778 modules.
- **Dashboard** budgets are judged on today, or the period's nearest edge when the requested period excludes today, each over its own period around that day (server and guest).
- **Screenshot fixes:** the detail line now reads "Bills · Oct 2026" (`budgetPeriodLabel`) instead of a date range; "Over by" shows the overspend unsigned (it read "-₫8,528").
- Guest device data gets the same conversion on load (`upgradeStoredBudgets`); a budget `archive` already queued offline is sent as the same `DELETE`.

## Fixes Applied

As above.

## Follow-ups

- The user's own Docker database has not been migrated: `docker compose up -d --build` runs 013, which deletes its archived budgets (approved) and converts the rest as shown.
- Not checked on a device: the create form's "Repeats every month" footer, the detail label, delete from the swipe row and the detail sheet.
- Pre-existing unused imports surfaced by `--noUnusedLocals` in files this pass didn't touch: `AppNavigator.tsx:5` (`AddBudgetModal`), `GuestUploadScreen.tsx:10,22`.
