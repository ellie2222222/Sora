# Audit follow-ups: doc drift, test-plan refs, constraint probes, parity checks, small mobile fixes

**Date:** 2026-10-12T08:06:07Z
**Method:** ad hoc (third remediation pass on `2026-10-12-full-project-audit.md`'s follow-ups)
**Verdict:** PASS
**Scope:** the audit follow-ups that need no product decision: spec index, test-plan `#L` refs, `domain-database-design.md` §14, `ERROR_CODES.md`, SDS/SRS drift, plan checkboxes and the plans index, agent rules, contracts duplicates, db-test blind spots, parity blind spots, picker error states, i18n concatenations, `PeriodSummaryCard` memo, spec §2.6.
**Files touched:** listed per finding below.
**Related reports:** follows `2026-10-12-audit-decisions-remediation.md` and `2026-10-12-full-project-audit.md`.

## Method

Database: scratch cluster on 127.0.0.1:55437, `DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345`. Every `db/tests` suite ends in `ROLLBACK`.

```
npm run typecheck; node scripts/check-contract-parity.mjs; npm run agents:check
npm test -w @sora/contracts; npm test -w @sora/mobile
DATABASE_URL=… npm test -w @sora/server; DATABASE_URL=… npm run db:test
node scripts/audit-runtime-deps.mjs
```

## Findings

1. **Spec index missed `POST /auth/google` and `PATCH /auth/me/preferences`.** Added as rows 7–8, renumbered to 59. Parity now compares exact path shapes both ways (finding 9). → PASS
2. **Test-plan `#L` refs.**
   - 185 refs remapped by diffing each target file at the commit that wrote the ref against today's file.
   - 42 more that pointed at `});` or a blank line were moved to the test start found in the file's history, where the jump was ≤3 lines or the title names the row's story id.
   - 11 hand-fixed refs pointed at renamed or rewritten tests: `integration.idempotency`, `integration.ledger:277/296`, `entityAdapters`, `offlineQueueSlice`, `exchange-rate`.
   - 71 `[file:N]` labels were synced to their anchors.
   - Result: 722 refs, 0 to missing files. 53 refs land inside a test body rather than on its `it(` line; many point at a specific assertion on purpose.
   - → PASS
3. **`domain-database-design.md` §14/§15** was a stale copy of the schema. Both are now a table → `001_schema.sql:<line>` / `003_idempotency_keys.sql:10` index. → PASS
4. **`docs/ERROR_CODES.md`** recommended codes that don't exist and policies the API doesn't follow:
   - codes: `INVALID_CREDENTIALS`, per-action `*_FORBIDDEN`, `INSUFFICIENT_BALANCE`, `AMOUNT_INVALID`, the `SPACE` resource;
   - policies: per-action forbidden codes, field-level validation codes.
   - §2–§10 and the §13/§15 examples were rewritten from the real `ERROR_CODES`. Every example code is now real; the only non-real names left are the "don't" examples.
   - → PASS
5. **SDS §6/§8 and SRS drift.**
   - SDS §6.1 now lists `/transactions/{id}/delete` instead of `/cancel`, plus the 7 AI routes (59 total).
   - §6.2: `TRANSACTION_ALREADY_CANCELLED` → `TRANSACTION_ALREADY_DELETED`. Added `ROUTE_NOT_FOUND` and the 3 AI codes. Widened `CATEGORY_ARCHIVED` and `GOAL_NOT_ACTIVE` to cover transactions. `WALLET_NOT_FOUND` now cites AC-01.
   - §8 now maps 53 stories: DASH-US-04 and an AI-US section were added.
   - SRS no longer says the amount is uneditable (line 199, TXN-US-08); it now follows BR-03.
   - → PASS
6. **Plans.**
   - `timezone.md` DoD: 26 items ticked, with evidence from `2026-10-06-wallet-time-zone.md` and the A1 fix.
   - `ai-chat-assistant-plan.md`: 7 of 12 ticked with evidence. The wallet `ON DELETE SET NULL` item stays open, because the FK has no action and wallets are never deleted. The Mobile UI items stay open until seen on a device.
   - `plans/README.md` now lists all 12 plans with real statuses. `mobile/GAPS.md` has a note marking its history sections.
   - → PASS
7. **Agent rules.** `.agents/rules/technical-standards.md` gained Validation (VL-01..04), Logging & Audit (LA-01..04), Configuration and Security, and the AGENTS.md trigger row names them. `agents:check` in sync. → PASS
8. **Contracts duplicates.**
   - `resolvePeriod` (server and guest copies) is now `dashboardPeriod` in `calendar.ts`. The guest copy also gains the server's inverted-range refusal.
   - `AuditResult` is the contracts tuple `AUDIT_RESULTS`, and parity checks it against `chk_audit_result`.
   - Tests: `calendar.test.ts` +2 (`dashboardPeriod`), `guestDashboard.test.ts` +1 (lone `dateFrom` in 2999 → 422).
   - → PASS
9. **Parity blind spots.**
   - New: 37 checks that each stored string's Zod `.max()` fits its column, and 76 exact route-shape checks in both directions between ROUTES and the spec's §3 index.
   - Negative run (scratch copy with `/auth/me/preferences` renamed in the spec and `goals.name` mapped to `goals.currency`) reported all 4 expected failures.
   - 142/142.
   - → PASS
10. **db-test blind spots.**
    - `expect_reject` passed on any error; `001` and `002` now use `expect_violation(stmt, constraint, label)`, matching `003`. Before pinning, each rejection's actual constraint was read back with `GET STACKED DIAGNOSTICS`; all 42 matched their labels.
    - 21 probes added for the constraints that had none, the last one, `chk_ai_message_action_status`, in `002`.
    - Negative run: the goal-target probe expecting `chk_budget_dates` failed with "rejected by chk_goal_target but must be by chk_budget_dates".
    - Every named `chk_`/`uq_`/`excl_` constraint now has a pinned probe except `chk_transaction_type`: `chk_transaction_shape` always fires first, and parity checks its members.
    - → PASS
11. **Mobile.**
    - `CategoryGrid` and `AccountPicker` render `StateView` with a retry when their list read fails with nothing to show.
    - `BudgetCard` uses `budgets.amountLeft` (`{{amount}} left`). The grid and picker empty states use `categories.noCategoriesOfType.<TYPE>`. Both replace `toLowerCase()` on translated words. All 10 locales, `localeParity` 13/13.
    - `PeriodSummaryCard` totals are memoised on `transactions`.
    - → PASS
12. **Spec §2.6.** A 400 is only an unparseable JSON body, with code `VALIDATION_FAILED` (`all-exceptions.filter.test.ts:69`). A bad query value is 422 (`integration.transactions.test.ts:162`). → PASS

Final run, after the last edit:

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `check-contract-parity.mjs` | 142/142 |
| `agents:check` | 11 skills in sync |
| contracts | 176 pass, 0 fail |
| mobile | 718 pass, 0 fail |
| server (scratch DB) | 295 pass, 0 fail |
| `db:test` | 001, 002, 003 PASS (55 + 8 + 3 pinned rejections) |
| `audit-runtime-deps.mjs` | no unaccepted high/critical (2 accepted) |

## Fixes Applied

See Findings; each was re-verified by the run above.

## Follow-ups

- Decision 3b (born-`DELETED` transactions) is still waiting on the owner.
- Owner's call:
  - CLAUDE.md Data Safety says no contribution is hard-removed, but §13.8 and the code remove them.
  - MB-03 says forms use RHF, but only login/register do.
- Dead code (deleting needs the owner's say): `categoryTypeLabel.ts` (no importers after finding 11), plus the audit's list: `CategoryPicker.tsx`, `FadeIn.tsx`, `optimisticMutation.ts`, `GuestUploadTask`, `MONEY_DECIMALS`, `PreviewInvitationRequest`, the guest `displayCurrency` branch, `en.ts` `valuation: {}`, and the root `lint` script.
- `WalletActivityPanel` shows raw audit event/entity/result text (`humanizeEvent`), untranslated. Translating it needs keys for every audit event.
- 53 test-plan refs point inside a test body; checking each against its row needs a reading pass.
- The ~25 off-table testIDs need Maestro flow updates. Budget/goal currency defaulting to the wallet's first balance is a product call.
- Parity imports `schemas.ts` directly, so Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning on stderr. It's harmless; adding `"type": "module"` to `packages/contracts/package.json` would silence it.
- Scratch cluster stopped, not deleted.
