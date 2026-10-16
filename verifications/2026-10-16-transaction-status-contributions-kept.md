# Transactions are ACTIVE or DELETED, contributions are never removed, dead code and stale docs deleted

**Date:** 2026-10-16T02:05:38Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** The owner's decisions:
- a transaction has no `PENDING`/`COMPLETED` status, and no create makes a deleted transaction;
- a goal contribution can't be deleted at all, hard or soft;
- delete the dead code and stale docs.

The owner said the app never shows a delete for a payment that backs a contribution. The API refuses it as the backstop (AC-02).
**Files touched:** contracts (`enums.ts`, `schemas.ts`, `responses.ts`, `routes.ts`, `calc.ts` + tests), `db/migrations/004_transaction_status_active.sql`, `db/migrations/005_goal_contributions_kept.sql`, `db/tests/001`/`002`, server transactions/goals/dashboard/balance/budget/AI context + tests, mobile guest services, sync, RTK slices, goal and transaction UI, 10 locales + tests, `scripts/seed/*`, spec, SRS, SDS, ERROR_CODES.md, CLAUDE.md, `.agents/rules/technical-standards.md`, plans, test plans. Deleted files are listed under Fixes Applied.
**Related reports:** follows `2026-10-12-audit-followups-docs-probes-parity.md` (decision 3b, contribution removal, dead code).

## Method

Scratch cluster `127.0.0.1:55437`. `DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345` for the suites. A fresh `scratch_fresh_45b054ee` was created for the empty-database migration run.

```
npm run typecheck; node scripts/check-contract-parity.mjs; npm run agents:check
npm test -w @sora/contracts; npm test -w @sora/mobile; DATABASE_URL=… npm test -w @sora/server
DATABASE_URL=… npm run db:test        # both databases; then db:migrate again → "Up to date"
npx tsc -p scripts/seed/tsconfig.json --noUnusedLocals; node scripts/seed/seed-demo.mts --dry-run
```

## Findings

1. **Transaction status.**
   - `TRANSACTION_STATUSES = ['ACTIVE', 'DELETED']`.
   - Create schemas take no `status`. A sent status is stripped, so `DELETED` and `PENDING` both create `ACTIVE`; this keeps offline writes queued before the change syncing.
   - Migration 004 moves every `PENDING`/`COMPLETED` row to `ACTIVE`, sets the column default to `ACTIVE`, redefines `chk_transaction_status` and rebuilds the partial `idx_transactions_budget_scan`.
   - Applied to the populated scratch DB: `ACTIVE|662`, `DELETED|77`, no other status.
   - New test `integration.transactions:57` creates with no status and with `DELETED`/`PENDING`/`COMPLETED`; all four are `201 ACTIVE`.
   - Guest data saved earlier is read back as `ACTIVE`/`DELETED` (`guestStore.test:72`).
   - Guest upload no longer sends a status: a deleted guest transaction is created, then deleted through `/delete` (`guestUpload.ts:279`, test `guestUpload:396`).
   - → PASS
2. **Contributions are never removed.**
   - Removed: `DELETE /goals/{id}/contributions/{cId}`, its service and controller, the `ROUTES` entry, `CONTRIBUTION_NOT_FOUND`, `GOAL_CONTRIBUTION_REMOVED`, the guest `removeContribution`, the RTK mutation, the HTTP client, and the delete UI and copy in `GoalDetailModal` (10 locales).
   - Deleting a transaction a contribution points at answers `409 TRANSACTION_BACKS_CONTRIBUTION`: `transactions.service.ts:644`, guest copy `guestTransactions.ts:425`.
   - `TransactionResponse.backsContribution` lets the app hide Delete: `TransactionDetailModal.tsx:201`, `TransactionListSection.tsx:93`.
   - Migration 005 adds trigger `trg_goal_contribution_kept`, which refuses any `DELETE` on the table, a cascade from `goals` included. Probes at `001_constraints.sql` cover both cases. `integration.goals:210` gets `404 ROUTE_NOT_FOUND` for the old route, and a direct SQL delete is rejected with "never removed".
   - `integration.transactions:305`: 409, row stays `ACTIVE`, goal at `250.0000`/1 contribution, balance `4750.0000`.
   - → PASS
3. **Migrations on an empty database.** All five apply; constraint suites PASS; a second `db:migrate` prints "Up to date (5 migration(s) applied)". → PASS
4. **Seed.**
   - Removed the three `PENDING` rows (next rent, Kyoto hotel hold, ryokan) and the removed Motorbike contribution. Neither changed a final figure: the pending rows never counted, and the removed contribution's row ended `DELETED`.
   - Duplicates are still created and then deleted.
   - Seed typecheck clean; `--dry-run` passes every ledger check, with the 1 tolerated typical-period claim as before.
   - → PASS
5. **Docs.**
   - Spec §11.1/§11.2/§11.5/§12/§13.8/§16.3 and the index (58 routes). SRS FR-22/31/50, BR-07, TXN-US-08 and SAV-US-05, which is now "A contribution is kept for good" so its id stays stable. SDS ERD, flow, §6, §7, §8. ERROR_CODES.md, CLAUDE.md Data Safety and its Codex port, `domain-database-design.md`, `dashboard-current-state.md`, `seed-data-plan.md`.
   - Test plans: rows rewritten for the new rules. TC-SAV-21/23 removed with their tests. Added TC-TXN-37, TC-GST-23 and TC-GST-24. README counts recomputed: 291 cases, 288 covered, 2 partial, 1 gap (TC-SYNC-28, the device check, was "Open").
   - → PASS
6. **Test-plan line references.**
   - Recomputed from the committed plans through `git blame`, then snapped to the adjacent `it(` where a ref sat on a `});`, a blank or a first statement. SQL refs were reassigned by probe label.
   - 725 refs, 0 to missing files.
   - 8 `.ts` refs point into a test body on purpose (fixtures, a named assertion), down from 53.
   - → PASS
7. **Dead code and stale docs deleted.** Each item was re-checked for importers first. The guest `displayCurrency` branch was kept: it is tested and mirrors the server contract the planned converted-total UI (DASH-US-03) will call. → PASS

Final run, after the last edit (server and DB runs predate only the two mobile import removals):

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `check-contract-parity.mjs` | 140/140 |
| `agents:check` | 11 skills in sync |
| contracts | 176 pass, 0 fail |
| mobile | 718 pass, 0 fail |
| server (scratch DB) | 294 pass, 0 fail |
| `db:test` (populated and fresh DB) | 001, 002, 003 PASS |

## Fixes Applied

Removed:
- `mobile/GAPS.md`, `mobile/MODAL_UI_STATE.md`: stale.
- `mobile/src/components/FadeIn.tsx`, `mobile/src/features/categories/components/CategoryPicker.tsx`, `categoryTypeLabel.ts`, `mobile/src/services/sync/optimisticMutation.ts` (+ test): no importers.
- `GuestUploadTask`, `MONEY_DECIMALS`, `PreviewInvitationRequest`, `en.ts` `valuation: {}` in all 10 locales, the root `lint` script: unused.

`GAPS.md`'s still-current "Not built" items are carried in Follow-ups below.

## Follow-ups

- Live seed run not done: it writes `.env.seed`, which already exists (2026-10-07) and would be overwritten.
- `scratch_fresh_45b054ee` left in the scratch cluster; dropping it needs the owner's say. Cluster stopped (it was found stopped on 2026-10-16), not deleted.
- From the deleted `GAPS.md`, still not built:
  - Google sign-in has never been run against Google;
  - a member's `relationLabel` can't be edited after invitation;
  - no push notifications.
- Not changed, owner's call: MB-03 says forms use RHF, but only login/register do.
- `server/src/ai/*` unused imports belong to the separate Gemini work.
